"use client"

import { useState, useEffect } from "react"
import { User, Vendedor } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { MODULOS, type ModuloId } from "@/lib/modules"
import { getUserMemberships, salvarUsuarioComAcesso } from "@/lib/actions/users"

export interface EmpresaParaVinculo {
  id: number
  nomeFantasia: string
  modulosAtivos: unknown
}

interface UsuarioFormDialogProps {
  usuario: User | null
  empresas: EmpresaParaVinculo[]
  vendedores: Vendedor[]
  onClose: () => void
  onSaved: () => void
}

type Nivel = "MASTER" | "TI" | "PADRAO"
type RoleEmpresa = "GERENTE" | "OPERADOR"
type MembState = {
  enabled: boolean
  role: RoleEmpresa
  vendedorId: number | null
  permissoes: Record<string, string[]>
}

const ACOES: { id: string; label: string }[] = [
  { id: "view", label: "Ver" },
  { id: "edit", label: "Editar" },
  { id: "approve", label: "Aprovar" },
]

export function UsuarioFormDialog({ usuario, empresas, vendedores, onClose, onSaved }: UsuarioFormDialogProps) {
  const { access } = useAuth()
  const souMaster = access?.nivelAcesso === "MASTER"

  const [nome, setNome] = useState(usuario?.nome || "")
  const [email, setEmail] = useState(usuario?.email || "")
  const [senha, setSenha] = useState("")
  const [ativo, setAtivo] = useState(usuario?.ativo !== false)
  const [nivelAcesso, setNivelAcesso] = useState<Nivel>(((usuario as any)?.nivelAcesso as Nivel) || "PADRAO")
  const [membs, setMembs] = useState<Record<number, MembState>>({})
  const [loadingMembs, setLoadingMembs] = useState(!!usuario)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado inicial dos vínculos (todas as empresas desabilitadas).
  useEffect(() => {
    const base: Record<number, MembState> = {}
    for (const e of empresas) {
      base[e.id] = { enabled: false, role: "OPERADOR", vendedorId: null, permissoes: {} }
    }
    if (!usuario) {
      setMembs(base)
      return
    }
    // Edição: carrega memberships existentes.
    getUserMemberships(usuario.id)
      .then((rows) => {
        for (const r of rows) {
          base[r.empresaId] = {
            enabled: true,
            role: (r.role as RoleEmpresa) ?? "OPERADOR",
            vendedorId: r.vendedorId ?? null,
            permissoes: (r.permissoes as Record<string, string[]>) ?? {},
          }
        }
        setMembs({ ...base })
      })
      .catch(() => toast.error("Erro ao carregar vínculos do usuário."))
      .finally(() => setLoadingMembs(false))
  }, [usuario, empresas])

  const updateMemb = (empresaId: number, patch: Partial<MembState>) => {
    setMembs((prev) => ({ ...prev, [empresaId]: { ...prev[empresaId], ...patch } }))
  }

  const togglePerm = (empresaId: number, modulo: string, acao: string) => {
    setMembs((prev) => {
      const atual = prev[empresaId].permissoes[modulo] ?? []
      const nova = atual.includes(acao) ? atual.filter((a) => a !== acao) : [...atual, acao]
      return {
        ...prev,
        [empresaId]: { ...prev[empresaId], permissoes: { ...prev[empresaId].permissoes, [modulo]: nova } },
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!nome || !email) {
      toast.warning("Preencha nome e e-mail.")
      return
    }
    if (!usuario && !senha) {
      toast.warning("Senha é obrigatória para novos usuários.")
      return
    }

    const memberships = empresas
      .filter((e) => membs[e.id]?.enabled)
      .map((e) => {
        const m = membs[e.id]
        return {
          empresaId: e.id,
          role: m.role,
          vendedorId: m.role === "OPERADOR" ? m.vendedorId : null,
          permissoes: m.role === "OPERADOR" ? m.permissoes : {},
          ativo: true,
        }
      })

    if (nivelAcesso === "PADRAO" && memberships.length === 0) {
      toast.warning("Usuário comum precisa de pelo menos uma empresa vinculada.")
      return
    }

    setIsSubmitting(true)
    try {
      await salvarUsuarioComAcesso({
        id: usuario?.id,
        nome,
        email,
        senha: senha || undefined,
        ativo,
        nivelAcesso,
        memberships,
      })
      toast.success(usuario ? "Usuário atualizado." : "Usuário criado.")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar usuário.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden border-border/50 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-xl">{usuario ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>Nível de acesso, empresas vinculadas e permissões por módulo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome Completo <span className="text-destructive">*</span></Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail de Acesso <span className="text-destructive">*</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@grupo.com" required />
              </div>
              <div className="space-y-2">
                <Label>{usuario ? "Nova Senha (opcional)" : "Senha Inicial"} {!usuario && <span className="text-destructive">*</span>}</Label>
                <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" />
              </div>
              <div className="space-y-2">
                <Label>Nível de Plataforma</Label>
                <Select value={nivelAcesso} onValueChange={(v) => setNivelAcesso(v as Nivel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PADRAO">Padrão (acesso pelas empresas)</SelectItem>
                    <SelectItem value="TI" disabled={!souMaster}>TI (suporte cross-tenant)</SelectItem>
                    <SelectItem value="MASTER" disabled={!souMaster}>Master (controle total)</SelectItem>
                  </SelectContent>
                </Select>
                {!souMaster && <p className="text-[11px] text-muted-foreground">Só o Master concede TI/Master.</p>}
              </div>
              {usuario && (
                <div className="space-y-2 flex items-center justify-between p-3 border border-border/50 rounded-lg bg-muted/20">
                  <div className="flex flex-col">
                    <Label className="text-sm">Cadastro Ativo</Label>
                    <span className="text-[11px] text-muted-foreground">Inativar bloqueia o login.</span>
                  </div>
                  <Switch checked={ativo} onCheckedChange={setAtivo} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Empresas e permissões</Label>
                {nivelAcesso !== "PADRAO" && (
                  <span className="text-[11px] text-muted-foreground">MASTER/TI já acessam todas — vínculos abaixo são opcionais.</span>
                )}
              </div>

              {loadingMembs ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : empresas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
              ) : (
                <div className="space-y-3">
                  {empresas.map((e) => {
                    const m = membs[e.id]
                    if (!m) return null
                    const mods = (Array.isArray(e.modulosAtivos) ? (e.modulosAtivos as string[]) : []) as ModuloId[]
                    return (
                      <div key={e.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{e.nomeFantasia}</span>
                          <Switch checked={m.enabled} onCheckedChange={(v) => updateMemb(e.id, { enabled: v })} />
                        </div>

                        {m.enabled && (
                          <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Função na empresa</Label>
                                <Select value={m.role} onValueChange={(v) => updateMemb(e.id, { role: v as RoleEmpresa })}>
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="GERENTE">Gerente (vê tudo)</SelectItem>
                                    <SelectItem value="OPERADOR">Operador (por permissão)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {m.role === "OPERADOR" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Vendedor (opcional)</Label>
                                  <Select
                                    value={m.vendedorId?.toString() ?? "none"}
                                    onValueChange={(v) => updateMemb(e.id, { vendedorId: v === "none" ? null : Number(v) })}
                                  >
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhum</SelectItem>
                                      {vendedores
                                        .filter((v) => (v as any).empresaId === e.id)
                                        .map((v) => (
                                          <SelectItem key={v.id} value={v.id.toString()}>{v.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            {m.role === "OPERADOR" && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Permissões por módulo</Label>
                                {mods.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">Esta empresa não tem módulos ativos.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {mods.map((mod) => (
                                      <div key={mod} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                                        <span className="text-xs font-medium">{MODULOS[mod]?.label ?? mod}</span>
                                        <div className="flex items-center gap-3">
                                          {ACOES.map((a) => (
                                            <label key={a.id} className="flex items-center gap-1.5 cursor-pointer">
                                              <Checkbox
                                                checked={(m.permissoes[mod] ?? []).includes(a.id)}
                                                onCheckedChange={() => togglePerm(e.id, mod, a.id)}
                                              />
                                              <span className="text-[11px]">{a.label}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-border/50 bg-muted/10">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px] gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {usuario ? "Salvar" : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
