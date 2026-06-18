"use client"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPlanejamentos } from "@/lib/actions/compras/planejamento"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { useComprasListFiltros } from "@/hooks/use-compras-list-filtros"
import Link from "next/link"
import { Plus, Eye } from "lucide-react"
import { PlanejamentoAjuda } from "@/components/compras/planejamento-ajuda"
import { ComprasPageHeader } from "@/components/compras/compras-page-header"
import { ComprasListFiltros } from "@/components/compras/compras-list-filtros"
import { ComprasPagination } from "@/components/compras/compras-pagination"
import { NovoPlanejamentoDialog } from "@/components/compras/novo-planejamento-dialog"
import { STATUS_PLANEJAMENTO_OPTS, labelStatus } from "@/lib/compras/list-filters"
import { useState } from "react"

export default function PlanejamentosPage() {
  const { currentUser } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const {
    search,
    setSearch,
    status,
    setStatus,
    dateRange,
    setDateRange,
    setPage,
    filtros,
    hasActiveFilters,
    clearFilters,
  } = useComprasListFiltros()

  const { data: planejamentos, refetch } = useDataQuery({
    key: `planejamentos-compra-${JSON.stringify(filtros)}`,
    fetcher: () => getPlanejamentos(filtros, currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <ComprasPageHeader
          title="Planejamento de Compras"
          description="Comparativo por demanda, importações vinculadas e geração de pedidos ou cotações"
          extra={<PlanejamentoAjuda variant="lista" />}
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4 mr-2" />
              Novo planejamento
            </Button>
          }
        />

        <Card className="shadow-sm border-border/50 overflow-hidden">
          <ComprasListFiltros
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por número ou nome..."
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_PLANEJAMENTO_OPTS}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Planejamento</TableHead>
                    <TableHead className="hidden md:table-cell">Importações</TableHead>
                    <TableHead className="hidden sm:table-cell">Itens</TableHead>
                    <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planejamentos?.data?.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.titulo || p.numero}</p>
                          <p className="text-xs text-muted-foreground">{p.numero}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">
                        {p._count.importacoes}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums">
                        {p._count.itens}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {labelStatus(p.status, STATUS_PLANEJAMENTO_OPTS)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/compras/planejamentos/${p.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!planejamentos?.data?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        Nenhum planejamento encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ComprasPagination
              page={planejamentos?.page ?? 1}
              totalPages={planejamentos?.totalPages ?? 1}
              total={planejamentos?.total ?? 0}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>

        <NovoPlanejamentoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requesterId={currentUser?.id}
          onSuccess={() => refetch()}
        />
      </div>
    </AppShell>
  )
}
