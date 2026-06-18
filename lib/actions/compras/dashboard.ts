"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"

const EFETIVADOS = ["ENVIADO", "CONFIRMADO", "RECEBIDO_PARCIAL", "RECEBIDO"] as const
const DIAS_RUPTURA = 7

export interface ComprasDashboard {
  gastoPeriodo: number
  pedidosPeriodo: number
  statusCounts: { status: string; count: number }[]
  pedidosAbertos: number
  aguardandoConfirmacao: number
  aguardandoAprovacao: number
  topFornecedores: { nome: string; total: number }[]
  cotacoesPendentes: number
  cotacoesVencendo: number
  gastoPorMes: { mes: string; total: number }[]
  ruptura: { id: number; codigo: string; nome: string; dias: number | null }[]
  rupturaCount: number
}

export async function getComprasDashboard(dias = 30): Promise<ComprasDashboard> {
  noStore()
  const ctx = await getRequesterContext()
  const empresaId = ctx.empresaId

  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  const seisMeses = new Date()
  seisMeses.setMonth(seisMeses.getMonth() - 5)
  seisMeses.setDate(1)
  seisMeses.setHours(0, 0, 0, 0)
  const limiteCotacao = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

  const [gasto, statusGroups, topFornRaw, cotacoesPend, cotacoesVencendo, gastoMes, ruptura, rupturaCnt] =
    await Promise.all([
      prisma.pedidoCompra.aggregate({
        _sum: { totalGeral: true },
        _count: true,
        where: { empresaId, status: { in: EFETIVADOS as unknown as never[] }, criadoEm: { gte: desde } },
      }),
      prisma.pedidoCompra.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { empresaId },
      }),
      prisma.pedidoCompra.groupBy({
        by: ["fornecedorId"],
        _sum: { totalGeral: true },
        where: { empresaId, status: { in: EFETIVADOS as unknown as never[] }, criadoEm: { gte: desde } },
        orderBy: { _sum: { totalGeral: "desc" } },
        take: 5,
      }),
      prisma.cotacaoCompra.count({
        where: { empresaId, status: { in: ["ABERTA", "EM_RESPOSTA"] as unknown as never[] } },
      }),
      prisma.cotacaoCompra.count({
        where: {
          empresaId,
          status: { in: ["ABERTA", "EM_RESPOSTA"] as unknown as never[] },
          prazoResposta: { lte: limiteCotacao },
        },
      }),
      prisma.$queryRaw<{ mes: string; total: number }[]>`
        SELECT to_char(date_trunc('month', "criadoEm"), 'YYYY-MM') AS mes, COALESCE(SUM("totalGeral"), 0) AS total
        FROM "crm_pedidos_compra"
        WHERE "empresaId" = ${empresaId}
          AND "status" IN ('ENVIADO', 'CONFIRMADO', 'RECEBIDO_PARCIAL', 'RECEBIDO')
          AND "criadoEm" >= ${seisMeses}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<{ id: number; codigo: string; nome: string; dias: number | null }[]>`
        SELECT id, codigo, nome, (estoque / NULLIF("mediaConsumo", 0)) AS dias
        FROM "crm_produtos"
        WHERE "empresaId" = ${empresaId} AND "ativo" = true
          AND "mediaConsumo" > 0 AND estoque < "mediaConsumo" * ${DIAS_RUPTURA}
        ORDER BY dias ASC NULLS LAST LIMIT 8
      `,
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM "crm_produtos"
        WHERE "empresaId" = ${empresaId} AND "ativo" = true
          AND "mediaConsumo" > 0 AND estoque < "mediaConsumo" * ${DIAS_RUPTURA}
      `,
    ])

  const fornIds = topFornRaw.map((f) => f.fornecedorId)
  const forns = fornIds.length
    ? await prisma.fornecedor.findMany({ where: { id: { in: fornIds } }, select: { id: true, razaoSocial: true } })
    : []
  const fornMap = new Map(forns.map((f) => [f.id, f.razaoSocial]))

  const countBy = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0
  const totalPedidos = statusGroups.reduce((acc, g) => acc + g._count._all, 0)
  const pedidosAbertos = totalPedidos - countBy("RECEBIDO") - countBy("CANCELADO")

  return {
    gastoPeriodo: gasto._sum.totalGeral ?? 0,
    pedidosPeriodo: gasto._count,
    statusCounts: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    pedidosAbertos,
    aguardandoConfirmacao: countBy("ENVIADO"),
    aguardandoAprovacao: countBy("AGUARDANDO_APROVACAO"),
    topFornecedores: topFornRaw.map((f) => ({
      nome: fornMap.get(f.fornecedorId) ?? "—",
      total: f._sum.totalGeral ?? 0,
    })),
    cotacoesPendentes: cotacoesPend,
    cotacoesVencendo,
    gastoPorMes: gastoMes.map((r) => ({ mes: r.mes, total: Number(r.total) })),
    ruptura: ruptura.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nome: r.nome,
      dias: r.dias != null ? Math.floor(Number(r.dias)) : null,
    })),
    rupturaCount: Number(rupturaCnt[0]?.c ?? 0),
  }
}
