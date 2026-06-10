"use client"

import { AppShell } from "@/components/app-shell"
import { getCotacoesCompra } from "@/lib/actions/compras/cotacao"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function CotacoesPage() {
  const { currentUser } = useAuth()

  const { data: cotacoes } = useDataQuery({
    key: "cotacoes-compra",
    fetcher: () => getCotacoesCompra(currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold">Cotações</h1>
          <p className="text-muted-foreground text-sm mt-1">Cotações competitivas com fornecedores</p>
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold">Lista</h2></CardHeader>
          <CardContent className="space-y-2">
            {cotacoes?.map((c) => (
              <Link
                key={c.id}
                href={`/compras/cotacoes/${c.id}`}
                className="flex justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{c.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {c._count.itens} itens — {c.fornecedores.length} fornecedores
                  </p>
                </div>
                <Badge>{c.status}</Badge>
              </Link>
            ))}
            {!cotacoes?.length && (
              <p className="text-center text-muted-foreground py-8">Nenhuma cotação.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
