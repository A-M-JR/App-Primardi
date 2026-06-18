"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ComprasPaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

/** Rodapé de paginação padrão das listagens de compras. */
export function ComprasPagination({ page, totalPages, total, onPageChange }: ComprasPaginationProps) {
  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Página {page} de {Math.max(1, totalPages)} · {total} registro{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
