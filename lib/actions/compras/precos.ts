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
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

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

  for (const [produtoId, grupo] of porProduto) {
    const linha = grupo[0]
    const produto = await prisma.produto.findFirst({
      where: { id: produtoId, empresaId: ctx.empresaId },
      select: { precosFornecedor: true },
    })
    if (!produto) continue

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
      atualizadoEm: new Date().toISOString(),
    }

    await prisma.produto.update({
      where: { id: produtoId },
      data: { precosFornecedor: toPrecosJson(setPrecoFornecedor(precos, imp.fornecedorId, entry)) },
    })
  }

  revalidatePath("/compras/importacoes")
  return { consolidados: linhas.length }
}
