"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getImportacoes, excluirImportacao } from "@/lib/actions/compras/importacao"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { useComprasListFiltros } from "@/hooks/use-compras-list-filtros"
import Link from "next/link"
import { Plus, FileSpreadsheet, Trash2, Eye } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FornecedorFormDialog } from "@/components/fornecedor-form-dialog"
import { ComprasPageHeader } from "@/components/compras/compras-page-header"
import { ComprasListFiltros } from "@/components/compras/compras-list-filtros"
import { ComprasPagination } from "@/components/compras/compras-pagination"
import { NovaImportacaoDialog } from "@/components/compras/nova-importacao-dialog"
import { STATUS_IMPORTACAO_OPTS, labelStatus } from "@/lib/compras/list-filters"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  RASCUNHO: "secondary",
  PROCESSANDO: "default",
  CONCLUIDA: "default",
  ERRO: "destructive",
  CANCELADA: "outline",
}

export default function ImportacoesPage() {
  const { currentUser } = useAuth()
  const [excluirId, setExcluirId] = useState<number | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [formFornecedorOpen, setFormFornecedorOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

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

  const { data: importacoes, refetch } = useDataQuery({
    key: `importacoes-${JSON.stringify(filtros)}`,
    fetcher: () => getImportacoes(filtros, currentUser?.id),
  })

  const { data: fornecedores, refetch: refetchFornecedores } = useDataQuery({
    key: "fornecedores-import",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  async function handleExcluir() {
    if (!excluirId) return
    setExcluindo(true)
    try {
      await excluirImportacao(excluirId, currentUser?.id)
      toast.success("Importação removida.")
      setExcluirId(null)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.")
    } finally {
      setExcluindo(false)
    }
  }

  const impExcluir = importacoes?.data?.find((i) => i.id === excluirId)

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <ComprasPageHeader
          title="Importações de Preços"
          description="Planilhas de preço por fornecedor para usar no planejamento"
          actions={
            <>
              <Button variant="outline" onClick={() => setFormFornecedorOpen(true)}>
                <Plus className="size-4 mr-2" />
                Cadastrar fornecedor
              </Button>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Plus className="size-4 mr-2" />
                Nova importação
              </Button>
            </>
          }
        />

        <Card className="shadow-sm border-border/50 overflow-hidden">
          <ComprasListFiltros
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar arquivo ou fornecedor..."
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_IMPORTACAO_OPTS}
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
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="hidden md:table-cell">Fornecedor</TableHead>
                    <TableHead className="hidden sm:table-cell">Linhas</TableHead>
                    <TableHead className="hidden lg:table-cell">Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importacoes?.data?.map((imp) => (
                    <TableRow key={imp.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet className="size-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{imp.nomeArquivo}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {imp.fornecedor.razaoSocial}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums text-sm">
                        {imp.linhasValidas}/{imp.totalLinhas}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(imp.criadoEm).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[imp.status] ?? "outline"}>
                          {labelStatus(imp.status, STATUS_IMPORTACAO_OPTS)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/compras/importacoes/${imp.id}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setExcluirId(imp.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!importacoes?.data?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        Nenhuma importação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ComprasPagination
              page={importacoes?.page ?? 1}
              totalPages={importacoes?.totalPages ?? 1}
              total={importacoes?.total ?? 0}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>

        <AlertDialog open={excluirId !== null} onOpenChange={(open) => !open && setExcluirId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover importação?</AlertDialogTitle>
              <AlertDialogDescription>
                {impExcluir
                  ? `A planilha "${impExcluir.nomeArquivo}" será excluída permanentemente.`
                  : "Esta ação não pode ser desfeita."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void handleExcluir()
                }}
                disabled={excluindo}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {excluindo ? "Removendo..." : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <FornecedorFormDialog
          open={formFornecedorOpen}
          onOpenChange={setFormFornecedorOpen}
          onSuccess={() => refetchFornecedores()}
        />

        <NovaImportacaoDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          fornecedores={fornecedores}
          requesterId={currentUser?.id}
          onSuccess={() => refetch()}
        />
      </div>
    </AppShell>
  )
}
