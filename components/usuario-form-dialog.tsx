"use client"

import { useState } from "react"
import { User, Vendedor } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface UsuarioFormDialogProps {
  usuario: User | null
  vendedores: Vendedor[]
  onSave: (usuario: User) => Promise<void> | void
  onClose: () => void
}

export function UsuarioFormDialog({ usuario, vendedores, onSave, onClose }: UsuarioFormDialogProps) {
  const [nome, setNome] = useState(usuario?.nome || "")
  const [email, setEmail] = useState(usuario?.email || "")
  const [senha, setSenha] = useState("")
  const [role, setRole] = useState<"ADMIN" | "VENDEDOR">(usuario?.role || "VENDEDOR")
  const [vendedorId, setVendedorId] = useState<number | "">(usuario?.vendedorId || "")
  const [ativo, setAtivo] = useState(usuario?.ativo !== false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)

    if (!nome || !email) {
      toast.warning("Campos Obrigatórios", {
        description: "Por favor, preencha o nome e o email."
      })
      setIsSubmitting(false)
      return
    }

    if (!usuario && !senha) {
      toast.warning("Senha Obrigatória", {
        description: "A senha é obrigatória para novos usuários."
      })
      setIsSubmitting(false)
      return
    }

    const newUsuario: User = {
      id: usuario?.id || Date.now(),
      nome,
      email,
      role,
      vendedorId: role === "VENDEDOR" ? Number(vendedorId) : undefined,
      criadoEm: usuario?.criadoEm || new Date().toISOString().split("T")[0],
      ativo,
    }

    try {
      await onSave(newUsuario)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border/50 shadow-2xl">
        <DialogHeader className="p-6 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-xl">{usuario ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>
            {usuario ? "Atualize as informações do usuário e suas permissões" : "Crie um novo acesso administrativo ou para sua equipe de vendas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome Completo <span className="text-destructive">*</span></Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="bg-muted/50 focus-visible:bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email de Acesso <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@primardi.com"
                className="bg-muted/50 focus-visible:bg-background"
                required
              />
            </div>

            {!usuario && (
              <div className="space-y-2">
                <Label htmlFor="senha">Senha Inicial <span className="text-destructive">*</span></Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="******"
                  className="bg-muted/50 focus-visible:bg-background"
                  required={!usuario}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Função / Perfil <span className="text-destructive">*</span></Label>
              <Select value={role} onValueChange={(value) => setRole(value as "ADMIN" | "VENDEDOR")}>
                <SelectTrigger id="role" className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador (Total Acesso)</SelectItem>
                  <SelectItem value="VENDEDOR">Vendedor (Limitado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "VENDEDOR" && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="VENDEDOR">Vínculo com Vendedor <span className="text-destructive">*</span></Label>
                <Select value={vendedorId?.toString()} onValueChange={(val) => setVendedorId(Number(val))} required>
                  <SelectTrigger id="VENDEDOR" className="bg-muted/50">
                    <SelectValue placeholder="Selecione o perfil de comissão/vendas correspondente" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.nome} - {v.regiao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {usuario && (
              <div className="space-y-2 md:col-span-2 flex items-center justify-between p-4 border border-border/50 rounded-lg bg-muted/20">
                <div className="flex flex-col space-y-0.5">
                  <Label className="text-base">Cadastro Ativo</Label>
                  <span className="text-[11px] text-muted-foreground">Inativar bloqueia imediatamente o login deste usuário.</span>
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
              {isSubmitting ? "Salvando..." : (usuario ? "Salvar Alterações" : "Criar Usuário")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
