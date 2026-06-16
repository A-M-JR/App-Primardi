"use client"

import { useEffect, useMemo, useState } from "react"
import { use } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Building2, FileSpreadsheet, Search } from "lucide-react"
import { cn, maskCurrency } from "@/lib/utils"
import { parseMoney, parseNumber } from "@/lib/compras/normalize-text"

type CamposLinha = {
  preco: string
  prazo: string
  qtdDisp: string
  observacao: string
}

type PortalData = {
  fornecedor: string
  empresa: {
    nome: string
    razaoSocial: string
    logoUrl: string | null
    corPrimaria: string | null
    telefone: string
    email: string
    cidade: string
    estado: string
  } | null
  cotacao: { numero: string; titulo: string | null; prazoResposta: string | null }
  itens: {
    id: number
    produto: { codigo: string; nome: string }
    quantidade: number
    unidade: string
    resposta: {
      precoUnitario: number | null
      prazoEntregaDias: number | null
      quantidadeDisponivel: number | null
      observacao: string | null
    } | null
  }[]
  bloqueado: boolean
  expirado: boolean
}

const cellInput =
  "h-8 w-full min-w-0 rounded-none border-0 border-b border-slate-300 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:border-slate-600 disabled:opacity-70 disabled:cursor-not-allowed"

function maskInteger(value: string): string {
  return value.replace(/\D/g, "")
}

function maskQuantidade(value: string): string {
  let v = value.replace(/[^\d,]/g, "")
  const idx = v.indexOf(",")
  if (idx >= 0) {
    v = v.slice(0, idx + 1) + v.slice(idx + 1).replace(/,/g, "")
  }
  return v
}

function numToPrecoDisplay(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return ""
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function numToQuantidadeDisplay(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return ""
  const s = String(n)
  return s.includes(".") ? s.replace(".", ",") : s
}

function initCamposFromItem(item: PortalData["itens"][0]): CamposLinha {
  const r = item.resposta
  return {
    preco: numToPrecoDisplay(r?.precoUnitario),
    prazo: r?.prazoEntregaDias != null ? String(r.prazoEntregaDias) : "",
    qtdDisp: numToQuantidadeDisplay(r?.quantidadeDisponivel),
    observacao: r?.observacao ?? "",
  }
}

function camposToPayload(campos: Record<number, CamposLinha>) {
  return Object.entries(campos).map(([id, c]) => {
    const preco = parseMoney(c.preco)
    const prazo = c.prazo ? parseInt(c.prazo, 10) : undefined
    const qtd = parseNumber(c.qtdDisp)
    return {
      cotacaoItemId: parseInt(id, 10),
      precoUnitario: preco ?? undefined,
      prazoEntregaDias: prazo != null && !Number.isNaN(prazo) ? prazo : undefined,
      quantidadeDisponivel: qtd ?? undefined,
      observacao: c.observacao.trim() || undefined,
    }
  })
}

export default function PortalCotacaoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [campos, setCampos] = useState<Record<number, CamposLinha>>({})
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState("")

  useEffect(() => {
    fetch(`/api/portal/cotacao/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
        const init: Record<number, CamposLinha> = {}
        d.itens.forEach((i: PortalData["itens"][0]) => {
          init[i.id] = initCamposFromItem(i)
        })
        setCampos(init)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const itensFiltrados = useMemo(() => {
    if (!data) return []
    const q = busca.trim().toLowerCase()
    if (!q) return data.itens
    return data.itens.filter(
      (i) =>
        i.produto.nome.toLowerCase().includes(q) ||
        i.produto.codigo.toLowerCase().includes(q)
    )
  }, [data, busca])

  function atualizarCampo(itemId: number, campo: keyof CamposLinha, valor: string) {
    setCampos((prev) => {
      const atual = prev[itemId] ?? { preco: "", prazo: "", qtdDisp: "", observacao: "" }
      let mascarado = valor
      if (campo === "preco") mascarado = maskCurrency(valor, 2)
      if (campo === "prazo") mascarado = maskInteger(valor)
      if (campo === "qtdDisp") mascarado = maskQuantidade(valor)
      return { ...prev, [itemId]: { ...atual, [campo]: mascarado } }
    })
  }

  async function handleSubmit(finalizar: boolean) {
    setEnviando(true)
    try {
      const payload = camposToPayload(campos)
      const res = await fetch(`/api/portal/cotacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: payload, finalizar }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(finalizar ? "Cotação enviada com sucesso." : "Rascunho salvo.")
      if (finalizar) window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 text-sm">
        Carregando cotação...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 text-sm">
        Link inválido ou expirado.
      </div>
    )
  }

  const readonly = data.bloqueado || data.expirado
  const corHeader = data.empresa?.corPrimaria || "#1e293b"
  const empresaNome = data.empresa?.nome ?? "Cotação de compras"

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Cabeçalho corporativo */}
      <header className="text-white shadow-md" style={{ backgroundColor: corHeader }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            {data.empresa?.logoUrl ? (
              <img
                src={data.empresa.logoUrl}
                alt={empresaNome}
                className="h-12 w-auto max-w-[160px] object-contain bg-white/10 rounded px-2 py-1"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-white/15">
                <Building2 className="size-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{empresaNome}</h1>
              {data.empresa && (
                <p className="text-white/80 text-xs sm:text-sm mt-0.5">
                  {data.empresa.cidade}/{data.empresa.estado}
                  {data.empresa.telefone && ` · ${data.empresa.telefone}`}
                  {data.empresa.email && ` · ${data.empresa.email}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Info da cotação */}
        <div className="bg-white border border-slate-200 rounded-md shadow-sm px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-800">
                <FileSpreadsheet className="size-4 text-slate-500" />
                <span className="font-semibold">Planilha de cotação</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">{data.cotacao.numero}</span>
                {data.cotacao.titulo && ` — ${data.cotacao.titulo}`}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Fornecedor: <span className="font-medium text-slate-700">{data.fornecedor}</span>
              </p>
            </div>
            <div className="text-right text-sm">
              {data.cotacao.prazoResposta && (
                <p className="text-slate-600">
                  Responder até{" "}
                  <span className="font-semibold text-slate-800">
                    {new Date(data.cotacao.prazoResposta).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              )}
              <p className="text-slate-500 mt-1">{data.itens.length} item(ns)</p>
            </div>
          </div>

          {data.expirado && (
            <p className="mt-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              Prazo de resposta expirado. Entre em contato com a empresa solicitante.
            </p>
          )}
          {data.bloqueado && !data.expirado && (
            <p className="mt-3 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              Sua resposta foi enviada. Os valores abaixo estão bloqueados para edição.
            </p>
          )}
        </div>

        {/* Busca */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 bg-white border-slate-200"
          />
        </div>

        {/* Tabela estilo Excel */}
        <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[960px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  <th className="border-r border-slate-300 px-2 py-2.5 w-10 text-center">#</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 w-24 text-left">Código</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 min-w-[200px] text-left">Produto</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 w-16 text-center">Qtd</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 w-28 text-center">Preço (R$)</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 w-20 text-center">Prazo (dias)</th>
                  <th className="border-r border-slate-300 px-2 py-2.5 w-20 text-center">Qtd disp.</th>
                  <th className="px-2 py-2.5 min-w-[180px] text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-slate-200 hover:bg-slate-50/80",
                        idx % 2 === 1 && "bg-slate-50/40"
                      )}
                    >
                      <td className="border-r border-slate-200 px-2 py-1 text-center text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-200 px-2 py-1 font-mono text-xs text-slate-800 align-middle">
                        {item.produto.codigo}
                      </td>
                      <td className="border-r border-slate-200 px-2 py-1 text-slate-800 align-middle leading-snug">
                        {item.produto.nome}
                      </td>
                      <td className="border-r border-slate-200 px-2 py-1 text-center tabular-nums font-medium align-middle">
                        {item.quantidade}
                        <span className="text-[10px] text-slate-500 ml-0.5">{item.unidade}</span>
                      </td>
                      <td className="border-r border-slate-200 px-1 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="decimal"
                          disabled={readonly}
                          className={cn(cellInput, "text-right tabular-nums")}
                          placeholder="0,00"
                          value={campos[item.id]?.preco ?? ""}
                          onChange={(e) => atualizarCampo(item.id, "preco", e.target.value)}
                        />
                      </td>
                      <td className="border-r border-slate-200 px-1 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="numeric"
                          disabled={readonly}
                          className={cn(cellInput, "text-center tabular-nums")}
                          placeholder="0"
                          value={campos[item.id]?.prazo ?? ""}
                          onChange={(e) => atualizarCampo(item.id, "prazo", e.target.value)}
                        />
                      </td>
                      <td className="border-r border-slate-200 px-1 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="decimal"
                          disabled={readonly}
                          className={cn(cellInput, "text-center tabular-nums")}
                          placeholder="0"
                          value={campos[item.id]?.qtdDisp ?? ""}
                          onChange={(e) => atualizarCampo(item.id, "qtdDisp", e.target.value)}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-middle">
                        <Input
                          type="text"
                          disabled={readonly}
                          className={cellInput}
                          placeholder="—"
                          value={campos[item.id]?.observacao ?? ""}
                          onChange={(e) => atualizarCampo(item.id, "observacao", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!readonly && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-md px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">
              Preencha as colunas e envie. Você pode salvar rascunho e continuar depois.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-slate-300"
                onClick={() => handleSubmit(false)}
                disabled={enviando}
              >
                {enviando ? "Salvando..." : "Salvar rascunho"}
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={enviando}
                style={{ backgroundColor: corHeader }}
                className="text-white hover:opacity-90"
              >
                {enviando ? "Enviando..." : "Enviar cotação"}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 pb-4">
          Portal de cotação · {empresaNome}
        </p>
      </main>
    </div>
  )
}
