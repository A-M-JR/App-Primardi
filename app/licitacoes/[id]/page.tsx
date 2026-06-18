"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Gavel,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Pencil,
  Trash2,
  ExternalLink,
  Building2,
  CalendarClock,
  Plus,
  Receipt,
  FileText,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  getLicitacao,
  atualizarStatusLicitacao,
  excluirLicitacao,
} from "@/lib/actions/licitacoes"
import { excluirEmpenho } from "@/lib/actions/faturamento"
import { exportLicitacaoXlsx } from "@/lib/licitacoes/export"
import {
  MODALIDADE_LABEL,
  STATUS_LICITACAO,
  STATUS_LICITACAO_META,
  brl,
  num,
} from "@/lib/licitacoes/constants"
import { StatusLicitacaoBadge, StatusEmpenhoBadge } from "@/components/licitacoes/status-licitacao-badge"
import { LicitacaoFormDialog } from "@/components/licitacoes/licitacao-form-dialog"
import { EmpenhoFormDialog } from "@/components/faturamento/empenho-form-dialog"
import type { StatusLicitacao } from "@prisma/client"

type Detalhe = Awaited<ReturnType<typeof getLicitacao>>

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")
const dataHoraBR = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—")

export default function LicitacaoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("licitacoes", "edit")
  const podeFaturar = can("faturamento", "edit")

  const [lic, setLic] = useState<Detalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [empenhoOpen, setEmpenhoOpen] = useState(false)
  const [empenhoEditId, setEmpenhoEditId] = useState<number | null>(null)
  const [excluirLic, setExcluirLic] = useState(false)
  const [excluirEmp, setExcluirEmp] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLic(await getLicitacao(id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!authLoading && can("licitacoes") && id) load()
  }, [authLoading, can, id, load])

  const mudarStatus = async (s: StatusLicitacao) => {
    try {
      await atualizarStatusLicitacao(id, s)
      toast.success("Status atualizado.")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  const confirmarExcluir = async () => {
    try {
      await excluirLicitacao(id)
      toast.success("Licitação excluída.")
      router.push("/licitacoes")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  const confirmarExcluirEmpenho = async () => {
    if (!excluirEmp) return
    try {
      await excluirEmpenho(excluirEmp)
      toast.success("Empenho excluído.")
      setExcluirEmp(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  if (authLoading || loading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("licitacoes")) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground"><ShieldAlert className="size-10 text-destructive/70" /> Sem acesso.</div></AppShell>
  }
  if (!lic) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground">Licitação não encontrada.<Button variant="outline" onClick={() => router.push("/licitacoes")}>Voltar</Button></div></AppShell>
  }

  const r = lic.resumo
  const temContrato = ["GANHA", "HOMOLOGADA", "CONTRATADA"].includes(lic.status)

  return (
    <AppShell>
      <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <button onClick={() => router.push("/licitacoes")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="size-3.5" /> Licitações
            </button>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Gavel className="size-5 text-primary shrink-0" />
              <span className="line-clamp-2">{lic.objeto}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <Building2 className="size-3.5" /> {lic.orgaoNome}
              {lic.orgaoUf && <span>· {lic.orgaoCidade ? `${lic.orgaoCidade}/` : ""}{lic.orgaoUf}</span>}
              <span>· {MODALIDADE_LABEL[lic.modalidade]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {podeEditar ? (
              <Select value={lic.status} onValueChange={(v) => mudarStatus(v as StatusLicitacao)}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_LICITACAO.map((s) => <SelectItem key={s} value={s}>{STATUS_LICITACAO_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <StatusLicitacaoBadge status={lic.status} />
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportLicitacaoXlsx(lic)} title="Exportar para Excel">
              <Download className="size-3.5" /> Excel
            </Button>
            {podeEditar && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Editar</Button>}
            {podeEditar && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setExcluirLic(true)}><Trash2 className="size-4" /></Button>}
          </div>
        </div>

        {/* Dados do processo / contrato */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <Campo label="Nº do processo" valor={lic.numeroProcesso} />
            <Campo label="Nº do edital" valor={lic.numeroEdital} />
            <Campo label="Nº da ata" valor={lic.numeroAta} />
            <Campo label="Nº do contrato" valor={lic.numeroContrato} />
            <Campo label="Portal" valor={lic.portal} />
            <Campo label="Sessão / abertura" valor={dataHoraBR(lic.dataAbertura)} />
            <Campo label="Vigência início" valor={dataBR(lic.vigenciaInicio)} />
            <Campo label="Vigência fim" valor={dataBR(lic.vigenciaFim)} />
            <Campo label="Valor estimado" valor={lic.valorEstimado > 0 ? brl(lic.valorEstimado) : null} />
            <Campo label="Valor homologado" valor={lic.valorHomologado > 0 ? brl(lic.valorHomologado) : null} />
            {lic.cliente && <Campo label="Cliente vinculado" valor={lic.cliente.razaoSocial} />}
            {lic.linkEdital && (
              <div>
                <p className="text-[11px] text-muted-foreground">Edital</p>
                <a href={lic.linkEdital} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="size-3.5" /> Abrir
                </a>
              </div>
            )}
            {lic.observacoes && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-[11px] text-muted-foreground">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{lic.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentos do edital */}
        {lic.arquivos.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold flex items-center gap-2 mb-3">
                <FileText className="size-4 text-primary" /> Documentos do edital ({lic.arquivos.length})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {lic.arquivos.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <FileText className="size-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.tipo || "Documento"}{a.data ? ` · ${dataBR(a.data)}` : ""}
                      </p>
                    </div>
                    <Download className="size-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo financeiro (saldo) */}
        {temContrato && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResumoCard label="Valor contratado" valor={brl(r.valorContratado)} />
            <ResumoCard label="Faturado" valor={brl(r.valorFaturado)} tone="sky" />
            <ResumoCard label="Saldo a faturar" valor={brl(r.saldo)} tone="emerald" />
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-[13px] text-muted-foreground">Execução</p>
              <p className="text-2xl font-semibold mt-1">{r.percExecutado.toFixed(0)}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, r.percExecutado)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Itens */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2"><FileText className="size-4 text-primary" /> Itens ({lic.itens.length})</h3>
            </div>
            {lic.itens.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left p-2">Item</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-right p-2">Preço</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Faturado</th>
                      <th className="text-right p-2">Saldo</th>
                      <th className="text-right p-2 w-28">Execução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lic.itens.map((it) => (
                      <tr key={it.id} className="border-b border-border/40">
                        <td className="p-2">
                          <p className="font-medium leading-tight">{it.descricao}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {it.numeroItem ? `Item ${it.numeroItem} · ` : ""}{it.marca ? `${it.marca} · ` : ""}{it.unidade}
                            {it.produto ? ` · cód ${it.produto.codigo}` : ""}
                          </p>
                        </td>
                        <td className="p-2 text-right tabular-nums">{num(it.quantidade)}</td>
                        <td className="p-2 text-right tabular-nums">{brl(it.precoUnitario)}</td>
                        <td className="p-2 text-right tabular-nums">{brl(it.valorItem)}</td>
                        <td className="p-2 text-right tabular-nums text-sky-600">{num(it.faturadoQtd)}</td>
                        <td className={`p-2 text-right tabular-nums font-medium ${it.saldoQtd > 0.0001 ? "text-emerald-600" : "text-muted-foreground"}`}>{num(it.saldoQtd)}</td>
                        <td className="p-2">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, it.percExecutado)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Empenhos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2"><Receipt className="size-4 text-primary" /> Empenhos / Faturamento ({lic.empenhos.length})</h3>
              {podeFaturar && temContrato && (
                <Button size="sm" className="gap-1.5" onClick={() => { setEmpenhoEditId(null); setEmpenhoOpen(true) }}>
                  <Plus className="size-3.5" /> Novo empenho
                </Button>
              )}
            </div>
            {lic.empenhos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {temContrato ? "Nenhum empenho. Registre o primeiro faturamento." : "Disponível quando a licitação virar contrato/ata."}
              </p>
            ) : (
              <div className="grid gap-2">
                {lic.empenhos.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-sm">{e.numero}</span>
                        <StatusEmpenhoBadge status={e.status} />
                        {e.numeroNotaFiscal && <span className="text-[11px] text-muted-foreground">NF {e.numeroNotaFiscal}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {e.dataEmpenho && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> {dataBR(e.dataEmpenho)}</span>}
                        <span>{e.qtdItens} item(ns)</span>
                        {e.prazoEntrega && <span>entrega até {dataBR(e.prazoEntrega)}</span>}
                      </p>
                    </div>
                    <span className="font-semibold text-sm">{brl(e.valorTotal)}</span>
                    {podeFaturar && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => { setEmpenhoEditId(e.id); setEmpenhoOpen(true) }}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => setExcluirEmp(e.id)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LicitacaoFormDialog open={editOpen} onOpenChange={setEditOpen} licitacaoId={id} onSaved={load} />
      <EmpenhoFormDialog open={empenhoOpen} onOpenChange={setEmpenhoOpen} licitacaoId={id} empenhoId={empenhoEditId} onSaved={load} />

      <AlertDialog open={excluirLic} onOpenChange={(o) => !o && setExcluirLic(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir licitação?</AlertDialogTitle>
            <AlertDialogDescription>Remove a licitação, seus itens e empenhos. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!excluirEmp} onOpenChange={(o) => !o && setExcluirEmp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empenho?</AlertDialogTitle>
            <AlertDialogDescription>O saldo do contrato será devolvido. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluirEmpenho} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}

function Campo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{valor || "—"}</p>
    </div>
  )
}

function ResumoCard({ label, valor, tone }: { label: string; valor: string; tone?: "sky" | "emerald" }) {
  const cls = tone === "sky" ? "bg-sky-500/5 text-sky-600" : tone === "emerald" ? "bg-emerald-500/5 text-emerald-600" : "bg-muted/40"
  return (
    <div className={`rounded-lg p-4 ${cls}`}>
      <p className="text-[13px] opacity-80">{label}</p>
      <p className="text-2xl font-semibold mt-1">{valor}</p>
    </div>
  )
}
