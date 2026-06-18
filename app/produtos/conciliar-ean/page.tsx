"use client"

import { useState, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Barcode,
  Search,
  Loader2,
  ShieldAlert,
  Check,
  ArrowRight,
  Pill,
  Info,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  conciliarEanCatalogo,
  atualizarEanProduto,
  type ProdutoConciliacao,
} from "@/lib/actions/conciliacao-ean"

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function ConciliarEanPage() {
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("estoque", "edit")

  const [termo, setTermo] = useState("")
  const [soSemEan, setSoSemEan] = useState(false)
  const [loading, setLoading] = useState(false)
  const [linhas, setLinhas] = useState<ProdutoConciliacao[] | null>(null)
  const [aplicando, setAplicando] = useState<number | null>(null)

  const buscar = useCallback(async () => {
    setLoading(true)
    try {
      setLinhas(await conciliarEanCatalogo({ termo: termo || undefined, somenteSemEan: soSemEan }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [termo, soSemEan])

  const aplicar = async (produtoId: number, ean: string, pmvg: number, produtoNome: string) => {
    setAplicando(produtoId)
    try {
      await atualizarEanProduto({ produtoId, ean, pmvg })
      setLinhas((prev) =>
        prev ? prev.map((l) => (l.id === produtoId ? { ...l, eanAtual: ean.replace(/\D/g, ""), pmvgAtual: pmvg } : l)) : prev
      )
      toast.success("EAN atualizado", { description: produtoNome })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar.")
    } finally {
      setAplicando(null)
    }
  }

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("estoque")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" /> Sem acesso ao catálogo.
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Barcode className="size-6 text-primary" /> Conciliação de EAN (CMED)
          </h1>
          <p className="text-sm text-muted-foreground">Encontre o EAN atual dos seus produtos na base CMED e atualize o cadastro.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto do catálogo (nome, código, EAN)..."
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              className="pl-9 h-9"
            />
          </div>
          <button
            onClick={() => setSoSemEan((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${soSemEan ? "border-amber-400 bg-amber-500/10 text-amber-600 font-medium" : "border-border hover:bg-muted text-muted-foreground"}`}
          >
            Só sem EAN
          </button>
          <Button onClick={buscar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : linhas === null ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
            Busque um produto para ver as sugestões da CMED.
          </CardContent></Card>
        ) : linhas.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Nenhum produto encontrado.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {linhas.map((l) => (
              <Card key={l.id} className="border-border/60">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium">{l.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{l.codigo}</span> · EAN atual:{" "}
                        {l.eanAtual ? <span className="font-mono">{l.eanAtual}</span> : <span className="text-amber-600">— sem EAN —</span>}
                        {l.pmvgAtual != null && ` · PMVG ${brl(l.pmvgAtual)}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 border-t pt-2 space-y-1.5">
                    {l.sugestoes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem correspondência na CMED para este produto.</p>
                    ) : (
                      l.sugestoes.filter((s) => s.ean).map((s) => {
                        const igual = s.ean && l.eanAtual && s.ean === l.eanAtual.replace(/\D/g, "")
                        return (
                          <div key={s.id} className="flex items-center gap-3 text-sm rounded-md bg-muted/30 px-2.5 py-1.5">
                            <Pill className="size-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="leading-tight truncate">{s.produto}</p>
                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-mono">{s.ean}</span> · {[s.apresentacao, s.laboratorio].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <span className="text-xs text-emerald-600 font-medium shrink-0">PMVG {brl(s.pmvg)}</span>
                            {igual ? (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 shrink-0"><Check className="size-3 mr-1" /> já atual</Badge>
                            ) : podeEditar ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 shrink-0 h-7"
                                disabled={aplicando === l.id}
                                onClick={() => aplicar(l.id, s.ean!, s.pmvg, l.nome)}
                              >
                                {aplicando === l.id ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />} Aplicar
                              </Button>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="size-3.5" /> As sugestões vêm da base CMED. Mantenha-a atualizada em{" "}
          <Link href="/licitacoes/consultas" className="text-primary hover:underline">Consultas → CMED/PMVG</Link>.
        </p>
      </div>
    </AppShell>
  )
}
