"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import type { FonteConsumoCompra } from "@prisma/client"
import { canApproveCompras, canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"

export async function getCompraConfig(requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

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
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

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

async function nextSugestaoNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `SC-${ano}-`
  const last = await prisma.sugestaoCompra.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

export async function gerarSugestaoCompra(requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const config = await getCompraConfig(ctx.userId)
  const produtos = await prisma.produto.findMany({
    where: { empresaId: ctx.empresaId, ativo: true },
  })

  const numero = await nextSugestaoNumero(ctx.empresaId)
  const sugestao = await prisma.sugestaoCompra.create({
    data: {
      empresaId: ctx.empresaId,
      numero,
      status: "GERADA",
      geradaPorUserId: ctx.userId,
      itens: {
        create: await Promise.all(
          produtos.map(async (p) => {
            const media = await calcularMediaConsumo(p.id, config, ctx.empresaId)
            const qtd = Math.max(0, media * config.multiplicadorConsumo - p.estoque)
            return {
              produtoId: p.id,
              estoqueAtual: p.estoque,
              mediaConsumo: media,
              quantidadeSugerida: qtd,
              incluir: qtd > 0,
            }
          })
        ),
      },
    },
    include: { itens: { include: { produto: true } } },
  })

  revalidatePath("/compras/sugestoes")
  return sugestao
}

export async function getSugestoesCompra(requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.sugestaoCompra.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: { criadoEm: "desc" },
    take: 30,
  })
}

export async function getSugestaoCompraById(id: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.sugestaoCompra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      itens: {
        include: { produto: { select: { id: true, codigo: true, nome: true } } },
        orderBy: { quantidadeSugerida: "desc" },
      },
    },
  })
}

export async function ajustarSugestaoItem(
  itemId: number,
  data: { quantidadeAjustada?: number; incluir?: boolean },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const item = await prisma.sugestaoCompraItem.findFirst({
    where: { id: itemId },
    include: { sugestao: true },
  })
  if (!item || item.sugestao.empresaId !== ctx.empresaId) throw new Error("Item não encontrado.")
  if (item.sugestao.status === "APROVADA" || item.sugestao.status === "CONVERTIDA") {
    throw new Error("Sugestão bloqueada para edição.")
  }

  return prisma.sugestaoCompraItem.update({
    where: { id: itemId },
    data,
  })
}

export async function aprovarSugestaoCompra(sugestaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canApproveCompras(ctx.role)) throw new Error("Sem permissão.")

  const sug = await prisma.sugestaoCompra.update({
    where: { id: sugestaoId },
    data: { status: "APROVADA", aprovadaPorUserId: ctx.userId },
  })

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "APROVAR_SUGESTAO",
    entidade: "SugestaoCompra",
    entidadeId: sugestaoId,
  })

  revalidatePath("/compras/sugestoes")
  return sug
}
