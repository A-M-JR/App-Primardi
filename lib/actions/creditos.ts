"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"

export async function addMovimentacaoCredito(data: {
  clienteId: number
  tipo: 'VALOR' | 'UNIDADE'
  operacao: 'CREDITO' | 'DEBITO'
  quantidade: number
  descricao?: string
  orcamentoId?: number
}) {
  noStore()
  
  const { clienteId, tipo, operacao, quantidade, descricao, orcamentoId } = data
  const valorNum = Number(quantidade)
  const isCredito = operacao === 'CREDITO'

  return await prisma.$transaction(async (tx) => {
    // 1. Registra a movimentação via Raw SQL
    await tx.$executeRaw`
      INSERT INTO "MovimentacaoCredito" (
        "clienteId", tipo, operacao, quantidade, descricao, "orcamentoId", "criadoEm"
      )
      VALUES (
        ${clienteId}, ${tipo}, ${operacao}, ${valorNum}, ${descricao || null}, ${orcamentoId || null}, ${new Date()}
      )
    `

    // 2. Atualiza o saldo do cliente via Raw SQL
    if (tipo === 'VALOR') {
      const sql = isCredito 
        ? tx.$executeRaw`UPDATE "Cliente" SET "saldoCreditoValor" = "saldoCreditoValor" + ${valorNum} WHERE id = ${clienteId}`
        : tx.$executeRaw`UPDATE "Cliente" SET "saldoCreditoValor" = "saldoCreditoValor" - ${valorNum} WHERE id = ${clienteId}`
      await sql
    } else {
      const sql = isCredito
        ? tx.$executeRaw`UPDATE "crm_clientes" SET "saldoCreditoEtiquetas" = "saldoCreditoEtiquetas" + ${valorNum} WHERE id = ${clienteId}`
        : tx.$executeRaw`UPDATE "crm_clientes" SET "saldoCreditoEtiquetas" = "saldoCreditoEtiquetas" - ${valorNum} WHERE id = ${clienteId}`
      await sql
    }

    revalidatePath(`/clientes/${clienteId}`)
    return { success: true }
  })
}

export async function getMovimentacoesByCliente(clienteId: number) {
  noStore()
  return await prisma.$queryRaw`
    SELECT * FROM "MovimentacaoCredito" 
    WHERE "clienteId" = ${clienteId} 
    ORDER BY "criadoEm" DESC
  ` as any[]
}
