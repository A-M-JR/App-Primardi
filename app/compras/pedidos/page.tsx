"use client"

import { AppShell } from "@/components/app-shell"
import { getPedidosCompra } from "@/lib/actions/compras/pedido-compra"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function PedidosCompraPage() {
  const { currentUser } = useAuth()

  const { data: pedidos } = useDataQuery({
    key: "pedidos-compra",
    fetcher: () => getPedidosCompra(currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold">Pedidos de Compra</h1>
          <p className="text-muted-foreground text-sm mt-1">Pedidos auxiliares agrupados por fornecedor</p>
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold">Lista</h2></CardHeader>
          <CardContent className="space-y-2">
            {pedidos?.map((p) => (
              <Link
                key={p.id}
                href={`/compras/pedidos/${p.id}`}
                className="flex justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{p.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.fornecedor.razaoSocial} — {p._count.itens} itens
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-medium">
                    {p.totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <Badge>{p.status}</Badge>
                </div>
              </Link>
            ))}
            {!pedidos?.length && (
              <p className="text-center text-muted-foreground py-8">Nenhum pedido de compra.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
