"use client"

import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import { ACAO_LABELS, formatDetalhesAuditoria } from "@/lib/compras/auditoria-labels"
import {
  listarAuditoriaImportacao,
  listarAuditoriaCotacao,
  listarAuditoriaPedido,
  listarAuditoriaPlanejamento,
} from "@/lib/actions/compras/auditoria"

type Contexto = "importacao" | "cotacao" | "pedido" | "planejamento"

const FETCHERS = {
  importacao: listarAuditoriaImportacao,
  cotacao: listarAuditoriaCotacao,
  pedido: listarAuditoriaPedido,
  planejamento: listarAuditoriaPlanejamento,
} as const

type Props = {
  contexto: Contexto
  id: number
}

export function CompraHistorico({ contexto, id }: Props) {
  const { currentUser } = useAuth()

  const { data: logs } = useDataQuery({
    key: `compra-historico-${contexto}-${id}`,
    fetcher: () => FETCHERS[contexto](id, currentUser?.id),
  })

  if (!logs?.length) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="size-4" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
        {logs.map((log) => {
          const detalhe = formatDetalhesAuditoria(log.acao, log.detalhes)
          const autor = log.user?.nome ?? (log.acao === "RESPONDER_COTACAO" ? "Fornecedor (portal)" : "Sistema")

          return (
            <div
              key={log.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2.5 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ACAO_LABELS[log.acao] ?? log.acao}</Badge>
                  <span className="text-muted-foreground">{autor}</span>
                </div>
                {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {new Date(log.criadoEm).toLocaleString("pt-BR")}
              </time>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
