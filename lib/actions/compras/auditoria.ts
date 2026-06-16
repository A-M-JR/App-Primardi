"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { getAuditoriaCompra, getAuditoriaPorEntidades } from "@/lib/compras/auditoria"
import { unstable_noStore as noStore } from "next/cache"

async function ctxFrom(requesterId?: number) {
  return requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }
}

export async function listarAuditoriaImportacao(importacaoId: number, requesterId?: number) {
  noStore()
  const ctx = await ctxFrom(requesterId)
  return getAuditoriaCompra(ctx.empresaId, {
    entidade: "FornecedorImportacao",
    entidadeId: importacaoId,
    limit: 50,
  })
}

export async function listarAuditoriaPedido(pedidoId: number, requesterId?: number) {
  noStore()
  const ctx = await ctxFrom(requesterId)
  return getAuditoriaCompra(ctx.empresaId, {
    entidade: "PedidoCompra",
    entidadeId: pedidoId,
    limit: 50,
  })
}

export async function listarAuditoriaCotacao(cotacaoId: number, requesterId?: number) {
  noStore()
  const ctx = await ctxFrom(requesterId)

  const cotacao = await prisma.cotacaoCompra.findFirst({
    where: { id: cotacaoId, empresaId: ctx.empresaId },
    select: {
      fornecedores: { select: { id: true } },
      escolhas: { select: { id: true } },
    },
  })
  if (!cotacao) return []

  const pares = [
    ...cotacao.fornecedores.map((f) => ({
      entidade: "CotacaoCompraFornecedor",
      entidadeId: f.id,
    })),
    ...cotacao.escolhas.map((e) => ({
      entidade: "CotacaoCompraEscolha",
      entidadeId: e.id,
    })),
  ]

  return getAuditoriaPorEntidades(ctx.empresaId, pares, 50)
}

export async function listarAuditoriaPlanejamento(planejamentoId: number, requesterId?: number) {
  noStore()
  const ctx = await ctxFrom(requesterId)

  const [pedidos, cotacao] = await Promise.all([
    prisma.pedidoCompra.findMany({
      where: { planejamentoId, empresaId: ctx.empresaId },
      select: { id: true },
    }),
    prisma.cotacaoCompra.findFirst({
      where: { planejamentoId, empresaId: ctx.empresaId },
      select: {
        fornecedores: { select: { id: true } },
        escolhas: { select: { id: true } },
      },
    }),
  ])

  const pares = pedidos.map((p) => ({ entidade: "PedidoCompra", entidadeId: p.id }))
  if (cotacao) {
    pares.push(
      ...cotacao.fornecedores.map((f) => ({
        entidade: "CotacaoCompraFornecedor",
        entidadeId: f.id,
      })),
      ...cotacao.escolhas.map((e) => ({
        entidade: "CotacaoCompraEscolha",
        entidadeId: e.id,
      }))
    )
  }

  return getAuditoriaPorEntidades(ctx.empresaId, pares, 50)
}
