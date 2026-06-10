"use client"

import { AppShell } from "@/components/app-shell"
import { getCotacaoCompraById } from "@/lib/actions/compras/cotacao"
import {
  escolherFornecedorItem,
  aplicarVencedoresMenorPreco,
} from "@/lib/actions/compras/cotacao-escolha"
import { gerarPedidosCompraFromCotacao } from "@/lib/actions/compras/pedido-compra"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function CotacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const cotacaoId = parseInt(id, 10)
  const { currentUser } = useAuth()

  const { data: cot, refetch } = useDataQuery({
    key: `cotacao-${cotacaoId}`,
    fetcher: () => getCotacaoCompraById(cotacaoId, currentUser?.id),
  })

  async function handleEscolher(cotacaoItemId: number, respostaItemId: number) {
    try {
      await escolherFornecedorItem(cotacaoItemId, respostaItemId, undefined, currentUser?.id)
      toast.success("Vencedor escolhido.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  async function handleMenorPreco() {
    try {
      const res = await aplicarVencedoresMenorPreco(cotacaoId, currentUser?.id)
      toast.success(`${res.aplicados} vencedores aplicados.`)
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

  if (!cot) return <AppShell><p>Carregando...</p></AppShell>

  const fornecedores = cot.fornecedores

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras/cotacoes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{cot.numero}</h1>
            <Badge>{cot.status}</Badge>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={handleMenorPreco}>Menor preço</Button>
            <Button onClick={handleGerarPedidos}>Gerar pedidos</Button>
          </div>
        </div>

        <div className="text-sm space-y-1">
          <p className="font-medium">Fornecedores convidados:</p>
          {fornecedores.map((f) => (
            <p key={f.id}>
              {f.fornecedor.razaoSocial} — <Badge variant="outline">{f.status}</Badge>
              {f.tokenPrefix && <span className="text-muted-foreground ml-2">token: {f.tokenPrefix}...</span>}
            </p>
          ))}
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left sticky left-0 bg-muted/50">Produto</th>
                <th className="p-2 text-right">Qtd</th>
                {fornecedores.map((f) => (
                  <th key={f.id} className="p-2 text-center min-w-[120px]">
                    {f.fornecedor.razaoSocial}
                  </th>
                ))}
                <th className="p-2 text-left">Vencedor</th>
              </tr>
            </thead>
            <tbody>
              {cot.itens.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 sticky left-0 bg-background">
                    {item.produto.codigo} — {item.produto.nome}
                  </td>
                  <td className="p-2 text-right">{item.quantidade}</td>
                  {fornecedores.map((f) => {
                    const resp = item.respostas.find((r) => r.cotacaoFornecedorId === f.id)
                    return (
                      <td key={f.id} className="p-2 text-center">
                        {resp?.precoUnitario != null ? (
                          <button
                            type="button"
                            className={`hover:underline ${item.escolha?.respostaItemId === resp.id ? "text-green-600 font-bold" : ""}`}
                            onClick={() => handleEscolher(item.id, resp.id)}
                          >
                            {resp.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </button>
                        ) : "—"}
                      </td>
                    )
                  })}
                  <td className="p-2">
                    {item.escolha?.fornecedor.razaoSocial || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
