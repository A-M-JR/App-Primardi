"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import type { Prisma } from "@prisma/client"

const PRODUTOS_PAGE_SIZE = 20

function mapProduto(e: {
  id: number
  empresaId: number
  codigo: string
  nome: string
  descricao: string | null
  fornecedorId: number | null
  ean: string | null
  estoque: number
  precoBase: number
  categoriaId: number | null
  unidadePadrao: string
  ativo: boolean
  criadoEm: Date
  updatedAt: Date
  clientesAutorizados?: {
    clienteId: number
    cliente: { id: number; razaoSocial: string }
    preco?: number | null
  }[]
  tabelasPreco?: { tabelaPrecoId: number; preco: number }[]
}) {
  return {
    ...e,
    criadoEm: e.criadoEm.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    clientesIds: e.clientesAutorizados?.map((ca) => ca.clienteId) ?? [],
    clientesVinculados:
      e.clientesAutorizados?.map((ca) => ({
        id: ca.clienteId,
        razaoSocial: ca.cliente.razaoSocial,
        preco: ca.preco ?? null,
      })) ?? [],
  }
}

export async function getProdutosPaginated(params: {
  page?: number
  limit?: number
  search?: string
  empresaId?: number
} = {}) {
  noStore()
  const page = Math.max(1, params.page || 1)
  const limit = params.limit || PRODUTOS_PAGE_SIZE
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
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        empresaId: true,
        codigo: true,
        nome: true,
        descricao: true,
        fornecedorId: true,
        ean: true,
        estoque: true,
        precoBase: true,
        categoriaId: true,
        unidadePadrao: true,
        ativo: true,
        criadoEm: true,
        updatedAt: true,
      },
    }),
  ])

  return {
    data: produtos.map((p) => mapProduto(p)),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getProdutos() {
  const dbProdutos = await prisma.produto.findMany({
    orderBy: { id: "desc" },
    include: {
      clientesAutorizados: {
        include: {
          cliente: {
            select: { id: true, razaoSocial: true },
          },
        },
      },
      tabelasPreco: {
        select: {
          tabelaPrecoId: true,
          preco: true,
        },
      },
    },
  })

  return dbProdutos.map((e) => mapProduto(e))
}

export async function getNextProdutoCode() {
  const lastProduto = await prisma.produto.findFirst({
    orderBy: { id: 'desc' },
    select: { codigo: true }
  })

  if (!lastProduto) return "1"

  const lastCode = parseInt(lastProduto.codigo)
  if (isNaN(lastCode)) {
      // If the last code wasn't a number, count all and suggest next
      const count = await prisma.produto.count()
      return (count + 1).toString()
  }

  return (lastCode + 1).toString()
}

export async function saveProduto(data: any, empresaId = 1) {
  try {
    const { id, clientes, ...rest } = data
    
    const prismaData = {
      empresaId,
      nome: rest.nome,
      codigo: rest.codigo,
      ean: rest.ean,
      descricao: rest.descricao || null,
      unidadePadrao: rest.unidadePadrao || "UN",
      precoBase: rest.precoBase ? Number(rest.precoBase) : 0,
      ativo: rest.ativo !== undefined ? rest.ativo : true,
      categoriaId: rest.categoriaId ? Number(rest.categoriaId) : null,
      fornecedorId: rest.fornecedorId ? Number(rest.fornecedorId) : null,
    }

    if (!id) {
      const created = await prisma.$transaction(async (tx) => {
        const produto = await tx.produto.create({
          data: prismaData
        })

        if (clientes && clientes.length > 0) {
          await Promise.all(clientes.map((c: any) => 
            tx.clienteProduto.create({
              data: {
                produtoId: produto.id,
                clienteId: Number(c.id),
                preco: c.preco ? Number(c.preco) : null
              }
            })
          ))
        }
        return produto
      })

      revalidatePath("/produtos")
      return created
    } else {
      const updated = await prisma.$transaction(async (tx) => {
        // Remove vínculos antigos
        await tx.clienteProduto.deleteMany({
          where: { produtoId: Number(id) }
        })
        
        // Atualiza a produto
        const produto = await tx.produto.update({
          where: { id: Number(id) },
          data: prismaData
        })

        // Cria novos vínculos
        if (clientes && clientes.length > 0) {
          await Promise.all(clientes.map((c: any) => 
            tx.clienteProduto.create({
              data: {
                produtoId: produto.id,
                clienteId: Number(c.id),
                preco: c.preco ? Number(c.preco) : null
              }
            })
          ))
        }
        return produto
      })

      revalidatePath("/produtos")
      return updated
    }
  } catch (error: any) {
    console.error("ERRO DETALHADO EM saveProduto:", error)
    throw new Error(error.message || "Erro interno ao salvar produto")
  }
}

export async function deleteProduto(id: number) {
    await prisma.produto.delete({
        where: { id }
    })
    revalidatePath("/produtos")
    return { success: true }
}
