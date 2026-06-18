"use client"

import { useState, useEffect, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Building2, Plus, Edit2, Trash2, Loader2, ShieldAlert, Users } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  getDepartamentos, salvarDepartamento, excluirDepartamento, getUsuariosDaEmpresa,
} from "@/lib/actions/departamentos"

type Dep = Awaited<ReturnType<typeof getDepartamentos>>[number]

export default function DepartamentosPage() {
  const { can, isLoading: authLoading } = useAuth()
  const podeEditar = can("chamados", "edit")

  const [deps, setDeps] = useState<Dep[]>([])
  const [usuarios, setUsuarios] = useState<{ id: number; nome: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [ativo, setAtivo] = useState(true)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [excluir, setExcluir] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, u] = await Promise.all([getDepartamentos(), getUsuariosDaEmpresa()])
      setDeps(d); setUsuarios(u)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!authLoading && can("chamados")) load() }, [authLoading, can, load])

  const abrirNovo = () => { setEditId(null); setNome(""); setDescricao(""); setAtivo(true); setSel(new Set()); setOpen(true) }
  const abrirEdicao = (d: Dep) => {
    setEditId(d.id); setNome(d.nome); setDescricao(d.descricao || ""); setAtivo(d.ativo)
    setSel(new Set(d.usuarios.map((u) => u.id))); setOpen(true)
  }
  const toggleUser = (uid: number) => setSel((p) => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n })

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome.")
    setSaving(true)
    try {
      await salvarDepartamento({ id: editId || undefined, nome, descricao, ativo, userIds: [...sel] })
      toast.success("Departamento salvo.")
      setOpen(false); load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally { setSaving(false) }
  }

  const confirmarExcluir = async () => {
    if (!excluir) return
    try { await excluirDepartamento(excluir); toast.success("Departamento excluído."); setExcluir(null); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
  }

  if (authLoading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("chamados")) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground"><ShieldAlert className="size-10 text-destructive/70" /> Sem acesso.</div></AppShell>
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" /> Departamentos
            </h1>
            <p className="text-sm text-muted-foreground">Cadastre departamentos e vincule os usuários responsáveis.</p>
          </div>
          {podeEditar && <Button onClick={abrirNovo} className="gap-2"><Plus className="size-4" /> Novo departamento</Button>}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : deps.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum departamento. {podeEditar && "Crie o primeiro."}</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {deps.map((d) => (
              <Card key={d.id} className="border-border/60">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{d.nome}</span>
                      {!d.ativo && <Badge variant="outline" className="text-[10px] text-muted-foreground">inativo</Badge>}
                      <Badge variant="outline" className="text-[10px]">{d.qtdChamados} chamado(s)</Badge>
                    </div>
                    {d.descricao && <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>}
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Users className="size-3" />
                      {d.usuarios.length === 0 ? <span className="italic">sem usuários vinculados</span> : d.usuarios.map((u) => (
                        <Badge key={u.id} variant="secondary" className="text-[10px]">{u.nome}</Badge>
                      ))}
                    </p>
                  </div>
                  {podeEditar && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrirEdicao(d)}><Edit2 className="size-3.5" /> Editar</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setExcluir(d.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar departamento" : "Novo departamento"}</DialogTitle>
            <DialogDescription>Defina o departamento e quem o atende.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Suporte, Financeiro, TI" /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={ativo} onCheckedChange={setAtivo} /><Label className="cursor-pointer">Ativo</Label></div>
            <div className="space-y-1.5">
              <Label>Usuários vinculados</Label>
              <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
                {usuarios.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">Nenhum usuário na empresa.</p>
                ) : usuarios.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={sel.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                    <div className="min-w-0"><p className="text-sm">{u.nome}</p><p className="text-[11px] text-muted-foreground">{u.email}</p></div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="gap-2">{saving && <Loader2 className="size-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription>Os chamados ligados a ele ficam sem departamento. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
