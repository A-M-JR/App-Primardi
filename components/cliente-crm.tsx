"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Phone,
  MapPin,
  Mail,
  MessageSquare,
  Users,
  FileText,
  StickyNote,
  Circle,
  CalendarClock,
  Check,
  Loader2,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import {
  getClienteCrm,
  registrarAtividade,
  concluirAtividade,
  atualizarCrmCliente,
  type AtividadeCliente,
} from "@/lib/actions/clientes-crm"
import type { TipoAtividadeCliente } from "@prisma/client"

const TIPOS: { value: TipoAtividadeCliente; label: string; icon: typeof Phone }[] = [
  { value: "LIGACAO", label: "Ligação", icon: Phone },
  { value: "VISITA", label: "Visita", icon: MapPin },
  { value: "EMAIL", label: "E-mail", icon: Mail },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
  { value: "REUNIAO", label: "Reunião", icon: Users },
  { value: "PROPOSTA", label: "Proposta", icon: FileText },
  { value: "NOTA", label: "Nota", icon: StickyNote },
  { value: "OUTRO", label: "Outro", icon: Circle },
]
const tipoInfo = (t: TipoAtividadeCliente) => TIPOS.find((x) => x.value === t) ?? TIPOS[7]

const TEMPERATURAS = [
  { value: "Frio", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  { value: "Morno", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  { value: "Quente", cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
]

interface CrmData {
  temperatura: string | null
  funilStatusId: number | null
  proximoContato: string | null
  atividades: AtividadeCliente[]
  funis: { id: number; nome: string; cor: string }[]
}

export function ClienteCrm({ clienteId }: { clienteId: number }) {
  const [data, setData] = useState<CrmData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<TipoAtividadeCliente>("LIGACAO")
  const [descricao, setDescricao] = useState("")
  const [proximo, setProximo] = useState("")
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    try {
      setData((await getClienteCrm(clienteId)) as CrmData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar CRM.")
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    load()
  }, [load])

  async function registrar() {
    if (!descricao.trim()) {
      toast.error("Descreva a atividade.")
      return
    }
    setSalvando(true)
    try {
      await registrarAtividade({ clienteId, tipo, descricao, proximoContato: proximo || null })
      setDescricao("")
      setProximo("")
      toast.success("Atividade registrada.")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar.")
    } finally {
      setSalvando(false)
    }
  }

  async function concluir(id: number) {
    await concluirAtividade(id)
    await load()
  }

  async function mudarTemperatura(v: string) {
    setData((d) => (d ? { ...d, temperatura: v } : d))
    await atualizarCrmCliente(clienteId, { temperatura: v })
  }

  async function mudarFunil(v: string) {
    const id = Number(v)
    setData((d) => (d ? { ...d, funilStatusId: id } : d))
    await atualizarCrmCliente(clienteId, { funilStatusId: id })
  }

  if (loading || !data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const proxVencido = data.proximoContato && new Date(data.proximoContato) < new Date(new Date().toDateString())

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Coluna esquerda: funil + nova atividade */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Funil</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Etapa</Label>
              <Select value={data.funilStatusId ? String(data.funilStatusId) : ""} onValueChange={mudarFunil}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sem etapa" /></SelectTrigger>
                <SelectContent>
                  {data.funis.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: f.cor }} /> {f.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temperatura</Label>
              <div className="flex gap-2">
                {TEMPERATURAS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => mudarTemperatura(t.value)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      data.temperatura === t.value ? t.cls + " border-current" : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t.value}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border p-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="size-3.5" /> Próximo retorno:
              </span>{" "}
              {data.proximoContato ? (
                <span className={proxVencido ? "font-semibold text-destructive" : "font-medium"}>
                  {new Date(data.proximoContato).toLocaleDateString("pt-BR")}
                  {proxVencido && " (vencido)"}
                </span>
              ) : (
                <span className="text-muted-foreground">não agendado</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Nova atividade</p>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAtividadeCliente)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <t.icon className="size-3.5" /> {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="O que foi tratado?"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Próximo retorno (opcional)</Label>
              <Input type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} className="h-9" />
            </div>
            <Button onClick={registrar} disabled={salvando} className="w-full gap-2">
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Registrar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita: linha do tempo */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Linha do tempo</p>
            {data.atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma atividade registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.atividades.map((a) => {
                  const info = tipoInfo(a.tipo)
                  const Icon = info.icon
                  const venc = a.proximoContato && !a.concluida && new Date(a.proximoContato) < new Date(new Date().toDateString())
                  return (
                    <div
                      key={a.id}
                      className={`flex gap-3 rounded-lg border p-3 ${a.concluida ? "opacity-60" : ""}`}
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{info.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.criadoEm).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {a.responsavel && <span className="text-xs text-muted-foreground">· {a.responsavel}</span>}
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{a.descricao}</p>
                        {a.proximoContato && (
                          <Badge
                            variant="outline"
                            className={`mt-1.5 text-[11px] ${venc ? "border-destructive text-destructive" : ""}`}
                          >
                            <CalendarClock className="size-3 mr-1" />
                            Retorno: {new Date(a.proximoContato).toLocaleDateString("pt-BR")}
                            {venc && " (vencido)"}
                          </Badge>
                        )}
                      </div>
                      {!a.concluida && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 gap-1 text-muted-foreground hover:text-emerald-600"
                          onClick={() => concluir(a.id)}
                          title="Concluir"
                        >
                          <Check className="size-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
