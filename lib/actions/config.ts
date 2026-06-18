"use server"

import { prisma } from "@/lib/prisma"
import { AIConfig, Empresa, AIUsage } from "@/lib/types"
import { unstable_noStore as noStore } from "next/cache"
import { getRequesterContext, requireMaster, requireMasterOrTI } from "./users"

// Mapping Prisma Empresa to Frontend Empresa
function mapPrismaToEmpresa(dbEmpresa: any): Empresa {
  return {
    id: dbEmpresa.id,
    razaoSocial: dbEmpresa.razaoSocial,
    nomeFantasia: dbEmpresa.nomeFantasia,
    cnpj: dbEmpresa.cnpj,
    inscricaoEstadual: dbEmpresa.inscricaoEstadual || undefined,
    telefone: dbEmpresa.telefone,
    email: dbEmpresa.email,
    // Compatível com componentes que usam endereco.cep OU empresa.cep diretamente
    cep: dbEmpresa.cep,
    logradouro: dbEmpresa.logradouro,
    numero: dbEmpresa.numero,
    complemento: dbEmpresa.complemento || undefined,
    bairro: dbEmpresa.bairro,
    cidade: dbEmpresa.cidade,
    estado: dbEmpresa.estado,
    endereco: {
      cep: dbEmpresa.cep,
      logradouro: dbEmpresa.logradouro,
      numero: dbEmpresa.numero,
      complemento: dbEmpresa.complemento || undefined,
      bairro: dbEmpresa.bairro,
      cidade: dbEmpresa.cidade,
      estado: dbEmpresa.estado,
    },
    corSidebar: dbEmpresa.corSidebar || undefined,
    corPrimaria: dbEmpresa.corPrimaria || undefined,
    logoUrl: dbEmpresa.logoUrl || undefined,
  }
}

// Mapping Frontend Empresa to Prisma data
function mapEmpresaToPrisma(empresa: Partial<Empresa>) {
  const data: any = { ...empresa }
  if (empresa.endereco) {
    const { cep, logradouro, numero, complemento, bairro, cidade, estado } = empresa.endereco
    if (cep) data.cep = cep
    if (logradouro) data.logradouro = logradouro
    if (numero) data.numero = numero
    if (complemento !== undefined) data.complemento = complemento
    if (bairro) data.bairro = bairro
    if (cidade) data.cidade = cidade
    if (estado) data.estado = estado
    delete data.endereco
  }
  return data
}

// Retorna a empresa ATIVA da sessão (usada para branding/PDF por qualquer usuário).
export async function getEmpresa(): Promise<Empresa> {
  noStore()
  const ctx = await getRequesterContext()
  const dbEmpresa = await prisma.empresa.findUnique({ where: { id: ctx.empresaId } })
  if (!dbEmpresa) throw new Error("Empresa ativa não encontrada.")
  return mapPrismaToEmpresa(dbEmpresa)
}

// Atualiza dados cadastrais da empresa ATIVA (MASTER/TI). Não troca de empresa.
export async function updateEmpresa(empresa: Partial<Empresa>) {
  const ctx = await requireMasterOrTI()
  const data = mapEmpresaToPrisma(empresa)
  delete (data as any).id
  delete (data as any).modulosAtivos // módulos só pela tela de Empresas (MASTER)
  return prisma.empresa.update({ where: { id: ctx.empresaId }, data })
}

// Config de IA da empresa ATIVA. Leitura por qualquer usuário autenticado (usada no chat).
export async function getAIConfig(): Promise<AIConfig> {
  const ctx = await getRequesterContext()
  let config = await prisma.aIConfig.findUnique({ where: { empresaId: ctx.empresaId } })
  if (!config) {
    config = await prisma.aIConfig.create({
      data: {
        empresaId: ctx.empresaId,
        provider: "gemini-flash",
        apiKey: "",
        systemPrompt: "Você é o assistente inteligente, focado em ajudar na gestão de orçamentos, pedidos e produtos.",
        monthlyLimit: 500,
      },
    })
  }
  return config as unknown as AIConfig
}

// Atualiza config de IA (token/contexto) — EXCLUSIVO do MASTER.
export async function updateAIConfig(data: Partial<AIConfig>) {
  const ctx = await requireMaster()
  const update: any = {}
  if (data.provider !== undefined) update.provider = data.provider
  if (data.apiKey !== undefined) update.apiKey = data.apiKey
  if (data.systemPrompt !== undefined) update.systemPrompt = data.systemPrompt
  if (data.monthlyLimit !== undefined) update.monthlyLimit = data.monthlyLimit
  return prisma.aIConfig.upsert({
    where: { empresaId: ctx.empresaId },
    update,
    create: {
      empresaId: ctx.empresaId,
      provider: data.provider || "gemini-flash",
      apiKey: data.apiKey || "",
      systemPrompt: data.systemPrompt || "",
      monthlyLimit: data.monthlyLimit || 500,
    },
  })
}

export async function getAIUsage(): Promise<AIUsage> {
  const ctx = await getRequesterContext()
  const monthYear = new Date().toISOString().slice(0, 7)
  let usage = await prisma.aIUsage.findUnique({
    where: { empresaId_monthYear: { empresaId: ctx.empresaId, monthYear } },
  })
  if (!usage) {
    usage = await prisma.aIUsage.create({
      data: { empresaId: ctx.empresaId, monthYear, count: 0, tokensUsed: 0 },
    })
  }
  return usage as unknown as AIUsage
}

export async function incrementAIUsage(tokensUsed: number = 0): Promise<AIUsage> {
  const ctx = await getRequesterContext()
  const monthYear = new Date().toISOString().slice(0, 7)
  return (await prisma.aIUsage.upsert({
    where: { empresaId_monthYear: { empresaId: ctx.empresaId, monthYear } },
    update: { count: { increment: 1 }, tokensUsed: { increment: tokensUsed } },
    create: { empresaId: ctx.empresaId, monthYear, count: 1, tokensUsed },
  })) as unknown as AIUsage
}
