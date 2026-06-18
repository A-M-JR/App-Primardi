"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2, CalendarClock, Gavel, CalendarX2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCronograma, type EventoCronograma } from "@/lib/actions/licitacoes"
import { STATUS_LICITACAO_META, MODALIDADE_LABEL } from "@/lib/licitacoes/constants"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export function CronogramaCalendar() {
  const router = useRouter()
  const hoje = useMemo(() => new Date(), [])
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [eventos, setEventos] = useState<EventoCronograma[]>([])
  const [loading, setLoading] = useState(true)

  const ano = ref.getFullYear()
  const mes = ref.getMonth()

  useEffect(() => {
    let ativo = true
    setLoading(true)
    const inicio = new Date(ano, mes, 1, 0, 0, 0)
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59)
    getCronograma(inicio.toISOString(), fim.toISOString())
      .then((evs) => ativo && setEventos(evs))
      .catch(() => ativo && setEventos([]))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [ano, mes])

  // Agrupa eventos por dia (YYYY-MM-DD)
  const porDia = useMemo(() => {
    const map: Record<string, EventoCronograma[]> = {}
    for (const e of eventos) {
      const k = ymd(new Date(e.data))
      ;(map[k] ||= []).push(e)
    }
    return map
  }, [eventos])

  // Grade do mês (começa no domingo)
  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes, 1)
    const inicioGrade = new Date(primeiro)
    inicioGrade.setDate(1 - primeiro.getDay())
    const dias: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicioGrade)
      d.setDate(inicioGrade.getDate() + i)
      dias.push(d)
    }
    return dias
  }, [ano, mes])

  const hojeKey = ymd(hoje)
  const eventosOrdenados = [...eventos].sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold capitalize flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" />
              {MESES[mes]} {ano}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setRef(new Date(ano, mes - 1, 1))} className="px-2">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRef(new Date(ano, mes + 1, 1))} className="px-2">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {DIAS.map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-1">{d}</div>
              ))}
              {celulas.map((d, i) => {
                const k = ymd(d)
                const doMes = d.getMonth() === mes
                const evs = porDia[k] || []
                const isHoje = k === hojeKey
                return (
                  <div
                    key={i}
                    className={`min-h-[88px] rounded-md border p-1 text-left transition-colors ${
                      doMes ? "bg-card" : "bg-muted/30 text-muted-foreground/50"
                    } ${isHoje ? "ring-2 ring-primary/50 border-primary/40" : "border-border/60"}`}
                  >
                    <div className={`text-[11px] font-semibold mb-1 ${isHoje ? "text-primary" : ""}`}>{d.getDate()}</div>
                    <div className="space-y-0.5">
                      {evs.slice(0, 3).map((e) => {
                        const meta = STATUS_LICITACAO_META[e.status]
                        return (
                          <button
                            key={e.id}
                            onClick={() => router.push(`/licitacoes/${e.licitacaoId}`)}
                            title={`${e.tipo === "abertura" ? "Sessão" : "Fim de vigência"} · ${e.orgao} — ${e.titulo}`}
                            className={`w-full truncate rounded px-1 py-0.5 text-[10px] text-left flex items-center gap-1 ${meta.cor} hover:brightness-95`}
                          >
                            {e.tipo === "abertura" ? <Gavel className="size-2.5 shrink-0" /> : <CalendarX2 className="size-2.5 shrink-0" />}
                            <span className="truncate">
                              {e.tipo === "abertura" ? horaBR(e.data) : "vence"} {e.orgao}
                            </span>
                          </button>
                        )
                      })}
                      {evs.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{evs.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Gavel className="size-3" /> Sessão / disputa</span>
            <span className="inline-flex items-center gap-1"><CalendarX2 className="size-3" /> Fim de vigência</span>
          </div>
        </CardContent>
      </Card>

      {/* Lista do mês */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-bold mb-3">Eventos de {MESES[mes]}</h4>
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : eventosOrdenados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhum evento neste mês.</p>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {eventosOrdenados.map((e) => {
                const meta = STATUS_LICITACAO_META[e.status]
                const d = new Date(e.data)
                return (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/licitacoes/${e.licitacaoId}`)}
                    className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`size-2 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-bold">
                        {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {e.tipo === "abertura" ? ` · ${horaBR(e.data)}` : " · vigência"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{MODALIDADE_LABEL[e.modalidade]}</span>
                    </div>
                    <p className="text-xs font-medium truncate">{e.orgao}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{e.titulo}</p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
