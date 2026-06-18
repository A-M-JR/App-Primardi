"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "@/lib/actions/users"
import { unstable_noStore as noStore } from "next/cache"
import type { FonteConsumoCompra } from "./types"
import { canApproveCompras } from "@/lib/compras/guards"

export async function getCompraConfig(requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  let config = await prisma.compraConfigEmpresa.findUnique({
    where: { empresaId: ctx.empresaId },
  })
  if (!config) {
    config = await prisma.compraConfigEmpresa.create({
      data: { empresaId: ctx.empresaId },
    })
  }
  return config
}

export async function saveCompraConfig(
  data: {
    multiplicadorConsumo?: number
    diasJanelaConsumo?: number
    fonteConsumo?: FonteConsumoCompra
  },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  if (!canApproveCompras(ctx.role)) throw new Error("Sem permissão.")

  return prisma.compraConfigEmpresa.upsert({
    where: { empresaId: ctx.empresaId },
    create: {
      empresaId: ctx.empresaId,
      ...data,
    },
    update: data,
  })
}

export async function calcularMediaConsumo(
  produtoId: number,
  config: { diasJanelaConsumo: number; fonteConsumo: FonteConsumoCompra },
  empresaId: number
): Promise<number> {
  const desde = new Date()
  desde.setDate(desde.getDate() - config.diasJanelaConsumo)

  if (config.fonteConsumo === "MOVIMENTACAO_ESTOQUE") {
    const movs = await prisma.movimentacaoEstoque.findMany({
      where: {
        empresaId,
        produtoId,
        tipo: "SAIDA",
        criadoEm: { gte: desde },
      },
    })
    const total = movs.reduce((s, m) => s + m.quantidade, 0)
    return total / config.diasJanelaConsumo
  }

  const itens = await prisma.itemPedido.findMany({
    where: {
      produtoId,
      pedido: { empresaId, criadoEm: { gte: desde }, ativo: true },
    },
  })
  const total = itens.reduce((s, i) => s + i.quantidade, 0)
  return total / config.diasJanelaConsumo
}
