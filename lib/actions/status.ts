"use server"

import { prisma } from "@/lib/prisma"
import { ModuloStatus } from "@prisma/client"

export async function getOrCreateStatus(empresaId: number, nome: string, modulo: ModuloStatus = ModuloStatus.PEDIDO) {
  // Tradução de texto para nome real no banco se necessário
  let searchName = nome
  if (nome === 'em_analise') searchName = 'Em Análise'
  if (nome === 'em_producao') searchName = 'Em Produção'
  if (nome === 'separacao') searchName = 'Separação'
  if (nome === 'entregue') searchName = 'Entregue'
  if (nome === 'aprovado' || nome === 'fechado') searchName = 'Aprovado'

  const status = await prisma.status.findFirst({
    where: { 
      empresaId,
      modulo: modulo,
      nome: { contains: searchName, mode: 'insensitive' } 
    }
  })

  if (status) return status.id

  // Fallback se não encontrar (cria um padrão para não quebrar o sistema)
  const count = await prisma.status.count({ where: { empresaId, modulo: modulo } })
  const created = await prisma.status.create({
    data: {
      empresaId,
      nome: searchName,
      modulo: modulo,
      ordem: count + 1,
      cor: modulo === ModuloStatus.ORCAMENTO ? '#10b981' : '#94a3b8'
    }
  })
  return created.id
}
