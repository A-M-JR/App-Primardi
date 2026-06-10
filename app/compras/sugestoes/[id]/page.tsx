"use client"

import { AppShell } from "@/components/app-shell"
import {
  getSugestaoCompraById,
  ajustarSugestaoItem,
  aprovarSugestaoCompra,
} from "@/lib/actions/compras/sugestao"
import { criarCotacaoFromSugestao } from "@/lib/actions/compras/cotacao"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SugestaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const sugestaoId = parseInt(id, 10)
  const { currentUser } = useAuth()
  const [fornecedorIds, setFornecedorIds] = useState<string[]>([])
  const [criandoCotacao, setCriandoCotacao] = useState(false)
  const [tokens, setTokens] = useState<{ fornecedorId: number; token: string }[]>([])

  const { data: sug, refetch } = useDataQuery({
    key: `sugestao-${sugestaoId}`,
    fetcher: () => getSugestaoCompraById(sugestaoId, currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-cotacao",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  async function handleAjustar(itemId: number, qtd: number) {
    await ajustarSugestaoItem(itemId, { quantidadeAjustada: qtd }, currentUser?.id)
    refetch()
  }

  async function handleAprovar() {
    try {
      await aprovarSugestaoCompra(sugestaoId, currentUser?.id)
      toast.success("Sugestão aprovada.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleCriarCotacao() {
    if (!fornecedorIds.length) return toast.error("Selecione fornecedores.")
    setCriandoCotacao(true)
    try {
      const res = await criarCotacaoFromSugestao(
        sugestaoId,
        fornecedorIds.map(Number),
        undefined,
        currentUser?.id
      )
      setTokens(res.tokens)
      toast.success("Cotação criada.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setCriandoCotacao(false)
    }
  }

  if (!sug) return <AppShell><p>Carregando...</p></AppShell>

  const editavel = !["APROVADA", "CONVERTIDA", "EM_COTACAO"].includes(sug.status)

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras/sugestoes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sug.numero}</h1>
            <Badge>{sug.status}</Badge>
          </div>
          {editavel && (
            <Button onClick={handleAprovar} className="ml-auto">Aprovar</Button>
          )}
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Estoque</th>
                <th className="p-2 text-right">Média/dia</th>
                <th className="p-2 text-right">Sugerido</th>
                <th className="p-2 text-right">Ajustado</th>
                <th className="p-2">Incluir</th>
              </tr>
            </thead>
            <tbody>
              {sug.itens.filter((i) => i.incluir || i.quantidadeSugerida > 0).map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.produto.codigo} — {i.produto.nome}</td>
                  <td className="p-2 text-right">{i.estoqueAtual}</td>
                  <td className="p-2 text-right">{i.mediaConsumo.toFixed(2)}</td>
                  <td className="p-2 text-right">{i.quantidadeSugerida.toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {editavel ? (
                      <Input
                        type="number"
                        className="w-20 h-8 ml-auto"
                        defaultValue={i.quantidadeAjustada ?? i.quantidadeSugerida}
                        onBlur={(e) => handleAjustar(i.id, +e.target.value)}
                      />
                    ) : (
                      (i.quantidadeAjustada ?? i.quantidadeSugerida).toFixed(2)
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox checked={i.incluir} disabled={!editavel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sug.status === "APROVADA" && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Criar cotação competitiva</h3>
            <Select
              onValueChange={(v) => {
                if (!fornecedorIds.includes(v)) setFornecedorIds([...fornecedorIds, v])
              }}
            >
              <SelectTrigger className="w-64"><SelectValue placeholder="Adicionar fornecedor" /></SelectTrigger>
              <SelectContent>
                {fornecedores?.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.razaoSocial}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {fornecedorIds.map((fid) => (
                <Badge key={fid} variant="secondary">
                  {fornecedores?.find((f) => f.id === +fid)?.razaoSocial}
                </Badge>
              ))}
            </div>
            <Button onClick={handleCriarCotacao} disabled={criandoCotacao}>
              {criandoCotacao ? "Criando..." : "Abrir cotação"}
            </Button>
            {tokens.length > 0 && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Links do portal (copie e envie):</p>
                {tokens.map((t) => (
                  <p key={t.fornecedorId} className="font-mono text-xs break-all bg-muted p-2 rounded">
                    {typeof window !== "undefined" ? window.location.origin : ""}/portal/cotacao/{t.token}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
