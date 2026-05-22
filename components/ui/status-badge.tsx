import { Badge } from "@/components/ui/badge"

interface StatusObj {
  nome: string
  cor: string
}

export function StatusBadge({ statusObj, fallback }: { statusObj?: StatusObj | null, fallback?: string }) {
  if (!statusObj) {
    if (fallback) {
      return <Badge variant="outline" className="text-muted-foreground bg-muted/50">{fallback}</Badge>
    }
    return <Badge variant="outline" className="text-muted-foreground bg-muted/50">Desconhecido</Badge>
  }

  const { nome, cor } = statusObj

  return (
    <Badge 
      variant="outline"
      style={{
        backgroundColor: `${cor}15`,
        color: cor,
        borderColor: `${cor}30`
      }}
      className="font-medium whitespace-nowrap shadow-none"
    >
      {nome}
    </Badge>
  )
}
