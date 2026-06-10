"use client"

import { AppShell } from "@/components/app-shell"
import { getPedidoCompraById, updatePedidoCompraStatus } from "@/lib/actions/compras/pedido-compra"
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
import type { StatusPedidoCompra } from "@prisma/client"

export default function PedidoCompraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const pedidoId = parseInt(id, 10)
  const { currentUser } = useAuth()

  const { data: pedido, refetch } = useDataQuery({
    key: `pedido-compra-${pedidoId}`,
    fetcher: () => getPedidoCompraById(pedidoId, currentUser?.id),
  })

  async function handleStatus(status: StatusPedidoCompra) {
    try {
      await updatePedidoCompraStatus(pedidoId, status, currentUser?.id)
      toast.success("Status atualizado.")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.")
    }
  }

  if (!pedido) return <AppShell><p>Carregando...</p></AppShell>

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
          <Badge>{pedido.status}</Badge>
          <Select onValueChange={(v) => handleStatus(v as StatusPedidoCompra)}>
            <SelectTrigger className="w-40 ml-auto"><SelectValue placeholder="Alterar status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="ENVIADO">Enviado</SelectItem>
              <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
              <SelectItem value="RECEBIDO_PARCIAL">Recebido parcial</SelectItem>
              <SelectItem value="RECEBIDO">Recebido</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Preço unit.</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.produto.codigo} — {i.descricao}</td>
                  <td className="p-2 text-right">{i.quantidade} {i.unidade}</td>
                  <td className="p-2 text-right">
                    {i.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="p-2 text-right">
                    {i.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold">
                <td colSpan={3} className="p-2 text-right">Total geral</td>
                <td className="p-2 text-right">
                  {pedido.totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
