"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { createHash, randomBytes } from "crypto"
import { canManageCompras } from "@/lib/compras/guards"
import { assertCotacaoEditavel } from "@/lib/compras/guards"

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

export async function getCotacoesCompra(requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.cotacaoCompra.findMany({
    where: { empresaId: ctx.empresaId },
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

  return prisma.cotacaoCompra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      sugestao: true,
      itens: {
        include: {
          produto: { select: { id: true, codigo: true, nome: true } },
          respostas: {
            include: {
              cotacaoFornecedor: { include: { fornecedor: true } },
            },
          },
          escolha: { include: { fornecedor: true } },
        },
      },
      fornecedores: {
        include: {
          fornecedor: true,
          respostas: true,
        },
      },
      escolhas: true,
    },
  })
}

export async function criarCotacaoFromSugestao(
  sugestaoId: number,
  fornecedorIds: number[],
  prazoResposta?: Date,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  if (!fornecedorIds.length) throw new Error("Selecione ao menos um fornecedor.")

  const sugestao = await prisma.sugestaoCompra.findFirst({
    where: { id: sugestaoId, empresaId: ctx.empresaId },
    include: { itens: { where: { incluir: true } } },
  })
  if (!sugestao) throw new Error("Sugestão não encontrada.")

  const numero = await nextCotacaoNumero(ctx.empresaId)
  const tokens: { fornecedorId: number; token: string; prefix: string }[] = []

  const cotacao = await prisma.cotacaoCompra.create({
    data: {
      empresaId: ctx.empresaId,
      sugestaoId,
      numero,
      titulo: `Cotação ${numero}`,
      status: "ABERTA",
      prazoResposta,
      criadoPorUserId: ctx.userId,
      itens: {
        create: sugestao.itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidadeAjustada ?? i.quantidadeSugerida,
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

  await prisma.sugestaoCompra.update({
    where: { id: sugestaoId },
    data: { status: "EM_COTACAO" },
  })

  revalidatePath("/compras/cotacoes")
  return { cotacao, tokens }
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
          itens: {
            include: {
              produto: { select: { codigo: true, nome: true } },
              respostas: {
                where: { cotacaoFornecedor: { tokenHash } },
              },
            },
          },
        },
      },
      respostas: true,
    },
  })
  if (!cf) return null
  if (cf.status === "RESPONDIDA" || cf.status === "BLOQUEADA") {
    return { ...cf, bloqueado: true }
  }
  if (cf.cotacao.prazoResposta && cf.cotacao.prazoResposta < new Date()) {
    return { ...cf, expirado: true }
  }
  if (!cf.visualizadoEm) {
    await prisma.cotacaoCompraFornecedor.update({
      where: { id: cf.id },
      data: { status: "VISUALIZADA", visualizadoEm: new Date() },
    })
  }
  return { ...cf, bloqueado: false, expirado: false }
}

export async function responderCotacaoPortal(
  token: string,
  respostas: {
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

  for (const r of respostas) {
    await prisma.cotacaoCompraRespostaItem.upsert({
      where: {
        cotacaoFornecedorId_cotacaoItemId: {
          cotacaoFornecedorId: cf.id,
          cotacaoItemId: r.cotacaoItemId,
        },
      },
      create: {
        cotacaoFornecedorId: cf.id,
        cotacaoItemId: r.cotacaoItemId,
        precoUnitario: r.precoUnitario,
        prazoEntregaDias: r.prazoEntregaDias,
        quantidadeDisponivel: r.quantidadeDisponivel,
        observacao: r.observacao,
        bloqueado: finalizar,
      },
      update: {
        precoUnitario: r.precoUnitario,
        prazoEntregaDias: r.prazoEntregaDias,
        quantidadeDisponivel: r.quantidadeDisponivel,
        observacao: r.observacao,
        bloqueado: finalizar,
        respondidoEm: new Date(),
      },
    })
  }

  if (finalizar) {
    await prisma.cotacaoCompraRespostaItem.updateMany({
      where: { cotacaoFornecedorId: cf.id },
      data: { bloqueado: true },
    })
    await prisma.cotacaoCompraFornecedor.update({
      where: { id: cf.id },
      data: { status: "RESPONDIDA", respondidoEm: new Date(), bloqueadoEm: new Date() },
    })
    await prisma.cotacaoCompra.update({
      where: { id: cf.cotacaoId },
      data: { status: "EM_RESPOSTA" },
    })
  }

  return { ok: true }
}
