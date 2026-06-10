"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { revalidatePath } from "next/cache"
import { normalizeText } from "@/lib/compras/normalize-text"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import type { TipoMatchProduto } from "@prisma/client"

async function matchLinha(
  linha: {
    id: number
    ean: string | null
    codigoFornecedor: string | null
    descricao: string | null
  },
  fornecedorId: number,
  empresaId: number
): Promise<{ produtoId: number; matchTipo: TipoMatchProduto } | null> {
  if (linha.ean) {
    const byEan = await prisma.produto.findFirst({
      where: { empresaId, ean: linha.ean, ativo: true },
    })
    if (byEan) return { produtoId: byEan.id, matchTipo: "EAN" }
  }

  if (linha.codigoFornecedor) {
    const map = await prisma.fornecedorProdutoMap.findFirst({
      where: {
        fornecedorId,
        codigoFornecedor: linha.codigoFornecedor,
        ativo: true,
      },
    })
    if (map) return { produtoId: map.produtoId, matchTipo: "CODIGO_FORNECEDOR" }
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
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const linhas = await prisma.fornecedorImportacaoLinha.findMany({
    where: { importacaoId, status: "VALIDA" },
  })

  let vinculadas = 0

  for (const linha of linhas) {
    const match = await matchLinha(linha, imp.fornecedorId, ctx.empresaId)
    if (!match) continue

    await prisma.fornecedorImportacaoLinha.update({
      where: { id: linha.id },
      data: {
        produtoId: match.produtoId,
        matchTipo: match.matchTipo,
        status: "VINCULADA",
      },
    })

    if (linha.codigoFornecedor) {
      await prisma.fornecedorProdutoMap.upsert({
        where: {
          fornecedorId_codigoFornecedor: {
            fornecedorId: imp.fornecedorId,
            codigoFornecedor: linha.codigoFornecedor,
          },
        },
        create: {
          empresaId: ctx.empresaId,
          fornecedorId: imp.fornecedorId,
          produtoId: match.produtoId,
          codigoFornecedor: linha.codigoFornecedor,
          eanFornecedor: linha.ean,
          descricaoFornecedor: linha.descricao,
          matchTipo: match.matchTipo,
          confirmadoManual: match.matchTipo === "MANUAL",
          vinculadoPorUserId: ctx.userId,
        },
        update: {
          produtoId: match.produtoId,
          eanFornecedor: linha.ean,
          descricaoFornecedor: linha.descricao,
          matchTipo: match.matchTipo,
          ativo: true,
        },
      })
    }

    vinculadas++
  }

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: { linhasVinculadas: vinculadas },
  })

  revalidatePath(`/compras/importacoes/${importacaoId}`)
  return { vinculadas }
}

export async function vincularProdutoManual(
  linhaId: number,
  produtoId: number,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const linha = await prisma.fornecedorImportacaoLinha.findFirst({
    where: { id: linhaId },
    include: { importacao: true },
  })
  if (!linha || linha.importacao.empresaId !== ctx.empresaId) {
    throw new Error("Linha não encontrada.")
  }

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, empresaId: ctx.empresaId },
  })
  if (!produto) throw new Error("Produto não encontrado.")

  await prisma.fornecedorImportacaoLinha.update({
    where: { id: linhaId },
    data: {
      produtoId,
      matchTipo: "MANUAL",
      status: "VINCULADA",
    },
  })

  if (linha.codigoFornecedor) {
    await prisma.fornecedorProdutoMap.upsert({
      where: {
        fornecedorId_codigoFornecedor: {
          fornecedorId: linha.importacao.fornecedorId,
          codigoFornecedor: linha.codigoFornecedor,
        },
      },
      create: {
        empresaId: ctx.empresaId,
        fornecedorId: linha.importacao.fornecedorId,
        produtoId,
        codigoFornecedor: linha.codigoFornecedor,
        eanFornecedor: linha.ean,
        descricaoFornecedor: linha.descricao,
        matchTipo: "MANUAL",
        confirmadoManual: true,
        vinculadoPorUserId: ctx.userId,
      },
      update: {
        produtoId,
        confirmadoManual: true,
        matchTipo: "MANUAL",
        ativo: true,
        vinculadoPorUserId: ctx.userId,
      },
    })
  }

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "VINCULAR",
    entidade: "FornecedorImportacaoLinha",
    entidadeId: linhaId,
    detalhes: { produtoId },
  })

  revalidatePath(`/compras/importacoes/${linha.importacaoId}`)
  return { ok: true }
}

export async function desvincularProdutoMap(mapId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  await prisma.fornecedorProdutoMap.updateMany({
    where: { id: mapId, empresaId: ctx.empresaId },
    data: { ativo: false },
  })
}
