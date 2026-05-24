"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { getOrCreateStatus } from "./status"
import { getRequesterContext } from "./users"
import { Prisma, ModuloStatus } from "@prisma/client"

// Helper function map statusId string names to clean strings if they contain "Analise" "Produção" etc.
function mapStatusIdToStr(statusName: string) {
  const s = statusName.toLowerCase()
  if (s.includes('analise')) return 'em_analise'
  if (s.includes('produ') || s.includes('fabrica')) return 'em_producao'
  if (s.includes('separa')) return 'separacao'
  if (s.includes('entregue') || s.includes('entrega')) return 'entregue'
  return 'em_analise'
}

export async function getPedidos(params: {
  requesterId?: number;

  page?: number
  limit?: number
  search?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  vendedorId?: number
  apenasSla?: boolean
  requesterId?: number
} = {}) {
  
  const page = params.page || 1
  const limit = params.limit || 20
  
  const statusEmAnalise = await getOrCreateStatus(1, 'em_analise', ModuloStatus.PEDIDO)
  const statusEmProducao = await getOrCreateStatus(1, 'em_producao', ModuloStatus.PEDIDO)
  const statusSeparacao = await getOrCreateStatus(1, 'separacao', ModuloStatus.PEDIDO)
  const statusEntregue = await getOrCreateStatus(1, 'entregue', ModuloStatus.PEDIDO)

  const searchPattern = `%${params.search || ""}%`
  const dataInicio = params.dataInicio ? new Date(params.dataInicio) : null
  const dataFim = params.dataFim ? new Date(params.dataFim) : null
  if (dataFim) {
    dataFim.setDate(dataFim.getDate() + 1)
  }
  
  let vendedorId = params.vendedorId ? Number(params.vendedorId) : null
  
  // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
  if (params.requesterId) {
    const ctx = params.requesterId ? await getRequesterContext(params.requesterId) : null
    if (!ctx.isAdmin) {
      vendedorId = ctx.vendedorId as number // Força o vendedorId dele
    }
  }

  // 1. Otimização Global: Busca de todos os contadores em UMA ÚNICA query SQL.
  let statusFilterSql = Prisma.sql`TRUE`
  if (params.status === 'em_analise') statusFilterSql = Prisma.sql`p."statusId" = ${statusEmAnalise}`
  else if (params.status === 'em_producao') statusFilterSql = Prisma.sql`p."statusId" IN (${statusEmProducao}, ${statusSeparacao})`
  else if (params.status === 'separacao') statusFilterSql = Prisma.sql`p."statusId" = ${statusSeparacao}`
  else if (params.status === 'entregue') statusFilterSql = Prisma.sql`p."statusId" = ${statusEntregue}`

  const counts: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*) FILTER (WHERE ${statusFilterSql})::int as total_filtrado,
      COUNT(*) FILTER (WHERE p."statusId" = ${statusEmAnalise})::int as em_analise,
      COUNT(*) FILTER (WHERE p."statusId" IN (${statusEmProducao}, ${statusSeparacao}))::int as em_producao_soma,
      COUNT(*) FILTER (WHERE p."statusId" = ${statusSeparacao})::int as separacao,
      COUNT(*) FILTER (WHERE p."statusId" = ${statusEntregue})::int as entregue,
      COALESCE(SUM(p."totalGeral"), 0)::float as total_valor
    FROM "crm_pedidos" p
    LEFT JOIN "crm_clientes" c ON p."clienteId" = c.id
    WHERE (p."numero" ILIKE ${searchPattern} OR c."razaoSocial" ILIKE ${searchPattern})
      AND (${vendedorId}::int IS NULL OR p."vendedorId" = ${vendedorId})
      AND (${dataInicio}::timestamp IS NULL OR p."criadoEm" >= ${dataInicio})
      AND (${dataFim}::timestamp IS NULL OR p."criadoEm" < ${dataFim})
  `
  const stats = counts[0] || { total_filtrado: 0, em_analise: 0, em_producao_soma: 0, entregue: 0, separacao: 0, total_valor: 0 }

  // 2. Busca paginada dos registros
  const where: any = {}
  if (params.search) {
    where.OR = [
      { numero: { contains: params.search, mode: "insensitive" } },
      { cliente: { razaoSocial: { contains: params.search, mode: "insensitive" } } },
    ]
  }
  if (params.status) {
    if (params.status === 'em_analise') where.statusId = statusEmAnalise
    else if (params.status === 'em_producao') where.statusId = { in: [statusEmProducao, statusSeparacao] }
    else if (params.status === 'separacao') where.statusId = statusSeparacao
    else if (params.status === 'entregue') where.statusId = statusEntregue
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

  const dbPedidos = await prisma.pedido.findMany({
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
  
  let pedidos = dbPedidos.map(p => ({
    ...p,
    statusObj: p.status,
    status: mapStatusIdToStr(p.status?.nome || ''),
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
    prazoEntrega: p.prazoEntrega ? p.prazoEntrega.toISOString() : null,
  }))

  if (params.apenasSla) {
    pedidos = pedidos.filter((p: any) => {
      if (p.status === 'entregue' || !p.prazoEntrega) return false
      
      const prazoDate = new Date(p.prazoEntrega)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const diffDays = Math.ceil((prazoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays <= 3 // SLA: faltando 3 dias ou menos
    })
  }
  
  return {
    data: pedidos,
    total: stats.total_filtrado,
    page,
    totalPages: Math.ceil(stats.total_filtrado / limit),
    kpis: {
      total: stats.total_filtrado,
      emAnalise: stats.em_analise,
      emProducao: stats.em_producao_soma, 
      separacao: stats.separacao,
      entregue: stats.entregue,
      totalValor: stats.total_valor
    }
  }
}

export async function getPedidoById(id: number, requesterId?: number) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      status: true,
      vendedor: true,
      formaPagamento: true,
      itens: {
        include: { produto: true }
      }
    }
  })
  
  if (!pedido) return null

  // SEGURANÇA: Vendedor só vê o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin && pedido.vendedorId !== ctx.vendedorId) {
       return null // Acesso negado
    }
  }

  return {
    ...pedido,
    statusObj: pedido.status,
    status: mapStatusIdToStr(pedido.status?.nome || ''),
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
    prazoEntrega: pedido.prazoEntrega ? pedido.prazoEntrega.toISOString() : null,
  }
}

export async function updatePedidoStatus(id: number, statusIdent: string | number, requesterId: number) {
  // SEGURANÇA: Vendedor só edita o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      const ped = await prisma.pedido.findUnique({ where: { id }, select: { vendedorId: true } })
      if (!ped || ped.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
    }
  }
  let statusId = Number(statusIdent)
  
  if (isNaN(statusId)) {
    statusId = await getOrCreateStatus(1, String(statusIdent), ModuloStatus.PEDIDO)
  }

  const oldPedido = await prisma.pedido.findUnique({ 
    where: { id }, 
    include: { status: true, itens: true } 
  })
  const oldStatusStr = mapStatusIdToStr(oldPedido?.status?.nome || '')

  const newStatus = await prisma.status.findUnique({ where: { id: statusId } })
  const newStatusStr = mapStatusIdToStr(newStatus?.nome || '')

  const stockDeductedStates = ['separacao', 'entregue']
  const wasDeducted = stockDeductedStates.includes(oldStatusStr)
  const isDeducted = stockDeductedStates.includes(newStatusStr)

  // Verificação de estoque ANTES de avançar
  if (!wasDeducted && isDeducted && oldPedido) {
    const semEstoque = []
    for (const item of oldPedido.itens) {
      if (item.produtoId) {
        const prod = await prisma.produto.findUnique({ where: { id: item.produtoId } })
        if (prod && prod.estoque < item.quantidade) {
          semEstoque.push(`"${item.descricao}" (Nec: ${item.quantidade}, Disp: ${prod.estoque})`)
          // Deixa o alerta no item do pedido
          await prisma.itemPedido.update({
            where: { id: item.id },
            data: { observacao: `⚠️ ALERTA: Estoque insuficiente na separação (Disp: ${prod.estoque}, Nec: ${item.quantidade}). ${item.observacao || ''}` }
          })
        } else if (prod) {
            // Limpa o alerta se agora tem estoque (opcional, mas bom pra UX)
            if (item.observacao?.includes('⚠️ ALERTA: Estoque insuficiente')) {
                const novaObs = item.observacao.split('⚠️ ALERTA: Estoque insuficiente')[0].trim()
                await prisma.itemPedido.update({
                    where: { id: item.id },
                    data: { observacao: novaObs }
                })
            }
        }
      }
    }
    if (semEstoque.length > 0) {
      return { error: `Estoque insuficiente para avançar:\n${semEstoque.join('\n')}\n\nAlertas foram adicionados aos itens.` } as any
    }
  }

  const updated = await prisma.pedido.update({
    where: { id },
    data: { statusId },
    include: { 
      status: true,
      cliente: true,
      vendedor: true,
      formaPagamento: true,
      itens: {
        include: { produto: true }
      }
    }
  })

  // Logica de Baixa/Estorno de Estoque
  if (!wasDeducted && isDeducted) {
    // Baixar estoque
    const { addMovimentacaoEstoque } = await import('./estoque')
    for (const item of updated.itens) {
      if (item.produtoId) {
        await addMovimentacaoEstoque({
          produtoId: item.produtoId,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          descricao: `baixa de ${item.quantidade} itens para ped ${updated.numero}`,
          pedidoId: updated.id
        }).catch(e => console.error("Erro ao dar baixa no estoque:", e))
      }
    }
  } else if (wasDeducted && !isDeducted) {
    // Retornar estoque
    const { addMovimentacaoEstoque } = await import('./estoque')
    for (const item of updated.itens) {
      if (item.produtoId) {
        await addMovimentacaoEstoque({
          produtoId: item.produtoId,
          tipo: 'ENTRADA',
          quantidade: item.quantidade,
          descricao: `estorno de ${item.quantidade} itens do ped ${updated.numero}`,
          pedidoId: updated.id
        }).catch(e => console.error("Erro ao estornar estoque:", e))
      }
    }
  }

  revalidatePath("/pedidos")
  revalidatePath(`/pedidos/${id}`)
  return {
    ...updated,
    statusObj: updated.status,
    status: mapStatusIdToStr(updated.status?.nome || ''),
    criadoEm: updated.criadoEm.toISOString(),
    atualizadoEm: updated.atualizadoEm.toISOString(),
    prazoEntrega: updated.prazoEntrega ? updated.prazoEntrega.toISOString() : null,
  }
}

export async function updatePedidoDetails(id: number, data: {
  tipoFrete?: string
  valorFrete?: number
  nomeComprador?: string
  ocCliente?: string
  observacoesGerais?: string
}, requesterId: number) {
  // SEGURANÇA: Vendedor só edita o dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      const ped = await prisma.pedido.findUnique({ where: { id }, select: { vendedorId: true } })
      if (!ped || ped.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
    }
  }

  const updated = await prisma.pedido.update({
    where: { id },
    data: {
      ...(data.tipoFrete !== undefined && { tipoFrete: data.tipoFrete }),
      ...(data.valorFrete !== undefined && { valorFrete: data.valorFrete }),
      ...(data.nomeComprador !== undefined && { nomeComprador: data.nomeComprador }),
      ...(data.ocCliente !== undefined && { ocCliente: data.ocCliente }),
      ...(data.observacoesGerais !== undefined && { observacoesGerais: data.observacoesGerais }),
    },
    include: { 
      status: true,
      cliente: true,
      vendedor: true,
      formaPagamento: true,
      itens: {
        include: { produto: true }
      }
    }
  })

  revalidatePath("/pedidos")
  revalidatePath(`/pedidos/${id}`)
  return {
    ...updated,
    statusObj: updated.status,
    status: mapStatusIdToStr(updated.status?.nome || ''),
    criadoEm: updated.criadoEm.toISOString(),
    atualizadoEm: updated.atualizadoEm.toISOString(),
    prazoEntrega: updated.prazoEntrega ? updated.prazoEntrega.toISOString() : null,
  }
}

async function updateClienteUltimaCompra(clienteId: number) {
  const latestPedido = await prisma.pedido.findFirst({
    where: { clienteId, ativo: true },
    orderBy: { criadoEm: 'desc' },
    select: { criadoEm: true }
  })
  
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { ultimaCompra: latestPedido ? latestPedido.criadoEm : null }
  })
}

export async function savePedido(data: any, requesterId: number) {
  const ctx = await getRequesterContext(requesterId);

  const { id, itens, ...rest } = data

  let oldClienteId: number | null = null
  if (id) {
    const existing = await prisma.pedido.findUnique({
      where: { id: Number(id) },
      select: { clienteId: true }
    })
    if (existing) {
      oldClienteId = existing.clienteId
    }
  }

  let forcedVendedorId = rest.vendedorId

  // SEGURANÇA: Vendedor só mexe no dele
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      if (id) {
        const ped = await prisma.pedido.findUnique({ where: { id }, select: { vendedorId: true } })
        if (!ped || ped.vendedorId !== ctx.vendedorId) throw new Error("Acesso negado.")
      }
      forcedVendedorId = ctx.vendedorId // Força ser dele na criação ou edição
    }
  }
  
  if (!itens || !Array.isArray(itens)) {
    console.error("savePedido: itens is missing or not an array", data)
    throw new Error("Os itens do pedido são obrigatórios.")
  }
  
  let numero = rest.numero
  if (!id && !numero) {
    const lastPed = await prisma.pedido.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    })
    const nextId = (lastPed?.id || 0) + 1
    numero = `PED-${new Date().getFullYear()}-${nextId.toString().padStart(4, '0')}`
  }

  let statusId = rest.statusId ? Number(rest.statusId) : null
  if (!statusId) {
    const { getOrCreateStatus } = await import("./status")
    statusId = await getOrCreateStatus(1, 'em_analise', ModuloStatus.PEDIDO)
  }

  const prismaData = {
    numero: String(numero || ""),
    orcamentoId: rest.orcamentoId ? Number(rest.orcamentoId) : null,
    clienteId: Number(rest.clienteId),
    vendedorId: Number(forcedVendedorId || 0),
    statusId: Number(statusId),
    empresaId: ctx ? ctx.empresaId : 1,
    observacoesEmbalagem: rest.observacoesEmbalagem || "",
    observacoesFaturamento: rest.observacoesFaturamento || "",
    prazoEntrega: rest.prazoEntrega ? new Date(rest.prazoEntrega) : null,
    nomeVendedor: rest.nomeVendedor || "",
    nomeComprador: rest.nomeComprador || "",
    tipoFrete: rest.frete || rest.tipoFrete || "FOB",
    valorFrete: isNaN(Number(rest.valorFrete)) ? 0 : Number(rest.valorFrete),
    observacoesGerais: rest.observacoesGerais || "",
    totalGeral: isNaN(Number(rest.totalGeral)) ? 0 : Number(rest.totalGeral),
    formaPagamentoId: rest.formaPagamentoId ? Number(rest.formaPagamentoId) : null,
    ocCliente: rest.ocCliente || null,
    ativo: true,
  }

  if (!id) {
    const created = await prisma.pedido.create({
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
    // Se for gerado a partir de um orçamento, atualiza o status do orçamento para "Aprovado"
    if (created.orcamentoId) {
      const statusAprovadoId = await getOrCreateStatus(ctx.empresaId || 1, 'aprovado', ModuloStatus.ORCAMENTO)
      await prisma.orcamento.update({
        where: { id: created.orcamentoId },
        data: { statusId: statusAprovadoId }
      })
      revalidatePath("/orcamentos")
      revalidatePath(`/orcamentos/${created.orcamentoId}`)
    }

    // Sincroniza a data da última compra do cliente
    await updateClienteUltimaCompra(created.clienteId)

    revalidatePath("/pedidos")
    return created
  } else {
    // Update logic for existing order
    const updated = await prisma.pedido.update({
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

    // Sincroniza a data da última compra do cliente atual e do antigo (se alterado)
    await updateClienteUltimaCompra(updated.clienteId)
    if (oldClienteId && oldClienteId !== updated.clienteId) {
      await updateClienteUltimaCompra(oldClienteId)
    }

    revalidatePath("/pedidos")
    revalidatePath(`/pedidos/${id}`)
    return updated
  }
}
