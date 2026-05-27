import { prisma } from "./prisma"

/**
 * Gera um resumo textual do estado atual da plataforma para contextualizar a IA.
 * Inclui: total de pedidos, pedidos atrasados (SLA), clientes inativos e desempenho de vendas.
 */
export async function getAIContextSummary(empresaId: number, vendedorId?: number) {
    const today = new Date()
    const searchVendedor = vendedorId ? Number(vendedorId) : null

    const orcamentos = await prisma.orcamento.findMany({
        where: { 
            empresaId,
            ...(searchVendedor ? { vendedorId: searchVendedor } : {})
        }
    })
    const pedidos = await prisma.pedido.findMany({
        where: { 
            empresaId,
            ...(searchVendedor ? { vendedorId: searchVendedor } : {})
        },
        include: { cliente: true, vendedor: true, status: true }
    })
    const clientes = await prisma.cliente.findMany({
        where: {
            empresaId,
            ...(searchVendedor ? {
                OR: [
                    { pedidos: { some: { vendedorId: searchVendedor } } },
                    { orcamentos: { some: { vendedorId: searchVendedor } } }
                ]
            } : {})
        }
    })
    const vendedores = await prisma.vendedor.findMany({
        where: {
            empresaId,
            ...(searchVendedor ? { id: searchVendedor } : {})
        }
    })

    // 1. Pedidos e SLA (Atrasados)
    const pedidosAtrasados = pedidos.filter((p: any) => {
        if (!p.prazoEntrega) return false
        const dataEntrega = new Date(p.prazoEntrega)
        return dataEntrega < today && p.status?.nome !== 'Entregue' && p.status?.nome !== 'Cancelado'
    })

    // 2. Clientes em risco (sem compra > 30 dias)
    const clientesInativos = clientes.filter((c: any) => {
        if (!c.ultimaCompra) return false
        const diasSemCompra = Math.floor((today.getTime() - c.ultimaCompra.getTime()) / (1000 * 3600 * 24))
        return diasSemCompra > 30
    }).map((c: any) => ({
        nome: c.razaoSocial,
        dias: c.ultimaCompra ? Math.floor((today.getTime() - c.ultimaCompra.getTime()) / (1000 * 3600 * 24)) : 0
    }))

    // 3. Clientes "sem compra" (Sem nenhum orçamento ou pedido)
    const clientesSemOrcamento = clientes.filter((c: any) => {
        const temOrcamento = orcamentos.some((o: any) => o.clienteId === c.id)
        const temPedido = pedidos.some((p: any) => p.clienteId === c.id)
        return !temOrcamento && !temPedido
    })

    // 3. Desempenho de Vendas (Ranking e Volume)
    const desempenhoVendedores = vendedores.map((v: any) => {
        const pedidosVendedor = pedidos.filter((p: any) => p.vendedorId === v.id && p.status?.nome === 'Entregue')
        const totalVendas = pedidosVendedor.reduce((acc: any, p: any) => acc + Number(p.totalGeral || 0), 0)
        const orcamentosVendedor = orcamentos.filter((o: any) => o.vendedorId === v.id)
        const taxaConversao = orcamentosVendedor.length > 0
            ? ((pedidosVendedor.length / orcamentosVendedor.length) * 100).toFixed(1)
            : 0

        return { nome: v.nome, total: totalVendas, conversao: taxaConversao }
    }).sort((a: any, b: any) => b.total - (a.total as number))

    // Monta o resumo
    const faturamentoTotal = pedidos.reduce((acc: any, p: any) => acc + Number(p.totalGeral || 0), 0)
    
    let summary = `\n--- CONTEXTO ATUAL DO SISTEMA ---\n`
    summary += `Data atual: ${today.toLocaleDateString('pt-BR')}\n`
    summary += `RESUMO GERAL DO BANCO DE DADOS:\n`
    summary += `- Total de Pedidos Existentes: ${pedidos.length}\n`
    summary += `- Total de Orçamentos Existentes: ${orcamentos.length}\n`
    summary += `- Faturamento Total Acumulado: R$ ${faturamentoTotal.toLocaleString('pt-BR')}\n`
    summary += `- Pedidos em Produção/Fábrica: ${pedidos.filter(p => p.status?.nome?.toLowerCase().includes('produ')).length}\n\n`

    summary += `RANKING DE VENDEDORES (Vendas Concluídas):\n`
    desempenhoVendedores.forEach((v: any, i: number) => {
        summary += `${i + 1}. ${v.nome}: R$ ${v.total.toLocaleString('pt-BR')} (Conversão: ${v.conversao}%)\n`
    })
    summary += `\n`

    if (pedidosAtrasados.length > 0) {
        summary += `ALERTAS DE SLA (Pedidos Atrasados):\n`
        pedidosAtrasados.forEach((p: any) => {
            const cli = p.cliente
            summary += `- Pedido ${p.numero} - ${cli?.razaoSocial} (Prazo: ${p.prazoEntrega ? new Date(p.prazoEntrega).toLocaleDateString('pt-BR') : 'N/D'})\n`
        })
        summary += `\n`
    }

    if (clientesInativos.length > 0) {
        summary += `CLIENTES SEM COMPRA > 30 DIAS:\n`
        clientesInativos.slice(0, 5).forEach((c: any) => {
            summary += `- ${c.nome} (Há ${c.dias} dias)\n`
        })
        summary += `\n`
    }

    if (clientesSemOrcamento.length > 0) {
        summary += `CLIENTES NA BASE SEM NENHUM ORÇAMENTO/PEDIDO:\n`
        clientesSemOrcamento.slice(0, 10).forEach((c: any) => {
            summary += `- ${c.razaoSocial} (CNPJ: ${c.cnpj || 'N/D'})\n`
        })
        summary += `Nota: Existem no total ${clientesSemOrcamento.length} clientes sem histórico comercial.\n`
    }

    summary += `--- FIM DO CONTEXTO ---\n`

    return summary
}
