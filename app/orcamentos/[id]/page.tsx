"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ArrowLeft, ArrowRight, Printer, MapPin, Building2, Tag, Edit, Save, Trash2, Calculator, CheckCircle2, Send, Plus, ChevronDown, CreditCard, Sparkles, Wallet, RotateCcw, Check } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { StatusBadge } from "@/components/ui/status-badge"
import { getOrcamentoById, saveOrcamento, updateOrcamentoStatus, getOrcamentos } from "@/lib/actions/orcamentos"
import { useAuth } from "@/lib/auth-context"
import { getProdutos } from "@/lib/actions/produtos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { use, useState, useEffect } from "react"
import { PDFDownloadQuotationButton } from "@/components/pdf-download-quotation-button"

function OrcamentoDetailContent({ id }: { id: string }) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [orcamento, setOrcamento] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Modos de Edição
  const [isEditing, setIsEditing] = useState(false)

  // Estado Local para Edição
  const [status, setStatus] = useState<string>("rascunho")
  const [observacoes, setObservacoes] = useState("")
  const [itens, setItens] = useState<any[]>([])

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [produtosList, setProdutosList] = useState<any[]>([])
  const [formasPagamento, setFormasPagamento] = useState<any[]>([])
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>("")
  const [prazoEntrega, setPrazoEntrega] = useState("")
  const [ocCliente, setOcCliente] = useState("")
  const [openCatalogo, setOpenCatalogo] = useState(false)
  const [todosOrcamentos, setTodosOrcamentos] = useState<any[]>([])
  const [clienteCompleto, setClienteCompleto] = useState<any>(null)

  // Status mapping for the visual steps
  const steps = [
    { id: 'rascunho', label: 'Em Edição', icon: Edit, nextId: 'enviado', nextLabel: 'Enviar Proposta', prevId: null, prevLabel: null },
    { id: 'enviado', label: 'Enviado p/ Cliente', icon: Send, nextId: 'aprovado', nextLabel: 'Aceitar Termos', prevId: 'rascunho', prevLabel: 'Voltar p/ Rascunho' },
    { id: 'aprovado', label: 'Aprovado / Fechado', icon: CheckCircle2, nextId: null, nextLabel: null, prevId: 'enviado', prevLabel: 'Voltar p/ Enviado' },
  ]

  const getStepIndex = (st: string) => {
    switch (st) {
      case 'rascunho': return 0
      case 'enviado': return 1
      case 'aprovado':
      case 'recusado':
      case 'rejeitado': return 2
      default: return 0
    }
  }

  const currentStepIndex = getStepIndex(status)

  const handleAdvanceStatus = async () => {
    const nextStep = steps[currentStepIndex].nextId;
    if (nextStep) {
      setIsUpdatingStatus(true)
      try {
        const updated = await updateOrcamentoStatus(orcamento.id, nextStep)
        if (updated) {
          setOrcamento(updated)
          setStatus(updated.status)
          router.refresh()
        }
        toast.success("Status Atualizado!", {
          description: `O orçamento avançou para: ${steps[currentStepIndex + 1].label}`
        })
      } catch (err) {
        console.error(err)
        toast.error("Erro ao avançar status.")
      } finally {
        setIsUpdatingStatus(false)
      }
    }
  }

  const handleBackStatus = async () => {
    const prevStep = steps[currentStepIndex].prevId;
    if (prevStep) {
      setIsUpdatingStatus(true)
      try {
        const updated = await updateOrcamentoStatus(orcamento.id, prevStep)
        if (updated) {
          setOrcamento(updated)
          setStatus(updated.status)
          router.refresh()
        }
        toast.success("Status Revertido!", {
          description: `O orçamento voltou para: ${steps[currentStepIndex - 1].label}`
        })
      } catch (err) {
        console.error(err)
        toast.error("Erro ao reverter status.")
      } finally {
        setIsUpdatingStatus(false)
      }
    }
  }

  const handleRejectStatus = async () => {
    setIsUpdatingStatus(true)
    try {
      const updated = await updateOrcamentoStatus(orcamento.id, 'recusado')
      if (updated) {
        setOrcamento(updated)
        setStatus(updated.status)
        router.refresh()
      }
      toast.success("Orçamento sinalizado como recusado.")
    } catch {
      toast.error("Erro ao alterar o status do orçamento.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  useEffect(() => {
    if (!currentUser) return

    Promise.all([
      getOrcamentoById(Number(id), currentUser?.id),
      getProdutos(),
      fetch("/api/formas-pagamento").then(res => res.json()),
      getOrcamentos({ limit: 100, mode: 'history' })
    ]).then(async ([data, etqs, formas, orcs]) => {
      if (data) {
        setOrcamento(data)
        setStatus(data.status)
        setObservacoes(data.observacoes || "")
        setFormaPagamentoId(data.formaPagamentoId?.toString() || "")
        setPrazoEntrega(data.prazoEntrega ? new Date(data.prazoEntrega).toISOString().split('T')[0] : "")
        setOcCliente((data as any).ocCliente || "")
        setItens(data.itens.map((i: any) => ({ ...i, observacao: i.observacao || "" })))

        // Fetch full client for exclusive items and credit balances
        try {
          const { getClienteById } = await import("@/lib/actions/clientes")
          const fullCl = await getClienteById(data.clienteId)
          setClienteCompleto(fullCl)
        } catch (e) {
          console.error("Erro ao carregar cliente completo:", e)
        }
      }
      setProdutosList(etqs)
      setFormasPagamento(formas || [])
      setTodosOrcamentos(orcs?.data || [])
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="flex justify-center py-20 animate-pulse text-muted-foreground">Carregando orçamento...</div>
  }

  if (!orcamento) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Orcamento nao encontrado.</p>
        <Link href="/orcamentos">
          <Button variant="outline" className="mt-4">Voltar</Button>
        </Link>
      </div>
    )
  }

  const cliente = orcamento.cliente
  const pedidoExistente = orcamento.pedidos?.[0]
  const vendedor = orcamento.vendedor

  // Totalizador dinâmico na edição
  const totalGeral = itens.reduce((sum, item) => {
    const qtd = typeof item.quantidade === 'string' ? parseFloat(item.quantidade.replace(',', '.')) || 0 : item.quantidade
    const preco = typeof item.precoUnitario === 'string' ? parseFloat(item.precoUnitario.replace(',', '.')) || 0 : item.precoUnitario
    return sum + qtd * preco
  }, 0)

  function handleConverterPedido() {
    if (pedidoExistente) {
      toast.info("Ja existe um pedido para este orcamento.", {
        description: pedidoExistente.numero,
      })
    } else {
      toast.success("Pedido de producao criado com sucesso!", {
        description: `Orcamento ${orcamento!.numero} convertido em pedido.`,
      })
    }
  }

  async function handleSalvarEdicao() {
    if (isSaving) return
    setIsSaving(true)
    try {
      const updatedOrcamento = await saveOrcamento({
        id: orcamento.id,
        clienteId: orcamento.clienteId,
        vendedorId: orcamento.vendedorId,
        numero: orcamento.numero,
        totalGeral,
        observacoes,
        ocCliente,
        prazoEntrega,
        formaPagamentoId: formaPagamentoId ? Number(formaPagamentoId) : null,
        statusStr: status,
        itens: itens.map(it => {
          const qty = typeof it.quantidade === 'string' ? parseFloat(String(it.quantidade).replace(',', '.')) || 0 : it.quantidade;
          const price = typeof it.precoUnitario === 'string' ? parseFloat(String(it.precoUnitario).replace(',', '.')) || 0 : it.precoUnitario;
          // Se o id for string (ex: 'temp-123') ou um id gerado localmente muito grande ou negativo, ignoramos.
          // Mas como geramos os ids usando Math.random() agora para itens novos...
          const isTempId = typeof it.id === 'string' || it.id < 0;
          return {
            id: isTempId ? undefined : it.id,
            produtoId: it.produtoId,
            descricao: it.descricao,
            unidade: it.unidade,
            observacao: it.observacao || "",
            quantidade: qty,
            precoUnitario: price,
            total: qty * price
          };
        })
      }, currentUser?.id)

      if (updatedOrcamento) {
        setOrcamento(updatedOrcamento)
        setItens(updatedOrcamento.itens.map((i: any) => ({ ...i, observacao: i.observacao || "" })))
        setObservacoes(updatedOrcamento.observacoes || "")
        // Pequena espera antes do refresh para garantir que o estado local propagou
        setTimeout(() => router.refresh(), 100)
      }

      setIsEditing(false)
      toast.success("Orçamento atualizado!", {
        description: "As alterações foram salvas com sucesso no banco de dados."
      })
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar alterações no banco.")
    } finally {
      setIsSaving(false)
    }
  }

  function atualizarItem(id: number, field: keyof typeof itens[0], value: string | number) {
    setItens(itens.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function removerItem(id: number) {
    if (itens.length === 1) {
      toast.error("O orçamento deve ter pelo menos 1 item.")
      return
    }
    setItens(itens.filter(i => i.id !== id))
  }

  function adicionarItemVazio() {
    const nextId = `temp-${Math.random().toString(36).substr(2, 9)}`
    setItens([...itens, { id: nextId, descricao: "", quantidade: 1, unidade: "unid", precoUnitario: 0, observacao: "" }])
  }

  function adicionarProdutoCatalogo(etqId: string) {
    const etq = produtosList.find((e) => e.id === Number(etqId))
    if (!etq) return

    // Buscar preço específico para o cliente se houver
    let precoSugerido = etq.preco || 0
    if (orcamento.clienteId && etq.clientesVinculados) {
      const vinculo = etq.clientesVinculados.find((v: any) => v.id === Number(orcamento.clienteId))
      if (vinculo && vinculo.preco !== null && vinculo.preco !== undefined) {
        precoSugerido = vinculo.preco
        toast.info(`Preço especial aplicado para este cliente: R$ ${Number(precoSugerido).toFixed(4)}`)
      }
    }

    const descricao = `${etq.nome} \nRef: ${etq.codigo} | Medida: ${etq.largura}x${etq.altura}mm | Mat: ${etq.material} | Cores: ${etq.numeroCores} | Tubete: ${etq.tipoTubete}${etq.observacoesTecnicas ? `\nObs: ${etq.observacoesTecnicas}` : ''}`
    const nextId = `temp-${Math.random().toString(36).substr(2, 9)}`

    setItens([...itens, {
      id: nextId,
      produtoId: etq.id,
      descricao,
      quantidade: 1,
      unidade: "unid",
      precoUnitario: precoSugerido,
      observacao: ""
    }])
    toast.success("Produto adicionada!")
    setOpenCatalogo(false)
  }

  function adicionarRecompra(descricao: string, precoUnitario: number | string) {
    const nextId = `temp-${Math.random().toString(36).substr(2, 9)}`
    const finalPreco = typeof precoUnitario === 'string' ? parseFloat(precoUnitario.replace(',', '.')) || 0 : precoUnitario
    setItens([...itens, {
      id: nextId,
      descricao,
      quantidade: 1,
      unidade: "unid",
      precoUnitario: finalPreco,
      observacao: ""
    }])
    toast.success("Item de recompra adicionado!")
  }

  function adicionarItemExclusivo(item: any) {
    const nextId = `temp-${Math.random().toString(36).substr(2, 9)}`
    setItens([...itens, {
      id: nextId,
      descricao: item.nome,
      quantidade: 1,
      unidade: "unid",
      precoUnitario: item.preco || 0,
      observacao: item.descricao || "Item exclusivo cadastrado"
    }])
    toast.success(`${item.nome} adicionado!`)
  }

  const clienteSelecionado = clienteCompleto || orcamento?.cliente
  const historicoOrcamentos = orcamento?.clienteId ? todosOrcamentos.filter(o => o.clienteId === orcamento.clienteId) : []
  const itensAnteriores = historicoOrcamentos.flatMap((o) => o.itens || [])

  // Sugestões de Produtos para o Cliente Selecionado
  const produtosSugeridas = orcamento?.clienteId ? produtosList.filter(e => e.clientesIds?.includes(Number(orcamento.clienteId))) : []

  // Sugestões de Itens Exclusivos (Insumos) para o Cliente Selecionado
  const itensExclusivosSugeridos = clienteSelecionado?.itensExclusivos || []

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border/50 shadow-sm relative overflow-hidden">
        {/* Subtle background gradient based on status */}
        <div className={`absolute inset-0 opacity-5 pointer-events-none ${status === 'aprovado' ? 'bg-emerald-500' :
          status === 'enviado' ? 'bg-indigo-500' :
            status === 'recusado' ? 'bg-rose-500' : 'bg-slate-500'
          }`} />

        <div className="flex items-center gap-4 relative z-10">
          <Link href="/orcamentos">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Proposta #{orcamento.numero}
              </h1>
              <StatusBadge statusObj={orcamento.statusObj} fallback={status} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Criado em {orcamento.criadoEm ? new Date(orcamento.criadoEm).toLocaleDateString('pt-BR') : 'N/D'} | Editado em {orcamento.atualizadoEm ? new Date(orcamento.atualizadoEm).toLocaleDateString('pt-BR') : 'N/D'}
              {orcamento.ocCliente && <span className="ml-2 inline-flex items-center gap-1 border-l pl-2 border-border/50">• OC Cliente: <b className="text-foreground">{orcamento.ocCliente}</b></span>}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold px-2 py-0">
                Prazo: {prazoEntrega ? prazoEntrega.split('-').reverse().join('/') : 'A definir'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          {!isEditing ? (
            <Button
              variant="secondary"
              onClick={() => setIsEditing(true)}
              className="bg-secondary/80 hover:bg-secondary"
              disabled={!!pedidoExistente}
              title={pedidoExistente ? "Não é possível editar pois já existe um pedido vinculado." : ""}
            >
              <Edit className="size-4 mr-2" />
              Editar Proposta
            </Button>
          ) : (
            <Button onClick={handleSalvarEdicao} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="size-4 mr-2" />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          )}

          {cliente && !isEditing && (
            <PDFDownloadQuotationButton
              orcamento={orcamento}
              cliente={cliente}
              vendedor={vendedor}
              variant="outline"
            />
          )}

          {status !== "recusado" && !isEditing && !pedidoExistente && (
            <Link href={`/pedidos/novo?orcamentoId=${orcamento.id}`}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                <ArrowRight className="size-4 mr-2" />
                Criar Pedido
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 mt-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Funil Comercial</h3>
            {status === 'enviado' && !isEditing && !pedidoExistente && (
              <Button size="sm" variant="destructive" onClick={handleRejectStatus} disabled={isUpdatingStatus} className="h-7 text-xs px-4">
                Sinalizar como Perdido ou Recusado
              </Button>
            )}
          </div>

          <div className="relative flex justify-between px-2 sm:px-8">
            {/* Connecting line */}
            <div className="absolute top-5 left-[12%] right-[12%] h-[2px] bg-muted/50 -z-10 hidden sm:block" />
            <div
              className="absolute top-5 left-[12%] h-[2px] bg-primary -z-10 transition-all duration-500 ease-in-out hidden sm:block"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 76}%` }}
            />

            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStepIndex
              const isCompleted = index < currentStepIndex
              const isRejected = isActive && (status === 'recusado' || status === 'rejeitado')

              return (
                <div key={step.id} className="flex flex-col items-center gap-3 w-1/3 text-center">
                  <div className={`
                      size-10 rounded-full flex items-center justify-center border-2 bg-background transition-colors duration-300
                      ${isCompleted ? 'border-primary text-primary' : ''}
                      ${isActive && !isRejected ? 'border-primary ring-4 ring-primary/20 text-primary shadow-sm' : ''}
                      ${isRejected ? 'border-destructive ring-4 ring-destructive/20 text-destructive shadow-sm' : ''}
                      ${!isCompleted && !isActive ? 'border-muted-foreground/30 text-muted-foreground/50' : ''}
                    `}>
                    {isCompleted ? <CheckCircle2 className="size-5" /> : isRejected ? <Trash2 className="size-5" /> : <Icon className="size-5" />}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider
                      ${isCompleted ? 'text-foreground' : ''}
                      ${isActive && !isRejected ? 'text-primary' : ''}
                      ${isRejected ? 'text-destructive' : ''}
                      ${!isCompleted && !isActive ? 'text-muted-foreground' : ''}
                    `}>
                    {isRejected ? 'Recusado/Perdido' : step.label}
                  </span>

                  {/* Botões de navegação apenas no step ativo */}
                  {isActive && !isRejected && !isEditing && !pedidoExistente && (
                    <div className="mt-2 flex flex-col gap-2">
                      {step.nextLabel && (
                        <Button
                          size="sm"
                          onClick={handleAdvanceStatus}
                          disabled={isUpdatingStatus}
                          className="h-7 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider rounded-full px-2 sm:px-4 shadow-md hover:scale-105 transition-transform"
                        >
                          {isUpdatingStatus ? "..." : step.nextLabel} <ArrowRight className="size-3 ml-1" />
                        </Button>
                      )}
                      {step.prevLabel && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBackStatus}
                          disabled={isUpdatingStatus}
                          className="h-7 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider rounded-full px-2 sm:px-4 border-primary/30 text-primary hover:bg-primary/5 shadow-sm"
                        >
                          <ArrowLeft className="size-3 mr-1" /> {isUpdatingStatus ? "..." : step.prevLabel}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {pedidoExistente && !isEditing && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-full hidden sm:block">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Pedido de Produção Vinculado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Este orçamento já foi convertido e possui um pedido ativo: <span className="font-mono font-medium text-foreground">{pedidoExistente.numero}</span>
              </p>
            </div>
          </div>
          <Link href={`/pedidos/${pedidoExistente.id}`}>
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/20 w-full sm:w-auto">
              Acessar Pedido <ArrowRight className="size-3 ml-2" />
            </Button>
          </Link>
        </div>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {cliente && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground flex items-center gap-2">
                  {cliente.razaoSocial}
                </p>
                <p className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                  CNPJ: {cliente.cnpj} | Tel: {cliente.telefone}
                </p>
              </div>
              <div className="space-y-1 text-right md:max-w-[50%]">
                <p className="text-sm text-foreground flex items-center md:justify-end gap-1.5">
                  <MapPin className="size-3.5 text-primary" />
                  {cliente.endereco}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cliente.cidade} / {cliente.estado} - CEP: {cliente.cep}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Central de Sugestões e Créditos (Compactada) */}
      {isEditing && clienteSelecionado && (
        <div className="space-y-4 my-2">
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
            </div>
          )}

          {/* Abas de Sugestões */}
          {(produtosSugeridas.length > 0 || itensExclusivosSugeridos.length > 0 || itensAnteriores.length > 0) && (
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
                          <span className="text-[11px] leading-tight text-foreground font-medium mb-1 whitespace-pre-wrap">
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
                          onClick={() => {
                            // Buscar preço específico para o cliente se houver
                            let precoSugerido = etq.preco || 0
                            if (orcamento.clienteId && etq.clientesVinculados) {
                              const vinculo = etq.clientesVinculados.find((v: any) => v.id === Number(orcamento.clienteId))
                              if (vinculo && vinculo.preco !== null && vinculo.preco !== undefined) {
                                precoSugerido = vinculo.preco
                              }
                            }
                            const desc = `${etq.nome} \nRef: ${etq.codigo} | Medida: ${etq.largura}x${etq.altura}mm | Mat: ${etq.material} | Cores: ${etq.numeroCores} | Tubete: ${etq.tipoTubete}${etq.observacoesTecnicas ? `\nObs: ${etq.observacoesTecnicas}` : ''}`
                            const nextId = `temp-${Math.random().toString(36).substr(2, 9)}`
                            setItens([...itens, {
                              id: nextId,
                              produtoId: etq.id,
                              descricao: desc,
                              quantidade: 1,
                              unidade: "unid",
                              precoUnitario: precoSugerido,
                              observacao: ""
                            }])
                            toast.success("Produto adicionada!")
                          }}
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

      <Card className="border-border/50 shadow-sm overflow-hidden mt-2">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              Itens e Produtos
            </CardTitle>
            {isEditing && (
              <div className="flex items-center gap-2">
                <Popover open={openCatalogo} onOpenChange={setOpenCatalogo}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px] font-normal"
                    >
                      Puxar do Catálogo
                      <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma produto encontrada.</CommandEmpty>
                        <CommandGroup>
                          {produtosList.map((etq) => (
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
                <Button variant="ghost" size="sm" onClick={adicionarItemVazio} className="h-8 text-[11px] text-primary">
                  <Plus className="size-3 mr-1" /> Item Avulso
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={isEditing ? "pt-6 bg-muted/5" : "pt-0 border-t border-border/50"}>
          {isEditing ? (
            <div className="flex flex-col gap-5">
              {itens.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative rounded-xl border border-border/60 bg-card p-5 pt-8 sm:pt-5 shadow-sm group animate-in fade-in slide-in-from-bottom-2"
                >

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
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Descrição do Produto</Label>
                        {item.produtoId && (
                          <Button
                            variant="ghost"
                            className="h-auto p-1 py-0.5 text-[10px] text-primary flex items-center gap-1 font-bold hover:bg-primary/10 rounded"
                            onClick={() => {
                              const etq = produtosList.find(e => e.id === item.produtoId)
                              if (etq) {
                                const suggestion = `${etq.nome} \nRef: ${etq.codigo} | Medida: ${etq.largura}x${etq.altura}mm | Mat: ${etq.material} | Cores: ${etq.numeroCores} | Tubete: ${etq.tipoTubete}${etq.observacoesTecnicas ? `\nObs: ${etq.observacoesTecnicas}` : ''}`
                                atualizarItem(item.id, "descricao", suggestion)
                                toast.info("Descrição técnica aplicada!")
                              }
                            }}
                          >
                            <Sparkles className="size-3" />
                            Sugerir descrição do catálogo
                          </Button>
                        )}
                      </div>
                      <div className="relative">
                        <Textarea
                          rows={2}
                          value={item.descricao}
                          onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                          className="bg-muted/10 font-medium resize-none border-border/50 focus-visible:ring-primary/50 text-sm py-3"
                        />
                        {item.quantidadeCredito > 0 && (
                          <Badge className="absolute -top-2 right-2 bg-blue-500 hover:bg-blue-600 text-[9px] h-4">
                            Bonificação Ativa
                          </Badge>
                        )}
                      </div>
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

                    <div className="md:col-span-12 mt-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase mb-1 block mt-2">Observações do Item</Label>
                      <Input
                        value={item.observacao || ""}
                        onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)}
                        className="bg-muted/10 h-8 text-xs border-dashed border-border/60"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6 pb-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-20 font-semibold text-muted-foreground text-[13px] h-11">Quant.</TableHead>
                    <TableHead className="w-16 font-semibold text-muted-foreground text-[13px] h-11">Unid.</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] h-11">Descricao</TableHead>
                    <TableHead className="text-right w-24 font-semibold text-muted-foreground text-[13px] h-11">P.Unit.</TableHead>
                    <TableHead className="text-right w-24 font-semibold text-muted-foreground text-[13px] h-11">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.id} className="border-border/30 hover:bg-muted/10">
                      <TableCell className="text-foreground font-medium text-[13px]">
                        {item.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[13px]">{item.unidade}</TableCell>
                      <TableCell className="text-foreground whitespace-pre-line text-[13px] relative">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{item.descricao}</span>
                          {item.quantidadeCredito > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-tighter bg-blue-50 w-fit px-1.5 rounded border border-blue-200">
                              <Sparkles className="size-3" /> Bonificado: {item.quantidadeCredito.toLocaleString()} un
                            </div>
                          )}
                        </div>
                        {item.observacao && (
                          <span className="block mt-1 text-xs text-muted-foreground italic">
                            Obs: {item.observacao}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-[13px] min-w-[90px]">
                        {formatCurrency(item.precoUnitario)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground text-[13px]">
                        {formatCurrency(item.quantidade * item.precoUnitario)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              {isEditing ? (
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
              ) : (
                <div className="text-sm font-medium p-2 bg-primary/5 rounded border border-primary/10 inline-flex items-center gap-2">
                  {formasPagamento.find((f: any) => f.id === Number(formaPagamentoId))?.nome || "Não informada"}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold">Instruções e Observações Comerciais</Label>
              {isEditing ? (
                <Textarea
                  rows={4}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Condição de pagamento 30/60 dias..."
                  className="bg-muted/10 border-border/50 resize-none font-medium min-h-[120px]"
                />
              ) : (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line p-1">
                  {observacoes || "Nenhuma observação geral adicionada na proposta."}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold">OC do Cliente</Label>
              {isEditing ? (
                <Input
                  value={ocCliente}
                  onChange={(e) => setOcCliente(e.target.value)}
                  placeholder="Número da OC..."
                  className="bg-muted/10 border-border/50"
                />
              ) : (
                <p className="text-sm font-medium p-2 bg-amber-500/5 rounded border border-amber-500/10 text-amber-700 inline-flex items-center gap-2">
                  {ocCliente || "Não informada"}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="size-4 text-primary" />
                Prazo de Entrega
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={prazoEntrega}
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                  className="bg-muted/10 border-border/50 h-10 font-medium"
                />
              ) : (
                <div className="text-sm font-medium p-2 bg-blue-500/5 rounded border border-blue-500/10 text-blue-700 inline-flex items-center gap-2">
                  {prazoEntrega ? prazoEntrega.split('-').reverse().join('/') : "A definir"}
                </div>
              )}
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
                  <span className="font-medium">{formatCurrency(totalGeral)}</span>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Total Geral da Proposta</p>
                <p className="text-4xl font-black text-primary truncate">{formatCurrency(totalGeral)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              {isEditing && (
                <Button onClick={handleSalvarEdicao} disabled={isSaving} className="w-full h-12 text-base font-bold shadow-sm bg-green-600 hover:bg-green-700 text-white" size="lg">
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function OrcamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppShell>
      <OrcamentoDetailContent id={id} />
    </AppShell>
  )
}
