"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { STATUS_COM_SALDO } from "@/lib/licitacoes/constants"
import { Prisma, type StatusEmpenho } from "@prisma/client"

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
const toDate = (v?: string | null) => (v ? new Date(v) : null)

// ─────────────────────────────────────────────
// Painel de saldo de contratos/atas
// ─────────────────────────────────────────────

export interface FaturamentoFiltros {
  search?: string
  uf?: string
  vencendo?: boolean // só contratos com vigência expirando em 60 dias
  comSaldo?: boolean // só contratos com saldo > 0
}

export async function getPainelFaturamento(filtros?: FaturamentoFiltros) {
  noStore()
  const ctx = await assertAcesso("faturamento")
  const search = filtros?.search?.trim()

  const where: Prisma.LicitacaoWhereInput = {
    empresaId: ctx.empresaId,
    status: { in: STATUS_COM_SALDO },
  }
  if (filtros?.uf) where.orgaoUf = filtros.uf
  if (search) {
    where.OR = [
      { objeto: { contains: search, mode: "insensitive" } },
      { orgaoNome: { contains: search, mode: "insensitive" } },
      { numeroAta: { contains: search, mode: "insensitive" } },
      { numeroContrato: { contains: search, mode: "insensitive" } },
    ]
  }

  const contratos = await prisma.licitacao.findMany({
    where,
    orderBy: [{ vigenciaFim: "asc" }, { criadoEm: "desc" }],
    include: {
      itens: {
        select: {
          id: true,
          quantidade: true,
          precoUnitario: true,
          empenhoItens: {
            select: { quantidade: true, total: true, empenho: { select: { status: true } } },
          },
        },
      },
    },
  })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  let valorContratadoTotal = 0
  let valorFaturadoTotal = 0
  let vencendo60 = 0

  let lista = contratos.map((c) => {
    let valorContratado = 0
    let valorFaturado = 0
    let itensComSaldo = 0
    for (const it of c.itens) {
      valorContratado += it.quantidade * it.precoUnitario
      const ativos = it.empenhoItens.filter((ei) => ei.empenho.status !== "CANCELADO")
      const fatQtd = ativos.reduce((s, ei) => s + ei.quantidade, 0)
      valorFaturado += ativos.reduce((s, ei) => s + ei.total, 0)
      if (it.quantidade - fatQtd > 0.0001) itensComSaldo++
    }
    const saldo = valorContratado - valorFaturado
    const diasParaVencer = c.vigenciaFim
      ? Math.ceil((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000)
      : null

    valorContratadoTotal += valorContratado
    valorFaturadoTotal += valorFaturado
    if (diasParaVencer !== null && diasParaVencer >= 0 && diasParaVencer <= 60) vencendo60++

    return {
      id: c.id,
      objeto: c.objeto,
      orgaoNome: c.orgaoNome,
      orgaoUf: c.orgaoUf,
      numeroAta: c.numeroAta,
      numeroContrato: c.numeroContrato,
      status: c.status,
      vigenciaFim: iso(c.vigenciaFim),
      diasParaVencer,
      qtdItens: c.itens.length,
      itensComSaldo,
      valorContratado,
      valorFaturado,
      saldo,
      percExecutado: valorContratado > 0 ? (valorFaturado / valorContratado) * 100 : 0,
    }
  })

  if (filtros?.comSaldo) lista = lista.filter((c) => c.saldo > 0.0001)
  if (filtros?.vencendo)
    lista = lista.filter((c) => c.diasParaVencer !== null && c.diasParaVencer >= 0 && c.diasParaVencer <= 60)

  return {
    contratos: lista,
    kpis: {
      contratos: lista.length,
      valorContratado: valorContratadoTotal,
      valorFaturado: valorFaturadoTotal,
      saldo: valorContratadoTotal - valorFaturadoTotal,
      percExecutado: valorContratadoTotal > 0 ? (valorFaturadoTotal / valorContratadoTotal) * 100 : 0,
      vencendo60,
    },
  }
}

// ─────────────────────────────────────────────
// Itens de um contrato (com saldo) — para o dialog de empenho
// ─────────────────────────────────────────────

export async function getContratoParaFaturar(licitacaoId: number) {
  noStore()
  const ctx = await assertAcesso("faturamento")
  const lic = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, empresaId: ctx.empresaId },
    include: {
      itens: {
        orderBy: { id: "asc" },
        include: {
          empenhoItens: { select: { quantidade: true, empenho: { select: { status: true } } } },
        },
      },
    },
  })
  if (!lic) throw new Error("Contrato não encontrado.")

  return {
    id: lic.id,
    objeto: lic.objeto,
    orgaoNome: lic.orgaoNome,
    numeroAta: lic.numeroAta,
    numeroContrato: lic.numeroContrato,
    vigenciaFim: iso(lic.vigenciaFim),
    itens: lic.itens.map((it) => {
      const fatQtd = it.empenhoItens
        .filter((ei) => ei.empenho.status !== "CANCELADO")
        .reduce((s, ei) => s + ei.quantidade, 0)
      return {
        id: it.id,
        descricao: it.descricao,
        marca: it.marca,
        unidade: it.unidade,
        numeroItem: it.numeroItem,
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitario,
        saldoQtd: it.quantidade - fatQtd,
      }
    }),
  }
}

// ─────────────────────────────────────────────
// Listagem de empenhos
// ─────────────────────────────────────────────

export async function getEmpenhos(filtros?: { search?: string; status?: StatusEmpenho | "todos" }) {
  noStore()
  const ctx = await assertAcesso("faturamento")
  const search = filtros?.search?.trim()
  const where: Prisma.EmpenhoWhereInput = { empresaId: ctx.empresaId }
  if (filtros?.status && filtros.status !== "todos") where.status = filtros.status
  if (search) {
    where.OR = [
      { numero: { contains: search, mode: "insensitive" } },
      { numeroNotaFiscal: { contains: search, mode: "insensitive" } },
      { licitacao: { orgaoNome: { contains: search, mode: "insensitive" } } },
      { licitacao: { objeto: { contains: search, mode: "insensitive" } } },
    ]
  }

  const rows = await prisma.empenho.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      licitacao: { select: { id: true, orgaoNome: true, objeto: true, numeroContrato: true, numeroAta: true } },
      _count: { select: { itens: true } },
    },
  })

  return rows.map((e) => ({
    id: e.id,
    numero: e.numero,
    numeroNotaFiscal: e.numeroNotaFiscal,
    status: e.status,
    dataEmpenho: iso(e.dataEmpenho),
    prazoEntrega: iso(e.prazoEntrega),
    dataEntrega: iso(e.dataEntrega),
    valorTotal: e.valorTotal,
    qtdItens: e._count.itens,
    licitacao: e.licitacao,
  }))
}

export async function getEmpenho(id: number) {
  noStore()
  const ctx = await assertAcesso("faturamento")
  const e = await prisma.empenho.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      licitacao: { select: { id: true, orgaoNome: true, objeto: true, numeroContrato: true, numeroAta: true } },
      itens: { include: { licitacaoItem: { select: { descricao: true, unidade: true, numeroItem: true } } } },
    },
  })
  if (!e) throw new Error("Empenho não encontrado.")
  return {
    id: e.id,
    licitacaoId: e.licitacaoId,
    numero: e.numero,
    numeroNotaFiscal: e.numeroNotaFiscal,
    status: e.status,
    dataEmpenho: iso(e.dataEmpenho),
    prazoEntrega: iso(e.prazoEntrega),
    dataEntrega: iso(e.dataEntrega),
    valorTotal: e.valorTotal,
    observacoes: e.observacoes,
    licitacao: e.licitacao,
    itens: e.itens.map((i) => ({
      id: i.id,
      licitacaoItemId: i.licitacaoItemId,
      descricao: i.licitacaoItem.descricao,
      unidade: i.licitacaoItem.unidade,
      numeroItem: i.licitacaoItem.numeroItem,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      total: i.total,
    })),
  }
}

// ─────────────────────────────────────────────
// Criar / atualizar empenho (com baixa de saldo)
// ─────────────────────────────────────────────

export interface EmpenhoItemInput {
  licitacaoItemId: number
  quantidade: number
  precoUnitario: number
}

export interface EmpenhoInput {
  id?: number
  licitacaoId: number
  numero?: string | null
  numeroNotaFiscal?: string | null
  status: StatusEmpenho
  dataEmpenho?: string | null
  prazoEntrega?: string | null
  dataEntrega?: string | null
  observacoes?: string | null
  itens: EmpenhoItemInput[]
}

async function nextEmpenhoNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `EMP-${ano}-`
  const last = await prisma.empenho.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

export async function salvarEmpenho(input: EmpenhoInput) {
  const ctx = await assertAcesso("faturamento", "edit")

  const lic = await prisma.licitacao.findFirst({
    where: { id: input.licitacaoId, empresaId: ctx.empresaId },
    include: {
      itens: {
        select: {
          id: true,
          descricao: true,
          quantidade: true,
          empenhoItens: {
            select: { quantidade: true, empenhoId: true, empenho: { select: { status: true } } },
          },
        },
      },
    },
  })
  if (!lic) throw new Error("Contrato não encontrado.")

  const itens = (input.itens || []).filter((i) => i.licitacaoItemId && i.quantidade > 0)
  if (itens.length === 0) throw new Error("Inclua pelo menos um item com quantidade.")

  // Valida saldo (ignora o próprio empenho ao editar; cancelado não consome).
  if (input.status !== "CANCELADO") {
    const mapItem = new Map(lic.itens.map((it) => [it.id, it]))
    for (const i of itens) {
      const it = mapItem.get(i.licitacaoItemId)
      if (!it) throw new Error("Item não pertence a este contrato.")
      const consumido = it.empenhoItens
        .filter((ei) => ei.empenho.status !== "CANCELADO" && ei.empenhoId !== input.id)
        .reduce((s, ei) => s + ei.quantidade, 0)
      const saldo = it.quantidade - consumido
      if (i.quantidade > saldo + 0.0001) {
        throw new Error(
          `Saldo insuficiente em "${it.descricao}": disponível ${saldo}, solicitado ${i.quantidade}.`
        )
      }
    }
  }

  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)

  const dados = {
    numeroNotaFiscal: input.numeroNotaFiscal?.trim() || null,
    status: input.status,
    dataEmpenho: toDate(input.dataEmpenho),
    prazoEntrega: toDate(input.prazoEntrega),
    dataEntrega: toDate(input.dataEntrega),
    valorTotal,
    observacoes: input.observacoes?.trim() || null,
  }

  const id = await prisma.$transaction(async (tx) => {
    let empId = input.id
    if (empId) {
      const existe = await tx.empenho.findFirst({ where: { id: empId, empresaId: ctx.empresaId } })
      if (!existe) throw new Error("Empenho não encontrado.")
      await tx.empenho.update({ where: { id: empId }, data: dados })
      await tx.empenhoItem.deleteMany({ where: { empenhoId: empId } })
    } else {
      const numero = input.numero?.trim() || (await nextEmpenhoNumero(ctx.empresaId))
      const criado = await tx.empenho.create({
        data: {
          ...dados,
          numero,
          empresaId: ctx.empresaId,
          licitacaoId: input.licitacaoId,
          criadoPorUserId: ctx.userId,
        },
      })
      empId = criado.id
    }
    if (input.id && input.numero?.trim()) {
      await tx.empenho.update({ where: { id: empId }, data: { numero: input.numero.trim() } })
    }
    await tx.empenhoItem.createMany({
      data: itens.map((i) => ({
        empenhoId: empId!,
        licitacaoItemId: i.licitacaoItemId,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        total: i.quantidade * i.precoUnitario,
      })),
    })
    return empId!
  })

  revalidatePath("/faturamento")
  revalidatePath(`/licitacoes/${input.licitacaoId}`)
  return { id }
}

export async function atualizarStatusEmpenho(id: number, status: StatusEmpenho) {
  const ctx = await assertAcesso("faturamento", "edit")
  const emp = await prisma.empenho.findFirst({ where: { id, empresaId: ctx.empresaId } })
  if (!emp) throw new Error("Empenho não encontrado.")
  await prisma.empenho.update({ where: { id }, data: { status } })
  revalidatePath("/faturamento")
  revalidatePath(`/licitacoes/${emp.licitacaoId}`)
  return { ok: true }
}

export async function excluirEmpenho(id: number) {
  const ctx = await assertAcesso("faturamento", "edit")
  const emp = await prisma.empenho.findFirst({ where: { id, empresaId: ctx.empresaId } })
  if (!emp) throw new Error("Empenho não encontrado.")
  await prisma.empenho.delete({ where: { id } })
  revalidatePath("/faturamento")
  revalidatePath(`/licitacoes/${emp.licitacaoId}`)
  return { ok: true }
}
