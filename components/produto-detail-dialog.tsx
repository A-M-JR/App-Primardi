"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { LabelPreview } from "./produto-preview"
import { Box, Ruler, Palette, DollarSign, Info, Layers, Settings, FileText, CheckCircle2 } from "lucide-react"
import type { Produto } from "@/lib/types"

interface ProdutoDetailDialogProps {
  produto: Produto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}

export function ProdutoDetailDialog({
  produto,
  open,
  onOpenChange,
  onEdit
}: ProdutoDetailDialogProps) {
  if (!produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl p-0 border-0 shadow-2xl overflow-hidden bg-background">
        
        {/* Modern Gradient Header */}
        <div className="relative h-24 bg-gradient-to-r from-primary/95 to-primary p-6 pr-14 flex items-center justify-between overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Box className="size-32 rotate-12 text-white" />
          </div>
          <div className="z-10 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
               <DialogTitle className="text-xl font-bold text-white tracking-tight">
                  Matriz: {produto.codigo}
               </DialogTitle>
               {produto.pasta && (
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    Pasta {produto.pasta}
                  </Badge>
               )}
            </div>
            <p className="text-xs text-white/70 font-medium">Especificações Técnicas e Comerciais</p>
          </div>
          
          {onEdit && (
            <button
              onClick={() => {
                onOpenChange(false)
                onEdit()
              }}
              className="z-10 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-md transition-all border border-white/10 flex items-center gap-2"
            >
              <Settings className="size-3" />
              Editar Matriz
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
          
          {/* Side Bar - Preview & Basic Info */}
          <aside className="w-full md:w-64 bg-muted/20 border-r border-border/50 p-6 flex flex-col items-center">
            <div className="w-full">
               <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-6">Prévia em Escala</h4>
               <div className="min-h-[220px] flex flex-col items-center justify-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-border/50 shadow-inner group">
                  <LabelPreview 
                    largura={produto.largura} 
                    altura={produto.altura} 
                    material={produto.material} 
                    cores={produto.numeroCores}
                    aplicacoes={produto.aplicacoesEspeciais || []}
                  />
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-background shadow-xs">
                      {produto.material}
                    </Badge>
                    {produto.clientesIds && produto.clientesIds.length > 0 && (
                      <Badge className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/5 dark:text-amber-400 flex items-center gap-1">
                        <CheckCircle2 className="size-2.5" />
                        Matriz Exclusiva
                      </Badge>
                    )}
                  </div>
               </div>
            </div>

            <div className="w-full mt-auto pt-6 space-y-3">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-[10px] text-primary/70 uppercase font-bold mb-1 tracking-tight">Valor Unitário</p>
                    <div className="flex items-baseline gap-1 text-primary">
                        <span className="text-[10px] font-medium">R$</span>
                        <span className="text-xl font-black">{Number(produto.preco || 0).toFixed(4)}</span>
                        <span className="text-[10px] ml-1 opacity-70">/ un</span>
                    </div>
                </div>
            </div>
          </aside>

          {/* Main Info Panels */}
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-right-2">
              
              {/* Info Section: Ficha Técnica */}
              <section className="space-y-6">
                 <div className="flex items-center gap-2 text-primary">
                    <Ruler className="size-4" />
                    <h3 className="text-sm font-bold uppercase tracking-tight">Ficha Técnica e Dimensões</h3>
                 </div>
                 
                 <div className="pl-6 border-l-2 border-primary/10 space-y-6">
                    <div className="space-y-1.5">
                       <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Nome da Matriz / Produto</p>
                       <p className="text-lg font-bold text-foreground leading-tight">{produto.nome}</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="space-y-1">
                           <p className="text-[10px] text-muted-foreground font-semibold uppercase">Medidas</p>
                           <p className="text-sm font-semibold text-primary">{produto.largura} x {produto.altura} mm</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] text-muted-foreground font-semibold uppercase">Tipo Adesivo</p>
                           <p className="text-sm font-medium">{produto.tipoAdesivo}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] text-muted-foreground font-semibold uppercase">Material</p>
                           <p className="text-sm font-medium">{produto.material}</p>
                        </div>
                    </div>
                 </div>
              </section>

              {/* Info Section: Produção */}
              <section className="space-y-4">
                 <div className="flex items-center gap-2 text-primary">
                    <Settings className="size-4" />
                    <h3 className="text-sm font-bold uppercase tracking-tight">Produção e Acabamento</h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 pl-6 border-l-2 border-primary/10">
                    <div className="space-y-1">
                       <p className="text-[10px] text-muted-foreground font-semibold uppercase">Número de Cores</p>
                       <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{produto.numeroCores}</p>
                          {produto.coresDescricao && <span className="text-[10px] text-muted-foreground italic truncate max-w-[100px]">({produto.coresDescricao})</span>}
                       </div>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-muted-foreground font-semibold uppercase">Tubete</p>
                       <p className="text-sm font-medium">{produto.tipoTubete}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-muted-foreground font-semibold uppercase">Volume / Rolo</p>
                       <p className="text-sm font-medium">{produto.quantidadePorRolo.toLocaleString("pt-BR")} un</p>
                    </div>
                    {produto.metragem && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase">Metragem Rolo</p>
                        <p className="text-sm font-medium">{produto.metragem} m</p>
                      </div>
                    )}
                 </div>

                 {/* Tags de aplicações especiais */}
                 {(produto.aplicacoesEspeciais && produto.aplicacoesEspeciais.length > 0) && (
                    <div className="pl-6 flex flex-wrap gap-2 pt-2">
                       {produto.aplicacoesEspeciais.map(app => (
                          <Badge key={app} variant="secondary" className="text-[9px] bg-muted py-0 h-5">
                             {app}
                          </Badge>
                       ))}
                    </div>
                 )}
              </section>

              {/* Info Section: Clientes Vinculados / Preços Específicos */}
              {produto.clientesVinculados && produto.clientesVinculados.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                      <DollarSign className="size-4" />
                      <h3 className="text-sm font-bold uppercase tracking-tight">Tabela de Preços por Cliente</h3>
                  </div>
                  <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {produto.clientesVinculados.map(cv => (
                          <div key={cv.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                              <span className="text-[11px] font-semibold text-muted-foreground truncate flex-1 mr-2">{cv.razaoSocial}</span>
                              <span className="text-xs font-bold text-foreground bg-background px-2 py-1 rounded shadow-sm border border-border/20 whitespace-nowrap">
                                  R$ {cv.preco !== null && cv.preco !== undefined ? Number(cv.preco).toFixed(4) : Number(produto.preco || 0).toFixed(4)}
                              </span>
                          </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Info Section: Observações */}
              {(produto.observacoesTecnicas) && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                      <FileText className="size-4" />
                      <h3 className="text-sm font-bold uppercase tracking-tight">Observações de Produção</h3>
                  </div>
                  <div className="pl-6">
                    <div className="p-4 bg-muted/40 rounded-xl border border-border/50 text-xs leading-relaxed text-muted-foreground">
                       {produto.observacoesTecnicas}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
