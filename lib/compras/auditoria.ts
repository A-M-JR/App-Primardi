import { prisma } from "@/lib/prisma"
import type { AcaoAuditoriaCompra } from "@prisma/client"

export async function registrarAuditoriaCompra(params: {
  empresaId: number
  userId?: number
  acao: AcaoAuditoriaCompra
  entidade: string
  entidadeId: number
  detalhes?: Record<string, unknown>
}) {
  return prisma.compraAuditoria.create({
    data: {
      empresaId: params.empresaId,
      userId: params.userId,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      detalhes: params.detalhes ?? undefined,
    },
  })
}

export async function getAuditoriaCompra(
  empresaId: number,
  filtros?: { entidade?: string; entidadeId?: number; limit?: number }
) {
  return prisma.compraAuditoria.findMany({
    where: {
      empresaId,
      ...(filtros?.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros?.entidadeId ? { entidadeId: filtros.entidadeId } : {}),
    },
    include: { user: { select: { id: true, nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: filtros?.limit ?? 100,
  })
}
