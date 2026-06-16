"use client"

import { Search } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"

type StatusOpt = { value: string; label: string }

type Props = {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  dateRange: DateRange | undefined
  onDateRangeChange: (v: DateRange | undefined) => void
  status: string
  onStatusChange: (v: string) => void
  statusOptions: readonly StatusOpt[]
  statusLabel?: string
  fornecedorId?: string
  onFornecedorChange?: (v: string) => void
  fornecedores?: { id: number; razaoSocial: string }[]
  onClear?: () => void
  hasActiveFilters?: boolean
}

export function ComprasListFiltros({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
  statusOptions,
  statusLabel = "Status",
  fornecedorId,
  onFornecedorChange,
  fornecedores,
  onClear,
  hasActiveFilters,
}: Props) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/20 px-4 py-4 md:flex-row md:flex-wrap md:items-center">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-background"
        />
      </div>

      <DatePickerWithRange
        date={dateRange}
        setDate={onDateRangeChange}
        className="w-full md:w-auto"
      />

      <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
        <SelectTrigger className="w-full md:w-[160px] h-8 text-xs bg-background">
          <SelectValue placeholder={statusLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onFornecedorChange && fornecedores && (
        <Select
          value={fornecedorId || "all"}
          onValueChange={(v) => onFornecedorChange(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full md:w-[200px] h-8 text-xs bg-background">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos fornecedores</SelectItem>
            {fornecedores.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.razaoSocial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
