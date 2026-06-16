"use client"

import { AppShell } from "@/components/app-shell"
import {
  getPlanejamentoById,
  getPlanejamentoItens,
  vincularImportacao,
  desvincularImportacao,
  sincronizarMatriz,
  calcularNecessidade,
  ajustarPlanejamentoItem,
  gerarPedidosFromPlanejamento,
  getImportacoesDisponiveis,
  atualizarPlanejamento,
} from "@/lib/actions/compras/planejamento"
import { criarCotacaoFromPlanejamento, gerarLinkPortalFornecedor } from "@/lib/actions/compras/cotacao"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use, useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Upload, RefreshCw, Calculator, Trophy, ChevronLeft, ChevronRight, FileText, ShoppingCart, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import { PlanejamentoAjuda } from "@/components/compras/planejamento-ajuda"
import { PlanejamentoFinalizar } from "@/components/compras/planejamento-finalizar"
import { CompraHistorico } from "@/components/compras/compra-historico"

export default function PlanejamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const planejamentoId = parseInt(id, 10)
  const { currentUser } = useAuth()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [multiFornecedor, setMultiFornecedor] = useState(true)
  const [fornecedorId, setFornecedorId] = useState("")
  const [nomeAba, setNomeAba] = useState("ESTOQUE")
  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [soIncluidos, setSoIncluidos] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [processando, setProcessando] = useState(false)
  const [gerandoPedidos, setGerandoPedidos] = useState(false)
  const [diasCobertura, setDiasCobertura] = useState(90)

  const { data: plan, refetch: refetchPlan } = useDataQuery({
    key: `planejamento-${planejamentoId}`,
    fetcher: () => getPlanejamentoById(planejamentoId, currentUser?.id),
  })

  const { data: itensData, refetch: refetchItens, isLoading: loadingItens } = useDataQuery({
    key: `planejamento-itens-${planejamentoId}-${page}-${limit}-${buscaDebounced}-${soIncluidos}`,
    fetcher: () =>
      getPlanejamentoItens(
        planejamentoId,
        { page, limit, search: buscaDebounced, soIncluidos },
        currentUser?.id
      ),
  })

  function refetch() {
    refetchPlan()
    refetchItens()
  }

  const { data: importacoesDisp, refetch: refetchImp } = useDataQuery({
    key: `importacoes-disp-${planejamentoId}`,
    fetcher: () => getImportacoesDisponiveis(planejamentoId, currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-planejamento",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  useEffect(() => {
    if (plan?.diasCobertura) setDiasCobertura(plan.diasCobertura)
  }, [plan?.diasCobertura])

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounced(busca)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [busca])

  const fornecedorCols = useMemo(() => {
    if (!plan) return []
    const ids = new Set(plan.importacoes.map((v) => v.importacao.fornecedor.id))
    return (fornecedores ?? []).filter((f) => ids.has(f.id))
  }, [plan, fornecedores])

  const fornecedorIdsMatriz = useMemo(
    () => fornecedorCols.map((f) => f.id),
    [fornecedorCols]
  )

  const editavel = plan && !["CONVERTIDO", "CANCELADO"].includes(plan.status)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!multiFornecedor && !fornecedorId) {
      toast.error("Selecione fornecedor ou ative multi-fornecedor.")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("requesterId", String(currentUser?.id || 1))
      fd.append("planejamentoId", String(planejamentoId))
      fd.append("multiFornecedor", String(multiFornecedor))
      if (multiFornecedor) {
        if (nomeAba) fd.append("nomeAba", nomeAba)
      } else {
        fd.append("fornecedorId", fornecedorId)
      }
      const res = await fetch("/api/compras/import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro no upload")
      toast.success("Importação vinculada ao planejamento.")
      refetch()
      refetchImp()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleVincular(importacaoId: number) {
    try {
      await vincularImportacao(planejamentoId, importacaoId, currentUser?.id)
      toast.success("Importação vinculada.")
      refetch()
      refetchImp()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleDesvincular(importacaoId: number) {
    try {
      await desvincularImportacao(planejamentoId, importacaoId, currentUser?.id)
      toast.success("Importação removida.")
      refetch()
      refetchImp()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleSync() {
    setProcessando(true)
    try {
      await sincronizarMatriz(planejamentoId, currentUser?.id)
      toast.success("Comparativo atualizado.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setProcessando(false)
    }
  }

  async function handleCalcular() {
    setProcessando(true)
    try {
      await calcularNecessidade(planejamentoId, currentUser?.id)
      toast.success("Necessidade calculada.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setProcessando(false)
    }
  }

  async function handleAjustar(
    itemId: number,
    data: { qtdNecessaria?: number; incluir?: boolean; fornecedorEscolhidoId?: number }
  ) {
    await ajustarPlanejamentoItem(itemId, data, currentUser?.id)
    refetch()
  }

  async function handleGerarPedidos() {
    setGerandoPedidos(true)
    try {
      const pedidos = await gerarPedidosFromPlanejamento(planejamentoId, currentUser?.id)
      toast.success(`${pedidos.length} pedido(s) gerado(s).`)
      if (pedidos.length === 1) {
        router.push(`/compras/pedidos/${pedidos[0].id}`)
      } else {
        router.push("/compras/pedidos")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setGerandoPedidos(false)
    }
  }

  async function handleSalvarDias() {
    try {
      await atualizarPlanejamento(planejamentoId, { diasCobertura }, currentUser?.id)
      toast.success("Cobertura atualizada.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  const itens = itensData?.itens ?? []

  async function handleCriarCotacao(fornecedorIds: number[]) {
    const res = await criarCotacaoFromPlanejamento(
      planejamentoId,
      fornecedorIds,
      undefined,
      currentUser?.id
    )
    refetch()
    return { tokens: res.tokens }
  }

  if (!plan) return <AppShell><p>Carregando...</p></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras/planejamentos"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{plan.titulo || plan.numero}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground">{plan.numero}</p>
              {editavel ? (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Cobertura (dias)</Label>
                  <Input
                    type="number"
                    className="w-20 h-8"
                    value={diasCobertura}
                    onChange={(e) => setDiasCobertura(+e.target.value)}
                    onBlur={handleSalvarDias}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Cobertura {plan.diasCobertura} dias</p>
              )}
            </div>
          </div>
          <Badge>{plan.status}</Badge>
          <PlanejamentoAjuda variant="detalhe" />
          {editavel && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleSync} disabled={processando}>
                <RefreshCw className="size-4 mr-2" /> Atualizar comparativo
              </Button>
              <Button variant="outline" onClick={handleCalcular} disabled={processando}>
                <Calculator className="size-4 mr-2" /> Calcular necessidade
              </Button>
            </div>
          )}
        </div>

        {(plan.cotacao || (plan.pedidos?.length ?? 0) > 0) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documentos gerados</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.cotacao && (
                <Button asChild>
                  <Link href={`/compras/cotacoes/${plan.cotacao.id}`}>
                    <FileText className="size-4 mr-2" />
                    Cotação {plan.cotacao.numero}
                    <ExternalLink className="size-4 ml-2" />
                  </Link>
                </Button>
              )}
              {plan.pedidos?.map((pedido) => (
                <Button key={pedido.id} variant="outline" asChild>
                  <Link href={`/compras/pedidos/${pedido.id}`}>
                    <ShoppingCart className="size-4 mr-2" />
                    Pedido {pedido.numero}
                    <span className="text-muted-foreground ml-1">
                      — {pedido.fornecedor.razaoSocial}
                    </span>
                    <ExternalLink className="size-4 ml-2" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {(editavel || plan.cotacao || (plan.pedidos?.length ?? 0) > 0) && (
          <PlanejamentoFinalizar
            itensElegiveis={plan.itensIncluidos ?? 0}
            itensMarcados={plan.itensMarcados ?? 0}
            fornecedores={fornecedores ?? []}
            fornecedoresSugeridos={fornecedorIdsMatriz}
            cotacao={plan.cotacao}
            editavel={!!editavel}
            gerandoPedidos={gerandoPedidos}
            onGerarPedidos={handleGerarPedidos}
            onCriarCotacao={handleCriarCotacao}
            onGerarLink={(cotacaoFornecedorId) =>
              gerarLinkPortalFornecedor(cotacaoFornecedorId, currentUser?.id)
            }
          />
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="size-4" /> Preços dos fornecedores
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Planilhas com preço de cada fornecedor. A coluna Estoque na matriz vem do cadastro de produtos (atualize em Estoque).
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch id="multi" checked={multiFornecedor} onCheckedChange={setMultiFornecedor} />
                <Label htmlFor="multi" className="text-xs cursor-pointer">
                  Multi-fornecedor
                </Label>
              </div>
              {!multiFornecedor && (
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger><SelectValue placeholder="Fornecedor..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedores?.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.razaoSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {multiFornecedor && (
                <Input
                  placeholder="Nome aba (ex: ESTOQUE)"
                  value={nomeAba}
                  onChange={(e) => setNomeAba(e.target.value)}
                />
              )}
              <Label className="cursor-pointer">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading || !editavel}
                />
                <span className="inline-flex items-center justify-center w-full h-9 px-4 rounded-md border text-sm hover:bg-muted/50">
                  {uploading ? "Enviando..." : "Upload planilha"}
                </span>
              </Label>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Vinculadas</p>
                {plan.importacoes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma importação ainda.</p>
                )}
                {plan.importacoes.map((v) => {
                  const semDados =
                    v.importacao.linhasCount === 0 && (v.importacao.totalLinhas ?? 0) > 0
                  return (
                  <div key={v.importacao.id} className="flex justify-between items-center text-sm gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.importacao.fornecedor.razaoSocial}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.importacao.nomeArquivo}</p>
                      {semDados && (
                        <p className="text-xs text-amber-600">Sem dados — refaça o upload</p>
                      )}
                    </div>
                    {editavel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => handleDesvincular(v.importacao.id)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  )
                })}
              </div>

              {editavel && importacoesDisp && importacoesDisp.some((i) => !i.vinculada) && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Disponíveis</p>
                  {importacoesDisp
                    .filter((i) => !i.vinculada)
                    .slice(0, 8)
                    .map((imp) => (
                      <div key={imp.id} className="flex justify-between items-center text-sm gap-2">
                        <div className="min-w-0">
                          <p className="truncate">{imp.fornecedor.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(imp.criadoEm).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleVincular(imp.id)}>
                          Vincular
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="incl"
                  checked={soIncluidos}
                  onCheckedChange={(v) => {
                    setSoIncluidos(v)
                    setPage(1)
                  }}
                />
                <Label htmlFor="incl" className="text-sm">Só marcados</Label>
              </div>
              <Select
                value={String(limit)}
                onValueChange={(v) => {
                  setLimit(+v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 40, 60, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">
                {itensData?.total ?? 0} itens
                {itensData && itensData.totalPages > 1 && ` · pág ${page}/${itensData.totalPages}`}
              </Badge>
            </div>

            {loadingItens && <p className="text-sm text-muted-foreground">Carregando itens...</p>}

            {!loadingItens && itens.length > 0 && fornecedorCols.length > 0 ? (
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-2 text-left sticky left-0 bg-muted/40 min-w-[180px]">Produto</th>
                        <th className="p-2 text-right">Estoque</th>
                        <th className="p-2 text-right">Média/d</th>
                        <th className="p-2 text-right">Dias</th>
                        <th className="p-2 text-right">Qtd comprar</th>
                        {fornecedorCols.map((f) => (
                          <th key={f.id} className="p-2 text-right min-w-[90px]">{f.razaoSocial}</th>
                        ))}
                        <th className="p-2 text-left">Fornecedor</th>
                        <th className="p-2 text-center">✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item) => {
                        const melhorId = item.melhorFornecedorId
                        const escolhido = item.fornecedorEscolhidoId ?? melhorId
                        return (
                          <tr key={item.id} className="border-b hover:bg-muted/20">
                            <td className="p-2 sticky left-0 bg-background">
                              <div className="font-medium text-xs">
                                {item.produto
                                  ? `${item.produto.codigo} — ${item.produto.nome}`
                                  : item.descricao ?? "Sem vínculo"}
                              </div>
                              {item.ean && (
                                <span className="text-[10px] text-muted-foreground font-mono">{item.ean}</span>
                              )}
                            </td>
                            <td className="p-2 text-right">{item.estoqueAtual}</td>
                            <td className="p-2 text-right">{item.mediaConsumo.toFixed(2)}</td>
                            <td className="p-2 text-right text-muted-foreground">
                              {item.mediaConsumo > 0
                                ? (item.estoqueAtual / item.mediaConsumo).toFixed(0)
                                : "—"}
                            </td>
                            <td className="p-2 text-right">
                              {editavel ? (
                                <Input
                                  type="number"
                                  className="w-20 h-8 ml-auto"
                                  defaultValue={item.qtdNecessaria}
                                  onBlur={(e) =>
                                    handleAjustar(item.id, { qtdNecessaria: +e.target.value })
                                  }
                                />
                              ) : (
                                item.qtdNecessaria
                              )}
                            </td>
                            {fornecedorCols.map((f) => {
                              const preco = item.precos.find((p) => p.fornecedorId === f.id)
                              const isMenor = preco && escolhido === f.id
                              return (
                                <td
                                  key={f.id}
                                  className={`p-2 text-right text-xs ${isMenor ? "text-green-600 font-bold bg-green-50 dark:bg-green-950/30" : ""}`}
                                >
                                  {preco
                                    ? preco.preco.toLocaleString("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      })
                                    : "—"}
                                </td>
                              )
                            })}
                            <td className="p-2">
                              {editavel && item.precos.length > 0 ? (
                                <Select
                                  value={escolhido ? String(escolhido) : undefined}
                                  onValueChange={(v) =>
                                    handleAjustar(item.id, { fornecedorEscolhidoId: +v })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs w-36">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.precos.map((p) => (
                                      <SelectItem key={p.fornecedorId} value={String(p.fornecedorId)}>
                                        {p.razaoSocial}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs inline-flex items-center gap-1 text-green-700">
                                  <Trophy className="size-3" />
                                  {item.fornecedorEscolhido?.razaoSocial ??
                                    item.melhorFornecedor?.razaoSocial ??
                                    "—"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={item.incluir}
                                disabled={!editavel}
                                onCheckedChange={(c) =>
                                  handleAjustar(item.id, { incluir: c === true })
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : !loadingItens ? (
              <p className="text-center text-muted-foreground py-12 border rounded-lg">
                {plan.importacoes.length === 0
                  ? "Faça upload ou vincule importações para montar o comparativo."
                  : (itensData?.total ?? 0) === 0
                    ? plan.importacoes.some(
                        (v) =>
                          v.importacao.linhasCount === 0 && (v.importacao.totalLinhas ?? 0) > 0
                      )
                      ? "Importações vinculadas sem dados. Faça upload novamente das planilhas de preço e clique em Atualizar comparativo."
                      : "Nenhum item na matriz. Clique em Atualizar comparativo."
                    : "Nenhum item nesta página com os filtros atuais."}
              </p>
            ) : null}

            {!loadingItens && itensData && itensData.totalPages > 1 && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Exibindo {(page - 1) * limit + 1}–{Math.min(page * limit, itensData.total)} de {itensData.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm tabular-nums">{page} / {itensData.totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= itensData.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <CompraHistorico contexto="planejamento" id={planejamentoId} />
      </div>
    </AppShell>
  )
}
