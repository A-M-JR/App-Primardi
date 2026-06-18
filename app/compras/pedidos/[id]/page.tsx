"use client"

import { AppShell } from "@/components/app-shell"
import {
  getPedidoCompraById,
  updatePedidoCompraStatus,
  registrarRecebimento,
} from "@/lib/actions/compras/pedido-compra"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { use, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, FileSpreadsheet, PackageCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { StatusPedidoCompra } from "@prisma/client"
import { CompraHistorico } from "@/components/compras/compra-historico"
import { PedidoStatusStepper } from "@/components/compras/pedido-status-stepper"
import { exportPedidoCompraXlsx } from "@/lib/compras/pedido-export"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function PedidoCompraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const pedidoId = parseInt(id, 10)
  const { currentUser, can } = useAuth()
  const podeEditar = can("compras", "edit")
  const podeAprovar = can("compras", "approve")

  const [recebOpen, setRecebOpen] = useState(false)
  const [recebMap, setRecebMap] = useState<Record<number, string>>({})
  const [salvandoReceb, setSalvandoReceb] = useState(false)

  const { data: pedido, refetch } = useDataQuery({
    key: `pedido-compra-${pedidoId}`,
    fetcher: () => getPedidoCompraById(pedidoId, currentUser?.id),
  })

  async function handleStatus(status: StatusPedidoCompra) {
    // Recebimento passa pelo diálogo (registra quantidades + entrada no estoque).
    if (status === "RECEBIDO" || status === "RECEBIDO_PARCIAL") {
      abrirRecebimento()
      return
    }
    try {
      await updatePedidoCompraStatus(pedidoId, status, currentUser?.id)
      toast.success("Status atualizado.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  function abrirRecebimento() {
    if (!pedido) return
    const init: Record<number, string> = {}
    for (const i of pedido.itens) {
      const restante = Math.max(0, i.quantidade - (i.qtdRecebida ?? 0))
      init[i.id] = restante ? String(restante) : ""
    }
    setRecebMap(init)
    setRecebOpen(true)
  }

  async function confirmarRecebimento() {
    const recebimentos = Object.entries(recebMap)
      .map(([itemId, q]) => ({ itemId: Number(itemId), quantidade: parseFloat(q) || 0 }))
      .filter((r) => r.quantidade > 0)
    if (recebimentos.length === 0) {
      toast.error("Informe ao menos uma quantidade recebida.")
      return
    }
    setSalvandoReceb(true)
    try {
      await registrarRecebimento(pedidoId, recebimentos, currentUser?.id)
      toast.success("Recebimento registrado e estoque atualizado.")
      setRecebOpen(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar.")
    } finally {
      setSalvandoReceb(false)
    }
  }

  if (!pedido) return <AppShell><p>Carregando...</p></AppShell>

  const podeReceber = podeEditar && ["ENVIADO", "CONFIRMADO", "RECEBIDO_PARCIAL"].includes(pedido.status)

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras/pedidos"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{pedido.numero}</h1>
            <p className="text-sm text-muted-foreground">{pedido.fornecedor.razaoSocial}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {podeReceber && (
              <Button size="sm" className="gap-2" onClick={abrirRecebimento}>
                <PackageCheck className="size-4" /> Registrar recebimento
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportPedidoCompraXlsx(pedido)}>
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </Button>
          </div>
        </div>

        <PedidoStatusStepper
          status={pedido.status}
          onChange={handleStatus}
          disabled={!podeEditar}
          podeAprovar={podeAprovar}
        />

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Recebido</th>
                <th className="p-2 text-right">Preço unit.</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((i) => {
                const receb = i.qtdRecebida ?? 0
                const completo = receb >= i.quantidade
                const parcial = receb > 0 && !completo
                return (
                  <tr key={i.id} className="border-t">
                    <td className="p-2">{i.produto.codigo} — {i.descricao}</td>
                    <td className="p-2 text-right">{i.quantidade} {i.unidade}</td>
                    <td className="p-2 text-right">
                      <span
                        className={
                          completo
                            ? "text-emerald-600 font-medium"
                            : parcial
                              ? "text-amber-600 font-medium"
                              : "text-muted-foreground"
                        }
                      >
                        {receb}/{i.quantidade}
                      </span>
                    </td>
                    <td className="p-2 text-right">{brl(i.precoUnitario)}</td>
                    <td className="p-2 text-right">{brl(i.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold">
                <td colSpan={4} className="p-2 text-right">Total geral</td>
                <td className="p-2 text-right">{brl(pedido.totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <CompraHistorico contexto="pedido" id={pedidoId} />
      </div>

      {/* Diálogo de recebimento */}
      <Dialog open={recebOpen} onOpenChange={setRecebOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>Informe a quantidade recebida agora. Dá entrada no estoque.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-x-auto overflow-y-auto -mx-1 px-1">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Produto</th>
                  <th className="text-right py-1 w-16">Pedido</th>
                  <th className="text-right py-1 w-16">Já</th>
                  <th className="text-right py-1 w-24">Receber</th>
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((i) => {
                  const restante = Math.max(0, i.quantidade - (i.qtdRecebida ?? 0))
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="py-1.5 pr-2">
                        <p className="text-xs leading-tight">{i.descricao}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{i.produto.codigo}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{i.quantidade}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{i.qtdRecebida ?? 0}</td>
                      <td className="py-1.5 text-right">
                        <Input
                          type="number"
                          className="h-8 w-20 ml-auto text-right"
                          value={recebMap[i.id] ?? ""}
                          max={restante}
                          onChange={(e) => setRecebMap((p) => ({ ...p, [i.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecebOpen(false)} disabled={salvandoReceb}>
              Cancelar
            </Button>
            <Button onClick={confirmarRecebimento} disabled={salvandoReceb} className="gap-2">
              {salvandoReceb ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
