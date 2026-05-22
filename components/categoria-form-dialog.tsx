"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { saveCategoria } from "@/lib/actions/categorias"
import { toast } from "sonner"
import type { Categoria } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoriaToEdit?: Categoria | null
  onSuccess: () => void
}

export function CategoriaFormDialog({ open, onOpenChange, categoriaToEdit, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    ativo: true,
  })

  useEffect(() => {
    if (categoriaToEdit) {
      setFormData({
        nome: categoriaToEdit.nome,
        ativo: categoriaToEdit.ativo,
      })
    } else {
      setFormData({
        nome: "",
        ativo: true,
      })
    }
  }, [categoriaToEdit, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome.trim()) {
      toast.error("O nome da categoria é obrigatório.")
      return
    }

    setLoading(true)
    try {
      await saveCategoria({
        id: categoriaToEdit?.id,
        ...formData
      })
      toast.success(categoriaToEdit ? "Categoria atualizada!" : "Categoria criada!")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error("Erro ao salvar a categoria.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{categoriaToEdit ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Categoria</Label>
            <Input
              id="nome"
              placeholder="Ex: Rótulos Adesivos"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
            />
            <Label htmlFor="ativo">Categoria Ativa</Label>
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
