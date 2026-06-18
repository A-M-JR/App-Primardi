"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { revalidatePath } from "next/cache"
import { normalizeText } from "@/lib/compras/normalize-text"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import type { TipoMatchProduto } from "@/lib/compras/types"
import {
  parseLinhasImportacao,
  parsePrecosFornecedor,
  toLinhasImportJson,
} from "@/lib/compras/json-store"

async function matchLinha(
  linha: {
    ean: string | null | undefined
    codigoFornecedor: string | null | undefined
    descricao: string | null | undefined
  },
  fornecedorId: number,
  empresaId: number,
  precosCache: Map<number, ReturnType<typeof parsePrecosFornecedor>>
): Promise<{ produtoId: number; matchTipo: TipoMatchProduto } | null> {
  if (linha.ean) {
    const eanNorm = linha.ean.replace(/\D/g, "")
    if (eanNorm.length >= 8) {
      const byEan = await prisma.produto.findFirst({
        where: { empresaId, ativo: true, ean: eanNorm },
      })
      if (byEan) return { produtoId: byEan.id, matchTipo: "EAN" }
    }
  }

  if (linha.codigoFornecedor) {
    for (const [produtoId, precos] of precosCache) {
      const entry = precos[String(fornecedorId)]
      if (entry?.codigoFornecedor === linha.codigoFornecedor) {
        return { produtoId, matchTipo: "CODIGO_FORNECEDOR" }
      }
    }
  }

  if (linha.descricao) {
    const norm = normalizeText(linha.descricao)
    const produtos = await prisma.produto.findMany({
      where: { empresaId, ativo: true },
      select: { id: true, nome: true },
    })
    const match = produtos.find((p) => normalizeText(p.nome) === norm)
    if (match) return { produtoId: match.id, matchTipo: "NOME_NORMALIZADO" }
  }

  return null
}

export async function executarMatchImportacao(importacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const linhas = parseLinhasImportacao(imp.linhas)
  const produtoIds = [
    ...new Set(linhas.filter((l) => l.produtoId).map((l) => l.produtoId!)),
  ]
  const produtosComPrecos = await prisma.produto.findMany({
    where: { id: { in: produtoIds }, empresaId: ctx.empresaId },
    select: { id: true, precosFornecedor: true },
  })
  const precosCache = new Map(
    produtosComPrecos.map((p) => [p.id, parsePrecosFornecedor(p.precosFornecedor)])
  )

  let vinculadas = 0
  const atualizadas = [...linhas]

  for (let i = 0; i < atualizadas.length; i++) {
    const linha = atualizadas[i]
    if (linha.status !== "VALIDA") continue

    const match = await matchLinha(
      {
        ean: linha.ean,
        codigoFornecedor: linha.codigoFornecedor,
        descricao: linha.descricao,
      },
      imp.fornecedorId,
      ctx.empresaId,
      precosCache
    )
    if (!match) continue

    atualizadas[i] = {
      ...linha,
      produtoId: match.produtoId,
      matchTipo: match.matchTipo,
      status: "VINCULADA",
    }
    vinculadas++
  }

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: {
      linhas: toLinhasImportJson(atualizadas),
      linhasVinculadas: vinculadas,
    },
  })

  revalidatePath(`/compras/importacoes/${importacaoId}`)
  return { vinculadas }
}

export async function vincularProdutoManual(
  importacaoId: number,
  numeroLinha: number,
  produtoId: number,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, empresaId: ctx.empresaId },
  })
  if (!produto) throw new Error("Produto não encontrado.")

  const linhas = parseLinhasImportacao(imp.linhas)
  const idx = linhas.findIndex((l) => l.numeroLinha === numeroLinha)
  if (idx < 0) throw new Error("Linha não encontrada.")

  const linha = linhas[idx]
  linhas[idx] = {
    ...linha,
    produtoId,
    matchTipo: "MANUAL",
    status: "VINCULADA",
  }

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: { linhas: toLinhasImportJson(linhas) },
  })

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "VINCULAR",
    entidade: "FornecedorImportacao",
    entidadeId: importacaoId,
    detalhes: { produtoId, numeroLinha },
  })

  revalidatePath(`/compras/importacoes/${importacaoId}`)
  return { ok: true }
}
