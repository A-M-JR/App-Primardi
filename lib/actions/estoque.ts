"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"

const ESTOQUE_PAGE_SIZE = 20

export async function getEstoqueProdutos(params: {
  page?: number
  limit?: number
  search?: string
  empresaId?: number
} = {}) {
  const page = Math.max(1, params.page || 1)
  const limit = params.limit || ESTOQUE_PAGE_SIZE
  const empresaId = params.empresaId || 1
  const search = params.search?.trim() || ""

  const where: Prisma.ProdutoWhereInput = {
    empresaId,
    ativo: true,
  }

  if (search) {
    where.OR = [
      { nome: { contains: search, mode: "insensitive" } },
      { codigo: { contains: search, mode: "insensitive" } },
      { ean: { contains: search, mode: "insensitive" } },
    ]
  }

  const [total, produtos] = await prisma.$transaction([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        codigo: true,
        nome: true,
        ean: true,
        estoque: true,
        unidadePadrao: true,
      },
    }),
  ])

  return {
    data: produtos,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getMovimentacoesEstoque(produtoId?: number) {
  const where = produtoId ? { produtoId } : {}
  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      produto: {
        select: { nome: true, codigo: true, unidadePadrao: true }
      }
    }
  })
  
  return movimentacoes.map(m => ({
    ...m,
    criadoEm: m.criadoEm.toISOString(),
  }))
}

export async function addMovimentacaoEstoque(data: {
  produtoId: number
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE"
  quantidade: number
  descricao?: string
  pedidoId?: number
}, empresaId = 1) {
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Pega o estoque atual bloqueando a linha (FOR UPDATE)
      const produto = await tx.$queryRaw`
        SELECT estoque FROM "crm_produtos" 
        WHERE id = ${data.produtoId} 
        FOR UPDATE
      ` as any[]

      if (produto.length === 0) throw new Error("Produto não encontrado")
      
      const estoqueAntes = Number(produto[0].estoque) || 0
      let estoqueDepois = estoqueAntes

      if (data.tipo === "ENTRADA") {
        estoqueDepois += data.quantidade
      } else if (data.tipo === "SAIDA") {
        estoqueDepois -= data.quantidade
      } else if (data.tipo === "AJUSTE") {
        estoqueDepois = data.quantidade
      }

      // 1. Atualiza o saldo no produto
      await tx.$executeRaw`
        UPDATE "crm_produtos" 
        SET estoque = ${estoqueDepois} 
        WHERE id = ${data.produtoId}
      `

      // 2. Registra o log da movimentação
      const now = new Date()
      await tx.$executeRaw`
        INSERT INTO "crm_movimentacoes_estoque" 
        ("empresaId", "produtoId", tipo, quantidade, "estoqueAntes", "estoqueDepois", descricao, "pedidoId", "criadoEm")
        VALUES (
          ${empresaId}, ${data.produtoId}, ${data.tipo}, ${data.quantidade}, 
          ${estoqueAntes}, ${estoqueDepois}, ${data.descricao || null}, ${data.pedidoId || null}, ${now}
        )
      `

      return { estoqueAntes, estoqueDepois }
    })

    revalidatePath("/estoque")
    revalidatePath("/produtos")
    return { success: true, ...result }
  } catch (error: any) {
    console.error("ERRO ao movimentar estoque:", error)
    throw new Error(error.message || "Erro ao movimentar estoque")
  }
}
