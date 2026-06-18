"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import type { TipoAtividadeCliente } from "@prisma/client"

export interface AtividadeCliente {
  id: number
  tipo: TipoAtividadeCliente
  descricao: string
  proximoContato: string | null
  concluida: boolean
  criadoEm: string
  responsavel: string | null
}

/** Recalcula o "próximo retorno" do cliente = atividade aberta mais próxima. */
async function recalcularProximoContato(clienteId: number) {
  const aberta = await prisma.clienteAtividade.findFirst({
    where: { clienteId, concluida: false, proximoContato: { not: null } },
    orderBy: { proximoContato: "asc" },
    select: { proximoContato: true },
  })
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { proximoContato: aberta?.proximoContato ?? null },
  })
}

/** Carrega o CRM do cliente: campos de funil, atividades e etapas disponíveis. */
export async function getClienteCrm(clienteId: number) {
  noStore()
  const ctx = await getRequesterContext()

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: ctx.empresaId },
    select: { id: true, temperatura: true, funilStatusId: true, proximoContato: true },
  })
  if (!cliente) throw new Error("Cliente não encontrado.")

  const [atividadesDb, funis] = await Promise.all([
    prisma.clienteAtividade.findMany({
      where: { clienteId, empresaId: ctx.empresaId },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
    prisma.funilStatus.findMany({
      where: { empresaId: ctx.empresaId, ativo: true },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, cor: true },
    }),
  ])

  const userIds = [...new Set(atividadesDb.map((a) => a.criadoPorUserId).filter((x): x is number => x != null))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } })
    : []
  const nomePorUser = new Map(users.map((u) => [u.id, u.nome]))

  const atividades: AtividadeCliente[] = atividadesDb.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    descricao: a.descricao,
    proximoContato: a.proximoContato ? a.proximoContato.toISOString() : null,
    concluida: a.concluida,
    criadoEm: a.criadoEm.toISOString(),
    responsavel: a.criadoPorUserId ? nomePorUser.get(a.criadoPorUserId) ?? null : null,
  }))

  return {
    temperatura: cliente.temperatura,
    funilStatusId: cliente.funilStatusId,
    proximoContato: cliente.proximoContato ? cliente.proximoContato.toISOString() : null,
    atividades,
    funis,
  }
}

export interface RetornoAgenda {
  atividadeId: number
  tipo: TipoAtividadeCliente
  descricao: string
  proximoContato: string
  cliente: {
    id: number
    razaoSocial: string
    telefone: string | null
    temperatura: string | null
    etapa: string | null
    etapaCor: string | null
  }
}

/** Agenda de retornos: atividades em aberto com follow-up agendado (vencidos + próximos). */
export async function getAgendaRetornos(): Promise<RetornoAgenda[]> {
  noStore()
  const ctx = await getRequesterContext()
  const horizonte = new Date()
  horizonte.setDate(horizonte.getDate() + 30)
  horizonte.setHours(23, 59, 59, 999)

  const rows = await prisma.clienteAtividade.findMany({
    where: {
      empresaId: ctx.empresaId,
      concluida: false,
      proximoContato: { not: null, lte: horizonte },
    },
    orderBy: { proximoContato: "asc" },
    take: 300,
    include: {
      cliente: {
        select: {
          id: true,
          razaoSocial: true,
          telefone: true,
          temperatura: true,
          funilStatus: { select: { nome: true, cor: true } },
        },
      },
    },
  })

  return rows.map((r) => ({
    atividadeId: r.id,
    tipo: r.tipo,
    descricao: r.descricao,
    proximoContato: (r.proximoContato as Date).toISOString(),
    cliente: {
      id: r.cliente.id,
      razaoSocial: r.cliente.razaoSocial,
      telefone: r.cliente.telefone,
      temperatura: r.cliente.temperatura,
      etapa: r.cliente.funilStatus?.nome ?? null,
      etapaCor: r.cliente.funilStatus?.cor ?? null,
    },
  }))
}

/** Conta retornos pendentes (vencidos + hoje) — usado para o badge do menu. */
export async function contarRetornosPendentes(): Promise<number> {
  noStore()
  const ctx = await getRequesterContext()
  const fimHoje = new Date()
  fimHoje.setHours(23, 59, 59, 999)
  return prisma.clienteAtividade.count({
    where: {
      empresaId: ctx.empresaId,
      concluida: false,
      proximoContato: { not: null, lte: fimHoje },
    },
  })
}

export async function registrarAtividade(input: {
  clienteId: number
  tipo: TipoAtividadeCliente
  descricao: string
  proximoContato?: string | null
}) {
  const ctx = await getRequesterContext()
  if (!input.descricao?.trim()) throw new Error("Descreva a atividade.")

  await prisma.clienteAtividade.create({
    data: {
      empresaId: ctx.empresaId,
      clienteId: input.clienteId,
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      criadoPorUserId: ctx.userId,
      proximoContato: input.proximoContato ? new Date(input.proximoContato) : null,
    },
  })

  await recalcularProximoContato(input.clienteId)
  revalidatePath(`/clientes/${input.clienteId}`)
  return { ok: true }
}

export async function concluirAtividade(atividadeId: number) {
  const ctx = await getRequesterContext()
  const at = await prisma.clienteAtividade.findFirst({
    where: { id: atividadeId, empresaId: ctx.empresaId },
    select: { clienteId: true },
  })
  if (!at) throw new Error("Atividade não encontrada.")

  await prisma.clienteAtividade.update({ where: { id: atividadeId }, data: { concluida: true } })
  await recalcularProximoContato(at.clienteId)
  revalidatePath(`/clientes/${at.clienteId}`)
  return { ok: true }
}

export async function atualizarCrmCliente(
  clienteId: number,
  data: { temperatura?: string | null; funilStatusId?: number | null }
) {
  const ctx = await getRequesterContext()
  await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      ...(data.temperatura !== undefined ? { temperatura: data.temperatura } : {}),
      ...(data.funilStatusId !== undefined ? { funilStatusId: data.funilStatusId } : {}),
    },
  })
  // garante escopo de empresa
  const ok = await prisma.cliente.count({ where: { id: clienteId, empresaId: ctx.empresaId } })
  if (!ok) throw new Error("Cliente não encontrado.")
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}
