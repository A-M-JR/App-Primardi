"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { despacharChamadoDev } from "@/lib/chamados/dispatch-dev"
import { Prisma, type ChamadoStatus, type ChamadoPrioridade, type ChamadoDestino } from "@prisma/client"

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

async function nextChamadoNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `CH-${ano}-`
  const last = await prisma.chamado.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

/** Mapa id→nome para resolver solicitante/responsável/autores. */
async function nomesPorId(ids: number[]): Promise<Map<number, string>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return new Map()
  const us = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, nome: true } })
  return new Map(us.map((u) => [u.id, u.nome]))
}

// ── Listagem + KPIs ──
export interface ChamadoFiltros {
  status?: ChamadoStatus | "todos" | "abertos"
  prioridade?: ChamadoPrioridade
  departamentoId?: number
  search?: string
}

export async function getChamados(filtros?: ChamadoFiltros) {
  noStore()
  const ctx = await assertAcesso("chamados")
  const where: Prisma.ChamadoWhereInput = { empresaId: ctx.empresaId }
  if (filtros?.status === "abertos") where.status = { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO"] }
  else if (filtros?.status && filtros.status !== "todos") where.status = filtros.status
  if (filtros?.prioridade) where.prioridade = filtros.prioridade
  if (filtros?.departamentoId) where.departamentoId = filtros.departamentoId
  if (filtros?.search?.trim()) {
    where.OR = [
      { numero: { contains: filtros.search.trim(), mode: "insensitive" } },
      { titulo: { contains: filtros.search.trim(), mode: "insensitive" } },
    ]
  }

  const [rows, agregados] = await Promise.all([
    prisma.chamado.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: 100,
      include: { departamento: { select: { nome: true } }, _count: { select: { mensagens: true } } },
    }),
    prisma.chamado.groupBy({ by: ["status"], where: { empresaId: ctx.empresaId }, _count: { _all: true } }),
  ])

  const nomes = await nomesPorId(rows.flatMap((c) => [c.solicitanteUserId, c.responsavelUserId ?? 0]))
  const porStatus: Record<string, number> = {}
  for (const g of agregados) porStatus[g.status] = g._count._all
  const abertos = (porStatus.ABERTO || 0) + (porStatus.EM_ANDAMENTO || 0) + (porStatus.AGUARDANDO || 0)

  return {
    data: rows.map((c) => ({
      id: c.id,
      numero: c.numero,
      titulo: c.titulo,
      status: c.status,
      prioridade: c.prioridade,
      destino: c.destino,
      departamento: c.departamento?.nome ?? null,
      solicitante: nomes.get(c.solicitanteUserId) ?? "—",
      responsavel: c.responsavelUserId ? nomes.get(c.responsavelUserId) ?? "—" : null,
      qtdMensagens: c._count.mensagens,
      criadoEm: iso(c.criadoEm),
    })),
    kpis: {
      total: agregados.reduce((s, g) => s + g._count._all, 0),
      abertos,
      resolvidos: (porStatus.RESOLVIDO || 0) + (porStatus.FECHADO || 0),
      porStatus,
    },
  }
}

// ── Detalhe ──
export async function getChamado(id: number) {
  noStore()
  const ctx = await assertAcesso("chamados")
  const c = await prisma.chamado.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      departamento: { select: { id: true, nome: true } },
      mensagens: { orderBy: { criadoEm: "asc" } },
    },
  })
  if (!c) throw new Error("Chamado não encontrado.")

  const nomes = await nomesPorId([
    c.solicitanteUserId,
    c.responsavelUserId ?? 0,
    ...c.mensagens.map((m) => m.userId ?? 0),
  ])

  return {
    id: c.id,
    numero: c.numero,
    titulo: c.titulo,
    descricao: c.descricao,
    status: c.status,
    prioridade: c.prioridade,
    destino: c.destino,
    categoria: c.categoria,
    departamentoId: c.departamentoId,
    departamento: c.departamento,
    solicitanteUserId: c.solicitanteUserId,
    solicitante: nomes.get(c.solicitanteUserId) ?? "—",
    responsavelUserId: c.responsavelUserId,
    responsavel: c.responsavelUserId ? nomes.get(c.responsavelUserId) ?? "—" : null,
    enviadoExternoEm: iso(c.enviadoExternoEm),
    refExterna: c.refExterna,
    resolvidoEm: iso(c.resolvidoEm),
    criadoEm: iso(c.criadoEm),
    mensagens: c.mensagens.map((m) => ({
      id: m.id,
      mensagem: m.mensagem,
      interno: m.interno,
      autor: m.userId ? nomes.get(m.userId) ?? "—" : "Sistema",
      ehSolicitante: m.userId === c.solicitanteUserId,
      criadoEm: iso(m.criadoEm),
    })),
  }
}

// ── Abrir chamado ──
export interface AbrirChamadoInput {
  titulo: string
  descricao: string
  departamentoId?: number | null
  prioridade: ChamadoPrioridade
  destino: ChamadoDestino
  categoria?: string | null
}

export async function abrirChamado(input: AbrirChamadoInput) {
  const ctx = await assertAcesso("chamados")
  if (!input.titulo?.trim()) throw new Error("Informe o título.")
  if (!input.descricao?.trim()) throw new Error("Descreva o chamado.")

  const numero = await nextChamadoNumero(ctx.empresaId)
  const c = await prisma.chamado.create({
    data: {
      empresaId: ctx.empresaId,
      numero,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      departamentoId: input.departamentoId || null,
      prioridade: input.prioridade,
      destino: input.destino,
      categoria: input.categoria?.trim() || null,
      solicitanteUserId: ctx.userId,
      status: "ABERTO",
    },
  })
  revalidatePath("/chamados")
  return { id: c.id, numero: c.numero }
}

// ── Atualizar (status / prioridade / responsável / departamento) ──
export interface AtualizarChamadoInput {
  status?: ChamadoStatus
  prioridade?: ChamadoPrioridade
  responsavelUserId?: number | null
  departamentoId?: number | null
}

export async function atualizarChamado(id: number, patch: AtualizarChamadoInput) {
  const ctx = await assertAcesso("chamados", "edit")
  const c = await prisma.chamado.findFirst({ where: { id, empresaId: ctx.empresaId } })
  if (!c) throw new Error("Chamado não encontrado.")

  const data: Prisma.ChamadoUncheckedUpdateInput = {}
  if (patch.status) {
    data.status = patch.status
    data.resolvidoEm = patch.status === "RESOLVIDO" || patch.status === "FECHADO" ? new Date() : null
  }
  if (patch.prioridade) data.prioridade = patch.prioridade
  if (patch.responsavelUserId !== undefined) data.responsavelUserId = patch.responsavelUserId
  if (patch.departamentoId !== undefined) data.departamentoId = patch.departamentoId

  await prisma.chamado.update({ where: { id }, data })
  revalidatePath("/chamados")
  revalidatePath(`/chamados/${id}`)
  return { ok: true }
}

// ── Mensagem (thread) ──
export async function adicionarMensagem(chamadoId: number, mensagem: string, interno = false) {
  const ctx = await assertAcesso("chamados")
  if (!mensagem?.trim()) throw new Error("Mensagem vazia.")
  const c = await prisma.chamado.findFirst({ where: { id: chamadoId, empresaId: ctx.empresaId } })
  if (!c) throw new Error("Chamado não encontrado.")

  await prisma.$transaction([
    prisma.chamadoMensagem.create({
      data: { chamadoId, userId: ctx.userId, mensagem: mensagem.trim(), interno },
    }),
    // Reabre/anda o chamado quando há nova interação (se estava só aberto).
    prisma.chamado.update({
      where: { id: chamadoId },
      data: c.status === "ABERTO" ? { status: "EM_ANDAMENTO" } : {},
    }),
  ])
  revalidatePath(`/chamados/${chamadoId}`)
  return { ok: true }
}

// ── Despacho aos desenvolvedores da plataforma (endpoint externo) ──
export async function enviarChamadoDev(id: number) {
  const ctx = await assertAcesso("chamados", "edit")
  const c = await prisma.chamado.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: { empresa: { select: { nomeFantasia: true } } },
  })
  if (!c) throw new Error("Chamado não encontrado.")
  const nomes = await nomesPorId([c.solicitanteUserId])

  const res = await despacharChamadoDev({
    numero: c.numero,
    titulo: c.titulo,
    descricao: c.descricao,
    prioridade: c.prioridade,
    categoria: c.categoria,
    empresa: c.empresa.nomeFantasia,
    solicitante: nomes.get(c.solicitanteUserId) ?? "—",
  })

  if (res.ok) {
    await prisma.chamado.update({
      where: { id },
      data: { destino: "DESENVOLVEDOR", enviadoExternoEm: new Date(), refExterna: res.refExterna ?? null },
    })
    revalidatePath(`/chamados/${id}`)
  }
  return res
}
