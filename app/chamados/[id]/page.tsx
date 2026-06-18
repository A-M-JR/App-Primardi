"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Headphones, ArrowLeft, Loader2, ShieldAlert, Building2, Send, Code2, Lock, CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  getChamado, atualizarChamado, adicionarMensagem, enviarChamadoDev,
} from "@/lib/actions/chamados"
import { getUsuariosDaEmpresa, getDepartamentosAtivos } from "@/lib/actions/departamentos"
import { STATUS_CHAMADO, STATUS_CHAMADO_META, PRIORIDADES, PRIORIDADE_META } from "@/lib/chamados/constants"
import type { ChamadoStatus, ChamadoPrioridade } from "@prisma/client"

const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—")
type Detalhe = Awaited<ReturnType<typeof getChamado>>

export default function ChamadoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("chamados", "edit")

  const [c, setC] = useState<Detalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<{ id: number; nome: string }[]>([])
  const [departamentos, setDepartamentos] = useState<{ id: number; nome: string }[]>([])
  const [novaMsg, setNovaMsg] = useState("")
  const [interno, setInterno] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [despachando, setDespachando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setC(await getChamado(id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    if (!authLoading && can("chamados") && id) {
      load()
      if (can("chamados", "edit")) {
        getUsuariosDaEmpresa().then(setUsuarios).catch(() => {})
        getDepartamentosAtivos().then(setDepartamentos).catch(() => {})
      }
    }
  }, [authLoading, can, id, load])

  const patch = async (p: Parameters<typeof atualizarChamado>[1]) => {
    try { await atualizarChamado(id, p); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
  }

  const enviarMsg = async () => {
    if (!novaMsg.trim()) return
    setEnviando(true)
    try {
      await adicionarMensagem(id, novaMsg, interno)
      setNovaMsg(""); setInterno(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally { setEnviando(false) }
  }

  const despacharDev = async () => {
    setDespachando(true)
    try {
      const r = await enviarChamadoDev(id)
      if (r.ok) { toast.success(r.mensagem); load() }
      else toast.error(r.mensagem)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally { setDespachando(false) }
  }

  if (authLoading || loading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("chamados")) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground"><ShieldAlert className="size-10 text-destructive/70" /> Sem acesso.</div></AppShell>
  }
  if (!c) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground">Chamado não encontrado.<Button variant="outline" onClick={() => router.push("/chamados")}>Voltar</Button></div></AppShell>
  }

  const meta = STATUS_CHAMADO_META[c.status]

  return (
    <AppShell>
      <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
        <div>
          <button onClick={() => router.push("/chamados")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3.5" /> Chamados
          </button>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Headphones className="size-5 text-primary shrink-0" />
            <span className="font-mono text-sm text-muted-foreground">{c.numero}</span> {c.titulo}
          </h1>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-4">
          {/* Conversa */}
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Aberto por {c.solicitante} · {dataHora(c.criadoEm)}</p>
                <p className="text-sm whitespace-pre-wrap">{c.descricao}</p>
              </CardContent>
            </Card>

            {c.mensagens.map((m) => (
              <Card key={m.id} className={m.interno ? "border-amber-500/30 bg-amber-500/5" : "border-border/60"}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <span className="font-medium">{m.autor}</span>
                    {m.ehSolicitante && <Badge variant="outline" className="text-[10px]">solicitante</Badge>}
                    {m.interno && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30"><Lock className="size-2.5 mr-1" /> nota interna</Badge>}
                    <span className="text-muted-foreground ml-auto">{dataHora(m.criadoEm)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.mensagem}</p>
                </CardContent>
              </Card>
            ))}

            {/* Nova mensagem */}
            {meta.aberto ? (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <Textarea value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} rows={3} placeholder="Escreva uma resposta..." />
                  <div className="flex items-center justify-between gap-2">
                    {podeEditar ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} /> Nota interna (não visível ao solicitante)
                      </label>
                    ) : <span />}
                    <Button size="sm" className="gap-1.5" onClick={enviarMsg} disabled={enviando || !novaMsg.trim()}>
                      {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2 inline-flex items-center justify-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" /> Chamado {meta.label.toLowerCase()}.
              </p>
            )}
          </div>

          {/* Painel lateral */}
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 space-y-3 text-sm">
                <Campo label="Status">
                  {podeEditar ? (
                    <Select value={c.status} onValueChange={(v) => patch({ status: v as ChamadoStatus })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_CHAMADO.map((s) => <SelectItem key={s} value={s}>{STATUS_CHAMADO_META[s].label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <Badge variant="outline" className={meta.cor}>{meta.label}</Badge>}
                </Campo>
                <Campo label="Prioridade">
                  {podeEditar ? (
                    <Select value={c.prioridade} onValueChange={(v) => patch({ prioridade: v as ChamadoPrioridade })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{PRIORIDADE_META[p].label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <Badge variant="outline" className={PRIORIDADE_META[c.prioridade].cor}>{PRIORIDADE_META[c.prioridade].label}</Badge>}
                </Campo>
                <Campo label="Responsável">
                  {podeEditar ? (
                    <Select value={c.responsavelUserId ? String(c.responsavelUserId) : "none"} onValueChange={(v) => patch({ responsavelUserId: v === "none" ? null : Number(v) })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— ninguém —</SelectItem>
                        {usuarios.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <span className="text-muted-foreground">{c.responsavel ?? "—"}</span>}
                </Campo>
                <Campo label="Departamento">
                  {podeEditar ? (
                    <Select value={c.departamentoId ? String(c.departamentoId) : "none"} onValueChange={(v) => patch({ departamentoId: v === "none" ? null : Number(v) })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— sem —</SelectItem>
                        {departamentos.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <span className="text-muted-foreground inline-flex items-center gap-1"><Building2 className="size-3.5" /> {c.departamento?.nome ?? "—"}</span>}
                </Campo>
              </CardContent>
            </Card>

            {/* Desenvolvedores da plataforma */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Code2 className="size-3.5" /> Desenvolvedores</p>
                {c.enviadoExternoEm ? (
                  <p className="text-xs text-emerald-600">
                    Enviado em {dataHora(c.enviadoExternoEm)}{c.refExterna ? ` · ref ${c.refExterna}` : ""}.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Encaminhe este chamado aos desenvolvedores da plataforma (via endpoint).</p>
                )}
                {podeEditar && (
                  <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={despacharDev} disabled={despachando}>
                    {despachando ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Enviar aos desenvolvedores
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
