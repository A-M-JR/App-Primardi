"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getImportacoes } from "@/lib/actions/compras/importacao"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { useAuth } from "@/lib/auth-context"
import { useDataQuery } from "@/hooks/use-data-query"
import Link from "next/link"
import { Upload, FileSpreadsheet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

const statusColors: Record<string, string> = {
  RASCUNHO: "secondary",
  PROCESSANDO: "default",
  CONCLUIDA: "default",
  ERRO: "destructive",
  CANCELADA: "outline",
}

export default function ImportacoesPage() {
  const { currentUser } = useAuth()
  const [fornecedorId, setFornecedorId] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [multiFornecedor, setMultiFornecedor] = useState(false)
  const [nomeAba, setNomeAba] = useState("ESTOQUE")

  const { data: importacoes, refetch } = useDataQuery({
    key: "importacoes",
    fetcher: () => getImportacoes(currentUser?.id),
  })

  const { data: fornecedores } = useDataQuery({
    key: "fornecedores-import",
    fetcher: () => getFornecedores(currentUser?.id),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      toast.error("Selecione um arquivo.")
      return
    }
    if (!multiFornecedor && !fornecedorId) {
      toast.error("Selecione fornecedor ou ative modo multi-fornecedor.")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("requesterId", String(currentUser?.id || 1))
      fd.append("multiFornecedor", String(multiFornecedor))
      if (multiFornecedor) {
        if (nomeAba) fd.append("nomeAba", nomeAba)
      } else {
        fd.append("fornecedorId", fornecedorId)
      }
      const res = await fetch("/api/compras/import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro no upload")

      if (multiFornecedor && data.resultados) {
        const ok = data.resultados.filter((r: { importacaoId?: number }) => r.importacaoId).length
        const fail = data.resultados.filter((r: { erro?: string }) => r.erro).length
        toast.success(`Importado: ${ok} fornecedor(es)${fail ? `, ${fail} aviso(s)` : ""}.`)
        data.resultados.forEach((r: { fornecedor: string; erro?: string; linhas?: number }) => {
          if (r.erro) toast.warning(`${r.fornecedor}: ${r.erro}`)
        })
      } else {
        toast.success("Importação processada.")
      }
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold">Importações de Preços</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload de preços e estoque por fornecedor — suporta planilha única com coluna FORNECEDOR
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <Upload className="size-4" /> Nova importação
            </h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Switch id="multi" checked={multiFornecedor} onCheckedChange={setMultiFornecedor} />
              <Label htmlFor="multi" className="cursor-pointer">
                Planilha multi-fornecedor (colunas ID, PRODUTO, FORNECEDOR, ESTOQUE, PREÇO, EAN)
              </Label>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              {!multiFornecedor && (
                <div className="w-64">
                  <Label>Fornecedor</Label>
                  <Select value={fornecedorId} onValueChange={setFornecedorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {fornecedores?.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.razaoSocial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {multiFornecedor && (
                <div className="w-48">
                  <Label>Nome da aba</Label>
                  <Input value={nomeAba} onChange={(e) => setNomeAba(e.target.value)} placeholder="ESTOQUE" />
                </div>
              )}
              <div>
                <Label>Arquivo (XLSX/CSV)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} disabled={uploading} />
              </div>
            </div>
            {multiFornecedor && (
              <p className="text-xs text-muted-foreground">
                Cada linha vai para o fornecedor da coluna FORNECEDOR. Nome deve bater com cadastro (ex: DIST ALZIRA).
                Estoque importado como estoque do fornecedor no comparativo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Histórico</h2></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importacoes?.map((imp) => (
                <Link
                  key={imp.id}
                  href={`/compras/importacoes/${imp.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="size-5 text-primary" />
                    <div>
                      <p className="font-medium">{imp.nomeArquivo}</p>
                      <p className="text-xs text-muted-foreground">
                        {imp.fornecedor.razaoSocial} — {new Date(imp.criadoEm).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{imp.linhasValidas}/{imp.totalLinhas} válidas</span>
                    <Badge variant={statusColors[imp.status] as "default" | "secondary" | "destructive" | "outline"}>
                      {imp.status}
                    </Badge>
                  </div>
                </Link>
              ))}
              {!importacoes?.length && (
                <p className="text-center text-muted-foreground py-8">Nenhuma importação.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
