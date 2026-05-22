"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Search, DollarSign, Wallet, TrendingUp, Calendar, ChevronRight, ChevronDown, HelpCircle } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { getComissoes } from "@/lib/actions/comissoes"
import { useState, useMemo, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function ComissoesPage() {
  const [search, setSearch] = useState("")
  const { isVendedor, vendedor, isAdmin, currentUser } = useAuth()
  
  // Controle de Mês Atual
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [periodo, setPeriodo] = useState(currentMonthStr)
  
  // Controle de Acordeon de Vendedores
  const [expandedSellers, setExpandedSellers] = useState<Record<string, boolean>>({})

  // Se for vendedor, busca apenas as comissões dele
  const vendedorId = isVendedor ? vendedor?.id : undefined

  const { data: dbData, isLoading: loading } = useDataQuery<any>({
    key: `comissoes-${vendedorId || 'admin'}-${periodo}`,
    fetcher: () => {
      const [ano, mes] = periodo.split('-').map(Number)
      return getComissoes(vendedorId, mes, ano, currentUser?.id)
    }
  })

  const todasParcelas = dbData?.dados || []
  const kpisRaw = dbData?.kpis || { totalVendas: 0, totalComissoes: 0, pedidosConcluidos: 0 }

  // Filtra as parcelas que caem no mês selecionado
  const parcelasDoMes = useMemo(() => {
    return todasParcelas.filter((c: any) => {
      if (!c.dataPrevista) return false
      return c.dataPrevista.startsWith(periodo)
    })
  }, [todasParcelas, periodo])

  // Calcula KPIs focados no Mês
  const kpisMes = useMemo(() => {
    const totalComissoes = parcelasDoMes.reduce((acc: number, curr: any) => acc + curr.valorComissao, 0)
    // Para nao somar duplicado do mesmo pedido, usamos um set
    const pedidosUnicos = new Set(parcelasDoMes.map((p: any) => p.pedidoId))
    return {
      totalVendas: kpisRaw.totalVendas, // Agora o servidor já devolve o total das vendas criadas NO MÊS
      totalComissoes, // O que ele vai GANHAR no mes (soma das parcelas)
      pedidosEnvolvidos: pedidosUnicos.size
    }
  }, [parcelasDoMes, kpisRaw])

  // Agrupamento
  const agrupadoPorVendedor = useMemo(() => {
    const term = search.toLowerCase()
    
    // Filtrar por busca
    const filtered = parcelasDoMes.filter((c: any) => {
      if (term) {
        return (
          c.numero.toLowerCase().includes(term) ||
          c.clienteNome.toLowerCase().includes(term) ||
          c.vendedorNome.toLowerCase().includes(term)
        )
      }
      return true
    })

    const group: Record<string, { nome: string, total: number, parcelas: any[] }> = {}
    
    filtered.forEach((c: any) => {
      const vId = c.vendedorId || 'nd'
      if (!group[vId]) {
        group[vId] = { nome: c.vendedorNome, total: 0, parcelas: [] }
      }
      group[vId].total += c.valorComissao
      group[vId].parcelas.push(c)
    })

    return Object.values(group).sort((a, b) => b.total - a.total)
  }, [parcelasDoMes, search])

  const toggleSeller = (nome: string) => {
    setExpandedSellers(prev => ({ ...prev, [nome]: !prev[nome] }))
  }

  // Se admin abre todos ao iniciar uma busca
  useEffect(() => {
    if (search && isAdmin) {
      const novos = { ...expandedSellers }
      agrupadoPorVendedor.forEach(g => novos[g.nome] = true)
      setExpandedSellers(novos)
    }
  }, [search])

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Comissões Mensais</h1>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:text-primary">
                    <HelpCircle className="size-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm border-b pb-2">Critérios de Cálculo</h4>
                    <ul className="text-xs space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">✓ Status:</strong> Apenas pedidos confirmados (exclui rascunhos).</li>
                      <li><strong className="text-foreground">✓ Valor Bruto:</strong> Calculado sobre o total de itens (Qtd x Preço), ignorando abatimentos de créditos ou bonificações.</li>
                      <li><strong className="text-foreground">✓ Rateio:</strong> Dividido automaticamente pelo número de parcelas (ex: 30/60/90 = 3 parcelas).</li>
                      <li><strong className="text-foreground">✓ Datas:</strong> 1ª parcela na data do pedido, as demais a cada 30 dias.</li>
                      <li><strong className="text-foreground">✓ Vendedor:</strong> Utiliza a % de comissão atual configurada no cadastro do vendedor.</li>
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "Totalizador de comissões por vendedor e previsão de pagamentos" : "Acompanhamento dos seus ganhos e parcelas previstas"}
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border border-border/50">
            <Calendar className="size-4 text-muted-foreground ml-2" />
            <Input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-40 border-none bg-transparent shadow-none focus-visible:ring-0 font-medium"
            />
          </div>
        </div>

        {/* KPI Cards (Refletindo o Mês Selecionado) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="shadow-sm border-border/50 bg-gradient-to-br from-card to-card/50 overflow-hidden relative">
            <div className="absolute -right-2 -top-4 p-3 opacity-5 pointer-events-none">
              <TrendingUp className="size-24" />
            </div>
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-500" />
                Pedidos do Mês
              </p>
              <h2 className="text-2xl font-bold text-foreground">
                {loading ? "..." : kpisMes.pedidosEnvolvidos} <span className="text-sm font-normal text-muted-foreground tracking-normal">movimentações</span>
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-1">Ganhos globais (histórico): {formatCurrency(kpisRaw.totalVendas)}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900 overflow-hidden relative">
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <DollarSign className="size-4" />
                Previsão de Pagamento
              </p>
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {loading ? "..." : formatCurrency(kpisMes.totalComissoes)}
              </h2>
              <p className="text-xs text-emerald-500 font-medium mt-1">Comissões caindo neste mês</p>
            </CardContent>
          </Card>

          <Card className="hidden lg:flex shadow-sm border-border/50 bg-gradient-to-br from-purple-50 to-background dark:from-purple-950/20 dark:to-background border-purple-100 dark:border-purple-900 overflow-hidden relative">
            <CardContent className="p-5 flex flex-col gap-1 w-full justify-center">
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <Wallet className="size-4" />
                Totalizador
              </p>
              <h2 className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                Apurado
              </h2>
              <p className="text-xs text-purple-500 font-medium">Os valores já refletem parcelamentos das notas.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle>Espelho de Comissões</CardTitle>
              <CardDescription>
                Parcelas e rateios provisionados para {periodo.split('-').reverse().join('/')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar pedido, cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-muted/50 focus-visible:bg-background border-border"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/50 overflow-hidden">
              {loading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : agrupadoPorVendedor.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2 bg-muted/10">
                  <Wallet className="size-8 opacity-20" />
                  <p>Nenhuma parceia prevista para este mês.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {agrupadoPorVendedor.map((grupo) => {
                    const isExpanded = isAdmin ? expandedSellers[grupo.nome] : true; // Vendedor sempre ver aberto

                    return (
                      <div key={grupo.nome} className="flex flex-col bg-card">
                        {/* Header Agrupador para Admin */}
                        {isAdmin && (
                          <div 
                            className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => toggleSeller(grupo.nome)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                              <div className="flex items-center gap-2">
                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                                  {grupo.nome.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground">{grupo.nome}</span>
                                <Badge variant="outline" className="ml-2 bg-background shadow-none">
                                  {grupo.parcelas.length} parcelas
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Total a pagar</p>
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(grupo.total)}</p>
                            </div>
                          </div>
                        )}

                        {/* Tabela de Parcelas */}
                        {isExpanded && (
                          <div className={isAdmin ? "px-4 pb-4 bg-card" : "p-0"}>
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent border-0">
                                  <TableHead className="font-semibold h-10 w-[120px]">Nº Pedido</TableHead>
                                  <TableHead className="font-semibold h-10">Cliente</TableHead>
                                  <TableHead className="font-semibold h-10">Total Pedido / %</TableHead>
                                  <TableHead className="font-semibold h-10">Condição / Parcela</TableHead>
                                  <TableHead className="text-right font-semibold h-10 w-[160px]">Comissão Rateada</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grupo.parcelas.map((c: any) => (
                                  <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors border-border/30">
                                    <TableCell className="font-medium font-mono text-xs">
                                      <Link 
                                        href={`/pedidos/${c.pedidoId}`}
                                        className="text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                        {c.numero}
                                        <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-foreground max-w-[180px] truncate">
                                      {c.clienteNome}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-foreground">{formatCurrency(c.totalPedido)}</span>
                                        <span className="text-[10px] text-muted-foreground">{c.percentual}% de comissão</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[10px] font-medium shadow-none bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                                            {c.formaPagamentoNome}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground font-medium">
                                            {c.parcelaAtual}/{c.totalParcelas}
                                          </span>
                                        </div>
                                        {c.totalParcelas > 1 && (
                                          <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">
                                            Rateado em {c.totalParcelas}x
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(c.valorComissao)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
