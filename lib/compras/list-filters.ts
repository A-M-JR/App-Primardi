export type ComprasListFiltros = {
  search?: string
  status?: string
  fornecedorId?: number
  dataInicio?: string
  dataFim?: string
  page?: number
}

export type Paginado<T> = {
  data: T[]
  total: number
  page: number
  totalPages: number
}

export const COMPRAS_PAGE_SIZE = 20

/** Calcula skip/take a partir do filtro de página (1-based). */
export function buildPaginacao(page?: number, pageSize: number = COMPRAS_PAGE_SIZE) {
  const p = Math.max(1, page ?? 1)
  return { skip: (p - 1) * pageSize, take: pageSize, page: p, pageSize }
}

export function buildCriadoEmFilter(dataInicio?: string, dataFim?: string) {
  if (!dataInicio && !dataFim) return undefined
  const filter: { gte?: Date; lte?: Date } = {}
  if (dataInicio) filter.gte = new Date(`${dataInicio}T00:00:00`)
  if (dataFim) filter.lte = new Date(`${dataFim}T23:59:59.999`)
  return filter
}

export const STATUS_PLANEJAMENTO_OPTS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANALISE", label: "Em análise" },
  { value: "EM_COTACAO", label: "Em cotação" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "CONVERTIDO", label: "Convertido" },
  { value: "CANCELADO", label: "Cancelado" },
] as const

export const STATUS_IMPORTACAO_OPTS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "PROCESSANDO", label: "Processando" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "ERRO", label: "Erro" },
  { value: "CANCELADA", label: "Cancelada" },
] as const

export const STATUS_COTACAO_OPTS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "ABERTA", label: "Aberta" },
  { value: "EM_RESPOSTA", label: "Em resposta" },
  { value: "FECHADA", label: "Fechada" },
  { value: "CANCELADA", label: "Cancelada" },
] as const

export const STATUS_PEDIDO_OPTS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "AGUARDANDO_APROVACAO", label: "Aguardando aprovação" },
  { value: "ENVIADO", label: "Enviado" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "RECEBIDO_PARCIAL", label: "Recebido parcial" },
  { value: "RECEBIDO", label: "Recebido" },
  { value: "CANCELADO", label: "Cancelado" },
] as const

export function labelStatus(
  status: string,
  map: readonly { value: string; label: string }[]
): string {
  return map.find((o) => o.value === status)?.label ?? status
}
