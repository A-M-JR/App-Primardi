import type { ReactNode } from "react"

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  extra?: ReactNode
}

export function ComprasPageHeader({ title, description, actions, extra }: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
        {extra}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
