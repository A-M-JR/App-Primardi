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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Loader2, Plus, Trash2, Link2, X, Gavel, Search } from "lucide-react"
import { toast } from "sonner"
import { ProdutoCombobox } from "@/components/produto-combobox"
import { MODALIDADE_LABEL, MODALIDADES, STATUS_LICITACAO, STATUS_LICITACAO_META, brl } from "@/lib/licitacoes/constants"
import { UFS } from "@/lib/licitacoes/pncp"
import {
  salvarLicitacao,
  getLicitacao,
  getClientesParaVinculo,
  type LicitacaoItemInput,
} from "@/lib/actions/licitacoes"
import { consultarCnpj } from "@/lib/actions/consultas"
import { maskCnpj } from "@/lib/utils"
import type { ModalidadeLicitacao, StatusLicitacao } from "@prisma/client"

interface ClienteOpt {
  id: number
  razaoSocial: string
  nomeFantasia: string | null
  cidade: string
  estado: string
}

interface FormState {
  numeroProcesso: string
  numeroEdital: string
  numeroAta: string
  numeroContrato: string
  modalidade: ModalidadeLicitacao
  objeto: string
  orgaoNome: string
  orgaoCnpj: string
  orgaoUf: string
  orgaoCidade: string
  clienteId: number | null
  clienteNome: string
  portal: string
  linkEdital: string
  dataPublicacao: string
  dataAbertura: string
  vigenciaInicio: string
  vigenciaFim: string
  valorEstimado: string
  valorHomologado: string
  status: StatusLicitacao
  observacoes: string
}

const vazio: FormState = {
  numeroProcesso: "", numeroEdital: "", numeroAta: "", numeroContrato: "",
  modalidade: "PREGAO_ELETRONICO", objeto: "", orgaoNome: "", orgaoCnpj: "",
  orgaoUf: "", orgaoCidade: "", clienteId: null, clienteNome: "", portal: "",
  linkEdital: "", dataPublicacao: "", dataAbertura: "", vigenciaInicio: "",
  vigenciaFim: "", valorEstimado: "", valorHomologado: "", status: "ACOMPANHANDO",
  observacoes: "",
}

interface ItemRow extends LicitacaoItemInput {
  _key: string
}

/** Valores iniciais para uma NOVA licitação (consulta de CNPJ, Atas, Contratos...). */
export interface LicitacaoPrefill {
  objeto?: string
  modalidade?: ModalidadeLicitacao
  status?: StatusLicitacao
  numeroProcesso?: string
  numeroEdital?: string
  numeroAta?: string
  numeroContrato?: string
  portal?: string
  linkEdital?: string
  orgaoNome?: string
  orgaoCnpj?: string
  orgaoUf?: string
  orgaoCidade?: string
  dataAbertura?: string
  vigenciaInicio?: string
  vigenciaFim?: string
  valorEstimado?: string
  valorHomologado?: string
}

function isoToLocalInput(iso: string | null, withTime = false): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date
}

let keySeq = 0
const novoKey = () => `k${++keySeq}`

export function LicitacaoFormDialog({
  open,
  onOpenChange,
  licitacaoId,
  onSaved,
  prefill,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  licitacaoId?: number | null
  onSaved: () => void
  prefill?: LicitacaoPrefill
}) {
  const [form, setForm] = useState<FormState>(vazio)
  const [itens, setItens] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const buscarCnpj = async () => {
    const c = form.orgaoCnpj.replace(/\D/g, "")
    if (c.length !== 14) return toast.error("Informe um CNPJ com 14 dígitos.")
    setBuscandoCnpj(true)
    try {
      const info = await consultarCnpj(c)
      setForm((f) => ({
        ...f,
        orgaoNome: info.razaoSocial || f.orgaoNome,
        orgaoUf: info.uf || f.orgaoUf,
        orgaoCidade: info.municipio || f.orgaoCidade,
      }))
      toast.success("Dados do órgão preenchidos pela Receita.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar CNPJ.")
    } finally {
      setBuscandoCnpj(false)
    }
  }

  const carregar = useCallback(async () => {
    if (!licitacaoId) {
      setForm({ ...vazio, ...(prefill ?? {}) })
      setItens([])
      return
    }
    setLoading(true)
    try {
      const l = await getLicitacao(licitacaoId)
      setForm({
        numeroProcesso: l.numeroProcesso || "",
        numeroEdital: l.numeroEdital || "",
        numeroAta: l.numeroAta || "",
        numeroContrato: l.numeroContrato || "",
        modalidade: l.modalidade,
        objeto: l.objeto,
        orgaoNome: l.orgaoNome,
        orgaoCnpj: l.orgaoCnpj || "",
        orgaoUf: l.orgaoUf || "",
        orgaoCidade: l.orgaoCidade || "",
        clienteId: l.clienteId,
        clienteNome: l.cliente?.razaoSocial || "",
        portal: l.portal || "",
        linkEdital: l.linkEdital || "",
        dataPublicacao: isoToLocalInput(l.dataPublicacao),
        dataAbertura: isoToLocalInput(l.dataAbertura, true),
        vigenciaInicio: isoToLocalInput(l.vigenciaInicio),
        vigenciaFim: isoToLocalInput(l.vigenciaFim),
        valorEstimado: l.valorEstimado ? String(l.valorEstimado) : "",
        valorHomologado: l.valorHomologado ? String(l.valorHomologado) : "",
        status: l.status,
        observacoes: l.observacoes || "",
      })
      setItens(
        l.itens.map((it) => ({
          _key: novoKey(),
          id: it.id,
          produtoId: it.produtoId,
          numeroItem: it.numeroItem,
          descricao: it.descricao,
          marca: it.marca,
          unidade: it.unidade,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitario,
          precoReferencia: it.precoReferencia,
          observacao: it.observacao,
        }))
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [licitacaoId, prefill])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  const addItem = () =>
    setItens((p) => [
      ...p,
      { _key: novoKey(), descricao: "", unidade: "UN", quantidade: 0, precoUnitario: 0, precoReferencia: 0 },
    ])

  const setItem = (key: string, patch: Partial<ItemRow>) =>
    setItens((p) => p.map((it) => (it._key === key ? { ...it, ...patch } : it)))

  const delItem = (key: string) => setItens((p) => p.filter((it) => it._key !== key))

  const totalItens = itens.reduce((s, it) => s + (it.quantidade || 0) * (it.precoUnitario || 0), 0)

  const salvar = async () => {
    if (!form.objeto.trim()) return toast.error("Informe o objeto.")
    if (!form.orgaoNome.trim()) return toast.error("Informe o órgão/cliente.")
    if (itens.some((it) => !it.descricao.trim())) return toast.error("Há item sem descrição.")
    setSaving(true)
    try {
      await salvarLicitacao({
        id: licitacaoId || undefined,
        numeroProcesso: form.numeroProcesso,
        numeroEdital: form.numeroEdital,
        numeroAta: form.numeroAta,
        numeroContrato: form.numeroContrato,
        modalidade: form.modalidade,
        objeto: form.objeto,
        orgaoNome: form.orgaoNome,
        orgaoCnpj: form.orgaoCnpj,
        orgaoUf: form.orgaoUf,
        orgaoCidade: form.orgaoCidade,
        clienteId: form.clienteId,
        portal: form.portal,
        linkEdital: form.linkEdital,
        dataPublicacao: form.dataPublicacao || null,
        dataAbertura: form.dataAbertura || null,
        vigenciaInicio: form.vigenciaInicio || null,
        vigenciaFim: form.vigenciaFim || null,
        valorEstimado: parseFloat(form.valorEstimado) || 0,
        valorHomologado: parseFloat(form.valorHomologado) || 0,
        status: form.status,
        observacoes: form.observacoes,
        itens: itens.map((it) => ({
          id: it.id,
          produtoId: it.produtoId,
          numeroItem: it.numeroItem,
          descricao: it.descricao,
          marca: it.marca,
          unidade: it.unidade,
          quantidade: Number(it.quantidade) || 0,
          precoUnitario: Number(it.precoUnitario) || 0,
          precoReferencia: Number(it.precoReferencia) || 0,
          observacao: it.observacao,
        })),
      })
      toast.success("Licitação salva.")
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
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="size-5 text-primary" />
            {licitacaoId ? "Editar licitação / contrato" : "Nova licitação / contrato"}
          </DialogTitle>
          <DialogDescription>
            Acompanhamento do pregão e dados do contrato/ata. Os itens definem o saldo para o faturamento.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identificação */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificação</h4>
              <div className="space-y-1.5">
                <Label>Objeto *</Label>
                <Textarea
                  value={form.objeto}
                  onChange={(e) => set("objeto", e.target.value)}
                  rows={2}
                  placeholder="Ex.: Registro de preços para aquisição de medicamentos..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Modalidade</Label>
                  <Select value={form.modalidade} onValueChange={(v) => set("modalidade", v as ModalidadeLicitacao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map((m) => (
                        <SelectItem key={m} value={m}>{MODALIDADE_LABEL[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v as StatusLicitacao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_LICITACAO.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LICITACAO_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do processo</Label>
                  <Input value={form.numeroProcesso} onChange={(e) => set("numeroProcesso", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do edital</Label>
                  <Input value={form.numeroEdital} onChange={(e) => set("numeroEdital", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº da ata</Label>
                  <Input value={form.numeroAta} onChange={(e) => set("numeroAta", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do contrato</Label>
                  <Input value={form.numeroContrato} onChange={(e) => set("numeroContrato", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Portal</Label>
                  <Input value={form.portal} onChange={(e) => set("portal", e.target.value)} placeholder="ComprasNet, BLL..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Link do edital</Label>
                  <Input value={form.linkEdital} onChange={(e) => set("linkEdital", e.target.value)} placeholder="https://..." />
                </div>
              </div>
            </section>

            {/* Órgão / cliente */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Órgão / Cliente</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Órgão licitante *</Label>
                  <Input value={form.orgaoNome} onChange={(e) => set("orgaoNome", e.target.value)} placeholder="Prefeitura Municipal de..." />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ do órgão</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={form.orgaoCnpj}
                      onChange={(e) => set("orgaoCnpj", maskCnpj(e.target.value))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarCnpj() } }}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={buscarCnpj} disabled={buscandoCnpj} title="Buscar dados na Receita (BrasilAPI)">
                      {buscandoCnpj ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Select value={form.orgaoUf || "—"} onValueChange={(v) => set("orgaoUf", v === "—" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="—">—</SelectItem>
                      {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.orgaoCidade} onChange={(e) => set("orgaoCidade", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <Label>Cliente vinculado (opcional)</Label>
                  <ClienteCombobox
                    clienteNome={form.clienteNome}
                    onSelect={(c) => setForm((f) => ({ ...f, clienteId: c?.id ?? null, clienteNome: c?.razaoSocial ?? "" }))}
                  />
                </div>
              </div>
            </section>

            {/* Cronograma / vigência / valores */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cronograma, vigência e valores</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Publicação</Label>
                  <Input type="date" value={form.dataPublicacao} onChange={(e) => set("dataPublicacao", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sessão / abertura</Label>
                  <Input type="datetime-local" value={form.dataAbertura} onChange={(e) => set("dataAbertura", e.target.value)} />
                </div>
                <div className="hidden lg:block" />
                <div className="space-y-1.5">
                  <Label>Vigência início</Label>
                  <Input type="date" value={form.vigenciaInicio} onChange={(e) => set("vigenciaInicio", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vigência fim</Label>
                  <Input type="date" value={form.vigenciaFim} onChange={(e) => set("vigenciaFim", e.target.value)} />
                </div>
                <div className="hidden lg:block" />
                <div className="space-y-1.5">
                  <Label>Valor global estimado</Label>
                  <Input type="number" step="0.01" value={form.valorEstimado} onChange={(e) => set("valorEstimado", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor homologado (ganho)</Label>
                  <Input type="number" step="0.01" value={form.valorHomologado} onChange={(e) => set("valorHomologado", e.target.value)} />
                </div>
              </div>
            </section>

            {/* Itens */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens / Medicamentos ({itens.length})
                </h4>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addItem}>
                  <Plus className="size-3.5" /> Adicionar item
                </Button>
              </div>

              {itens.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                  Sem itens. Adicione os medicamentos/produtos da ata (definem o saldo do faturamento).
                </p>
              ) : (
                <div className="space-y-2">
                  {itens.map((it, idx) => (
                    <div key={it._key} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-muted-foreground mt-2 w-5">{idx + 1}.</span>
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <div className="col-span-12 md:col-span-6">
                            <Input
                              placeholder="Descrição do item / medicamento *"
                              value={it.descricao}
                              onChange={(e) => setItem(it._key, { descricao: e.target.value })}
                            />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <Input placeholder="Nº item" value={it.numeroItem || ""} onChange={(e) => setItem(it._key, { numeroItem: e.target.value })} />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <Input placeholder="Marca" value={it.marca || ""} onChange={(e) => setItem(it._key, { marca: e.target.value })} />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <Input placeholder="Unid." value={it.unidade || ""} onChange={(e) => setItem(it._key, { unidade: e.target.value })} />
                          </div>
                          <div className="col-span-4 md:col-span-3">
                            <Input type="number" step="0.01" placeholder="Quantidade" value={it.quantidade || ""} onChange={(e) => setItem(it._key, { quantidade: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-4 md:col-span-3">
                            <Input type="number" step="0.0001" placeholder="Preço unit." value={it.precoUnitario || ""} onChange={(e) => setItem(it._key, { precoUnitario: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-4 md:col-span-3">
                            <Input type="number" step="0.0001" placeholder="Preço ref." value={it.precoReferencia || ""} onChange={(e) => setItem(it._key, { precoReferencia: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-12 md:col-span-3 flex items-center justify-end text-xs text-muted-foreground">
                            {brl((it.quantidade || 0) * (it.precoUnitario || 0))}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive px-2 mt-0.5" onClick={() => delItem(it._key)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="pl-7 flex items-center gap-2">
                        {it.produtoId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <Link2 className="size-3" /> Vinculado ao catálogo
                            <button className="ml-1 hover:text-rose-600" onClick={() => setItem(it._key, { produtoId: null })}>
                              <X className="size-3" />
                            </button>
                          </span>
                        ) : (
                          <div className="w-[280px]">
                            <ProdutoCombobox
                              triggerLabel="Vincular ao catálogo (opcional)"
                              onSelect={(p) =>
                                setItem(it._key, {
                                  produtoId: p.id,
                                  descricao: it.descricao || p.nome,
                                  precoReferencia: it.precoReferencia || p.precoBase,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end text-sm font-semibold pr-10">
                    Total dos itens: {brl(totalItens)}
                  </div>
                </div>
              )}
            </section>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Combobox de clientes (busca server-side) ───────────────────────────
function ClienteCombobox({
  clienteNome,
  onSelect,
}: {
  clienteNome: string
  onSelect: (c: ClienteOpt | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ClienteOpt[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        setResults((await getClientesParaVinculo(query)) as ClienteOpt[])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, open])

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 h-9 justify-between font-normal">
            <span className="truncate">{clienteNome || "Buscar cliente cadastrado..."}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] max-w-[calc(100vw-1rem)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar por nome ou CNPJ..." value={query} onValueChange={setQuery} />
            <CommandList>
              {loading ? (
                <div className="py-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : results.length === 0 ? (
                <CommandEmpty>Nenhum cliente.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.map((c) => (
                    <CommandItem key={c.id} value={String(c.id)} onSelect={() => { onSelect(c); setOpen(false) }}>
                      <div className="flex flex-col">
                        <span className="text-sm">{c.razaoSocial}</span>
                        <span className="text-[11px] text-muted-foreground">{c.cidade}/{c.estado}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clienteNome && (
        <Button variant="ghost" size="sm" className="px-2 text-muted-foreground" onClick={() => onSelect(null)}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
