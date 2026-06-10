"use client"

import { AppShell } from "@/components/app-shell"
import { listarAuditoriaCompra } from "@/lib/actions/compras/auditoria"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function AuditoriaComprasPage() {
  const { currentUser } = useAuth()

  const { data: logs } = useDataQuery({
    key: "auditoria-compras",
    fetcher: () => listarAuditoriaCompra(undefined, currentUser?.id),
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold">Auditoria — Compras</h1>
          <p className="text-muted-foreground text-sm mt-1">Rastreabilidade de ações no módulo de compras</p>
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold">Registros</h2></CardHeader>
          <CardContent className="space-y-2">
            {logs?.map((log) => (
              <div key={log.id} className="flex justify-between p-3 border rounded-lg text-sm">
                <div>
                  <Badge variant="outline">{log.acao}</Badge>
                  <span className="ml-2 text-muted-foreground">
                    {log.entidade} #{log.entidadeId}
                  </span>
                  {log.user && <span className="ml-2">— {log.user.nome}</span>}
                </div>
                <span className="text-muted-foreground">
                  {new Date(log.criadoEm).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
            {!logs?.length && (
              <p className="text-center text-muted-foreground py-8">Nenhum registro.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
