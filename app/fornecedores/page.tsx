"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Search, Plus, Truck, Settings } from "lucide-react"
import { useState, useMemo } from "react"
import { FornecedorFormDialog } from "@/components/fornecedor-form-dialog"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import type { Fornecedor } from "@/lib/types"

export default function FornecedoresPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [fornecedorToEdit, setFornecedorToEdit] = useState<Fornecedor | null>(null)

  const { data: fornecedoresList, isLoading: loading, refetch: revalidate } = useDataQuery<Fornecedor[]>({
    key: 'fornecedores',
    fetcher: getFornecedores
  })

  const filtered = useMemo(() => {
    return (fornecedoresList || []).filter(f => 
      f.razaoSocial.toLowerCase().includes(search.toLowerCase()) || 
      (f.cnpj && f.cnpj.includes(search))
    )
  }, [fornecedoresList, search])

  const handleEdit = (fornecedor: Fornecedor) => {
    setFornecedorToEdit(fornecedor)
    setFormOpen(true)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Fornecedores
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os fornecedores de insumos e matérias-primas
            </p>
          </div>
          <Button onClick={() => { setFornecedorToEdit(null); setFormOpen(true); }}>
            <Plus className="size-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 relative max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/50 focus-visible:bg-background border-border w-full"
              />
            </div>
          </CardHeader>
          <CardContent className="bg-muted/5 border-t border-border/50 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {loading && (!fornecedoresList || fornecedoresList.length === 0) ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-border/50"><CardContent className="p-6 space-y-4"><Skeleton className="h-4 w-[120px]" /><Skeleton className="h-4 w-full" /></CardContent></Card>
                ))
              ) : filtered.map((forn) => (
                <Card
                  key={forn.id}
                  className="group hover:shadow-md transition-all border-border/50 hover:border-primary/30"
                >
                  <CardContent className="p-5">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => handleEdit(forn)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                          <Truck className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {forn.razaoSocial}
                          </h3>
                          {forn.cnpj && (
                            <p className="text-xs text-muted-foreground mt-1">
                              CNPJ: {forn.cnpj}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
                      <Link href={`/fornecedores/${forn.id}/import-config`}>
                        <Settings className="size-4 mr-2" />
                        Config. Importação
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-background rounded-lg border border-dashed">
                  <Truck className="size-8 mx-auto opacity-20 mb-2" />
                  <p>Nenhum fornecedor encontrado.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <FornecedorFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setTimeout(() => setFornecedorToEdit(null), 300)
        }}
        fornecedorToEdit={fornecedorToEdit}
        onSuccess={revalidate}
      />
    </AppShell>
  )
}
