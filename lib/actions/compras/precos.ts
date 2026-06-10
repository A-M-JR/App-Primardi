"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"

export async function consolidarPrecosImportacao(importacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const linhas = await prisma.fornecedorImportacaoLinha.findMany({
    where: {
      importacaoId,
      status: "VINCULADA",
      produtoId: { not: null },
      preco: { not: null },
    },
  })

  for (const linha of linhas) {
    if (!linha.produtoId || linha.preco === null) continue

    await prisma.fornecedorPrecoAtual.upsert({
      where: {
        fornecedorId_produtoId: {
          fornecedorId: imp.fornecedorId,
          produtoId: linha.produtoId,
        },
      },
      create: {
        empresaId: ctx.empresaId,
        fornecedorId: imp.fornecedorId,
        produtoId: linha.produtoId,
        preco: linha.preco,
        estoqueFornecedor: linha.estoqueFornecedor,
        multiplo: linha.multiplo,
        embalagem: linha.embalagem,
        laboratorio: linha.laboratorio,
        importacaoLinhaId: linha.id,
      },
      update: {
        preco: linha.preco,
        estoqueFornecedor: linha.estoqueFornecedor,
        multiplo: linha.multiplo,
        embalagem: linha.embalagem,
        laboratorio: linha.laboratorio,
        importacaoLinhaId: linha.id,
        vigenteDesde: new Date(),
      },
    })

    await prisma.fornecedorPrecoHistorico.create({
      data: {
        empresaId: ctx.empresaId,
        fornecedorId: imp.fornecedorId,
        produtoId: linha.produtoId,
        preco: linha.preco,
        importacaoId,
        importacaoLinhaId: linha.id,
      },
    })
  }

  revalidatePath("/compras/comparativo")
  return { consolidados: linhas.length }
}

export type ComparativoPrecoItem = {
  chave: string
  produtoId: number | null
  produto: {
    id: number
    codigo: string
    nome: string
    ean: string | null
    estoque: number
  } | null
  ean: string | null
  descricao: string | null
  fornecedores: {
    fornecedorId: number
    fornecedor: { id: number; razaoSocial: string }
    preco: number
    estoqueFornecedor: number | null
    vigenteDesde: Date | null
  }[]
  menorPreco: number | null
  maiorPreco: number | null
  melhorFornecedor: { id: number; razaoSocial: string } | null
  qtdFornecedores: number
  comparavel: boolean
}

function normalizeEan(ean: string | null | undefined): string | null {
  if (!ean) return null
  const n = ean.replace(/\D/g, "")
  return n.length >= 8 ? n : null
}

export async function getComparativoPrecos(
  options?: { apenasComparaveis?: boolean; produtoId?: number },
  requesterId?: number
): Promise<ComparativoPrecoItem[]> {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  type Grupo = {
    produtoId: number | null
    produto: ComparativoPrecoItem["produto"]
    ean: string | null
    descricao: string | null
    fornecedores: Map<number, ComparativoPrecoItem["fornecedores"][0]>
  }

  const grupos = new Map<string, Grupo>()

  function grupoKey(produtoId: number | null, ean: string | null): string {
    if (produtoId) return `p:${produtoId}`
    if (ean) return `e:${ean}`
    return ""
  }

  function upsertPreco(
    produtoId: number | null,
    produto: ComparativoPrecoItem["produto"],
    ean: string | null,
    descricao: string | null,
    fornecedorId: number,
    fornecedor: { id: number; razaoSocial: string },
    preco: number,
    estoqueFornecedor: number | null,
    vigenteDesde: Date | null
  ) {
    const eanNorm = normalizeEan(ean)
    const key = grupoKey(produtoId, eanNorm)
    if (!key) return

    if (!grupos.has(key)) {
      grupos.set(key, {
        produtoId,
        produto,
        ean: eanNorm,
        descricao,
        fornecedores: new Map(),
      })
    }

    const g = grupos.get(key)!
    if (!g.produto && produto) g.produto = produto
    if (!g.descricao && descricao) g.descricao = descricao
    if (!g.ean && eanNorm) g.ean = eanNorm

    const atual = g.fornecedores.get(fornecedorId)
    if (!atual || preco < atual.preco) {
      g.fornecedores.set(fornecedorId, {
        fornecedorId,
        fornecedor,
        preco,
        estoqueFornecedor,
        vigenteDesde,
      })
    }
  }

  // 1) Preços consolidados (produto vinculado)
  const precosAtuais = await prisma.fornecedorPrecoAtual.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(options?.produtoId ? { produtoId: options.produtoId } : {}),
    },
    include: {
      produto: { select: { id: true, codigo: true, nome: true, ean: true, estoque: true } },
      fornecedor: { select: { id: true, razaoSocial: true } },
    },
  })

  for (const p of precosAtuais) {
    upsertPreco(
      p.produtoId,
      p.produto,
      p.produto.ean,
      p.produto.nome,
      p.fornecedorId,
      p.fornecedor,
      p.preco,
      p.estoqueFornecedor,
      p.vigenteDesde
    )
  }

  // 2) Última importação concluída por fornecedor (inclui linhas ainda não vinculadas, match por EAN)
  const importacoes = await prisma.fornecedorImportacao.findMany({
    where: { empresaId: ctx.empresaId, status: "CONCLUIDA" },
    orderBy: { processadoEm: "desc" },
    include: {
      fornecedor: { select: { id: true, razaoSocial: true } },
      linhas: {
        where: {
          preco: { not: null },
          status: { in: ["VALIDA", "VINCULADA"] },
        },
        include: {
          produto: { select: { id: true, codigo: true, nome: true, ean: true, estoque: true } },
        },
      },
    },
  })

  const ultimaPorFornecedor = new Map<number, (typeof importacoes)[0]>()
  for (const imp of importacoes) {
    if (!ultimaPorFornecedor.has(imp.fornecedorId)) {
      ultimaPorFornecedor.set(imp.fornecedorId, imp)
    }
  }

  for (const imp of ultimaPorFornecedor.values()) {
    for (const linha of imp.linhas) {
      if (linha.preco === null) continue
      const ean = normalizeEan(linha.ean ?? linha.produto?.ean)
      upsertPreco(
        linha.produtoId,
        linha.produto,
        ean,
        linha.descricao ?? linha.produto?.nome ?? null,
        imp.fornecedorId,
        imp.fornecedor,
        linha.preco,
        linha.estoqueFornecedor,
        imp.processadoEm
      )
    }
  }

  // 3) Mesclar grupos EAN → produto quando EAN bate com produto já agrupado
  const produtoPorEan = new Map<string, string>()
  for (const [key, g] of grupos) {
    if (key.startsWith("p:") && g.ean) produtoPorEan.set(g.ean, key)
  }
  for (const [key, g] of [...grupos]) {
    if (!key.startsWith("e:") || !g.ean) continue
    const prodKey = produtoPorEan.get(g.ean)
    if (!prodKey || prodKey === key) continue
    const dest = grupos.get(prodKey)!
    for (const [fid, f] of g.fornecedores) {
      const atual = dest.fornecedores.get(fid)
      if (!atual || f.preco < atual.preco) dest.fornecedores.set(fid, f)
    }
    grupos.delete(key)
  }

  const resultado: ComparativoPrecoItem[] = []

  for (const [key, g] of grupos) {
    const fornecedores = Array.from(g.fornecedores.values()).sort((a, b) => a.preco - b.preco)
    if (!fornecedores.length) continue

    const precos = fornecedores.map((f) => f.preco)
    const menorPreco = Math.min(...precos)
    const maiorPreco = Math.max(...precos)
    const melhor = fornecedores.find((f) => f.preco === menorPreco) ?? null

    const item: ComparativoPrecoItem = {
      chave: key,
      produtoId: g.produtoId,
      produto: g.produto,
      ean: g.ean,
      descricao: g.descricao,
      fornecedores,
      menorPreco,
      maiorPreco,
      melhorFornecedor: melhor ? melhor.fornecedor : null,
      qtdFornecedores: fornecedores.length,
      comparavel: fornecedores.length >= 2,
    }

    if (options?.apenasComparaveis && !item.comparavel) continue
    if (options?.produtoId && g.produtoId !== options.produtoId) continue

    resultado.push(item)
  }

  return resultado.sort((a, b) => {
    if (a.comparavel !== b.comparavel) return a.comparavel ? -1 : 1
    if (b.qtdFornecedores !== a.qtdFornecedores) return b.qtdFornecedores - a.qtdFornecedores
    return (a.produto?.nome ?? a.descricao ?? "").localeCompare(b.produto?.nome ?? b.descricao ?? "")
  })
}

export async function getHistoricoPreco(
  produtoId: number,
  fornecedorId?: number,
  requesterId?: number
) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.fornecedorPrecoHistorico.findMany({
    where: {
      empresaId: ctx.empresaId,
      produtoId,
      ...(fornecedorId ? { fornecedorId } : {}),
    },
    orderBy: { registradoEm: "desc" },
    take: 50,
  })
}
