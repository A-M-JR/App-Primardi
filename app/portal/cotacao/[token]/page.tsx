"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { use } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Building2,
  FileSpreadsheet,
  Search,
  Loader2,
  CheckCircle2,
  Send,
  ShieldCheck,
  Clock,
  Lock,
} from "lucide-react"
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

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

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
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)

  const dirtyRef = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const resumo = useMemo(() => {
    if (!data) return { preenchidos: 0, total: 0, totalItens: 0 }
    let preenchidos = 0
    let total = 0
    for (const it of data.itens) {
      const p = parseMoney(campos[it.id]?.preco ?? "")
      if (p && p > 0) {
        preenchidos++
        total += p * it.quantidade
      }
    }
    return { preenchidos, total, totalItens: data.itens.length }
  }, [data, campos])

  const precoPreenchido = (itemId: number) => {
    const p = parseMoney(campos[itemId]?.preco ?? "")
    return !!p && p > 0
  }

  function atualizarCampo(itemId: number, campo: keyof CamposLinha, valor: string) {
    dirtyRef.current = true
    setCampos((prev) => {
      const atual = prev[itemId] ?? { preco: "", prazo: "", qtdDisp: "", observacao: "" }
      let mascarado = valor
      if (campo === "preco") mascarado = maskCurrency(valor, 2)
      if (campo === "prazo") mascarado = maskInteger(valor)
      if (campo === "qtdDisp") mascarado = maskQuantidade(valor)
      return { ...prev, [itemId]: { ...atual, [campo]: mascarado } }
    })
  }

  // Auto-salva rascunho 2s após a última edição (rede de segurança contra perda).
  useEffect(() => {
    const readonly = data ? data.bloqueado || data.expirado : true
    if (readonly || !dirtyRef.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      setSalvandoRascunho(true)
      try {
        await fetch(`/api/portal/cotacao/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ respostas: camposToPayload(campos), finalizar: false }),
        })
        setSalvoEm(new Date())
      } catch {
        /* silencioso — usuário ainda pode enviar manualmente */
      } finally {
        setSalvandoRascunho(false)
      }
    }, 2000)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [campos, data, token])

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
      else setSalvoEm(new Date())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600 text-sm">
        <Loader2 className="size-7 animate-spin text-slate-400" />
        Carregando cotação...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600 text-sm px-6 text-center">
        <Lock className="size-8 text-slate-400" />
        Link inválido ou expirado. Entre em contato com a empresa solicitante.
      </div>
    )
  }

  const readonly = data.bloqueado || data.expirado
  const cor = data.empresa?.corPrimaria || "#0f172a"
  const empresaNome = data.empresa?.nome ?? "Cotação de compras"
  const pct = resumo.totalItens ? (resumo.preenchidos / resumo.totalItens) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Cabeçalho corporativo */}
      <header className="text-white" style={{ backgroundColor: cor }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-4">
            {data.empresa?.logoUrl ? (
              <img
                src={data.empresa.logoUrl}
                alt={empresaNome}
                className="h-12 w-auto max-w-[160px] object-contain bg-white/10 rounded-lg px-2 py-1"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 shrink-0">
                <Building2 className="size-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{empresaNome}</h1>
              <p className="text-white/70 text-xs sm:text-sm">Portal de cotação a fornecedores</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/80 bg-white/10 rounded-full px-3 py-1">
              <ShieldCheck className="size-3.5" /> Conexão segura
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Resumo da cotação */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-slate-800">
                <FileSpreadsheet className="size-4 text-slate-500" />
                <span className="font-semibold">{data.cotacao.numero}</span>
                {data.cotacao.titulo && <span className="text-slate-500 text-sm">— {data.cotacao.titulo}</span>}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Olá, <span className="font-medium text-slate-700">{data.fornecedor}</span> — informe seus preços abaixo.
              </p>
            </div>
            {data.cotacao.prazoResposta && (
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Clock className="size-3.5 text-slate-400" />
                Responder até{" "}
                <span className="font-semibold text-slate-800">
                  {new Date(data.cotacao.prazoResposta).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          {/* Progresso + total */}
          <div className="mt-4">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2
                  className={cn(
                    "size-3.5",
                    resumo.preenchidos === resumo.totalItens && resumo.totalItens > 0
                      ? "text-emerald-500"
                      : "text-slate-400"
                  )}
                />
                {resumo.preenchidos} de {resumo.totalItens} itens com preço
              </span>
              <span>
                Total estimado: <span className="font-semibold text-slate-800">{brl(resumo.total)}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {data.expirado && (
            <p className="mt-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Prazo de resposta expirado. Entre em contato com a empresa solicitante.
            </p>
          )}
          {data.bloqueado && !data.expirado && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="size-4" /> Resposta enviada. Os valores abaixo estão bloqueados para edição.
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

        {itensFiltrados.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-500 text-sm">
            Nenhum produto encontrado.
          </div>
        ) : (
          <>
            {/* DESKTOP: tabela estilo planilha */}
            <div className="hidden md:block bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
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
                    {itensFiltrados.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b border-slate-200 hover:bg-slate-50/80 transition-colors",
                          idx % 2 === 1 && "bg-slate-50/40",
                          precoPreenchido(item.id) && "bg-emerald-50/60 hover:bg-emerald-50"
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
                            enterKeyHint="next"
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
                            enterKeyHint="next"
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
                            enterKeyHint="next"
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE: um card por item */}
            <div className="md:hidden space-y-3">
              {itensFiltrados.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border bg-white p-3 shadow-sm",
                    precoPreenchido(item.id) ? "border-emerald-300" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm leading-snug">{item.produto.nome}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{item.produto.codigo}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-600 bg-slate-100 rounded px-2 py-1 tabular-nums">
                      {item.quantidade} {item.unidade}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                    <label className="text-xs text-slate-500">
                      Preço unit. (R$)
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readonly}
                        className="mt-1 h-9 text-right tabular-nums bg-white"
                        placeholder="0,00"
                        value={campos[item.id]?.preco ?? ""}
                        onChange={(e) => atualizarCampo(item.id, "preco", e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      Prazo (dias)
                      <Input
                        type="text"
                        inputMode="numeric"
                        disabled={readonly}
                        className="mt-1 h-9 text-center tabular-nums bg-white"
                        placeholder="0"
                        value={campos[item.id]?.prazo ?? ""}
                        onChange={(e) => atualizarCampo(item.id, "prazo", e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      Qtd disponível
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readonly}
                        className="mt-1 h-9 text-center tabular-nums bg-white"
                        placeholder="0"
                        value={campos[item.id]?.qtdDisp ?? ""}
                        onChange={(e) => atualizarCampo(item.id, "qtdDisp", e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-500 col-span-2">
                      Observação
                      <Input
                        type="text"
                        disabled={readonly}
                        className="mt-1 h-9 bg-white"
                        placeholder="—"
                        value={campos[item.id]?.observacao ?? ""}
                        onChange={(e) => atualizarCampo(item.id, "observacao", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-center text-[11px] text-slate-400 pb-24 pt-2">
          Portal de cotação · {empresaNome}
          {data.empresa?.telefone && ` · ${data.empresa.telefone}`}
        </p>
      </main>

      {/* Barra de ação fixa */}
      {!readonly && (
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-slate-500">{resumo.preenchidos}/{resumo.totalItens} itens · </span>
              <span className="font-semibold text-slate-800">{brl(resumo.total)}</span>
              <span className="block text-[11px] text-slate-400">
                {salvandoRascunho
                  ? "Salvando rascunho..."
                  : salvoEm
                    ? `Rascunho salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Salva automaticamente enquanto você preenche"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-slate-300 gap-2"
                onClick={() => handleSubmit(false)}
                disabled={enviando}
              >
                {enviando && <Loader2 className="size-4 animate-spin" />}
                Salvar rascunho
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={enviando || resumo.preenchidos === 0}
                style={{ backgroundColor: cor }}
                className="text-white hover:opacity-90 gap-2"
              >
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar cotação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
