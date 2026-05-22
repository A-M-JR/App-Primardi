"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { saveFornecedor } from "@/lib/actions/fornecedores"
import { toast } from "sonner"
import type { Fornecedor } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fornecedorToEdit?: Fornecedor | null
  onSuccess: () => void
}

export function FornecedorFormDialog({ open, onOpenChange, fornecedorToEdit, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    razaoSocial: "",
    cnpj: "",
  })

  useEffect(() => {
    if (fornecedorToEdit) {
      setFormData({
        razaoSocial: fornecedorToEdit.razaoSocial,
        cnpj: fornecedorToEdit.cnpj || "",
      })
    } else {
      setFormData({
        razaoSocial: "",
        cnpj: "",
      })
    }
  }, [fornecedorToEdit, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.razaoSocial.trim()) {
      toast.error("A Razão Social é obrigatória.")
      return
    }

    setLoading(true)
    try {
      await saveFornecedor({
        id: fornecedorToEdit?.id,
        ...formData
      })
      toast.success(fornecedorToEdit ? "Fornecedor atualizado!" : "Fornecedor criado!")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error("Erro ao salvar o fornecedor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{fornecedorToEdit ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="razaoSocial">Razão Social</Label>
            <Input
              id="razaoSocial"
              placeholder="Ex: Indústria de Papéis Ltda"
              value={formData.razaoSocial}
              onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
