"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import type { DevedorParsed } from "@/lib/cobranca/parse-bordero"

/**
 * Importa um borderô (snapshot dos títulos em aberto). Substitui os títulos
 * atuais da empresa, mantém os devedores (e o telefone já preenchido).
 */
export async function importarBordero(devedores: DevedorParsed[]) {
  const ctx = await getRequesterContext()
  const empresaId = ctx.empresaId

  // Snapshot: limpa títulos atuais (o borderô representa o que está em aberto hoje).
  await prisma.cobrancaTitulo.deleteMany({ where: { empresaId } })

  let totalDevedores = 0
  let totalTitulos = 0

  for (const d of devedores) {
    const dev = await prisma.devedor.upsert({
      where: { empresaId_codigoExterno: { empresaId, codigoExterno: d.codigoExterno } },
      update: { nome: d.nome, cidade: d.cidade || null },
      create: { empresaId, codigoExterno: d.codigoExterno, nome: d.nome, cidade: d.cidade || null },
    })
    totalDevedores++
    if (d.titulos.length) {
      await prisma.cobrancaTitulo.createMany({
        data: d.titulos.map((t) => ({
          empresaId,
          devedorId: dev.id,
          tipo: t.tipo,
          numero: t.numero,
          portador: t.portador,
          emissao: t.emissao ? new Date(t.emissao) : null,
          vencimento: t.vencimento ? new Date(t.vencimento) : null,
          valor: t.valor,
          saldo: t.saldo,
          jurosMulta: t.jurosMulta,
          total: t.total,
          prazo: t.prazo,
        })),
      })
      totalTitulos += d.titulos.length
    }
  }

  revalidatePath("/cobranca")
  return { totalDevedores, totalTitulos }
}

export interface DevedorPainel {
  id: number
  nome: string
  cidade: string | null
  telefone: string | null
  qtdTitulos: number
  total: number
  totalVencido: number
  qtdVencidos: number
  vencimentoMaisAntigo: string | null
}

export async function getCobrancaPainel() {
  noStore()
  const ctx = await getRequesterContext()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const devedores = await prisma.devedor.findMany({
    where: { empresaId: ctx.empresaId, titulos: { some: {} } },
    include: { titulos: { select: { total: true, vencimento: true } } },
    orderBy: { nome: "asc" },
  })

  let totalReceber = 0
  let totalVencidoGeral = 0

  const lista: DevedorPainel[] = devedores.map((d) => {
    let total = 0
    let totalVencido = 0
    let qtdVencidos = 0
    let maisAntigo: Date | null = null
    for (const t of d.titulos) {
      total += t.total
      if (t.vencimento && t.vencimento < hoje) {
        totalVencido += t.total
        qtdVencidos++
        if (!maisAntigo || t.vencimento < maisAntigo) maisAntigo = t.vencimento
      }
    }
    totalReceber += total
    totalVencidoGeral += totalVencido
    return {
      id: d.id,
      nome: d.nome,
      cidade: d.cidade,
      telefone: d.telefone,
      qtdTitulos: d.titulos.length,
      total,
      totalVencido,
      qtdVencidos,
      vencimentoMaisAntigo: maisAntigo ? maisAntigo.toISOString() : null,
    }
  })

  return {
    devedores: lista,
    kpis: {
      devedores: lista.length,
      totalReceber,
      totalVencido: totalVencidoGeral,
      comVencidos: lista.filter((d) => d.qtdVencidos > 0).length,
    },
  }
}

export async function getTitulosDevedor(devedorId: number) {
  noStore()
  const ctx = await getRequesterContext()
  const titulos = await prisma.cobrancaTitulo.findMany({
    where: { devedorId, empresaId: ctx.empresaId },
    orderBy: { vencimento: "asc" },
  })
  return titulos.map((t) => ({
    id: t.id,
    numero: t.numero,
    emissao: t.emissao ? t.emissao.toISOString() : null,
    vencimento: t.vencimento ? t.vencimento.toISOString() : null,
    total: t.total,
    saldo: t.saldo,
  }))
}

export async function salvarTelefoneDevedor(devedorId: number, telefone: string) {
  const ctx = await getRequesterContext()
  await prisma.devedor.updateMany({
    where: { id: devedorId, empresaId: ctx.empresaId },
    data: { telefone: telefone.trim() || null },
  })
  revalidatePath("/cobranca")
  return { ok: true }
}
