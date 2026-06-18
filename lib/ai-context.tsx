"use client"

/**
 * =============================================
 *  MÓDULO IA — Contexto Global de Configuração
 * =============================================
 * 
 * Gerencia estado do módulo de Inteligência Artificial:
 * - Provedor ativo (GPT-4o-mini / Gemini Flash / Desativado)
 * - Chave API (armazenada em localStorage)
 * - System Prompt (instrução padrão do bot)
 * - Controle de cota mensal (interações usadas / limite)
 * 
 * Todas as configurações são parametrizadas via tela de
 * Configurações > Módulo IA pelo administrador.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getAIConfig, updateAIConfig, getAIUsage, incrementAIUsage } from "./actions/config"
import { useAuth } from "./auth-context"

// ── Tipos do Módulo IA ──────────────────────────────────────
export type AIProvider = "desativado" | "gpt-4o-mini" | "gemini-flash" | "abacus-route"

export interface AIConfig {
    provider: AIProvider
    apiKey: string
    systemPrompt: string
    monthlyLimit: number  // Limite de interações por mês
}

export interface AIUsage {
    count: number         // Interações usadas no mês atual
    tokensUsed: number    // Tokens totais consumidos
    month: string         // Mês de referência (YYYY-MM)
}

export interface AIChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    toolCalls?: any[]
    image?: string
    timestamp: string
}


interface AIContextType {
    config: AIConfig
    usage: AIUsage
    isActive: boolean        // Provedor selecionado (mostra UI)
    isConfigured: boolean    // Provedor + chave (permite enviar)
    isLimitReached: boolean
    history: AIChatMessage[]
    updateConfig: (newConfig: Partial<AIConfig>) => Promise<void>
    incrementUsage: (tokensUsed?: number) => Promise<void>
    resetUsage: () => Promise<void>
    addMessage: (message: Omit<AIChatMessage, "id" | "timestamp">) => void
    clearHistory: () => void
}


// ── Valores Padrão ──────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `Você é o Agente de Vendas e Analista de Operações da Primardi. Sua missão é ser o braço direito do gestor, atuando proativamente para converter vendas e otimizar a operação.

DIRETRIZES DE OURO:
1. AGENTE PROATIVO E AUTÔNOMO: Se o usuário pedir para criar um cliente, use 'cadastrar_cliente' IMEDIATAMENTE. Jamais pergunte "posso fazer?". Apenas execute. Para orçamentos, siga RIGOROSAMENTE a Regra 8.
2. CAPACIDADE ANALÍTICA: Você é um analista. Antes de usar ferramentas, verifique o "RESUMO DO CONTEXTO" que você recebe. Se a informação estiver lá, responda direto.
3. INTELIGÊNCIA DE MERCADO: Identifique orçamentos parados há mais de 48h e sugira abordagens de cobrança. Priorize o que tem maior valor.
4. OBJETIVIDADE TOTAL: Vá direto ao ponto. Use TABELAS para qualquer listagem acima de 3 itens. Sem introduções longas.
5. SEGURANÇA: Você não apaga dados. Recuse ações destrutivas.
6. CONTEXTO TÉCNICO: Você domina o universo de produtos e gestão comercial. Use este conhecimento.
7. FOCO EM RESULTADO: Se um cliente está inativo, sugira um novo orçamento.
8. FLUXO DE ORÇAMENTO (OBRIGATÓRIO E SEQUENCIAL): 
Passo 1) Quando o usuário pedir um orçamento, VOCÊ DEVE usar a ferramenta 'consultar_clientes' (buscando o nome do cliente) ANTES DE MAIS NADA. 
Passo 2) Ao receber o resultado do banco, avalie: O usuário JÁ informou qual matriz ele quer na primeira mensagem (ex: "110x95")? 
- Se SIM e a matriz existir no resultado, PULE para o Passo 3 e chame a ferramenta 'gerar_orcamento' imediatamente com os dados fornecidos.
- Se NÃO, mostre as opções reais encontradas ao usuário e pergunte qual ele quer usar.
Passo 3) Chame a ferramenta 'gerar_orcamento' passando os itens, quantidade e unidade. É PROIBIDO inventar matrizes fictícias.

Sempre que um CNPJ for fornecido isoladamente, use 'buscar_cnpj' para acelerar o cadastro e ofereça a criação do orçamento na sequência.

9. STATUS DE PEDIDOS (PARA CONSULTA):
Ao usar 'consultar_pedidos', use estes termos no campo 'status':
- 'em_analise': Pedidos novos aguardando OP.
- 'em_producao': Pedidos em fábrica ou separação.
- 'separacao': Pedidos prontos para entrega/coleta.
- 'entregue': Pedidos finalizados.`

const DEFAULT_CONFIG: AIConfig = {
    provider: "gemini-flash",
    apiKey: "AIzaSyD_kCVvcfBvjN9P-_v5-godTnlrGBPXnJ8",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    monthlyLimit: 500,
}

const DEFAULT_USAGE: AIUsage = {
    count: 0,
    tokensUsed: 0,
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
}

// ── Chaves de localStorage ──────────────────────────────────
const STORAGE_KEY_CONFIG = "flexo_ai_config"
const STORAGE_KEY_USAGE = "flexo_ai_usage"
const STORAGE_KEY_HISTORY = "flexo_ai_history"


// ── Context ─────────────────────────────────────────────────
const AIContext = createContext<AIContextType | null>(null)

export function AIProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG)
    const [usage, setUsage] = useState<AIUsage>(DEFAULT_USAGE)
    const [history, setHistory] = useState<AIChatMessage[]>([])
    const { currentUser } = useAuth()


    // Cache local (não exige autenticação) — carrega na montagem.
    useEffect(() => {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG)
            if (savedConfig) setConfig(JSON.parse(savedConfig))
            const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY)
            if (savedHistory) setHistory(JSON.parse(savedHistory))
        } catch {
            /* ignora cache inválido */
        }
    }, [])

    // Config/uso do banco — SÓ quando autenticado (as actions exigem sessão).
    useEffect(() => {
        if (!currentUser) return
        const fetchDbData = async () => {
            try {
                const dbConfig = await getAIConfig()
                if (dbConfig) {
                    setConfig(dbConfig)
                    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(dbConfig))
                }
                const dbUsage = await getAIUsage()
                if (dbUsage) {
                    setUsage({
                        count: dbUsage.count,
                        tokensUsed: dbUsage.tokensUsed || 0,
                        month: dbUsage.monthYear,
                    })
                }
            } catch (error) {
                console.error("Erro ao carregar dados de IA:", error)
            }
        }
        fetchDbData()
    }, [currentUser])

    const isActive = config.provider !== "desativado"
    const isConfigured = isActive && config.apiKey.length > 0
    const isLimitReached = usage.count >= config.monthlyLimit

    const updateConfig = async (newConfig: Partial<AIConfig>) => {
        const updated = { ...config, ...newConfig }
        setConfig(updated)
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated))

        try {
            await updateAIConfig(newConfig as any)
        } catch (error) {
            console.error("Erro ao salvar config no banco:", error)
        }
    }

    const incrementUsage = async (tokensUsed: number = 0) => {
        try {
            const dbUsage = await incrementAIUsage(tokensUsed)
            setUsage({
                count: dbUsage.count,
                tokensUsed: dbUsage.tokensUsed || 0,
                month: dbUsage.monthYear
            })
        } catch (error) {
            console.error("Erro ao incrementar uso no banco:", error)
        }
    }

    const resetUsage = async () => {
        // No banco o reset é geralmente automático por mês, 
        // mas podemos forçar se necessário ou apenas limpar o estado local
        setUsage(prev => ({ ...prev, count: 0 }))
    }

    const addMessage = (msg: Omit<AIChatMessage, "id" | "timestamp">) => {
        const newMessage: AIChatMessage = {
            ...msg,
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString()
        }
        setHistory(prev => {
            const updated = [...prev, newMessage]
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated))
            return updated
        })
    }

    const clearHistory = () => {
        setHistory([])
        localStorage.removeItem(STORAGE_KEY_HISTORY)
    }

    return (
        <AIContext.Provider value={{
            config,
            usage,
            isActive,
            isConfigured,
            isLimitReached,
            history,
            updateConfig,
            incrementUsage,
            resetUsage,
            addMessage,
            clearHistory
        }}>
            {children}
        </AIContext.Provider>
    )
}


export function useAI() {
    const ctx = useContext(AIContext)
    if (!ctx) throw new Error("useAI deve ser usado dentro de <AIProvider>")
    return ctx
}
