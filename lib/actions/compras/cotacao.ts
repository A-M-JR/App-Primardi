"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { createHash, randomBytes } from "crypto"
import { canManageCompras } from "@/lib/compras/guards"
import { assertCotacaoEditavel } from "@/lib/compras/guards"
import {
  parseRespostasCotacao,
  toRespostasJson,
  upsertRespostaCotacao,
} from "@/lib/compras/json-store"
import type { CotacaoRespostaJson } from "@/lib/compras/types"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"
import { buildCriadoEmFilter } from "@/lib/compras/list-filters"
import type { StatusCotacaoCompra } from "@prisma/client"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function generateToken() {
  return randomBytes(32).toString("hex")
}

async function nextCotacaoNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `COT-${ano}-`
  const last = await prisma.cotacaoCompra.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

function enrichCotacaoWithRespostas<
  T extends {
    itens: { id: number }[]
    fornecedores: { id: number; respostas: unknown; fornecedor: unknown }[]
    escolhas: { cotacaoItemId: number; cotacaoFornecedorId: number }[]
  }
>(cotacao: T) {
  return {
    ...cotacao,
    itens: cotacao.itens.map((item) => ({
      ...item,
      respostas: cotacao.fornecedores.flatMap((f) => {
        const respostas = parseRespostasCotacao(f.respostas)
        const resp = respostas.find((r) => r.cotacaoItemId === item.id)
        if (!resp) return []
        return [
          {
            ...resp,
            id: `${f.id}-${item.id}`,
            cotacaoFornecedorId: f.id,
            cotacaoFornecedor: f,
          },
        ]
      }),
    })),
  }
}

export async function getCotacoesCompra(filtros?: ComprasListFiltros, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const criadoEm = buildCriadoEmFilter(filtros?.dataInicio, filtros?.dataFim)
  const search = filtros?.search?.trim()

  return prisma.cotacaoCompra.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(filtros?.status ? { status: filtros.status as StatusCotacaoCompra } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(filtros?.fornecedorId
        ? { fornecedores: { some: { fornecedorId: filtros.fornecedorId } } }
        : {}),
      ...(search
        ? {
            OR: [
              { numero: { contains: search, mode: "insensitive" } },
              { titulo: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      fornecedores: { include: { fornecedor: { select: { razaoSocial: true } } } },
      _count: { select: { itens: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 30,
  })
}

export async function getCotacaoCompraById(id: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const cotacao = await prisma.cotacaoCompra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      planejamento: { select: { id: true, numero: true, titulo: true } },
      itens: {
        include: {
          produto: { select: { id: true, codigo: true, nome: true } },
          escolha: { include: { fornecedor: true } },
        },
      },
      fornecedores: {
        include: { fornecedor: true },
      },
      escolhas: true,
    },
  })

  if (!cotacao) return null
  return enrichCotacaoWithRespostas(cotacao)
}

export async function criarCotacaoFromPlanejamento(
  planejamentoId: number,
  fornecedorIds: number[],
  prazoResposta?: Date,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  if (!fornecedorIds.length) throw new Error("Selecione ao menos um fornecedor.")

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
    include: {
      cotacao: true,
      itens: {
        where: { incluir: true, produtoId: { not: null }, qtdNecessaria: { gt: 0 } },
      },
    },
  })
  if (!planejamento) throw new Error("Planejamento não encontrado.")
  if (planejamento.cotacao) throw new Error("Planejamento já possui cotação.")
  if (!planejamento.itens.length) {
    const [marcados, semProduto, semQtd] = await Promise.all([
      prisma.planejamentoCompraItem.count({
        where: { planejamentoId, incluir: true },
      }),
      prisma.planejamentoCompraItem.count({
        where: { planejamentoId, incluir: true, produtoId: null },
      }),
      prisma.planejamentoCompraItem.count({
        where: {
          planejamentoId,
          incluir: true,
          produtoId: { not: null },
          qtdNecessaria: { lte: 0 },
        },
      }),
    ])
    if (marcados > 0) {
      const partes: string[] = []
      if (semProduto) partes.push(`${semProduto} sem produto vinculado`)
      if (semQtd) partes.push(`${semQtd} com quantidade zero`)
      throw new Error(
        `${marcados} item(ns) marcado(s), mas nenhum pronto para cotação${
          partes.length ? ` (${partes.join("; ")})` : ""
        }. Defina quantidade > 0 e vincule produtos na importação.`
      )
    }
    throw new Error("Nenhum item marcado para cotação.")
  }

  const numero = await nextCotacaoNumero(ctx.empresaId)
  const tokens: { fornecedorId: number; token: string; prefix: string }[] = []

  const cotacao = await prisma.cotacaoCompra.create({
    data: {
      empresaId: ctx.empresaId,
      planejamentoId,
      numero,
      titulo: `Cotação ${numero} — ${planejamento.titulo || planejamento.numero}`,
      status: "ABERTA",
      prazoResposta,
      criadoPorUserId: ctx.userId,
      itens: {
        create: planejamento.itens.map((i) => ({
          produtoId: i.produtoId!,
          quantidade: i.qtdNecessaria,
        })),
      },
      fornecedores: {
        create: fornecedorIds.map((fid) => {
          const token = generateToken()
          tokens.push({ fornecedorId: fid, token, prefix: token.slice(0, 8) })
          return {
            fornecedorId: fid,
            tokenHash: hashToken(token),
            tokenPrefix: token.slice(0, 8),
          }
        }),
      },
    },
    include: { fornecedores: true, itens: true },
  })

  await prisma.planejamentoCompra.update({
    where: { id: planejamentoId },
    data: { status: "EM_COTACAO" },
  })

  revalidatePath("/compras/cotacoes")
  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return { cotacao, tokens }
}

export async function gerarLinkPortalFornecedor(
  cotacaoFornecedorId: number,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const cf = await prisma.cotacaoCompraFornecedor.findFirst({
    where: { id: cotacaoFornecedorId },
    include: { cotacao: { select: { empresaId: true, status: true } } },
  })
  if (!cf || cf.cotacao.empresaId !== ctx.empresaId) {
    throw new Error("Fornecedor da cotação não encontrado.")
  }
  if (cf.cotacao.status === "FECHADA" || cf.cotacao.status === "CANCELADA") {
    throw new Error("Cotação encerrada.")
  }

  const token = generateToken()
  await prisma.cotacaoCompraFornecedor.update({
    where: { id: cotacaoFornecedorId },
    data: {
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, 8),
    },
  })

  return { token, fornecedorId: cf.fornecedorId }
}

export async function criarCotacaoManual(
  data: {
    titulo?: string
    prazoResposta?: Date
    fornecedorIds: number[]
    itens: { produtoId: number; quantidade: number }[]
  },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const numero = await nextCotacaoNumero(ctx.empresaId)
  const tokens: { fornecedorId: number; token: string }[] = []

  const cotacao = await prisma.cotacaoCompra.create({
    data: {
      empresaId: ctx.empresaId,
      numero,
      titulo: data.titulo || `Cotação ${numero}`,
      status: "ABERTA",
      prazoResposta: data.prazoResposta,
      criadoPorUserId: ctx.userId,
      itens: { create: data.itens },
      fornecedores: {
        create: data.fornecedorIds.map((fid) => {
          const token = generateToken()
          tokens.push({ fornecedorId: fid, token })
          return {
            fornecedorId: fid,
            tokenHash: hashToken(token),
            tokenPrefix: token.slice(0, 8),
          }
        }),
      },
    },
  })

  revalidatePath("/compras/cotacoes")
  return { cotacao, tokens }
}

export async function fecharCotacao(cotacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  await assertCotacaoEditavel(cotacaoId, ctx.empresaId)
  return prisma.cotacaoCompra.update({
    where: { id: cotacaoId },
    data: { status: "FECHADA", fechadaEm: new Date() },
  })
}

export async function getPortalCotacaoData(token: string) {
  const tokenHash = hashToken(token)
  const cf = await prisma.cotacaoCompraFornecedor.findUnique({
    where: { tokenHash },
    include: {
      fornecedor: { select: { razaoSocial: true } },
      cotacao: {
        include: {
          empresa: {
            select: {
              nomeFantasia: true,
              razaoSocial: true,
              logoUrl: true,
              corPrimaria: true,
              telefone: true,
              email: true,
              cidade: true,
              estado: true,
            },
          },
          itens: {
            include: {
              produto: { select: { codigo: true, nome: true } },
            },
          },
        },
      },
    },
  })
  if (!cf) return null

  const respostas = parseRespostasCotacao(cf.respostas)
  const itens = cf.cotacao.itens.map((item) => ({
    ...item,
    respostas: respostas.filter((r) => r.cotacaoItemId === item.id),
  }))

  const enriched = { ...cf, cotacao: { ...cf.cotacao, itens }, respostas }

  if (cf.status === "RESPONDIDA" || cf.status === "BLOQUEADA") {
    return { ...enriched, bloqueado: true }
  }
  if (cf.cotacao.prazoResposta && cf.cotacao.prazoResposta < new Date()) {
    return { ...enriched, expirado: true }
  }
  if (!cf.visualizadoEm) {
    await prisma.cotacaoCompraFornecedor.update({
      where: { id: cf.id },
      data: { status: "VISUALIZADA", visualizadoEm: new Date() },
    })
  }
  return { ...enriched, bloqueado: false, expirado: false }
}

export async function responderCotacaoPortal(
  token: string,
  respostasInput: {
    cotacaoItemId: number
    precoUnitario?: number
    prazoEntregaDias?: number
    quantidadeDisponivel?: number
    observacao?: string
  }[],
  finalizar = false
) {
  const tokenHash = hashToken(token)
  const cf = await prisma.cotacaoCompraFornecedor.findUnique({
    where: { tokenHash },
    include: { cotacao: true },
  })
  if (!cf) throw new Error("Link inválido.")
  if (cf.status === "RESPONDIDA" || cf.status === "BLOQUEADA") {
    throw new Error("Resposta já enviada.")
  }

  let respostas = parseRespostasCotacao(cf.respostas)
  for (const r of respostasInput) {
    const nova: CotacaoRespostaJson = {
      cotacaoItemId: r.cotacaoItemId,
      precoUnitario: r.precoUnitario,
      prazoEntregaDias: r.prazoEntregaDias,
      quantidadeDisponivel: r.quantidadeDisponivel,
      observacao: r.observacao,
      bloqueado: finalizar,
    }
    respostas = upsertRespostaCotacao(respostas, nova)
  }

  await prisma.cotacaoCompraFornecedor.update({
    where: { id: cf.id },
    data: {
      respostas: toRespostasJson(
        finalizar ? respostas.map((r) => ({ ...r, bloqueado: true })) : respostas
      ),
      ...(finalizar
        ? { status: "RESPONDIDA", respondidoEm: new Date(), bloqueadoEm: new Date() }
        : {}),
    },
  })

  if (finalizar) {
    await prisma.cotacaoCompra.update({
      where: { id: cf.cotacaoId },
      data: { status: "EM_RESPOSTA" },
    })
  }

  return { ok: true }
}
