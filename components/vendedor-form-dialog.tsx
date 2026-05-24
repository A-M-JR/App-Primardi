"use client"

import { useState } from "react"
import { Vendedor } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface VendedorFormDialogProps {
  vendedor: Vendedor | null
  onSave: (vendedor: Vendedor) => Promise<void> | void
  onClose: () => void
}

const REGIOES = ["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"]

const maskPhone = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4,5})(\d{4})/, "$1-$2")
        .substring(0, 15)
}

export function VendedorFormDialog({ vendedor, onSave, onClose }: VendedorFormDialogProps) {
  const [nome, setNome] = useState(vendedor?.nome || "")
  const [email, setEmail] = useState(vendedor?.email || "")
  const [telefone, setTelefone] = useState(vendedor?.telefone || "")
  const [comissao, setComissao] = useState(vendedor?.comissao.toString() || "5")
  const [regiao, setRegiao] = useState(vendedor?.regiao || "")
  const [ativo, setAtivo] = useState(vendedor?.ativo !== false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    if (!nome || !email || !telefone || !regiao) {
      toast.error("Formulário Incompleto", {
        description: "Por favor, preencha todos os campos obrigatórios (*)."
      })
      setIsSubmitting(false)
      return
    }

    const newVendedor: Vendedor = {
      id: vendedor?.id || Date.now(),
      nome,
      email,
      telefone,
      comissao: parseFloat(comissao),
      regiao,
      criadoEm: vendedor?.criadoEm || new Date().toISOString().split("T")[0],
      ativo,
    }

    try {
      await onSave(newVendedor)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-border/50 shadow-2xl">
        <DialogHeader className="p-6 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-xl">{vendedor ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
          <DialogDescription>
            {vendedor ? "Atualize as informações contratuais e de contato do vendedor" : "Cadastre um novo parceiro de vendas na plataforma"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6" autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do Vendedor <span className="text-destructive">*</span></Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="bg-muted/50 focus-visible:bg-background"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email de Contato <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@empresa.com.br"
                className="bg-muted/50 focus-visible:bg-background"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone Corporativo <span className="text-destructive">*</span></Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(62) 99999-9999"
                className="bg-muted/50 focus-visible:bg-background"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comissao">Comissão Padrão (%) <span className="text-destructive">*</span></Label>
              <Input
                id="comissao"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                placeholder="5"
                className="bg-muted/50 focus-visible:bg-background"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regiao">Região de Atuação <span className="text-destructive">*</span></Label>
              <Select value={regiao} onValueChange={setRegiao} required>
                <SelectTrigger id="regiao" className="bg-muted/50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {REGIOES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {vendedor && (
              <div className="space-y-2 md:col-span-2 flex items-center justify-between p-4 border border-border/50 rounded-lg bg-muted/20">
                <div className="flex flex-col space-y-0.5">
                  <Label className="text-base font-semibold">Vendedor Ativo</Label>
                  <span className="text-[11px] text-muted-foreground">Inativar pausa imediatamente as referências a esse vendedor nos cadastros de usuários.</span>
                </div>
                <Switch
                  checked={ativo}
                  onCheckedChange={setAtivo}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="hover:bg-muted/50">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px] shadow-sm">
              {isSubmitting ? "Salvando..." : (vendedor ? "Atualizar Ficha" : "Salvar Vendedor")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
