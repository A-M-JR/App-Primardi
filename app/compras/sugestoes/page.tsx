"use client"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getSugestoesCompra,
  gerarSugestaoCompra,
  getCompraConfig,
  saveCompraConfig,
} from "@/lib/actions/compras/sugestao"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import Link from "next/link"
import { Plus, Settings } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import type { FonteConsumoCompra } from "@prisma/client"

export default function SugestoesPage() {
  const { currentUser } = useAuth()
  const [gerando, setGerando] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [mult, setMult] = useState(3)
  const [dias, setDias] = useState(90)
  const [fonte, setFonte] = useState<FonteConsumoCompra>("MOVIMENTACAO_ESTOQUE")

  const { data: sugestoes, refetch } = useDataQuery({
    key: "sugestoes-compra",
    fetcher: () => getSugestoesCompra(currentUser?.id),
  })

  useEffect(() => {
    getCompraConfig(currentUser?.id).then((c) => {
      setMult(c.multiplicadorConsumo)
      setDias(c.diasJanelaConsumo)
      setFonte(c.fonteConsumo)
    })
  }, [currentUser?.id])

  async function handleGerar() {
    setGerando(true)
    try {
      await gerarSugestaoCompra(currentUser?.id)
      toast.success("Sugestão gerada.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setGerando(false)
    }
  }

  async function handleSaveConfig() {
    try {
      await saveCompraConfig(
        { multiplicadorConsumo: mult, diasJanelaConsumo: dias, fonteConsumo: fonte },
        currentUser?.id
      )
      toast.success("Configuração salva.")
      setShowConfig(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Sugestão de Compra</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Fórmula: (média consumo × multiplicador) − estoque atual
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConfig(!showConfig)}>
              <Settings className="size-4 mr-2" /> Config
            </Button>
            <Button onClick={handleGerar} disabled={gerando}>
              <Plus className="size-4 mr-2" />
              {gerando ? "Gerando..." : "Gerar sugestão"}
            </Button>
          </div>
        </div>

        {showConfig && (
          <Card>
            <CardHeader><h2 className="font-semibold">Configuração</h2></CardHeader>
            <CardContent className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Multiplicador</Label>
                <Input type="number" value={mult} onChange={(e) => setMult(+e.target.value)} className="w-24" />
              </div>
              <div>
                <Label>Janela (dias)</Label>
                <Input type="number" value={dias} onChange={(e) => setDias(+e.target.value)} className="w-24" />
              </div>
              <div>
                <Label>Fonte consumo</Label>
                <Select value={fonte} onValueChange={(v) => setFonte(v as FonteConsumoCompra)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MOVIMENTACAO_ESTOQUE">Movimentação estoque</SelectItem>
                    <SelectItem value="ITEM_PEDIDO">Itens pedido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveConfig}>Salvar</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><h2 className="font-semibold">Histórico</h2></CardHeader>
          <CardContent className="space-y-2">
            {sugestoes?.map((s) => (
              <Link
                key={s.id}
                href={`/compras/sugestoes/${s.id}`}
                className="flex justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <span className="font-medium">{s.numero}</span>
                <div className="flex gap-3 items-center text-sm">
                  <span>{new Date(s.criadoEm).toLocaleDateString("pt-BR")}</span>
                  <Badge>{s.status}</Badge>
                </div>
              </Link>
            ))}
            {!sugestoes?.length && (
              <p className="text-center text-muted-foreground py-8">Nenhuma sugestão gerada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
