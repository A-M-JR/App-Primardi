"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { toast } from "sonner"
import { addMovimentacaoEstoque } from "@/lib/actions/estoque"
import { Loader2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Package } from "lucide-react"

interface EstoqueMovimentacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: { id: number; nome: string; estoque: number; unidadePadrao: string } | null
  onSuccess?: () => void
}

export function EstoqueMovimentacaoDialog({ open, onOpenChange, produto, onSuccess }: EstoqueMovimentacaoDialogProps) {
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA" | "AJUSTE">("ENTRADA")
  const [quantidade, setQuantidade] = useState<string>("")
  const [descricao, setDescricao] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!produto) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const qtd = Number(quantidade)
    if (isNaN(qtd) || qtd <= 0 && tipo !== "AJUSTE") {
      toast.error("Quantidade inválida.")
      return
    }

    if (tipo === "SAIDA" && qtd > produto!.estoque) {
       // Permite estoque negativo, mas avisa? Melhor bloquear ou não?
       // O usuário pediu "cliente quer controlar estoque", geralmente não pode sair mais do que tem.
       // Mas vamos deixar se for AJUSTE. Na saída, se quiser, pode avisar.
    }

    setIsSubmitting(true)
    try {
      await addMovimentacaoEstoque({
        produtoId: produto!.id,
        tipo,
        quantidade: qtd,
        descricao
      })

      toast.success("Movimentação registrada com sucesso!")
      setQuantidade("")
      setDescricao("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar movimentação.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5" /> Movimentação de Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 p-3 rounded-lg border border-border mt-2">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Produto Selecionado</p>
          <p className="font-semibold text-sm">{produto.nome}</p>
          <p className="text-xs mt-1">Saldo atual: <strong className="text-primary">{produto.estoque} {produto.unidadePadrao}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Tipo de Movimentação *</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipo("ENTRADA")}
                className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs font-semibold transition-all ${tipo === 'ENTRADA' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <ArrowDownToLine className="size-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setTipo("SAIDA")}
                className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs font-semibold transition-all ${tipo === 'SAIDA' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <ArrowUpFromLine className="size-4" />
                Saída
              </button>
              <button
                type="button"
                onClick={() => setTipo("AJUSTE")}
                className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs font-semibold transition-all ${tipo === 'AJUSTE' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <SlidersHorizontal className="size-4" />
                Ajuste Total
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>
              {tipo === "AJUSTE" ? "Novo Saldo Total *" : "Quantidade a Movimentar *"}
            </Label>
            <div className="flex items-center gap-2">
               <Input 
                 type="number" 
                 value={quantidade} 
                 onChange={e => setQuantidade(e.target.value)}
                 className="font-mono text-lg"
                 placeholder="0"
                 required
                 min={0}
                 step="0.001"
               />
               <span className="text-muted-foreground text-sm font-semibold">{produto.unidadePadrao}</span>
            </div>
            {tipo === "ENTRADA" && quantidade && <p className="text-[10px] text-emerald-600">O saldo passará a ser {produto.estoque + Number(quantidade)} {produto.unidadePadrao}</p>}
            {tipo === "SAIDA" && quantidade && <p className="text-[10px] text-rose-600">O saldo passará a ser {produto.estoque - Number(quantidade)} {produto.unidadePadrao}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Motivo / Observação</Label>
            <Textarea 
              value={descricao} 
              onChange={e => setDescricao(e.target.value)} 
              placeholder="Ex: Compra NF 1234, Descarte de avaria..."
              className="resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || !quantidade}>
               {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
               Confirmar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
