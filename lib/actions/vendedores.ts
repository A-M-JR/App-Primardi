"use server"

import { prisma } from "@/lib/prisma"
import { Vendedor } from "@/lib/types"
import { revalidatePath } from "next/cache"

import { Prisma } from "@prisma/client"

export async function getVendedores(params: {
  page?: number
  limit?: number
  search?: string
  status?: 'todos' | 'ativo' | 'inativo'
  mode?: 'full' | 'dropdown'
} = {}) {
  const page = params.page || 1
  const limit = params.limit || 20
  const searchPattern = `%${params.search || ""}%`
  const status = params.status || 'todos'
  const mode = params.mode || (params.page ? 'full' : 'dropdown') // Default to dropdown if no page

  if (mode === 'dropdown') {
    const dbVds = await prisma.vendedor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, telefone: true }
    })
    return dbVds.map(v => ({
      ...v,
      criadoEm: new Date().toISOString(), // Mocking to avoid type issues in dropdown if needed
    })) as unknown as Vendedor[]
  }

  // 1. SQL Raw para contadores
  let statusFilterSql = Prisma.sql`TRUE`
  if (status === 'ativo') statusFilterSql = Prisma.sql`"ativo" = TRUE`
  else if (status === 'inativo') statusFilterSql = Prisma.sql`"ativo" = FALSE`

  const counts: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*) FILTER (WHERE ${statusFilterSql})::int as total_filtrado,
      COUNT(*) FILTER (WHERE "ativo" = TRUE)::int as ativos,
      COUNT(*) FILTER (WHERE "ativo" = FALSE)::int as pausados,
      COUNT(*)::int as total_global
    FROM "Vendedor"
    WHERE ("nome" ILIKE ${searchPattern} OR "email" ILIKE ${searchPattern})
  `
  const stats = counts[0] || { total_filtrado: 0, ativos: 0, pausados: 0, total_global: 0 }

  // 2. Busca paginada
  const where: any = {}
  if (params.search) {
    where.OR = [
      { nome: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ]
  }
  if (status === 'ativo') where.ativo = true
  else if (status === 'inativo') where.ativo = false

  const dbVendedores = await prisma.vendedor.findMany({
    where,
    orderBy: { nome: "asc" },
    skip: (page - 1) * limit,
    take: limit,
  })

  return {
    data: dbVendedores.map(v => ({
      ...v,
      criadoEm: v.criadoEm.toISOString(),
    })),
    total: stats.total_filtrado,
    page,
    totalPages: Math.ceil(stats.total_filtrado / limit),
    kpis: {
      total: stats.total_global,
      ativos: stats.ativos,
      pausados: stats.pausados
    }
  } as any
}

export async function saveVendedor(data: Partial<Vendedor>) {
  const { id, ...rest } = data
  
  const prismaData: any = {
    nome: rest.nome,
    email: rest.email?.toLowerCase(),
    telefone: rest.telefone,
    comissao: rest.comissao,
    regiao: rest.regiao,
    ativo: rest.ativo,
  }

  if (!id || id > 1000000000) {
    // New vendor
    return prisma.vendedor.create({
      data: prismaData
    })
  } else {
    // Update existing
    return prisma.vendedor.update({
      where: { id: id as any },
      data: prismaData
    })
  }
}

export async function toggleVendedorActive(id: number) {
  const vendedor = await prisma.vendedor.findUnique({ where: { id: id as any } })
  if (!vendedor) throw new Error("Vendedor não encontrado")
  
  const updated = await prisma.vendedor.update({
    where: { id: id as any },
    data: { ativo: !vendedor.ativo },
  })
  revalidatePath("/vendedores")
  return updated
}
