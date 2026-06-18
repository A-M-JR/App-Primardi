"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Headphones, Plus, Search, Loader2, ShieldAlert, ChevronRight, Building2, MessageSquare, Code2,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getChamados, type ChamadoFiltros } from "@/lib/actions/chamados"
import { getDepartamentosAtivos } from "@/lib/actions/departamentos"
import { STATUS_CHAMADO, STATUS_CHAMADO_META, PRIORIDADE_META } from "@/lib/chamados/constants"
import { ChamadoFormDialog } from "@/components/chamados/chamado-form-dialog"
import type { ChamadoStatus } from "@prisma/client"

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")
type Lista = Awaited<ReturnType<typeof getChamados>>

export default function ChamadosPage() {
  const router = useRouter()
  const { can, isLoading: authLoading } = useAuth()

  const [dados, setDados] = useState<Lista | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("abertos")
  const [departamentoId, setDepartamentoId] = useState("todos")
  const [departamentos, setDepartamentos] = useState<{ id: number; nome: string }[]>([])
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filtros: ChamadoFiltros = {
        search: search || undefined,
        status: status as ChamadoFiltros["status"],
        departamentoId: departamentoId !== "todos" ? Number(departamentoId) : undefined,
      }
      setDados(await getChamados(filtros))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [search, status, departamentoId])

  useEffect(() => {
    if (!authLoading && can("chamados")) {
      getDepartamentosAtivos().then(setDepartamentos).catch(() => {})
      const t = setTimeout(load, 250)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, load])

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("chamados")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso ao módulo de Chamados.
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
              <Headphones className="size-6 text-primary" /> Chamados
            </h1>
            <p className="text-sm text-muted-foreground">Abertura e acompanhamento de chamados internos e à plataforma.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="size-4" /> Abrir chamado</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/40 p-4"><p className="text-[13px] text-muted-foreground">Total</p><p className="text-2xl font-semibold mt-1">{k?.total ?? 0}</p></div>
          <div className="rounded-lg bg-amber-500/5 p-4"><p className="text-[13px] text-amber-600">Abertos</p><p className="text-2xl font-semibold mt-1 text-amber-600">{k?.abertos ?? 0}</p></div>
          <div className="rounded-lg bg-emerald-500/5 p-4"><p className="text-[13px] text-emerald-600">Resolvidos</p><p className="text-2xl font-semibold mt-1 text-emerald-600">{k?.resolvidos ?? 0}</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Buscar nº ou título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abertos">Abertos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS_CHAMADO.map((s) => <SelectItem key={s} value={s}>{STATUS_CHAMADO_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departamentoId} onValueChange={setDepartamentoId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos departamentos</SelectItem>
              {departamentos.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : !dados || dados.data.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum chamado encontrado.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {dados.data.map((c) => {
              const meta = STATUS_CHAMADO_META[c.status]
              const prio = PRIORIDADE_META[c.prioridade]
              return (
                <Card key={c.id} className="border-border/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push(`/chamados/${c.id}`)}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{c.numero}</span>
                        <span className="font-medium">{c.titulo}</span>
                        <Badge variant="outline" className={`${meta.cor} text-[10px]`}><span className={`mr-1 inline-block size-1.5 rounded-full ${meta.dot}`} />{meta.label}</Badge>
                        <Badge variant="outline" className={`${prio.cor} text-[10px]`}>{prio.label}</Badge>
                        {c.destino === "DESENVOLVEDOR" && <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-500/20"><Code2 className="size-3 mr-1" /> Devs</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {c.departamento && <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> {c.departamento}</span>}
                        <span>por {c.solicitante}</span>
                        {c.responsavel && <span>· resp. {c.responsavel}</span>}
                        {c.qtdMensagens > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {c.qtdMensagens}</span>}
                        <span>· {dataBR(c.criadoEm)}</span>
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ChamadoFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={(id) => (id ? router.push(`/chamados/${id}`) : load())} />
    </AppShell>
  )
}
