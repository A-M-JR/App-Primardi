"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"

export function useComprasListFiltros() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState("")
  const [fornecedorId, setFornecedorId] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Qualquer mudança de filtro volta para a primeira página.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, fornecedorId, dateRange])

  const filtros: ComprasListFiltros = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
      fornecedorId: fornecedorId ? parseInt(fornecedorId, 10) : undefined,
      dataInicio: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dataFim: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      page,
    }),
    [debouncedSearch, status, fornecedorId, dateRange, page]
  )

  const hasActiveFilters = !!(
    debouncedSearch ||
    status ||
    fornecedorId ||
    dateRange?.from ||
    dateRange?.to
  )

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setStatus("")
    setFornecedorId("")
    setDateRange(undefined)
    setPage(1)
  }

  return {
    search,
    setSearch,
    status,
    setStatus,
    fornecedorId,
    setFornecedorId,
    dateRange,
    setDateRange,
    page,
    setPage,
    filtros,
    hasActiveFilters,
    clearFilters,
  }
}
