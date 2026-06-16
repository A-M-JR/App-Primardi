import { Badge } from "@/components/ui/badge"

const LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  EM_RESPOSTA: "Com respostas",
  FECHADA: "Fechada",
  CANCELADA: "Cancelada",
  PENDENTE: "Aguardando",
  VISUALIZADA: "Visualizou",
  RESPONDIDA: "Respondeu",
  BLOQUEADA: "Bloqueada",
  EXPIRADA: "Expirada",
}

const VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ABERTA: "default",
  EM_RESPOSTA: "secondary",
  FECHADA: "outline",
  RESPONDIDA: "secondary",
  PENDENTE: "outline",
  VISUALIZADA: "outline",
}

export function CotacaoStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANTS[status] ?? "outline"}>
      {LABELS[status] ?? status}
    </Badge>
  )
}
