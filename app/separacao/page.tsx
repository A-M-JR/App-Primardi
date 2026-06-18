"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PackageSearch, Loader2, ArrowRight, ShieldAlert, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getFilaSeparacao, type ItemSeparacao } from "@/lib/actions/pedidos"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export default function SeparacaoPage() {
  const { can, isLoading: authLoading } = useAuth()
  const [itens, setItens] = useState<ItemSeparacao[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItens(await getFilaSeparacao())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar fila.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (can("estoque")) load()
  }, [can, load])

  const grupos = useMemo(() => {
    const hoje = dia(new Date())
    const atrasados: ItemSeparacao[] = []
    const doDia: ItemSeparacao[] = []
    const proximos: ItemSeparacao[] = []
    const semPrazo: ItemSeparacao[] = []
    for (const it of itens) {
      if (!it.prazoEntrega) { semPrazo.push(it); continue }
      const d = dia(new Date(it.prazoEntrega))
      if (d < hoje) atrasados.push(it)
      else if (d.getTime() === hoje.getTime()) doDia.push(it)
      else proximos.push(it)
    }
    return { atrasados, doDia, proximos, semPrazo }
  }, [itens])

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!can("estoque")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" />
          Sem acesso ao módulo de Estoque.
        </div>
      </AppShell>
    )
  }

  const Secao = ({ titulo, cor, lista }: { titulo: string; cor: string; lista: ItemSeparacao[] }) => {
    if (lista.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${cor}`} />
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <Badge variant="secondary" className="tabular-nums">{lista.length}</Badge>
        </div>
        <div className="grid gap-2">
          {lista.map((it) => (
            <Card key={it.id} className="border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{it.numero}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{ borderColor: it.statusCor ?? undefined, color: it.statusCor ?? undefined }}
                    >
                      {it.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{it.itens} item(ns)</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{it.cliente}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                    <CalendarClock className="size-3" />
                    {it.prazoEntrega ? new Date(it.prazoEntrega).toLocaleDateString("pt-BR") : "sem prazo"}
                    {" · "}{brl(it.totalGeral)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="gap-1 shrink-0">
                  <Link href={`/pedidos/${it.id}`}>Abrir <ArrowRight className="size-3.5" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackageSearch className="size-6 text-primary" /> Separação / Expedição
          </h1>
          <p className="text-sm text-muted-foreground">Pedidos em aberto priorizados pelo prazo de entrega.</p>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : itens.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum pedido pendente de separação.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Secao titulo="Atrasados" cor="bg-destructive" lista={grupos.atrasados} />
            <Secao titulo="Hoje" cor="bg-amber-500" lista={grupos.doDia} />
            <Secao titulo="Próximos" cor="bg-emerald-500" lista={grupos.proximos} />
            <Secao titulo="Sem prazo" cor="bg-muted-foreground" lista={grupos.semPrazo} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
