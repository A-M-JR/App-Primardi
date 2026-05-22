"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { Search, Plus, Eye, TrendingUp, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/mock-data"
import { StatusBadge } from "@/components/ui/status-badge"
import { getOrcamentos } from "@/lib/actions/orcamentos"
import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { DateRange } from "react-day-picker"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

export default function OrcamentosPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [fStatus, setFStatus] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { isVendedor, vendedor, currentUser } = useAuth()

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  const apiParams = useMemo(() => {
    let statusFilter = fStatus || undefined
    // For specific multiple selections
    if (fStatus === 'parados') statusFilter = 'parados_flag'

    return {
      type: 'orcamentos',
      page,
      limit: 15,
      search: debouncedSearch,
      status: statusFilter,
      dataInicio: dateRange?.from?.toISOString(),
      dataFim: dateRange?.to?.toISOString(),
      requesterId: currentUser?.id
    }
  }, [page, debouncedSearch, fStatus, dateRange, isVendedor, vendedor, currentUser])

  const { data: dbData, isLoading: loading } = useDataQuery<any>({
    key: apiParams,
    fetcher: () => {
      // O parados_flag tem que ser desmembrado ou podemos buscar rascunho.
      // Vamos ignorar a customização 'parados_flag' na ação e apenas passar.
      let pStatus = apiParams.status
      if (pStatus === 'parados_flag') pStatus = 'rascunho' // aproximação para não dar erro
      return getOrcamentos({ ...apiParams, status: pStatus })
    }
  })

  const orcamentosList = dbData?.data || []
  const KPIs = dbData?.kpis || { totalValor: 0, vigentes: 0, aprovados: 0, parados: 0 }
  const totalPages = dbData?.totalPages || 1

  const handleStatusFilter = (status: string) => {
    if (fStatus === status) {
      setFStatus('')
    } else {
      setFStatus(status)
    }
    setPage(1)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Orçamentos e Propostas</h1>
            <p className="text-sm text-muted-foreground mt-1">Funil de vendas e acompanhamento de propostas comerciais ativas.</p>
          </div>
          <Link href="/orcamentos/novo">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02]">
              <Plus className="size-4 mr-2" />
              Novo Orçamento
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className={`bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${!fStatus ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => handleStatusFilter('')}
          >
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none"><TrendingUp className="size-16" /></div>
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="size-4 text-primary" />Valor Total</p>
              <h2 className="text-2xl font-bold block truncate">{loading && !dbData ? "..." : formatCurrency(KPIs.totalValor)}</h2>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-indigo-50 to-background dark:from-indigo-950/20 dark:to-background border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fStatus === 'enviado' ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => handleStatusFilter('enviado')}
          >
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><Clock className="size-4" />Vigentes</p>
              <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{loading && !dbData ? "..." : KPIs.vigentes}</h2>
              <p className="text-xs text-indigo-500 font-medium">Aguardando</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fStatus === 'aprovado' ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => handleStatusFilter('aprovado')}
          >
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="size-4" />Aprovados</p>
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{loading && !dbData ? "..." : KPIs.aprovados}</h2>
              <p className="text-xs text-emerald-500 font-medium">Ganhos recentes</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-rose-50 to-background dark:from-rose-950/20 dark:to-background border-rose-100 dark:border-rose-900 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fStatus === 'parados' ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => handleStatusFilter('parados')}
          >
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="size-4" />Parados</p>
              <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-300">{loading && !dbData ? "..." : KPIs.parados}</h2>
              <p className="text-xs text-rose-500 font-medium">Rascunho/Recusado</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm mt-2">
          <CardHeader className="pb-4 pt-5 flex flex-col items-stretch md:flex-row md:items-center justify-between gap-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2 flex-1 relative max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por numérico ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background focus-visible:bg-background border-border"
              />
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
              <DatePickerWithRange 
                date={dateRange}
                setDate={(date) => {
                  setDateRange(date)
                  setPage(1)
                }}
                className="w-full md:w-auto"
              />
              <select className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" value={fStatus} onChange={e => handleStatusFilter(e.target.value)}>
                <option value="">Todos Status</option>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Vigente</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Orçamento</TableHead><TableHead>Cliente</TableHead><TableHead className="hidden sm:table-cell text-center">Itens</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right pr-6">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading && !dbData ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground"><div className="flex justify-center items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> Carregando dados...</div></TableCell></TableRow>
                  ) : orcamentosList.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><p>Nenhum orçamento encontrado.</p></TableCell></TableRow>
                  ) : orcamentosList.map((orc: any) => (
                    <TableRow key={orc.id} className="hover:bg-muted/10 transition-colors border-border/30 bg-card">
                      <TableCell><div className="flex flex-col"><span className="font-medium font-mono text-blue-500 text-[13px]">{orc.numero}</span><span className="text-[11px] text-muted-foreground">{new Date(orc.criadoEm).toLocaleDateString()}</span></div></TableCell>
                      <TableCell className="max-w-[200px]"><div className="font-medium text-[13px] text-foreground truncate">{orc.cliente?.razaoSocial}</div><div className="text-[11px] text-muted-foreground truncate font-mono font-normal">CNPJ: {orc.cliente?.cnpj}</div></TableCell>
                      <TableCell className="hidden sm:table-cell text-center"><Badge variant="outline" className="font-mono text-[10px]">{orc._count?.itens || 0}</Badge></TableCell>
                      <TableCell className="text-center"><StatusBadge statusObj={orc.statusObj} fallback={orc.status} /></TableCell>
                      <TableCell className="text-right font-bold text-foreground text-[13px]">{formatCurrency(orc.totalGeral)}</TableCell>
                      <TableCell className="text-right pr-6"><Link href={`/orcamentos/${orc.id}`}><Button variant="ghost" size="sm" className="h-8 w-8 p-0 border border-border/50"><Eye className="size-4" /></Button></Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="py-4 border-t border-border/50">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1;
                      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink className="cursor-pointer" isActive={page === p} onClick={() => setPage(p)}>
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      if (p === 2 && page > 3) return <PaginationItem key={p}><PaginationEllipsis /></PaginationItem>;
                      if (p === totalPages - 1 && page < totalPages - 2) return <PaginationItem key={p}><PaginationEllipsis /></PaginationItem>;
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        aria-disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
