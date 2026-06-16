"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import type { EstoqueImportRow } from "@/lib/estoque/import-parser"

type EstoqueImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EstoqueImportDialog({ open, onOpenChange, onSuccess }: EstoqueImportDialogProps) {
  const { currentUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [nomeAba, setNomeAba] = useState("")
  const [abas, setAbas] = useState<string[]>([])
  const [preview, setPreview] = useState<{
    total: number
    validas: number
    erros: number
    preview: EstoqueImportRow[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  function reset() {
    setFile(null)
    setNomeAba("")
    setAbas([])
    setPreview(null)
  }

  async function runPreview(selected: File, aba?: string) {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", selected)
      fd.append("previewOnly", "true")
      fd.append("requesterId", String(currentUser?.id || 1))
      if (aba) fd.append("nomeAba", aba)

      const res = await fetch("/api/estoque/import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao ler arquivo")

      setAbas(data.abas || [])
      const abaUsada = aba || data.abas?.[0] || ""
      setNomeAba(abaUsada)
      setPreview({
        total: data.total,
        validas: data.validas,
        erros: data.erros,
        preview: data.preview,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler arquivo")
      setFile(null)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(null)
    setNomeAba("")
    await runPreview(selected)
    e.target.value = ""
  }, [currentUser?.id])

  async function handleAbaChange(aba: string) {
    setNomeAba(aba)
    if (file) await runPreview(file, aba)
  }

  async function handleImport() {
    if (!file) {
      toast.error("Selecione um arquivo.")
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("requesterId", String(currentUser?.id || 1))
      if (nomeAba) fd.append("nomeAba", nomeAba)

      const res = await fetch("/api/estoque/import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro na importação")

      toast.success(
        `Importação concluída: ${data.linhasOk} ok, ${data.linhasCriadas} criados, ${data.linhasAtualizadas} atualizados${data.linhasErro ? `, ${data.linhasErro} erros` : ""}.`
      )
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na importação")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importar Planilha de Estoque
          </DialogTitle>
          <DialogDescription>
            Colunas: Código, Descrição, Curva, Preço, UFO, Estoque, meses (FEV/26...), Média, EAN, Est. Até, Ult. Ent., Quant., Sugest., Compra, Bloq Compra
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Arquivo (XLSX/XLS)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} disabled={loading || importing} />
            </div>
            {abas.length > 1 && (
              <div>
                <Label>Aba da planilha</Label>
                <Select value={nomeAba} onValueChange={handleAbaChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {abas.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Lendo planilha...
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{preview.total} linhas</Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{preview.validas} válidas</Badge>
                {preview.erros > 0 && (
                  <Badge variant="destructive">{preview.erros} com erro</Badge>
                )}
              </div>

              {preview.validas > 1000 && (
                <p className="text-xs text-amber-600">
                  Planilha grande ({preview.validas.toLocaleString("pt-BR")} linhas). A importação pode levar alguns minutos — não feche esta janela.
                </p>
              )}

              <div className="border rounded-lg overflow-x-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-right">Estoque</th>
                      <th className="px-3 py-2 text-right">Preço</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.preview.map((row) => (
                      <tr key={row.numeroLinha}>
                        <td className="px-3 py-2 font-mono">{row.codigo || "—"}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{row.descricao || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.estoque ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {row.preco != null ? row.preco.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.erroMensagem ? (
                            <span className="text-destructive">{row.erroMensagem}</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !preview || preview.validas === 0 || importing || loading}
          >
            {importing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Importando...</>
            ) : (
              <><Upload className="size-4 mr-2" /> Importar</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
