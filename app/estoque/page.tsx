"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Package, Activity, Clock, FileSpreadsheet } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import { getEstoqueProdutos } from "@/lib/actions/estoque"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import { EstoqueMovimentacaoDialog } from "@/components/estoque-movimentacao-dialog"
import { EstoqueHistoricoDialog } from "@/components/estoque-historico-dialog"
import { EstoqueImportDialog } from "@/components/estoque-import-dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

const PAGE_SIZE = 20

export default function EstoquePage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [movimentacaoOpen, setMovimentacaoOpen] = useState(false)
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<any | null>(null)
  const [situacao, setSituacao] = useState<"" | "ruptura" | "baixo" | "ok">("")

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [situacao])

  const apiParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: debouncedSearch, situacao }),
    [page, debouncedSearch, situacao]
  )

  const { data: dbData, isLoading: loading, refetch: revalidate } = useDataQuery({
    key: apiParams,
    fetcher: () =>
      getEstoqueProdutos({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        situacao: situacao || undefined,
      }),
  })

  const produtosList = dbData?.data || []
  const total = dbData?.total || 0
  const totalPages = dbData?.totalPages || 1
  const kpis = dbData?.kpis || { ruptura: 0, baixo: 0, total: 0, valor: 0 }

  const handleMovimentar = (produto: any) => {
    setSelectedProduto(produto)
    setMovimentacaoOpen(true)
  }

  const handleVerHistorico = (produto: any) => {
    setSelectedProduto(produto)
    setHistoricoOpen(true)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
             <Package className="size-8 text-primary" /> Controle de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de inventário, entradas, saídas e movimentações de produtos.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Itens ativos</p>
            <p className="text-2xl font-semibold mt-1">{kpis.total}</p>
          </div>
          <div className="rounded-lg bg-rose-500/5 p-4">
            <p className="text-[13px] text-rose-600">Em ruptura</p>
            <p className="text-2xl font-semibold mt-1 text-rose-600">{kpis.ruptura}</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 p-4">
            <p className="text-[13px] text-amber-600">Estoque baixo</p>
            <p className="text-2xl font-semibold mt-1 text-amber-600">{kpis.baixo}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Valor em estoque</p>
            <p className="text-2xl font-semibold mt-1">
              {kpis.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Filtro por situação */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { v: "", label: "Todos", n: kpis.total },
            { v: "ruptura", label: "Ruptura", n: kpis.ruptura, cor: "bg-rose-500" },
            { v: "baixo", label: "Baixo", n: kpis.baixo, cor: "bg-amber-500" },
            { v: "ok", label: "OK", n: Math.max(0, kpis.total - kpis.ruptura - kpis.baixo), cor: "bg-emerald-500" },
          ] as const).map((c) => (
            <button
              key={c.v}
              onClick={() => setSituacao(c.v as any)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                situacao === c.v ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {"cor" in c && c.cor && <span className={`size-1.5 rounded-full ${c.cor}`} />}
              {c.label} <span className="tabular-nums">{c.n}</span>
            </button>
          ))}
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10 border-b">
            <div className="flex items-center gap-2 flex-1 max-w-md relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por produto, código ou EAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background focus-visible:ring-primary w-full"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!loading && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {total.toLocaleString("pt-BR")} produto{total !== 1 ? "s" : ""}
                </span>
              )}
              <Button onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="size-4 mr-2" /> Importar Planilha
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/40 text-muted-foreground font-bold border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4">Código / EAN</th>
                    <th className="px-6 py-4 text-right">Saldo Atual</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                      </tr>
                    ))
                  ) : produtosList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        <Package className="size-8 mx-auto opacity-20 mb-3" />
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : produtosList.map(produto => (
                    <tr key={produto.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {produto.nome}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                           <span className="text-xs font-mono">{produto.codigo}</span>
                           {produto.ean && <span className="text-[10px] text-muted-foreground font-mono">EAN: {produto.ean}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-base">
                        {produto.estoque} <span className="text-xs font-normal text-muted-foreground ml-1">{produto.unidadePadrao}</span>
                        {produto.diasCobertura != null && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            ~{produto.diasCobertura}d de cobertura
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {produto.situacao === "ruptura" ? (
                           <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">Ruptura</Badge>
                        ) : produto.situacao === "baixo" ? (
                           <Badge variant="outline" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Estoque Baixo</Badge>
                        ) : (
                           <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Disponível</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                             variant="outline"
                             size="sm"
                             className="group-hover:border-primary/50 transition-colors"
                             onClick={() => handleVerHistorico(produto)}
                          >
                             <Clock className="size-4 mr-2 text-muted-foreground" /> Histórico
                          </Button>
                          <Button
                             variant="outline"
                             size="sm"
                             className="group-hover:border-primary/50 transition-colors"
                             onClick={() => handleMovimentar(produto)}
                          >
                             <Activity className="size-4 mr-2 text-primary" /> Movimentar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="py-4 px-6 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} — exibindo {produtosList.length} de {total.toLocaleString("pt-BR")}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1
                      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink className="cursor-pointer" isActive={page === p} onClick={() => setPage(p)}>
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      }
                      if (p === 2 && page > 3) return <PaginationItem key={`ellipsis-start-${p}`}><PaginationEllipsis /></PaginationItem>
                      if (p === totalPages - 1 && page < totalPages - 2) return <PaginationItem key={`ellipsis-end-${p}`}><PaginationEllipsis /></PaginationItem>
                      return null
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      <EstoqueMovimentacaoDialog
        open={movimentacaoOpen}
        onOpenChange={setMovimentacaoOpen}
        produto={selectedProduto}
        onSuccess={() => revalidate()}
      />

      <EstoqueHistoricoDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        produto={selectedProduto}
      />

      <EstoqueImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => revalidate()}
      />
    </AppShell>
  )
}
