"use client"

import { AppShell } from "@/components/app-shell"
import { getCotacoesCompra } from "@/lib/actions/compras/cotacao"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { useComprasListFiltros } from "@/hooks/use-compras-list-filtros"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ComprasPageHeader } from "@/components/compras/compras-page-header"
import { ComprasListFiltros } from "@/components/compras/compras-list-filtros"
import { ComprasPagination } from "@/components/compras/compras-pagination"
import { STATUS_COTACAO_OPTS, labelStatus } from "@/lib/compras/list-filters"

export default function CotacoesPage() {
  const { currentUser } = useAuth()
  const {
    search,
    setSearch,
    status,
    setStatus,
    fornecedorId,
    setFornecedorId,
    dateRange,
    setDateRange,
    setPage,
    filtros,
    hasActiveFilters,
    clearFilters,
  } = useComprasListFiltros()

  const { data: cotacoes } = useDataQuery({
    key: `cotacoes-compra-${JSON.stringify(filtros)}`,
    fetcher: () => getCotacoesCompra(filtros, currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-cotacoes",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <ComprasPageHeader
          title="Cotações"
          description="Cotações competitivas geradas a partir do planejamento"
        />

        <Card className="shadow-sm border-border/50 overflow-hidden">
          <ComprasListFiltros
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por número..."
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_COTACAO_OPTS}
            fornecedorId={fornecedorId}
            onFornecedorChange={setFornecedorId}
            fornecedores={fornecedores}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Cotação</TableHead>
                    <TableHead className="hidden md:table-cell">Itens</TableHead>
                    <TableHead className="hidden sm:table-cell">Fornecedores</TableHead>
                    <TableHead className="hidden lg:table-cell">Criada em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotacoes?.data?.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.titulo || c.numero}</p>
                          <p className="text-xs text-muted-foreground">{c.numero}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">
                        {c._count.itens}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums">
                        {c._count.fornecedores}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {labelStatus(c.status, STATUS_COTACAO_OPTS)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/compras/cotacoes/${c.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!cotacoes?.data?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        Nenhuma cotação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ComprasPagination
              page={cotacoes?.page ?? 1}
              totalPages={cotacoes?.totalPages ?? 1}
              total={cotacoes?.total ?? 0}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
