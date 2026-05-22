"use client"

/**
 * =============================================
 *  MÓDULO IA — Painel de Chat Flutuante
 * =============================================
 */

import { useState, useRef, useEffect } from "react"
import { Bot, X, Send, Sparkles, AlertTriangle, Loader2, Trash2, Check, ExternalLink, Search, FilePlus, ShoppingCart, Paperclip, UserPlus, BarChart3, BookOpen, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAI } from "@/lib/ai-context"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getClientes, saveCliente } from "@/lib/actions/clientes"
import { getPedidos } from "@/lib/actions/pedidos"
import { getOrcamentos } from "@/lib/actions/orcamentos"
import { getProdutos } from "@/lib/actions/produtos"

interface ChatMessage {
    role: "user" | "assistant"
    content: string
    timestamp: Date
    toolCalls?: any[]
}

const MAX_CONTEXT_MESSAGES = 6

export function AIChatPanel() {
    const router = useRouter()
    const pathname = usePathname()
    const { currentUser } = useAuth()
    const { config, usage, isActive, isConfigured, isLimitReached, history, addMessage, clearHistory, incrementUsage } = useAI()
    const [isOpen, setIsOpen] = useState(false)
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const executedToolsRef = useRef<Set<string>>(new Set())

    const isVisible = isActive && pathname !== '/login' && !!currentUser

    const quickSuggestions = [
        "Existem pedidos atrasados?",
        "Qual o resumo financeiro atual?",
        "Como está a saúde dos meus clientes?",
        "Consultar catálogo de BOPP"
    ]
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [history, isOpen])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 200)
        }
    }, [isOpen])

    // Escuta eventos globais para controlar o chat
    useEffect(() => {
        const handleToggle = () => setIsOpen(prev => !prev)
        const handleSuggest = (e: any) => {
            setIsOpen(true)
            if (e.detail?.message) {
                setInput(e.detail.message)
                // Dispara o envio após um pequeno delay para garantir que o estado atualizou
                setTimeout(() => {
                    const sendBtn = document.getElementById('ai-send-button')
                    sendBtn?.click()
                }, 300)
            }
        }

        window.addEventListener('toggle-ai-chat', handleToggle)
        window.addEventListener('ai-chat-suggest', handleSuggest)
        return () => {
            window.removeEventListener('toggle-ai-chat', handleToggle)
            window.removeEventListener('ai-chat-suggest', handleSuggest)
        }
    }, [])

    const handleSend = async () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading || isLimitReached) return

        if (!isConfigured) {
            addMessage({ role: "user", content: trimmed })
            addMessage({ role: "assistant", content: "⚠️ Chave API não configurada." })
            setInput("")
            return
        }

        const userMsg = { role: "user" as const, content: trimmed, image: selectedImage || undefined }
        addMessage(userMsg)
        setInput("")
        setIsLoading(true)

        try {
            const contextMessages = [
                ...history.slice(-(MAX_CONTEXT_MESSAGES - 1)).map(m => ({ role: m.role, content: m.content })),
                { role: "user" as const, content: trimmed }
            ]

            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: contextMessages,
                    provider: config.provider,
                    apiKey: config.apiKey,
                    systemPrompt: config.systemPrompt,
                    includeTools: true,
                    image: selectedImage,
                }),
            })

            const data = await res.json()
            setSelectedImage(null)

            if (!res.ok) {
                addMessage({ role: "assistant", content: `⚠️ ${data.error || "Erro no processamento."}` })
            } else {
                addMessage({
                    role: "assistant",
                    content: data.reply || (data.toolCalls ? "Processando..." : ""),
                    toolCalls: data.toolCalls,
                })
                incrementUsage(data.tokensUsed || 0)

                if (data.toolCalls) {
                    data.toolCalls.forEach((toolCall: any) => {
                        if (executedToolsRef.current.has(toolCall.id)) return
                        const name = toolCall.function.name
                        if (name.startsWith('consultar_') || name.startsWith('buscar_')) {
                            executedToolsRef.current.add(toolCall.id)
                            setTimeout(() => executeAction(toolCall), 100)
                        }
                    })
                }
            }
        } catch {
            addMessage({ role: "assistant", content: "⚠️ Erro de conexão." })
        } finally {
            setIsLoading(false)
        }
    }

    const executeAction = async (toolCall: any) => {
        const { name } = toolCall.function
        const args = JSON.parse(toolCall.function.arguments)
        setIsExecutingAction(toolCall.id)

        try {
            if (name === 'gerar_orcamento') {
                const params = new URLSearchParams({
                    cliente: args.cliente || '',
                    itens: args.itens || '',
                    qtd: args.quantidade || '',
                    unid: args.unidade || '',
                    obs: args.observacoes || ''
                })
                router.push(`/orcamentos/novo?${params.toString()}`)
                addMessage({ role: "assistant", content: `Abrindo orçamento para **${args.cliente}**...` })
            }
            else if (name === 'consultar_clientes') {
                const res = await getClientes({ limit: 100, mode: 'full' })
                const clientes = res.data
                const filtrados = args.termo ? clientes.filter((c: any) => c.razaoSocial.toLowerCase().includes(args.termo.toLowerCase()) || (c.cnpj && c.cnpj.includes(args.termo))) : clientes.slice(0, 5)
                
                let resposta = `Busca de clientes por "${args.termo || 'Recentes'}":\n\n`
                if (filtrados.length === 0) {
                    resposta = `Nenhum cliente encontrado.`
                } else {
                    filtrados.forEach((c: any) => {
                        let info = `🏢 **${c.razaoSocial}**\n`
                        const matrizes = c.produtosVinculados || []
                        if (matrizes.length > 0) {
                            info += `📦 **Produtos:**\n${matrizes.map((m: any, idx: number) => `${idx + 1} - ${m.nome} (${m.codigo})`).join('\n')}\n`
                        }
                        info += `---\n`
                        resposta += info
                    })
                }
                addMessage({ role: "assistant", content: resposta })
            }
            else if (name === 'consultar_pedidos') {
                // 🚀 MELHORIA: Passa o status direto para a action para usar o mapeamento do banco
                const statusQuery = args.status?.toLowerCase() || undefined
                const res = await getPedidos({ limit: 100, status: statusQuery })
                let pedidos = res.data
                
                const top = pedidos.slice(0, 10)
                let resposta = `Encontrei ${pedidos.length} pedidos correspondentes:\n\n`
                if (top.length === 0) {
                    resposta = `Não localizei nenhum pedido com o filtro solicitado.`
                } else {
                    const agora = new Date()
                    top.forEach(p => {
                        const dataCriacao = new Date(p.criadoEm)
                        const diffTime = Math.abs(agora.getTime() - dataCriacao.getTime())
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        
                        resposta += `📦 **${p.numero}** | R$ ${p.totalGeral.toLocaleString('pt-BR')}\n`
                        resposta += `Cliente: ${p.cliente?.razaoSocial}\n`
                        resposta += `Status: ${(p as any).status?.nome || p.status}\n`
                        resposta += `Tempo: **Parado há ${diffDays} dias** (Desde ${dataCriacao.toLocaleDateString('pt-BR')})\n---\n`
                    })
                }
                addMessage({ role: "assistant", content: resposta })
            }
            else if (name === 'consultar_catalogo') {
                const termo = args.termo?.toLowerCase() || ''
                const res = await getProdutos()
                const todas = res.data || res
                const filtradas = (todas as any[]).filter(p =>
                    p.nome?.toLowerCase().includes(termo) ||
                    p.codigo?.toLowerCase().includes(termo) ||
                    p.unidadePadrao?.toLowerCase().includes(termo)
                )
                const top = filtradas.slice(0, 10)
                let resposta = `Itens no catálogo para "${termo}":\n\n`
                if (top.length === 0) {
                    resposta = `Nenhum item encontrado no catálogo.`
                } else {
                    top.forEach((p: any, i: number) => {
                        resposta += `${i+1}. **${p.nome}** (Cód: ${p.codigo})\nUnidade: ${p.unidadePadrao} | Estoque: ${p.estoque ?? '-'} | Preço Base: R$ ${p.precoBase?.toLocaleString('pt-BR') ?? '-'}\n---\n`
                    })
                }
                addMessage({ role: "assistant", content: resposta })
            }
            else if (name === 'consultar_orcamentos') {
                const res = await getOrcamentos({ limit: 100 })
                const top = res.data.slice(0, 5)
                let resposta = `Últimos orçamentos:\n\n`
                top.forEach((o: any) => {
                    resposta += `📄 **${o.numero}** | R$ ${o.totalGeral}\nCliente: ${o.cliente?.razaoSocial}\n---\n`
                })
                addMessage({ role: "assistant", content: resposta })
            }
        } catch (error) {
            console.error("Erro Action:", error)
        } finally {
            setIsExecutingAction(null)
        }
    }

    const ActionCard = ({ toolCall }: { toolCall: any }) => {
        const { name } = toolCall.function
        const args = JSON.parse(toolCall.function.arguments)
        const isExecuting = isExecutingAction === toolCall.id
        const isCompleted = executedToolsRef.current.has(toolCall.id) && !isExecuting

        const actionConfigs: any = {
            gerar_orcamento: { title: "Gerar Orçamento", icon: <FilePlus className="size-4" />, color: "bg-blue-500", description: `Criar para ${args.cliente}` },
            consultar_clientes: { title: "Buscar Clientes", icon: <Search className="size-4" />, color: "bg-blue-600", description: `Termo: ${args.termo || 'Todos'}` },
            consultar_pedidos: { title: "Buscar Pedidos", icon: <ShoppingCart className="size-4" />, color: "bg-emerald-600", description: `Status: ${args.status || 'Todos'}` },
            consultar_catalogo: { title: "Catálogo Geral", icon: <BookOpen className="size-4" />, color: "bg-indigo-500", description: `Busca: ${args.termo || 'Geral'}` },
            consultar_orcamentos: { title: "Buscar Orçamentos", icon: <Search className="size-4" />, color: "bg-cyan-600", description: `Histórico` },
        }

        const config = actionConfigs[name] || { title: "Ação IA", icon: <Sparkles className="size-4" />, color: "bg-primary", description: name }

        return (
            <div className="mt-2 rounded-xl border border-border/50 bg-background shadow-sm overflow-hidden animate-in zoom-in-95">
                <div className={`px-3 py-2 flex items-center gap-2 text-white text-[10px] font-bold ${config.color} ${isCompleted ? 'opacity-70' : ''}`}>
                    {config.icon} {config.title}
                </div>
                <div className="p-3 text-xs">
                    <p className="text-muted-foreground mb-2">{config.description}</p>
                    {name.startsWith('consultar_') || name.startsWith('buscar_') ? (
                        <div className={`flex items-center gap-2 font-medium ${isCompleted ? 'text-emerald-600' : 'text-primary animate-pulse'}`}>
                            {isCompleted ? <Check className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
                            {isCompleted ? 'Concluído' : 'Processando...'}
                        </div>
                    ) : (
                        <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => executeAction(toolCall)} disabled={isExecuting || isCompleted}>
                            {isExecuting ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Confirmar
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    if (!isVisible) return null

    return (
        <>
            {!isOpen && (
                <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-all group">
                    <Sparkles className="size-6 group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold">IA</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[600px] flex flex-col rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
                        <div className="flex items-center gap-2">
                            <Bot className="size-5" />
                            <div className="leading-tight">
                                <h3 className="text-xs font-bold uppercase tracking-wider">Agente Primardi</h3>
                                <p className="text-[9px] opacity-70">Sessão: {usage.count}/{config.monthlyLimit}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={clearHistory} className="p-1.5 hover:bg-white/20 rounded-md transition-colors"><Trash2 className="size-4" /></button>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors"><X className="size-4" /></button>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[420px] bg-slate-50/50">
                        {history.length === 0 && (
                            <div className="flex flex-col gap-2 mt-4">
                                <p className="text-xs font-bold text-muted-foreground mb-1 ml-1">Sugestões rápidas:</p>
                                {quickSuggestions.map(s => (
                                    <button key={s} onClick={() => setInput(s)} className="text-left text-[11px] px-3 py-2.5 rounded-xl bg-white border border-border hover:border-primary hover:text-primary transition-all flex justify-between items-center group shadow-sm">
                                        {s} <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-white rounded-br-none" : "bg-white border border-border text-slate-800 rounded-bl-none"}`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    {msg.toolCalls?.map((tc: any) => <ActionCard key={tc.id} toolCall={tc} />)}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="flex justify-start"><div className="bg-white border border-border rounded-2xl rounded-bl-none px-4 py-2 text-xs text-muted-foreground animate-pulse flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Pensando...</div></div>}
                    </div>

                    <div className="p-3 border-t border-border bg-white">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Como posso ajudar?"
                                className="flex-1 h-10 bg-slate-100/80 rounded-xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                            <Button id="ai-send-button" onClick={handleSend} disabled={!input.trim() || isLoading} className="h-10 w-10 p-0 rounded-xl">
                                <Send className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
