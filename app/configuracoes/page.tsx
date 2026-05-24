"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Palette, Building2, Save, Search, Loader2, Bot, Eye, EyeOff, Sparkles, RotateCcw, ArrowLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useAI, type AIProvider } from "@/lib/ai-context"
import { empresaDefault } from "@/lib/mock-data"
import { getEmpresa, updateEmpresa } from "@/lib/actions/config"
import Link from "next/link"
import { AIDashboard } from "./dashboard-ia"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CRMConfig } from "./crm-config"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ConfiguracoesForm() {
    const { isAdmin, isLoading } = useAuth()
    const [empresa, setEmpresa] = useState(empresaDefault)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoadingCnpj, setIsLoadingCnpj] = useState(false)
    const [isLoadingCep, setIsLoadingCep] = useState(false)
    const [showApiKey, setShowApiKey] = useState(false)

    // Carregar dados iniciais do banco
    useEffect(() => {
        const load = async () => {
            const data = await getEmpresa()
            if (data) setEmpresa(data)
        }
        load()
    }, [])

    // ── Módulo IA ──────────────────────────────────────
    const { config: aiConfig, usage: aiUsage, updateConfig: updateAIConfig, resetUsage: resetAIUsage } = useAI()

    // Funções de formatação (Máscaras)
    const formatCNPJ = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2")
            .slice(0, 18)
    }

    const formatCEP = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/^(\d{5})(\d)/, "$1-$2")
            .slice(0, 9)
    }

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, "");
        if (numbers.length <= 10) {
            return numbers
                .replace(/^(\d{2})(\d)/, "($1) $2")
                .replace(/(\d{4})(\d)/, "$1-$2")
                .slice(0, 14);
        }
        return numbers
            .replace(/^(\d{2})(\d)/, "($1) $2")
            .replace(/(\d{5})(\d)/, "$1-$2")
            .slice(0, 15);
    }

    // Buscas em API
    const fetchCNPJ = async (numeroCnpj?: string) => {
        const value = numeroCnpj || empresa.cnpj
        const cleanCnpj = value.replace(/\D/g, "")
        if (cleanCnpj.length !== 14) return

        setIsLoadingCnpj(true)
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
            if (!response.ok) throw new Error("CNPJ não encontrado.")
            const data = await response.json()

            setEmpresa((prev) => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                nomeFantasia: data.nome_fantasia || data.razao_social || prev.nomeFantasia,
                telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || prev.telefone,
                email: data.email || prev.email,
                endereco: {
                    cep: formatCEP(data.cep) || prev.endereco.cep,
                    logradouro: data.logradouro || prev.endereco.logradouro,
                    numero: data.numero || prev.endereco.numero,
                    complemento: data.complemento || prev.endereco.complemento,
                    bairro: data.bairro || prev.endereco.bairro,
                    cidade: data.municipio || prev.endereco.cidade,
                    estado: data.uf || prev.endereco.estado,
                }
            }))
            toast.success("Dados da empresa importados via CNPJ!")
        } catch (error) {
            toast.error("Erro ao buscar CNPJ. Verifique se o número está correto.")
        } finally {
            setIsLoadingCnpj(false)
        }
    }

    const fetchCEP = async (numeroCep?: string) => {
        const value = numeroCep || empresa.endereco.cep
        const cleanCep = value.replace(/\D/g, "")
        if (cleanCep.length !== 8) return

        setIsLoadingCep(true)
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await response.json()

            if (data.erro) throw new Error("CEP não encontrado.")

            setEmpresa((prev) => ({
                ...prev,
                endereco: {
                    ...prev.endereco,
                    logradouro: data.logradouro || prev.endereco.logradouro,
                    bairro: data.bairro || prev.endereco.bairro,
                    cidade: data.localidade || prev.endereco.cidade,
                    estado: data.uf || prev.endereco.estado,
                }
            }))
            toast.success("Endereço atualizado pelo CEP!")
        } catch (error) {
            toast.error("Erro ao buscar CEP.")
        } finally {
            setIsLoadingCep(false)
        }
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in duration-200">
                <div className="bg-destructive/10 p-4 rounded-full">
                    <Palette className="size-10 text-destructive" />
                </div>
                <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
                    <p className="text-muted-foreground">Configurações globais do sistema são restritas a administradores.</p>
                </div>
                <Link href="/">
                    <Button variant="outline" size="sm" className="mt-2">
                        <ArrowLeft className="size-4 mr-2" />
                        Voltar ao Início
                    </Button>
                </Link>
            </div>
        )
    }

    const sidebarEl = document.querySelector('[data-sidebar="sidebar-inner"]') as HTMLElement | null

    const handleSave = async () => {
        setIsSaving(true)
        try {
            // 1. Salva no Banco de Dados
            await updateEmpresa(empresa)

            // 2. Aplica cores localmente
            if (empresa.corSidebar) {
                localStorage.setItem('flexo_theme_sidebar', empresa.corSidebar)

                if (empresa.corSidebar.startsWith('#')) {
                    // Cor sólida
                    document.documentElement.style.setProperty('--sidebar', empresa.corSidebar)
                    document.documentElement.style.setProperty('--sidebar-border', `${empresa.corSidebar}40`)
                    if (sidebarEl) sidebarEl.style.background = ''
                } else {
                    // Gradiente - aplica direto no elemento
                    document.documentElement.style.setProperty('--sidebar', 'transparent')
                    document.documentElement.style.setProperty('--sidebar-border', '#ffffff20')
                    if (sidebarEl) sidebarEl.style.background = empresa.corSidebar
                }
            }
            toast.success("Configurações da empresa salvas com sucesso!", {
                description: "O layout e dados institucionais foram atualizados no banco de dados."
            })
        } catch (error) {
            console.error("Erro ao salvar configurações:", error)
            toast.error("Falha ao salvar no banco de dados.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <Building2 className="size-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações da Empresa</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gerencie os dados institucionais que aparecerão nos pedidos e orçamentos gerados.
                        </p>
                    </div>
                </div>

                <Card className="shadow-sm border-border/50">
                    <CardHeader>
                        <CardTitle>Dados Gerais</CardTitle>
                        <CardDescription>Informações principais da matriz.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="razaoSocial">Razão Social</Label>
                                <Input
                                    id="razaoSocial"
                                    value={empresa.razaoSocial}
                                    onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                                <Input
                                    id="nomeFantasia"
                                    value={empresa.nomeFantasia}
                                    onChange={(e) => setEmpresa({ ...empresa, nomeFantasia: e.target.value })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cnpj">CNPJ</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="cnpj"
                                        value={empresa.cnpj}
                                        onChange={(e) => {
                                            const formatted = formatCNPJ(e.target.value)
                                            setEmpresa({ ...empresa, cnpj: formatted })
                                            if (formatted.replace(/\D/g, "").length === 14) {
                                                fetchCNPJ(formatted)
                                            }
                                        }}
                                        autoComplete="off"
                                        placeholder="00.000.000/0001-00"
                                        className="bg-muted/50 focus-visible:bg-background"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => fetchCNPJ()}
                                        disabled={isLoadingCnpj || empresa.cnpj.length < 14}
                                        className="px-3"
                                    >
                                        {isLoadingCnpj ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inscricaoEstadual">Inscrição Estadual (Opcional)</Label>
                                <Input
                                    id="inscricaoEstadual"
                                    value={empresa.inscricaoEstadual || ""}
                                    onChange={(e) => {
                                        // Remove letras para deixar só números, pontos e traços, que são comuns em I.E.
                                        const value = e.target.value.replace(/[^\d.-]/g, '');
                                        setEmpresa({ ...empresa, inscricaoEstadual: value });
                                    }}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                    placeholder="Apenas números, pontos e traços"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="telefone">Telefone Comercial</Label>
                                <Input
                                    id="telefone"
                                    value={empresa.telefone}
                                    onChange={(e) => setEmpresa({ ...empresa, telefone: formatPhone(e.target.value) })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email de Contato</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={empresa.email}
                                    onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                    <CardHeader>
                        <CardTitle>Endereço e Localização</CardTitle>
                        <CardDescription>Localização que constará no cabeçalho das propostas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cep">CEP</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="cep"
                                        value={empresa.endereco.cep}
                                        onChange={(e) => {
                                            const formatted = formatCEP(e.target.value)
                                            setEmpresa({ ...empresa, endereco: { ...empresa.endereco, cep: formatted } })
                                            if (formatted.replace(/\D/g, "").length === 8) {
                                                fetchCEP(formatted)
                                            }
                                        }}
                                        autoComplete="off"
                                        placeholder="00000-000"
                                        className="bg-muted/50 focus-visible:bg-background"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => fetchCEP()}
                                        disabled={isLoadingCep || empresa.endereco.cep.length < 8}
                                        className="px-3"
                                    >
                                        {isLoadingCep ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="logradouro">Rua/Avenida</Label>
                                <Input
                                    id="logradouro"
                                    value={empresa.endereco.logradouro}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, logradouro: e.target.value } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="numero">Número</Label>
                                <Input
                                    id="numero"
                                    value={empresa.endereco.numero}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, numero: e.target.value } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="complemento">Complemento</Label>
                                <Input
                                    id="complemento"
                                    value={empresa.endereco.complemento || ""}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, complemento: e.target.value } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bairro">Bairro</Label>
                                <Input
                                    id="bairro"
                                    value={empresa.endereco.bairro}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, bairro: e.target.value } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cidade">Cidade</Label>
                                <Input
                                    id="cidade"
                                    value={empresa.endereco.cidade}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, cidade: e.target.value } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="estado">Estado (UF)</Label>
                                <Input
                                    id="estado"
                                    value={empresa.endereco.estado}
                                    maxLength={2}
                                    onChange={(e) => setEmpresa({ ...empresa, endereco: { ...empresa.endereco, estado: e.target.value.toUpperCase() } })}
                                    autoComplete="off"
                                    className="bg-muted/50 focus-visible:bg-background uppercase"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="size-5 text-primary" />
                            Personalização Visual
                        </CardTitle>
                        <CardDescription>Ajuste o esquema de cores global do sistema para a sua preferência.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
                        <p className="text-sm text-muted-foreground">
                            Selecione um tema de cor ou gradiente para a barra lateral. A alteração é aplicada em tempo real ao salvar.
                        </p>
                        {/* Presets de Cor Sólida */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cores Sólidas</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { name: 'Azul Marinho (Padrão)', value: '#0f264a', preview: 'bg-[#0f264a]' },
                                    { name: 'Preto Grafite', value: '#18181b', preview: 'bg-[#18181b]' },
                                    { name: 'Verde Floresta', value: '#14532d', preview: 'bg-[#14532d]' },
                                    { name: 'Vinho Escuro', value: '#4a0d1d', preview: 'bg-[#4a0d1d]' },
                                    { name: 'Roxo Noturno', value: '#2e1065', preview: 'bg-[#2e1065]' },
                                    { name: 'Chumbo Industrial', value: '#1c2536', preview: 'bg-[#1c2536]' },
                                ].map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => setEmpresa({ ...empresa, corSidebar: preset.value })}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all text-sm ${empresa.corSidebar === preset.value
                                            ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                                            : 'border-border/50 hover:bg-muted/50'
                                            }`}
                                    >
                                        <div className={`size-7 rounded ${preset.preview} flex-shrink-0 shadow-sm ring-1 ring-black/10`} />
                                        <span className="truncate text-xs font-medium">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color Picker customizado */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cor Personalizada</Label>
                            <div className="flex items-center gap-3">
                                <div className="relative size-10 rounded-md overflow-hidden ring-1 ring-border shadow-sm">
                                    <Input
                                        id="corSidebar"
                                        type="color"
                                        value={empresa.corSidebar?.startsWith('#') ? empresa.corSidebar : '#0f264a'}
                                        onChange={(e) => setEmpresa({ ...empresa, corSidebar: e.target.value })}
                                        className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                                    />
                                </div>
                                <code className="text-sm bg-muted px-2 py-1 rounded font-mono border border-border/50 text-muted-foreground">
                                    {empresa.corSidebar?.startsWith('#') ? empresa.corSidebar : 'gradiente'}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs ml-auto"
                                    onClick={() => {
                                        const defaultColor = '#0f264a'
                                        setEmpresa({ ...empresa, corSidebar: defaultColor })
                                        localStorage.removeItem('flexo_theme_sidebar')
                                        document.documentElement.style.removeProperty('--sidebar')
                                        document.documentElement.style.removeProperty('--sidebar-border')
                                        if (sidebarEl) sidebarEl.style.background = ''
                                    }}
                                >
                                    Restaurar Padrão
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ═══════════════════════════════════════════════ */}
                {/* MÓDULO DE INTELIGÊNCIA ARTIFICIAL              */}
                {/* ═══════════════════════════════════════════════ */}
                <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-500/10 rounded-lg">
                                    <Bot className="size-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">Módulo de Inteligência Artificial</CardTitle>
                                        <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 border-none text-[10px] h-4">BETA</Badge>
                                    </div>
                                    <CardDescription>Gerencie o assistente IA e monitore o consumo da plataforma.</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Painel de Dashboard (Fase 3) */}
                        {aiConfig.provider !== 'desativado' && (
                            <div className="pb-6 border-b border-border/50">
                                <AIDashboard />
                            </div>
                        )}

                        {/* Configurações Técnicas */}
                        <div className="space-y-6 pt-2">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="size-4 text-violet-500" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Configurações de Conexão</h3>
                            </div>

                            {/* Provedor */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Provedor de IA</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={aiConfig.provider}
                                    onChange={(e) => updateAIConfig({ provider: e.target.value as AIProvider })}
                                >
                                    <option value="desativado">🔴 Desativado</option>
                                    <option value="gemini-flash">🟢 Google Gemini Flash (Recomendado - Mais Econômico)</option>
                                    <option value="gpt-4o-mini">🔵 OpenAI GPT-4o Mini</option>
                                    <option value="abacus-route">🟣 Abacus AI (RouteLLM)</option>
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    {aiConfig.provider === 'gemini-flash' && '💡 Gemini Flash: ~R$ 0,001 por interação. Obtenha sua chave em ai.google.dev'}
                                    {aiConfig.provider === 'gpt-4o-mini' && '💡 GPT-4o Mini: ~R$ 0,003 por interação. Obtenha sua chave em platform.openai.com'}
                                    {aiConfig.provider === 'abacus-route' && '💡 Abacus AI: Roteamento inteligente de modelos. Insira sua chave do Abacus.'}
                                    {aiConfig.provider === 'desativado' && 'O assistente IA ficará indisponível para todos os usuários.'}
                                </p>
                            </div>

                            {/* API Key */}
                            {aiConfig.provider !== 'desativado' && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Chave de API ({aiConfig.provider === 'gemini-flash' ? 'Google AI Studio' : 'OpenAI'})</Label>
                                        <div className="relative">
                                            <Input
                                                type={showApiKey ? "text" : "password"}
                                                value={aiConfig.apiKey}
                                                onChange={(e) => updateAIConfig({ apiKey: e.target.value })}
                                                autoComplete="new-password"
                                                placeholder={
                                                    aiConfig.provider === 'gemini-flash' ? 'AIzaSy...' : 
                                                    aiConfig.provider === 'abacus-route' ? 'Abacus API Key...' : 'sk-proj-...'
                                                }
                                                className="pr-10 bg-muted/50 focus-visible:bg-background font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">🔒 A chave é armazenada localmente e enviada somente ao provedor selecionado via backend seguro.</p>
                                    </div>

                                    {/* System Prompt */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Instrução do Bot (System Prompt)</Label>
                                        <textarea
                                            value={aiConfig.systemPrompt}
                                            onChange={(e) => updateAIConfig({ systemPrompt: e.target.value })}
                                            rows={5}
                                            className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background resize-none"
                                            placeholder="Instruções que definem o comportamento do assistente..."
                                        />
                                        <p className="text-xs text-muted-foreground">Define o comportamento e escopo do bot. Use para restringir assuntos e personalizar respostas.</p>
                                    </div>

                                    {/* Limite Mensal */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Limite Mensal de Interações</Label>
                                        <Input
                                            type="number"
                                            min={10}
                                            max={10000}
                                            value={aiConfig.monthlyLimit}
                                            onChange={(e) => updateAIConfig({ monthlyLimit: Number(e.target.value) || 500 })}
                                            className="max-w-[200px] bg-muted/50 focus-visible:bg-background"
                                        />
                                        <p className="text-xs text-muted-foreground">Quando o limite é atingido, o assistente é bloqueado até o próximo mês. Protege contra uso excessivo.</p>
                                    </div>

                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4 pb-8">
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-8 shadow-sm">
                        <Save className="size-4" />
                        {isSaving ? "Salvando..." : "Salvar Todas as Configurações"}
                    </Button>
                </div>
            </div>
    )
}

function ConfiguracoesPageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'geral';

    return (
        <div className="max-w-4xl mx-auto">
            <Tabs defaultValue={tab} className="w-full">
                <TabsList className="mb-6 grid w-full grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="geral">Geral & IA</TabsTrigger>
                    <TabsTrigger value="crm">CRM (Leads)</TabsTrigger>
                </TabsList>
                <TabsContent value="geral" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
                    <ConfiguracoesForm />
                </TabsContent>
                <TabsContent value="crm" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
                    <CRMConfig />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function ConfiguracoesPage() {
    return (
        <AppShell>
            <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin size-8 text-primary" /></div>}>
                <ConfiguracoesPageContent />
            </Suspense>
        </AppShell>
    )
}
