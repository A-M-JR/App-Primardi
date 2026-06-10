import { prisma } from "@/lib/prisma"

export async function assertImportacaoEditavel(importacaoId: number, empresaId: number) {
  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")
  if (imp.status === "CANCELADA") throw new Error("Importação cancelada.")
  return imp
}

export async function assertCotacaoEditavel(cotacaoId: number, empresaId: number) {
  const cot = await prisma.cotacaoCompra.findFirst({
    where: { id: cotacaoId, empresaId },
  })
  if (!cot) throw new Error("Cotação não encontrada.")
  if (cot.status === "FECHADA" || cot.status === "CANCELADA") {
    throw new Error("Cotação fechada ou cancelada.")
  }
  return cot
}

export async function assertCotacaoFornecedorRespondivel(tokenHash: string) {
  const cf = await prisma.cotacaoCompraFornecedor.findUnique({
    where: { tokenHash },
    include: { cotacao: true },
  })
  if (!cf) throw new Error("Link inválido.")
  if (cf.status === "RESPONDIDA" || cf.status === "BLOQUEADA") {
    throw new Error("Resposta já enviada. Edição bloqueada.")
  }
  if (cf.cotacao.prazoResposta && cf.cotacao.prazoResposta < new Date()) {
    throw new Error("Prazo de resposta expirado.")
  }
  if (cf.cotacao.status === "FECHADA" || cf.cotacao.status === "CANCELADA") {
    throw new Error("Cotação encerrada.")
  }
  return cf
}

export function canManageCompras(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE" || role === "OPERADOR"
}

export function canApproveCompras(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE"
}
