"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUp, Settings } from "lucide-react"
import { toast } from "sonner"

type Fornecedor = { id: number; razaoSocial: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fornecedores?: Fornecedor[]
  requesterId?: number
  onSuccess?: () => void
}

export function NovaImportacaoDialog({
  open,
  onOpenChange,
  fornecedores,
  requesterId,
  onSuccess,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fornecedorId, setFornecedorId] = useState("")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  function reset() {
    setFornecedorId("")
    setArquivo(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleArquivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setArquivo(e.target.files?.[0] ?? null)
    e.target.value = ""
  }

  async function handleImportar() {
    if (!fornecedorId) {
      toast.error("Selecione o fornecedor.")
      return
    }
    if (!arquivo) {
      toast.error("Selecione o arquivo.")
      fileRef.current?.click()
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", arquivo)
      fd.append("requesterId", String(requesterId || 1))
      fd.append("multiFornecedor", "false")
      fd.append("fornecedorId", fornecedorId)

      const res = await fetch("/api/compras/import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro no upload")

      toast.success("Importação processada.")
      handleOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova importação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fornecedor..." />
              </SelectTrigger>
              <SelectContent>
                {fornecedores?.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fornecedorId && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <Link href={`/fornecedores/${fornecedorId}/import-config`}>
                  <Settings className="size-3 mr-1 inline" />
                  Configurar layout deste fornecedor
                </Link>
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Arquivo (XLSX, XLS ou CSV)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleArquivoChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="size-4 mr-2 shrink-0" />
              <span className="truncate">{arquivo ? arquivo.name : "Selecionar arquivo..."}</span>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleImportar()}
            disabled={uploading || !fornecedorId || !arquivo}
          >
            {uploading ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
