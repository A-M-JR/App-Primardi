"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export interface DepartamentoInput {
  id?: number
  nome: string
  descricao?: string | null
  ativo: boolean
  userIds: number[]
}

/** Lista departamentos da empresa com seus usuários e nº de chamados. */
export async function getDepartamentos() {
  noStore()
  const ctx = await assertAcesso("chamados")
  const rows = await prisma.departamento.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: { nome: "asc" },
    include: {
      usuarios: { include: { user: { select: { id: true, nome: true } } } },
      _count: { select: { chamados: true } },
    },
  })
  return rows.map((d) => ({
    id: d.id,
    nome: d.nome,
    descricao: d.descricao,
    ativo: d.ativo,
    qtdChamados: d._count.chamados,
    usuarios: d.usuarios.map((u) => ({ id: u.user.id, nome: u.user.nome })),
  }))
}

/** Usuários com vínculo na empresa ativa (para vincular a departamentos / atribuir chamados). */
export async function getUsuariosDaEmpresa() {
  noStore()
  const ctx = await assertAcesso("chamados")
  return prisma.user.findMany({
    where: { ativo: true, memberships: { some: { empresaId: ctx.empresaId } } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true },
  })
}

export async function salvarDepartamento(input: DepartamentoInput) {
  const ctx = await assertAcesso("chamados", "edit")
  if (!input.nome?.trim()) throw new Error("Informe o nome do departamento.")

  const id = await prisma.$transaction(async (tx) => {
    let depId = input.id
    if (depId) {
      const existe = await tx.departamento.findFirst({ where: { id: depId, empresaId: ctx.empresaId } })
      if (!existe) throw new Error("Departamento não encontrado.")
      await tx.departamento.update({
        where: { id: depId },
        data: { nome: input.nome.trim(), descricao: input.descricao?.trim() || null, ativo: input.ativo },
      })
    } else {
      const criado = await tx.departamento.create({
        data: { empresaId: ctx.empresaId, nome: input.nome.trim(), descricao: input.descricao?.trim() || null, ativo: input.ativo },
      })
      depId = criado.id
    }
    // Sincroniza vínculos de usuários (valida que pertencem à empresa).
    await tx.departamentoUsuario.deleteMany({ where: { departamentoId: depId } })
    const validos = input.userIds.length
      ? await tx.user.findMany({
          where: { id: { in: input.userIds }, memberships: { some: { empresaId: ctx.empresaId } } },
          select: { id: true },
        })
      : []
    if (validos.length) {
      await tx.departamentoUsuario.createMany({
        data: validos.map((u) => ({ departamentoId: depId!, userId: u.id })),
      })
    }
    return depId!
  })

  revalidatePath("/departamentos")
  return { id }
}

export async function excluirDepartamento(id: number) {
  const ctx = await assertAcesso("chamados", "edit")
  await prisma.departamento.deleteMany({ where: { id, empresaId: ctx.empresaId } })
  revalidatePath("/departamentos")
  return { ok: true }
}

/** Departamentos ativos (para selects de abertura/roteamento de chamado). */
export async function getDepartamentosAtivos() {
  noStore()
  const ctx = await assertAcesso("chamados")
  return prisma.departamento.findMany({
    where: { empresaId: ctx.empresaId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  })
}
