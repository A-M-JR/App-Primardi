"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { updatePedidoDetails } from "@/lib/actions/pedidos"
import { Pencil } from "lucide-react"

export function PedidoEditDialog({ pedido, onUpdated, currentUserId }: { pedido: any, onUpdated: (p: any) => void, currentUserId?: number }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const [tipoFrete, setTipoFrete] = useState(pedido.tipoFrete || "FOB")
  const [valorFrete, setValorFrete] = useState(pedido.valorFrete ? pedido.valorFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00")
  const [nomeComprador, setNomeComprador] = useState(pedido.nomeComprador || "")
  const [ocCliente, setOcCliente] = useState(pedido.ocCliente || "")

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const valorNum = parseFloat(valorFrete.replace(/\./g, '').replace(',', '.')) || 0
      
      const updated = await updatePedidoDetails(pedido.id, {
        tipoFrete,
        valorFrete: valorNum,
        nomeComprador,
        ocCliente
      }, currentUserId || 0)
      
      onUpdated(updated)
      toast.success("Pedido atualizado com sucesso!")
      setOpen(false)
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar o pedido.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Pencil className="size-3" /> Editar Info
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Informações do Pedido</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Frete</Label>
              <Select value={tipoFrete} onValueChange={setTipoFrete}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIF">CIF (Por nossa conta)</SelectItem>
                  <SelectItem value="FOB">FOB (Por conta do cliente)</SelectItem>
                  <SelectItem value="Retirada">Retirada na Fábrica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor do Frete (R$)</Label>
              <Input 
                value={valorFrete} 
                onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (!v) v = "0";
                  const n = parseInt(v, 10) / 100;
                  setValorFrete(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                disabled={tipoFrete !== "CIF"}
                className={tipoFrete !== "CIF" ? "opacity-50" : ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comprador</Label>
            <Input value={nomeComprador} onChange={e => setNomeComprador(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>OC do Cliente</Label>
            <Input value={ocCliente} onChange={e => setOcCliente(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
