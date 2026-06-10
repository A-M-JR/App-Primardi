"use client"

import { AppShell } from "@/components/app-shell"
import { getComparativoPrecos } from "@/lib/actions/compras/precos"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useMemo, useState } from "react"
import { Trophy, Search } from "lucide-react"

export default function ComparativoPage() {
  const { currentUser } = useAuth()
  const [busca, setBusca] = useState("")
  const [apenasComparaveis, setApenasComparaveis] = useState(true)

  const { data: comparativo, isLoading } = useDataQuery({
    key: `comparativo-precos-${apenasComparaveis}`,
    fetcher: () =>
      getComparativoPrecos({ apenasComparaveis }, currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-comparativo",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  const filtrado = useMemo(() => {
    if (!comparativo) return []
    const q = busca.toLowerCase().trim()
    if (!q) return comparativo
    return comparativo.filter(
      (item) =>
        item.produto?.nome.toLowerCase().includes(q) ||
        item.produto?.codigo.toLowerCase().includes(q) ||
        item.ean?.includes(q) ||
        item.descricao?.toLowerCase().includes(q) ||
        item.melhorFornecedor?.razaoSocial.toLowerCase().includes(q)
    )
  }, [comparativo, busca])

  const fornecedorCols = fornecedores ?? []

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Comparativo de Preços</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Produtos iguais (por cadastro interno ou EAN) entre tabelas importadas — destaca menor preço
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, código ou EAN..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="comparaveis"
              checked={apenasComparaveis}
              onCheckedChange={setApenasComparaveis}
            />
            <Label htmlFor="comparaveis">Só produtos em 2+ fornecedores</Label>
          </div>
          {comparativo && (
            <Badge variant="secondary">
              {filtrado.length} produto(s) · {filtrado.filter((i) => i.comparavel).length} comparáveis
            </Badge>
          )}
        </div>

        {isLoading && <p>Carregando...</p>}

        {!isLoading && filtrado.length > 0 && fornecedorCols.length > 0 && (
          <Card className="hidden lg:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visão matriz</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2 text-left sticky left-0 bg-muted/40 min-w-[200px]">Produto</th>
                    <th className="p-2 text-left">EAN</th>
                    {fornecedorCols.map((f) => (
                      <th key={f.id} className="p-2 text-right min-w-[100px]">{f.razaoSocial}</th>
                    ))}
                    <th className="p-2 text-right">Menor</th>
                    <th className="p-2 text-left">Melhor fornecedor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrado.map((item) => (
                    <tr key={item.chave} className="border-b hover:bg-muted/20">
                      <td className="p-2 sticky left-0 bg-background">
                        <div className="font-medium">
                          {item.produto
                            ? `${item.produto.codigo} — ${item.produto.nome}`
                            : item.descricao ?? "Sem vínculo interno"}
                        </div>
                        {item.comparavel && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {item.qtdFornecedores} fornecedores
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground font-mono text-xs">
                        {item.ean ?? item.produto?.ean ?? "—"}
                      </td>
                      {fornecedorCols.map((f) => {
                        const preco = item.fornecedores.find((p) => p.fornecedorId === f.id)
                        const isMenor = preco?.preco === item.menorPreco && item.comparavel
                        return (
                          <td
                            key={f.id}
                            className={`p-2 text-right ${isMenor ? "text-green-600 font-bold bg-green-50 dark:bg-green-950/30" : ""}`}
                          >
                            {preco
                              ? preco.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "—"}
                          </td>
                        )
                      })}
                      <td className="p-2 text-right font-semibold text-green-600">
                        {item.menorPreco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"}
                      </td>
                      <td className="p-2">
                        {item.melhorFornecedor ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                            <Trophy className="size-3.5" />
                            {item.melhorFornecedor.razaoSocial}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:hidden">
          {filtrado.map((item) => (
            <Card key={item.chave}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {item.produto
                    ? `${item.produto.codigo} — ${item.produto.nome}`
                    : item.descricao ?? "Produto importado"}
                </CardTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.ean && <span>EAN: {item.ean}</span>}
                  {item.comparavel && (
                    <Badge variant="secondary">{item.qtdFornecedores} fornecedores</Badge>
                  )}
                </div>
                {item.melhorFornecedor && item.menorPreco !== null && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1 mt-1">
                    <Trophy className="size-4" />
                    Menor: {item.menorPreco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    {" — "}{item.melhorFornecedor.razaoSocial}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-2 text-left">Fornecedor</th>
                      <th className="pb-2 text-right">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.fornecedores.map((f) => (
                      <tr
                        key={f.fornecedorId}
                        className={f.preco === item.menorPreco && item.comparavel ? "text-green-600 font-medium" : ""}
                      >
                        <td className="py-1">{f.fornecedor.razaoSocial}</td>
                        <td className="py-1 text-right">
                          {f.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && !filtrado.length && (
          <p className="text-center text-muted-foreground py-12">
            {apenasComparaveis
              ? "Nenhum produto encontrado em 2+ fornecedores. Importe tabelas com mesmo produto (EAN ou vínculo interno) ou desative o filtro."
              : "Nenhum preço importado. Configure e importe tabelas de fornecedores primeiro."}
          </p>
        )}
      </div>
    </AppShell>
  )
}
