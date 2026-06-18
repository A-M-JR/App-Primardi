"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, FileText, Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { CotacaoStatusBadge } from "@/components/compras/cotacao-status-badge"

type Fornecedor = { id: number; razaoSocial: string }

type CotacaoFornecedor = {
  id: number
  fornecedorId: number
  status: string
  fornecedor: { id: number; razaoSocial: string }
}

type CotacaoResumo = {
  id: number
  numero: string
  status: string
  fornecedores?: CotacaoFornecedor[]
}

type Props = {
  itensElegiveis: number
  itensMarcados?: number
  fornecedores: Fornecedor[]
  fornecedoresSugeridos: number[]
  cotacao?: CotacaoResumo | null
  editavel: boolean
  gerandoPedidos: boolean
  onGerarPedidos: () => void
  onCriarCotacao: (fornecedorIds: number[]) => Promise<{ tokens: { fornecedorId: number; token: string }[] }>
  onGerarLink?: (cotacaoFornecedorId: number) => Promise<{ token: string }>
}

function LinksFornecedores({
  fornecedores,
  linksCache,
  onCopiar,
  copiado,
}: {
  fornecedores: { id: number; nome: string; status?: string }[]
  linksCache: Map<number, string>
  onCopiar: (id: number, nome: string) => void
  copiado: number | null
}) {
  return (
    <div className="space-y-2">
      {fornecedores.map((f) => (
        <div
          key={f.id}
          className="flex flex-wrap items-center gap-2 justify-between rounded-md border bg-background p-2"
        >
          <div className="min-w-0">
            <span className="text-sm font-medium">{f.nome}</span>
            {f.status && (
              <span className="ml-2">
                <CotacaoStatusBadge status={f.status} />
              </span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => onCopiar(f.id, f.nome)}>
            {copiado === f.id ? (
              <>
                <Check className="size-3 mr-1" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-3 mr-1" />
                {linksCache.has(f.id) ? "Copiar link" : "Gerar e copiar link"}
              </>
            )}
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Envie cada link ao fornecedor correspondente. Ele preenche os preços no portal.
      </p>
    </div>
  )
}

export function PlanejamentoFinalizar({
  itensElegiveis,
  itensMarcados = 0,
  fornecedores,
  fornecedoresSugeridos,
  cotacao,
  editavel,
  gerandoPedidos,
  onGerarPedidos,
  onCriarCotacao,
  onGerarLink,
}: Props) {
  const fornecedoresConvite =
    fornecedoresSugeridos.length > 0
      ? fornecedores.filter((f) => fornecedoresSugeridos.includes(f.id))
      : fornecedores

  const [selecionados, setSelecionados] = useState<Set<number>>(
    () => new Set(fornecedoresSugeridos)
  )
  const [criando, setCriando] = useState(false)
  const [links, setLinks] = useState<{ fornecedorId: number; token: string; cotacaoFornecedorId?: number }[]>([])
  const [linksCache, setLinksCache] = useState<Map<number, string>>(new Map())
  const [copiado, setCopiado] = useState<number | null>(null)

  function toggleFornecedor(id: number) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copiarLinkPortal(
    cotacaoFornecedorId: number,
    fornecedorNome: string,
    token?: string
  ) {
    try {
      let linkToken = token
      if (!linkToken) {
        const cached = linksCache.get(cotacaoFornecedorId)
        if (cached) {
          linkToken = cached
        } else if (onGerarLink) {
          const res = await onGerarLink(cotacaoFornecedorId)
          linkToken = res.token
          setLinksCache((prev) => new Map(prev).set(cotacaoFornecedorId, linkToken!))
        }
      }
      if (!linkToken) {
        toast.error("Não foi possível gerar o link.")
        return
      }
      const url = `${window.location.origin}/portal/cotacao/${linkToken}`
      await navigator.clipboard.writeText(url)
      setCopiado(cotacaoFornecedorId)
      toast.success(`Link de ${fornecedorNome} copiado.`)
      setTimeout(() => setCopiado(null), 2000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link.")
    }
  }

  async function handleAbrirCotacao() {
    if (!selecionados.size) return toast.error("Marque ao menos um fornecedor.")
    setCriando(true)
    try {
      const res = await onCriarCotacao([...selecionados])
      const novos = res.tokens.map((t) => ({
        fornecedorId: t.fornecedorId,
        token: t.token,
      }))
      setLinks(novos)
      const cache = new Map(linksCache)
      for (const l of novos) cache.set(l.fornecedorId, l.token)
      setLinksCache(cache)
      toast.success("Cotação aberta. Copie os links abaixo.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar cotação.")
    } finally {
      setCriando(false)
    }
  }

  if (!editavel && !cotacao) return null

  if (cotacao) {
    const fornecedoresCotacao =
      cotacao.fornecedores?.map((f) => ({
        id: f.id,
        nome: f.fornecedor.razaoSocial,
        status: f.status,
      })) ?? []

    return (
      <div className="space-y-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" />
              Cotação em andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-medium">{cotacao.numero}</p>
              <p className="text-xs text-muted-foreground">
                Acompanhe respostas, escolha vencedores e gere pedidos na tela da cotação.
              </p>
            </div>
            <Badge variant="outline">{cotacao.status}</Badge>
            <Button asChild className="ml-auto">
              <Link href={`/compras/cotacoes/${cotacao.id}`}>
                Abrir cotação <ExternalLink className="size-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {fornecedoresCotacao.length > 0 && onGerarLink && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Links para enviar aos fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <LinksFornecedores
                fornecedores={fornecedoresCotacao}
                linksCache={linksCache}
                onCopiar={(id, nome) => void copiarLinkPortal(id, nome)}
                copiado={copiado}
              />
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  if (itensMarcados > 0 && itensElegiveis === 0) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-6 text-center text-sm">
          <p className="font-medium">{itensMarcados} item(ns) marcado(s)</p>
          <p className="text-muted-foreground mt-1">
            Nenhum está pronto para cotação. Defina quantidade &gt; 0 e vincule produtos na importação.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (itensElegiveis === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Marque itens na matriz (coluna ✓), defina quantidades e vincule produtos para liberar pedido ou cotação.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Finalizar compra</h2>
        <p className="text-sm text-muted-foreground">
          {itensElegiveis} item(ns) pronto(s) para compra. Escolha como fechar:
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="size-4 text-green-600" />
              Pedido direto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Usa os preços já importados nas planilhas. Mais rápido, sem negociação.
            </p>
            <Button className="w-full" onClick={onGerarPedidos} disabled={gerandoPedidos}>
              {gerandoPedidos ? "Gerando..." : "Gerar pedidos agora"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4 text-blue-600" />
              Cotação competitiva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envia link para fornecedores informarem preço. Você escolhe o vencedor depois.
            </p>

            <div className="rounded-md border p-3 space-y-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">Convidar fornecedores</p>
              {fornecedoresConvite.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Vincule importações de preço para listar fornecedores da matriz.
                </p>
              ) : (
                fornecedoresConvite.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                  >
                    <Checkbox
                      checked={selecionados.has(f.id)}
                      onCheckedChange={() => toggleFornecedor(f.id)}
                    />
                    <span className="truncate">{f.razaoSocial}</span>
                    {fornecedoresSugeridos.includes(f.id) && (
                      <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                        na matriz
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleAbrirCotacao}
              disabled={criando || selecionados.size === 0}
            >
              {criando ? "Abrindo..." : `Abrir cotação (${selecionados.size})`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {links.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Links para enviar aos fornecedores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {links.map((l) => {
              const nome = fornecedores.find((f) => f.id === l.fornecedorId)?.razaoSocial ?? "Fornecedor"
              return (
                <div
                  key={l.fornecedorId}
                  className="flex flex-wrap items-center gap-2 justify-between rounded-md border bg-background p-2"
                >
                  <span className="text-sm font-medium">{nome}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void copiarLinkPortal(l.fornecedorId, nome, l.token)}
                  >
                    {copiado === l.fornecedorId ? (
                      <>
                        <Check className="size-3 mr-1" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="size-3 mr-1" /> Copiar link
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground pt-1">
              Cada fornecedor recebe um link exclusivo. Após responder, acompanhe em Compras → Cotações.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
