"use client"

import { AppShell } from "@/components/app-shell"
import { getCotacaoCompraById, gerarLinkPortalFornecedor } from "@/lib/actions/compras/cotacao"
import {
  escolherFornecedorItem,
  aplicarVencedoresMenorPreco,
} from "@/lib/actions/compras/cotacao-escolha"
import { gerarPedidosCompraFromCotacao } from "@/lib/actions/compras/pedido-compra"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use, useMemo, useState, useEffect, type ComponentType, type ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Crown,
  ShoppingCart,
  Sparkles,
  Copy,
  Check,
  ClipboardList,
  Users,
  Package,
  Link2,
  Calendar,
  Clock,
  Truck,
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CotacaoStatusBadge } from "@/components/compras/cotacao-status-badge"
import { Badge } from "@/components/ui/badge"
import type { CotacaoRespostaJson } from "@/lib/compras/types"
import { cn } from "@/lib/utils"
import { CompraHistorico } from "@/components/compras/compra-historico"

function formatPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const PAGE_SIZE = 20

function MetaLinha({
  icon: Icon,
  children,
  title,
}: {
  icon: ComponentType<{ className?: string }>
  children: ReactNode
  title?: string
}) {
  return (
    <div className="flex items-start gap-1 text-[11px] text-muted-foreground" title={title}>
      <Icon className="size-3 shrink-0 mt-0.5" />
      <span className="min-w-0 break-words leading-tight">{children}</span>
    </div>
  )
}

function RespostaExtras({
  resp,
  qtdSolicitada,
}: {
  resp: CotacaoRespostaJson
  qtdSolicitada?: number
}) {
  const temPrazo = resp.prazoEntregaDias != null && resp.prazoEntregaDias > 0
  const temQtd = resp.quantidadeDisponivel != null
  const temObs = !!resp.observacao?.trim()
  if (!temPrazo && !temQtd && !temObs) return null

  return (
    <div className="mt-2 w-full space-y-1 border-t border-border/50 pt-2 text-left">
      {temPrazo && (
        <MetaLinha icon={Clock}>{resp.prazoEntregaDias} dia(s) para entrega</MetaLinha>
      )}
      {temQtd && (
        <MetaLinha icon={Truck}>
          Disp: {resp.quantidadeDisponivel}
          {qtdSolicitada != null && resp.quantidadeDisponivel! < qtdSolicitada && (
            <span className="text-amber-600 dark:text-amber-400"> (parcial)</span>
          )}
        </MetaLinha>
      )}
      {temObs && (
        <MetaLinha icon={MessageSquare} title={resp.observacao!}>
          {resp.observacao}
        </MetaLinha>
      )}
    </div>
  )
}

function CelulaVencedor({
  escolha,
  resp,
  qtdSolicitada,
}: {
  escolha: { fornecedor: { razaoSocial: string } }
  resp?: CotacaoRespostaJson
  qtdSolicitada: number
}) {
  return (
    <div className="space-y-2 min-w-[160px]">
      <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        <Crown className="size-3.5 text-amber-600 shrink-0" />
        <span className="break-words">{escolha.fornecedor.razaoSocial}</span>
      </div>
      {resp && (
        <div className="space-y-1.5">
          {resp.precoUnitario != null && (
            <p className="text-sm font-semibold tabular-nums">{formatPreco(resp.precoUnitario)}</p>
          )}
          {resp.prazoEntregaDias != null && resp.prazoEntregaDias > 0 && (
            <MetaLinha icon={Clock}>Entrega em {resp.prazoEntregaDias} dia(s)</MetaLinha>
          )}
          {resp.quantidadeDisponivel != null && (
            <MetaLinha icon={Truck}>
              Qtd: {resp.quantidadeDisponivel}
              {resp.quantidadeDisponivel < qtdSolicitada && (
                <span className="text-amber-600 dark:text-amber-400"> (parcial)</span>
              )}
            </MetaLinha>
          )}
          {resp.observacao?.trim() && (
            <div className="rounded-md bg-muted/60 p-2">
              <MetaLinha icon={MessageSquare}>{resp.observacao}</MetaLinha>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CotacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const cotacaoId = parseInt(id, 10)
  const { currentUser } = useAuth()
  const [copiado, setCopiado] = useState<number | null>(null)
  const [gerandoLink, setGerandoLink] = useState<number | null>(null)
  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounced(busca)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  const { data: cot, refetch } = useDataQuery({
    key: `cotacao-${cotacaoId}`,
    fetcher: () => getCotacaoCompraById(cotacaoId, currentUser?.id),
  })

  const stats = useMemo(() => {
    if (!cot) return null
    const totalItens = cot.itens.length
    let comResposta = 0
    let vencedores = 0
    for (const item of cot.itens) {
      const temPreco = cot.fornecedores.some((f) => {
        const respostas = (f.respostas as CotacaoRespostaJson[]) ?? []
        const r = respostas.find((x) => x.cotacaoItemId === item.id)
        return r?.precoUnitario != null
      })
      if (temPreco) comResposta++
      if (item.escolha) vencedores++
    }
    const respondidos = cot.fornecedores.filter((f) => f.status === "RESPONDIDA").length
    return { totalItens, comResposta, vencedores, respondidos, totalForn: cot.fornecedores.length }
  }, [cot])

  const menorPrecoPorItem = useMemo(() => {
    if (!cot) return new Map<number, number>()
    const map = new Map<number, number>()
    for (const item of cot.itens) {
      let menor: number | null = null
      for (const f of cot.fornecedores) {
        const respostas = (f.respostas as CotacaoRespostaJson[]) ?? []
        const resp = respostas.find((r) => r.cotacaoItemId === item.id)
        if (resp?.precoUnitario != null) {
          if (menor === null || resp.precoUnitario < menor) menor = resp.precoUnitario
        }
      }
      if (menor !== null) map.set(item.id, menor)
    }
    return map
  }, [cot])

  const itensFiltrados = useMemo(() => {
    if (!cot) return []
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return cot.itens
    return cot.itens.filter(
      (item) =>
        item.produto.nome.toLowerCase().includes(q) ||
        item.produto.codigo.toLowerCase().includes(q)
    )
  }, [cot, buscaDebounced])

  const totalPages = Math.max(1, Math.ceil(itensFiltrados.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const itensPagina = itensFiltrados.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE
  )

  async function handleEscolher(cotacaoItemId: number, cotacaoFornecedorId: number) {
    try {
      await escolherFornecedorItem(cotacaoItemId, cotacaoFornecedorId, undefined, currentUser?.id)
      toast.success("Vencedor definido.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleMenorPreco() {
    try {
      const res = await aplicarVencedoresMenorPreco(cotacaoId, currentUser?.id)
      toast.success(`${res.aplicados} vencedor(es) por menor preço.`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleGerarPedidos() {
    try {
      const pedidos = await gerarPedidosCompraFromCotacao(cotacaoId, currentUser?.id)
      toast.success(`${pedidos.length} pedido(s) gerado(s).`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleCopiarLink(cotacaoFornecedorId: number, nome: string) {
    setGerandoLink(cotacaoFornecedorId)
    try {
      const { token } = await gerarLinkPortalFornecedor(cotacaoFornecedorId, currentUser?.id)
      const url = `${window.location.origin}/portal/cotacao/${token}`
      await navigator.clipboard.writeText(url)
      setCopiado(cotacaoFornecedorId)
      toast.success(`Link de ${nome} copiado.`)
      setTimeout(() => setCopiado(null), 2000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link.")
    } finally {
      setGerandoLink(null)
    }
  }

  if (!cot) return <AppShell><p>Carregando...</p></AppShell>

  const fornecedores = cot.fornecedores
  const podeGerarPedidos = (stats?.vencedores ?? 0) > 0

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Navegação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/compras/cotacoes">
              <ArrowLeft className="size-4 mr-2" />
              Cotações
            </Link>
          </Button>
          {cot.planejamento && (
            <Button size="sm" asChild className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20">
              <Link href={`/compras/planejamentos/${cot.planejamento.id}`}>
                <ClipboardList className="size-4 mr-2" />
                Voltar ao planejamento
                <Badge variant="secondary" className="ml-2 font-mono text-[10px]">
                  {cot.planejamento.numero}
                </Badge>
              </Link>
            </Button>
          )}
        </div>

        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-background to-muted/30 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{cot.numero}</h1>
              <CotacaoStatusBadge status={cot.status} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {cot.titulo ?? "Cotação competitiva"}
            </p>
            {cot.prazoResposta && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-2 rounded-md bg-muted/50 px-2 py-1">
                <Calendar className="size-3.5" />
                Prazo para resposta:{" "}
                <span className="font-medium text-foreground">
                  {new Date(cot.prazoResposta).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleMenorPreco}>
              <Sparkles className="size-4 mr-2" />
              Menor preço em tudo
            </Button>
            <Button size="sm" onClick={handleGerarPedidos} disabled={!podeGerarPedidos}>
              <ShoppingCart className="size-4 mr-2" />
              Gerar pedidos
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fornecedores</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {stats.respondidos}/{stats.totalForn}
                    <span className="text-sm font-normal text-muted-foreground ml-1">responderam</span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
                  <Package className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Itens com preço</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {stats.comResposta}/{stats.totalItens}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <Crown className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencedores</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {stats.vencedores}/{stats.totalItens}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              Links para fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {fornecedores.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 justify-between rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{f.fornecedor.razaoSocial}</span>
                    <CotacaoStatusBadge status={f.status} />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    disabled={gerandoLink === f.id}
                    onClick={() => handleCopiarLink(f.id, f.fornecedor.razaoSocial)}
                  >
                    {copiado === f.id ? (
                      <>
                        <Check className="size-3 mr-1" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="size-3 mr-1" />
                        {gerandoLink === f.id ? "..." : "Copiar"}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabela comparativa */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Comparativo de preços</CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  Clique no preço para escolher o vencedor.
                </p>
              </div>
              <Badge variant="secondary" className="tabular-nums shrink-0">
                {itensFiltrados.length} item(ns)
                {buscaDebounced && ` · filtrado`}
              </Badge>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {itensPagina.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                {buscaDebounced ? "Nenhum produto encontrado." : "Nenhum item na cotação."}
              </p>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed min-w-[900px]">
                <colgroup>
                  <col className="w-[220px]" />
                  <col className="w-[56px]" />
                  {fornecedores.map((f) => (
                    <col key={f.id} className="w-[180px]" />
                  ))}
                  <col className="w-[200px]" />
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left sticky left-0 bg-muted/40 z-10 font-medium">
                      Produto
                    </th>
                    <th className="p-3 text-right font-medium">Qtd</th>
                    {fornecedores.map((f) => (
                      <th
                        key={f.id}
                        className="p-3 text-center text-xs font-medium align-bottom"
                        title={f.fornecedor.razaoSocial}
                      >
                        <span className="block truncate">{f.fornecedor.razaoSocial}</span>
                      </th>
                    ))}
                    <th className="p-3 text-left font-medium bg-amber-500/5 align-bottom">
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Crown className="size-3.5 shrink-0" />
                        Vencedor
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itensPagina.map((item) => {
                    const menorPreco = menorPrecoPorItem.get(item.id)
                    const temVencedor = !!item.escolha
                    const respVencedor = item.escolha
                      ? (() => {
                          const f = fornecedores.find(
                            (x) => x.id === item.escolha!.cotacaoFornecedorId
                          )
                          const respostas = (f?.respostas as CotacaoRespostaJson[]) ?? []
                          return respostas.find((r) => r.cotacaoItemId === item.id)
                        })()
                      : undefined

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/10",
                          temVencedor && "bg-amber-500/[0.03]"
                        )}
                      >
                        <td className="p-3 sticky left-0 bg-background z-10 border-r border-border/40 align-top">
                          <p className="font-semibold text-xs break-all">{item.produto.codigo}</p>
                          <p className="text-muted-foreground text-xs mt-0.5 break-words leading-snug">
                            {item.produto.nome}
                          </p>
                        </td>
                        <td className="p-3 text-right tabular-nums font-medium align-top">
                          {item.quantidade}
                        </td>
                        {fornecedores.map((f) => {
                          const respostas = (f.respostas as CotacaoRespostaJson[]) ?? []
                          const resp = respostas.find((r) => r.cotacaoItemId === item.id)
                          const escolhido = item.escolha?.cotacaoFornecedorId === f.id
                          const isMenor =
                            resp?.precoUnitario != null &&
                            menorPreco != null &&
                            resp.precoUnitario === menorPreco

                          return (
                            <td key={f.id} className="p-2 align-top">
                              {resp?.precoUnitario != null ? (
                                <div className="rounded-lg border bg-card p-2 h-full">
                                  <button
                                    type="button"
                                    title={
                                      escolhido
                                        ? "Vencedor escolhido"
                                        : "Clique para escolher como vencedor"
                                    }
                                    className={cn(
                                      "w-full inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-all",
                                      "hover:ring-2 hover:ring-offset-1",
                                      escolhido
                                        ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400/60 dark:bg-amber-950/60 dark:text-amber-200"
                                        : isMenor
                                          ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200"
                                          : "bg-muted hover:bg-muted/80"
                                    )}
                                    onClick={() => handleEscolher(item.id, f.id)}
                                  >
                                    {escolhido && (
                                      <Crown className="size-3 shrink-0 text-amber-600" />
                                    )}
                                    {formatPreco(resp.precoUnitario)}
                                  </button>
                                  <RespostaExtras resp={resp} qtdSolicitada={item.quantidade} />
                                </div>
                              ) : resp &&
                                (resp.prazoEntregaDias != null ||
                                  resp.quantidadeDisponivel != null ||
                                  resp.observacao) ? (
                                <div className="rounded-lg border border-dashed p-2">
                                  <p className="text-[11px] text-muted-foreground mb-1">Sem preço</p>
                                  <RespostaExtras resp={resp} qtdSolicitada={item.quantidade} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground/60 text-xs px-2">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="p-3 bg-amber-500/[0.04] align-top">
                          {item.escolha ? (
                            <CelulaVencedor
                              escolha={item.escolha}
                              resp={respVencedor}
                              qtdSolicitada={item.quantidade}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Pendente</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
            {itensFiltrados.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                <p className="text-sm text-muted-foreground tabular-nums">
                  {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, itensFiltrados.length)} de{" "}
                  {itensFiltrados.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm tabular-nums min-w-[4rem] text-center">
                    {pageSafe} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <CompraHistorico contexto="cotacao" id={cotacaoId} />
      </div>
    </AppShell>
  )
}
