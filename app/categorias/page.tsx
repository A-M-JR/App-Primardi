"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Tags } from "lucide-react"
import { useState, useMemo } from "react"
import { CategoriaFormDialog } from "@/components/categoria-form-dialog"
import { getCategorias } from "@/lib/actions/categorias"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import type { Categoria } from "@/lib/types"

export default function CategoriasPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [categoriaToEdit, setCategoriaToEdit] = useState<Categoria | null>(null)

  const { data: categoriasList, isLoading: loading, refetch: revalidate } = useDataQuery<Categoria[]>({
    key: 'categorias',
    fetcher: getCategorias
  })

  const filtered = useMemo(() => {
    return (categoriasList || []).filter(c => c.nome.toLowerCase().includes(search.toLowerCase()))
  }, [categoriasList, search])

  const handleEdit = (cat: Categoria) => {
    setCategoriaToEdit(cat)
    setFormOpen(true)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Categorias de Produtos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie a classificação do catálogo de produtos
            </p>
          </div>
          <Button onClick={() => { setCategoriaToEdit(null); setFormOpen(true); }}>
            <Plus className="size-4 mr-2" />
            Nova Categoria
          </Button>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 relative max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/50 focus-visible:bg-background border-border w-full"
              />
            </div>
          </CardHeader>
          <CardContent className="bg-muted/5 border-t border-border/50 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {loading && (!categoriasList || categoriasList.length === 0) ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-border/50"><CardContent className="p-6 space-y-4"><Skeleton className="h-4 w-[120px]" /><Skeleton className="h-4 w-full" /></CardContent></Card>
                ))
              ) : filtered.map((cat) => (
                <Card
                  key={cat.id}
                  className="group hover:shadow-md transition-all cursor-pointer border-border/50 hover:border-primary/30"
                  onClick={() => handleEdit(cat)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                          <Tags className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {cat.nome}
                          </h3>
                        </div>
                      </div>
                      <Badge variant={cat.ativo ? "default" : "secondary"}>
                        {cat.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-background rounded-lg border border-dashed">
                  <Tags className="size-8 mx-auto opacity-20 mb-2" />
                  <p>Nenhuma categoria encontrada.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <CategoriaFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setTimeout(() => setCategoriaToEdit(null), 300)
        }}
        categoriaToEdit={categoriaToEdit}
        onSuccess={revalidate}
      />
    </AppShell>
  )
}
