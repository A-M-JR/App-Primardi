"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { revalidatePath } from "next/cache"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import { parseRespostasCotacao, getRespostaCotacao } from "@/lib/compras/json-store"
import { getCotacaoCompraById } from "./cotacao"

export async function getMatrizCotacao(cotacaoId: number, requesterId?: number) {
  return getCotacaoCompraById(cotacaoId, requesterId)
}

export async function escolherFornecedorItem(
  cotacaoItemId: number,
  cotacaoFornecedorId: number,
  motivo?: string,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const cf = await prisma.cotacaoCompraFornecedor.findFirst({
    where: { id: cotacaoFornecedorId },
    include: { cotacao: true },
  })
  const item = await prisma.cotacaoCompraItem.findFirst({
    where: { id: cotacaoItemId },
    include: { cotacao: true },
  })
  if (!cf || !item || cf.cotacaoId !== item.cotacaoId) {
    throw new Error("Cotação ou item não encontrado.")
  }
  if (cf.cotacao.empresaId !== ctx.empresaId) {
    throw new Error("Sem permissão.")
  }

  const respostas = parseRespostasCotacao(cf.respostas)
  const resposta = getRespostaCotacao(respostas, cotacaoItemId)

  const escolha = await prisma.cotacaoCompraEscolha.upsert({
    where: { cotacaoItemId },
    create: {
      cotacaoId: item.cotacaoId,
      cotacaoItemId,
      fornecedorId: cf.fornecedorId,
      cotacaoFornecedorId,
      precoUnitario: resposta?.precoUnitario,
      escolhidoPorUserId: ctx.userId,
      motivo,
    },
    update: {
      fornecedorId: cf.fornecedorId,
      cotacaoFornecedorId,
      precoUnitario: resposta?.precoUnitario,
      escolhidoPorUserId: ctx.userId,
      motivo,
    },
  })

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "ESCOLHER_VENCEDOR",
    entidade: "CotacaoCompraEscolha",
    entidadeId: escolha.id,
    detalhes: { cotacaoItemId, cotacaoFornecedorId },
  })

  revalidatePath(`/compras/cotacoes/${item.cotacaoId}`)
  return escolha
}

export async function sugerirVencedoresMenorPreco(cotacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : await getRequesterContext()

  const cotacao = await getMatrizCotacao(cotacaoId, ctx.userId)
  if (!cotacao) throw new Error("Cotação não encontrada.")

  const sugestoes: {
    cotacaoItemId: number
    cotacaoFornecedorId: number
    fornecedor: string
    preco: number
  }[] = []

  for (const item of cotacao.itens) {
    const comPreco = (item.respostas as { cotacaoFornecedorId: number; precoUnitario?: number | null }[]).filter(
      (r) => r.precoUnitario !== null && r.precoUnitario !== undefined
    )
    if (!comPreco.length) continue
    const menor = comPreco.reduce((a, b) =>
      (a.precoUnitario ?? Infinity) <= (b.precoUnitario ?? Infinity) ? a : b
    )
    sugestoes.push({
      cotacaoItemId: item.id,
      cotacaoFornecedorId: menor.cotacaoFornecedorId,
      fornecedor:
        cotacao.fornecedores.find((f) => f.id === menor.cotacaoFornecedorId)?.fornecedor.razaoSocial ??
        "",
      preco: menor.precoUnitario!,
    })
  }

  return sugestoes
}

export async function aplicarVencedoresMenorPreco(cotacaoId: number, requesterId?: number) {
  const sugestoes = await sugerirVencedoresMenorPreco(cotacaoId, requesterId)
  for (const s of sugestoes) {
    await escolherFornecedorItem(
      s.cotacaoItemId,
      s.cotacaoFornecedorId,
      "Menor preço",
      requesterId
    )
  }
  return { aplicados: sugestoes.length }
}
