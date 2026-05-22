"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { getRequesterContext } from "./users"
import { Orcamento } from "@/lib/types"
import { Prisma, ModuloStatus } from "@prisma/client"

export async function getOrcamentos(params: {
  page?: number
  limit?: number
  search?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  vendedorId?: number
  mode?: 'full' | 'history'
  requesterId?: number
} = {}) {
  
  const page = params.page || 1
  const limit = params.limit || 20
  const mode = params.mode || 'full'

  const searchPattern = `%${params.search || ""}%`
  const dataInicio = params.dataInicio ? new Date(params.dataInicio) : null
  const dataFim = params.dataFim ? new Date(params.dataFim) : null
  if (dataFim) dataFim.setDate(dataFim.getDate() + 1)
  
  let vendedorId = params.vendedorId ? Number(params.vendedorId) : null
  
  // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
  if (params.requesterId) {
    const ctx = await getRequesterContext(params.requesterId)
    if (!ctx.isAdmin) {
      vendedorId = ctx.vendedorId as number // Força o vendedorId dele
    }
  }

  // 1. Otimização SQL Raw para contadores e KPIs
  let statusFilterSql = Prisma.sql`p."ativo" = TRUE`
  if (params.status === 'rascunho') statusFilterSql = Prisma.sql`p."statusId" = 1`
  else if (params.status === 'enviado') statusFilterSql = Prisma.sql`p."statusId" = 4`
  else if (params.status === 'aprovado') statusFilterSql = Prisma.sql`p."statusId" = 2`
  else if (params.status === 'recusado') statusFilterSql = Prisma.sql`p."statusId" = 5`

  const counts: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*) FILTER (WHERE ${statusFilterSql})::int as total_filtrado,
      COUNT(*) FILTER (WHERE p."statusId" = 4)::int as vigentes,
      COUNT(*) FILTER (WHERE p."statusId" = 2)::int as aprovados,
      COUNT(*) FILTER (WHERE p."statusId" IN (1, 5))::int as parados,
      COALESCE(SUM(p."totalGeral") FILTER (WHERE p."statusId" <> 5), 0)::float as total_valor
    FROM "Orcamento" p
    LEFT JOIN "Cliente" c ON p."clienteId" = c.id
    WHERE (
      p."numero" ILIKE ${searchPattern} 
      OR c."razaoSocial" ILIKE ${searchPattern}
      OR EXISTS (
        SELECT 1 FROM "ItemOrcamento" io
        LEFT JOIN "Produto" e ON io."produtoId" = e.id
        WHERE io."orcamentoId" = p.id 
          AND (io."descricao" ILIKE ${searchPattern} OR e."nome" ILIKE ${searchPattern} OR e."codigo" ILIKE ${searchPattern})
      )
    )
      AND (${vendedorId}::int IS NULL OR p."vendedorId" = ${vendedorId})
      AND (${dataInicio}::timestamp IS NULL OR p."criadoEm" >= ${dataInicio})
      AND (${dataFim}::timestamp IS NULL OR p."criadoEm" < ${dataFim})
      AND p."ativo" = TRUE
  `
  const stats = counts[0] || { total_filtrado: 0, vigentes: 0, aprovados: 0, parados: 0, total_valor: 0 }

  const where: any = { ativo: true }
  if (params.search) {
    where.OR = [
      { numero: { contains: params.search, mode: "insensitive" } },
      { cliente: { razaoSocial: { contains: params.search, mode: "insensitive" } } },
      { itens: { some: { descricao: { contains: params.search, mode: "insensitive" } } } },
      { itens: { some: { produto: { nome: { contains: params.search, mode: "insensitive" } } } } },
      { itens: { some: { produto: { codigo: { contains: params.search, mode: "insensitive" } } } } },
    ]
  }

  if (params.status) {
    if (params.status === 'rascunho') where.statusId = 1
    else if (params.status === 'enviado') where.statusId = 4
    else if (params.status === 'aprovado') where.statusId = 2
    else if (params.status === 'recusado') where.statusId = 5
  }

  if (params.vendedorId) where.vendedorId = params.vendedorId

  if (params.dataInicio || params.dataFim) {
    where.criadoEm = {}
    if (params.dataInicio) where.criadoEm.gte = new Date(params.dataInicio)
    if (params.dataFim) {
      const ends = new Date(params.dataFim)
      ends.setDate(ends.getDate() + 1)
      where.criadoEm.lt = ends
    }
  }

  if (mode === 'history') {
    const dbOrcs = await prisma.orcamento.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit,
      select: { id: true, clienteId: true, itens: true }
    })
    return { data: dbOrcs, total: stats.total_filtrado, page: 1, totalPages: 1, kpis: null }
  }

  const dbOrcs = await prisma.orcamento.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      cliente: true,
      vendedor: true,
      status: true,
      _count: { select: { itens: true } }
    }
  })
  
  return {
    data: dbOrcs.map((o: any) => ({
      ...o,
      status: o.status?.nome?.toLowerCase() === 'pendente' ? 'rascunho' : (o.status?.nome?.toLowerCase() || 'rascunho'),
      criadoEm: o.criadoEm.toISOString(),
      atualizadoEm: o.atualizadoEm.toISOString(),
    })),
    total: stats.total_filtrado,
    page,
    totalPages: Math.ceil(stats.total_filtrado / limit),
    kpis: {
      total: stats.total_filtrado,
      totalValor: stats.total_valor,
      vigentes: stats.vigentes,
      aprovados: stats.aprovados,
      parados: stats.parados,
    }
  }
}

export async function getOrcamentoById(id: number, requesterId?: number) {
  const orcamento = await prisma.orcamento.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: true,
      status: true,
      formaPagamento: true,
      pedidos: true,
      itens: {
        include: { produto: true }
      }
    }
  })
  
  if (!orcamento) return null

  // SEGURANÇA: Vendedor só vê o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin && orcamento.vendedorId !== ctx.vendedorId) {
       return null // Acesso negado
    }
  }

  return {
    ...orcamento,
    status: orcamento.status?.nome?.toLowerCase() === 'pendente' ? 'rascunho' : (orcamento.status?.nome?.toLowerCase() || 'rascunho'),
    criadoEm: orcamento.criadoEm.toISOString(),
    atualizadoEm: orcamento.atualizadoEm.toISOString(),
    prazoEntrega: orcamento.prazoEntrega ? orcamento.prazoEntrega.toISOString() : null,
  }
}

export async function updateOrcamentoStatus(id: number, statusIdent: string | number, requesterId: number) {
  // SEGURANÇA: Vendedor só edita o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      const orc = await prisma.orcamento.findUnique({ where: { id }, select: { vendedorId: true } })
      if (!orc || orc.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
    }
  }

  let statusId = Number(statusIdent)
  
  if (isNaN(statusId)) {
    // Mapeamento de nomes amigáveis para IDs do Banco (baseado no seed.sql)
    const s = String(statusIdent).toLowerCase()
    if (s === 'rascunho' || s === 'pendente') statusId = 1
    else if (s === 'aprovado') statusId = 2
    else if (s === 'enviado') statusId = 4
    else if (s === 'recusado') statusId = 5
    else {
      // Busca dinâmica se não for um dos padrões
      const found = await prisma.status.findFirst({
        where: { 
          modulo: ModuloStatus.ORCAMENTO,
          nome: { contains: s, mode: 'insensitive' }
        }
      })
      if (found) statusId = found.id
      else statusId = 1 // Fallback para pendente
    }
  }

  const updated = await prisma.orcamento.update({
    where: { id },
    data: { statusId },
    include: {
      cliente: true,
      vendedor: true,
      status: true,
      itens: {
        include: { produto: true }
      }
    }
  })
  revalidatePath("/orcamentos")
  revalidatePath(`/orcamentos/${id}`)
  
  return {
    ...updated,
    status: updated.status?.nome?.toLowerCase() === 'pendente' ? 'rascunho' : (updated.status?.nome?.toLowerCase() || 'rascunho'),
    criadoEm: updated.criadoEm.toISOString(),
    atualizadoEm: updated.atualizadoEm.toISOString(),
  }
}

export async function deleteOrcamento(id: number, requesterId?: number) {
  // SEGURANÇA: Vendedor só exclui o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      const orc = await prisma.orcamento.findUnique({ where: { id }, select: { vendedorId: true } })
      if (!orc || orc.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
    }
  }

  await prisma.orcamento.update({
    where: { id },
    data: { ativo: false }
  })
  revalidatePath("/orcamentos")
}

export async function saveOrcamento(data: any, requesterId: number) {
  const ctx = await getRequesterContext(requesterId);

  const { id, itens, ...rest } = data
  
  let forcedVendedorId = rest.vendedorId

  // SEGURANÇA: Vendedor só mexe no dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      if (id) {
        const orc = await prisma.orcamento.findUnique({ where: { id }, select: { vendedorId: true } })
        if (!orc || orc.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
      }
      forcedVendedorId = ctx.vendedorId // Força ser dele na criação ou edição
    }
  }

  if (!itens || !Array.isArray(itens)) {
    console.error("saveOrcamento: itens is missing or not an array", data)
    throw new Error("Os itens do orçamento são obrigatórios.")
  }
  
  let numero = rest.numero
  if (!id && !numero) {
    const lastOrc = await prisma.orcamento.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    })
    const nextId = (lastOrc?.id || 0) + 1
    numero = `ORC-${new Date().getFullYear()}-${nextId.toString().padStart(4, '0')}`
  }

  let finalStatusId = (rest.statusId && !isNaN(Number(rest.statusId))) ? Number(rest.statusId) : null
  
  if (!finalStatusId && rest.statusStr) {
    const s = String(rest.statusStr).toLowerCase()
    if (s === 'rascunho' || s === 'pendente') finalStatusId = 1
    else if (s === 'aprovado') finalStatusId = 2
    else if (s === 'enviado') finalStatusId = 4
    else if (s === 'recusado') finalStatusId = 5
  }

  const totalGeral = isNaN(Number(rest.totalGeral)) ? 0 : Number(rest.totalGeral)

  // Regra de Bonificação Automática: Se o total for zero, força o status Bonificação
  if (totalGeral === 0) {
    const bonif = await prisma.status.findFirst({
      where: { modulo: ModuloStatus.ORCAMENTO, nome: { contains: 'Bonificação', mode: 'insensitive' } }
    })
    if (bonif) {
      finalStatusId = bonif.id
    } else {
      const count = await prisma.status.count({ where: { modulo: ModuloStatus.ORCAMENTO } })
      const created = await prisma.status.create({
        data: {
          empresaId: 1,
          nome: 'Bonificação',
          modulo: ModuloStatus.ORCAMENTO,
          ordem: count + 1,
          cor: '#ed64a6' // Pink/Destaque
        }
      })
      finalStatusId = created.id
    }
  }

  const prismaData = {
    empresaId: ctx.empresaId,
    tipoFrete: rest.tipoFrete || "",
    valorFrete: Number(rest.valorFrete) || 0,

    numero: String(numero || ""),
    clienteId: Number(rest.clienteId),
    vendedorId: Number(forcedVendedorId || 0), // Garante que seja um número (campo obrigatório no banco)
    statusId: finalStatusId || 1, // Default para 1 (Pendente)
    formaPagamentoId: rest.formaPagamentoId ? Number(rest.formaPagamentoId) : null,
    observacoes: rest.observacoes || "",
    prazoEntrega: rest.prazoEntrega ? new Date(rest.prazoEntrega) : null,
    totalGeral: totalGeral,
    descontoCredito: isNaN(Number(rest.descontoCredito)) ? 0 : Number(rest.descontoCredito),
    ocCliente: rest.ocCliente || null,
    ativo: true,
  }

  if (!id) {
    const created = await prisma.$transaction(async (tx) => {
      // Criação via ORM (pode falhar se o cache estiver muito ruim, mas vamos tentar primeiro com campos escalares)
      // Se falhar o descontoCredito, o erro será capturado.
      const orc = await (tx.orcamento as any).create({
        data: {
          ...prismaData,
          itens: {
            create: itens.map((it: any) => {
              const qty = Number(typeof it.quantidade === 'string' ? it.quantidade.replace(',', '.') : it.quantidade) || 0
              const price = Number(typeof it.precoUnitario === 'string' ? it.precoUnitario.replace(',', '.') : it.precoUnitario) || 0
              return {
                produtoId: it.produtoId ? Number(it.produtoId) : null,
                descricao: it.descricao,
                quantidade: qty,
                quantidadeCredito: Number(it.quantidadeCredito) || 0,
                unidade: it.unidade,
                precoUnitario: price,
                total: Number(it.total) || ((qty - (Number(it.quantidadeCredito) || 0)) * price),
                observacao: it.observacao || ""
              }
            })
          }
        },
        include: {
          cliente: true,
          vendedor: true,
          status: true,
          formaPagamento: true,
          itens: {
            include: { produto: true }
          }
        }
      })

      // Lógica de Débito de Créditos (Valor)
      if (prismaData.descontoCredito > 0) {
        await tx.$executeRaw`
          INSERT INTO "MovimentacaoCredito" ("clienteId", tipo, operacao, quantidade, descricao, "orcamentoId", "criadoEm")
          VALUES (${prismaData.clienteId}, 'VALOR', 'DEBITO', ${prismaData.descontoCredito}, ${`Desconto no Orçamento ${orc.numero}`}, ${orc.id}, ${new Date()})
        `
        await tx.$executeRaw`
          UPDATE "Cliente" SET "saldoCreditoValor" = "saldoCreditoValor" - ${prismaData.descontoCredito} WHERE id = ${prismaData.clienteId}
        `
      }

      // Lógica de Débito de Créditos (Produtos)
      const produtosCredito = itens.reduce((sum: number, it: any) => sum + (Number(it.quantidadeCredito) || 0), 0)
      if (produtosCredito > 0) {
        await tx.$executeRaw`
          INSERT INTO "MovimentacaoCredito" ("clienteId", tipo, operacao, quantidade, descricao, "orcamentoId", "criadoEm")
          VALUES (${prismaData.clienteId}, 'ETIQUETA', 'DEBITO', ${produtosCredito}, ${`Uso de saldo de produtos no Orçamento ${orc.numero}`}, ${orc.id}, ${new Date()})
        `
        await tx.$executeRaw`
          UPDATE "Cliente" SET "saldoCreditoProdutos" = "saldoCreditoProdutos" - ${produtosCredito} WHERE id = ${prismaData.clienteId}
        `
      }

      return orc
    })
    revalidatePath("/orcamentos")
    return {
      ...created,
      status: created.status?.nome?.toLowerCase() === 'pendente' ? 'rascunho' : (created.status?.nome?.toLowerCase() || 'rascunho'),
      criadoEm: created.criadoEm.toISOString(),
      atualizadoEm: created.atualizadoEm.toISOString(),
    }
  } else {
    const updated = await prisma.orcamento.update({
      where: { id: Number(id) },
      data: {
        ...prismaData,
        itens: {
          deleteMany: { id: { notIn: itens.filter((i: any) => i.id).map((i: any) => Number(i.id)) } },
          upsert: itens.map((it: any) => {
            const qty = Number(typeof it.quantidade === 'string' ? it.quantidade.replace(',', '.') : it.quantidade) || 0
            const price = Number(typeof it.precoUnitario === 'string' ? it.precoUnitario.replace(',', '.') : it.precoUnitario) || 0
            const itemData = {
              produtoId: it.produtoId ? Number(it.produtoId) : null,
              descricao: it.descricao,
              quantidade: qty,
              quantidadeCredito: Number(it.quantidadeCredito) || 0,
              unidade: it.unidade,
              precoUnitario: price,
              total: Number(it.total) || ((qty - (Number(it.quantidadeCredito) || 0)) * price),
              observacao: it.observacao || ""
            }
            return {
              where: { id: it.id ? Number(it.id) : 0 },
              create: itemData,
              update: itemData
            }
          })
        }
      },
      include: {
        cliente: true,
        vendedor: true,
        status: true,
        formaPagamento: true,
        itens: {
          include: { produto: true }
        }
      }
    })
    revalidatePath("/orcamentos")
    revalidatePath(`/orcamentos/${id}`)
    
    return {
      ...updated,
      status: (updated as any).status?.nome?.toLowerCase() === 'pendente' ? 'rascunho' : ((updated as any).status?.nome?.toLowerCase() || 'rascunho'),
      criadoEm: updated.criadoEm.toISOString(),
      atualizadoEm: updated.atualizadoEm.toISOString(),
    }
  }
}
