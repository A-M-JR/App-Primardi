"use client"

import { useState, useEffect, useRef } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { 
    LineChart, 
    TrendingUp, 
    Users, 
    Clock, 
    AlertTriangle, 
    Trophy, 
    Sparkles, 
    ArrowRight,
    Loader2,
    DollarSign,
    Target,
    MessageCircle,
    Bot
} from "lucide-react"
import { getOportunidadesData } from "@/lib/actions/oportunidades"
import { formatCurrency } from "@/lib/mock-data"
import Link from "next/link"
import { useAI } from "@/lib/ai-context"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

export default function OportunidadesPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [analyzingIA, setAnalyzingIA] = useState(false)
    const [aiInsight, setAiInsight] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [chatInput, setChatInput] = useState("")
    const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([])
    const scrollRef = useRef<HTMLDivElement>(null)
    const { addMessage } = useAI()
    const { isVendedor, vendedor, currentUser } = useAuth()

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }, [chatHistory, analyzingIA])

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getOportunidadesData(isVendedor ? vendedor?.id : undefined, currentUser?.id)
                setData(res)
                
                // Busca o último insight salvo no banco de dados para evitar consumo no F5
                const { getLatestOportunidadesInsight } = await import("@/lib/actions/oportunidades")
                const savedData = await getLatestOportunidadesInsight(isVendedor ? vendedor?.id : undefined, currentUser?.id)
                
                if (savedData?.insight) {
                    setAiInsight(savedData.insight)
                    setLastUpdated(new Date(savedData.criadoEm))
                } else {
                    // Se não houver insight salvo no banco, deixa vazio para o usuário gerar quando quiser
                    setAiInsight(null)
                }
            } catch (error) {
                console.error(error)
                toast.error("Erro ao carregar dados de oportunidades.")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isVendedor, vendedor, currentUser])

    const handleGenerateIAAnalysis = async () => {
        setAnalyzingIA(true)
        try {
            const { generateOportunidadesInsight } = await import("@/lib/actions/oportunidades")
            const insight = await generateOportunidadesInsight(isVendedor ? vendedor?.id : undefined, currentUser?.id)
            setAiInsight(insight)
            setLastUpdated(new Date())
            setChatHistory([]) // Limpa o histórico ao gerar nova análise base
            toast.success("Análise estratégica concluída!")
        } catch (error: any) {
            toast.error(error.message || "Erro ao solicitar análise.")
        } finally {
            setAnalyzingIA(false)
        }
    }

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!chatInput.trim() || analyzingIA) return

        const userMsg = chatInput.trim()
        setChatInput("")
        setChatHistory((prev: any) => [...prev, { role: 'user', content: userMsg }])
        setAnalyzingIA(true)

        try {
            const { getAIConfig } = await import("@/lib/actions/config")
            const config = await getAIConfig()
            
            if (config.provider === 'desativado' || !config.apiKey) {
                throw new Error("Módulo IA não configurado.")
            }

            // Chamada direta para o chat com o contexto atual
            const baseUrl = window.location.origin
            const res = await fetch(`${baseUrl}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        { role: "assistant", content: aiInsight },
                        ...chatHistory,
                        { role: "user", content: userMsg }
                    ],
                    provider: config.provider,
                    apiKey: config.apiKey,
                    systemPrompt: "Você é o CGO da Primardi. Responda de forma curta e estratégica sobre os dados de oportunidades fornecidos. Mantenha o foco em ações comerciais e produtividade.",
                    includeTools: false,
                    vendedorId: isVendedor ? vendedor?.id : undefined,
                    empresaId: currentUser?.empresaId || 1
                }),
            })

            const data = await res.json()
            if (data.error) throw new Error(data.error)
            
            setChatHistory((prev: any) => [...prev, { role: 'assistant', content: data.reply }])
        } catch (error: any) {
            toast.error(error.message || "Erro na resposta da IA.")
            console.error(error)
        } finally {
            setAnalyzingIA(false)
        }
    }

    if (loading) {
        return (
            <AppShell>
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-violet-500/20 blur-3xl animate-pulse rounded-full" />
                            <Loader2 className="size-16 animate-spin text-violet-500 relative z-10" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Sincronizando Inteligência...</h2>
                            <p className="text-sm font-medium text-muted-foreground">Mapeando toda a operação no banco de dados.</p>
                        </div>
                    </div>
                </div>
            </AppShell>
        )
    }

    return (
        <AppShell>
            <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                {/* AI HERO SECTION */}
                <div className="relative overflow-hidden rounded-[2rem] border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.03] to-indigo-500/[0.03] p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Sparkles className="size-64 text-violet-500" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-violet-600 rounded-xl shadow-lg shadow-violet-600/20">
                                    <Sparkles className="size-6 text-white" />
                                </div>
                                <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-200 uppercase tracking-widest text-[10px] font-black py-1">AI Strategic Command</Badge>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-foreground mb-4">
                                Central de <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Oportunidades IA</span>
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Decisões baseadas em dados vivos, não em suposições. Sua IA analisou {data?.metrics?.totalPedidos} pedidos e {data?.metrics?.totalClientes} clientes para gerar sua estratégia agora.
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-3 shrink-0">
                            <Button 
                                onClick={() => handleGenerateIAAnalysis()}
                                disabled={analyzingIA}
                                size="lg"
                                className="h-14 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-xl shadow-violet-600/20 text-md font-bold rounded-2xl group transition-all hover:scale-[1.02]"
                            >
                                {analyzingIA ? <Loader2 className="size-5 mr-3 animate-spin" /> : <TrendingUp className="size-5 mr-3 group-hover:translate-y-[-2px] transition-transform" />}
                                Recalcular Estratégia de Crescimento
                            </Button>
                            <p className="text-[11px] text-center text-muted-foreground italic">
                                Última atualização: {lastUpdated ? lastUpdated.toLocaleString('pt-BR') : 'Carregando...'}
                            </p>
                        </div>
                    </div>

                    {/* INSIGHT VIEW */}
                    <div className="mt-10 grid gap-6">
                        {analyzingIA && !aiInsight ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-6 rounded-3xl bg-white/40 dark:bg-black/20 border border-violet-500/10 border-dashed">
                                <div className="flex gap-2">
                                    <div className="size-3 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="size-3 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '200ms' }} />
                                    <div className="size-3 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '400ms' }} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-violet-700 dark:text-violet-400">O CGO Virtual está processando a inteligência comercial...</p>
                                    <p className="text-sm text-muted-foreground">Cruzando rankings, inatividades e fluxos de produção.</p>
                                </div>
                            </div>
                        ) : aiInsight ? (
                            <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 duration-700">
                                <div ref={scrollRef} className="rounded-3xl bg-white/80 dark:bg-black/40 backdrop-blur-md border border-violet-500/10 p-8 shadow-inner overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar scroll-smooth">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90 font-medium font-sans mb-8">
                                            {aiInsight}
                                        </div>
                                    </div>

                                    {/* Chat History Thread */}
                                    {chatHistory.length > 0 && (
                                        <div className="space-y-6 pt-6 border-t border-violet-500/10">
                                            {chatHistory.map((msg, idx) => (
                                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`
                                                        max-w-[85%] rounded-2xl p-4 text-sm
                                                        ${msg.role === 'user' 
                                                            ? 'bg-violet-600 text-white shadow-md' 
                                                            : 'bg-muted text-foreground border border-border/50'}
                                                    `}>
                                                        <div className="flex items-center gap-2 mb-1 opacity-70">
                                                            {msg.role === 'user' ? <Users className="size-3" /> : <Bot className="size-3" />}
                                                            <span className="text-[10px] font-bold uppercase">{msg.role === 'user' ? 'Você' : 'CGO Insight'}</span>
                                                        </div>
                                                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {analyzingIA && (
                                                <div className="flex justify-start animate-pulse">
                                                    <div className="bg-muted rounded-2xl p-4 flex gap-2">
                                                        <div className="size-1.5 rounded-full bg-violet-500 animate-bounce" />
                                                        <div className="size-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                        <div className="size-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* FOLLOW UP CHAT */}
                                <form onSubmit={handleChatSubmit} className="relative group">
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                        <Bot className="size-5 text-violet-500" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Dúvidas sobre esta análise? Pergunte ao CGO: 'Quais clientes priorizar hoje?'"
                                        className="w-full h-16 pl-14 pr-32 rounded-2xl bg-white dark:bg-black/20 border border-violet-500/20 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/5 outline-none transition-all text-sm font-medium shadow-lg"
                                        disabled={analyzingIA}
                                    />
                                    <div className="absolute inset-y-2 right-2">
                                        <Button type="submit" disabled={analyzingIA || !chatInput.trim()} className="h-full px-6 bg-violet-600 hover:bg-violet-700 rounded-xl text-xs font-bold shadow-md">
                                            {analyzingIA ? <Loader2 className="size-3 animate-spin" /> : <>Perguntar <ArrowRight className="size-3 ml-2" /></>}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 gap-6 rounded-3xl bg-white/40 dark:bg-black/20 border border-violet-500/10 border-dashed">
                                <Bot className="size-12 text-violet-500/50" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-violet-700 dark:text-violet-400">Pronto para analisar seus dados</p>
                                    <p className="text-sm text-muted-foreground">Clique em "Recalcular Estratégia de Crescimento" para gerar insights atualizados.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Concluído</CardTitle>
                            <DollarSign className="size-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.faturamentoTotal || 0)}</div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-bold">
                                <TrendingUp className="size-3" /> +8% em relação à meta
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                            <Target className="size-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.ticketMedio || 0)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Por pedido fechado</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Retenção Crítica</CardTitle>
                            <AlertTriangle className="size-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{(data?.clientesRisco || []).filter((c: any) => c.nivel === 'critico').length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Clientes há +60 dias</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Monitoramento de Produção</CardTitle>
                            <Clock className="size-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{data?.metrics?.pedidosEmProducao || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">Pedidos ativos em fila</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-7">
                    {/* Ranking de Vendedores */}
                    <Card className="lg:col-span-3 border-border/50 shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <Trophy className="size-5 text-amber-500" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Performance de Vendas</CardTitle>
                                <CardDescription>Ranking por volume de faturamento</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {(data?.rankingVendedores || []).map((vend: any, idx: number) => (
                                    <div key={vend.id} className="flex items-center gap-4 group">
                                        <div className={`
                                            flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
                                            ${idx === 0 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-110' : 
                                              idx === 1 ? 'bg-slate-300 text-slate-700' : 
                                              idx === 2 ? 'bg-orange-300 text-orange-800' : 'bg-muted text-muted-foreground'}
                                        `}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{vend.nome}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-muted/50 border-0">{vend.quantidade} pedidos</Badge>
                                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary transition-all duration-1000 ease-out" 
                                                        style={{ width: `${(vend.total / (data?.rankingVendedores?.[0]?.total || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black">{formatCurrency(vend.total)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Oportunidades de Retenção */}
                    <Card className="lg:col-span-4 border-border/50 shadow-sm border-l-4 border-l-orange-500">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                    <Users className="size-5 text-orange-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Oportunidades de Reativação</CardTitle>
                                    <CardDescription>Clientes que precisam de follow-up imediato</CardDescription>
                                </div>
                            </div>
                            <Link href="/clientes">
                                <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-wider">Ver Todos <ArrowRight className="size-3 ml-1" /></Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-border/30 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="text-xs font-bold">Cliente</TableHead>
                                            <TableHead className="text-xs font-bold">Inatividade</TableHead>
                                            <TableHead className="text-xs font-bold">Status</TableHead>
                                            <TableHead className="text-right text-xs font-bold">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(data?.clientesRisco || []).slice(0, 8).map((c: any) => (
                                            <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="text-sm font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{c.razaoSocial}</span>
                                                        <span className="text-[10px] text-muted-foreground">{c.telefone}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {!c.ultimaCompra ? 'Nunca comprou' : `${c.dias} dias s/ orç.`}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={c.nivel === 'critico' ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-orange-500/10 text-orange-600 border-orange-200'} variant="outline">
                                                        {c.nivel === 'critico' ? 'Risco Alto' : 'Follow-up'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 px-2 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900"
                                                            onClick={() => {
                                                                const tel = c.telefone.replace(/\D/g, '')
                                                                window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=Olá ${c.razaoSocial}, tudo bem? Vi que faz um tempo que não conversamos sobre novos orçamentos...`, '_blank')
                                                            }}
                                                        >
                                                            <MessageCircle className="size-3 mr-1" /> WhatsApp
                                                        </Button>
                                                        <Link href={`/clientes/${c.id}`}>
                                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] font-bold">Detalhes</Button>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Clientes sem Orçamento */}
                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 bg-slate-500/10 rounded-lg">
                            <Target className="size-5 text-slate-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Clientes sem Atividade Comercial</CardTitle>
                            <CardDescription>Clientes cadastrados que nunca realizaram um orçamento ou pedido</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {(!data?.clientesSemHistorico || data.clientesSemHistorico.length === 0) ? (
                                <div className="col-span-full py-4 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                                    Todos os clientes possuem histórico comercial!
                                </div>
                            ) : data.clientesSemHistorico.slice(0, 8).map((c: any) => (
                                <div key={c.id} className="p-3 rounded-xl border border-border bg-card/30 flex items-center justify-between group hover:border-primary/30 transition-all">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold truncate">{c.razaoSocial}</span>
                                        <span className="text-[10px] text-muted-foreground">Cadastrado em {new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <Link href={`/clientes/${c.id}`}>
                                        <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="size-3" />
                                        </Button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Monitoramento de Produção */}
                <Card className="border-border/50 shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Clock className="size-5 text-blue-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base text-blue-600">Monitoramento de Produção e Prazos</CardTitle>
                            <CardDescription>Acompanhamento de todos os pedidos ativos e seus respectivos prazos</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {(!data?.pedidosProducao || data.pedidosProducao.length === 0) ? (
                                <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                                    Nenhum pedido em produção no momento.
                                </div>
                            ) : data.pedidosProducao.map((p: any) => (
                                <div key={p.id} className={`flex flex-col p-3 rounded-xl border ${p.atrasado ? 'border-red-100 bg-red-50/30 dark:bg-red-950/10' : 'border-border bg-card/30'} hover:shadow-md transition-all`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-black font-mono text-muted-foreground">#{p.numero}</span>
                                        <Badge variant="outline" className={`border-0 text-[9px] font-black ${p.atrasado ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                            {p.atrasado ? 'ATRASADO' : 'NO PRAZO'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm font-bold truncate mb-1">{p.cliente}</p>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-muted/50 border-0">{p.status}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-border/50">
                                        <span className={`text-[10px] font-medium ${p.atrasado ? 'text-red-600' : 'text-muted-foreground'}`}>
                                            Prazo: {p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : 'A definir'}
                                        </span>
                                        <Link href={`/pedidos/${p.id}`}>
                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:bg-primary/10 hover:text-primary">Ver Pedido</Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    )
}
