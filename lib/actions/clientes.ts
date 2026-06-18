"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { Prisma } from "@prisma/client"
import { getRequesterContext } from "./users"

export async function getClientes(params: {
  page?: number
  limit?: number
  search?: string
  filter?: 'todos' | '30d' | '60d'
  mode?: 'full' | 'dropdown'
} = {}) {
  const { empresaId } = await getRequesterContext()

  const page = params.page || 1
  const limit = params.limit || 20
  const search = params.search || ""
  const mode = params.mode || 'full'
  const filter = params.filter || 'todos'

  const searchPattern = `%${search}%`
  const hoje = new Date()
  const trintaDiasAtras = new Date(hoje.getTime() - (30 * 24 * 60 * 60 * 1000))
  const sessentaDiasAtras = new Date(hoje.getTime() - (60 * 24 * 60 * 60 * 1000))

  // 1. Otimização Sugerida pelo Usuário: Busca de contadores em uma única query SQL Raw
  // Utilizamos a cláusula FILTER (WHERE ...) do Postgres que é extremamente performática.
  const filterSql = filter === '30d' 
    ? Prisma.sql`("ultimaCompra" < ${trintaDiasAtras} AND "ultimaCompra" >= ${sessentaDiasAtras}) OR ("ultimaCompra" IS NULL AND "criadoEm" < ${trintaDiasAtras} AND "criadoEm" >= ${sessentaDiasAtras})`
    : filter === '60d' 
      ? Prisma.sql`"ultimaCompra" < ${sessentaDiasAtras} OR ("ultimaCompra" IS NULL AND "criadoEm" < ${sessentaDiasAtras})`
      : Prisma.sql`TRUE`

  const counts: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as total_global,
      COUNT(*) FILTER (WHERE ("ultimaCompra" < ${trintaDiasAtras} AND "ultimaCompra" >= ${sessentaDiasAtras}) OR ("ultimaCompra" IS NULL AND "criadoEm" < ${trintaDiasAtras} AND "criadoEm" >= ${sessentaDiasAtras}))::int as sem_compra_30,
      COUNT(*) FILTER (WHERE "ultimaCompra" < ${sessentaDiasAtras} OR ("ultimaCompra" IS NULL AND "criadoEm" < ${sessentaDiasAtras}))::int as sem_compra_60,
      COUNT(*) FILTER (WHERE ${filterSql})::int as total_filtrado
    FROM "crm_clientes"
    WHERE "empresaId" = ${empresaId} AND ("razaoSocial" ILIKE ${searchPattern} OR "cnpj" ILIKE ${searchPattern} OR "cidade" ILIKE ${searchPattern})
  `
  
  const stats = counts[0] || { total_global: 0, sem_compra_30: 0, sem_compra_60: 0, total_filtrado: 0 }

  // 2. Busca dos dados via Prisma para garantir integridade das relações
  const where: Prisma.ClienteWhereInput = {
    empresaId,
    OR: [
      { razaoSocial: { contains: search, mode: 'insensitive' } },
      { cnpj: { contains: search, mode: 'insensitive' } },
      { cidade: { contains: search, mode: 'insensitive' } },
    ],
  }

  // Aplica filtro de tempo se necessário
  if (filter === '30d') {
    where.OR = [
      { ultimaCompra: { lt: trintaDiasAtras, gte: sessentaDiasAtras } },
      { AND: [{ ultimaCompra: null }, { criadoEm: { lt: trintaDiasAtras, gte: sessentaDiasAtras } }] }
    ]
  } else if (filter === '60d') {
    where.OR = [
      { ultimaCompra: { lt: sessentaDiasAtras } },
      { AND: [{ ultimaCompra: null }, { criadoEm: { lt: sessentaDiasAtras } }] }
    ]
  }

  const dbClientes = await prisma.cliente.findMany({
    where,
    include: {
      produtosExclusivos: {
        include: {
          produto: true
        }
      },
      _count: {
        select: { orcamentos: true, pedidos: true }
      }
    },
    orderBy: { razaoSocial: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  })
  
  return {
    data: dbClientes.map((c: any) => ({
      ...c,
      produtosVinculados: c.produtosExclusivos.map((pe: any) => pe.produto),
      criadoEm: c.criadoEm.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      ultimaCompra: c.ultimaCompra ? c.ultimaCompra.toISOString() : null,
    })),
    total: stats.total_filtrado,
    page,
    totalPages: Math.ceil(stats.total_filtrado / limit),
    kpis: {
      total: stats.total_global,
      semCompra30: stats.sem_compra_30,
      semCompra60: stats.sem_compra_60
    }
  }
}

export async function getClienteById(id: number) {
  const { empresaId } = await getRequesterContext()
  // Busca via Raw SQL para garantir que pegamos os campos novos (nomeFantasia, etc)
  const results = await prisma.$queryRaw`
    SELECT * FROM "crm_clientes" WHERE id = ${id} AND "empresaId" = ${empresaId}
  ` as any[]

  if (results.length === 0) return null
  const cliente = results[0]

  // Busca orçamentos e pedidos separadamente (fallback total para Raw SQL/Selective ORM)
  const orcamentos = await prisma.orcamento.findMany({
    where: { clienteId: id },
    include: { status: true },
    orderBy: { id: 'desc' }
  })

  const pedidos = await prisma.pedido.findMany({
    where: { clienteId: id },
    include: { status: true },
    orderBy: { id: 'desc' }
  })

  // Falback para itens exclusivos via raw query devido a cache do Prisma
  const itensExclusivos = await prisma.$queryRaw`
    SELECT * FROM "crm_itens_exclusivos_clientes" WHERE "clienteId" = ${id}
  ` as any[]

  const leads = await prisma.$queryRaw`
    SELECT id, "valorEstimado", observacoes, "dataConversao" FROM "crm_leads" WHERE "clienteId" = ${id} LIMIT 1
  ` as any[]

  return {
    ...cliente,
    itensExclusivos,
    orcamentos,
    pedidos,
    leadOrigem: leads.length > 0 ? leads[0] : null,
    criadoEm: cliente.criadoEm.toISOString(),
    updatedAt: cliente.updatedAt.toISOString(),
    ultimaCompra: cliente.ultimaCompra ? cliente.ultimaCompra.toISOString() : null,
  }
}

export async function saveCliente(data: any) {
  const { empresaId } = await getRequesterContext()
  const { id, ...rest } = data

  const prismaData: any = {
    razaoSocial: rest.razaoSocial,
    nomeFantasia: rest.nomeFantasia || null,
    cnpj: rest.cnpj,
    ie: rest.ie || null,
    email: rest.email || null,
    telefone: rest.telefone || "",
    compradorNome: rest.compradorNome || null,
    compradorTelefone: rest.compradorTelefone || null,
    logradouro: rest.logradouro || null,
    numeroEnd: rest.numeroEnd || null,
    complemento: rest.complemento || null,
    bairro: rest.bairro || null,
    cep: rest.cep || "",
    cidade: rest.cidade || "",
    estado: rest.estado || "",
    observacoes: rest.observacoes || null,
    ativo: rest.ativo !== undefined ? rest.ativo : true,
  }

  const itensExclusivos = rest.itensExclusivos || []

  if (!id) {
    if (prismaData.cnpj) {
      const existing = await prisma.cliente.findFirst({
        where: { cnpj: prismaData.cnpj, empresaId }
      })
      if (existing) {
        return { 
          success: false, 
          code: "DUPLICATE_CNPJ", 
          message: "Já existe um cliente cadastrado com este CNPJ na base.",
          existingClienteId: existing.id 
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // Inserção manual do Cliente via raw SQL
      const now = new Date()
      await tx.$executeRaw`
        INSERT INTO "crm_clientes" (
          "razaoSocial", "nomeFantasia", cnpj, ie, email, telefone, 
          "compradorNome", "compradorTelefone", logradouro, "numeroEnd", complemento, bairro, cep, cidade, estado, "empresaId", 
          observacoes, ativo, "saldoCreditoValor", "saldoCreditoEtiquetas", "tabelaPrecoId", "criadoEm", "updatedAt"
        )
        VALUES (
          ${prismaData.razaoSocial}, ${prismaData.nomeFantasia}, ${prismaData.cnpj}, ${prismaData.ie}, 
          ${prismaData.email}, ${prismaData.telefone}, ${prismaData.compradorNome}, ${prismaData.compradorTelefone}, 
          ${prismaData.logradouro}, ${prismaData.numeroEnd}, ${prismaData.complemento}, ${prismaData.bairro}, ${prismaData.cep}, ${prismaData.cidade}, ${prismaData.estado}, ${empresaId},
          ${prismaData.observacoes}, ${prismaData.ativo}, 
          ${rest.saldoCreditoValor || 0}, ${rest.saldoCreditoEtiquetas || 0}, ${rest.tabelaPrecoId ? Number(rest.tabelaPrecoId) : null}, ${now}, ${now}
        )
      `
      
      // Busca o ID gerado (Postgres)
      const lastInsert = await tx.$queryRaw`SELECT id FROM "crm_clientes" ORDER BY id DESC LIMIT 1` as any[]
      const newId = lastInsert[0].id

      for (const it of itensExclusivos) {
        await tx.$executeRaw`
          INSERT INTO "crm_itens_exclusivos_clientes" ("clienteId", nome, descricao, preco)
          VALUES (${newId}, ${it.nome}, ${it.descricao || null}, ${Number(it.preco) || 0})
        `
      }
      return { id: newId }
    })
    revalidatePath("/clientes")
    return created
  } else {
    // Confirma posse antes de editar (cliente carrega crédito/financeiro).
    const dono = await prisma.cliente.findFirst({ where: { id: Number(id), empresaId }, select: { id: true } })
    if (!dono) throw new Error("Cliente não encontrado nesta empresa.")
    const updated = await prisma.$transaction(async (tx) => {
      // Sincronização inteligente de itens exclusivos
      const itemIdsToKeep = itensExclusivos.map((it: any) => it.id).filter(Boolean).map(Number)
      if (itemIdsToKeep.length > 0) {
        await tx.$executeRaw`DELETE FROM "crm_itens_exclusivos_clientes" WHERE "clienteId" = ${Number(id)} AND id NOT IN (${Prisma.join(itemIdsToKeep)})`
      } else {
        await tx.$executeRaw`DELETE FROM "crm_itens_exclusivos_clientes" WHERE "clienteId" = ${Number(id)}`
      }
      
      const now = new Date()
      await tx.$executeRaw`
        UPDATE "crm_clientes"
        SET 
          "razaoSocial" = ${prismaData.razaoSocial},
          "nomeFantasia" = ${prismaData.nomeFantasia},
          "cnpj" = ${prismaData.cnpj},
          "ie" = ${prismaData.ie},
          "email" = ${prismaData.email},
          "telefone" = ${prismaData.telefone},
          "compradorNome" = ${prismaData.compradorNome},
          "compradorTelefone" = ${prismaData.compradorTelefone},
          "logradouro" = ${prismaData.logradouro},
          "numeroEnd" = ${prismaData.numeroEnd},
          "complemento" = ${prismaData.complemento},
          "bairro" = ${prismaData.bairro},
          "cep" = ${prismaData.cep},
          "cidade" = ${prismaData.cidade},
          "estado" = ${prismaData.estado},
          "observacoes" = ${prismaData.observacoes},
          "ativo" = ${prismaData.ativo},
          "saldoCreditoValor" = ${rest.saldoCreditoValor !== undefined ? rest.saldoCreditoValor : 0},
          "saldoCreditoEtiquetas" = ${rest.saldoCreditoEtiquetas !== undefined ? rest.saldoCreditoEtiquetas : 0},
          "tabelaPrecoId" = ${rest.tabelaPrecoId ? Number(rest.tabelaPrecoId) : null},
          "updatedAt" = ${now}
        WHERE id = ${Number(id)} AND "empresaId" = ${empresaId}
      `

      for (const it of itensExclusivos) {
        if (it.id) {
          await tx.$executeRaw`
            UPDATE "crm_itens_exclusivos_clientes" 
            SET nome = ${it.nome}, descricao = ${it.descricao || null}, preco = ${Number(it.preco) || 0}
            WHERE id = ${Number(it.id)}
          `
        } else {
          await tx.$executeRaw`
            INSERT INTO "crm_itens_exclusivos_clientes" ("clienteId", nome, descricao, preco)
            VALUES (${Number(id)}, ${it.nome}, ${it.descricao || null}, ${Number(it.preco) || 0})
          `
        }
      }
      return { id: Number(id) }
    })
    
    revalidatePath("/clientes")
    revalidatePath(`/clientes/${id}`)
    return updated
  }
}
