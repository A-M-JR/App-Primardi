"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Building2, Ticket, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Suspense, useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency } from "@/lib/mock-data"
import { getOrcamentoById } from "@/lib/actions/orcamentos"
import { savePedido } from "@/lib/actions/pedidos"
import { CreditCard } from "lucide-react"

function NovoPedidoForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { currentUser } = useAuth()
    const orcamentoId = searchParams.get("orcamentoId")

    const [orcamento, setOrcamento] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [formasPagamento, setFormasPagamento] = useState<any[]>([])
    const [formaPagamentoId, setFormaPagamentoId] = useState<string>("")

    useEffect(() => {
        if (!currentUser) return

        Promise.all([
            orcamentoId ? getOrcamentoById(Number(orcamentoId), currentUser?.id) : Promise.resolve(null),
            fetch("/api/formas-pagamento").then(res => res.json())
        ]).then(([data, formas]) => {
            if (data) {
                setOrcamento(data)
                if (data.prazoEntrega) {
                    setPrazoEntrega(new Date(data.prazoEntrega).toISOString().split('T')[0])
                }
                if (data.formaPagamentoId) {
                    setFormaPagamentoId(data.formaPagamentoId.toString())
                }
                if ((data as any).ocCliente) {
                    setOcCliente((data as any).ocCliente)
                }
                if (data.valorFrete !== undefined) {
                    setValorFrete(data.valorFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                }
            }
            setFormasPagamento(formas || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [orcamentoId])

    const cliente = orcamento?.cliente
    const vendedor = orcamento?.vendedor

    // Formulário State

    const [prazoEntrega, setPrazoEntrega] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 15)
        return d.toISOString().split('T')[0]
    })
    const [formaPagamento, setFormaPagamento] = useState("30/60 Dias")
    const [frete, setFrete] = useState("FOB")
    const [valorFrete, setValorFrete] = useState("0,00")
    const [comprador, setComprador] = useState("")
    const [ocCliente, setOcCliente] = useState("")

    const [obsGerais, setObsGerais] = useState("")
    const [obsPcp, setObsPcp] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (loading) {
        return <div className="p-20 text-center animate-pulse text-muted-foreground">Carregando dados do orçamento base...</div>
    }

    if (!orcamento || !cliente) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                <div className="bg-muted/50 p-6 rounded-full mb-4">
                    <Ticket className="size-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg mb-4">Orçamento base não encontrado ou não informado.</p>
                <Link href="/orcamentos">
                    <Button variant="outline">Voltar para Orçamentos</Button>
                </Link>
            </div>
        )
    }

    const handleEfetivar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting) return
        setIsSubmitting(true)

        try {
            const pedidoData = {
                orcamentoId: orcamento.id,
                clienteId: orcamento.clienteId,
                vendedorId: orcamento.vendedorId,
                prazoEntrega,
                formaPagamentoId: formaPagamentoId ? Number(formaPagamentoId) : null,
                nomeVendedor: vendedor?.nome,
                nomeComprador: comprador,
                frete,
                valorFrete: parseFloat(valorFrete.replace(/\./g, '').replace(',', '.')) || 0,
                observacoesGerais: obsGerais + (obsPcp ? `\n\n[PCP]: ${obsPcp}` : ""),
                ocCliente,
                totalGeral: orcamento.totalGeral,
            }

            const reqItens = orcamento.itens.map((i: any) => ({
                produtoId: i.produtoId || null,
                descricao: i.descricao,
                quantidade: i.quantidade,
                unidade: i.unidade,
                precoUnitario: i.precoUnitario,
                total: i.total,
                observacao: i.observacao || ""
            }))

            const resp = await savePedido({ ...pedidoData, itens: reqItens }, currentUser?.id)
            toast.success("Pedido criado com sucesso!", {
                description: `Orçamento ${orcamento.numero} foi efetivado. Número: ${resp.numero}`
            })
            router.push("/pedidos")
        } catch (error) {
            console.error(error)
            toast.error("Erro ao criar pedido no banco.")
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/orcamentos/${orcamento.id}`}>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full hover:bg-muted">
                        <ArrowLeft className="size-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        Efetivar Pedido
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Revisando e convertendo a proposta <span className="font-mono text-primary">{orcamento.numero}</span> em Ordem de Produção.
                    </p>
                </div>
            </div>

            {/* Info Orçamento Card */}
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-full hidden sm:block">
                            <Building2 className="size-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground uppercase tracking-wider mb-1">Cliente Vinculado</p>
                            <p className="text-base font-bold text-primary">{cliente.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">CNPJ: {cliente.cnpj} | Vendedor: {vendedor?.nome}</p>
                        </div>
                    </div>
                    <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-primary/20 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                        <p className="text-sm text-muted-foreground">Valor Total Orçado</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(orcamento.totalGeral)}</p>
                        <p className="text-xs text-muted-foreground">{orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'} na proposta</p>
                    </div>
                </CardContent>
            </Card>

            <form onSubmit={handleEfetivar} className="flex flex-col gap-6">

                {/* Row 1: Dados Comerciais */}
                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                        <CardTitle className="text-lg">Condições e Faturamento</CardTitle>
                        <CardDescription>Informações que constarão na Nota Fiscal e Financeiro</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="formaPagamento" className="flex items-center gap-1.5">
                                <CreditCard className="size-3.5 text-primary" />
                                Forma de Pagamento
                            </Label>
                            <Select value={formaPagamentoId} onValueChange={(val) => {
                                setFormaPagamentoId(val)
                                // Sincroniza o texto legado para manter coerência
                                const selected = formasPagamento.find(f => f.id.toString() === val)
                                if (selected) setFormaPagamento(selected.nome)
                            }}>
                                <SelectTrigger id="formaPagamento" className="w-full">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {formasPagamento.filter(f => f.ativo).map(f => (
                                        <SelectItem key={f.id} value={f.id.toString()}>{f.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="prazoEntrega">Prazo de Entrega</Label>
                            <Input
                                id="prazoEntrega"
                                type="date"
                                value={prazoEntrega}
                                onChange={e => setPrazoEntrega(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="frete">Tipo de Frete</Label>
                            <Select value={frete} onValueChange={setFrete}>
                                <SelectTrigger id="frete" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CIF">CIF (Por nossa conta)</SelectItem>
                                    <SelectItem value="FOB">FOB (Por conta do cliente)</SelectItem>
                                    <SelectItem value="Retirada">Retirada na Fábrica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="valorFrete">Valor do Frete (R$)</Label>
                            <Input 
                                id="valorFrete" 
                                value={valorFrete} 
                                onChange={e => {
                                    let v = e.target.value.replace(/\D/g, '');
                                    if (!v) v = "0";
                                    const n = parseInt(v, 10) / 100;
                                    setValorFrete(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                }} 
                                placeholder="0,00"
                                disabled={frete === "FOB" || frete === "Retirada"}
                                className={frete === "FOB" || frete === "Retirada" ? "opacity-50 w-full" : "w-full"}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ocCliente">OC do Cliente</Label>
                            <Input id="ocCliente" value={ocCliente} onChange={e => setOcCliente(e.target.value)} placeholder="Ex: 12345" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="comprador">A/C (Nome Comprador)</Label>
                            <Input id="comprador" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="João da Silva" />
                        </div>
                    </CardContent>
                </Card>



                {/* Row 3: Observações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                            <CardTitle className="text-base">Observações Gerais (Cliente)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Textarea
                                placeholder="Anotações para constar no Pedido do Cliente..."
                                className="min-h-[100px] resize-none"
                                value={obsGerais}
                                onChange={e => setObsGerais(e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 pb-4">
                            <CardTitle className="text-base text-amber-700 dark:text-amber-500">Observações de Produção / PCP</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Textarea
                                placeholder="Exigências técnicas críticas, revisões de faca, atenções de cor para a máquina..."
                                className="min-h-[100px] resize-none border-amber-200 dark:border-amber-900 focus-visible:ring-amber-500"
                                value={obsPcp}
                                onChange={e => setObsPcp(e.target.value)}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4 border-t border-border/50 pt-6">
                    <Link href={`/orcamentos/${orcamento.id}`}>
                        <Button variant="outline" type="button" className="h-12 px-10" disabled={isSubmitting}>
                            Cancelar
                        </Button>
                    </Link>
                    <Button type="submit" className="bg-primary h-12 px-10" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">Gravando Pedido...</span>
                        ) : (
                            <span className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="size-5" />
                                Validar e Criar Pedido
                            </span>
                        )}
                    </Button>
                </div>

            </form>
        </div>
    )
}

export default function NovoPedidoPage() {
    return (
        <AppShell>
            <Suspense fallback={<div className="p-10 text-center animate-pulse">Carregando formulário...</div>}>
                <NovoPedidoForm />
            </Suspense>
        </AppShell>
    )
}
