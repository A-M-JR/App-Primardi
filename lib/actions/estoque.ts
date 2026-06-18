"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { getRequesterContext } from "./users"

const ESTOQUE_PAGE_SIZE = 20

const DIAS_BAIXO = 15 // cobertura abaixo disso = "baixo"
const MIN_BAIXO = 10 // sem média de consumo, saldo abaixo disso = "baixo"

export type SituacaoEstoque = "ruptura" | "baixo" | "ok"

function situacaoSql(s?: SituacaoEstoque) {
  const baixo = Prisma.sql`p.estoque > 0 AND ((COALESCE(p."mediaConsumo",0) > 0 AND p.estoque < COALESCE(p."mediaConsumo",0) * ${DIAS_BAIXO}) OR (COALESCE(p."mediaConsumo",0) <= 0 AND p.estoque < ${MIN_BAIXO}))`
  if (s === "ruptura") return Prisma.sql`AND p.estoque <= 0`
  if (s === "baixo") return Prisma.sql`AND (${baixo})`
  if (s === "ok") return Prisma.sql`AND p.estoque > 0 AND NOT (${baixo})`
  return Prisma.empty
}

export async function getEstoqueProdutos(params: {
  page?: number
  limit?: number
  search?: string
  situacao?: SituacaoEstoque
  empresaId?: number
} = {}) {
  const page = Math.max(1, params.page || 1)
  const limit = params.limit || ESTOQUE_PAGE_SIZE
  const empresaId = params.empresaId ?? (await getRequesterContext()).empresaId
  const search = params.search?.trim() || ""
  const offset = (page - 1) * limit

  const searchSql = search
    ? Prisma.sql`AND (p.nome ILIKE ${`%${search}%`} OR p.codigo ILIKE ${`%${search}%`} OR p.ean ILIKE ${`%${search}%`})`
    : Prisma.empty
  const sitSql = situacaoSql(params.situacao)

  const situacaoExpr = Prisma.sql`CASE WHEN p.estoque <= 0 THEN 'ruptura' WHEN (p.estoque > 0 AND ((COALESCE(p."mediaConsumo",0) > 0 AND p.estoque < COALESCE(p."mediaConsumo",0) * ${DIAS_BAIXO}) OR (COALESCE(p."mediaConsumo",0) <= 0 AND p.estoque < ${MIN_BAIXO}))) THEN 'baixo' ELSE 'ok' END`

  const [rows, totalRows, kpiRows] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT p.id, p.codigo, p.nome, p.ean, p.estoque, p."unidadePadrao",
             COALESCE(p."mediaConsumo",0) AS "mediaConsumo", p."precoBase",
             ${situacaoExpr} AS situacao
      FROM "crm_produtos" p
      WHERE p."empresaId" = ${empresaId} AND p.ativo = true ${searchSql} ${sitSql}
      ORDER BY p.nome ASC
      LIMIT ${limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "crm_produtos" p
      WHERE p."empresaId" = ${empresaId} AND p.ativo = true ${searchSql} ${sitSql}
    `,
    prisma.$queryRaw<{ ruptura: number; baixo: number; total: number; valor: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE p.estoque <= 0)::int AS ruptura,
        COUNT(*) FILTER (WHERE p.estoque > 0 AND ((COALESCE(p."mediaConsumo",0) > 0 AND p.estoque < COALESCE(p."mediaConsumo",0) * ${DIAS_BAIXO}) OR (COALESCE(p."mediaConsumo",0) <= 0 AND p.estoque < ${MIN_BAIXO})))::int AS baixo,
        COUNT(*)::int AS total,
        COALESCE(SUM(p.estoque * p."precoBase"), 0)::float AS valor
      FROM "crm_produtos" p
      WHERE p."empresaId" = ${empresaId} AND p.ativo = true
    `,
  ])

  const total = totalRows[0]?.c ?? 0
  const kpi = kpiRows[0] ?? { ruptura: 0, baixo: 0, total: 0, valor: 0 }

  return {
    data: rows.map((r) => ({
      ...r,
      mediaConsumo: Number(r.mediaConsumo),
      precoBase: Number(r.precoBase),
      diasCobertura: Number(r.mediaConsumo) > 0 ? Math.floor(r.estoque / Number(r.mediaConsumo)) : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    kpis: {
      ruptura: Number(kpi.ruptura),
      baixo: Number(kpi.baixo),
      total: Number(kpi.total),
      valor: Number(kpi.valor),
    },
  }
}

export async function getMovimentacoesEstoque(produtoId?: number) {
  const where = produtoId ? { produtoId } : {}
  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      produto: {
        select: { nome: true, codigo: true, unidadePadrao: true }
      }
    }
  })
  
  return movimentacoes.map(m => ({
    ...m,
    criadoEm: m.criadoEm.toISOString(),
  }))
}

export async function addMovimentacaoEstoque(data: {
  produtoId: number
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE"
  quantidade: number
  descricao?: string
  pedidoId?: number
}) {

  try {
    const { empresaId } = await getRequesterContext()
    const result = await prisma.$transaction(async (tx) => {
      // Pega o estoque atual bloqueando a linha (FOR UPDATE)
      const produto = await tx.$queryRaw`
        SELECT estoque FROM "crm_produtos" 
        WHERE id = ${data.produtoId} 
        FOR UPDATE
      ` as any[]

      if (produto.length === 0) throw new Error("Produto não encontrado")
      
      const estoqueAntes = Number(produto[0].estoque) || 0
      let estoqueDepois = estoqueAntes

      if (data.tipo === "ENTRADA") {
        estoqueDepois += data.quantidade
      } else if (data.tipo === "SAIDA") {
        estoqueDepois -= data.quantidade
      } else if (data.tipo === "AJUSTE") {
        estoqueDepois = data.quantidade
      }

      // 1. Atualiza o saldo no produto
      await tx.$executeRaw`
        UPDATE "crm_produtos" 
        SET estoque = ${estoqueDepois} 
        WHERE id = ${data.produtoId}
      `

      // 2. Registra o log da movimentação
      const now = new Date()
      await tx.$executeRaw`
        INSERT INTO "crm_movimentacoes_estoque" 
        ("empresaId", "produtoId", tipo, quantidade, "estoqueAntes", "estoqueDepois", descricao, "pedidoId", "criadoEm")
        VALUES (
          ${empresaId}, ${data.produtoId}, ${data.tipo}, ${data.quantidade}, 
          ${estoqueAntes}, ${estoqueDepois}, ${data.descricao || null}, ${data.pedidoId || null}, ${now}
        )
      `

      return { estoqueAntes, estoqueDepois }
    })

    revalidatePath("/estoque")
    revalidatePath("/produtos")
    return { success: true, ...result }
  } catch (error: any) {
    console.error("ERRO ao movimentar estoque:", error)
    throw new Error(error.message || "Erro ao movimentar estoque")
  }
}
