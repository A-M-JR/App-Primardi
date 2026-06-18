"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Megaphone, Plus, Search, Loader2, ShieldAlert, Tag, ChevronRight, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getPromocoes } from "@/lib/actions/promocoes"
import { PromocaoFormDialog } from "@/components/promocoes/promocao-form-dialog"
import type { StatusPromocao } from "@prisma/client"

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")

const STATUS_META: Record<StatusPromocao, { label: string; cor: string }> = {
  RASCUNHO: { label: "Rascunho", cor: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" },
  ATIVA: { label: "Ativa", cor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  ENCERRADA: { label: "Encerrada", cor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
}

type Lista = Awaited<ReturnType<typeof getPromocoes>>

export default function PromocoesPage() {
  const router = useRouter()
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("promocoes", "edit")

  const [dados, setDados] = useState<Lista>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDados(await getPromocoes({ search: search || undefined }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (!authLoading && can("promocoes")) {
      const t = setTimeout(load, 250)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, load])

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("promocoes")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso ao módulo de Promoções.
        </div>
      </AppShell>
    )
  }

  const ativas = dados.filter((p) => p.status === "ATIVA").length

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="size-6 text-primary" /> Promoções
            </h1>
            <p className="text-sm text-muted-foreground">Monte campanhas, sugira itens e envie pelo WhatsApp.</p>
          </div>
          {podeEditar && (
            <Button onClick={() => { setEditId(null); setFormOpen(true) }} className="gap-2">
              <Plus className="size-4" /> Nova promoção
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/40 p-4"><p className="text-[13px] text-muted-foreground">Campanhas</p><p className="text-2xl font-semibold mt-1">{dados.length}</p></div>
          <div className="rounded-lg bg-emerald-500/5 p-4"><p className="text-[13px] text-emerald-600">Ativas</p><p className="text-2xl font-semibold mt-1 text-emerald-600">{ativas}</p></div>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Buscar promoção..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : dados.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma promoção. {podeEditar && "Crie a primeira e use 'Sugerir 10 itens'."}
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {dados.map((p) => (
              <Card key={p.id} className="border-border/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push(`/promocoes/${p.id}`)}>
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.titulo}</span>
                      <Badge variant="outline" className={`${STATUS_META[p.status].cor} text-[10px]`}>{STATUS_META[p.status].label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <Tag className="size-3" /> {p.qtdItens} item(ns)
                      {p.fim && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> até {dataBR(p.fim)}</span>}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PromocaoFormDialog open={formOpen} onOpenChange={setFormOpen} promocaoId={editId} onSaved={load} />
    </AppShell>
  )
}
