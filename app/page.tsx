"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Eye, Clock, Users, FileText, Factory, ArrowUpRight, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { StatusBadge } from "@/components/ui/status-badge"
import { getDashboardMetrics } from "@/lib/actions/dashboard"
import { useState, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"
import { useDataQuery } from "@/hooks/use-data-query"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

function DashboardContent() {
  const [search, setSearch] = useState("")
  const { isVendedor, vendedor, currentUser } = useAuth()
  
  // Busca a métrica otimizada já contando e fatiada pelo backend
  const { data: dashData, isLoading: loadingDash } = useDataQuery<any>({
    key: `dashboard-stats-${isVendedor ? vendedor?.id : 'admin'}-${currentUser?.id}`,
    fetcher: () => getDashboardMetrics(isVendedor ? vendedor?.id : undefined, currentUser?.id)
  })

  const loading = loadingDash

  const filtered = useMemo(() => {
    if (!dashData?.recentes) return []
    const term = search.toLowerCase()
    return dashData.recentes.filter((p: any) => {
      const cliente = p.cliente
      const vend = p.vendedor
      return (
        p.numero.toLowerCase().includes(term) ||
        (cliente?.razaoSocial || "").toLowerCase().includes(term) ||
        p.status.includes(term) ||
        (vend?.nome || "").toLowerCase().includes(term)
      )
    })
  }, [dashData, search])

  const totalReceita = dashData?.kpis?.totalReceita || 0
  const ativos = dashData?.kpis?.ativos || 0
  const totalOrcamentos = dashData?.kpis?.totalOrcamentos || 0
  const clientesInativosCount = dashData?.kpis?.clientesInativos || 0
  const clientesInativosList = dashData?.clientesInativosList || []
  const dynamicChartData = dashData?.chartData || []

  const renderChart = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      {dynamicChartData.length === 0 ? (
        <div className="flex h-full items-center justify-center">
           <Skeleton className="h-[200px] w-full mx-4" />
        </div>
      ) : (
        <BarChart data={dynamicChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ color: '#0f172a', fontWeight: 500 }}
            labelStyle={{ color: '#64748b', marginBottom: '8px', fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ paddingTop: "10px" }} />
          <Bar dataKey="orcamentos" name="Orçamentos Gerados" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="conversoes" name="Conversões Fechadas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      )}
    </ResponsiveContainer>
  ), [dynamicChartData])

  if (loading && !dashData) {
    return <DashboardSkeleton />
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
            <p className="text-muted-foreground mt-1 text-sm">Lista principal de requisições e acompanhamento de faturamento.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="shadow-sm"><Link href="/orcamentos/novo">Novo Orçamento</Link></Button>
          </div>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle>Últimos Pedidos</CardTitle>
              <CardDescription>Gerencie seus pedidos mais recentes da fábrica</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-muted/50 focus-visible:bg-background border-border"
                />
              </div>
            </div>
            <div className="rounded-md border border-border/50 overflow-x-auto min-h-[200px]">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Número</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">Vendedor</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold">Prazo</TableHead>
                    <TableHead className="text-right font-semibold">Total</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !dashData ? (
                    [1,2,3,4,5].map(i => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
                  ) : filtered.map((ped: any) => {
                    const cliente = ped.cliente
                    return (
                      <TableRow key={ped.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{ped.numero}</TableCell>
                        <TableCell className="text-foreground max-w-[200px] truncate font-medium">{cliente?.razaoSocial || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{ped.vendedor?.nome || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="size-3" />
                            {ped.prazoEntrega ? new Date(ped.prazoEntrega).toLocaleDateString('pt-BR') : 'N/D'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">{formatCurrency(ped.totalGeral)}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge statusObj={(ped as any).statusObj} fallback={ped.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/pedidos/${ped.id}`}>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <Eye className="size-4" /><span className="sr-only">Ver detalhes</span>
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="pt-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">Estatísticas e Resumo</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Estimado</CardTitle>
                <div className="p-2 bg-primary/10 rounded-full"><DollarSign className="size-4 text-primary" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading && !dashData ? "..." : formatCurrency(totalReceita)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ArrowUpRight className="size-3 text-emerald-500" /><span className="text-emerald-500 font-medium">+14.2%</span> no período
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Ativos</CardTitle>
                <div className="p-2 bg-blue-500/10 rounded-full"><Factory className="size-4 text-blue-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading && !dashData ? "..." : ativos}</div>
                <p className="text-xs text-muted-foreground mt-1">Produzindo atualmente</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos Totais</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-full"><FileText className="size-4 text-amber-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading && !dashData ? "..." : totalOrcamentos}</div>
                <p className="text-xs text-muted-foreground mt-1">Aguardando aprovação</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-orange-500/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aviso de Inatividade</CardTitle>
                <div className="p-2 bg-orange-500/10 rounded-full"><Users className="size-4 text-orange-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">{loading && !dashData ? "..." : `${clientesInativosCount} clientes`}</div>
                <p className="text-xs text-muted-foreground mt-1">Sem comprar há +40 dias</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4">
            <Card className="shadow-sm border-border/50">
              <CardHeader><CardTitle>Evolução e Conversão</CardTitle><CardDescription>Orçamentos Criados vs Pedidos Fechados (Mensal)</CardDescription></CardHeader>
              <CardContent className="pl-2"><div className="h-[250px] w-full">{renderChart}</div></CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 flex flex-col border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-orange-500/10 to-transparent">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-orange-600 dark:text-orange-500 text-base">Alerta de Follow-up (Retenção)</CardTitle>
                  <CardDescription>Clientes há mais de 40 dias sem orçar/comprar</CardDescription>
                </div>
                <Users className="size-4 text-orange-500" />
              </CardHeader>
              <CardContent className="flex-1 overflow-auto pt-4 max-h-[300px]">
                <div className="space-y-4 pr-2">
                  {loading && !dashData ? (
                    <div className="flex justify-center items-center py-6 text-muted-foreground gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div> Carregando clientes inativos...</div>
                  ) : clientesInativosList.length > 0 ? clientesInativosList.map((cliente: any) => {
                    const dataCompra = new Date(cliente.ultimaCompra!)
                    const diasInt = Math.floor((new Date().getTime() - dataCompra.getTime()) / (1000 * 3600 * 24))
                    return (
                      <div key={cliente.id} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 p-2 rounded-md transition-colors">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium tracking-tight truncate">{cliente.razaoSocial}</span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1"><Clock className="size-3" /><span>Última Compra: {dataCompra.toLocaleDateString('pt-BR')}</span></div>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 text-[10px] whitespace-nowrap">{diasInt} dias</Badge>
                      </div>
                    )
                  }) : (
                    <div className="text-center text-sm text-muted-foreground py-8">Todos os clientes estão com compras ativas em menos de 40 dias! 🎉</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  )
}
