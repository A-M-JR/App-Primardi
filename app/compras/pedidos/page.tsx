"use client"

import { AppShell } from "@/components/app-shell"
import { getPedidosCompra } from "@/lib/actions/compras/pedido-compra"
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
import { STATUS_PEDIDO_OPTS, labelStatus } from "@/lib/compras/list-filters"

export default function PedidosCompraPage() {
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

  const { data: pedidos } = useDataQuery({
    key: `pedidos-compra-${JSON.stringify(filtros)}`,
    fetcher: () => getPedidosCompra(filtros, currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-pedidos",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <ComprasPageHeader
          title="Pedidos de Compra"
          description="Pedidos gerados pelo planejamento ou cotação, agrupados por fornecedor"
        />

        <Card className="shadow-sm border-border/50 overflow-hidden">
          <ComprasListFiltros
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar pedido ou fornecedor..."
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_PEDIDO_OPTS}
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
                    <TableHead>Pedido</TableHead>
                    <TableHead className="hidden md:table-cell">Fornecedor</TableHead>
                    <TableHead className="hidden sm:table-cell">Itens</TableHead>
                    <TableHead className="hidden lg:table-cell">Data</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos?.data?.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{p.numero}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {p.fornecedor.razaoSocial}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums">
                        {p._count.itens}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {p.totalGeral.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {labelStatus(p.status, STATUS_PEDIDO_OPTS)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/compras/pedidos/${p.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!pedidos?.data?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Nenhum pedido encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ComprasPagination
              page={pedidos?.page ?? 1}
              totalPages={pedidos?.totalPages ?? 1}
              total={pedidos?.total ?? 0}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
