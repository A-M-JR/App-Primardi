"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Search, Plus, Eye, Users, Clock, AlertTriangle, Building2 } from "lucide-react"
import { getClientes } from "@/lib/actions/clientes"
import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

export default function ClientesPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [fRetencao, setFRetencao] = useState<"todos" | "30d" | "60d">("todos")
  const [page, setPage] = useState(1)

  // Debounce simple
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset page on new search
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  const { data: dbData, isLoading: loading } = useDataQuery<any>({
    key: { type: 'clientes', page, search: debouncedSearch, filter: fRetencao },
    fetcher: () => getClientes({ page, limit: 15, search: debouncedSearch, filter: fRetencao })
  })

  // We fallback to empty structures if null
  const clientesList = dbData?.data || []
  const KPIs = dbData?.kpis || { total: 0, semCompra30: 0, semCompra60: 0 }
  const totalPages = dbData?.totalPages || 1


  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie a base de clientes da gráfica
            </p>
          </div>
          <Link href="/clientes/novo">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02]">
              <Plus className="size-4 mr-2" />
              Novo Cliente
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className={`bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fRetencao === 'todos' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => setFRetencao('todos')}
          >
            <div className="absolute -right-2 -top-4 p-3 opacity-5 pointer-events-none">
              <Building2 className="size-24" />
            </div>
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Total de Clientes
              </p>
              <h2 className="text-2xl font-bold block truncate text-foreground">{loading && clientesList?.length === 0 ? "..." : KPIs.total}</h2>
              <p className="text-xs text-muted-foreground font-medium mt-1">Base Ativa Cadastrada</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-amber-50 to-background dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fRetencao === '30d' ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => { setFRetencao('30d'); setPage(1); }}
          >
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Clock className="size-4" />
                Alerta de Retenção
              </p>
              <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-300">{loading && clientesList?.length === 0 ? "..." : KPIs.semCompra30}</h2>
              <p className="text-xs text-amber-500 font-medium">+30 dias sem compras</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-red-50 to-background dark:from-red-950/20 dark:to-background border-red-100 dark:border-red-900 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${fRetencao === '60d' ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
            onClick={() => { setFRetencao('60d'); setPage(1); }}
          >
            <CardContent className="p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Risco Evasão
              </p>
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">{loading && clientesList?.length === 0 ? "..." : KPIs.semCompra60}</h2>
              <p className="text-xs text-red-500 font-medium">+60 dias sem movimentação</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {fRetencao === 'todos' ? 'Carteira de Clientes' : (fRetencao === '30d' ? 'Clientes em Alerta de Retenção (30-59 dias)' : 'Clientes em Risco Severo (+60 dias)')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por razão social, CNPJ ou cidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-muted/50 focus-visible:bg-background border-border"
                />
              </div>
              {fRetencao !== 'todos' && (
                <Button variant="ghost" onClick={() => setFRetencao('todos')} className="text-muted-foreground hover:text-foreground">
                  Limpar Filtros
                </Button>
              )}
            </div>
            <div className="rounded-md border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Razão Social</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">CNPJ</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold">Cidade/UF</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">Telefone</TableHead>
                    <TableHead className="text-center font-semibold">Histórico</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && clientesList?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground"><div className="flex justify-center items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> Carregando dados...</div></TableCell></TableRow>
                  ) : clientesList.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><p>Nenhum cliente encontrado.</p></TableCell></TableRow>
                  ) : clientesList.map((cliente: any) => {
                    const numOrcamentos = cliente._count?.orcamentos || 0
                    const numPedidos = cliente._count?.pedidos || 0
                    return (
                      <TableRow key={cliente.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground max-w-[200px] truncate">{cliente.razaoSocial}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">{cliente.cnpj}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{cliente.cidade} / <span className="text-foreground">{cliente.estado}</span></TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{cliente.telefone}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900 border shadow-none">{numOrcamentos} orç.</Badge>
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900 shadow-none">{numPedidos} ped.</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            <Link href={`/clientes/${cliente.id}`}>
                                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                    <Eye className="size-4" />
                                </Button>
                            </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Paginação */}
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
                      // Logic to show limited page numbers (1, 2, 3, ... last)
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
