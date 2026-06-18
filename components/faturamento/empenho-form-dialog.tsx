"use client"

import { useState, useEffect, useCallback } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Receipt } from "lucide-react"
import { toast } from "sonner"
import {
  getContratoParaFaturar,
  getEmpenho,
  salvarEmpenho,
} from "@/lib/actions/faturamento"
import { STATUS_EMPENHO, STATUS_EMPENHO_META, brl, num } from "@/lib/licitacoes/constants"
import type { StatusEmpenho } from "@prisma/client"

interface LinhaItem {
  licitacaoItemId: number
  descricao: string
  unidade: string
  numeroItem: string | null
  saldoQtd: number
  saldoBase: number // saldo + qtd já neste empenho (ao editar)
  precoUnitario: number
  quantidade: number
}

const isoToDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "")

export function EmpenhoFormDialog({
  open,
  onOpenChange,
  licitacaoId,
  empenhoId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  licitacaoId: number | null
  empenhoId?: number | null
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contrato, setContrato] = useState<{ objeto: string; orgaoNome: string; numeroContrato: string | null; numeroAta: string | null } | null>(null)
  const [linhas, setLinhas] = useState<LinhaItem[]>([])

  const [numero, setNumero] = useState("")
  const [numeroNotaFiscal, setNumeroNotaFiscal] = useState("")
  const [status, setStatus] = useState<StatusEmpenho>("PENDENTE")
  const [dataEmpenho, setDataEmpenho] = useState("")
  const [prazoEntrega, setPrazoEntrega] = useState("")
  const [dataEntrega, setDataEntrega] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const carregar = useCallback(async () => {
    if (!licitacaoId) return
    setLoading(true)
    try {
      const c = await getContratoParaFaturar(licitacaoId)
      const editando = empenhoId ? await getEmpenho(empenhoId) : null
      const jaNoEmpenho = new Map<number, { qtd: number; preco: number }>()
      if (editando) {
        for (const i of editando.itens) jaNoEmpenho.set(i.licitacaoItemId, { qtd: i.quantidade, preco: i.precoUnitario })
        setNumero(editando.numero)
        setNumeroNotaFiscal(editando.numeroNotaFiscal || "")
        setStatus(editando.status)
        setDataEmpenho(isoToDate(editando.dataEmpenho))
        setPrazoEntrega(isoToDate(editando.prazoEntrega))
        setDataEntrega(isoToDate(editando.dataEntrega))
        setObservacoes(editando.observacoes || "")
      } else {
        setNumero("")
        setNumeroNotaFiscal("")
        setStatus("PENDENTE")
        setDataEmpenho("")
        setPrazoEntrega("")
        setDataEntrega("")
        setObservacoes("")
      }
      setContrato({ objeto: c.objeto, orgaoNome: c.orgaoNome, numeroContrato: c.numeroContrato, numeroAta: c.numeroAta })
      setLinhas(
        c.itens.map((it) => {
          const ja = jaNoEmpenho.get(it.id)
          const saldoBase = it.saldoQtd + (ja?.qtd || 0)
          return {
            licitacaoItemId: it.id,
            descricao: it.descricao,
            unidade: it.unidade,
            numeroItem: it.numeroItem,
            saldoQtd: it.saldoQtd,
            saldoBase,
            precoUnitario: ja?.preco ?? it.precoUnitario,
            quantidade: ja?.qtd ?? 0,
          }
        })
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar contrato.")
    } finally {
      setLoading(false)
    }
  }, [licitacaoId, empenhoId])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  const setLinha = (id: number, patch: Partial<LinhaItem>) =>
    setLinhas((p) => p.map((l) => (l.licitacaoItemId === id ? { ...l, ...patch } : l)))

  const total = linhas.reduce((s, l) => s + (l.quantidade || 0) * (l.precoUnitario || 0), 0)
  const algumExcede = linhas.some((l) => status !== "CANCELADO" && (l.quantidade || 0) > l.saldoBase + 0.0001)

  const salvar = async () => {
    const itens = linhas.filter((l) => (l.quantidade || 0) > 0).map((l) => ({
      licitacaoItemId: l.licitacaoItemId,
      quantidade: Number(l.quantidade) || 0,
      precoUnitario: Number(l.precoUnitario) || 0,
    }))
    if (itens.length === 0) return toast.error("Informe a quantidade de ao menos um item.")
    if (algumExcede) return toast.error("Há item acima do saldo disponível.")
    setSaving(true)
    try {
      await salvarEmpenho({
        id: empenhoId || undefined,
        licitacaoId: licitacaoId!,
        numero: numero || null,
        numeroNotaFiscal: numeroNotaFiscal || null,
        status,
        dataEmpenho: dataEmpenho || null,
        prazoEntrega: prazoEntrega || null,
        dataEntrega: dataEntrega || null,
        observacoes: observacoes || null,
        itens,
      })
      toast.success("Empenho salvo.")
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar empenho.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" /> {empenhoId ? "Editar empenho" : "Novo empenho / faturamento"}
          </DialogTitle>
          <DialogDescription>
            {contrato ? (
              <span>
                {contrato.orgaoNome}
                {contrato.numeroContrato ? ` · Contrato ${contrato.numeroContrato}` : contrato.numeroAta ? ` · Ata ${contrato.numeroAta}` : ""}
              </span>
            ) : (
              "Registre o empenho — as quantidades dão baixa no saldo do contrato."
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Nº do empenho</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="(auto se vazio)" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº da NF</Label>
                <Input value={numeroNotaFiscal} onChange={(e) => setNumeroNotaFiscal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusEmpenho)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_EMPENHO.map((s) => <SelectItem key={s} value={s}>{STATUS_EMPENHO_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data do empenho</Label>
                <Input type="date" value={dataEmpenho} onChange={(e) => setDataEmpenho(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo de entrega</Label>
                <Input type="date" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de entrega</Label>
                <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
              </div>
            </div>

            {/* Itens */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2 w-24">Saldo</th>
                    <th className="text-right p-2 w-28">Qtd a faturar</th>
                    <th className="text-right p-2 w-28">Preço</th>
                    <th className="text-right p-2 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-6 text-xs">Contrato sem itens cadastrados.</td></tr>
                  ) : (
                    linhas.map((l) => {
                      const excede = status !== "CANCELADO" && (l.quantidade || 0) > l.saldoBase + 0.0001
                      return (
                        <tr key={l.licitacaoItemId} className="border-t">
                          <td className="p-2">
                            <p className="font-medium leading-tight">{l.descricao}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {l.numeroItem ? `Item ${l.numeroItem} · ` : ""}{l.unidade}
                            </p>
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            <span className={l.saldoBase <= 0 ? "text-muted-foreground" : "text-emerald-600 font-medium"}>{num(l.saldoBase)}</span>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              className={`h-8 text-right ${excede ? "border-rose-400 focus-visible:ring-rose-400" : ""}`}
                              value={l.quantidade || ""}
                              onChange={(e) => setLinha(l.licitacaoItemId, { quantidade: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.0001"
                              className="h-8 text-right"
                              value={l.precoUnitario || ""}
                              onChange={(e) => setLinha(l.licitacaoItemId, { precoUnitario: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {brl((l.quantidade || 0) * (l.precoUnitario || 0))}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {algumExcede && (
              <p className="text-xs text-rose-600">Há itens acima do saldo disponível — ajuste as quantidades.</p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <Label className="text-xs">Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={1} className="mt-1" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total do empenho</p>
                <p className="text-xl font-bold">{brl(total)}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || loading || algumExcede} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar empenho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
