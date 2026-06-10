"use client"

import { AppShell } from "@/components/app-shell"
import { getImportacaoDetalhe } from "@/lib/actions/compras/importacao"
import { vincularProdutoManual } from "@/lib/actions/compras/produto-match"
import { getProdutos } from "@/lib/actions/produtos"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useState } from "react"

export default function ImportacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const importacaoId = parseInt(id, 10)
  const { currentUser } = useAuth()
  const [vinculando, setVinculando] = useState<number | null>(null)
  const [produtoSel, setProdutoSel] = useState<Record<number, string>>({})

  const { data: imp, refetch } = useDataQuery({
    key: `importacao-${importacaoId}`,
    fetcher: () => getImportacaoDetalhe(importacaoId, currentUser?.id),
  })

  const { data: produtos } = useDataQuery({
    key: "produtos-vinculo",
    fetcher: () => getProdutos(),
  })

  async function handleVincular(linhaId: number) {
    const pid = produtoSel[linhaId]
    if (!pid) return toast.error("Selecione um produto.")
    setVinculando(linhaId)
    try {
      await vincularProdutoManual(linhaId, parseInt(pid, 10), currentUser?.id)
      toast.success("Produto vinculado.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setVinculando(null)
    }
  }

  if (!imp) return <AppShell><p>Carregando...</p></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras/importacoes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{imp.nomeArquivo}</h1>
            <p className="text-sm text-muted-foreground">
              {imp.fornecedor.razaoSocial} — {imp.totalLinhas} linhas — {imp.linhasVinculadas} vinculadas
            </p>
          </div>
          <Badge>{imp.status}</Badge>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Linha</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">EAN</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-right">Preço</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {imp.linhas.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.numeroLinha}</td>
                  <td className="p-2">{l.codigoFornecedor}</td>
                  <td className="p-2">{l.ean}</td>
                  <td className="p-2 max-w-[200px] truncate">{l.descricao}</td>
                  <td className="p-2 text-right">
                    {l.preco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="p-2">
                    <Badge variant={l.status === "ERRO" ? "destructive" : "secondary"}>{l.status}</Badge>
                    {l.erroMensagem && (
                      <p className="text-xs text-destructive mt-1">{l.erroMensagem}</p>
                    )}
                  </td>
                  <td className="p-2">
                    {l.produto ? `${l.produto.codigo} — ${l.produto.nome}` : "—"}
                  </td>
                  <td className="p-2">
                    {!l.produtoId && l.status === "VALIDA" && (
                      <div className="flex gap-1">
                        <Select
                          value={produtoSel[l.id] || ""}
                          onValueChange={(v) => setProdutoSel({ ...produtoSel, [l.id]: v })}
                        >
                          <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Produto" /></SelectTrigger>
                          <SelectContent>
                            {produtos?.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.codigo} — {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={vinculando === l.id}
                          onClick={() => handleVincular(l.id)}
                        >
                          Vincular
                        </Button>
                      </div>
                    )}
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
