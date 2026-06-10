"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

type PortalData = {
  fornecedor: string
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

export default function PortalCotacaoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [respostas, setRespostas] = useState<
    Record<number, { precoUnitario?: number; prazoEntregaDias?: number; quantidadeDisponivel?: number; observacao?: string }>
  >({})
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/cotacao/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
        const init: typeof respostas = {}
        d.itens.forEach((i: PortalData["itens"][0]) => {
          init[i.id] = {
            precoUnitario: i.resposta?.precoUnitario ?? undefined,
            prazoEntregaDias: i.resposta?.prazoEntregaDias ?? undefined,
            quantidadeDisponivel: i.resposta?.quantidadeDisponivel ?? undefined,
            observacao: i.resposta?.observacao ?? undefined,
          }
        })
        setRespostas(init)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(finalizar: boolean) {
    setEnviando(true)
    try {
      const payload = Object.entries(respostas).map(([cotacaoItemId, r]) => ({
        cotacaoItemId: parseInt(cotacaoItemId, 10),
        ...r,
      }))
      const res = await fetch(`/api/portal/cotacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: payload, finalizar }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(finalizar ? "Resposta enviada e bloqueada." : "Rascunho salvo.")
      if (finalizar) window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  if (!data) return <div className="min-h-screen flex items-center justify-center">Link inválido.</div>

  const readonly = data.bloqueado || data.expirado

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Portal de Cotação — {data.fornecedor}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.cotacao.numero} {data.cotacao.titulo && `— ${data.cotacao.titulo}`}
            </p>
            {data.expirado && <p className="text-destructive text-sm">Prazo expirado.</p>}
            {data.bloqueado && <p className="text-muted-foreground text-sm">Resposta já enviada.</p>}
          </CardHeader>
          <CardContent className="space-y-6">
            {data.itens.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <p className="font-medium">
                  {item.produto.codigo} — {item.produto.nome}
                </p>
                <p className="text-sm text-muted-foreground">
                  Quantidade solicitada: {item.quantidade} {item.unidade}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      disabled={readonly}
                      value={respostas[item.id]?.precoUnitario ?? ""}
                      onChange={(e) =>
                        setRespostas({
                          ...respostas,
                          [item.id]: { ...respostas[item.id], precoUnitario: +e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Prazo entrega (dias)</Label>
                    <Input
                      type="number"
                      disabled={readonly}
                      value={respostas[item.id]?.prazoEntregaDias ?? ""}
                      onChange={(e) =>
                        setRespostas({
                          ...respostas,
                          [item.id]: { ...respostas[item.id], prazoEntregaDias: +e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Qtd disponível</Label>
                    <Input
                      type="number"
                      disabled={readonly}
                      value={respostas[item.id]?.quantidadeDisponivel ?? ""}
                      onChange={(e) =>
                        setRespostas({
                          ...respostas,
                          [item.id]: { ...respostas[item.id], quantidadeDisponivel: +e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Observação</Label>
                    <Input
                      disabled={readonly}
                      value={respostas[item.id]?.observacao ?? ""}
                      onChange={(e) =>
                        setRespostas({
                          ...respostas,
                          [item.id]: { ...respostas[item.id], observacao: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            {!readonly && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleSubmit(false)} disabled={enviando}>
                  Salvar rascunho
                </Button>
                <Button onClick={() => handleSubmit(true)} disabled={enviando}>
                  Enviar resposta final
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
