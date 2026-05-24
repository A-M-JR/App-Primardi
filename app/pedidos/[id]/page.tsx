"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, ArrowRight, FileDown, AlertTriangle, CheckCircle2, Circle, Truck, Package, Settings, MessageSquare, Plus, CreditCard } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { StatusBadge } from "@/components/ui/status-badge"
import { getPedidoById, updatePedidoStatus } from "@/lib/actions/pedidos"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { use, useState, useEffect } from "react"
import { PDFDownloadButton } from "@/components/pdf-download-button"
import { PDFProductionOrderButton } from "@/components/pdf-production-order-button"
import { toast } from "sonner"
import type { Pedido, Cliente, Vendedor } from "@/lib/types"
import { PedidoEditDialog } from "@/components/pedido-edit-dialog"
import { updatePedidoDetails } from "@/lib/actions/pedidos"

export default function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { currentUser } = useAuth()
  
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentStatus, setCurrentStatus] = useState<Pedido['status']>('em_analise')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [evolutionText, setEvolutionText] = useState("")
  const [isSavingEvolution, setIsSavingEvolution] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    
    getPedidoById(Number(id), currentUser?.id).then(data => {
      setPedido(data)
      if (data) setCurrentStatus(data.status as Pedido['status'])
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground animate-pulse">Carregando detalhes do pedido...</p>
        </div>
      </AppShell>
    )
  }

  if (!pedido) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Pedido nao encontrado.</p>
          <Link href="/pedidos">
            <Button variant="outline" className="mt-4">Voltar</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const cliente = pedido.cliente
  const vendedor = pedido.vendedor

  // Status mapping for the visual steps
  const steps = [
    { id: 'enviado', label: 'Em Análise', icon: Settings, nextId: 'em_producao', nextLabel: 'Iniciar Produção', prevId: null, prevLabel: null },
    { id: 'em_producao', label: 'Em Produção', icon: Package, nextId: 'separacao', nextLabel: 'Enviar p/ Separação', prevId: 'enviado', prevLabel: 'Voltar p/ Análise' },
    { id: 'separacao', label: 'Separação', icon: Package, nextId: 'entregue', nextLabel: 'Marcar Entregue', prevId: 'em_producao', prevLabel: 'Voltar p/ Produção' },
    { id: 'entregue', label: 'Entregue / Faturado', icon: Truck, nextId: null, nextLabel: null, prevId: 'separacao', prevLabel: 'Voltar p/ Separação' },
  ]

  // Mock function to determine active step based on status
  const getStepIndex = (status: string) => {
    switch (status) {
      case 'rascunho':
      case 'enviado':
      case 'aprovado':
        return 0; // Em análise
      case 'em_producao':
        return 1; // Em produção
      case 'separacao':
      case 'faturado':
        return 2;
      case 'entregue':
        return 3;
      default:
        return 1; // Fallback to producao
    }
  }

  const currentStepIndex = getStepIndex(currentStatus)

  const handleAdvanceStatus = async () => {
    const nextStep = steps[currentStepIndex].nextId;
    if (nextStep) {
      setIsUpdatingStatus(true)
      try {
        const updated = await updatePedidoStatus(pedido.id, nextStep)
        setPedido(updated)
        setCurrentStatus(nextStep as Pedido['status']);
        router.refresh()
        toast.success("Status Atualizado!", {
          description: `O pedido agora está na fase: ${steps[currentStepIndex + 1].label}`
        })
      } catch (err) {
        console.error(err)
        toast.error("Erro ao atualizar o status.")
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
        const updated = await updatePedidoStatus(pedido.id, prevStep)
        setPedido(updated)
        setCurrentStatus(prevStep as Pedido['status']);
        router.refresh()
        toast.success("Status Revertido!", {
          description: `O pedido voltou para a fase: ${steps[currentStepIndex - 1].label}`
        })
      } catch (err) {
        console.error(err)
        toast.error("Erro ao reverter o status.")
      } finally {
        setIsUpdatingStatus(false)
      }
    }
  }

  const parsedEvolucoes = () => {
    const text = pedido.observacoesGerais || ""
    const parts = text.split('\n\n')
    const inicial = parts[0]
    const evols = []
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      const match = part.match(/^\[(.*?) - (.*?)\]:\s*([\s\S]*)/)
      if (match) {
        evols.push({ date: match[1], author: match[2], text: match[3] })
      } else {
        evols.push({ date: "", author: "Sistema", text: part })
      }
    }
    return { inicial, evols }
  }

  const { inicial: obsInicial, evols: evolucoes } = parsedEvolucoes()

  const handleRegistrarEvolucao = async () => {
    if (!evolutionText.trim()) return
    setIsSavingEvolution(true)
    try {
      const timestamp = new Date().toLocaleString('pt-BR')
      const newEntry = `\n\n[${timestamp} - ${currentUser?.nome || 'Usuário'}]: ${evolutionText}`
      const updatedObs = (pedido.observacoesGerais || '') + newEntry
      
      const updated = await updatePedidoDetails(pedido.id, {
        observacoesGerais: updatedObs
      }, currentUser?.id || 0)
      
      setPedido(updated)
      setEvolutionText("")
      toast.success("Evolução registrada!")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao registrar evolução.")
    } finally {
      setIsSavingEvolution(false)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pedidos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {pedido.numero}
                </h1>
                <StatusBadge statusObj={pedido.statusObj} fallback={currentStatus} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Criado em {pedido.criadoEm ? new Date(pedido.criadoEm).toLocaleDateString('pt-BR') : 'N/D'} | Orcamento: {pedido.orcamentoId}
                {pedido.ocCliente && <span className="ml-2 inline-flex items-center gap-1 border-l pl-2 border-border/50">• OC Cliente: <b className="text-foreground">{pedido.ocCliente}</b></span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">

            <PDFDownloadButton
              pedido={pedido}
              cliente={cliente as Cliente}
              vendedor={vendedor as Vendedor}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-md p-6 mt-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground">Acompanhamento de Produção</h3>
                <p className="text-xs text-muted-foreground mt-1">Status atualizado em tempo real pelas equipes operacionais</p>
              </div>
            </div>

            <div className="relative flex justify-between px-4 sm:px-10">
              {/* Linha de fundo */}
              <div className="absolute top-6 left-[10%] right-[10%] h-[3px] bg-muted/60 -z-10 rounded-full" />
              {/* Linha de progresso animada */}
              <div
                className="absolute top-6 left-[10%] h-[3px] bg-primary -z-10 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)] rounded-full"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 80}%` }}
              />

              {steps.map((step, index) => {
                const Icon = step.icon
                const isActive = index === currentStepIndex
                const isCompleted = index < currentStepIndex

                return (
                  <div key={step.id} className="flex flex-col items-center gap-4 w-1/4 group">
                    <div className="relative">
                      {isActive && (
                        <div className="absolute -inset-2 bg-primary/20 rounded-full blur-md animate-pulse" />
                      )}
                      <div className={`
                        relative z-10 size-12 rounded-full flex items-center justify-center border-[3px] bg-card transition-all duration-500 shadow-sm
                        ${isCompleted ? 'border-primary bg-primary text-primary-foreground scale-105' : ''}
                        ${isActive ? 'border-primary ring-4 ring-primary/30 text-primary scale-110 shadow-lg' : ''}
                        ${!isCompleted && !isActive ? 'border-muted-foreground/30 text-muted-foreground/50' : ''}
                      `}>
                        {isCompleted ? <CheckCircle2 className="size-6" /> : <Icon className="size-5" />}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center text-center space-y-1 h-20">
                      <span className={`text-[13px] font-bold uppercase tracking-wider transition-colors
                        ${isCompleted ? 'text-foreground' : ''}
                        ${isActive ? 'text-primary' : ''}
                        ${!isCompleted && !isActive ? 'text-muted-foreground' : ''}
                      `}>
                        {step.label}
                      </span>

                      {/* Ações Rápidas apenas na etapa ativa */}
                      <div className={`transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                        {isActive && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {step.nextLabel && (
                              <Button
                                size="sm"
                                onClick={handleAdvanceStatus}
                                disabled={isUpdatingStatus}
                                className="h-7 text-[10px] uppercase font-bold tracking-wider rounded-full px-4 bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all w-36"
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
                                className="h-6 text-[9px] uppercase tracking-wider rounded-full px-3 w-36 bg-background/50 backdrop-blur-sm"
                              >
                                <ArrowLeft className="size-3 mr-1" /> {step.prevLabel}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/50 shadow-sm">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base mt-1">Informações de Entrega e Cliente</CardTitle>
              <PedidoEditDialog pedido={pedido} currentUserId={currentUser?.id} onUpdated={(p) => setPedido(p)} />
            </CardHeader>
            <CardContent className="pt-6">
              {cliente && (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Empresa Destinatária</h4>
                      <p className="text-base font-semibold text-foreground">{cliente.razaoSocial}</p>
                      <p className="text-sm font-mono text-muted-foreground mt-0.5">CNPJ: {cliente.cnpj} | IE: {cliente.ie}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <h4 className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Contato</h4>
                        <p className="text-sm font-medium">{cliente.telefone}</p>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Comprador</h4>
                        <p className="text-sm font-medium">{pedido.nomeComprador || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Destacando o card de entrega */}
                  <div className="flex-1 bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-xl border border-amber-200 dark:border-amber-900 relative shadow-sm">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Truck className="size-16 text-amber-600 dark:text-amber-500" />
                    </div>
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                      <div className="bg-amber-100 dark:bg-amber-900/50 p-1.5 rounded-md">
                        <Truck className="size-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h4 className="text-[13px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider">Local de Entrega</h4>
                    </div>

                    <div className="relative z-10">
                      <p className="text-sm font-bold text-foreground leading-relaxed">
                        {cliente.endereco}
                      </p>
                      <p className="text-sm text-foreground/80 mt-1 font-medium">
                        {cliente.cidade} / {cliente.estado}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">CEP: {cliente.cep}</p>

                      <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800/50 flex justify-between">
                        <div>
                          <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-bold block mb-0.5">Prazo Acordado</span>
                          <span className="text-sm font-black text-foreground">{pedido.prazoEntrega ? new Date(pedido.prazoEntrega).toLocaleDateString('pt-BR') : 'A definir'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-bold block mb-0.5">Tipo de Frete</span>
                          <span className="text-sm font-bold text-foreground">{pedido.tipoFrete || 'FOB'}</span>
                        </div>
                      </div>
                      {(pedido.valorFrete > 0) && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/50 flex justify-between items-center">
                          <span className="text-[11px] uppercase text-amber-600 dark:text-amber-400 font-bold">Valor Adicional de Frete</span>
                          <span className="text-sm font-black text-amber-700 dark:text-amber-500">{formatCurrency(pedido.valorFrete)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm flex flex-col">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
              <CardTitle className="text-base">Condições Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col gap-5">
              <div>
                <h4 className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Forma de Pagamento</h4>
                <div className="bg-background border border-border/60 rounded-lg p-3 text-sm font-medium shadow-sm flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  {pedido.formaPagamento?.nome || "A combinar"}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Vendedor Responsável</h4>
                <div className="text-sm font-medium text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {vendedor?.nome?.charAt(0) || "V"}
                    </div>
                    {vendedor?.nome || "Vendedor não identificado"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Quant.</TableHead>
                    <TableHead className="w-16">Unid.</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right w-24">P.Unit.</TableHead>
                    <TableHead className="text-right w-24">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.itens.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-foreground">
                        {item.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unidade}</TableCell>
                      <TableCell className="text-foreground whitespace-pre-line">
                        {item.descricao}
                        {item.observacao && (
                          <span className="block mt-1 text-xs text-muted-foreground italic">
                            Obs: {item.observacao}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {formatCurrency(item.precoUnitario)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(pedido.valorFrete > 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium text-muted-foreground">
                        Frete ({pedido.tipoFrete})
                      </TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">
                        {formatCurrency(pedido.valorFrete)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold text-foreground">
                      Total R$
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {formatCurrency(pedido.totalGeral + (pedido.valorFrete || 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {pedido.observacoesGerais && (
          <Card className="border-2 border-foreground/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-amber-600" />
                Observacoes Gerais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground font-medium whitespace-pre-line">
                {pedido.observacoesGerais}
              </p>
            </CardContent>
          </Card>
        )}

        {(pedido.observacoesEmbalagem || pedido.observacoesFaturamento) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {pedido.observacoesEmbalagem && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/10 border-b border-border/50 pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Instruções de Embalagem</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-foreground font-medium">{pedido.observacoesEmbalagem}</p>
                </CardContent>
              </Card>
            )}
            {pedido.observacoesFaturamento && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/10 border-b border-border/50 pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Instruções de Faturamento</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-foreground font-medium">{pedido.observacoesFaturamento}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="border-border/50 shadow-sm overflow-hidden border-l-4 border-l-primary/50">
          <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Evolução e Comentários do Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="relative pl-6 border-l-2 border-border/50 ml-2 space-y-6">

                {/* Timeline mock Item */}
                <div className="relative">
                  <div className="absolute -left-[31px] bg-background border-2 border-primary size-4 rounded-full" />
                  <div className="bg-card border border-border/50 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-1 rounded">Sistema</span>
                      <span className="text-xs text-muted-foreground font-mono">Hoje às 10:45</span>
                    </div>
                    <p className="text-sm text-foreground/90">Pedido criado a partir do orçamento {pedido.orcamentoId} e enviado para a fila de Produção.</p>
                  </div>
                </div>

                {/* Initial observation if any */}
                {obsInicial && (
                  <div className="relative">
                    <div className="absolute -left-[31px] bg-amber-500 border-2 border-amber-500 size-4 rounded-full" />
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider bg-amber-500/20 px-2 py-1 rounded">Atenção Integrada</span>
                        <span className="text-xs text-amber-600/70 font-mono">Na criação</span>
                      </div>
                      <p className="text-sm text-amber-800 font-medium whitespace-pre-line">{obsInicial}</p>
                    </div>
                  </div>
                )}

                {/* Evoluções dinâmicas */}
                {evolucoes.map((evol, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] bg-background border-2 border-muted-foreground/30 size-4 rounded-full" />
                    <div className="bg-card border border-border/50 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded">{evol.author}</span>
                        <span className="text-xs text-muted-foreground font-mono">{evol.date}</span>
                      </div>
                      <p className="text-sm text-foreground/90 whitespace-pre-line">{evol.text}</p>
                    </div>
                  </div>
                ))}

              </div>

              <div className="pt-4 border-t border-border/50">
                <h4 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
                  Novo Comentário
                </h4>
                <div className="flex flex-col gap-3">
                  <Textarea
                    value={evolutionText}
                    onChange={e => setEvolutionText(e.target.value)}
                    placeholder="Adicione uma anotação, registre uma ocorrência ou detalhe a evolução da produção..."
                    className="resize-none bg-muted/10 focus-visible:ring-primary/50"
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button 
                      size="sm" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={handleRegistrarEvolucao}
                      disabled={isSavingEvolution || !evolutionText.trim()}
                    >
                      <Plus className="size-4 mr-1" /> {isSavingEvolution ? "Registrando..." : "Registrar Evolução"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
