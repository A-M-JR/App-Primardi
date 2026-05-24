"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createLead } from "@/lib/actions/leads"
import { Plus } from "lucide-react"

export function NovoLeadDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    telefone: "",
    email: "",
    cep: "",
    valorEstimado: "",
    observacoes: ""
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome) {
      toast.error("O nome do lead é obrigatório.")
      return
    }

    setLoading(true)
    try {
      await createLead({
        ...formData,
        valorEstimado: formData.valorEstimado ? parseFloat(formData.valorEstimado.replace(',', '.')) : 0
      })
      toast.success("Lead criado com sucesso!")
      setOpen(false)
      setFormData({
        nome: "",
        empresa: "",
        telefone: "",
        email: "",
        cep: "",
        valorEstimado: "",
        observacoes: ""
      })
      if (onCreated) onCreated()
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar lead.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02]">
          <Plus className="size-4 mr-2" />
          Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="nome">Nome do Contato *</Label>
              <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} placeholder="Ex: João Silva" required />
            </div>
            
            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" name="empresa" value={formData.empresa} onChange={handleChange} placeholder="Ex: Nodeway Corp" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="telefone">WhatsApp / Telefone</Label>
              <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="joao@empresa.com" />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" name="cep" value={formData.cep || ""} onChange={handleChange} placeholder="00000-000" />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="valorEstimado">Valor Estimado do Projeto (R$)</Label>
              <Input id="valorEstimado" name="valorEstimado" type="number" step="0.01" value={formData.valorEstimado} onChange={handleChange} placeholder="0.00" />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="observacoes">Observações / Como conheceu</Label>
              <Textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} placeholder="Detalhes iniciais..." className="resize-none" rows={3} />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
