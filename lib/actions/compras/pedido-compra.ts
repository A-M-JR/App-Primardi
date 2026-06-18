"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { canManageCompras, canApproveCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import type { StatusPedidoCompra } from "@prisma/client"
import { nextPedidoCompraNumero } from "./pedido-compra-helpers"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"
import { buildCriadoEmFilter, buildPaginacao } from "@/lib/compras/list-filters"

export async function getPedidosCompra(filtros?: ComprasListFiltros, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  const criadoEm = buildCriadoEmFilter(filtros?.dataInicio, filtros?.dataFim)
  const search = filtros?.search?.trim()
  const { skip, take, page } = buildPaginacao(filtros?.page)

  const where = {
    empresaId: ctx.empresaId,
    ...(filtros?.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
    ...(filtros?.status ? { status: filtros.status as StatusPedidoCompra } : {}),
    ...(criadoEm ? { criadoEm } : {}),
    ...(search
      ? {
          OR: [
            { numero: { contains: search, mode: "insensitive" as const } },
            { fornecedor: { razaoSocial: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }

  const [list, total] = await Promise.all([
    prisma.pedidoCompra.findMany({
      where,
      include: {
        fornecedor: { select: { id: true, razaoSocial: true } },
        _count: { select: { itens: true } },
      },
      orderBy: { criadoEm: "desc" },
      skip,
      take,
    }),
    prisma.pedidoCompra.count({ where }),
  ])

  return { data: list, total, page, totalPages: Math.ceil(total / take) }
}

export async function getPedidoCompraById(id: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

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
    : await getRequesterContext()

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
    : await getRequesterContext()

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const pedido = await prisma.pedidoCompra.findFirst({
    where: { id: pedidoId, empresaId: ctx.empresaId },
  })
  if (!pedido) throw new Error("Pedido não encontrado.")

  // "Aprovar" = poder cruzar a barreira de aprovação. Requer role aprovadora OU compras:approve.
  const permissoesCompras = (ctx.permissoes?.compras as string[] | undefined) ?? []
  const podeAprovar = canApproveCompras(ctx.role) || permissoesCompras.includes("approve")

  const preAprovacao = pedido.status === "RASCUNHO" || pedido.status === "AGUARDANDO_APROVACAO"
  const alvoEnviadoOuAlem = ["ENVIADO", "CONFIRMADO", "RECEBIDO_PARCIAL", "RECEBIDO"].includes(status)
  const cruzandoAprovacao = preAprovacao && alvoEnviadoOuAlem

  if (cruzandoAprovacao && !podeAprovar) {
    throw new Error("Pedido requer aprovação de um responsável antes de avançar.")
  }

  const atualizado = await prisma.pedidoCompra.update({
    where: { id: pedidoId },
    data: {
      status,
      ...(status === "ENVIADO" ? { enviadoEm: new Date() } : {}),
      ...(cruzandoAprovacao ? { aprovadoPorUserId: ctx.userId, aprovadoEm: new Date() } : {}),
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

/**
 * Registra o recebimento (parcial ou total) de itens de um pedido de compra:
 * incrementa qtdRecebida, dá ENTRADA no estoque (MovimentacaoEstoque) e
 * recalcula o status (RECEBIDO_PARCIAL/RECEBIDO).
 */
export async function registrarRecebimento(
  pedidoId: number,
  recebimentos: { itemId: number; quantidade: number }[],
  requesterId?: number
) {
  const ctx = requesterId ? await getRequesterContext(requesterId) : await getRequesterContext()
  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const pedido = await prisma.pedidoCompra.findFirst({
    where: { id: pedidoId, empresaId: ctx.empresaId },
    include: { itens: true },
  })
  if (!pedido) throw new Error("Pedido não encontrado.")

  const recebMap = new Map(recebimentos.map((r) => [r.itemId, r.quantidade]))

  await prisma.$transaction(async (tx) => {
    for (const item of pedido.itens) {
      const qtd = recebMap.get(item.id) ?? 0
      if (qtd <= 0) continue

      await tx.itemPedidoCompra.update({
        where: { id: item.id },
        data: { qtdRecebida: item.qtdRecebida + qtd },
      })

      const produto = await tx.produto.findUnique({
        where: { id: item.produtoId },
        select: { estoque: true },
      })
      const antes = produto?.estoque ?? 0
      const depois = antes + qtd
      await tx.produto.update({ where: { id: item.produtoId }, data: { estoque: depois } })
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId: ctx.empresaId,
          produtoId: item.produtoId,
          tipo: "ENTRADA",
          quantidade: qtd,
          estoqueAntes: antes,
          estoqueDepois: depois,
          descricao: `Recebimento ${pedido.numero}`,
        },
      })
    }

    const itensAtual = await tx.itemPedidoCompra.findMany({
      where: { pedidoCompraId: pedidoId },
      select: { quantidade: true, qtdRecebida: true },
    })
    const algumRecebido = itensAtual.some((i) => i.qtdRecebida > 0)
    const tudoRecebido = itensAtual.every((i) => i.qtdRecebida >= i.quantidade)
    const novoStatus = tudoRecebido ? "RECEBIDO" : algumRecebido ? "RECEBIDO_PARCIAL" : pedido.status
    if (novoStatus !== pedido.status) {
      await tx.pedidoCompra.update({ where: { id: pedidoId }, data: { status: novoStatus as StatusPedidoCompra } })
    }
  })

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "ALTERAR_STATUS",
    entidade: "PedidoCompra",
    entidadeId: pedidoId,
    detalhes: { recebimento: recebimentos },
  })
  revalidatePath(`/compras/pedidos/${pedidoId}`)
  return { ok: true }
}

export async function getPedidoCompraPdfData(pedidoId: number, requesterId?: number) {
  const pedido = await getPedidoCompraById(pedidoId, requesterId)
  if (!pedido) throw new Error("Pedido não encontrado.")
  return pedido
}
