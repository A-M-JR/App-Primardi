"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Headphones } from "lucide-react"
import { toast } from "sonner"
import { abrirChamado } from "@/lib/actions/chamados"
import { getDepartamentosAtivos } from "@/lib/actions/departamentos"
import { PRIORIDADES, PRIORIDADE_META, DESTINOS, DESTINO_META } from "@/lib/chamados/constants"
import type { ChamadoPrioridade, ChamadoDestino } from "@prisma/client"

export function ChamadoFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (novoId?: number) => void
}) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [departamentoId, setDepartamentoId] = useState<string>("none")
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>("MEDIA")
  const [destino, setDestino] = useState<ChamadoDestino>("INTERNO")
  const [categoria, setCategoria] = useState("")
  const [departamentos, setDepartamentos] = useState<{ id: number; nome: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(""); setDescricao(""); setDepartamentoId("none"); setPrioridade("MEDIA"); setDestino("INTERNO"); setCategoria("")
    getDepartamentosAtivos().then(setDepartamentos).catch(() => {})
  }, [open])

  const salvar = async () => {
    if (!titulo.trim()) return toast.error("Informe o título.")
    if (!descricao.trim()) return toast.error("Descreva o chamado.")
    setSaving(true)
    try {
      const r = await abrirChamado({
        titulo,
        descricao,
        departamentoId: departamentoId === "none" ? null : Number(departamentoId),
        prioridade,
        destino,
        categoria: categoria || null,
      })
      toast.success(`Chamado ${r.numero} aberto.`)
      onOpenChange(false)
      onSaved(r.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir chamado.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="size-5 text-primary" /> Abrir chamado
          </DialogTitle>
          <DialogDescription>Descreva o problema/solicitação e direcione ao departamento responsável.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo do chamado" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Detalhe o que precisa..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select value={departamentoId} onValueChange={setDepartamentoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem departamento —</SelectItem>
                  {departamentos.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as ChamadoPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{PRIORIDADE_META[p].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destino</Label>
              <Select value={destino} onValueChange={(v) => setDestino(v as ChamadoDestino)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DESTINOS.map((d) => <SelectItem key={d} value={d}>{DESTINO_META[d].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria (opcional)</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Sistema, Financeiro..." />
            </div>
          </div>
          {destino === "DESENVOLVEDOR" && (
            <p className="text-[11px] text-amber-600 bg-amber-500/5 rounded-md p-2">
              O envio automático aos desenvolvedores será habilitado quando o endpoint for configurado. Por ora, o chamado fica registrado e pode ser despachado na tela de detalhe.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />} Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
