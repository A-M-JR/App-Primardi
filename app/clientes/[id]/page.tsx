"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Building2, MapPin, Contact, FileText, Factory, UserCircle, Sparkles, Plus, Trash2, Wallet, PlusCircle, MinusCircle, History, Tag, ChevronRight } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { StatusBadge } from "@/components/ui/status-badge"
import { getClienteById, saveCliente } from "@/lib/actions/clientes"
import { getTabelasPreco } from "@/lib/actions/tabelas-preco"
import { addMovimentacaoCredito, getMovimentacoesByCliente } from "@/lib/actions/creditos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { use, useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// Helpers para Mascaras
const maskCNPJ = (value: string) => {
  const v = value.replace(/\D/g, "")
  if (v.length <= 11) {
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  } else {
    return v
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18)
  }
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

export default function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  
  const [clienteOrig, setClienteOrig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    tabelaPrecoId: "none",
    observacoes: "",
    itensExclusivos: [] as { nome: string; preco: string | number; descricao?: string }[]
  })

  const [tabelas, setTabelas] = useState<any[]>([])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  
  // Controle de Créditos
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [isLançandoCredito, setIsLançandoCredito] = useState(false)
  const [novoLancamento, setNovoLancamento] = useState({
    tipo: 'VALOR' as 'VALOR' | 'UNIDADE',
    operacao: 'CREDITO' as 'CREDITO' | 'DEBITO',
    quantidade: '',
    descricao: ''
  })

  useEffect(() => {
    getClienteById(Number(id)).then(data => {
      if (data) {
        setClienteOrig(data)
        setFormData({
          razaoSocial: data.razaoSocial || "",
          nomeFantasia: data.nomeFantasia || "",
          cnpj: data.cnpj || "",
          ie: data.ie || "",
          telefone: data.telefone || "",
          email: data.email || "",
          compradorNome: data.compradorNome || "",
          compradorTelefone: data.compradorTelefone || "",
          cep: data.cep || "",
          logradouro: data.logradouro || "",
          numeroEnd: data.numeroEnd || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
          tabelaPrecoId: data.tabelaPrecoId ? String(data.tabelaPrecoId) : "none",
          observacoes: data.observacoes || "",
          itensExclusivos: data.itensExclusivos || []
        })
      }
      setLoading(false)
    })

    getTabelasPreco().then(res => setTabelas(res || []))

    // Carregar movimentações
    getMovimentacoesByCliente(Number(id)).then(setMovimentacoes)
  }, [id])

  const handleLancamento = async () => {
    if (!novoLancamento.quantidade || Number(novoLancamento.quantidade) <= 0) {
      toast.error("Informe uma quantidade válida.")
      return
    }

    setIsLançandoCredito(true)
    try {
      await addMovimentacaoCredito({
        clienteId: Number(id),
        tipo: novoLancamento.tipo,
        operacao: novoLancamento.operacao,
        quantidade: Number(novoLancamento.quantidade),
        descricao: novoLancamento.descricao
      })
      
      toast.success("Movimentação realizada com sucesso!")
      
      // Atualizar dados locais
      const updatedData = await getClienteById(Number(id))
      if (updatedData) setClienteOrig(updatedData)
      
      const updatedMovs = await getMovimentacoesByCliente(Number(id))
      setMovimentacoes(updatedMovs)
      
      setNovoLancamento({ tipo: 'VALOR', operacao: 'CREDITO', quantidade: '', descricao: '' })
    } catch (error) {
      console.error(error)
      toast.error("Erro ao processar lançamento.")
    } finally {
      setIsLançandoCredito(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <p className="text-muted-foreground">Carregando dados do cliente...</p>
        </div>
      </AppShell>
    )
  }

  if (!clienteOrig) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Cliente não encontrado.</p>
          <Link href="/clientes">
            <Button variant="outline" className="mt-4">Voltar</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const clienteOrcamentos = clienteOrig.orcamentos || []
  const clientePedidos = clienteOrig.pedidos || []

  const fetchCNPJ = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "")
    if (cleanCnpj.length !== 14) return

    const loadingId = toast.loading("Verificando CNPJ na Receita Federal...")

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
      const data = await res.json()

      if (res.ok) {
        setFormData(prev => ({
          ...prev,
          razaoSocial: data.razao_social || data.nome_fantasia || prev.razaoSocial,
          cep: data.cep ? maskCEP(data.cep.toString()) : prev.cep,
          logradouro: data.logradouro || prev.logradouro,
          numeroEnd: data.numero || prev.numeroEnd,
          bairro: data.bairro || prev.bairro,
          complemento: data.complemento || prev.complemento,
          cidade: data.municipio || prev.cidade,
          estado: data.uf || prev.estado,
          telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1.toString()) : prev.telefone,
          email: data.email || prev.email,
        }))
        setErrors(prev => ({
          ...prev, razaoSocial: "", cep: "", cidade: "", estado: "", telefone: ""
        }))
        toast.success("Dados da Receita atualizados no formulário!", { id: loadingId })
      } else {
        toast.error("CNPJ não encontrado na base da Receita.", { id: loadingId })
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error)
      toast.error("Falha ao comunicar com a Receita Federal.", { id: loadingId })
    }
  }

  const fetchCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          complemento: data.complemento || prev.complemento,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }))
        setErrors(prev => ({ ...prev, cidade: "", estado: "" }))
        toast.success("Endereço encontrado e autocompletado!")
      } else {
        toast.error("CEP não encontrado na base dos Correios.")
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error)
      toast.error("Falha ao buscar CEP. Verifique sua conexão.")
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
      if (value.length === 9) {
        fetchCEP(value)
      }
    }
    if (name === "estado") value = maskUF(value)

    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    const newErrors: Record<string, string> = {}

    if (!formData.razaoSocial) newErrors.razaoSocial = "Razão Social é obrigatória"
    if (!formData.cnpj) newErrors.cnpj = "CNPJ / CPF é obrigatório"
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
      const dataToSave = { ...formData, id: Number(id) }
      if (dataToSave.tabelaPrecoId === "none" || !dataToSave.tabelaPrecoId) {
          (dataToSave as any).tabelaPrecoId = null
      } else {
          (dataToSave as any).tabelaPrecoId = Number(dataToSave.tabelaPrecoId)
      }

      await saveCliente(dataToSave)
      toast.success("Cliente atualizado com sucesso!", {
        description: `Os dados de ${formData.razaoSocial} foram salvos.`
      })
      router.push("/clientes")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar o cliente no banco de dados.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

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
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                Editar Cliente
                {clienteOrig.leadOrigem && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 font-medium">
                    <Sparkles className="size-3 mr-1" />
                    Origem: Lead do CRM
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                Cliente desde {clienteOrig.criadoEm ? new Date(clienteOrig.criadoEm).toLocaleDateString("pt-BR") : "Desconhecido"}
                {clienteOrig.leadOrigem?.dataConversao && (
                  <span className="text-indigo-600/80 text-xs">(Convertido em {new Date(clienteOrig.leadOrigem.dataConversao).toLocaleDateString("pt-BR")})</span>
                )}
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
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </div>

          <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/20 p-1">
            <TabsTrigger value="geral" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="size-4 mr-2" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <History className="size-4 mr-2" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="creditos" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Wallet className="size-4 mr-2" />
              Créditos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="animate-in fade-in duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-12 flex flex-col gap-6">
                
                {/* Mesma estrutura anterior reorganizada sem a barra lateral de histórico aqui */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Dados da Empresa */}
                  <Card className="shadow-sm border-border/50 relative overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <Building2 className="size-4" />
                        <h3>Dados da Empresa</h3>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="razaoSocial">Razão Social *</Label>
                        <Input id="razaoSocial" name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                        <Input id="nomeFantasia" name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ / CPF *</Label>
                        <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} maxLength={18} className="bg-muted/30" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ie">Inscrição Estadual</Label>
                        <Input id="ie" name="ie" value={formData.ie} onChange={handleChange} className="bg-muted/30" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Endereço */}
                  <Card className="shadow-sm border-border/50 relative overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <MapPin className="size-4" />
                        <h3>Endereço</h3>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-4 space-y-2">
                        <Label htmlFor="cep">CEP *</Label>
                        <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} maxLength={9} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-8 space-y-2">
                        <Label htmlFor="logradouro">Logradouro</Label>
                        <Input id="logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="numeroEnd">Núm</Label>
                        <Input id="numeroEnd" name="numeroEnd" value={formData.numeroEnd} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-5 space-y-2">
                        <Label htmlFor="complemento">Complemento</Label>
                        <Input id="complemento" name="complemento" value={formData.complemento} onChange={handleChange} className="bg-muted/30" placeholder="Sala 1, Galpão A..." />
                      </div>
                      <div className="sm:col-span-5 space-y-2">
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input id="bairro" name="bairro" value={formData.bairro} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-6 space-y-2">
                        <Label>Cidade</Label>
                        <Input id="cidade" name="cidade" value={formData.cidade} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="sm:col-span-3 space-y-2">
                        <Label>UF</Label>
                        <Input id="estado" name="estado" value={formData.estado} onChange={handleChange} maxLength={2} className="bg-muted/30 uppercase" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Contato */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-4 text-primary font-medium flex-row gap-2 items-center">
                      <Contact className="size-4" /> Contatos
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Fone Empresa</Label>
                        <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleChange} className="bg-muted/30" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fone Comprador</Label>
                        <Input name="compradorTelefone" value={formData.compradorTelefone} onChange={handleChange} className="bg-muted/30" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Itens Exclusivos (Ribom/Tubete/etc) */}
                  <Card className="shadow-sm border-border/50 lg:col-span-1 overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/5 border-b flex-row items-center justify-between">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-tight">
                        <Sparkles className="size-3" /> Itens Exclusivos
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-primary hover:bg-primary/10"
                        onClick={() => setFormData(prev => ({...prev, itensExclusivos: [...(prev.itensExclusivos || []), {nome: "", preco: 0}]}))}
                      >
                        <Plus className="size-3 mr-1" /> Adicionar
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[220px] overflow-y-auto overflow-x-hidden scrollbar-thin">
                        {(formData.itensExclusivos || []).length === 0 ? (
                          <div className="py-8 text-center text-[10px] text-muted-foreground italic px-4">
                            Nenhum item exclusivo (ex: Ribom, Tubete) cadastrado.
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {formData.itensExclusivos.map((it, idx) => (
                              <div key={idx} className="p-3 flex items-center gap-3 bg-card hover:bg-muted/10 transition-colors animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-[10px] font-medium text-muted-foreground uppercase">Nome do Item</Label>
                                  <Input 
                                    value={it.nome} 
                                    placeholder="Ex: Ribom"
                                    onChange={(e) => {
                                      const n = [...formData.itensExclusivos]; 
                                      n[idx].nome = e.target.value; 
                                      setFormData({...formData, itensExclusivos: n});
                                    }} 
                                    className="h-8 text-xs bg-background/50 border-border/60 focus:bg-background" 
                                  />
                                </div>
                                <div className="w-24 space-y-1">
                                  <Label className="text-[10px] font-medium text-muted-foreground uppercase">Preço (R$)</Label>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    value={it.preco} 
                                    onChange={(e) => {
                                      const n = [...formData.itensExclusivos]; 
                                      n[idx].preco = parseFloat(e.target.value) || 0; 
                                      setFormData({...formData, itensExclusivos: n});
                                    }} 
                                    className="h-8 text-xs bg-background/50 border-border/60 font-mono focus:bg-background" 
                                  />
                                </div>
                                <div className="pt-5 mr-1">
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      const n = formData.itensExclusivos.filter((_, i) => i !== idx);
                                      setFormData({...formData, itensExclusivos: n});
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Info Add */}
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-4 font-medium">Informações Adicionais</CardHeader>
                    <CardContent className="space-y-4">

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea name="observacoes" value={formData.observacoes} onChange={handleChange} className="min-h-[100px] bg-muted/30 resize-none text-xs" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Orçamentos */}
              <Card className="shadow-sm border-border/50">
                <CardHeader className="border-b bg-muted/5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4 text-primary" /> Histórico de Orçamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-auto">
                  {clienteOrcamentos.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro.</div>
                  ) : (
                    <div className="divide-y">
                      {clienteOrcamentos.map((orc: any) => (
                        <div key={orc.id} className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors">
                          <div className="flex flex-col">
                            <Link href={`/orcamentos/${orc.id}`} className="font-bold text-sm text-primary hover:underline flex items-center gap-1">
                              {orc.numero}
                              <ChevronRight className="size-3" />
                            </Link>
                            <span className="text-xs text-muted-foreground">{new Date(orc.criadoEm).toLocaleDateString()}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-sm text-primary">{formatCurrency(orc.totalGeral)}</span>
                            <StatusBadge statusObj={orc.statusObj} fallback={orc.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pedidos */}
              <Card className="shadow-sm border-border/50">
                <CardHeader className="border-b bg-muted/5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Factory className="size-4 text-blue-600" /> Histórico de Produção
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-auto">
                  {clientePedidos.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro.</div>
                  ) : (
                    <div className="divide-y">
                      {clientePedidos.map((ped: any) => (
                        <div key={ped.id} className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors">
                          <div className="flex flex-col">
                            <Link href={`/pedidos/${ped.id}`} className="font-bold text-sm text-blue-600 hover:underline flex items-center gap-1">
                              {ped.numero}
                              <ChevronRight className="size-3" />
                            </Link>
                            <span className="text-xs text-muted-foreground">{new Date(ped.criadoEm).toLocaleDateString()}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-sm">{formatCurrency(ped.totalGeral)}</span>
                            <StatusBadge statusObj={ped.statusObj} fallback={ped.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="creditos" className="animate-in fade-in duration-300">
            <div className="flex flex-col gap-6">
              {/* Info de Saldos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10">
                    <Wallet className="size-32" />
                  </div>
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-2">Saldo em Valor</div>
                    <div className="text-5xl font-black text-emerald-700">
                      {formatCurrency(clienteOrig.saldoCreditoValor || 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10">
                    <Tag className="size-32" />
                  </div>
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-2">Saldo em Unidades</div>
                    <div className="text-5xl font-black text-blue-700">
                      {(clienteOrig.saldoCreditoProdutos || 0).toLocaleString()} <span className="text-xl font-medium">un</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Botão de Lançamento */}
              <div className="flex justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:scale-[1.02] transition-transform shadow-md">
                      <PlusCircle className="size-4 mr-2" />
                      Novo Lançamento Manuseado
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Lançamento de Crédito/Débito</DialogTitle>
                      <DialogDescription>
                        Ajuste o saldo do cliente manualmente para bonificações ou correções.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Tipo</Label>
                        <Select value={novoLancamento.tipo} onValueChange={(v:any) => setNovoLancamento({...novoLancamento, tipo: v})}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VALOR">Valor (R$)</SelectItem>
                            <SelectItem value="ETIQUETA">Unidades</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Operação</Label>
                        <Select value={novoLancamento.operacao} onValueChange={(v:any) => setNovoLancamento({...novoLancamento, operacao: v})}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CREDITO">Crédito (Aumentar)</SelectItem>
                            <SelectItem value="DEBITO">Débito (Diminuir)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Quantidade</Label>
                        <Input 
                          type="number" 
                          autoFocus
                          value={novoLancamento.quantidade} 
                          onChange={(e) => setNovoLancamento({...novoLancamento, quantidade: e.target.value})}
                          className="col-span-3"
                          placeholder={novoLancamento.tipo === 'VALOR' ? '0.00' : '0'}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Motivo</Label>
                        <Input 
                          value={novoLancamento.descricao} 
                          onChange={(e) => setNovoLancamento({...novoLancamento, descricao: e.target.value})}
                          className="col-span-3"
                          placeholder="Ex: Bonificacao por erro no lote anterior"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" disabled={isLançandoCredito} onClick={handleLancamento}>
                        {isLançandoCredito ? "Processando..." : "Confirmar Lançamento"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Tabela de Histórico */}
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="size-4" /> Histórico de Movimentações
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted/30 text-muted-foreground font-bold">
                        <tr>
                          <th className="px-6 py-3">Data</th>
                          <th className="px-6 py-3">Tipo</th>
                          <th className="px-6 py-3">Operação</th>
                          <th className="px-6 py-3 text-right">Quantidade</th>
                          <th className="px-6 py-3">Descrição/Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {movimentacoes.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
                        ) : (
                          movimentacoes.map((m: any) => (
                            <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-3 text-xs text-muted-foreground">
                                {new Date(m.criadoEm).toLocaleDateString()} {new Date(m.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="px-6 py-3 font-medium">
                                <Badge variant="outline" className={m.tipo === 'VALOR' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}>
                                  {m.tipo}
                                </Badge>
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-1.5 font-bold">
                                  {m.operacao === 'CREDITO' ? (
                                    <PlusCircle className="size-4 text-emerald-500" />
                                  ) : (
                                    <MinusCircle className="size-4 text-rose-500" />
                                  )}
                                  <span className={m.operacao === 'CREDITO' ? "text-emerald-600" : "text-rose-600"}>
                                    {m.operacao}
                                  </span>
                                </div>
                              </td>
                              <td className={`px-6 py-3 text-right font-mono font-bold ${m.operacao === 'CREDITO' ? "text-emerald-700" : "text-rose-700"}`}>
                                {m.operacao === 'CREDITO' ? '+' : '-'} {m.tipo === 'VALOR' ? formatCurrency(m.quantidade) : `${m.quantidade.toLocaleString()} un`}
                              </td>
                              <td className="px-6 py-3 text-muted-foreground italic text-xs">
                                {m.descricao || "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </AppShell>
  )
}
