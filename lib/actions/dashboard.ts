"use server"

import { prisma } from "@/lib/prisma"
import { unstable_noStore as noStore } from "next/cache"
import { getPedidos } from "./pedidos"
import { getRequesterContext } from "./users"

export async function getDashboardMetrics(vendedorIdParam?: number, requesterId?: number) {
  
  const quarentaDiasAtras = new Date()
  quarentaDiasAtras.setDate(quarentaDiasAtras.getDate() - 40)

  let vendedorId = vendedorIdParam
  
  // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
  if (requesterId) {
    const ctx = await getRequesterContext(requesterId)
    if (!ctx.isAdmin) {
      vendedorId = ctx.vendedorId as number // Força o vendedorId dele
    }
  }

  const searchVendedor = vendedorId ? Number(vendedorId) : null

  // 1. Otimização SQL Raw para métricas do Dashboard
  // Buscamos receita e pedidos ativos em uma única query
  const pedidoMetrics: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM("totalGeral"), 0)::float as total_receita,
      COUNT(*) FILTER (WHERE "statusId" NOT IN (SELECT id FROM "crm_status" WHERE "modulo" = 'pedido' AND ("nome" ILIKE '%Entregue%' OR "nome" ILIKE '%Entrega%')))::int as ativos_count
    FROM "crm_pedidos"
    WHERE (${searchVendedor}::int IS NULL OR "vendedorId" = ${searchVendedor})
      AND "ativo" = TRUE
  `
  const pedStats = pedidoMetrics[0] || { total_receita: 0, ativos_count: 0 }

  // Buscamos orçamentos aguardando aprovação (statusId 4)
  const orcamentoMetrics: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int as total_orcamentos
    FROM "crm_orcamentos"
    WHERE "statusId" = 4
      AND (${searchVendedor}::int IS NULL OR "vendedorId" = ${searchVendedor})
      AND "ativo" = TRUE
  `
  const orcStats = orcamentoMetrics[0] || { total_orcamentos: 0 }

  // Buscamos clientes inativos (mais de 40 dias sem compra e que já compraram antes)
  const clienteMetrics: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int as inativos_count
    FROM "crm_clientes" c
    WHERE "ultimaCompra" < ${quarentaDiasAtras}
      AND "ultimaCompra" IS NOT NULL
      AND (${searchVendedor}::int IS NULL OR EXISTS (SELECT 1 FROM "crm_pedidos" p WHERE p."clienteId" = c.id AND p."vendedorId" = ${searchVendedor}))
  `
  const cliStats = clienteMetrics[0] || { inativos_count: 0 }

  const clientesInativosList = await prisma.cliente.findMany({
    where: {
      ultimaCompra: { lt: quarentaDiasAtras, not: null },
      pedidos: searchVendedor ? { some: { vendedorId: searchVendedor } } : undefined
    },
    take: 15,
    orderBy: { ultimaCompra: 'asc' },
    select: { id: true, razaoSocial: true, ultimaCompra: true }
  })

  // Obter Chart Data - Últimos 6 meses
  const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const chartData = []
  
  const baseDate = new Date()
  baseDate.setDate(1)
  baseDate.setHours(0,0,0,0)

  // Buscar agregação mensal via SQL para o Gráfico (muito mais rápido que carregar tudo)
  const sixMonthsAgo = new Date(baseDate)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)

  const [orcStatsMes, pedStatsMes] = await Promise.all([
    prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "criadoEm")::int as mes,
        EXTRACT(YEAR FROM "criadoEm")::int as ano,
        COUNT(*)::int as count
      FROM "crm_orcamentos"
      WHERE "criadoEm" >= ${sixMonthsAgo}
        AND (${searchVendedor}::int IS NULL OR "vendedorId" = ${searchVendedor})
        AND "ativo" = TRUE
      GROUP BY ano, mes
      ORDER BY ano, mes
    `,
    prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "criadoEm")::int as mes,
        EXTRACT(YEAR FROM "criadoEm")::int as ano,
        COUNT(*)::int as count
      FROM "crm_pedidos"
      WHERE "criadoEm" >= ${sixMonthsAgo}
        AND (${searchVendedor}::int IS NULL OR "vendedorId" = ${searchVendedor})
        AND "ativo" = TRUE
      GROUP BY ano, mes
      ORDER BY ano, mes
    `
  ])

  for (let i = 5; i >= 0; i--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1)
    const monthNum = d.getMonth() + 1 // Postgres EXTRACT MONTH is 1-indexed
    const yearNum = d.getFullYear()

    const orcsMes = orcStatsMes.find(s => s.mes === monthNum && s.ano === yearNum)?.count || 0
    const pedsMes = pedStatsMes.find(s => s.mes === monthNum && s.ano === yearNum)?.count || 0

    chartData.push({
      name: monthsNames[monthNum - 1],
      orcamentos: orcsMes,
      conversoes: pedsMes
    })
  }

  // Para mostrar a pequena lista de últimos pedidos
  const recentes = await getPedidos({ page: 1, limit: 10, vendedorId })

  return {
    kpis: {
      totalReceita: pedStats.total_receita,
      ativos: pedStats.ativos_count,
      totalOrcamentos: orcStats.total_orcamentos,
      clientesInativos: cliStats.inativos_count,
    },
    clientesInativosList: clientesInativosList.map(c => ({
      ...c,
      ultimaCompra: c.ultimaCompra ? c.ultimaCompra.toISOString() : null
    })),
    chartData,
    recentes: recentes.data
  }
}
