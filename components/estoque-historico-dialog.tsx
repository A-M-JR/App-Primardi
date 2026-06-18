"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { getMovimentacoesEstoque } from "@/lib/actions/estoque"
import { Loader2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Package, Clock } from "lucide-react"

interface EstoqueHistoricoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: { id: number; nome: string; estoque: number; unidadePadrao: string } | null
}

export function EstoqueHistoricoDialog({ open, onOpenChange, produto }: EstoqueHistoricoDialogProps) {
  const [loading, setLoading] = useState(true)
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])

  useEffect(() => {
    if (open && produto) {
      setLoading(true)
      getMovimentacoesEstoque(produto.id)
        .then(data => {
          setMovimentacoes(data)
          setLoading(false)
        })
        .catch(() => {
          toast.error("Erro ao carregar histórico de movimentações.")
          setLoading(false)
        })
    }
  }, [open, produto])

  if (!produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary" /> Histórico de Movimentação
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 p-3 rounded-lg border border-border mt-2 shrink-0">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Produto Selecionado</p>
          <p className="font-semibold text-sm">{produto.nome}</p>
          <p className="text-xs mt-1">Saldo atual: <strong className="text-primary">{produto.estoque} {produto.unidadePadrao}</strong></p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="size-10 mx-auto opacity-20 mb-3" />
              Nenhuma movimentação registrada para este produto.
            </div>
          ) : (
            <div className="relative border-l border-border ml-3 space-y-6 pb-4">
              {movimentacoes.map((mov, i) => (
                <div key={mov.id} className="relative pl-6">
                  <div className={`absolute -left-[13px] top-1 rounded-full p-1 border-2 border-background ${
                    mov.tipo === 'ENTRADA' ? 'bg-emerald-500' : 
                    mov.tipo === 'SAIDA' ? 'bg-rose-500' : 'bg-blue-500'
                  }`}>
                    {mov.tipo === 'ENTRADA' && <ArrowDownToLine className="size-3 text-white" />}
                    {mov.tipo === 'SAIDA' && <ArrowUpFromLine className="size-3 text-white" />}
                    {mov.tipo === 'AJUSTE' && <SlidersHorizontal className="size-3 text-white" />}
                  </div>
                  
                  <div className="bg-card rounded-md border border-border/50 p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          mov.tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                          mov.tipo === 'SAIDA' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                        }`}>
                          {mov.tipo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(mov.criadoEm).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold ${
                          mov.tipo === 'ENTRADA' ? 'text-emerald-600' :
                          mov.tipo === 'SAIDA' ? 'text-rose-600' :
                          'text-blue-600'
                        }`}>
                          {mov.tipo === 'ENTRADA' ? '+' : mov.tipo === 'SAIDA' ? '-' : ''}{mov.quantidade}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">{produto.unidadePadrao}</span>
                      </div>
                    </div>
                    
                    {mov.descricao && (
                      <p className="text-sm text-foreground mt-2">{mov.descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-border/50 shrink-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
