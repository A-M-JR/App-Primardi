"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Gavel,
  Plus,
  Radar,
  Search,
  Loader2,
  ShieldAlert,
  CalendarClock,
  ListChecks,
  Building2,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getLicitacoes, type LicitacaoFiltros } from "@/lib/actions/licitacoes"
import {
  MODALIDADE_LABEL,
  MODALIDADES,
  STATUS_LICITACAO,
  STATUS_LICITACAO_META,
  brl,
} from "@/lib/licitacoes/constants"
import { UFS } from "@/lib/licitacoes/pncp"
import { StatusLicitacaoBadge } from "@/components/licitacoes/status-licitacao-badge"
import { LicitacaoFormDialog, type LicitacaoPrefill } from "@/components/licitacoes/licitacao-form-dialog"
import { PncpImportDialog } from "@/components/licitacoes/pncp-import-dialog"
import { CronogramaCalendar } from "@/components/licitacoes/cronograma-calendar"
import type { ModalidadeLicitacao, StatusLicitacao } from "@prisma/client"

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"
const dataHoraBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null

type ListaResp = Awaited<ReturnType<typeof getLicitacoes>>

export default function LicitacoesPage() {
  const router = useRouter()
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("licitacoes", "edit")

  const [dados, setDados] = useState<ListaResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("todos")
  const [modalidade, setModalidade] = useState<string>("todas")
  const [uf, setUf] = useState<string>("todas")

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [pncpOpen, setPncpOpen] = useState(false)
  const [prefill, setPrefill] = useState<LicitacaoPrefill | undefined>(undefined)

  // Pré-preenchimento vindo da consulta de CNPJ (Central de Consultas).
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = sessionStorage.getItem("licitacao_prefill")
    if (!raw) return
    sessionStorage.removeItem("licitacao_prefill")
    try {
      setPrefill(JSON.parse(raw) as LicitacaoPrefill)
      setEditId(null)
      setFormOpen(true)
    } catch {
      /* ignora payload inválido */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filtros: LicitacaoFiltros = {
        search: search || undefined,
        status: status !== "todos" ? (status as LicitacaoFiltros["status"]) : undefined,
        modalidade: modalidade !== "todas" ? (modalidade as ModalidadeLicitacao) : undefined,
        uf: uf !== "todas" ? uf : undefined,
      }
      setDados(await getLicitacoes(filtros))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [search, status, modalidade, uf])

  useEffect(() => {
    if (!authLoading && can("licitacoes")) {
      const t = setTimeout(load, 250)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, load])

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("licitacoes")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso ao módulo de Licitações.
        </div>
      </AppShell>
    )
  }

  const k = dados?.kpis

  const abrirNova = () => { setPrefill(undefined); setEditId(null); setFormOpen(true) }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Gavel className="size-6 text-primary" /> Licitações
            </h1>
            <p className="text-sm text-muted-foreground">Pregões, contratos e atas — do radar à homologação.</p>
          </div>
          <div className="flex items-center gap-2">
            {podeEditar && (
              <Button variant="outline" onClick={() => setPncpOpen(true)} className="gap-2">
                <Radar className="size-4" /> Buscar editais (PNCP)
              </Button>
            )}
            {podeEditar && (
              <Button onClick={abrirNova} className="gap-2">
                <Plus className="size-4" /> Nova licitação
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Total" value={k?.total ?? 0} />
          <KpiCard label="Em andamento" value={k?.emAndamento ?? 0} tone="amber" />
          <KpiCard label="Ganhas / Atas" value={k?.ganhas ?? 0} tone="emerald" />
          <KpiCard label="Valor estimado" value={brl(k?.valorEstimadoTotal ?? 0)} small />
          <KpiCard label="Valor ganho" value={brl(k?.valorGanhoTotal ?? 0)} tone="emerald" small />
        </div>

        <Tabs defaultValue="lista">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="lista" className="gap-1.5"><ListChecks className="size-4" /> Acompanhamento</TabsTrigger>
            <TabsTrigger value="cronograma" className="gap-1.5"><CalendarClock className="size-4" /> Cronograma</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4 mt-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative max-w-xs flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="Buscar objeto, órgão, nº..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="comSaldo">★ Com saldo (contratos)</SelectItem>
                  {STATUS_LICITACAO.map((s) => <SelectItem key={s} value={s}>{STATUS_LICITACAO_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="Modalidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas modalidades</SelectItem>
                  {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{MODALIDADE_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="h-9 w-[100px]"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">UF</SelectItem>
                  {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : !dados || dados.data.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma licitação encontrada. {podeEditar && "Crie uma nova ou importe editais do PNCP."}
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {dados.data.map((l) => {
                  const sessao = dataHoraBR(l.dataAbertura)
                  return (
                    <Card key={l.id} className="border-border/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push(`/licitacoes/${l.id}`)}>
                      <CardContent className="p-3.5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusLicitacaoBadge status={l.status} />
                              <span className="text-[11px] text-muted-foreground">{MODALIDADE_LABEL[l.modalidade]}</span>
                              {l.numeroEdital && <span className="text-[11px] text-muted-foreground">· Edital {l.numeroEdital}</span>}
                              {l.numeroContrato && <span className="text-[11px] text-teal-600">· Contrato {l.numeroContrato}</span>}
                              {l.numeroAta && <span className="text-[11px] text-teal-600">· Ata {l.numeroAta}</span>}
                            </div>
                            <p className="font-medium mt-1 line-clamp-1">{l.objeto}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <Building2 className="size-3" /> {l.orgaoNome}
                              {l.orgaoUf && <span>· {l.orgaoCidade ? `${l.orgaoCidade}/` : ""}{l.orgaoUf}</span>}
                              {l.qtdItens > 0 && <span>· {l.qtdItens} item(ns)</span>}
                              {l.qtdEmpenhos > 0 && <span>· {l.qtdEmpenhos} empenho(s)</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {sessao && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                                <CalendarClock className="size-3" /> {sessao}
                              </p>
                            )}
                            <p className="text-sm font-semibold mt-0.5">
                              {l.valorHomologado > 0 ? brl(l.valorHomologado) : l.valorEstimado > 0 ? brl(l.valorEstimado) : "—"}
                            </p>
                            {l.vigenciaFim && <p className="text-[10px] text-muted-foreground">vig. até {dataBR(l.vigenciaFim)}</p>}
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground self-center shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cronograma" className="mt-4">
            <CronogramaCalendar />
          </TabsContent>
        </Tabs>
      </div>

      <LicitacaoFormDialog open={formOpen} onOpenChange={setFormOpen} licitacaoId={editId} onSaved={load} prefill={editId ? undefined : prefill} />
      <PncpImportDialog open={pncpOpen} onOpenChange={setPncpOpen} onImported={load} />
    </AppShell>
  )
}

function KpiCard({ label, value, tone, small }: { label: string; value: string | number; tone?: "amber" | "emerald"; small?: boolean }) {
  const toneCls =
    tone === "amber" ? "bg-amber-500/5 text-amber-600" : tone === "emerald" ? "bg-emerald-500/5 text-emerald-600" : "bg-muted/40"
  return (
    <div className={`rounded-lg p-4 ${toneCls}`}>
      <p className="text-[13px] opacity-80">{label}</p>
      <p className={`font-semibold mt-1 ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
    </div>
  )
}
