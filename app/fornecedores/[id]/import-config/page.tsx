"use client"

import { AppShell } from "@/components/app-shell"
import { ImportConfigForm } from "@/components/compras/import-config-form"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { use } from "react"

export default function FornecedorImportConfigPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { currentUser } = useAuth()
  const fornecedorId = parseInt(id, 10)

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-config",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  const fornecedor = fornecedores?.find((f) => f.id === fornecedorId)

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/fornecedores"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Configuração de Importação</h1>
        </div>
        {fornecedor ? (
          <ImportConfigForm fornecedorId={fornecedorId} fornecedorNome={fornecedor.razaoSocial} />
        ) : (
          <p className="text-muted-foreground">Fornecedor não encontrado.</p>
        )}
      </div>
    </AppShell>
  )
}
