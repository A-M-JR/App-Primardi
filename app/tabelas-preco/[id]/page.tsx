"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Save, ArrowLeft, Loader2, Plus, X } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import { getTabelaPrecoById, saveItensTabelaPreco } from "@/lib/actions/tabelas-preco"
import { getProdutos } from "@/lib/actions/produtos"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { maskCurrency, parseCurrencyToNumber } from "@/lib/utils"

export default function EditTabelaPrecoPage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params.id)

  const [search, setSearch] = useState("")
  const [itens, setItens] = useState<{ produtoId: number, preco: string }[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Fetch Tabela
  const { data: tabela, isLoading: loadingTabela } = useDataQuery<any>({
    key: `tabela-preco-${id}`,
    fetcher: () => getTabelaPrecoById(id)
  })

  // Fetch Produtos
  const { data: produtos, isLoading: loadingProdutos } = useDataQuery<any[]>({
    key: 'produtos',
    fetcher: getProdutos
  })

  useEffect(() => {
    if (tabela?.itens) {
      setItens(tabela.itens.map((i: any) => ({
        produtoId: i.produtoId,
        preco: maskCurrency(i.preco.toFixed(4).replace('.', ''), 4)
      })))
    }
  }, [tabela])

  const filteredProdutos = useMemo(() => {
    if (!produtos) return []
    return produtos.filter(p => 
      !itens.some(i => i.produtoId === p.id) && // hide already added
      (p.nome.toLowerCase().includes(search.toLowerCase()) || p.codigo.includes(search))
    )
  }, [produtos, itens, search])

  const handleAddItem = (produtoId: number, precoBase: number) => {
    setItens(prev => [
      { produtoId, preco: maskCurrency(precoBase.toFixed(4).replace('.', ''), 4) },
      ...prev
    ])
    setSearch("")
  }

  const handleRemoveItem = (produtoId: number) => {
    setItens(prev => prev.filter(i => i.produtoId !== produtoId))
  }

  const handlePrecoChange = (produtoId: number, val: string) => {
    setItens(prev => prev.map(i => i.produtoId === produtoId ? { ...i, preco: maskCurrency(val, 4) as string } : i))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = itens.map(i => ({
        produtoId: i.produtoId,
        preco: parseCurrencyToNumber(i.preco)
      }))
      await saveItensTabelaPreco(id, payload)
      toast.success("Tabela salva com sucesso!")
      router.push("/tabelas-preco")
    } catch (e) {
      toast.error("Erro ao salvar itens.")
    } finally {
      setIsSaving(false)
    }
  }

  if (loadingTabela || loadingProdutos) {
    return (
      <AppShell>
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
           <Skeleton className="h-10 w-48" />
           <Skeleton className="h-[400px] w-full mt-4" />
        </div>
      </AppShell>
    )
  }

  if (!tabela) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          Tabela não encontrada.
          <Button variant="link" onClick={() => router.push("/tabelas-preco")}>Voltar</Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/tabelas-preco")}>
             <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
               Editando Tabela: <span className="text-primary">{tabela.nome}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione produtos e defina seus preços específicos para esta tabela.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
             <Card className="shadow-sm border-border/50">
               <CardHeader className="pb-4 bg-muted/10 border-b flex flex-row items-center justify-between">
                 <h3 className="font-semibold text-sm text-muted-foreground">Itens da Tabela ({itens.length})</h3>
               </CardHeader>
               <CardContent className="p-0">
                 <table className="w-full text-sm text-left">
                   <thead className="text-[10px] uppercase bg-muted/40 text-muted-foreground font-bold border-b border-border/50">
                     <tr>
                       <th className="px-4 py-3">Produto</th>
                       <th className="px-4 py-3 text-right">Preço Específico (R$)</th>
                       <th className="px-4 py-3 text-center">Remover</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/50">
                     {itens.length === 0 ? (
                       <tr>
                         <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                           Nenhum produto adicionado nesta tabela.
                         </td>
                       </tr>
                     ) : itens.map(item => {
                       const prod = produtos?.find(p => p.id === item.produtoId)
                       return (
                         <tr key={item.produtoId} className="hover:bg-muted/5">
                           <td className="px-4 py-3 font-medium text-foreground">
                             {prod ? prod.nome : `Produto #${item.produtoId}`}
                             <br/>
                             <span className="text-[10px] text-muted-foreground">Ref: {prod?.codigo}</span>
                           </td>
                           <td className="px-4 py-3 text-right">
                             <Input 
                                value={item.preco}
                                onChange={e => handlePrecoChange(item.produtoId, e.target.value)}
                                className="w-32 h-8 text-right font-mono ml-auto"
                             />
                           </td>
                           <td className="px-4 py-3 text-center">
                             <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-500" onClick={() => handleRemoveItem(item.produtoId)}>
                               <X className="size-4" />
                             </Button>
                           </td>
                         </tr>
                       )
                     })}
                   </tbody>
                 </table>
               </CardContent>
             </Card>
          </div>

          <div className="lg:col-span-1">
             <Card className="shadow-sm border-border sticky top-4">
                <CardHeader className="bg-muted/10 border-b">
                   <h3 className="font-bold text-sm">Adicionar Produtos</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                   <div className="relative">
                      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar no catálogo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-background h-9 text-xs"
                      />
                   </div>

                   <div className="border border-border rounded-md max-h-64 overflow-y-auto divide-y divide-border/50">
                      {search.trim().length > 0 ? (
                        filteredProdutos.length > 0 ? filteredProdutos.slice(0, 20).map(p => (
                          <div key={p.id} className="p-2 flex items-center justify-between hover:bg-muted/20 text-xs">
                             <div className="truncate flex-1 mr-2">
                               <p className="font-semibold truncate">{p.nome}</p>
                               <p className="text-[9px] text-muted-foreground">Base: R$ {(p.precoBase || 0).toFixed(4)}</p>
                             </div>
                             <Button size="icon" variant="outline" className="size-7 shrink-0" onClick={() => handleAddItem(p.id, p.precoBase || 0)}>
                                <Plus className="size-3 text-primary" />
                             </Button>
                          </div>
                        )) : (
                          <div className="p-4 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</div>
                        )
                      ) : (
                         <div className="p-4 text-center text-xs text-muted-foreground">Digite para buscar...</div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

      </div>

      {/* Footer Fixo */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 border-t border-border bg-background/80 backdrop-blur-md p-4 flex justify-end gap-3 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <Button variant="outline" onClick={() => router.push("/tabelas-preco")} disabled={isSaving}>
           Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="px-8 bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all">
           {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
           Salvar Tabela
        </Button>
      </div>

    </AppShell>
  )
}
