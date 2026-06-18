"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { consultarCnpj as _cnpj, type CnpjInfo } from "@/lib/integracoes/brasilapi"
import { consultarEan as _ean } from "@/lib/integracoes/ean"
import { consultarGtinCosmos } from "@/lib/integracoes/cosmos"
import { consultarPrecosPraticados as _precos } from "@/lib/integracoes/compras-gov"
import { buscarContratosPNCP as _contratos, buscarAtasPNCP as _atas } from "@/lib/integracoes/pncp-extra"
import type { CmedRow } from "@/lib/cmed/parse"

// ── CNPJ (BrasilAPI) ───────────────────────────────────────────
export async function consultarCnpj(cnpj: string): Promise<CnpjInfo> {
  await assertAcesso("licitacoes")
  return _cnpj(cnpj)
}

// ── EAN (Open Food Facts → Cosmos c/ cota → base CMED) ─────────
const COSMOS_LIMITE_DIA = 25
const hojeStr = () => new Date().toISOString().slice(0, 10)

async function getCosmosUsoHoje(): Promise<number> {
  const row = await prisma.consultaApiUsage.findUnique({
    where: { fonte_dia: { fonte: "cosmos", dia: hojeStr() } },
  })
  return row?.count ?? 0
}

/** Reserva 1 cota do dia para o Cosmos. Retorna false se o limite foi atingido. */
async function consumirCotaCosmos(): Promise<boolean> {
  const dia = hojeStr()
  const row = await prisma.consultaApiUsage.upsert({
    where: { fonte_dia: { fonte: "cosmos", dia } },
    update: {},
    create: { fonte: "cosmos", dia, count: 0 },
  })
  if (row.count >= COSMOS_LIMITE_DIA) return false
  await prisma.consultaApiUsage.update({
    where: { fonte_dia: { fonte: "cosmos", dia } },
    data: { count: { increment: 1 } },
  })
  return true
}

export async function getCosmosQuota() {
  await assertAcesso("licitacoes")
  const usadas = await getCosmosUsoHoje()
  return { usadas, limite: COSMOS_LIMITE_DIA, restantes: Math.max(0, COSMOS_LIMITE_DIA - usadas) }
}

export interface EanResultado {
  ean: string
  encontrado: boolean
  nome: string
  marca: string
  detalhe: string
  imagem: string
  fonte: string
  cosmosLimiteAtingido: boolean
  cmed: { produto: string; apresentacao: string | null; laboratorio: string | null; pmvg: number; precoFabrica: number }[]
}

export async function consultarEan(ean: string): Promise<EanResultado> {
  await assertAcesso("licitacoes")
  const digits = ean.replace(/\D/g, "")

  // 1) Open Food Facts (grátis, ilimitado) — bom p/ produtos de consumo.
  const off = await _ean(ean)
  let encontrado = off.encontrado
  let nome = off.nome
  let marca = off.marca
  let detalhe = off.quantidade
  let imagem = off.imagem
  let fonte = "Open Food Facts"
  let cosmosLimiteAtingido = false

  // 2) Se não achou no OFF, tenta o Cosmos (cobre medicamentos) com cota diária.
  if (!off.encontrado && process.env.COSMOS_TOKEN) {
    const pode = await consumirCotaCosmos()
    if (!pode) {
      cosmosLimiteAtingido = true
    } else {
      try {
        const c = await consultarGtinCosmos(digits)
        if (c?.encontrado) {
          encontrado = true
          nome = c.nome
          marca = c.marca
          detalhe = c.detalhe
          imagem = c.imagem
          fonte = "Bluesoft Cosmos"
        }
      } catch {
        /* limite/erro do Cosmos — segue sem quebrar */
      }
    }
  }

  // 3) Base CMED (se importada) — cruza por EAN.
  const cmed = digits
    ? await prisma.cmed.findMany({
        where: { ean: digits },
        take: 5,
        select: { produto: true, apresentacao: true, laboratorio: true, pmvg: true, precoFabrica: true },
      })
    : []

  return { ean: digits, encontrado, nome, marca, detalhe, imagem, fonte, cosmosLimiteAtingido, cmed }
}

// ── Preços praticados (Compras.gov.br) ─────────────────────────
export async function consultarPrecosPraticados(params: { codigoItemCatalogo: number; pagina?: number }) {
  await assertAcesso("licitacoes")
  return _precos(params)
}

// ── PNCP Contratos / Atas ──────────────────────────────────────
export async function buscarContratos(params: { dataInicial: string; dataFinal: string; palavraChave?: string; pagina?: number }) {
  await assertAcesso("licitacoes")
  return _contratos(params)
}

export async function buscarAtas(params: { dataInicial: string; dataFinal: string; palavraChave?: string; pagina?: number }) {
  await assertAcesso("licitacoes")
  return _atas(params)
}

// ── CMED / PMVG (ANVISA) ───────────────────────────────────────
export async function getCmedStatus() {
  await assertAcesso("licitacoes")
  const total = await prisma.cmed.count()
  const ultima = await prisma.cmed.findFirst({
    orderBy: { atualizadoEm: "desc" },
    select: { competencia: true, atualizadoEm: true },
  })
  return {
    total,
    competencia: ultima?.competencia ?? null,
    atualizadoEm: ultima?.atualizadoEm ? ultima.atualizadoEm.toISOString() : null,
  }
}

export async function importarCmed(rows: CmedRow[], competencia?: string) {
  await assertAcesso("licitacoes", "edit")
  if (!rows?.length) return { total: 0 }

  // Substitui a base inteira (a lista oficial é mensal e completa).
  await prisma.cmed.deleteMany({})

  const comp = competencia?.trim() || null
  const CHUNK = 1000
  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    await prisma.cmed.createMany({
      data: slice.map((r) => ({
        substancia: r.substancia,
        laboratorio: r.laboratorio,
        produto: r.produto,
        apresentacao: r.apresentacao,
        registro: r.registro,
        ggrem: r.ggrem,
        ean: r.ean,
        classeTerapeutica: r.classeTerapeutica,
        tarja: r.tarja,
        precoFabrica: r.precoFabrica || 0,
        pmvg: r.pmvg || 0,
        precos: r.precos as any,
        competencia: comp,
      })),
    })
    total += slice.length
  }

  revalidatePath("/licitacoes/consultas")
  return { total }
}

export async function consultarCmed(termo: string) {
  await assertAcesso("licitacoes")
  const q = termo?.trim()
  if (!q || q.length < 2) return []
  const digits = q.replace(/\D/g, "")
  const rows = await prisma.cmed.findMany({
    where: {
      OR: [
        { produto: { contains: q, mode: "insensitive" } },
        { substancia: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 8 ? [{ ean: digits }] : []),
        ...(digits.length >= 6 ? [{ registro: { contains: digits } }] : []),
      ],
    },
    take: 50,
    orderBy: { produto: "asc" },
    select: {
      id: true, produto: true, apresentacao: true, substancia: true, laboratorio: true,
      ean: true, registro: true, tarja: true, classeTerapeutica: true, precoFabrica: true, pmvg: true,
    },
  })
  return rows
}
