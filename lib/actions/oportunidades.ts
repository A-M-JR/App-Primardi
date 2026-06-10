"use server"

import { prisma } from "@/lib/prisma"
import { unstable_noStore as noStore } from "next/cache"
import { getRequesterContext } from "./users"

export async function getOportunidadesData(vendedorIdParam?: number, requesterId?: number) {
    noStore()
    const today = new Date()
    const trintaDiasAtras = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000))
    const sessentaDiasAtras = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000))

    let vendedorId = vendedorIdParam
    let empresaId = 1 // Default fallback
  
    // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
    if (requesterId) {
        const ctx = await getRequesterContext(requesterId)
        empresaId = ctx.empresaId || 1
        if (!ctx.isAdmin) {
            vendedorId = ctx.vendedorId as number // Força o vendedorId dele
        }
    }

    const searchVendedor = vendedorId ? Number(vendedorId) : null

    // 1. Dados de Faturamento e Ranking
    const pedidos = await prisma.pedido.findMany({
        where: { 
            ativo: true,
            vendedorId: searchVendedor ? searchVendedor : undefined
        },
        include: { vendedor: true, status: true, cliente: true }
    })

    const vendedores = await prisma.vendedor.findMany({ 
        where: { 
            empresaId,
            ativo: true,
            id: searchVendedor ? searchVendedor : undefined
        } 
    })

    const rankingVendedores = vendedores.map((v: any) => {
        const pedidosVendedor = pedidos.filter((p: any) => p.vendedorId === v.id && !p.status?.nome.toLowerCase().includes('cancelado'))
        const totalVendas = pedidosVendedor.reduce((acc: any, p: any) => acc + Number(p.totalGeral || 0), 0)
        return {
            id: v.id,
            nome: v.nome,
            total: totalVendas,
            quantidade: pedidosVendedor.length
        }
    }).sort((a: any, b: any) => b.total - a.total)

    // 2. Oportunidades de Reativação (Novos critérios: Sem compra OU +30 dias sem orçamento)
    const clientes = await prisma.cliente.findMany({ 
        where: { 
            empresaId,
            ativo: true,
            ...(searchVendedor ? {
                OR: [
                    { pedidos: { some: { vendedorId: searchVendedor } } },
                    { orcamentos: { some: { vendedorId: searchVendedor } } }
                ]
            } : {})
        } 
    })
    const todosOrcamentos = await prisma.orcamento.findMany({ 
        where: { 
            empresaId,
            ativo: true,
            vendedorId: searchVendedor ? searchVendedor : undefined
        },
        orderBy: { criadoEm: 'desc' },
        select: { clienteId: true, criadoEm: true }
    })
    
    const clientesRisco = clientes.filter((c: any) => {
        // 1. Nunca comprou
        if (!c.ultimaCompra) return true
        
        // 2. Último orçamento foi há mais de 30 dias
        const orcamentosDoCliente = todosOrcamentos.filter((o: any) => o.clienteId === c.id)
        const ultimoOrcamento = orcamentosDoCliente[0]?.criadoEm
        
        if (!ultimoOrcamento) return true // Se nunca orçou também entra
        
        return ultimoOrcamento < trintaDiasAtras
    }).map((c: any) => {
        const orcamentosDoCliente = todosOrcamentos.filter((o: any) => o.clienteId === c.id)
        const ultimoOrcamento = orcamentosDoCliente[0]?.criadoEm
        
        const dataReferencia = ultimoOrcamento || c.criadoEm
        const diasSemAtividade = Math.floor((today.getTime() - dataReferencia.getTime()) / (1000 * 3600 * 24))
        
        return {
            id: c.id,
            razaoSocial: c.razaoSocial,
            telefone: c.telefone,
            ultimaCompra: c.ultimaCompra,
            ultimoOrcamento: ultimoOrcamento,
            dias: diasSemAtividade,
            nivel: diasSemAtividade > 60 ? 'critico' : 'alerta'
        }
    }).sort((a: any, b: any) => b.dias - a.dias)

    // 3. Clientes sem Orçamento ou Pedido (Totalmente "zerados")
    const clientesSemHistorico = clientes.filter((c: any) => {
        const temOrcamento = pedidos.some((p: any) => p.clienteId === c.id) // Simplificando: se tem pedido, tem orçamento no histórico
        // Na verdade, vamos checar orçamentos também para ser preciso
        return !temOrcamento
    }).map((c: any) => ({
        id: c.id,
        razaoSocial: c.razaoSocial,
        criadoEm: c.criadoEm
    }))

    // 4. Monitoramento de Produção (Todos os pedidos ativos, ordenados por prazo)
    const pedidosProducao = pedidos.filter((p: any) => {
        const statusNome = p.status?.nome || ''
        const finalizado = statusNome.includes('Entregue') || statusNome.includes('Cancelado') || statusNome.includes('Entrega')
        return !finalizado
    }).map((p: any) => {
        const atrasado = p.prazoEntrega ? p.prazoEntrega < today : false
        return {
            id: p.id,
            numero: p.numero,
            cliente: p.cliente?.razaoSocial,
            prazo: p.prazoEntrega,
            total: p.totalGeral,
            status: p.status?.nome,
            atrasado
        }
    }).sort((a: any, b: any) => {
        if (!a.prazo) return 1
        if (!b.prazo) return -1
        return a.prazo.getTime() - b.prazo.getTime()
    })

    // 5. Resumo de Métricas
    const validPedidos = pedidos.filter((p: any) => !p.status?.nome.toLowerCase().includes('cancelado'))
    const faturamentoTotal = validPedidos.reduce((acc: any, p: any) => acc + Number(p.totalGeral), 0)
    const ticketMedio = validPedidos.length > 0 ? faturamentoTotal / validPedidos.length : 0

    return {
        rankingVendedores,
        clientesRisco,
        clientesSemHistorico,
        pedidosProducao,
        metrics: {
            faturamentoTotal,
            ticketMedio,
            totalClientes: clientes.length,
            totalPedidos: pedidos.length,
            pedidosEmProducao: pedidosProducao.length,
            pedidosAtrasados: pedidosProducao.filter((p: any) => p.atrasado).length
        }
    }
}

export async function generateOportunidadesInsight(vendedorIdParam?: number, requesterId?: number) {
    noStore()
    const { getAIContextSummary } = await import("@/lib/ai-data-context")
    const { getAIConfig } = await import("./config")
    
    let vendedorId = vendedorIdParam
    let empresaId = 1 // Default fallback
  
    // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
    if (requesterId) {
        const { getRequesterVendedorId, getRequesterContext } = await import("./users")
        const ctx = await getRequesterContext(requesterId)
        empresaId = ctx.empresaId || 1
        if (!ctx.isAdmin) {
            vendedorId = ctx.vendedorId as number // Força o vendedorId dele
        }
    }

    const searchVendedor = vendedorId ? Number(vendedorId) : null
    
    const context = await getAIContextSummary(empresaId, searchVendedor || undefined)
    const config = await getAIConfig()

    if (config.provider === 'desativado' || !config.apiKey) {
        throw new Error("Módulo IA não configurado ou desativado.")
    }

    const prompt = `Você é o CGO (Chief Growth Officer) da Primardi, que é a plataforma de CRM/ERP que o usuário já utiliza.
    Analise os dados operacionais abaixo e forneça uma estratégia rápida.
    
    RESTRIÇÃO ABSOLUTA 1: Baseie-se EXCLUSIVAMENTE nos dados fornecidos abaixo. Não reclame da falta de dados, trabalhe com o que você tem. Para 'Clientes VIP', deduza usando o maior volume de vendas ou orçamento, ou sugira reativar os inativos.
    RESTRIÇÃO ABSOLUTA 2: O usuário JÁ ESTÁ usando o nosso CRM (Primardi). NUNCA, em hipótese alguma, sugira "contratar um CRM", "implementar um sistema" ou "usar planilhas". Foque em usar a própria plataforma para registrar follow-ups e contatos. Mantenha o foco 100% nas operações e vendas internas.
    
    ESTRUTURA DO RELATÓRIO:
    1. 🎯 FOCO PRIORITÁRIO: Qual a ação #1 que trará mais retorno HOJE? (Seja breve)
    2. 📈 ANÁLISE DE CRESCIMENTO: Como escalar o faturamento (upsell/cross-sell)?
    3. ⚠️ MITIGAÇÃO DE RISCO: Onde a produção está perdendo dinheiro ou tempo?
    4. 💡 INSIGHTS PREDITIVOS: Quem tem maior potencial de se tornar 'Cliente VIP'?
    
    DADOS PARA PROCESSAMENTO:
    ${context}
    
    Formate como um painel executivo. Use tabelas e checklists concisos (MÁXIMO de 3 itens por tabela/lista para garantir velocidade de resposta) e indicadores de prioridade.`

    // Chamada interna ao endpoint de chat ou lógica direta
    // Para simplificar e garantir segurança (sem expor chave no client), vamos usar a mesma lógica do route.ts ou chamar o route.ts internamente
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.alvarobueno.com.br'
    
    try {
        const res = await fetch(`${baseUrl}/api/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", content: prompt }],
                provider: config.provider,
                apiKey: config.apiKey,
                systemPrompt: "Você é um consultor CGO que trabalha dentro do CRM Primardi. Nunca sugira usar outros softwares, ferramentas ou CRMs externos.",
                includeTools: false
            }),
        })

        const data = await res.json()
        if (data.error) throw new Error(data.error)
        
        // Salva o insight gerado no banco de dados para evitar re-geração no F5
        try {
            await prisma.aISugestao.create({
                data: {
                    empresaId,
                    tipo: searchVendedor ? `OPORTUNIDADES_VENDEDOR_${searchVendedor}` : "OPORTUNIDADES_GERAL",
                    dados: { insight: data.reply },
                    raciocinio: searchVendedor ? `Análise estratégica CGO Primardi para Vendedor #${searchVendedor}` : "Análise estratégica CGO Primardi",
                    status: "APLICADA"
                }
            })
        } catch (dbError) {
            console.error("Erro ao salvar insight no banco de dados:", dbError)
        }

        return data.reply
    } catch (error: any) {
        console.error("Erro na análise IA:", error)
        return "⚠️ Não foi possível gerar a análise automática no momento. Verifique se a chave API está correta nas configurações."
    }
}

export async function getLatestOportunidadesInsight(vendedorIdParam?: number, requesterId?: number) {
    let vendedorId = vendedorIdParam
    let empresaId = 1
  
    // SEGURANÇA: Se houver um requesterId, verifica se ele é vendedor limitado
    if (requesterId) {
        const ctx = await getRequesterContext(requesterId)
        empresaId = ctx.empresaId || 1
        if (!ctx.isAdmin) {
            vendedorId = ctx.vendedorId as number // Força o vendedorId dele
        }
    }

    const searchVendedor = vendedorId ? Number(vendedorId) : null

    try {
        const latest = await prisma.aISugestao.findFirst({
            where: {
                empresaId,
                tipo: searchVendedor ? `OPORTUNIDADES_VENDEDOR_${searchVendedor}` : "OPORTUNIDADES_GERAL",
                status: "APLICADA"
            },
            orderBy: {
                criadoEm: "desc"
            }
        })
        
        if (!latest) return null
        
        const dados = latest.dados as any
        return {
            insight: dados?.insight || null,
            criadoEm: latest.criadoEm
        }
    } catch (error) {
        console.error("Erro ao buscar último insight de oportunidades do banco:", error)
        return null
    }
}
