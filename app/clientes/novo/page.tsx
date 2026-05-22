"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Building2, MapPin, Contact, UserCircle, Sparkles, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { saveCliente } from "@/lib/actions/clientes"

// Utils simples para mascaras
const maskCNPJ = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .substring(0, 18)
}

const maskPhone = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4,5})(\d{4})/, "$1-$2")
        .substring(0, 15)
}

const maskCEP = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/^(\d{5})(\d)/, "$1-$2")
        .substring(0, 9)
}

const maskUF = (value: string) => {
    return value.replace(/[^A-Za-z]/g, "").toUpperCase().substring(0, 2)
}

export default function NovoClientePage() {
    return (
        <AppShell>
            <Suspense fallback={<div>Carregando...</div>}>
                <NovoClienteContent />
            </Suspense>
        </AppShell>
    )
}

function NovoClienteContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [formData, setFormData] = useState({
        razaoSocial: "",
        nomeFantasia: "",
        cnpj: "",
        ie: "",
        telefone: "",
        email: "",
        compradorNome: "",
        compradorTelefone: "",
        cep: "",
        logradouro: "",
    numeroEnd: "",
    bairro: "",
    cep: "",
        numero: "",
        cidade: "",
        estado: "",
        observacoes: "",
        itensExclusivos: [] as { nome: string; preco: string; descricao?: string }[]
    })

    // 🤖 Automação via IA: Preenchimento proativo baseado na URL
    useEffect(() => {
        const aiRazao = searchParams.get("razao")
        const aiCnpj = searchParams.get("cnpj")
        const aiEmail = searchParams.get("email")
        const aiTel = searchParams.get("tel")
        const aiCep = searchParams.get("cep")
        const aiEnd = searchParams.get("end")
        const aiNum = searchParams.get("num")
        const aiCid = searchParams.get("cid")
        const aiUf = searchParams.get("uf")

        if (aiRazao || aiCnpj) {
            const cleanCnpj = aiCnpj?.replace(/\D/g, "") || ""

            setFormData(prev => ({
                ...prev,
                razaoSocial: aiRazao || prev.razaoSocial,
                cnpj: aiCnpj ? maskCNPJ(aiCnpj) : prev.cnpj,
                email: aiEmail || prev.email,
                telefone: aiTel ? maskPhone(aiTel) : prev.telefone,
                cep: aiCep ? maskCEP(aiCep) : prev.cep,
                logradouro: aiEnd || prev.endereco,
                numero: aiNum || prev.numero,
                cidade: aiCid || prev.cidade,
                estado: aiUf ? maskUF(aiUf) : prev.estado,
            }))

            // 🚀 AUTOMATIZAÇÃO: Se temos o CNPJ, dispara a busca detalhada imediatamente
            if (cleanCnpj.length === 14) {
                fetchCNPJ(cleanCnpj)
            } else {
                toast.info("Ficha de cliente preparada pela IA", {
                    description: "Verifique os dados antes de salvar."
                })
            }
        }
    }, [searchParams])

    // Erros simples
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = useState(false)

    // Busca de CNPJ via BrasilAPI
    const fetchCNPJ = async (cnpj: string) => {
        const cleanCnpj = cnpj.replace(/\D/g, "")
        if (cleanCnpj.length !== 14) return

        const loadingId = toast.loading("Consultando Receita Federal...")

        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
            const data = await res.json()

            if (res.ok) {
                setFormData(prev => ({
                    ...prev,
                razaoSocial: data.razao_social || data.nome_fantasia || prev.razaoSocial,
                nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
                cep: data.cep ? maskCEP(data.cep.toString()) : prev.cep,
                logradouro: data.logradouro || prev.endereco,
                numero: data.numero || prev.numero,
                cidade: data.municipio || prev.cidade,
                estado: data.uf || prev.estado,
                telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1.toString()) : prev.telefone,
                email: data.email || prev.email,
                }))
                // Limpa erros dos campos preenchidos
                setErrors(prev => ({
                    ...prev,
                    razaoSocial: "",
                    cep: "",
                    cidade: "",
                    estado: "",
                    telefone: ""
                }))
                toast.success("Dados da empresa preenchidos com sucesso!", { id: loadingId })
            } else {
                toast.error("CNPJ não encontrado na base da Receita.", { id: loadingId })
            }
        } catch (error) {
            // console.error("Erro ao buscar CNPJ:", error)
            toast.error("Falha ao comunicar com a Receita Federal.", { id: loadingId })
        }
    }

    // Busca ViaCEP
    const fetchCEP = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, "")
        if (cleanCep.length !== 8) return

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await res.json()

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    logradouro: data.logradouro ? `${data.logradouro}${data.bairro ? ` - ${data.bairro}` : ""}` : prev.endereco,
                    cidade: data.localidade || prev.cidade,
                    estado: data.uf || prev.estado,
                }))
                // Limpar possíveis erros destes campos
                setErrors(prev => ({ ...prev, cidade: "", estado: "" }))
                toast.success("Endereço auto-preenchido pelo CEP!")
            } else {
                toast.error("CEP não encontrado.")
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error)
            toast.error("Falha na consulta do CEP.")
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target

        if (name === "cnpj") {
            value = maskCNPJ(value)
            if (value.length === 18) {
                fetchCNPJ(value)
            }
        }
        if (name === "telefone" || name === "compradorTelefone") value = maskPhone(value)
        if (name === "cep") {
            value = maskCEP(value)
            // Se CEP estiver completo (9 chars com o traço), busca automático
            if (value.length === 9) {
                fetchCEP(value)
            }
        }
        if (name === "estado") value = maskUF(value)

        setFormData(prev => ({ ...prev, [name]: value }))
        // Clear error
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSaving) return
        const newErrors: Record<string, string> = {}

        // Validação mock
        if (!formData.razaoSocial) newErrors.razaoSocial = "Razão Social é obrigatória"
        if (!formData.cnpj) newErrors.cnpj = "CNPJ é obrigatório"
        if (!formData.telefone) newErrors.telefone = "Telefone é obrigatório"
        if (!formData.cidade) newErrors.cidade = "Cidade é obrigatória"
        if (!formData.estado) newErrors.estado = "UF é obrigatório"

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            toast.error("Por favor, preencha todos os campos obrigatórios.")
            return
        }

        setIsSaving(true)
        try {
            await saveCliente(formData)
            toast.success("Cliente salvo com sucesso!", {
                description: `O cliente ${formData.razaoSocial} foi adicionado à carteira.`
            })
            router.push("/clientes")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Erro ao salvar o cliente no banco de dados.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/clientes">
                            <Button type="button" variant="outline" size="icon" className="size-8 rounded-full shadow-sm hover:bg-muted">
                                <ArrowLeft className="size-4" />
                                <span className="sr-only">Voltar</span>
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Cliente</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Adicione um novo cliente corporativo para faturamento e produção.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button type="button" variant="ghost" asChild>
                            <Link href="/clientes">Cancelar</Link>
                        </Button>
                        <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground shadow-sm hover:scale-[1.02] transition-transform">
                            {isSaving ? "Salvando..." : (
                                <>
                                    <Save className="size-4 mr-2" />
                                    Salvar Cliente
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* Coluna Principal */}
                    <div className="md:col-span-8 flex flex-col gap-6">

                        {/* Secao Empresa */}
                        <Card className="shadow-sm border-border/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <Building2 className="size-32" />
                            </div>
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2 text-primary font-medium">
                                    <Building2 className="size-4" />
                                    <h3>Dados da Empresa</h3>
                                </div>
                                <CardDescription>Informações fiscais e identificação do cliente</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2 space-y-2">
                                    <Label htmlFor="razaoSocial" className={errors.razaoSocial ? "text-destructive" : ""}>Razão Social *</Label>
                                    <Input
                                        id="razaoSocial"
                                        name="razaoSocial"
                                        value={formData.razaoSocial}
                                        onChange={handleChange}
                                        className={`bg-muted/30 focus-visible:bg-background ${errors.razaoSocial ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        placeholder="Ex: Industria e Comercio XYZ Ltda"
                                    />
                                    {errors.razaoSocial && <p className="text-xs text-destructive">{errors.razaoSocial}</p>}
                                </div>

                                <div className="sm:col-span-2 space-y-2">
                                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                                    <Input
                                        id="nomeFantasia"
                                        name="nomeFantasia"
                                        value={formData.nomeFantasia}
                                        onChange={handleChange}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="Ex: Newflexo Etiquetas"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="cnpj" className={errors.cnpj ? "text-destructive" : ""}>CNPJ *</Label>
                                    <Input
                                        id="cnpj"
                                        name="cnpj"
                                        value={formData.cnpj}
                                        onChange={handleChange}
                                        maxLength={18}
                                        className={`bg-muted/30 focus-visible:bg-background ${errors.cnpj ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        placeholder="00.000.000/0000-00"
                                    />
                                    {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ie">Inscrição Estadual</Label>
                                    <Input
                                        id="ie"
                                        name="ie"
                                        value={formData.ie}
                                        onChange={handleChange}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="Isento ou Nº da Inscrição"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Secao Endereco */}
                        <Card className="shadow-sm border-border/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <MapPin className="size-32" />
                            </div>
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2 text-primary font-medium">
                                    <MapPin className="size-4" />
                                    <h3>Endereço</h3>
                                </div>
                                <CardDescription>Localização para entrega de pedidos e faturamento</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-12">

                                <div className="sm:col-span-4 space-y-2">
                                    <Label htmlFor="cep">CEP *</Label>
                                    <Input
                                        id="cep"
                                        name="cep"
                                        value={formData.cep}
                                        onChange={handleChange}
                                        maxLength={9}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="00000-000"
                                    />
                                </div>

                                <div className="sm:col-span-8 space-y-2">
                                    <Label htmlFor="endereco">Logradouro / Rua</Label>
                                    <Input
                                        id="endereco"
                                        name="endereco"
                                        value={formData.logradouro}
                                        onChange={handleChange}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="Av. Principal"
                                    />
                                </div>

                                <div className="sm:col-span-3 space-y-2">
                                    <Label htmlFor="numero">Número</Label>
                                    <Input
                                        id="numero"
                                        name="numero"
                                        value={formData.numero}
                                        onChange={handleChange}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="S/N"
                                    />
                                </div>

                                <div className="sm:col-span-6 space-y-2">
                                    <Label htmlFor="cidade" className={errors.cidade ? "text-destructive" : ""}>Cidade *</Label>
                                    <Input
                                        id="cidade"
                                        name="cidade"
                                        value={formData.cidade}
                                        onChange={handleChange}
                                        className={`bg-muted/30 focus-visible:bg-background ${errors.cidade ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        placeholder="São Paulo"
                                    />
                                    {errors.cidade && <p className="text-xs text-destructive">{errors.cidade}</p>}
                                </div>

                                <div className="sm:col-span-3 space-y-2">
                                    <Label htmlFor="estado" className={errors.estado ? "text-destructive" : ""}>UF *</Label>
                                    <Input
                                        id="estado"
                                        name="estado"
                                        value={formData.estado}
                                        onChange={handleChange}
                                        maxLength={2}
                                        className={`bg-muted/30 focus-visible:bg-background uppercase ${errors.estado ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        placeholder="SP"
                                    />
                                    {errors.estado && <p className="text-xs text-destructive">{errors.estado}</p>}
                                </div>

                            </CardContent>
                        </Card>

                    </div>

                    {/* Coluna Lateral */}
                    <div className="md:col-span-4 flex flex-col gap-6">

                        {/* Secao Contato */}
                        <Card className="shadow-sm border-border/50">
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2 text-primary font-medium">
                                    <Contact className="size-4" />
                                    <h3>Contato</h3>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="telefone" className={errors.telefone ? "text-destructive" : ""}>Telefone Principal *</Label>
                                    <Input
                                        id="telefone"
                                        name="telefone"
                                        value={formData.telefone}
                                        onChange={handleChange}
                                        maxLength={15}
                                        className={`bg-muted/30 focus-visible:bg-background ${errors.telefone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                        placeholder="(00) 00000-0000"
                                    />
                                    {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail de Contato</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="bg-muted/30 focus-visible:bg-background"
                                        placeholder="contato@empresa.com"
                                    />
                                </div>

                                <div className="pt-4 border-t border-border/50 space-y-4">
                                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                        <UserCircle className="size-4" />
                                        <h4>Contato Direto (Comprador)</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="compradorNome">Nome do Comprador</Label>
                                        <Input
                                            id="compradorNome"
                                            name="compradorNome"
                                            value={formData.compradorNome}
                                            onChange={handleChange}
                                            className="bg-muted/30 focus-visible:bg-background"
                                            placeholder="João Silva"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="compradorTelefone">Telefone do Comprador</Label>
                                        <Input
                                            id="compradorTelefone"
                                            name="compradorTelefone"
                                            value={formData.compradorTelefone}
                                            onChange={handleChange}
                                            maxLength={15}
                                            className="bg-muted/30 focus-visible:bg-background"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Secao Itens Exclusivos */}
                        <Card className="shadow-sm border-border/50">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary font-medium">
                                        <Sparkles className="size-4" />
                                        <h3>Itens Exclusivos (Insumos)</h3>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setFormData(prev => ({
                                            ...prev,
                                            itensExclusivos: [...prev.itensExclusivos, { nome: "", preco: "0" }]
                                        }))}
                                    >
                                        <Plus className="size-4 mr-2" /> Adicionar
                                    </Button>
                                </div>
                                <CardDescription>Ribbons, tubetes e outros materiais recorrentes deste cliente</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {formData.itensExclusivos.length === 0 ? (
                                    <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                        Nenhum item exclusivo cadastrado.
                                    </div>
                                ) : (
                                    formData.itensExclusivos.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg bg-muted/20 border border-border/50">
                                            <div className="col-span-7 space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome do Item</Label>
                                                <Input 
                                                    placeholder="Ex: Ribbon 110x74 Cera" 
                                                    value={item.nome}
                                                    onChange={(e) => {
                                                        const newItens = [...formData.itensExclusivos];
                                                        newItens[idx].nome = e.target.value;
                                                        setFormData(prev => ({ ...prev, itensExclusivos: newItens }));
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="col-span-3 space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Preço (R$)</Label>
                                                <Input 
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00" 
                                                    value={item.preco}
                                                    onChange={(e) => {
                                                        const newItens = [...formData.itensExclusivos];
                                                        newItens[idx].preco = e.target.value;
                                                        setFormData(prev => ({ ...prev, itensExclusivos: newItens }));
                                                    }}
                                                    className="h-8 text-sm font-mono"
                                                />
                                            </div>
                                            <div className="col-span-2 pb-0.5">
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        const newItens = formData.itensExclusivos.filter((_, i) => i !== idx);
                                                        setFormData(prev => ({ ...prev, itensExclusivos: newItens }));
                                                    }}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Secao Outros */}
                        <Card className="shadow-sm border-border/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base">Informações Adicionais</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <Label>Observações do Cliente</Label>
                                    <Textarea
                                        name="observacoes"
                                        value={formData.observacoes}
                                        onChange={handleChange}
                                        className="min-h-[120px] bg-muted/30 focus-visible:bg-background resize-none"
                                        placeholder="Instruções de entrega, particularidades do cliente, horários de funcionamento..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                </div>
            </form>
    )
}
