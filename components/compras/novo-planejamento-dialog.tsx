"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { criarPlanejamento } from "@/lib/actions/compras/planejamento"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  requesterId?: number
  onSuccess?: () => void
}

export function NovoPlanejamentoDialog({ open, onOpenChange, requesterId, onSuccess }: Props) {
  const router = useRouter()
  const [titulo, setTitulo] = useState("")
  const [criando, setCriando] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) setTitulo("")
    onOpenChange(next)
  }

  async function handleCriar() {
    setCriando(true)
    try {
      const p = await criarPlanejamento(
        { titulo: titulo.trim() || undefined },
        requesterId
      )
      toast.success("Planejamento criado.")
      onSuccess?.()
      // Navega direto para o planejamento criado. Mantém o estado "criando"
      // (spinner) até a navegação concluir, sem voltar para a listagem.
      router.push(`/compras/planejamentos/${p.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar.")
      setCriando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo planejamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="titulo-planejamento">Nome (opcional)</Label>
          <Input
            id="titulo-planejamento"
            placeholder="Ex: Reposição Junho"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCriar()}
          />
          <p className="text-xs text-muted-foreground">
            Se deixar em branco, usamos o número automático do planejamento.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={criando}>
            Cancelar
          </Button>
          <Button onClick={() => void handleCriar()} disabled={criando} className="gap-2">
            {criando && <Loader2 className="size-4 animate-spin" />}
            {criando ? "Abrindo..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
