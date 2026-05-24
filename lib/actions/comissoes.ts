"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterVendedorId } from "./users"
import { unstable_noStore as noStore } from "next/cache"

export async function getComissoes(vendedorIdParam?: number, mes?: number, ano?: number, requesterId?: number) {
  let vendedorId = vendedorIdParam
  
  // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
  if (requesterId) {
    const perm = await getRequesterVendedorId(requesterId)
    if (perm !== 'ADMIN') {
      vendedorId = perm as number // Força o vendedorId dele
    }
  }
  
  const where: any = {
    ativo: true,
    // Exclui Rascunho (1). Consideramos apenas pedidos confirmados/em produção/entregues.
    statusId: { notIn: [1] } 
  }
  
  if (vendedorId) {
    where.vendedorId = vendedorId
  }

  // Filtro de Data: Para mostrar as parcelas de Abril, precisamos pegar pedidos de até 6 meses atrás
  // que ainda podem ter parcelas vencendo agora.
  if (mes && ano) {
    const dataFim = new Date(ano, mes, 1)
    const dataInicio = new Date(ano, mes - 6, 1) // Puxa 6 meses de histórico
    where.criadoEm = {
      gte: dataInicio,
      lt: dataFim
    }
  }

  const pedidos = await prisma.pedido.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    include: {
      vendedor: true,
      cliente: true,
      status: true,
      formaPagamento: true,
      itens: true // Necessário para cálculo do valor bruto
    }
  })

  const parcelas: any[] = []
  let totalVendasBruto = 0
  
  pedidos.forEach(ped => {
    const percentual = ped.vendedor?.comissao || 0
    
    // Base de cálculo: Agora utiliza o valor final do pedido (já com descontos/créditos aplicados)
    const valorBaseComissao = Number(ped.totalGeral) || 0
    totalVendasBruto += valorBaseComissao

    const totalComissaoPedido = valorBaseComissao * (percentual / 100)
    
    // Detecta quantidade de parcelas (prioriza o campo numérico, depois tenta deduzir pelo nome ou texto)
    let qtdParcelas = (ped.formaPagamento as any)?.quantidadeParcelas || 1
    
    // Se o campo estiver como 1, mas o nome ou texto sugerir mais (ex: 30/60/90), ele tenta deduzir
    if (qtdParcelas === 1) {
      const textoParaAnalisar = ped.formaPagamento?.nome || ped.formaPagamento || ""
      const parts = textoParaAnalisar.split(/[\/\-]/)
      if (parts.length > 1) {
        qtdParcelas = parts.length
      }
    }
    
    const valorPorParcela = totalComissaoPedido / qtdParcelas

    for (let i = 0; i < qtdParcelas; i++) {
      const dataPrevista = new Date(ped.criadoEm)
      dataPrevista.setDate(dataPrevista.getDate() + (i * 30))

      parcelas.push({
        id: `${ped.id}-p${i+1}`,
        pedidoId: ped.id,
        numero: ped.numero,
        criadoEm: ped.criadoEm.toISOString(),
        clienteNome: ped.cliente?.razaoSocial || "Desconhecido",
        vendedorNome: ped.vendedor?.nome || "Sem Vendedor",
        vendedorId: ped.vendedorId,
        status: ped.status?.nome || "Desconhecido",
        totalPedido: valorBaseComissao, // Mostra o valor final com descontos
        percentual,
        valorComissao: valorPorParcela,
        formaPagamentoNome: ped.formaPagamento?.nome || ped.formaPagamento || "A combinar",
        parcelaAtual: i + 1,
        totalParcelas: qtdParcelas,
        dataPrevista: dataPrevista.toISOString()
      })
    }
  })

  const totalComissoes = parcelas.reduce((acc, curr) => acc + curr.valorComissao, 0)

  return {
    dados: parcelas,
    kpis: {
      totalVendas: totalVendasBruto,
      totalComissoes,
      pedidosConcluidos: pedidos.length
    }
  }
}

