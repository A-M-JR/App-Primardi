"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Package, ArrowDownToLine, ArrowUpFromLine, Activity, Clock } from "lucide-react"
import { useState, useMemo } from "react"
import { getEstoqueProdutos } from "@/lib/actions/estoque"
import { useDataQuery } from "@/hooks/use-data-query"
import { Skeleton } from "@/components/ui/skeleton"
import { EstoqueMovimentacaoDialog } from "@/components/estoque-movimentacao-dialog"
import { EstoqueHistoricoDialog } from "@/components/estoque-historico-dialog"

export default function EstoquePage() {
  const [search, setSearch] = useState("")
  const [movimentacaoOpen, setMovimentacaoOpen] = useState(false)
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<any | null>(null)

  const { data: produtosList, isLoading: loading, refetch: revalidate } = useDataQuery<any[]>({
    key: 'estoque-produtos',
    fetcher: getEstoqueProdutos
  })

  const filtered = useMemo(() => {
    if (!produtosList) return []
    return produtosList.filter(e => 
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (e.ean && e.ean.includes(search))
    )
  }, [produtosList, search])

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
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        <Package className="size-8 mx-auto opacity-20 mb-3" />
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : filtered.map(produto => (
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
                      </td>
                      <td className="px-6 py-4 text-center">
                        {produto.estoque <= 0 ? (
                           <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">Sem Estoque</Badge>
                        ) : produto.estoque < 10 ? (
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
    </AppShell>
  )
}
