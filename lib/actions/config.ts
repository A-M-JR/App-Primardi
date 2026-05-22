"use server"

import { prisma } from "@/lib/prisma"
import { AIConfig, Empresa, AIUsage } from "@/lib/types"
import { unstable_noStore as noStore } from "next/cache"

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

export async function getEmpresa(): Promise<Empresa> {
  noStore()
  try {
    let dbEmpresa = await prisma.empresa.findFirst()
    if (!dbEmpresa) {
      dbEmpresa = await prisma.empresa.create({
        data: {
          razaoSocial: "M F LABELS INDUSTRIA GRAFICA LTDA",
          nomeFantasia: "Primardi",
          cnpj: "18.330.143/0001-38",
          telefone: "(62) 3142-9993",
          email: "contato@newflexo.com",
          cep: "74474-046",
          logradouro: "R Jg 17",
          numero: "S/N",
          bairro: "Jardim Guanabara II",
          cidade: "Goiânia",
          estado: "GO",
          corSidebar: "#0f264a",
        },
      })
    }
    return mapPrismaToEmpresa(dbEmpresa)
  } catch (error) {
    console.error("Error in getEmpresa:", error)
    throw error
  }
}

export async function updateEmpresa(empresa: Partial<Empresa>) {
  try {
    const dbEmpresa = await prisma.empresa.findFirst()
    const data = mapEmpresaToPrisma(empresa)
    
    if (!dbEmpresa) {
      return prisma.empresa.create({ data })
    }
    
    return prisma.empresa.update({
      where: { id: dbEmpresa.id },
      data,
    })
  } catch (error) {
    console.error("Error in updateEmpresa:", error)
    throw error
  }
}

export async function getAIConfig(): Promise<AIConfig> {
  try {
    let config = await prisma.aIConfig.findFirst()
    if (!config) {
      // Busca a empresa para obter o empresaId obrigatório
      const empresa = await prisma.empresa.findFirst()
      if (!empresa) throw new Error("Nenhuma empresa cadastrada. Execute o seed primeiro.")
      config = await prisma.aIConfig.create({
        data: {
          empresaId: empresa.id,
          provider: "gemini-flash",
          apiKey: "",
          systemPrompt: "Você é o assistente inteligente da Primardi, focado em ajudar na gestão de orçamentos, pedidos e produtos.",
          monthlyLimit: 500,
        },
      })
    }
    return config as unknown as AIConfig
  } catch (error) {
    console.error("Error in getAIConfig:", error)
    throw error
  }
}

export async function updateAIConfig(data: Partial<AIConfig>) {
  try {
    const config = await prisma.aIConfig.findFirst()
    if (!config) {
      const empresa = await prisma.empresa.findFirst()
      if (!empresa) throw new Error("Nenhuma empresa cadastrada. Execute o seed primeiro.")
      return prisma.aIConfig.create({ 
        data: {
          empresaId: empresa.id,
          provider: data.provider || "gemini-flash",
          apiKey: data.apiKey || "",
          systemPrompt: data.systemPrompt || "",
          monthlyLimit: data.monthlyLimit || 500
        } 
      })
    }
    return prisma.aIConfig.update({
      where: { id: config.id },
      data: data as any,
    })
  } catch (error) {
    console.error("Error in updateAIConfig:", error)
    throw error
  }
}

export async function getAIUsage(): Promise<AIUsage> {
  try {
    const empresa = await prisma.empresa.findFirst()
    if (!empresa) throw new Error("Nenhuma empresa cadastrada.")
    const monthYear = new Date().toISOString().slice(0, 7)
    // unique key agora é [empresaId, monthYear]
    let usage = await prisma.aIUsage.findUnique({
      where: { empresaId_monthYear: { empresaId: empresa.id, monthYear } }
    })
    
    if (!usage) {
      usage = await prisma.aIUsage.create({
        data: {
          empresaId: empresa.id,
          monthYear,
          count: 0,
          tokensUsed: 0
        }
      })
    }
    return usage as unknown as AIUsage
  } catch (error) {
    console.error("Error in getAIUsage:", error)
    throw error
  }
}

export async function incrementAIUsage(tokensUsed: number = 0): Promise<AIUsage> {
  try {
    const empresa = await prisma.empresa.findFirst()
    if (!empresa) throw new Error("Nenhuma empresa cadastrada.")
    const monthYear = new Date().toISOString().slice(0, 7)
    return await prisma.aIUsage.upsert({
      where: { empresaId_monthYear: { empresaId: empresa.id, monthYear } },
      update: {
        count: { increment: 1 },
        tokensUsed: { increment: tokensUsed }
      },
      create: {
        empresaId: empresa.id,
        monthYear,
        count: 1,
        tokensUsed
      }
    }) as unknown as AIUsage
  } catch (error) {
    console.error("Error in incrementAIUsage:", error)
    throw error
  }
}
