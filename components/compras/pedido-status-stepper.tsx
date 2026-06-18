"use client"

import { Fragment } from "react"
import { Check, FileText, ShieldCheck, Send, BadgeCheck, PackageCheck, Ban, RotateCcw, PackageSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StatusPedidoCompra } from "@prisma/client"

const STEPS = [
  { key: "RASCUNHO", label: "Rascunho", icon: FileText },
  { key: "AGUARDANDO_APROVACAO", label: "Aprovação", icon: ShieldCheck },
  { key: "ENVIADO", label: "Enviado", icon: Send },
  { key: "CONFIRMADO", label: "Confirmado", icon: BadgeCheck },
  { key: "RECEBIDO", label: "Recebido", icon: PackageCheck },
] as const

const INDEX: Record<string, number> = {
  RASCUNHO: 0,
  AGUARDANDO_APROVACAO: 1,
  ENVIADO: 2,
  CONFIRMADO: 3,
  RECEBIDO_PARCIAL: 4,
  RECEBIDO: 4,
}

const LAST = 4

interface PedidoStatusStepperProps {
  status: StatusPedidoCompra
  onChange: (status: StatusPedidoCompra) => void
  disabled?: boolean
  podeAprovar?: boolean
}

export function PedidoStatusStepper({ status, onChange, disabled, podeAprovar }: PedidoStatusStepperProps) {
  if (status === "CANCELADO") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-3">
          <Ban className="size-5 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Pedido cancelado</p>
            <p className="text-xs text-muted-foreground">Reabra para voltar ao fluxo.</p>
          </div>
        </div>
        {!disabled && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange("RASCUNHO")}>
            <RotateCcw className="size-3.5" /> Reabrir
          </Button>
        )}
      </div>
    )
  }

  const current = INDEX[status] ?? 0
  const parcial = status === "RECEBIDO_PARCIAL"
  const preAprovacao = status === "RASCUNHO" || status === "AGUARDANDO_APROVACAO"
  // Etapas a partir de "Enviado" (índice 2) só liberam após aprovação.
  const bloqueadoPorAprovacao = (i: number) => i >= 2 && preAprovacao && !podeAprovar

  const stepState = (i: number): "done" | "current" | "pending" | "partial" | "todo" => {
    if (i === LAST && status === "RECEBIDO") return "done"
    if (i === LAST && parcial) return "partial"
    if (i === 1 && status === "AGUARDANDO_APROVACAO") return "pending"
    if (i < current) return "done"
    if (i === current) return "current"
    return "todo"
  }

  const podeParcial = current >= 3 && status !== "RECEBIDO"

  return (
    <div className="rounded-lg border border-border/50 p-5 sm:p-6 space-y-5">
      <div className="flex items-start w-full">
        {STEPS.map((step, i) => {
          const st = stepState(i)
          const Icon = step.icon
          const stepDisabled = disabled || bloqueadoPorAprovacao(i)
          const circle =
            st === "done"
              ? "bg-primary border-primary text-primary-foreground"
              : st === "current"
                ? "border-primary text-primary bg-primary/10"
                : st === "pending" || st === "partial"
                  ? "border-amber-500 text-amber-600 bg-amber-500/10"
                  : "border-border text-muted-foreground bg-muted/30"
          return (
            <Fragment key={step.key}>
              {i > 0 && (
                <div
                  className={`flex-1 h-1 mt-7 mx-2 rounded-full ${
                    i <= current && !(i === LAST && parcial) ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <button
                type="button"
                disabled={stepDisabled}
                onClick={() => onChange(step.key as StatusPedidoCompra)}
                className="flex flex-col items-center gap-2 w-24 shrink-0 group disabled:cursor-default disabled:opacity-70"
                title={
                  bloqueadoPorAprovacao(i)
                    ? "Requer aprovação de um responsável"
                    : disabled
                      ? undefined
                      : `Marcar como ${step.label}`
                }
              >
                <span
                  className={`flex size-14 items-center justify-center rounded-full border-2 transition-colors transition-transform ${circle} ${
                    !stepDisabled ? "group-hover:border-primary group-hover:scale-105" : ""
                  }`}
                >
                  {st === "done" ? <Check className="size-6" /> : <Icon className="size-6" />}
                </span>
                <span
                  className={`text-[13px] font-medium leading-tight text-center ${
                    st === "todo" ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.label}
                  {st === "pending" && <span className="block text-xs text-amber-600">aguardando</span>}
                  {st === "partial" && <span className="block text-xs text-amber-600">parcial</span>}
                </span>
              </button>
            </Fragment>
          )
        })}
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
          {podeParcial && !bloqueadoPorAprovacao(4) && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange("RECEBIDO_PARCIAL")}>
              <PackageSearch className="size-3.5" /> Recebido parcial
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onChange("CANCELADO")}
          >
            <Ban className="size-3.5" /> Cancelar pedido
          </Button>
        </div>
      )}
    </div>
  )
}
