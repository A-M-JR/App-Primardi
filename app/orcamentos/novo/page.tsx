"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ArrowLeft, Plus, Trash2, RotateCcw, ChevronDown, Tag, Sparkles, Building2, MapPin, Calculator, UserCircle, Save, Check, CreditCard, Wallet, MinusCircle, AlertCircle } from "lucide-react"
import { produtos, formatCurrency } from "@/lib/mock-data"
import { getClientes, getClienteById } from "@/lib/actions/clientes"
import { getVendedores } from "@/lib/actions/vendedores"
import { getOrcamentos, saveOrcamento } from "@/lib/actions/orcamentos"
import { getProdutos } from "@/lib/actions/produtos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

interface NovoItem {
  id: string
  descricao: string
  quantidade: number | string
  unidade: string
  precoUnitario: number | string
  observacao: string
}

export default function NovoOrcamentoPage() {
  return (
    <AppShell>
      <Suspense fallback={<div>Carregando...</div>}>
        <NovoOrcamentoContent />
      </Suspense>
    </AppShell>
  )
}

function NovoOrcamentoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useAuth()

  const [clienteId, setClienteId] = useState<number | "">("")
  const [vendedorId, setVendedorId] = useState<number | "">("")
  const [itens, setItens] = useState<NovoItem[]>([])
  const [observacoes, setObservacoes] = useState("")
  const [showRecompra, setShowRecompra] = useState(false)
  const [openCatalogo, setOpenCatalogo] = useState(false)
  const [openCliente, setOpenCliente] = useState(false)

  const [clientes, setClientes] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])
  const [todosOrcamentos, setTodosOrcamentos] = useState<any[]>([])
  const [produtosList, setProdutosList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formasPagamento, setFormasPagamento] = useState<any[]>([])
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>("")
  const [prazoEntrega, setPrazoEntrega] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  })

  // Estados de Crédito
  const [descontoCredito, setDescontoCredito] = useState<number>(0)
  const [itensCreditoQtd, setItensCreditoQtd] = useState<Record<string, number>>({}) // id -> quantidade bonificada
  const [ocCliente, setOcCliente] = useState("")
  const aiProcessedRef = useRef(false) // 🔒 Trava contra loop de automação

  useEffect(() => {
    Promise.all([
      getClientes({ limit: 100, mode: 'full' }), // Mudado para 'full' para trazer itensExclusivos
      getVendedores(),
      getOrcamentos({ limit: 50, mode: 'history' }),
      getProdutos(),
      fetch("/api/formas-pagamento").then(res => res.json())
    ]).then(([cls, vds, orcs, etqs, formas]) => {
      setClientes(cls.data || [])
      setVendedores(vds)
      setTodosOrcamentos(orcs.data || [])
      setProdutosList(etqs)
      setFormasPagamento(formas || [])
      setLoading(false)
    })
  }, [])

  // Auto-seleção do vendedor logado
  useEffect(() => {
    if (currentUser?.vendedorId && !vendedorId) {
      setVendedorId(currentUser.vendedorId)
    }
  }, [currentUser])

  // 🤖 Automação via IA: Preenchimento proativo baseado na URL
  useEffect(() => {
    const aiCliente = searchParams.get("cliente")
    const aiItens = searchParams.get("itens")
    const aiQtd = searchParams.get("qtd")
    const aiUnid = searchParams.get("unid")
    const aiObs = searchParams.get("obs")

    if (aiProcessedRef.current) return // Já processou esta automação

    if (aiCliente && clientes.length > 0) {
      const searchNormalized = aiCliente.toLowerCase().trim().replace(/\D/g, '') // Remove tudo que não é número para testar CNPJ
      const searchName = aiCliente.toLowerCase().trim()

      // Busca inteligente: tenta encontrar por CNPJ (se for número) ou por nome
      const match = clientes.find(c => {
        const cnpjMatch = c.cnpj && c.cnpj.replace(/\D/g, '').includes(searchNormalized) && searchNormalized.length > 5
        const nameMatch = c.razaoSocial.toLowerCase().includes(searchName)
        return cnpjMatch || nameMatch
      })

      if (match && clienteId !== match.id) {
        handleClienteChange(match.id.toString())
      }
    }

    if (aiItens && itens.length === 0) {
      // Converte a descrição da IA em um item inicial com quantidade e unidade corretas
      setItens([{
        id: "ai-item-1",
        descricao: aiItens,
        quantidade: aiQtd ? (parseFloat(aiQtd) || 1) : 1,
        unidade: aiUnid || "unid",
        precoUnitario: 0,
        observacao: "Item sugerido pela IA"
      }])
    }

    if (aiObs && !observacoes) {
      setObservacoes(aiObs)
    }

    if (aiCliente || aiItens || aiObs) {
      // Só marca como processado se:
      // 1. Não pediu cliente OU já carregou a lista e tentou o match
      // 2. Pediu itens ou obs e eles foram processados
      const clientReady = !aiCliente || (aiCliente && clientes.length > 0)
      
      if (clientReady) {
        aiProcessedRef.current = true
        toast.info("Orçamento pré-montado pelo Assistente IA", {
          description: "Revise os dados antes de salvar."
        })
      }
    }
  }, [searchParams, clientes, clienteId, itens.length, observacoes])

  const clienteSelecionado = clientes.find((c) => c.id === clienteId)
  const historicoOrcamentos = clienteId ? todosOrcamentos.filter(o => o.clienteId === clienteId) : []
  const itensAnteriores = historicoOrcamentos.flatMap((o) => o.itens || [])

  // Auto-expand repurchase section when customer with history is selected
  const handleClienteChange = async (id: string) => {
    const numId = Number(id)
    setClienteId(numId)

    // Busca dados completos do cliente (especialmente itens exclusivos)
    const fullCliente = await getClienteById(numId)
    if (fullCliente) {
      setClientes(prev => prev.map(c => c.id === numId ? fullCliente : c))
    }

    const hasHistory = todosOrcamentos.filter(o => o.clienteId === numId).length > 0
    setShowRecompra(hasHistory)
  }

  // Sugestões de Produtos para o Cliente Selecionado
  const produtosSugeridas = clienteId ? produtosList.filter(e => e.clientesIds?.includes(Number(clienteId))) : []

  // Sugestões de Itens Exclusivos (Insumos) para o Cliente Selecionado
  const itensExclusivosSugeridos = clienteSelecionado?.itensExclusivos || []

  function adicionarItem() {
    setItens([...itens, { id: Math.random().toString(36).substr(2, 9), descricao: "", quantidade: 1, unidade: "unid", precoUnitario: "", observacao: "" }])
  }

  function removerItem(id: string) {
    setItens(itens.filter(i => i.id !== id))
  }

  function atualizarItem(id: string, field: keyof NovoItem, value: string | number) {
    setItens(itens.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function atualizarCreditoItem(id: string, qtd: number) {
    const item = itens.find(it => it.id === id)
    if (!item) return

    const qtdTotal = typeof item.quantidade === 'string' ? parseFloat(item.quantidade.replace(',', '.')) || 0 : item.quantidade

    if (qtd < 0) qtd = 0
    if (qtd > qtdTotal) {
      qtd = qtdTotal
      toast.warning("Bonificação limitada à quantidade total do item.")
    }

    // Validação de Saldo Global (considerando outros itens já bonificados)
    const saldoDisponivel = (clienteSelecionado?.saldoCreditoProdutos ?? 0)
    const outrosItensAbaixo = Object.entries(itensCreditoQtd)
      .filter(([itemId]) => itemId !== id)
      .reduce((sum, [, q]) => sum + q, 0)

    if (outrosItensAbaixo + qtd > saldoDisponivel) {
      qtd = Math.max(0, saldoDisponivel - outrosItensAbaixo)
      toast.error("Saldo de produtos insuficiente para este valor!", {
        description: `Saldo restante após outros itens: ${qtd.toLocaleString()} un.`
      })
    }

    setItensCreditoQtd(prev => ({ ...prev, [id]: qtd }))
  }

  function adicionarRecompra(descricao: string, precoUnitario: number | string) {
    setItens([...itens, { id: Math.random().toString(36).substr(2, 9), descricao, quantidade: 1, unidade: "unid", precoUnitario, observacao: "" }])
    setShowRecompra(false)
    toast.success("Item de recompra adicionado!")
  }

  function adicionarProdutoCatalogo(etqId: string) {
    const etq = produtosList.find((e) => e.id === Number(etqId))
    if (!etq) return

    // Buscar preço específico para o cliente se houver
    let precoSugerido = etq.preco || ""
    if (clienteId && etq.clientesVinculados) {
      const vinculo = etq.clientesVinculados.find((v: any) => v.id === Number(clienteId))
      if (vinculo && vinculo.preco !== null && vinculo.preco !== undefined) {
        precoSugerido = vinculo.preco
        toast.info(`Preço especial aplicado para este cliente: R$ ${Number(precoSugerido).toFixed(4)}`)
      }
    }

    const descricao = `${etq.nome} \nRef: ${etq.codigo} | Medida: ${etq.largura}x${etq.altura}mm | Mat: ${etq.material} | Cores: ${etq.numeroCores} | Tubete: ${etq.tipoTubete}`
    setItens([...itens, {
      id: Math.random().toString(36).substr(2, 9),
      descricao,
      quantidade: 1,
      unidade: "unid",
      precoUnitario: precoSugerido,
      observacao: ""
    }])
    toast.success("Produto adicionada ao orçamento!")
    setOpenCatalogo(false)
  }

  function adicionarItemExclusivo(item: any) {
    setItens([...itens, {
      id: Math.random().toString(36).substr(2, 9),
      descricao: item.nome,
      quantidade: 1,
      unidade: "unid",
      precoUnitario: item.preco || 0,
      observacao: item.descricao || "Item exclusivo cadastrado"
    }])
    toast.success(`${item.nome} adicionado!`)
  }

  const totalGeralBruto = itens.reduce((sum, item) => {
    const qtdBonificada = itensCreditoQtd[item.id] || 0
    const qtdTotal = typeof item.quantidade === 'string' ? parseFloat(item.quantidade.replace(',', '.')) || 0 : item.quantidade
    const qtdCobrada = Math.max(0, qtdTotal - qtdBonificada)
    const price = typeof item.precoUnitario === 'string' ? parseFloat(item.precoUnitario.replace(',', '.')) || 0 : item.precoUnitario
    return sum + (qtdCobrada * price)
  }, 0)

  const totalGeral = Math.max(0, totalGeralBruto - descontoCredito)

  const totalProdutosNoCredito = Object.values(itensCreditoQtd).reduce((sum, q) => sum + q, 0)

  async function handleSalvar() {
    if (isSaving) return
    if (!clienteId) {
      toast.error("Selecione um cliente.")
      return
    }
    if (!vendedorId) {
      toast.error("Selecione o vendedor responsável.")
      return
    }
    if (itens.length === 0) {
      toast.error("Adicione pelo menos um item.")
      return
    }

    setIsSaving(true)
    try {
      await saveOrcamento({
        clienteId,
        vendedorId,
        observacoes,
        ocCliente,
        formaPagamentoId: formaPagamentoId ? Number(formaPagamentoId) : null,
        totalGeral,
        descontoCredito,
        prazoEntrega,
        produtosCredito: totalProdutosNoCredito,
        itens: itens.map(it => {
          const qCredito = itensCreditoQtd[it.id] || 0
          const qtyTotal = typeof it.quantidade === 'string' ? parseFloat(it.quantidade.replace(',', '.')) || 0 : it.quantidade
          const price = typeof it.precoUnitario === 'string' ? parseFloat(it.precoUnitario.replace(',', '.')) || 0 : it.precoUnitario
          const itemTotal = (qtyTotal - qCredito) * price

          return {
            ...it,
            quantidade: qtyTotal,
            quantidadeCredito: qCredito,
            precoUnitario: price,
            total: itemTotal,
            observacao: qCredito > 0 ? `BONIFICADO: ${qCredito.toLocaleString()} un. ${it.observacao || ""}` : it.observacao
          }
        })
      }, currentUser?.id)

      toast.success("Orcamento salvo com sucesso!", {
        description: `Total: ${formatCurrency(totalGeral)}`,
      })
      router.push("/orcamentos")
    } catch (error) {
      console.error(error)
      toast.error("Falha ao salvar orçamento no banco de dados.")
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center py-20 animate-pulse text-muted-foreground">Carregando formulário...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/orcamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Orcamento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crie um novo orcamento para um cliente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Dados do Cliente (6 Colunas) */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm overflow-hidden h-full">
          <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              DADOS DO CLIENTE
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label>Selecionar Cliente *</Label>
                <Popover open={openCliente} onOpenChange={setOpenCliente}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCliente}
                      className="w-full mt-1.5 h-10 bg-muted/30 justify-between font-normal"
                    >
                      {clienteId
                        ? clientes.find((c) => c.id === Number(clienteId))?.razaoSocial
                        : "Busque ou selecione um cliente..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome ou CNPJ do cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientes.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.razaoSocial} ${c.cnpj}`}
                              onSelect={() => {
                                handleClienteChange(c.id.toString())
                                setOpenCliente(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  clienteId === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{c.razaoSocial}</span>
                                <span className="text-[10px] text-muted-foreground">{c.cnpj}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {clienteId && itensAnteriores.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowRecompra(!showRecompra)}
                  className="shrink-0 h-10"
                >
                  <RotateCcw className="size-4 mr-2" />
                  Histórico ({itensAnteriores.length})
                </Button>
              )}
            </div>

            {clienteSelecionado && (
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-base font-semibold text-foreground leading-tight">
                  {clienteSelecionado.razaoSocial}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <p className="font-mono">CNPJ: {clienteSelecionado.cnpj}</p>
                  <p className="flex items-center gap-1">
                    <MapPin className="size-3 text-primary" />
                    {clienteSelecionado.endereco}, {clienteSelecionado.cidade}/{clienteSelecionado.estado}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados do Vendedor (6 Colunas) */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm overflow-hidden h-full">
          <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="size-4 text-primary" />
              VENDEDOR RESPONSÁVEL
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Vendedor Responsável *</Label>
              <Select value={vendedorId?.toString()} onValueChange={(val) => setVendedorId(Number(val))}>
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue placeholder="Selecione o vendedor responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {vendedorId && (
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Comissão e Região</p>
                <p className="text-sm font-medium text-foreground">
                  {vendedores.find(v => v.id === Number(vendedorId))?.regiao} • {vendedores.find(v => v.id === Number(vendedorId))?.comissao}% de comissão fixa
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prazo de Entrega Estimado</Label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
                <Input
                  type="date"
                  value={prazoEntrega}
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                  className="pl-9 h-10 bg-muted/30 border-border/50 focus-visible:ring-primary/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Central de Sugestões e Créditos (Compactada) */}
      {clienteSelecionado && (
        <div className="space-y-4">
          {/* Barra de Créditos Compacta */}
          {((clienteSelecionado.saldoCreditoValor ?? 0) > 0 || (clienteSelecionado.saldoCreditoProdutos ?? 0) > 0) && (
            <div className="flex flex-wrap items-center gap-2 p-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs animate-in fade-in zoom-in-95">
              <Wallet className="size-3.5 text-emerald-600" />
              <span className="font-bold text-emerald-800 uppercase tracking-tight">Saldos:</span>
              {(clienteSelecionado.saldoCreditoValor ?? 0) > 0 && (
                <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-200">
                  Valor: {formatCurrency(clienteSelecionado.saldoCreditoValor)}
                </Badge>
              )}
              {(clienteSelecionado.saldoCreditoProdutos ?? 0) > 0 && (
                <Badge variant="outline" className="bg-blue-100/50 text-blue-700 border-blue-200">
                  Produtos: {(clienteSelecionado.saldoCreditoProdutos ?? 0).toLocaleString()} un
                </Badge>
              )}
              {(clienteSelecionado.saldoCreditoValor ?? 0) > 0 && descontoCredito === 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-emerald-600 underline text-[10px] ml-auto font-bold"
                  onClick={() => setDescontoCredito(clienteSelecionado.saldoCreditoValor ?? 0)}
                >
                  Usar Saldo R$
                </Button>
              )}
            </div>
          )}

          {/* Abas de Sugestões */}
          {(produtosSugeridas.length > 0 || itensExclusivosSugeridos.length > 0 || (showRecompra && itensAnteriores.length > 0)) && (
            <Tabs defaultValue={produtosSugeridas.length > 0 ? "matrizes" : itensExclusivosSugeridos.length > 0 ? "insumos" : "recompra"} className="w-full">
              <TabsList className="grid w-fit grid-cols-3 mb-2 bg-muted/40 p-1">
                <TabsTrigger value="matrizes" className="text-[11px] h-7 px-4 disabled:opacity-30" disabled={produtosSugeridas.length === 0}>
                  <Sparkles className="size-3 mr-1.5" /> Produtos
                </TabsTrigger>
                <TabsTrigger value="insumos" className="text-[11px] h-7 px-4 disabled:opacity-30" disabled={itensExclusivosSugeridos.length === 0}>
                  <Plus className="size-3 mr-1.5" /> Insumos
                </TabsTrigger>
                <TabsTrigger value="recompra" className="text-[11px] h-7 px-4 disabled:opacity-30" disabled={itensAnteriores.length === 0}>
                  <RotateCcw className="size-3 mr-1.5" /> Histórico
                </TabsTrigger>
              </TabsList>

              {/* Histórico Content */}
              <TabsContent value="recompra" className="mt-0 outline-none">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <ScrollArea className="h-44 pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {itensAnteriores.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col justify-between rounded-lg border border-primary/10 bg-background/60 p-2 hover:bg-background hover:border-primary/40 transition-all cursor-pointer shadow-sm group"
                          onClick={() => adicionarRecompra(item.descricao, item.precoUnitario)}
                        >
                          <span className="text-[11px] leading-tight text-foreground font-medium mb-1">
                            {item.descricao}
                          </span>
                          <div className="flex justify-between items-center mt-auto">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold">RECOMPRA</span>
                            <span className="text-[10px] font-bold text-primary mr-1">
                              {formatCurrency(item.precoUnitario)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Produtos Content */}
              <TabsContent value="matrizes" className="mt-0 outline-none">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <ScrollArea className="h-44 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {produtosSugeridas.map(etq => (
                        <div
                          key={etq.id}
                          onClick={() => adicionarProdutoCatalogo(etq.id.toString())}
                          className="w-[240px] border border-amber-200 bg-background hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 rounded-lg p-2 cursor-pointer transition-all shadow-sm group"
                        >
                          <div className="flex flex-col mb-1">
                            <span className="font-bold text-[11px] text-amber-900 dark:text-amber-400 group-hover:underline leading-tight">
                              {etq.nome}
                            </span>
                            <span className="text-[9px] text-muted-foreground mt-0.5 font-medium">Ref: {etq.codigo}</span>
                          </div>
                          <p className="text-[9px] text-amber-700/80 mb-1">
                            {etq.material} • {etq.largura}x{etq.altura}mm
                          </p>
                          <Button variant="outline" size="sm" className="w-full h-6 text-[9px] bg-amber-100/50 hover:bg-amber-200/50 border-amber-200 text-amber-800">
                            Adicionar Produto
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Insumos Content */}
              <TabsContent value="insumos" className="mt-0 outline-none">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <ScrollArea className="h-44 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {itensExclusivosSugeridos.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => adicionarItemExclusivo(item)}
                          className="w-[200px] border border-blue-200 bg-background hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 rounded-lg p-2 cursor-pointer transition-all shadow-sm group"
                        >
                          <p className="font-bold text-[11px] text-blue-900 dark:text-blue-400 group-hover:underline truncate mb-1">
                            {item.nome}
                          </p>
                          <p className="text-[10px] font-mono text-blue-700 mb-2">
                            {formatCurrency(item.preco)}
                          </p>
                          <Button variant="outline" size="sm" className="w-full h-6 text-[9px] bg-blue-100/50 hover:bg-blue-200/50 border-blue-200 text-blue-800">
                            Adicionar Insumo
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              Itens e Produtos
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popover open={openCatalogo} onOpenChange={setOpenCatalogo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCatalogo}
                    className="w-full sm:w-[250px] h-9 text-xs justify-between bg-background font-normal"
                  >
                    Pesquisar catálogo geral...
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="end">
                  <Command filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1
                    return 0
                  }}>
                    <CommandInput placeholder="Buscar produto (cód ou nome)..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma produto encontrada.</CommandEmpty>
                      <CommandGroup>
                        {produtosList.filter(etq => {
                          // Se não há cliente selecionado, mostra apenas produtos públicas
                          if (!clienteId) return !etq.clientesIds || etq.clientesIds.length === 0

                          // Se há cliente, mostra públicas OU autorizadas para esse cliente
                          const isPublic = !etq.clientesIds || etq.clientesIds.length === 0
                          const isAuthorized = etq.clientesIds?.includes(Number(clienteId))
                          return isPublic || isAuthorized
                        }).map((etq) => (
                          <CommandItem
                            key={etq.id}
                            value={`${etq.codigo} ${etq.nome}`}
                            onSelect={() => adicionarProdutoCatalogo(etq.id.toString())}
                          >
                            {etq.codigo} - {etq.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="default" size="sm" onClick={adicionarItem} className="h-9 shrink-0">
                <Plus className="size-4 mr-1" />
                Item Avulso
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 bg-muted/5">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-border/60 rounded-xl bg-background">
              <Tag className="size-8 opacity-20 mb-3" />
              <p className="text-sm font-medium">Nenhum produto adicionado.</p>
              <p className="text-xs opacity-70 mt-1">Selecione uma produto acima ou adicione um item avulso.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {itens.map((item, idx) => (
                <div key={item.id} className="relative rounded-xl border border-border/60 bg-card p-5 pt-8 sm:pt-5 shadow-sm group animate-in fade-in slide-in-from-bottom-2">

                  <div className="absolute -top-3 -left-3 size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md border-4 border-background">
                    {idx + 1}
                  </div>

                  <div className="flex justify-end mb-2 absolute top-4 right-4 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)} className="size-8 hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-2">
                    <div className="md:col-span-12">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Descrição do Produto</Label>
                      <Textarea
                        rows={2}
                        value={item.descricao}
                        onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                        className="bg-muted/10 font-medium resize-none border-border/50 focus-visible:ring-primary/50 text-sm py-3"
                        placeholder="Ex: Produto BOPP 100x50mm..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs font-semibold mb-1 block">Quantidade</Label>
                      <Input
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(item.id, "quantidade", e.target.value)}
                        className="bg-muted/20"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs font-semibold mb-1 block">Unidade</Label>
                      <Input
                        value={item.unidade}
                        onChange={(e) => atualizarItem(item.id, "unidade", e.target.value)}
                        className="bg-muted/20"
                        placeholder="Ex: Milheiro, Rolo..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs font-semibold mb-1 block">Valor Unitário (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.precoUnitario}
                        onChange={(e) => atualizarItem(item.id, "precoUnitario", e.target.value)}
                        className="bg-muted/20 font-mono"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs font-semibold text-primary mb-1 block">Subtotal</Label>
                      <div className="flex h-10 items-center justify-end rounded-md bg-primary/10 px-3 text-lg font-bold text-primary border border-primary/20">
                        {formatCurrency(
                          (typeof item.quantidade === 'string' ? parseFloat(item.quantidade.replace(',', '.')) || 0 : item.quantidade) *
                          (typeof item.precoUnitario === 'string' ? parseFloat(item.precoUnitario.replace(',', '.')) || 0 : item.precoUnitario)
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-12">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase mb-1 block">Observações do Item (Opcional)</Label>
                      <Input
                        value={item.observacao}
                        onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)}
                        className="bg-muted/10 h-8 text-xs border-dashed border-border/60"
                        placeholder="Ex: Adicionar tratamento corona, refile especial..."
                      />
                    </div>

                    {(clienteSelecionado?.saldoCreditoProdutos ?? 0) > 0 && (
                      <div className="md:col-span-12 pt-1 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 py-2 w-full sm:w-auto">
                          <div className="flex flex-col gap-1.5 min-w-[120px]">
                            <Label className="text-[10px] font-bold text-blue-700 uppercase">Bonificação Parcial</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="0"
                                value={itensCreditoQtd[item.id] || ""}
                                onChange={(e) => atualizarCreditoItem(item.id, parseFloat(e.target.value) || 0)}
                                className={`h-8 text-xs bg-blue-50/50 border-blue-200 focus:border-blue-500 focus:ring-blue-500/20 pr-7 ${itensCreditoQtd[item.id] > 0 ? 'bg-blue-100/50 border-blue-400 font-bold text-blue-800' : ''}`}
                                disabled={!clienteSelecionado}
                              />
                              <div className="absolute right-2 top-1.5">
                                <Sparkles className={`size-3.5 transition-colors ${(itensCreditoQtd[item.id] || 0) > 0 ? 'text-blue-600' : 'text-blue-300'}`} />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <Label className="text-xs font-bold text-blue-700">Abatimento do Saldo</Label>
                            <p className="text-[10px] text-muted-foreground italic">
                              {(itensCreditoQtd[item.id] || 0) > 0
                                ? `Cobrando apenas ${((typeof item.quantidade === 'string' ? parseFloat(item.quantidade.replace(',', '.')) || 0 : item.quantidade) - (itensCreditoQtd[item.id] || 0)).toLocaleString()} un.`
                                : "Nenhuma bonificação aplicada"}
                            </p>
                          </div>
                        </div>

                        {(itensCreditoQtd[item.id] || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[10px] py-1 px-2">PARCIALMENTE BONIFICADO</Badge>
                            <p className="text-[10px] text-muted-foreground font-mono">-{(itensCreditoQtd[item.id] || 0).toLocaleString()} un</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="bg-muted/20 border-b border-border/50 pb-3">
            <CardTitle className="text-base text-foreground font-semibold">Condições Gerais e Observações</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Forma de Pagamento Padronizada
              </Label>
              <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                <SelectTrigger className="bg-muted/10 border-border/50">
                  <SelectValue placeholder="Selecione uma forma de pagamento..." />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.filter((f: any) => f.ativo).map((f: any) => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold">OC do Cliente</Label>
              <Input
                value={ocCliente}
                onChange={(e) => setOcCliente(e.target.value)}
                placeholder="Número da Ordem de Compra do cliente..."
                className="bg-muted/10 border-border/50"
              />
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold">Instruções e Observações Comerciais</Label>
              <Textarea
                rows={4}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Condição de pagamento 30/60 dias. Validade da proposta: 15 dias. Frete FOB..."
                className="bg-muted/10 border-border/50 resize-none font-medium h-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-md bg-gradient-to-b from-card to-muted/20 border-t-4 border-t-primary">
          <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Calculator className="size-5" />
                <h3 className="font-semibold text-sm uppercase tracking-wider">Resumo do Pedido</h3>
              </div>

              <div className="space-y-3 pb-4 border-b border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantidade de Itens</span>
                  <span className="font-medium bg-muted/50 px-2 rounded">{itens.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal Base</span>
                  <span className="font-medium">{formatCurrency(totalGeralBruto)}</span>
                </div>
                {descontoCredito > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-bold animate-in zoom-in-95">
                    <span className="flex items-center gap-1"><MinusCircle className="size-3" /> Crédito Aplicado</span>
                    <span>- {formatCurrency(descontoCredito)}</span>
                  </div>
                )}
                {totalProdutosNoCredito > 0 && (
                  <div className="flex justify-between text-[10px] text-blue-600 font-bold border-t border-blue-100 pt-1">
                    <span>ITENS NO CRÉDITO</span>
                    <span>{totalProdutosNoCredito.toLocaleString()} UN</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Total Líquido</p>
                    {totalGeral === 0 && (
                      <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border-none text-[10px] mb-1 animate-pulse">
                        ORÇAMENTO DE BONIFICAÇÃO
                      </Badge>
                    )}
                    <p className="text-4xl font-black text-primary truncate">{formatCurrency(totalGeral)}</p>
                  </div>
                  {descontoCredito > 0 && (
                    <Button variant="ghost" size="icon" onClick={() => setDescontoCredito(0)} className="text-muted-foreground size-8">
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                </div>

                {clienteSelecionado && clienteSelecionado.saldoCreditoValor > 0 && (
                  <div className="mt-2">
                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Abatimento Manual (R$)</Label>
                    <Input
                      type="number"
                      max={clienteSelecionado.saldoCreditoValor}
                      value={descontoCredito}
                      onChange={(e) => setDescontoCredito(Math.min(clienteSelecionado.saldoCreditoValor, Number(e.target.value)))}
                      className="h-8 text-xs bg-emerald-50 border-emerald-200"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <Button onClick={handleSalvar} disabled={isSaving} className="w-full h-12 text-base font-bold shadow-sm" size="lg">
                {isSaving ? "Gerando..." : "Salvar e Gerar Proposta"}
              </Button>
              <Link href="/orcamentos" className="w-full">
                <Button variant="outline" className="w-full border-border/50 hover:bg-muted/50">Cancelar Envio</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  )
}
