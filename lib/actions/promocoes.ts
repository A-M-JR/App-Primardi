"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { Prisma, type StatusPromocao } from "@prisma/client"

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
const toDate = (v?: string | null) => (v ? new Date(v) : null)

export interface PromocaoItemInput {
  id?: number
  produtoId?: number | null
  descricao: string
  precoNormal: number
  precoPromo: number
  ordem?: number
}

export interface PromocaoInput {
  id?: number
  titulo: string
  descricao?: string | null
  inicio?: string | null
  fim?: string | null
  status: StatusPromocao
  mensagemTemplate?: string | null
  itens: PromocaoItemInput[]
}

// ── Listagem ──
export async function getPromocoes(filtros?: { search?: string; status?: StatusPromocao | "todos" }) {
  noStore()
  const ctx = await assertAcesso("promocoes")
  const where: Prisma.PromocaoWhereInput = { empresaId: ctx.empresaId }
  if (filtros?.status && filtros.status !== "todos") where.status = filtros.status
  if (filtros?.search?.trim()) where.titulo = { contains: filtros.search.trim(), mode: "insensitive" }

  const rows = await prisma.promocao.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: { _count: { select: { itens: true } } },
  })
  return rows.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    descricao: p.descricao,
    status: p.status,
    inicio: iso(p.inicio),
    fim: iso(p.fim),
    qtdItens: p._count.itens,
    criadoEm: iso(p.criadoEm),
  }))
}

// ── Detalhe ──
export async function getPromocao(id: number) {
  noStore()
  const ctx = await assertAcesso("promocoes")
  const p = await prisma.promocao.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      itens: {
        orderBy: { ordem: "asc" },
        include: { produto: { select: { id: true, codigo: true, nome: true } } },
      },
    },
  })
  if (!p) throw new Error("Promoção não encontrada.")
  return {
    id: p.id,
    titulo: p.titulo,
    descricao: p.descricao,
    status: p.status,
    inicio: iso(p.inicio),
    fim: iso(p.fim),
    mensagemTemplate: p.mensagemTemplate,
    criadoEm: iso(p.criadoEm),
    itens: p.itens.map((it) => ({
      id: it.id,
      produtoId: it.produtoId,
      produto: it.produto,
      descricao: it.descricao,
      precoNormal: it.precoNormal,
      precoPromo: it.precoPromo,
      ordem: it.ordem,
      desconto: it.precoNormal > 0 ? (1 - it.precoPromo / it.precoNormal) * 100 : 0,
    })),
  }
}

// ── Criar / atualizar ──
export async function salvarPromocao(input: PromocaoInput) {
  const ctx = await assertAcesso("promocoes", "edit")
  if (!input.titulo?.trim()) throw new Error("Informe o título da promoção.")

  const dados = {
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || null,
    inicio: toDate(input.inicio),
    fim: toDate(input.fim),
    status: input.status,
    mensagemTemplate: input.mensagemTemplate?.trim() || null,
  }

  const id = await prisma.$transaction(async (tx) => {
    let pid = input.id
    if (pid) {
      const existe = await tx.promocao.findFirst({ where: { id: pid, empresaId: ctx.empresaId } })
      if (!existe) throw new Error("Promoção não encontrada.")
      await tx.promocao.update({ where: { id: pid }, data: dados })
    } else {
      const criada = await tx.promocao.create({
        data: { ...dados, empresaId: ctx.empresaId, criadoPorUserId: ctx.userId },
      })
      pid = criada.id
    }

    const idsEnviados = input.itens.filter((i) => i.id).map((i) => i.id!)
    await tx.promocaoItem.deleteMany({
      where: { promocaoId: pid, ...(idsEnviados.length ? { id: { notIn: idsEnviados } } : {}) },
    })
    let ordem = 0
    for (const it of input.itens) {
      const data = {
        produtoId: it.produtoId || null,
        descricao: it.descricao.trim(),
        precoNormal: it.precoNormal || 0,
        precoPromo: it.precoPromo || 0,
        ordem: ordem++,
      }
      if (it.id) await tx.promocaoItem.update({ where: { id: it.id }, data })
      else await tx.promocaoItem.create({ data: { ...data, promocaoId: pid! } })
    }
    return pid!
  })

  revalidatePath("/promocoes")
  return { id }
}

export async function atualizarStatusPromocao(id: number, status: StatusPromocao) {
  const ctx = await assertAcesso("promocoes", "edit")
  await prisma.promocao.updateMany({ where: { id, empresaId: ctx.empresaId }, data: { status } })
  revalidatePath("/promocoes")
  revalidatePath(`/promocoes/${id}`)
  return { ok: true }
}

export async function excluirPromocao(id: number) {
  const ctx = await assertAcesso("promocoes", "edit")
  await prisma.promocao.deleteMany({ where: { id, empresaId: ctx.empresaId } })
  revalidatePath("/promocoes")
  return { ok: true }
}

// ── Sugestão: produtos com mais chance de vender no mês ──
export interface SugestaoProduto {
  produtoId: number
  codigo: string
  nome: string
  estoque: number
  precoBase: number
  vendido90d: number
  precoPromoSugerido: number
}

/**
 * Sugere os produtos com maior chance de venda: ranqueia pelos mais vendidos
 * nos últimos 90 dias (pedidos reais) que ainda têm estoque. Completa com itens
 * de maior consumo médio / estoque se faltar histórico.
 */
export async function sugerirProdutosPromocao(limite = 10): Promise<SugestaoProduto[]> {
  noStore()
  const ctx = await assertAcesso("promocoes")
  const desde = new Date(Date.now() - 90 * 86400000)

  const vendas = await prisma.$queryRaw<{ produtoId: number; vendido: number }[]>`
    SELECT ip."produtoId" AS "produtoId", SUM(ip."quantidade")::float AS "vendido"
    FROM "crm_itens_pedido" ip
    JOIN "crm_pedidos" p ON p.id = ip."pedidoId"
    WHERE p."empresaId" = ${ctx.empresaId}
      AND p."ativo" = TRUE
      AND p."criadoEm" >= ${desde}
      AND ip."produtoId" IS NOT NULL
    GROUP BY ip."produtoId"
    ORDER BY "vendido" DESC
    LIMIT 80
  `
  const vendidoMap = new Map(vendas.map((v) => [v.produtoId, v.vendido]))

  // Produtos vendidos COM estoque, na ordem do ranking de vendas.
  const ids = vendas.map((v) => v.produtoId)
  const comVenda = ids.length
    ? await prisma.produto.findMany({
        where: { id: { in: ids }, empresaId: ctx.empresaId, ativo: true, estoque: { gt: 0 } },
        select: { id: true, codigo: true, nome: true, estoque: true, precoBase: true },
      })
    : []
  comVenda.sort((a, b) => (vendidoMap.get(b.id) ?? 0) - (vendidoMap.get(a.id) ?? 0))

  let escolhidos = comVenda.slice(0, limite)

  // Completa com produtos de maior consumo médio / estoque, se faltar.
  if (escolhidos.length < limite) {
    const jaTem = new Set(escolhidos.map((p) => p.id))
    const extras = await prisma.produto.findMany({
      where: { empresaId: ctx.empresaId, ativo: true, estoque: { gt: 0 }, id: { notIn: [...jaTem] } },
      orderBy: [{ mediaConsumo: "desc" }, { estoque: "desc" }],
      take: limite - escolhidos.length,
      select: { id: true, codigo: true, nome: true, estoque: true, precoBase: true },
    })
    escolhidos = [...escolhidos, ...extras]
  }

  return escolhidos.map((p) => ({
    produtoId: p.id,
    codigo: p.codigo,
    nome: p.nome,
    estoque: p.estoque,
    precoBase: p.precoBase,
    vendido90d: Math.round(vendidoMap.get(p.id) ?? 0),
    precoPromoSugerido: Math.round(p.precoBase * 0.9 * 100) / 100, // -10% como ponto de partida
  }))
}

// ── Destinatários para envio em lote (WhatsApp) ──
export async function getDestinatariosPromo(search?: string) {
  noStore()
  const ctx = await assertAcesso("promocoes")
  const q = search?.trim()
  const rows = await prisma.cliente.findMany({
    where: {
      empresaId: ctx.empresaId,
      ativo: true,
      telefone: { not: "" },
      ...(q
        ? {
            OR: [
              { razaoSocial: { contains: q, mode: "insensitive" } },
              { nomeFantasia: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { razaoSocial: "asc" },
    take: 500,
    select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true, cidade: true },
  })
  return rows.map((c) => ({
    id: c.id,
    nome: c.nomeFantasia || c.razaoSocial,
    telefone: c.telefone,
    cidade: c.cidade,
  }))
}
