"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { revalidatePath } from "next/cache"
import {
  parseLinhasImportacao,
  parsePrecosFornecedor,
  setPrecoFornecedor,
  toPrecosJson,
} from "@/lib/compras/json-store"
import type { PrecoFornecedorEntry } from "@/lib/compras/types"

export async function consolidarPrecosImportacao(importacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const linhas = parseLinhasImportacao(imp.linhas).filter(
    (l) => l.status === "VINCULADA" && l.produtoId && l.preco != null
  )

  const porProduto = new Map<number, typeof linhas>()
  for (const linha of linhas) {
    if (!linha.produtoId) continue
    const list = porProduto.get(linha.produtoId) ?? []
    list.push(linha)
    porProduto.set(linha.produtoId, list)
  }

  // Busca todos os produtos de uma vez (evita N+1) e prepara os updates.
  const produtoIds = [...porProduto.keys()]
  const produtos = await prisma.produto.findMany({
    where: { id: { in: produtoIds }, empresaId: ctx.empresaId },
    select: { id: true, precosFornecedor: true },
  })
  const produtoById = new Map(produtos.map((p) => [p.id, p]))
  const agora = new Date().toISOString()

  const updates = []
  for (const [produtoId, grupo] of porProduto) {
    const produto = produtoById.get(produtoId)
    if (!produto) continue
    const linha = grupo[0]

    const precos = parsePrecosFornecedor(produto.precosFornecedor)
    const entry: PrecoFornecedorEntry = {
      preco: linha.preco!,
      estoqueFornecedor: linha.estoqueFornecedor,
      codigoFornecedor: linha.codigoFornecedor,
      eanFornecedor: linha.ean,
      descricaoFornecedor: linha.descricao,
      multiplo: linha.multiplo,
      embalagem: linha.embalagem,
      laboratorio: linha.laboratorio,
      matchTipo: linha.matchTipo,
      importacaoId,
      atualizadoEm: agora,
    }

    updates.push(
      prisma.produto.update({
        where: { id: produtoId },
        data: { precosFornecedor: toPrecosJson(setPrecoFornecedor(precos, imp.fornecedorId, entry)) },
      })
    )
  }

  if (updates.length) await prisma.$transaction(updates)

  revalidatePath("/compras/importacoes")
  return { consolidados: linhas.length }
}
