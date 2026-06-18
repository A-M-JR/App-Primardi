"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import * as XLSX from "xlsx"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Wallet,
  Upload,
  Loader2,
  Search,
  ShieldAlert,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { parseBordero } from "@/lib/cobranca/parse-bordero"
import {
  importarBordero,
  getCobrancaPainel,
  getTitulosDevedor,
  salvarTelefoneDevedor,
  type DevedorPainel,
} from "@/lib/actions/cobranca"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")

const TEMPLATE_PADRAO =
  "Olá {nome}, tudo bem? Identificamos {qtd} título(s) em aberto no valor de {total}{vencido}. Poderia nos ajudar a regularizar? Ficamos à disposição. 🙏"
const TPL_KEY = "cobranca_template_whats"

function montarMensagem(template: string, d: DevedorPainel) {
  const vencido =
    d.qtdVencidos > 0
      ? ` (sendo ${d.qtdVencidos} vencido(s) totalizando ${brl(d.totalVencido)})`
      : ""
  return template
    .replaceAll("{nome}", d.nome)
    .replaceAll("{qtd}", String(d.qtdTitulos))
    .replaceAll("{total}", brl(d.total))
    .replaceAll("{vencido}", vencido)
}

function linkWhats(telefone: string, msg: string) {
  let digits = telefone.replace(/\D/g, "")
  if (digits.length <= 11) digits = "55" + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

export default function CobrancaPage() {
  const { can, isLoading: authLoading } = useAuth()
  const [dados, setDados] = useState<{ devedores: DevedorPainel[]; kpis: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [importando, setImportando] = useState(false)
  const [search, setSearch] = useState("")
  const [soVencidos, setSoVencidos] = useState(false)
  const [template, setTemplate] = useState(TEMPLATE_PADRAO)
  const [telefones, setTelefones] = useState<Record<number, string>>({})
  const [expandido, setExpandido] = useState<number | null>(null)
  const [titulos, setTitulos] = useState<Record<number, any[]>>({})

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TPL_KEY) : null
    if (t) setTemplate(t)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getCobrancaPainel()
      setDados(d)
      const tel: Record<number, string> = {}
      d.devedores.forEach((x) => (tel[x.id] = x.telefone || ""))
      setTelefones(tel)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (can("cobranca")) load()
  }, [can, load])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
      const devedores = parseBordero(rows as unknown[][])
      if (devedores.length === 0) {
        toast.error("Não encontrei devedores/títulos nesse arquivo.")
        return
      }
      const res = await importarBordero(devedores)
      toast.success(`Importado: ${res.totalDevedores} devedores, ${res.totalTitulos} títulos.`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar.")
    } finally {
      setImportando(false)
      e.target.value = ""
    }
  }

  function salvarTemplate(v: string) {
    setTemplate(v)
    localStorage.setItem(TPL_KEY, v)
  }

  async function salvarTel(id: number) {
    await salvarTelefoneDevedor(id, telefones[id] || "")
    setDados((prev) =>
      prev
        ? { ...prev, devedores: prev.devedores.map((d) => (d.id === id ? { ...d, telefone: telefones[id] || null } : d)) }
        : prev
    )
  }

  async function toggleExpand(id: number) {
    if (expandido === id) {
      setExpandido(null)
      return
    }
    setExpandido(id)
    if (!titulos[id]) {
      const t = await getTitulosDevedor(id)
      setTitulos((p) => ({ ...p, [id]: t }))
    }
  }

  const filtrados = useMemo(() => {
    if (!dados) return []
    const q = search.trim().toLowerCase()
    return dados.devedores.filter((d) => {
      if (soVencidos && d.qtdVencidos === 0) return false
      if (q && !d.nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [dados, search, soVencidos])

  if (authLoading) {
    return (
      <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
    )
  }

  if (!can("cobranca")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" />
          Sem acesso ao módulo de Crédito/Cobrança.
        </div>
      </AppShell>
    )
  }

  const k = dados?.kpis

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="size-6 text-primary" /> Crédito / Cobrança
            </h1>
            <p className="text-sm text-muted-foreground">Importe o borderô e dispare lembretes por WhatsApp.</p>
          </div>
          <label>
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleUpload} disabled={importando} />
            <span className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90">
              {importando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importando ? "Importando..." : "Importar borderô"}
            </span>
          </label>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Devedores</p>
            <p className="text-2xl font-semibold mt-1">{k?.devedores ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Total a receber</p>
            <p className="text-2xl font-semibold mt-1">{brl(k?.totalReceber ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-rose-500/5 p-4">
            <p className="text-[13px] text-rose-600">Total vencido</p>
            <p className="text-2xl font-semibold mt-1 text-rose-600">{brl(k?.totalVencido ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 p-4">
            <p className="text-[13px] text-amber-600">Com vencidos</p>
            <p className="text-2xl font-semibold mt-1 text-amber-600">{k?.comVencidos ?? 0}</p>
          </div>
        </div>

        {/* Template da mensagem */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm">Modelo da mensagem (WhatsApp)</Label>
            <Textarea value={template} onChange={(e) => salvarTemplate(e.target.value)} rows={2} className="text-sm" />
            <p className="text-[11px] text-muted-foreground">
              Variáveis: <code>{"{nome}"}</code> <code>{"{qtd}"}</code> <code>{"{total}"}</code> <code>{"{vencido}"}</code>
            </p>
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Buscar devedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <button
            onClick={() => setSoVencidos((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              soVencidos ? "border-rose-400 bg-rose-500/10 text-rose-600 font-medium" : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            <AlertTriangle className="size-3.5" /> Só com vencidos
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : !dados || dados.devedores.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum devedor. Importe um borderô para começar.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {filtrados.map((d) => {
              const tel = telefones[d.id] ?? ""
              const msg = montarMensagem(template, d)
              return (
                <Card key={d.id} className="border-border/60">
                  <CardContent className="p-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{d.nome}</span>
                          {d.cidade && <span className="text-xs text-muted-foreground">{d.cidade}</span>}
                          {d.qtdVencidos > 0 && (
                            <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                              {d.qtdVencidos} vencido(s)
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.qtdTitulos} título(s) · Total {brl(d.total)}
                          {d.totalVencido > 0 && <span className="text-rose-600"> · Vencido {brl(d.totalVencido)}</span>}
                          {d.vencimentoMaisAntigo && ` · + antigo ${dataBR(d.vencimentoMaisAntigo)}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          placeholder="WhatsApp (DDD+nº)"
                          value={tel}
                          onChange={(e) => setTelefones((p) => ({ ...p, [d.id]: e.target.value }))}
                          onBlur={() => salvarTel(d.id)}
                          className="h-9 w-40"
                        />
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={!tel.replace(/\D/g, "")}
                          onClick={() => window.open(linkWhats(tel, msg), "_blank")}
                          title={!tel ? "Informe o telefone" : "Abrir WhatsApp"}
                        >
                          <MessageCircle className="size-4" /> WhatsApp
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(d.id)} className="px-2">
                          {expandido === d.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                      </div>
                    </div>

                    {expandido === d.id && (
                      <div className="mt-3 border-t pt-2 text-xs">
                        {!titulos[d.id] ? (
                          <div className="flex items-center gap-2 text-muted-foreground py-2"><Loader2 className="size-3.5 animate-spin" /> Carregando...</div>
                        ) : (
                          <table className="w-full">
                            <thead className="text-muted-foreground">
                              <tr><th className="text-left py-1">Título</th><th className="text-left py-1">Vencimento</th><th className="text-right py-1">Total</th></tr>
                            </thead>
                            <tbody>
                              {titulos[d.id].map((t) => {
                                const venc = t.vencimento && new Date(t.vencimento) < new Date(new Date().toDateString())
                                return (
                                  <tr key={t.id} className="border-t border-border/40">
                                    <td className="py-1 font-mono">{t.numero}</td>
                                    <td className={`py-1 ${venc ? "text-rose-600 font-medium" : ""}`}>{dataBR(t.vencimento)}{venc && " (vencido)"}</td>
                                    <td className="py-1 text-right">{brl(t.total)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
