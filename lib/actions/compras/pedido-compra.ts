"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import type { StatusPedidoCompra } from "@prisma/client"
import { nextPedidoCompraNumero } from "./pedido-compra-helpers"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"
import { buildCriadoEmFilter } from "@/lib/compras/list-filters"

export async function getPedidosCompra(filtros?: ComprasListFiltros, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const criadoEm = buildCriadoEmFilter(filtros?.dataInicio, filtros?.dataFim)
  const search = filtros?.search?.trim()

  return prisma.pedidoCompra.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(filtros?.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
      ...(filtros?.status ? { status: filtros.status as StatusPedidoCompra } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(search
        ? {
            OR: [
              { numero: { contains: search, mode: "insensitive" } },
              { fornecedor: { razaoSocial: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      fornecedor: { select: { id: true, razaoSocial: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 50,
  })
}

export async function getPedidoCompraById(id: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.pedidoCompra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      fornecedor: true,
      cotacao: true,
      itens: {
        include: { produto: { select: { id: true, codigo: true, nome: true } } },
      },
    },
  })
}

export async function gerarPedidosCompraFromCotacao(cotacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const cotacao = await prisma.cotacaoCompra.findFirst({
    where: { id: cotacaoId, empresaId: ctx.empresaId },
    select: { planejamentoId: true },
  })
  if (!cotacao) throw new Error("Cotação não encontrada.")

  const escolhas = await prisma.cotacaoCompraEscolha.findMany({
    where: { cotacaoId },
    include: {
      cotacaoItem: { include: { produto: true } },
      fornecedor: true,
    },
  })

  if (!escolhas.length) throw new Error("Nenhum vencedor escolhido.")

  const porFornecedor = new Map<number, typeof escolhas>()
  for (const e of escolhas) {
    const list = porFornecedor.get(e.fornecedorId) || []
    list.push(e)
    porFornecedor.set(e.fornecedorId, list)
  }

  const pedidos = []

  for (const [fornecedorId, items] of porFornecedor) {
    const numero = await nextPedidoCompraNumero(ctx.empresaId)
    let total = 0
    const itensData = items.map((e) => {
      const preco = e.precoUnitario ?? 0
      const qtd = e.cotacaoItem.quantidade
      const itemTotal = preco * qtd
      total += itemTotal
      return {
        produtoId: e.cotacaoItem.produtoId,
        cotacaoItemId: e.cotacaoItemId,
        escolhaId: e.id,
        descricao: e.cotacaoItem.produto.nome,
        quantidade: qtd,
        unidade: e.cotacaoItem.unidade,
        precoUnitario: preco,
        total: itemTotal,
      }
    })

    const pedido = await prisma.pedidoCompra.create({
      data: {
        empresaId: ctx.empresaId,
        fornecedorId,
        cotacaoId,
        planejamentoId: cotacao.planejamentoId,
        numero,
        status: "RASCUNHO",
        totalGeral: total,
        geradoPorUserId: ctx.userId,
        itens: { create: itensData },
      },
      include: { fornecedor: true, itens: true },
    })

    await registrarAuditoriaCompra({
      empresaId: ctx.empresaId,
      userId: ctx.userId,
      acao: "GERAR_PEDIDO",
      entidade: "PedidoCompra",
      entidadeId: pedido.id,
      detalhes: { cotacaoId, fornecedorId },
    })

    pedidos.push(pedido)
  }

  await prisma.cotacaoCompra.update({
    where: { id: cotacaoId },
    data: { status: "FECHADA", fechadaEm: new Date() },
  })

  if (cotacao.planejamentoId) {
    await prisma.planejamentoCompra.update({
      where: { id: cotacao.planejamentoId },
      data: { status: "CONVERTIDO" },
    })
    revalidatePath(`/compras/planejamentos/${cotacao.planejamentoId}`)
  }

  revalidatePath("/compras/pedidos")
  revalidatePath(`/compras/cotacoes/${cotacaoId}`)
  return pedidos
}

export async function updatePedidoCompraStatus(
  pedidoId: number,
  status: StatusPedidoCompra,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const pedido = await prisma.pedidoCompra.findFirst({
    where: { id: pedidoId, empresaId: ctx.empresaId },
  })
  if (!pedido) throw new Error("Pedido não encontrado.")

  const atualizado = await prisma.pedidoCompra.update({
    where: { id: pedidoId },
    data: {
      status,
      ...(status === "ENVIADO" ? { enviadoEm: new Date() } : {}),
    },
  })

  if (pedido.status !== status) {
    await registrarAuditoriaCompra({
      empresaId: ctx.empresaId,
      userId: ctx.userId,
      acao: "ALTERAR_STATUS",
      entidade: "PedidoCompra",
      entidadeId: pedidoId,
      detalhes: { de: pedido.status, para: status },
    })
  }

  revalidatePath(`/compras/pedidos/${pedidoId}`)
  return atualizado
}

export async function getPedidoCompraPdfData(pedidoId: number, requesterId?: number) {
  const pedido = await getPedidoCompraById(pedidoId, requesterId)
  if (!pedido) throw new Error("Pedido não encontrado.")
  return pedido
}
