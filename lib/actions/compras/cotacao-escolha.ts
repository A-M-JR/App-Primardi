"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { revalidatePath } from "next/cache"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"

export async function getMatrizCotacao(cotacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const cotacao = await prisma.cotacaoCompra.findFirst({
    where: { id: cotacaoId, empresaId: ctx.empresaId },
    include: {
      itens: {
        include: {
          produto: true,
          respostas: {
            include: {
              cotacaoFornecedor: { include: { fornecedor: true } },
            },
          },
          escolha: { include: { fornecedor: true } },
        },
      },
      fornecedores: { include: { fornecedor: true } },
    },
  })
  return cotacao
}

export async function escolherFornecedorItem(
  cotacaoItemId: number,
  respostaItemId: number,
  motivo?: string,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const resposta = await prisma.cotacaoCompraRespostaItem.findFirst({
    where: { id: respostaItemId },
    include: {
      cotacaoFornecedor: true,
      cotacaoItem: { include: { cotacao: true } },
    },
  })
  if (!resposta || resposta.cotacaoItem.cotacao.empresaId !== ctx.empresaId) {
    throw new Error("Resposta não encontrada.")
  }

  const escolha = await prisma.cotacaoCompraEscolha.upsert({
    where: { cotacaoItemId },
    create: {
      cotacaoId: resposta.cotacaoItem.cotacaoId,
      cotacaoItemId,
      fornecedorId: resposta.cotacaoFornecedor.fornecedorId,
      respostaItemId,
      escolhidoPorUserId: ctx.userId,
      motivo,
    },
    update: {
      fornecedorId: resposta.cotacaoFornecedor.fornecedorId,
      respostaItemId,
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
    detalhes: { cotacaoItemId, respostaItemId },
  })

  revalidatePath(`/compras/cotacoes/${resposta.cotacaoItem.cotacaoId}`)
  return escolha
}

export async function sugerirVencedoresMenorPreco(cotacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const cotacao = await getMatrizCotacao(cotacaoId, ctx.userId)
  if (!cotacao) throw new Error("Cotação não encontrada.")

  const sugestoes: {
    cotacaoItemId: number
    respostaItemId: number
    fornecedor: string
    preco: number
  }[] = []

  for (const item of cotacao.itens) {
    const comPreco = item.respostas.filter(
      (r) => r.precoUnitario !== null && r.precoUnitario !== undefined
    )
    if (!comPreco.length) continue
    const menor = comPreco.reduce((a, b) =>
      (a.precoUnitario ?? Infinity) <= (b.precoUnitario ?? Infinity) ? a : b
    )
    sugestoes.push({
      cotacaoItemId: item.id,
      respostaItemId: menor.id,
      fornecedor: menor.cotacaoFornecedor.fornecedor.razaoSocial,
      preco: menor.precoUnitario!,
    })
  }

  return sugestoes
}

export async function aplicarVencedoresMenorPreco(cotacaoId: number, requesterId?: number) {
  const sugestoes = await sugerirVencedoresMenorPreco(cotacaoId, requesterId)
  for (const s of sugestoes) {
    await escolherFornecedorItem(s.cotacaoItemId, s.respostaItemId, "Menor preço", requesterId)
  }
  return { aplicados: sugestoes.length }
}
