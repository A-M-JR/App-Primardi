"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { Prisma } from "@prisma/client"

export interface CmedSugestao {
  id: number
  produto: string
  apresentacao: string | null
  laboratorio: string | null
  substancia: string | null
  ean: string | null
  registro: string | null
  precoFabrica: number
  pmvg: number
}

export interface ProdutoConciliacao {
  id: number
  codigo: string
  nome: string
  eanAtual: string | null
  pmvgAtual: number | null
  sugestoes: CmedSugestao[]
}

const cmedSelect = {
  id: true, produto: true, apresentacao: true, laboratorio: true, substancia: true,
  ean: true, registro: true, precoFabrica: true, pmvg: true,
} as const

/** Tokens significativos do nome (>=4 chars) para casar com a CMED. */
function tokens(nome: string): string[] {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4)
    .slice(0, 3)
}

async function sugestoesPara(nome: string, eanAtual: string | null): Promise<CmedSugestao[]> {
  // 1) Se o EAN atual existir na CMED, é a melhor pista.
  const porEan = eanAtual
    ? await prisma.cmed.findMany({ where: { ean: eanAtual.replace(/\D/g, "") }, take: 3, select: cmedSelect })
    : []
  const ts = tokens(nome)
  const porNome = ts.length
    ? await prisma.cmed.findMany({
        where: { AND: ts.map((t) => ({ produto: { contains: t, mode: "insensitive" as const } })) },
        take: 6,
        orderBy: { produto: "asc" },
        select: cmedSelect,
      })
    : []
  // Mescla (EAN primeiro), sem duplicar id.
  const vistos = new Set<number>()
  const out: CmedSugestao[] = []
  for (const c of [...porEan, ...porNome]) {
    if (vistos.has(c.id)) continue
    vistos.add(c.id)
    out.push(c)
    if (out.length >= 6) break
  }
  return out
}

/** Para o botão no cadastro do produto: sugestões da CMED para um produto. */
export async function sugerirCmedParaProduto(produtoId: number): Promise<ProdutoConciliacao> {
  const ctx = await assertAcesso("estoque")
  const p = await prisma.produto.findFirst({
    where: { id: produtoId, empresaId: ctx.empresaId },
    select: { id: true, codigo: true, nome: true, ean: true, pmvg: true },
  })
  if (!p) throw new Error("Produto não encontrado.")
  return {
    id: p.id, codigo: p.codigo, nome: p.nome, eanAtual: p.ean, pmvgAtual: p.pmvg,
    sugestoes: await sugestoesPara(p.nome, p.ean),
  }
}

/** Tela de conciliação em massa: produtos do catálogo + sugestões da CMED. */
export async function conciliarEanCatalogo(params: {
  termo?: string
  somenteSemEan?: boolean
}): Promise<ProdutoConciliacao[]> {
  const ctx = await assertAcesso("estoque")
  const termo = params.termo?.trim()

  const where: Prisma.ProdutoWhereInput = { empresaId: ctx.empresaId, ativo: true }
  if (params.somenteSemEan) where.OR = [{ ean: null }, { ean: "" }]
  if (termo) {
    where.AND = [{
      OR: [
        { nome: { contains: termo, mode: "insensitive" } },
        { codigo: { contains: termo, mode: "insensitive" } },
        { ean: { contains: termo.replace(/\D/g, "") } },
      ],
    }]
  }

  const produtos = await prisma.produto.findMany({
    where,
    orderBy: { nome: "asc" },
    take: 40,
    select: { id: true, codigo: true, nome: true, ean: true, pmvg: true },
  })

  const out: ProdutoConciliacao[] = []
  for (const p of produtos) {
    out.push({
      id: p.id, codigo: p.codigo, nome: p.nome, eanAtual: p.ean, pmvgAtual: p.pmvg,
      sugestoes: await sugestoesPara(p.nome, p.ean),
    })
  }
  return out
}

/** Grava o EAN (e opcionalmente o PMVG) no produto. */
export async function atualizarEanProduto(params: {
  produtoId: number
  ean: string
  pmvg?: number | null
}) {
  const ctx = await assertAcesso("estoque", "edit")
  const p = await prisma.produto.findFirst({
    where: { id: params.produtoId, empresaId: ctx.empresaId },
    select: { id: true },
  })
  if (!p) throw new Error("Produto não encontrado.")

  await prisma.produto.update({
    where: { id: params.produtoId },
    data: {
      ean: params.ean.replace(/\D/g, "") || null,
      ...(params.pmvg != null ? { pmvg: params.pmvg } : {}),
      pmvgAtualizadoEm: new Date(),
    },
  })

  revalidatePath("/produtos")
  revalidatePath("/produtos/conciliar-ean")
  return { ok: true }
}
