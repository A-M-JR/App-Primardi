"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { normalizeText } from "@/lib/compras/normalize-text"

export interface ProdutoMatch {
  id: number
  codigo: string
  nome: string
  ean: string | null
  precoBase: number
  estoque: number
}

export interface LinhaLista {
  linha: number
  original: string
  quantidade: number
  termo: string
  candidatos: ProdutoMatch[]
  produtoId: number | null
  status: "ok" | "ambiguo" | "nao_encontrado"
}

const SELECT = { id: true, codigo: true, nome: true, ean: true, precoBase: true, estoque: true } as const

/** Quebra "10 dipirona 500mg", "5cx amoxicilina", "2 un soro" em quantidade + termo. */
function parseLinha(raw: string): { quantidade: number; termo: string } {
  const s = raw.trim()
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|un|und|unid|cx|cxs|caixas?|fr|frascos?)?\b[\s\-:.)]*(.+)$/i)
  if (m && m[2] && m[2].trim().length >= 2) {
    return { quantidade: parseFloat(m[1].replace(",", ".")) || 1, termo: m[2].trim() }
  }
  return { quantidade: 1, termo: s }
}

/**
 * Recebe uma lista colada (texto livre, ex.: WhatsApp) e tenta casar cada linha
 * com um produto da empresa ativa: código/EAN exato ou todos os tokens no nome.
 */
export async function matchListaTelevendas(texto: string): Promise<LinhaLista[]> {
  const ctx = await getRequesterContext()
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const resultado: LinhaLista[] = []
  let n = 0
  for (const raw of linhas) {
    n++
    const { quantidade, termo } = parseLinha(raw)
    const tokens = normalizeText(termo).split(/\s+/).filter((t) => t.length >= 2)

    const candidatos = (await prisma.produto.findMany({
      where: {
        empresaId: ctx.empresaId,
        ativo: true,
        OR: [
          { codigo: { equals: termo, mode: "insensitive" } },
          { ean: termo },
          ...(tokens.length
            ? [{ AND: tokens.map((t) => ({ nome: { contains: t, mode: "insensitive" as const } })) }]
            : []),
        ],
      },
      select: SELECT,
      take: 6,
    })) as ProdutoMatch[]

    let status: LinhaLista["status"] = "nao_encontrado"
    let produtoId: number | null = null

    if (candidatos.length > 0) {
      const exato = candidatos.find(
        (c) => c.codigo.toLowerCase() === termo.toLowerCase() || c.ean === termo
      )
      if (exato) {
        status = "ok"
        produtoId = exato.id
      } else if (candidatos.length === 1) {
        status = "ok"
        produtoId = candidatos[0].id
      } else {
        status = "ambiguo"
        produtoId = candidatos[0].id
      }
    }

    resultado.push({ linha: n, original: raw, quantidade, termo, candidatos, produtoId, status })
  }

  return resultado
}

/**
 * Preço de preferência por produto para um cliente: usa a tabela de preço do
 * cliente quando houver; senão o preço base. Retorna { produtoId: preco }.
 */
export async function precosParaCliente(
  clienteId: number,
  produtoIds: number[]
): Promise<Record<number, number>> {
  const ctx = await getRequesterContext()
  const out: Record<number, number> = {}
  if (!produtoIds.length) return out

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: ctx.empresaId },
    select: { tabelaPrecoId: true },
  })

  const select: any = { id: true, precoBase: true }
  if (cliente?.tabelaPrecoId) {
    select.tabelasPreco = {
      where: { tabelaPrecoId: cliente.tabelaPrecoId },
      select: { preco: true },
    }
  }

  const produtos = await prisma.produto.findMany({
    where: { id: { in: produtoIds }, empresaId: ctx.empresaId },
    select,
  })

  for (const p of produtos as any[]) {
    const tab = p.tabelasPreco?.[0]?.preco
    out[p.id] = tab != null ? tab : p.precoBase
  }
  return out
}

/**
 * Busca de produtos por código/EAN/nome (server-side, usada nos comboboxes).
 * Com `somenteVisiveis`, respeita produtos exclusivos: mostra públicos (sem
 * clientes autorizados) + os autorizados ao `clienteId` informado.
 */
export async function buscarProdutosTermo(
  termo: string,
  opts?: { clienteId?: number; somenteVisiveis?: boolean }
): Promise<ProdutoMatch[]> {
  const ctx = await getRequesterContext()
  const t = termo.trim()
  if (t.length < 2) return []
  const tokens = normalizeText(t).split(/\s+/).filter((x) => x.length >= 2)

  const busca = {
    OR: [
      { codigo: { contains: t, mode: "insensitive" as const } },
      { ean: { contains: t } },
      ...(tokens.length
        ? [{ AND: tokens.map((x) => ({ nome: { contains: x, mode: "insensitive" as const } })) }]
        : []),
    ],
  }

  const visibilidade = opts?.somenteVisiveis
    ? opts.clienteId
      ? {
          OR: [
            { clientesAutorizados: { none: {} } },
            { clientesAutorizados: { some: { clienteId: opts.clienteId } } },
          ],
        }
      : { clientesAutorizados: { none: {} } }
    : undefined

  return (await prisma.produto.findMany({
    where: {
      empresaId: ctx.empresaId,
      ativo: true,
      AND: [busca, ...(visibilidade ? [visibilidade] : [])],
    },
    select: SELECT,
    take: 10,
  })) as ProdutoMatch[]
}
