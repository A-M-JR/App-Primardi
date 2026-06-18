"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Database,
  Building2,
  Barcode,
  TrendingUp,
  FileSignature,
  ScrollText,
  Pill,
  Search,
  Loader2,
  ShieldAlert,
  Upload,
  ExternalLink,
  CheckCircle2,
  XCircle,
  BookOpen,
  Gavel,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  consultarCnpj,
  consultarEan,
  getCosmosQuota,
  consultarPrecosPraticados,
  buscarContratos,
  buscarAtas,
  getCmedStatus,
  importarCmed,
  consultarCmed,
} from "@/lib/actions/consultas"
import { parseCmed } from "@/lib/cmed/parse"
import { brl } from "@/lib/licitacoes/constants"
import { maskCnpj, maskCep, maskTelefone, maskEan } from "@/lib/utils"

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
const toPncp = (s: string) => s.replaceAll("-", "")
const soData = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

function abrirNovaLicitacao(router: ReturnType<typeof useRouter>, payload: Record<string, unknown>) {
  sessionStorage.setItem("licitacao_prefill", JSON.stringify(payload))
  router.push("/licitacoes")
}

export default function ConsultasPage() {
  const { can, isLoading: authLoading } = useAuth()

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("licitacoes")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso às consultas.
        </div>
      </AppShell>
    )
  }

  const podeEditar = can("licitacoes", "edit")

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Database className="size-6 text-primary" /> Central de Consultas (APIs)
            </h1>
            <p className="text-sm text-muted-foreground">Fontes oficiais e gratuitas: PNCP, Compras.gov.br, CMED/ANVISA, Receita (CNPJ) e EAN.</p>
          </div>
          <Link href="/manuais/licitacoes" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0">
            <BookOpen className="size-4" /> Ver manual
          </Link>
        </div>

        <Tabs defaultValue="cnpj">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="cnpj" className="gap-1.5"><Building2 className="size-4" /> CNPJ</TabsTrigger>
            <TabsTrigger value="ean" className="gap-1.5"><Barcode className="size-4" /> EAN</TabsTrigger>
            <TabsTrigger value="cmed" className="gap-1.5"><Pill className="size-4" /> CMED / PMVG</TabsTrigger>
            <TabsTrigger value="precos" className="gap-1.5"><TrendingUp className="size-4" /> Preços praticados</TabsTrigger>
            <TabsTrigger value="contratos" className="gap-1.5"><FileSignature className="size-4" /> Contratos</TabsTrigger>
            <TabsTrigger value="atas" className="gap-1.5"><ScrollText className="size-4" /> Atas</TabsTrigger>
          </TabsList>

          <TabsContent value="cnpj" className="mt-4"><TabCnpj /></TabsContent>
          <TabsContent value="ean" className="mt-4"><TabEan /></TabsContent>
          <TabsContent value="cmed" className="mt-4"><TabCmed podeEditar={podeEditar} /></TabsContent>
          <TabsContent value="precos" className="mt-4"><TabPrecos /></TabsContent>
          <TabsContent value="contratos" className="mt-4"><TabContratos /></TabsContent>
          <TabsContent value="atas" className="mt-4"><TabAtas /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}

// ─────────────────────────── CNPJ ───────────────────────────
function TabCnpj() {
  const router = useRouter()
  const [cnpj, setCnpj] = useState("")
  const [loading, setLoading] = useState(false)
  const [r, setR] = useState<Awaited<ReturnType<typeof consultarCnpj>> | null>(null)

  const buscar = async () => {
    setLoading(true)
    try { setR(await consultarCnpj(cnpj)) } catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); setR(null) } finally { setLoading(false) }
  }

  const usarEmLicitacao = () => {
    if (!r) return
    sessionStorage.setItem(
      "licitacao_prefill",
      JSON.stringify({ orgaoNome: r.razaoSocial, orgaoCnpj: maskCnpj(r.cnpj), orgaoCidade: r.municipio, orgaoUf: r.uf })
    )
    router.push("/licitacoes")
  }

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex gap-2 max-w-md">
        <Input placeholder="00.000.000/0000-00" maxLength={18} value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <Button onClick={buscar} disabled={loading} className="gap-2 shrink-0">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar</Button>
      </div>
      {r && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={usarEmLicitacao}>
            <Gavel className="size-3.5" /> Usar em nova licitação
          </Button>
        </div>
      )}
      {r && (
        <div className="rounded-lg border p-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Campo l="Razão social" v={r.razaoSocial} span />
          <Campo l="Nome fantasia" v={r.nomeFantasia} />
          <Campo l="Situação" v={r.situacao} />
          <Campo l="Atividade" v={r.atividade} span />
          <Campo l="Logradouro" v={`${r.logradouro}${r.numero ? ", " + r.numero : ""}`} />
          <Campo l="Bairro" v={r.bairro} />
          <Campo l="CNPJ" v={maskCnpj(r.cnpj)} />
          <Campo l="Município/UF" v={`${r.municipio}${r.uf ? "/" + r.uf : ""}`} />
          <Campo l="CEP" v={r.cep ? maskCep(r.cep) : ""} />
          <Campo l="Telefone" v={r.telefone ? maskTelefone(r.telefone) : ""} />
          <Campo l="E-mail" v={r.email} />
        </div>
      )}
    </CardContent></Card>
  )
}

// ─────────────────────────── EAN ───────────────────────────
function TabEan() {
  const [ean, setEan] = useState("")
  const [loading, setLoading] = useState(false)
  const [r, setR] = useState<Awaited<ReturnType<typeof consultarEan>> | null>(null)
  const [quota, setQuota] = useState<Awaited<ReturnType<typeof getCosmosQuota>> | null>(null)

  const carregarQuota = () => getCosmosQuota().then(setQuota).catch(() => {})
  useEffect(() => { carregarQuota() }, [])

  const buscar = async () => {
    setLoading(true)
    try {
      setR(await consultarEan(ean))
      carregarQuota()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
      setR(null)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Busca em Open Food Facts (consumo), Bluesoft Cosmos (inclui medicamentos) e base CMED por EAN/GTIN.</p>
        {quota && (
          <Badge variant="outline" className={`text-[10px] ${quota.restantes === 0 ? "text-rose-600 border-rose-500/30" : "text-muted-foreground"}`}>
            Cosmos: {quota.usadas}/{quota.limite} hoje
          </Badge>
        )}
      </div>
      <div className="flex gap-2 max-w-md">
        <Input placeholder="Código de barras (EAN/GTIN)" inputMode="numeric" maxLength={14} value={ean} onChange={(e) => setEan(maskEan(e.target.value))} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <Button onClick={buscar} disabled={loading} className="gap-2 shrink-0">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar</Button>
      </div>
      {r && (
        <div className="space-y-3">
          <div className="rounded-lg border p-3 flex items-center gap-3">
            {r.imagem && <img src={r.imagem} alt="" className="size-14 object-contain rounded" />}
            <div className="text-sm">
              {r.encontrado ? (
                <>
                  <p className="font-medium">{r.nome || "(sem nome)"}</p>
                  <p className="text-muted-foreground text-xs">{[r.marca, r.detalhe].filter(Boolean).join(" · ")} · via {r.fonte}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Não encontrado nas bases de produtos.</p>
              )}
            </div>
          </div>
          {r.cosmosLimiteAtingido && (
            <p className="text-xs text-amber-600 rounded-lg bg-amber-500/5 p-3">
              Limite diário do Cosmos ({quota?.limite ?? 25} consultas) atingido. A busca de medicamentos por EAN volta amanhã.
            </p>
          )}
          {r.cmed.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Encontrado na CMED (medicamento)</p>
              {r.cmed.map((m, i) => (
                <div key={i} className="text-sm flex items-center justify-between border-t py-1.5 first:border-0">
                  <div><p className="font-medium">{m.produto}</p><p className="text-xs text-muted-foreground">{[m.apresentacao, m.laboratorio].filter(Boolean).join(" · ")}</p></div>
                  <div className="text-right text-xs"><p className="text-emerald-600 font-semibold">PMVG {brl(m.pmvg)}</p><p className="text-muted-foreground">PF {brl(m.precoFabrica)}</p></div>
                </div>
              ))}
            </div>
          )}
          {!r.encontrado && r.cmed.length === 0 && !r.cosmosLimiteAtingido && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
              Código não localizado em nenhuma base (Open Food Facts, Cosmos e CMED). Confira se o EAN/GTIN está correto.
            </p>
          )}
        </div>
      )}
    </CardContent></Card>
  )
}

// ─────────────────────────── CMED ───────────────────────────
function TabCmed({ podeEditar }: { podeEditar: boolean }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getCmedStatus>> | null>(null)
  const [competencia, setCompetencia] = useState("")
  const [importando, setImportando] = useState(false)
  const [termo, setTermo] = useState("")
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<Awaited<ReturnType<typeof consultarCmed>>>([])

  useEffect(() => { getCmedStatus().then(setStatus).catch(() => {}) }, [])

  const buscar = async () => {
    if (termo.trim().length < 2) return
    setLoading(true)
    try { setRes(await consultarCmed(termo)) } catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") } finally { setLoading(false) }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][]
      const parsed = parseCmed(rows)
      if (parsed.length === 0) { toast.error("Não reconheci o layout da planilha CMED."); return }
      const r = await importarCmed(parsed, competencia || undefined)
      toast.success(`${r.total.toLocaleString("pt-BR")} medicamentos importados.`)
      setStatus(await getCmedStatus())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar.")
    } finally {
      setImportando(false)
      e.target.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">Base CMED / PMVG (ANVISA)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status && status.total > 0
              ? `${status.total.toLocaleString("pt-BR")} medicamentos${status.competencia ? ` · competência ${status.competencia}` : ""}${status.atualizadoEm ? ` · atualizado em ${dataBR(status.atualizadoEm)}` : ""}`
              : "Base vazia. Importe a planilha oficial da ANVISA."}
          </p>
          <a href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline mt-1">
            <ExternalLink className="size-3" /> Baixar lista oficial (gov.br/anvisa)
          </a>
        </div>
        {podeEditar && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Competência</Label>
              <Input className="h-9 w-28" placeholder="06/2026" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <label>
              <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={upload} disabled={importando} />
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90">
                {importando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {importando ? "Importando..." : "Importar planilha"}
              </span>
            </label>
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex gap-2 max-w-md">
          <Input placeholder="Buscar por produto, substância, EAN ou registro" value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
          <Button onClick={buscar} disabled={loading} className="gap-2 shrink-0">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar</Button>
        </div>
        {res.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="text-left p-2">Produto</th><th className="text-left p-2">Substância</th><th className="text-left p-2">EAN</th>
                <th className="text-right p-2">PF</th><th className="text-right p-2">PMVG (teto gov.)</th>
              </tr></thead>
              <tbody>
                {res.map((m) => (
                  <tr key={m.id} className="border-b border-border/40">
                    <td className="p-2"><p className="font-medium leading-tight">{m.produto}</p><p className="text-[11px] text-muted-foreground">{[m.apresentacao, m.laboratorio, m.tarja].filter(Boolean).join(" · ")}</p></td>
                    <td className="p-2 text-xs">{m.substancia || "—"}</td>
                    <td className="p-2 font-mono text-xs">{m.ean || "—"}</td>
                    <td className="p-2 text-right tabular-nums">{brl(m.precoFabrica)}</td>
                    <td className="p-2 text-right tabular-nums font-semibold text-emerald-600">{brl(m.pmvg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

// ─────────────────────── Preços praticados ───────────────────────
function TabPrecos() {
  const [catmat, setCatmat] = useState("")
  const [loading, setLoading] = useState(false)
  const [r, setR] = useState<Awaited<ReturnType<typeof consultarPrecosPraticados>> | null>(null)

  const buscar = async () => {
    const cod = parseInt(catmat, 10)
    if (!cod) return toast.error("Informe o código CATMAT (número).")
    setLoading(true)
    try { setR(await consultarPrecosPraticados({ codigoItemCatalogo: cod })) } catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); setR(null) } finally { setLoading(false) }
  }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">Preços praticados em compras públicas (Compras.gov.br). Informe o código <b>CATMAT</b> do item.</p>
      <div className="flex gap-2 max-w-md">
        <Input placeholder="Código CATMAT (ex.: 391587)" value={catmat} onChange={(e) => setCatmat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <Button onClick={buscar} disabled={loading} className="gap-2 shrink-0">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar</Button>
      </div>
      {r && (r.itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum preço encontrado para esse CATMAT.</p>
      ) : (
        <div className="overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-2">{r.totalRegistros} registro(s).</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="text-left p-2">Item</th><th className="text-left p-2">Fornecedor</th><th className="text-left p-2">Órgão</th>
              <th className="text-right p-2">Qtd</th><th className="text-right p-2">Preço unit.</th><th className="text-right p-2">Data</th>
            </tr></thead>
            <tbody>
              {r.itens.map((it, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="p-2"><p className="leading-tight line-clamp-2 max-w-xs">{it.descricao}</p>{it.marca && <p className="text-[11px] text-muted-foreground">{it.marca} · {it.unidade}</p>}</td>
                  <td className="p-2 text-xs">{it.fornecedor}</td>
                  <td className="p-2 text-xs">{it.orgao}{it.uf ? ` · ${it.uf}` : ""}</td>
                  <td className="p-2 text-right tabular-nums">{it.quantidade}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{brl(it.precoUnitario)}</td>
                  <td className="p-2 text-right text-xs">{dataBR(it.data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </CardContent></Card>
  )
}

// ─────────────────────── PNCP Contratos ───────────────────────
function TabContratos() {
  const router = useRouter()
  const [di, setDi] = useState(diasAtras(7))
  const [df, setDf] = useState(ymd(new Date()))
  const [kw, setKw] = useState("medicamento")
  const [loading, setLoading] = useState(false)
  const [r, setR] = useState<Awaited<ReturnType<typeof buscarContratos>> | null>(null)

  const buscar = async () => {
    setLoading(true)
    try { setR(await buscarContratos({ dataInicial: toPncp(di), dataFinal: toPncp(df), palavraChave: kw || undefined })) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); setR(null) } finally { setLoading(false) }
  }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">Contratos publicados no PNCP por período de vigência/publicação.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" className="h-9" value={di} onChange={(e) => setDi(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" className="h-9" value={df} onChange={(e) => setDf(e.target.value)} /></div>
        <div className="space-y-1 flex-1 min-w-[160px]"><Label className="text-xs">Palavra-chave</Label><Input className="h-9" value={kw} onChange={(e) => setKw(e.target.value)} /></div>
        <Button onClick={buscar} disabled={loading} className="gap-2">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar</Button>
      </div>
      {r && (r.itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contrato no período.</p>
      ) : (
        <div className="space-y-1.5">
          {r.itens.map((c) => (
            <div key={c.idExterno} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.orgaoNome} {c.orgaoUf && <span className="text-xs text-muted-foreground">· {c.orgaoCidade}/{c.orgaoUf}</span>}</span>
                <span className="font-semibold shrink-0">{brl(c.valorGlobal)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.objeto}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Fornecedor: {c.fornecedor || "—"} · Vigência {dataBR(c.vigenciaInicio)} a {dataBR(c.vigenciaFim)}</p>
              <div className="flex justify-end mt-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-primary"
                  onClick={() =>
                    abrirNovaLicitacao(router, {
                      objeto: c.objeto,
                      status: "ACOMPANHANDO",
                      numeroContrato: c.numeroContrato,
                      orgaoNome: c.orgaoNome,
                      orgaoUf: c.orgaoUf,
                      orgaoCidade: c.orgaoCidade,
                      portal: "PNCP",
                      vigenciaInicio: soData(c.vigenciaInicio),
                      vigenciaFim: soData(c.vigenciaFim),
                      valorEstimado: c.valorGlobal ? String(c.valorGlobal) : "",
                    })
                  }
                >
                  <Gavel className="size-3.5" /> Usar em nova licitação
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </CardContent></Card>
  )
}

// ─────────────────────── PNCP Atas ───────────────────────
function TabAtas() {
  const router = useRouter()
  const [di, setDi] = useState(diasAtras(7))
  const [df, setDf] = useState(ymd(new Date()))
  const [kw, setKw] = useState("medicamento")
  const [loading, setLoading] = useState(false)
  const [r, setR] = useState<Awaited<ReturnType<typeof buscarAtas>> | null>(null)

  const buscar = async () => {
    setLoading(true)
    try { setR(await buscarAtas({ dataInicial: toPncp(di), dataFinal: toPncp(df), palavraChave: kw || undefined })) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); setR(null) } finally { setLoading(false) }
  }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">Atas de Registro de Preços no PNCP — úteis para <b>adesão (carona)</b>.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" className="h-9" value={di} onChange={(e) => setDi(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" className="h-9" value={df} onChange={(e) => setDf(e.target.value)} /></div>
        <div className="space-y-1 flex-1 min-w-[160px]"><Label className="text-xs">Palavra-chave</Label><Input className="h-9" value={kw} onChange={(e) => setKw(e.target.value)} /></div>
        <Button onClick={buscar} disabled={loading} className="gap-2">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar</Button>
      </div>
      {r && (r.itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ata no período.</p>
      ) : (
        <div className="space-y-1.5">
          {r.itens.map((a) => (
            <div key={a.idExterno} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{a.orgaoNome}</span>
                {a.possibilidadeAdesao ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] shrink-0"><CheckCircle2 className="size-3 mr-1" /> permite adesão</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0"><XCircle className="size-3 mr-1" /> sem adesão</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.objeto || "(sem objeto)"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ata {a.numeroAta || "—"} · {a.orgaoUnidade} · Vigência {dataBR(a.vigenciaInicio)} a {dataBR(a.vigenciaFim)}{a.cancelado ? " · CANCELADA" : ""}</p>
              {!a.cancelado && (
                <div className="flex justify-end mt-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-primary"
                    onClick={() =>
                      abrirNovaLicitacao(router, {
                        objeto: a.objeto,
                        modalidade: "ADESAO_ATA",
                        status: "ACOMPANHANDO",
                        numeroAta: a.numeroAta,
                        orgaoNome: a.orgaoNome,
                        portal: "PNCP",
                        vigenciaInicio: soData(a.vigenciaInicio),
                        vigenciaFim: soData(a.vigenciaFim),
                      })
                    }
                  >
                    <Gavel className="size-3.5" /> Usar em nova licitação (adesão)
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </CardContent></Card>
  )
}

function Campo({ l, v, span }: { l: string; v: string | null | undefined; span?: boolean }) {
  return (
    <div className={span ? "col-span-2 md:col-span-1" : ""}>
      <p className="text-[11px] text-muted-foreground">{l}</p>
      <p className="font-medium">{v || "—"}</p>
    </div>
  )
}
