"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Receipt,
  Search,
  Loader2,
  ShieldAlert,
  Building2,
  AlertTriangle,
  FileBox,
  ChevronRight,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  getPainelFaturamento,
  getEmpenhos,
  type FaturamentoFiltros,
} from "@/lib/actions/faturamento"
import { brl } from "@/lib/licitacoes/constants"
import { StatusEmpenhoBadge } from "@/components/licitacoes/status-licitacao-badge"
import { EmpenhoFormDialog } from "@/components/faturamento/empenho-form-dialog"

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")

type Painel = Awaited<ReturnType<typeof getPainelFaturamento>>
type Empenhos = Awaited<ReturnType<typeof getEmpenhos>>

export default function FaturamentoPage() {
  const router = useRouter()
  const { can, isLoading: authLoading } = useAuth()
  const podeFaturar = can("faturamento", "edit")

  const [painel, setPainel] = useState<Painel | null>(null)
  const [empenhos, setEmpenhos] = useState<Empenhos>([])
  const [loading, setLoading] = useState(true)
  const [loadingEmp, setLoadingEmp] = useState(true)
  const [search, setSearch] = useState("")
  const [soSaldo, setSoSaldo] = useState(true)
  const [soVencendo, setSoVencendo] = useState(false)
  const [searchEmp, setSearchEmp] = useState("")

  const [empenhoOpen, setEmpenhoOpen] = useState(false)
  const [faturarLicId, setFaturarLicId] = useState<number | null>(null)

  const loadPainel = useCallback(async () => {
    setLoading(true)
    try {
      const filtros: FaturamentoFiltros = { search: search || undefined, comSaldo: soSaldo, vencendo: soVencendo }
      setPainel(await getPainelFaturamento(filtros))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [search, soSaldo, soVencendo])

  const loadEmpenhos = useCallback(async () => {
    setLoadingEmp(true)
    try {
      setEmpenhos(await getEmpenhos({ search: searchEmp || undefined }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar empenhos.")
    } finally {
      setLoadingEmp(false)
    }
  }, [searchEmp])

  useEffect(() => {
    if (!authLoading && can("faturamento")) {
      const t = setTimeout(loadPainel, 250)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, loadPainel])

  useEffect(() => {
    if (!authLoading && can("faturamento")) {
      const t = setTimeout(loadEmpenhos, 250)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, loadEmpenhos])

  const recarregar = () => { loadPainel(); loadEmpenhos() }

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("faturamento")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso ao módulo de Faturamento.
        </div>
      </AppShell>
    )
  }

  const k = painel?.kpis
  const abrirFaturar = (licId: number) => { setFaturarLicId(licId); setEmpenhoOpen(true) }
  const vencendo30 = (painel?.contratos ?? []).filter(
    (c) => c.diasParaVencer != null && c.diasParaVencer >= 0 && c.diasParaVencer <= 30 && c.saldo > 0.01
  )

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="size-6 text-primary" /> Faturamento
          </h1>
          <p className="text-sm text-muted-foreground">Saldo dos contratos/atas e registro de empenhos.</p>
        </div>

        {vencendo30.length > 0 && (
          <button
            onClick={() => setSoVencendo(true)}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-500/15 transition-colors text-left"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <b>{vencendo30.length}</b> contrato(s) com saldo <b>vencendo em até 30 dias</b>. Clique para filtrar e faturar antes do prazo.
            </span>
          </button>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Contratos ativos</p>
            <p className="text-2xl font-semibold mt-1">{k?.contratos ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">Valor contratado</p>
            <p className="text-lg font-semibold mt-1">{brl(k?.valorContratado ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-sky-500/5 p-4">
            <p className="text-[13px] text-sky-600">Faturado</p>
            <p className="text-lg font-semibold mt-1 text-sky-600">{brl(k?.valorFaturado ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/5 p-4">
            <p className="text-[13px] text-emerald-600">Saldo a faturar</p>
            <p className="text-lg font-semibold mt-1 text-emerald-600">{brl(k?.saldo ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 p-4">
            <p className="text-[13px] text-amber-600">Vencendo em 60d</p>
            <p className="text-2xl font-semibold mt-1 text-amber-600">{k?.vencendo60 ?? 0}</p>
          </div>
        </div>

        <Tabs defaultValue="contratos">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="contratos" className="gap-1.5"><Wallet className="size-4" /> Contratos / Saldo</TabsTrigger>
            <TabsTrigger value="empenhos" className="gap-1.5"><FileBox className="size-4" /> Empenhos</TabsTrigger>
          </TabsList>

          {/* Contratos */}
          <TabsContent value="contratos" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative max-w-xs flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="Buscar contrato/órgão..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <button
                onClick={() => setSoSaldo((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${soSaldo ? "border-emerald-400 bg-emerald-500/10 text-emerald-600 font-medium" : "border-border hover:bg-muted text-muted-foreground"}`}
              >
                Só com saldo
              </button>
              <button
                onClick={() => setSoVencendo((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${soVencendo ? "border-amber-400 bg-amber-500/10 text-amber-600 font-medium" : "border-border hover:bg-muted text-muted-foreground"}`}
              >
                <AlertTriangle className="size-3.5" /> Vencendo (60d)
              </button>
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : !painel || painel.contratos.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhum contrato ativo. Marque uma licitação como Ganha/Homologada/Contratada para gerenciar o saldo aqui.
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {painel.contratos.map((c) => {
                  const venc = c.diasParaVencer
                  const vencCls = venc !== null && venc <= 30 ? "text-rose-600" : venc !== null && venc <= 60 ? "text-amber-600" : "text-muted-foreground"
                  return (
                    <Card key={c.id} className="border-border/60">
                      <CardContent className="p-3.5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/licitacoes/${c.id}`)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium line-clamp-1">{c.objeto}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <Building2 className="size-3" /> {c.orgaoNome}{c.orgaoUf ? ` · ${c.orgaoUf}` : ""}
                              {c.numeroContrato && <span>· Contrato {c.numeroContrato}</span>}
                              {c.numeroAta && <span>· Ata {c.numeroAta}</span>}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                              <span>Contratado <b>{brl(c.valorContratado)}</b></span>
                              <span className="text-sky-600">Faturado {brl(c.valorFaturado)}</span>
                              <span className="text-emerald-600 font-medium">Saldo {brl(c.saldo)}</span>
                              <span className="text-muted-foreground">{c.itensComSaldo}/{c.qtdItens} itens c/ saldo</span>
                              {c.vigenciaFim && <span className={vencCls}>vig. até {dataBR(c.vigenciaFim)}{venc !== null && venc >= 0 ? ` (${venc}d)` : ""}</span>}
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden max-w-md">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, c.percExecutado)}%` }} />
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {podeFaturar && c.saldo > 0.0001 && (
                              <Button size="sm" className="gap-1.5" onClick={() => abrirFaturar(c.id)}>
                                <Receipt className="size-3.5" /> Faturar
                              </Button>
                            )}
                            <button onClick={() => router.push(`/licitacoes/${c.id}`)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center">
                              detalhes <ChevronRight className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Empenhos */}
          <TabsContent value="empenhos" className="space-y-4 mt-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Buscar empenho/NF/órgão..." value={searchEmp} onChange={(e) => setSearchEmp(e.target.value)} className="pl-9 h-9" />
            </div>
            {loadingEmp ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : empenhos.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum empenho registrado.</CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {empenhos.map((e) => (
                  <Card key={e.id} className="border-border/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push(`/licitacoes/${e.licitacao.id}`)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium text-sm">{e.numero}</span>
                          <StatusEmpenhoBadge status={e.status} />
                          {e.numeroNotaFiscal && <span className="text-[11px] text-muted-foreground">NF {e.numeroNotaFiscal}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {e.licitacao.orgaoNome} · {e.licitacao.objeto}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {dataBR(e.dataEmpenho)} · {e.qtdItens} item(ns)
                          {e.prazoEntrega && ` · entrega até ${dataBR(e.prazoEntrega)}`}
                        </p>
                      </div>
                      <span className="font-semibold text-sm shrink-0">{brl(e.valorTotal)}</span>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EmpenhoFormDialog open={empenhoOpen} onOpenChange={setEmpenhoOpen} licitacaoId={faturarLicId} onSaved={recarregar} />
    </AppShell>
  )
}
