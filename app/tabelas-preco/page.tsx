"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Plus, Table2, Settings2, Loader2 } from "lucide-react"
import { useState, useMemo } from "react"
import { getTabelasPreco, saveTabelaPreco } from "@/lib/actions/tabelas-preco"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function TabelasPrecoPage() {
  const [search, setSearch] = useState("")
  const [novoNome, setNovoNome] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const { data: tabelasList, isLoading: loading, refetch: revalidate } = useDataQuery<any[]>({
    key: 'tabelas-preco',
    fetcher: () => getTabelasPreco()
  })

  const filtered = useMemo(() => {
    if (!tabelasList) return []
    return tabelasList.filter(e => e.nome.toLowerCase().includes(search.toLowerCase()))
  }, [tabelasList, search])

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    setIsSubmitting(true)
    try {
      const created = await saveTabelaPreco({ nome: novoNome, ativo: true })
      toast.success("Tabela criada com sucesso!")
      setNovoNome("")
      setDialogOpen(false)
      revalidate()
      router.push(`/tabelas-preco/${created.id}`)
    } catch (e: any) {
      toast.error("Erro ao criar tabela.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleAtivo = async (id: number, nome: string, currentAtivo: boolean) => {
    try {
      await saveTabelaPreco({ id, nome, ativo: !currentAtivo })
      toast.success("Status alterado!")
      revalidate()
    } catch (e) {
      toast.error("Erro ao alterar status.")
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
               <Table2 className="size-8 text-primary" /> Tabelas de Preço
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie tabelas com preços diferenciados para associar aos seus clientes.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-sm transition-all hover:scale-[1.02]">
             <Plus className="size-4 mr-2" />
             Nova Tabela
          </Button>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4 bg-muted/10 border-b">
            <div className="flex items-center gap-2 max-w-md relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da tabela..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background w-full focus-visible:ring-primary"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/40 text-muted-foreground font-bold border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Nome da Tabela</th>
                  <th className="px-6 py-4 text-center">Itens / Clientes</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      <Table2 className="size-8 mx-auto opacity-20 mb-3" />
                      Nenhuma tabela encontrada.
                    </td>
                  </tr>
                ) : filtered.map(tabela => (
                  <tr key={tabela.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {tabela.nome}
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {tabela._count.itens} Itens <br/>
                      <span className="text-[10px]">{tabela._count.clientes} Clientes associados</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tabela.ativo ? (
                         <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ativa</Badge>
                      ) : (
                         <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Inativa</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => handleToggleAtivo(tabela.id, tabela.nome, tabela.ativo)}
                      >
                         {tabela.ativo ? 'Inativar' : 'Ativar'}
                      </Button>
                      <Button 
                         size="sm" 
                         onClick={() => router.push(`/tabelas-preco/${tabela.id}`)}
                      >
                         <Settings2 className="size-4 mr-2" /> Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="size-5 text-primary" /> Nova Tabela de Preço
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCriar} className="space-y-4 mt-4">
             <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Tabela *</label>
                <Input 
                   value={novoNome} 
                   onChange={e => setNovoNome(e.target.value)} 
                   placeholder="Ex: Atacado SP, Varejo 2026..." 
                   autoFocus
                />
             </div>
             <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
               <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
               <Button type="submit" disabled={isSubmitting || !novoNome.trim()}>
                 {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                 Criar Tabela
               </Button>
             </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
