"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import { requireMaster, requireMasterOrTI } from "./users"
import { MODULO_IDS } from "@/lib/modules"
import { removerR2PorUrl } from "@/lib/storage/r2"

export interface EmpresaInput {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual?: string | null
  telefone?: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string | null
  bairro?: string
  cidade?: string
  estado?: string
  corSidebar?: string | null
  corPrimaria?: string | null
  logoUrl?: string | null
}

/** Lista todas as empresas (administração — MASTER/TI). */
export async function listarEmpresas() {
  noStore()
  await requireMasterOrTI()
  return prisma.empresa.findMany({
    orderBy: { nomeFantasia: "asc" },
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      cidade: true,
      estado: true,
      modulosAtivos: true,
      criadoEm: true,
      _count: { select: { userEmpresas: true } },
    },
  })
}

export async function getEmpresaById(id: number) {
  noStore()
  await requireMasterOrTI()
  return prisma.empresa.findUnique({ where: { id: Number(id) } })
}

/** Normaliza os campos de cadastro; aplica defaults para colunas obrigatórias. */
function toPrismaData(input: EmpresaInput) {
  return {
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia,
    cnpj: input.cnpj,
    inscricaoEstadual: input.inscricaoEstadual ?? null,
    telefone: input.telefone ?? "",
    email: input.email ?? "",
    cep: input.cep ?? "",
    logradouro: input.logradouro ?? "",
    numero: input.numero ?? "",
    complemento: input.complemento ?? null,
    bairro: input.bairro ?? "",
    cidade: input.cidade ?? "",
    estado: input.estado ?? "",
    corSidebar: input.corSidebar ?? null,
    corPrimaria: input.corPrimaria ?? null,
    logoUrl: input.logoUrl ?? null,
  }
}

/** Cria empresa (MASTER/TI). Novas empresas nascem sem módulos ativos. */
export async function criarEmpresa(input: EmpresaInput) {
  await requireMasterOrTI()
  const empresa = await prisma.empresa.create({
    data: { ...toPrismaData(input), modulosAtivos: [] },
  })
  revalidatePath("/empresas")
  return empresa
}

/** Atualiza dados cadastrais (MASTER/TI). NÃO altera módulos ativos aqui. */
export async function atualizarEmpresa(id: number, input: EmpresaInput) {
  await requireMasterOrTI()
  const atual = await prisma.empresa.findUnique({ where: { id: Number(id) }, select: { logoUrl: true } })
  const empresa = await prisma.empresa.update({
    where: { id: Number(id) },
    data: toPrismaData(input),
  })
  // Remove a logo antiga do R2 quando foi trocada (ignora se não for URL do R2).
  if (atual?.logoUrl && atual.logoUrl !== (input.logoUrl ?? null)) {
    await removerR2PorUrl(atual.logoUrl)
  }
  revalidatePath("/empresas")
  return empresa
}

/** Exclui empresa (MASTER/TI). Cascata remove vínculos e dados da empresa. */
export async function excluirEmpresa(id: number) {
  await requireMasterOrTI()
  const atual = await prisma.empresa.findUnique({ where: { id: Number(id) }, select: { logoUrl: true } })
  await prisma.empresa.delete({ where: { id: Number(id) } })
  if (atual?.logoUrl) await removerR2PorUrl(atual.logoUrl)
  revalidatePath("/empresas")
  return { ok: true }
}

/**
 * Define os módulos ativos de uma empresa — EXCLUSIVO do MASTER.
 * Valida contra o catálogo de módulos (lib/modules.ts).
 */
export async function atualizarModulosAtivos(id: number, modulos: string[]) {
  await requireMaster()
  const validos = modulos.filter((m) => (MODULO_IDS as string[]).includes(m))
  const empresa = await prisma.empresa.update({
    where: { id: Number(id) },
    data: { modulosAtivos: validos },
  })
  revalidatePath("/empresas")
  revalidatePath("/")
  return empresa
}
