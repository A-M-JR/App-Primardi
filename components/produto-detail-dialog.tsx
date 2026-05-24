"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, Package, Box, Barcode, DollarSign, Calendar } from "lucide-react"
import type { Produto } from "@/lib/types"

interface ProdutoDetailDialogProps {
  produto: Produto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}

export function ProdutoDetailDialog({ produto, open, onOpenChange, onEdit }: ProdutoDetailDialogProps) {
  if (!produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 border-0 shadow-2xl overflow-hidden bg-background">
        
        {/* Banner Superior */}
        <div className="relative h-24 bg-gradient-to-r from-primary/90 to-primary p-6 flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Box className="size-24 rotate-12" />
          </div>
          <div className="z-10 flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-white mb-1">
                {produto.nome}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px]">
                  Cód: {produto.codigo}
                </Badge>
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px]">
                  EAN: {produto.ean || "N/A"}
                </Badge>
              </div>
            </div>
            {onEdit && (
              <Button onClick={() => { onOpenChange(false); setTimeout(onEdit, 150) }} size="sm" variant="ghost" className="text-white hover:bg-white/20 bg-white/10 shrink-0">
                <Edit className="size-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1 p-3 bg-muted/20 rounded-lg border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <DollarSign className="size-3 text-primary" /> Preço Base
              </span>
              <span className="text-lg font-black text-foreground">
                R$ {(produto.precoBase || 0).toFixed(4).replace('.', ',')}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-muted/20 rounded-lg border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Package className="size-3 text-primary" /> Estoque Atual
              </span>
              <span className="text-lg font-black text-foreground">
                {produto.estoque || 0}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-muted/20 rounded-lg border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Box className="size-3 text-primary" /> Unidade
              </span>
              <span className="text-lg font-black text-foreground">
                {produto.unidadePadrao || "UN"}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Barcode className="size-3" /> Descrição e Detalhes
            </h4>
            <div className="p-4 bg-muted/10 rounded-lg border border-border/50 min-h-[80px]">
              {produto.descricao ? (
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {produto.descricao}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma descrição detalhada informada.</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-4 border-t border-border/50">
             <div className="flex items-center gap-1.5">
                <Calendar className="size-3" />
                <span>Cadastrado em: {produto.criadoEm ? new Date(produto.criadoEm).toLocaleDateString() : 'N/A'}</span>
             </div>
             <div className="flex items-center gap-1.5">
                <Calendar className="size-3" />
                <span>Atualizado em: {produto.updatedAt ? new Date(produto.updatedAt).toLocaleDateString() : 'N/A'}</span>
             </div>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  )
}
