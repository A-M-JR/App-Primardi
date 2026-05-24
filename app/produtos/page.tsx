"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Box, Package, Barcode } from "lucide-react"
import { useState, useMemo } from "react"
import { ProdutoFormDialog } from "@/components/produto-form-dialog"
import { ProdutoDetailDialog } from "@/components/produto-detail-dialog"
import { getProdutos } from "@/lib/actions/produtos"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import type { Produto } from "@/lib/types"

export default function ProdutosPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [detailProduto, setDetailProduto] = useState<Produto | null>(null)

  const [produtoToEdit, setProdutoToEdit] = useState<Produto | null>(null)

  const { data: produtosList, isLoading: loading, refetch: revalidate } = useDataQuery<Produto[]>({
    key: 'produtos',
    fetcher: getProdutos
  })

  const filtered = useMemo(() => {
    const list = produtosList || []
    return list.filter(
        (e) => {
          const matchSearch = e.nome.toLowerCase().includes(search.toLowerCase()) ||
            e.codigo.toLowerCase().includes(search.toLowerCase()) ||
            (e.ean && e.ean.toLowerCase().includes(search.toLowerCase()))
    
          return matchSearch
        }
      )
  }, [produtosList, search])

  const handleEdit = () => {
    setProdutoToEdit(detailProduto)
    setFormOpen(true)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header Area */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Catálogo de Produtos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registro e gestão do catálogo de produtos da empresa
            </p>
          </div>
          <Button onClick={() => { setProdutoToEdit(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02]">
            <Plus className="size-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* Action / Filter Bar */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4 flex flex-col items-stretch md:flex-row md:items-center justify-between gap-4">

            <div className="flex items-center gap-2 flex-1 relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do produto, código ou EAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/50 focus-visible:bg-background border-border w-full"
              />
            </div>

          </CardHeader>

          <CardContent className="bg-muted/5 border-t border-border/50 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading && (!produtosList || produtosList.length === 0) ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="border-border/50"><CardContent className="p-6 space-y-4"><Skeleton className="h-4 w-[120px]" /><Skeleton className="h-12 w-full" /><Skeleton className="h-4 w-full" /></CardContent></Card>
                ))
              ) : filtered.map((produto) => (
                <Card
                  key={produto.id}
                  className="group hover:shadow-md transition-all cursor-pointer border-border/50 hover:border-primary/30 relative overflow-hidden"
                  onClick={() => setDetailProduto(produto)}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                    <Box className="size-24" />
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                          {produto.nome}
                        </h3>
                        <p className="text-[11px] text-muted-foreground font-mono mt-1 px-1.5 py-0.5 bg-muted rounded inline-block">
                          Cód: {produto.codigo}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-background shadow-sm shrink-0 uppercase">
                        {produto.unidadePadrao || "UN"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5 bg-muted/30 p-1.5 rounded-md">
                          <Barcode className="size-3 text-primary/70" />
                          EAN: {produto.ean || "Não informado"}
                        </span>
                      </div>

                      <div className="flex items-center justify-end mt-2 pt-3 border-t border-border/50">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-muted-foreground/70 uppercase font-semibold text-right">Estoque Atual</span>
                          <div className="flex items-center gap-1">
                             <Package className="size-3 text-muted-foreground" />
                             <span className="text-sm font-bold text-right text-primary">{produto.estoque || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-background rounded-lg border border-dashed">
                  <Box className="size-8 opacity-20 mb-2" />
                  <p>Nenhum produto encontrado.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ProdutoFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setTimeout(() => setProdutoToEdit(null), 300)
        }}
        produtoToEdit={produtoToEdit}
        onSuccess={() => revalidate()}
      />
      <ProdutoDetailDialog
        produto={detailProduto}
        open={!!detailProduto}
        onOpenChange={(open) => !open && setDetailProduto(null)}
        onEdit={handleEdit}
      />
    </AppShell>
  )
}
