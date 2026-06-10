"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import type { StatusPedidoCompra } from "@prisma/client"

async function nextPedidoCompraNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `PC-${ano}-`
  const last = await prisma.pedidoCompra.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

export async function getPedidosCompra(requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.pedidoCompra.findMany({
    where: { empresaId: ctx.empresaId },
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

  const escolhas = await prisma.cotacaoCompraEscolha.findMany({
    where: { cotacaoId },
    include: {
      respostaItem: true,
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
      const preco = e.respostaItem.precoUnitario ?? 0
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

  const cotacao = await prisma.cotacaoCompra.findUnique({ where: { id: cotacaoId } })
  if (cotacao?.sugestaoId) {
    await prisma.sugestaoCompra.update({
      where: { id: cotacao.sugestaoId },
      data: { status: "CONVERTIDA" },
    })
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

  return prisma.pedidoCompra.update({
    where: { id: pedidoId },
    data: {
      status,
      ...(status === "ENVIADO" ? { enviadoEm: new Date() } : {}),
    },
  })
}

export async function getPedidoCompraPdfData(pedidoId: number, requesterId?: number) {
  const pedido = await getPedidoCompraById(pedidoId, requesterId)
  if (!pedido) throw new Error("Pedido não encontrado.")
  return pedido
}
