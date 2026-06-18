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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, Megaphone, Sparkles, X, Link2 } from "lucide-react"
import { toast } from "sonner"
import { ProdutoCombobox } from "@/components/produto-combobox"
import {
  salvarPromocao,
  getPromocao,
  sugerirProdutosPromocao,
} from "@/lib/actions/promocoes"
import { TEMPLATE_PROMO_PADRAO } from "@/lib/promocoes/whats"
import type { StatusPromocao } from "@prisma/client"

const STATUS: { v: StatusPromocao; label: string }[] = [
  { v: "RASCUNHO", label: "Rascunho" },
  { v: "ATIVA", label: "Ativa" },
  { v: "ENCERRADA", label: "Encerrada" },
]

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const isoToDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "")

interface ItemRow {
  _key: string
  id?: number
  produtoId?: number | null
  descricao: string
  precoNormal: number
  precoPromo: number
}
let seq = 0
const novoKey = () => `p${++seq}`

export function PromocaoFormDialog({
  open,
  onOpenChange,
  promocaoId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  promocaoId?: number | null
  onSaved: () => void
}) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [inicio, setInicio] = useState("")
  const [fim, setFim] = useState("")
  const [status, setStatus] = useState<StatusPromocao>("RASCUNHO")
  const [template, setTemplate] = useState(TEMPLATE_PROMO_PADRAO)
  const [itens, setItens] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sugerindo, setSugerindo] = useState(false)

  const carregar = useCallback(async () => {
    if (!promocaoId) {
      setTitulo(""); setDescricao(""); setInicio(""); setFim(""); setStatus("RASCUNHO")
      setTemplate(TEMPLATE_PROMO_PADRAO); setItens([])
      return
    }
    setLoading(true)
    try {
      const p = await getPromocao(promocaoId)
      setTitulo(p.titulo); setDescricao(p.descricao || ""); setInicio(isoToDate(p.inicio)); setFim(isoToDate(p.fim))
      setStatus(p.status); setTemplate(p.mensagemTemplate || TEMPLATE_PROMO_PADRAO)
      setItens(p.itens.map((it) => ({
        _key: novoKey(), id: it.id, produtoId: it.produtoId, descricao: it.descricao,
        precoNormal: it.precoNormal, precoPromo: it.precoPromo,
      })))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [promocaoId])

  useEffect(() => { if (open) carregar() }, [open, carregar])

  const setItem = (key: string, patch: Partial<ItemRow>) =>
    setItens((p) => p.map((it) => (it._key === key ? { ...it, ...patch } : it)))
  const delItem = (key: string) => setItens((p) => p.filter((it) => it._key !== key))
  const addManual = () =>
    setItens((p) => [...p, { _key: novoKey(), descricao: "", precoNormal: 0, precoPromo: 0 }])

  const sugerir = async () => {
    setSugerindo(true)
    try {
      const s = await sugerirProdutosPromocao(10)
      if (s.length === 0) return toast.info("Sem dados de venda/estoque para sugerir.")
      setItens(
        s.map((p) => ({
          _key: novoKey(),
          produtoId: p.produtoId,
          descricao: p.nome,
          precoNormal: p.precoBase,
          precoPromo: p.precoPromoSugerido,
        }))
      )
      toast.success(`${s.length} produtos sugeridos (mais vendidos com estoque).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sugerir.")
    } finally {
      setSugerindo(false)
    }
  }

  const salvar = async () => {
    if (!titulo.trim()) return toast.error("Informe o título.")
    if (itens.some((it) => !it.descricao.trim())) return toast.error("Há item sem descrição.")
    setSaving(true)
    try {
      await salvarPromocao({
        id: promocaoId || undefined,
        titulo, descricao, inicio: inicio || null, fim: fim || null, status,
        mensagemTemplate: template,
        itens: itens.map((it) => ({
          id: it.id, produtoId: it.produtoId, descricao: it.descricao,
          precoNormal: Number(it.precoNormal) || 0, precoPromo: Number(it.precoPromo) || 0,
        })),
      })
      toast.success("Promoção salva.")
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" /> {promocaoId ? "Editar promoção" : "Nova promoção"}
          </DialogTitle>
          <DialogDescription>Monte a campanha, sugira itens e prepare a mensagem para o WhatsApp.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Título *</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ofertas da Semana" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusPromocao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (fim)</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Observações internas (opcional)" />
              </div>
            </div>

            {/* Itens */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itens da promoção ({itens.length})</h4>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={sugerir} disabled={sugerindo}>
                    {sugerindo ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Sugerir 10 itens
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addManual}>
                    <Plus className="size-3.5" /> Item
                  </Button>
                </div>
              </div>

              {itens.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                  Use "Sugerir 10 itens" (mais vendidos com estoque) ou adicione manualmente.
                </p>
              ) : (
                <div className="space-y-2">
                  {itens.map((it, idx) => {
                    const desc = it.precoNormal > 0 ? Math.round((1 - it.precoPromo / it.precoNormal) * 100) : 0
                    return (
                      <div key={it._key} className="rounded-lg border p-2.5 bg-muted/20">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <span className="col-span-12 sm:col-span-5 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                            <Input className="h-8" placeholder="Produto / descrição *" value={it.descricao} onChange={(e) => setItem(it._key, { descricao: e.target.value })} />
                          </span>
                          <div className="col-span-4 sm:col-span-2">
                            <Input className="h-8 text-right" type="number" step="0.01" placeholder="De R$" value={it.precoNormal || ""} onChange={(e) => setItem(it._key, { precoNormal: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Input className="h-8 text-right" type="number" step="0.01" placeholder="Por R$" value={it.precoPromo || ""} onChange={(e) => setItem(it._key, { precoPromo: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-3 sm:col-span-2 flex items-center justify-end text-xs">
                            {desc > 0 ? <span className="text-emerald-600 font-medium">-{desc}%</span> : <span className="text-muted-foreground">—</span>}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button type="button" variant="ghost" size="sm" className="px-1 text-destructive h-8" onClick={() => delItem(it._key)}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </div>
                        <div className="pl-6 mt-1.5">
                          {it.produtoId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <Link2 className="size-3" /> do catálogo
                              <button className="ml-1 hover:text-rose-600" onClick={() => setItem(it._key, { produtoId: null })}><X className="size-3" /></button>
                            </span>
                          ) : (
                            <div className="w-[260px]">
                              <ProdutoCombobox
                                triggerLabel="Vincular ao catálogo"
                                onSelect={(p) => setItem(it._key, { produtoId: p.id, descricao: it.descricao || p.nome, precoNormal: it.precoNormal || p.precoBase, precoPromo: it.precoPromo || Math.round(p.precoBase * 0.9 * 100) / 100 })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[11px] text-muted-foreground text-right">
                    Preço normal = riscado na mensagem; preço promo = destaque. Ex.: {brl(19.9)}
                  </p>
                </div>
              )}
            </section>

            {/* Mensagem WhatsApp */}
            <div className="space-y-1.5">
              <Label>Modelo da mensagem (WhatsApp)</Label>
              <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className="text-sm font-mono" />
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code>{"{nome}"}</code> <code>{"{titulo}"}</code> <code>{"{validade}"}</code> <code>{"{itens}"}</code> — a lista de itens entra em <code>{"{itens}"}</code>.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
