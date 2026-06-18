import { Badge } from "@/components/ui/badge"
import type { StatusLicitacao, StatusEmpenho } from "@prisma/client"
import { STATUS_LICITACAO_META, STATUS_EMPENHO_META } from "@/lib/licitacoes/constants"

export function StatusLicitacaoBadge({ status }: { status: StatusLicitacao }) {
  const meta = STATUS_LICITACAO_META[status]
  return (
    <Badge variant="outline" className={`${meta.cor} font-medium whitespace-nowrap`}>
      <span className={`mr-1.5 inline-block size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  )
}

export function StatusEmpenhoBadge({ status }: { status: StatusEmpenho }) {
  const meta = STATUS_EMPENHO_META[status]
  return (
    <Badge variant="outline" className={`${meta.cor} font-medium whitespace-nowrap`}>
      {meta.label}
    </Badge>
  )
}
