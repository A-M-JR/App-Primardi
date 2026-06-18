"use client"

import { useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import { getComprasDashboard } from "@/lib/actions/compras/dashboard"
import { STATUS_PEDIDO_OPTS, labelStatus } from "@/lib/compras/list-filters"
import {
  ShoppingCart,
  FileText,
  AlertTriangle,
  Clock,
  Loader2,
  ShieldAlert,
  Banknote,
} from "lucide-react"
import dynamic from "next/dynamic"

// Gráfico carregado sob demanda — tira o recharts do bundle inicial da rota.
const GastoChart = dynamic(() => import("@/components/compras/gasto-chart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-muted/40" />,
})

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const STATUS_COR: Record<string, string> = {
  RASCUNHO: "#888780",
  AGUARDANDO_APROVACAO: "#EF9F27",
  ENVIADO: "#BA7517",
  CONFIRMADO: "#378ADD",
  RECEBIDO_PARCIAL: "#7F77DD",
  RECEBIDO: "#1D9E75",
  CANCELADO: "#E24B4A",
}

export default function ComprasDashboardPage() {
  const { can, isLoading: authLoading } = useAuth()
  const [dias, setDias] = useState(30)

  const { data, isLoading } = useDataQuery({
    key: `compras-dashboard-${dias}`,
    fetcher: () => getComprasDashboard(dias),
    enabled: can("compras"),
  })

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!can("compras")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center">
          <ShieldAlert className="size-10 text-destructive/70" />
          <p className="text-lg font-semibold">Sem acesso ao módulo de Compras</p>
        </div>
      </AppShell>
    )
  }

  const maxStatus = Math.max(1, ...(data?.statusCounts.map((s) => s.count) ?? [1]))
  const maxForn = Math.max(1, ...(data?.topFornecedores.map((f) => f.total) ?? [1]))
  const chartData = (data?.gastoPorMes ?? []).map((m) => ({
    mes: MESES[parseInt(m.mes.slice(5, 7), 10) - 1] ?? m.mes,
    total: m.total,
  }))

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compras — visão geral</h1>
            <p className="text-sm text-muted-foreground">Indicadores de compras da empresa ativa.</p>
          </div>
          <div className="flex gap-1">
            {[30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  dias === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {isLoading && !data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                icon={<Banknote className="size-4" />}
                label="Gasto no período"
                value={brl(data?.gastoPeriodo ?? 0)}
                hint={`${data?.pedidosPeriodo ?? 0} pedido(s)`}
              />
              <Kpi
                icon={<FileText className="size-4" />}
                label="Pedidos abertos"
                value={String(data?.pedidosAbertos ?? 0)}
                hint={`${data?.aguardandoConfirmacao ?? 0} aguardando confirmação`}
              />
              <Kpi
                icon={<AlertTriangle className="size-4" />}
                label="Itens em ruptura"
                value={String(data?.rupturaCount ?? 0)}
                hint="cobertura abaixo de 7 dias"
                danger
              />
              <Kpi
                icon={<Clock className="size-4" />}
                label="Cotações pendentes"
                value={String(data?.cotacoesPendentes ?? 0)}
                hint={data?.cotacoesVencendo ? `${data.cotacoesVencendo} com prazo vencendo` : "sem prazo crítico"}
                warning={!!data?.cotacoesVencendo}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <p className="text-sm font-medium mb-4">Gasto por mês</p>
                  <div className="h-48">
                    <GastoChart data={chartData} formatter={brl} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-5">
                  <p className="text-sm font-medium mb-4">Pedidos por status</p>
                  <div className="space-y-2.5">
                    {STATUS_PEDIDO_OPTS.map((opt) => {
                      const count = data?.statusCounts.find((s) => s.status === opt.value)?.count ?? 0
                      return (
                        <div key={opt.value}>
                          <div className="flex justify-between text-[13px] mb-1">
                            <span className="text-muted-foreground">{opt.label}</span>
                            <span className="font-medium tabular-nums">{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(count / maxStatus) * 100}%`, background: STATUS_COR[opt.value] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium">Comprar agora — ruptura</p>
                    <Badge variant="outline" className="text-[11px]">{data?.rupturaCount ?? 0} itens</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {(data?.ruptura ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item em ruptura.</p>
                    ) : (
                      data?.ruptura.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0"
                        >
                          <span className="text-[13px] truncate pr-2">
                            <span className="font-mono text-muted-foreground">{r.codigo}</span> {r.nome}
                          </span>
                          <Badge
                            className="text-[11px] shrink-0"
                            style={{
                              background: (r.dias ?? 0) <= 3 ? "var(--color-background-danger, #FCEBEB)" : "#FAEEDA",
                              color: (r.dias ?? 0) <= 3 ? "#A32D2D" : "#854F0B",
                            }}
                          >
                            {r.dias ?? 0} dias
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-5">
                  <p className="text-sm font-medium mb-4">Top fornecedores</p>
                  <div className="space-y-3">
                    {(data?.topFornecedores ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Sem compras no período.</p>
                    ) : (
                      data?.topFornecedores.map((f, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-[13px] mb-1">
                            <span className="truncate pr-2">{f.nome}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0">{brl(f.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[#378ADD]" style={{ width: `${(f.total / maxForn) * 100}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <QuickLink href="/compras/planejamentos" label="Planejamentos" />
              <QuickLink href="/compras/cotacoes" label="Cotações" />
              <QuickLink href="/compras/pedidos" label="Pedidos" />
              <QuickLink href="/compras/importacoes" label="Importações" />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
  danger,
  warning,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  danger?: boolean
  warning?: boolean
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <div
        className={`text-[13px] flex items-center gap-1.5 ${
          danger ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1.5 ${danger ? "text-destructive" : ""}`}>{value}</div>
      {hint && (
        <div className={`text-xs mt-0.5 ${warning ? "text-amber-600" : "text-muted-foreground"}`}>{hint}</div>
      )}
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors"
    >
      <ShoppingCart className="size-3.5 text-muted-foreground" />
      {label}
    </Link>
  )
}
