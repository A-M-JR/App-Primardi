"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarClock,
  Phone,
  MapPin,
  Mail,
  MessageSquare,
  Users,
  FileText,
  StickyNote,
  Circle,
  Check,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getAgendaRetornos, concluirAtividade, type RetornoAgenda } from "@/lib/actions/clientes-crm"
import type { TipoAtividadeCliente } from "@prisma/client"

const ICON: Record<TipoAtividadeCliente, typeof Phone> = {
  LIGACAO: Phone,
  VISITA: MapPin,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  REUNIAO: Users,
  PROPOSTA: FileText,
  NOTA: StickyNote,
  OUTRO: Circle,
}

const tempCls: Record<string, string> = {
  Frio: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Morno: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Quente: "bg-red-500/10 text-red-700 dark:text-red-400",
}

function diaSemHora(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function AgendaPage() {
  const { can, isLoading: authLoading } = useAuth()
  const [itens, setItens] = useState<RetornoAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [concluindo, setConcluindo] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItens(await getAgendaRetornos())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (can("crm")) load()
  }, [can, load])

  const grupos = useMemo(() => {
    const hoje = diaSemHora(new Date())
    const vencidos: RetornoAgenda[] = []
    const doDia: RetornoAgenda[] = []
    const proximos: RetornoAgenda[] = []
    for (const it of itens) {
      const d = diaSemHora(new Date(it.proximoContato))
      if (d < hoje) vencidos.push(it)
      else if (d.getTime() === hoje.getTime()) doDia.push(it)
      else proximos.push(it)
    }
    return { vencidos, doDia, proximos }
  }, [itens])

  async function concluir(id: number) {
    setConcluindo(id)
    try {
      await concluirAtividade(id)
      setItens((prev) => prev.filter((i) => i.atividadeId !== id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setConcluindo(null)
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!can("crm")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" />
          Sem acesso ao módulo CRM.
        </div>
      </AppShell>
    )
  }

  const Secao = ({ titulo, cor, lista }: { titulo: string; cor: string; lista: RetornoAgenda[] }) => {
    if (lista.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${cor}`} />
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <Badge variant="secondary" className="tabular-nums">{lista.length}</Badge>
        </div>
        <div className="grid gap-2">
          {lista.map((it) => {
            const Icon = ICON[it.tipo] ?? Circle
            return (
              <Card key={it.atividadeId} className="border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{it.cliente.razaoSocial}</span>
                      {it.cliente.temperatura && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tempCls[it.cliente.temperatura] ?? ""}`}>
                          {it.cliente.temperatura}
                        </span>
                      )}
                      {it.cliente.etapa && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{ borderColor: it.cliente.etapaCor ?? undefined, color: it.cliente.etapaCor ?? undefined }}
                        >
                          {it.cliente.etapa}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{it.descricao}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {new Date(it.proximoContato).toLocaleDateString("pt-BR")}
                      {it.cliente.telefone && ` · ${it.cliente.telefone}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" asChild className="gap-1">
                      <Link href={`/clientes/${it.cliente.id}?tab=crm`}>
                        Abrir <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-emerald-600"
                      disabled={concluindo === it.atividadeId}
                      onClick={() => concluir(it.atividadeId)}
                      title="Concluir"
                    >
                      {concluindo === it.atividadeId ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="size-6 text-primary" /> Agenda de retornos
          </h1>
          <p className="text-sm text-muted-foreground">Follow-ups agendados com clientes — comece pelos vencidos.</p>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : itens.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum retorno agendado. Agende follow-ups na aba CRM dos clientes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Secao titulo="Vencidos" cor="bg-destructive" lista={grupos.vencidos} />
            <Secao titulo="Hoje" cor="bg-amber-500" lista={grupos.doDia} />
            <Secao titulo="Próximos" cor="bg-emerald-500" lista={grupos.proximos} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
