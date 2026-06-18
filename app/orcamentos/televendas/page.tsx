"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ClipboardPaste, Search, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Wallet, Package } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { getClientes } from "@/lib/actions/clientes"
import { matchListaTelevendas, precosParaCliente, type LinhaLista, type ProdutoMatch } from "@/lib/actions/televendas"
import { ProdutoCombobox } from "@/components/produto-combobox"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const EXEMPLO = `10 dipirona 500mg\n5cx amoxicilina 875\n2 soro fisiologico 500ml`

export default function TelevendasPage() {
  const router = useRouter()
  const { can, isLoading: authLoading } = useAuth()
  const [texto, setTexto] = useState("")
  const [linhas, setLinhas] = useState<LinhaLista[]>([])
  const [processando, setProcessando] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteId, setClienteId] = useState<number | "">("")
  const [precosMap, setPrecosMap] = useState<Record<number, number>>({})
  const [filtro, setFiltro] = useState<"todos" | "tem" | "alerta" | "nao">("todos")
  const [searchMode, setSearchMode] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!can("comercial")) return
    getClientes({ limit: 100, mode: "full" }).then((r: any) => setClientes(r.data || []))
  }, [can])

  const cliente = clientes.find((c) => c.id === clienteId)

  // IDs de todos os candidatos visíveis — recalcula preço de preferência por cliente.
  const candidateIds = useMemo(() => {
    const s = new Set<number>()
    linhas.forEach((l) => l.candidatos.forEach((c) => s.add(c.id)))
    return [...s]
  }, [linhas])
  const idsKey = candidateIds.join(",")

  useEffect(() => {
    if (!clienteId || candidateIds.length === 0) {
      setPrecosMap({})
      return
    }
    precosParaCliente(Number(clienteId), candidateIds)
      .then(setPrecosMap)
      .catch(() => setPrecosMap({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, idsKey])

  const precoDe = (c: { id: number; precoBase: number }) => precosMap[c.id] ?? c.precoBase

  // Categoriza cada linha: tem (ok c/ estoque) · alerta (ambíguo ou sem estoque) · nao (não achou)
  function categoria(l: LinhaLista): "tem" | "alerta" | "nao" {
    if (!l.produtoId) return "nao"
    if (l.status === "ambiguo") return "alerta"
    const sel = l.candidatos.find((c) => c.id === l.produtoId)
    if (!sel || (sel.estoque ?? 0) <= 0) return "alerta"
    return "tem"
  }

  const contagem = useMemo(() => {
    const c = { tem: 0, alerta: 0, nao: 0 }
    linhas.forEach((l) => {
      c[categoria(l)]++
    })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, precosMap])

  const linhasVisiveis = filtro === "todos" ? linhas : linhas.filter((l) => categoria(l) === filtro)

  function toggleSearch(linha: number) {
    setSearchMode((prev) => {
      const n = new Set(prev)
      n.add(linha)
      return n
    })
  }

  async function processar() {
    if (!texto.trim()) {
      toast.error("Cole a lista de produtos primeiro.")
      return
    }
    setProcessando(true)
    try {
      const res = await matchListaTelevendas(texto)
      setLinhas(res)
      const ok = res.filter((l) => l.produtoId).length
      toast.success(`${ok}/${res.length} linha(s) casada(s).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar.")
    } finally {
      setProcessando(false)
    }
  }

  function setLinha(linha: number, patch: Partial<LinhaLista>) {
    setLinhas((prev) => prev.map((l) => (l.linha === linha ? { ...l, ...patch } : l)))
  }

  // Resolve uma linha com o produto escolhido no combobox (busca no sistema).
  function resolverLinha(linha: number, p: ProdutoMatch) {
    setLinha(linha, { candidatos: [p], produtoId: p.id, status: "ok" })
    setSearchMode((prev) => {
      const n = new Set(prev)
      n.delete(linha)
      return n
    })
  }

  function gerarOrcamento() {
    const itens = linhas
      .filter((l) => l.produtoId)
      .map((l) => ({ produtoId: l.produtoId as number, quantidade: l.quantidade }))
    if (itens.length === 0) {
      toast.error("Resolva ao menos um item para gerar o orçamento.")
      return
    }
    sessionStorage.setItem(
      "televendas_payload",
      JSON.stringify({ clienteId: clienteId || undefined, itens })
    )
    router.push("/orcamentos/novo")
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

  if (!can("comercial")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <XCircle className="size-10 text-destructive/70" />
          Sem acesso ao módulo Comercial.
        </div>
      </AppShell>
    )
  }

  const resolvidos = linhas.filter((l) => l.produtoId).length

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardPaste className="size-6 text-primary" /> Entrada rápida (Televendas)
          </h1>
          <p className="text-sm text-muted-foreground">
            Cole a lista que o cliente enviou; o sistema casa com os produtos e monta o orçamento.
          </p>
        </div>

        {/* Cliente + crédito */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[260px] flex-1">
              <Label>Cliente (opcional)</Label>
              <Select value={clienteId ? String(clienteId) : ""} onValueChange={(v) => setClienteId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {cliente && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {(cliente.saldoCreditoValor ?? 0) > 0 || (cliente.saldoCreditoProdutos ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5">
                    <Wallet className="size-4" />
                    Crédito:{" "}
                    {(cliente.saldoCreditoValor ?? 0) > 0 && brl(cliente.saldoCreditoValor)}
                    {(cliente.saldoCreditoProdutos ?? 0) > 0 && ` · ${cliente.saldoCreditoProdutos} un`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem crédito acumulado</span>
                )}
                {cliente.ultimaCompra && (
                  <span className="text-xs text-muted-foreground">
                    Última compra: {new Date(cliente.ultimaCompra).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colar lista */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Lista do cliente</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={EXEMPLO}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-2">
              <Button onClick={processar} disabled={processando} className="gap-2">
                {processando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Processar lista
              </Button>
              <span className="text-xs text-muted-foreground">Uma linha por item. Ex.: "10 dipirona 500mg"</span>
            </div>
          </CardContent>
        </Card>

        {/* Revisão */}
        {linhas.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FiltroChip ativo={filtro === "todos"} onClick={() => setFiltro("todos")} label="Todos" n={linhas.length} />
                  <FiltroChip ativo={filtro === "tem"} onClick={() => setFiltro("tem")} label="Tem" n={contagem.tem} cor="emerald" />
                  <FiltroChip ativo={filtro === "alerta"} onClick={() => setFiltro("alerta")} label="Alerta" n={contagem.alerta} cor="amber" />
                  <FiltroChip ativo={filtro === "nao"} onClick={() => setFiltro("nao")} label="Não encontrado" n={contagem.nao} cor="red" />
                </div>
                <Button onClick={gerarOrcamento} disabled={resolvidos === 0} className="gap-2">
                  Gerar orçamento <ArrowRight className="size-4" />
                </Button>
              </div>
              <div className="divide-y">
                {linhasVisiveis.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma linha neste filtro.</p>
                )}
                {linhasVisiveis.map((l) => (
                  <div key={l.linha} className="p-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2 md:w-44 shrink-0">
                      <StatusIcon status={l.status} />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate" title={l.original}>
                          {l.original}
                        </p>
                      </div>
                    </div>

                    <Input
                      type="number"
                      className="w-20 h-9 shrink-0"
                      value={l.quantidade}
                      onChange={(e) => setLinha(l.linha, { quantidade: e.target.value === "" ? 0 : +e.target.value })}
                    />

                    <div className="flex-1 min-w-0">
                      {l.candidatos.length > 0 && !searchMode.has(l.linha) ? (
                        <div className="space-y-1">
                          <Select
                            value={l.produtoId ? String(l.produtoId) : ""}
                            onValueChange={(v) => setLinha(l.linha, { produtoId: Number(v), status: "ok" })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Escolha o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {l.candidatos.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  <span className="font-mono text-xs text-muted-foreground">{c.codigo}</span> {c.nome}
                                  {" · "}
                                  {brl(precoDe(c))}
                                  {" · est "}
                                  {c.estoque}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const sel = l.candidatos.find((c) => c.id === l.produtoId)
                            if (!sel) return null
                            const semEstoque = (sel.estoque ?? 0) <= 0
                            return (
                              <div className="flex flex-wrap items-center gap-3 text-xs pl-0.5">
                                <span className="inline-flex items-center gap-1 font-medium text-primary">
                                  <Wallet className="size-3.5" /> {brl(precoDe(sel))}
                                  {clienteId && precosMap[sel.id] != null && precosMap[sel.id] !== sel.precoBase && (
                                    <span className="text-[10px] text-emerald-600 font-normal">tabela do cliente</span>
                                  )}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 ${
                                    semEstoque ? "text-destructive" : "text-muted-foreground"
                                  }`}
                                >
                                  <Package className="size-3.5" /> Estoque: {sel.estoque}
                                  {semEstoque && " (sem estoque)"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleSearch(l.linha)}
                                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline underline-offset-2"
                                >
                                  <Search className="size-3" /> Buscar outro
                                </button>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <ProdutoCombobox
                          initialQuery={l.termo}
                          triggerLabel="Buscar produto no sistema (cód ou nome)..."
                          onSelect={(p) => resolverLinha(l.linha, p)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function StatusIcon({ status }: { status: LinhaLista["status"] }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
  if (status === "ambiguo") return <AlertTriangle className="size-4 text-amber-500 shrink-0" />
  return <XCircle className="size-4 text-destructive shrink-0" />
}

function FiltroChip({
  ativo,
  onClick,
  label,
  n,
  cor,
}: {
  ativo: boolean
  onClick: () => void
  label: string
  n: number
  cor?: "emerald" | "amber" | "red"
}) {
  const dot =
    cor === "emerald" ? "bg-emerald-500" : cor === "amber" ? "bg-amber-500" : cor === "red" ? "bg-destructive" : "bg-muted-foreground"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        ativo ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted text-muted-foreground"
      }`}
    >
      {cor && <span className={`size-1.5 rounded-full ${dot}`} />}
      {label}
      <span className="tabular-nums">{n}</span>
    </button>
  )
}
