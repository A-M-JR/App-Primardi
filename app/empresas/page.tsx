"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Building2, Edit2, Trash2, Blocks, Loader2, ShieldAlert, ImageIcon, X } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { MODULOS, MODULO_IDS, type ModuloId } from "@/lib/modules"
import { compressImage } from "@/lib/storage/compress-image"
import {
  listarEmpresas,
  getEmpresaById,
  criarEmpresa,
  atualizarEmpresa,
  excluirEmpresa,
  atualizarModulosAtivos,
  type EmpresaInput,
} from "@/lib/actions/empresas"

type EmpresaRow = {
  id: number
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  cidade: string
  estado: string
  modulosAtivos: unknown
  _count: { userEmpresas: number }
}

const emptyForm: EmpresaInput = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  inscricaoEstadual: "",
  logoUrl: null,
  corSidebar: null,
  corPrimaria: null,
}

export default function EmpresasPage() {
  const { access, isLoading: authLoading, refreshSession } = useAuth()
  const isMaster = access?.nivelAcesso === "MASTER"
  const podeAdministrar = isMaster || access?.nivelAcesso === "TI"

  const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<EmpresaInput>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [excluirId, setExcluirId] = useState<number | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoOriginal, setLogoOriginal] = useState<string | null>(null)

  const [modulosEmpresa, setModulosEmpresa] = useState<EmpresaRow | null>(null)
  const [modulosSel, setModulosSel] = useState<string[]>([])
  const [savingModulos, setSavingModulos] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listarEmpresas()
      setEmpresas(data as unknown as EmpresaRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar empresas.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (podeAdministrar) load()
  }, [podeAdministrar, load])

  const abrirNova = () => {
    setEditingId(null)
    setForm(emptyForm)
    setLogoOriginal(null)
    setFormOpen(true)
  }

  const abrirEdicao = async (e: EmpresaRow) => {
    setEditingId(e.id)
    setForm({ ...emptyForm, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, cnpj: e.cnpj })
    setLogoOriginal(null)
    setFormOpen(true)
    try {
      const full = await getEmpresaById(e.id)
      if (full) {
        setLogoOriginal(full.logoUrl ?? null)
        setForm({
          razaoSocial: full.razaoSocial,
          nomeFantasia: full.nomeFantasia,
          cnpj: full.cnpj,
          inscricaoEstadual: full.inscricaoEstadual ?? "",
          telefone: full.telefone ?? "",
          email: full.email ?? "",
          cep: full.cep ?? "",
          logradouro: full.logradouro ?? "",
          numero: full.numero ?? "",
          complemento: full.complemento ?? "",
          bairro: full.bairro ?? "",
          cidade: full.cidade ?? "",
          estado: full.estado ?? "",
          corSidebar: full.corSidebar ?? null,
          corPrimaria: full.corPrimaria ?? null,
          logoUrl: full.logoUrl ?? null,
        })
      }
    } catch {
      toast.error("Erro ao carregar dados da empresa.")
    }
  }

  const onLogoFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.")
    if (file.size > 8 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 8MB).")
    setUploadingLogo(true)
    try {
      // Otimiza no navegador (redimensiona + WebP) antes de subir.
      const blob = await compressImage(file, 512, 0.85)
      const fd = new FormData()
      fd.append("file", new File([blob], "logo.webp", { type: blob.type }))
      fd.append("scope", "logo")
      // Se já havia uma logo enviada nesta sessão (não a salva no banco), manda
      // junto para o servidor apagá-la e não deixar órfã no bucket.
      if (form.logoUrl && form.logoUrl.startsWith("http") && form.logoUrl !== logoOriginal) {
        fd.append("previousUrl", form.logoUrl)
      }
      const resp = await fetch("/api/upload", { method: "POST", body: fd })
      if (resp.ok) {
        const { url } = await resp.json()
        setForm((f) => ({ ...f, logoUrl: url }))
      } else if (resp.status === 503) {
        // R2 ainda não configurado → guarda a versão comprimida em base64 (interino).
        const reader = new FileReader()
        reader.onload = () => setForm((f) => ({ ...f, logoUrl: String(reader.result) }))
        reader.readAsDataURL(blob)
        toast.message("Logo salva no banco (storage R2 ainda não configurado).")
      } else {
        toast.error("Falha no upload da logo.")
      }
    } catch {
      toast.error("Erro ao processar a logo.")
    } finally {
      setUploadingLogo(false)
    }
  }

  const salvar = async () => {
    if (!form.razaoSocial || !form.nomeFantasia || !form.cnpj) {
      toast.error("Razão social, nome fantasia e CNPJ são obrigatórios.")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await atualizarEmpresa(editingId, form)
        toast.success("Empresa atualizada.")
      } else {
        await criarEmpresa(form)
        toast.success("Empresa criada.")
      }
      setFormOpen(false)
      await load()
      // Atualiza logo/cor na hora se a empresa editada for a ativa.
      await refreshSession()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar empresa.")
    } finally {
      setSaving(false)
    }
  }

  const confirmarExclusao = async () => {
    if (!excluirId) return
    try {
      await excluirEmpresa(excluirId)
      toast.success("Empresa excluída.")
      setExcluirId(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir empresa.")
    }
  }

  const abrirModulos = (e: EmpresaRow) => {
    setModulosEmpresa(e)
    setModulosSel(Array.isArray(e.modulosAtivos) ? (e.modulosAtivos as string[]) : [])
  }

  const toggleModulo = (m: ModuloId) => {
    setModulosSel((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  const salvarModulos = async () => {
    if (!modulosEmpresa) return
    setSavingModulos(true)
    try {
      await atualizarModulosAtivos(modulosEmpresa.id, modulosSel)
      toast.success("Módulos atualizados.")
      setModulosEmpresa(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar módulos.")
    } finally {
      setSavingModulos(false)
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!podeAdministrar) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center">
          <ShieldAlert className="size-10 text-destructive/70" />
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Apenas administração (TI/Master) acessa o cadastro de empresas.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" /> Empresas
            </h1>
            <p className="text-sm text-muted-foreground">Cadastro das empresas do grupo e módulos habilitados.</p>
          </div>
          <Button onClick={abrirNova} className="gap-2">
            <Plus className="size-4" /> Nova Empresa
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : empresas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Nenhuma empresa cadastrada.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {empresas.map((e) => {
              const mods = Array.isArray(e.modulosAtivos) ? (e.modulosAtivos as string[]) : []
              return (
                <Card key={e.id} className="overflow-hidden">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{e.nomeFantasia}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.razaoSocial} · {e.cnpj}
                        {e.cidade ? ` · ${e.cidade}/${e.estado}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {mods.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">Nenhum módulo ativo</span>
                        ) : (
                          mods.map((m) => (
                            <Badge key={m} variant="secondary" className="text-[10px]">
                              {MODULOS[m as ModuloId]?.label ?? m}
                            </Badge>
                          ))
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {e._count.userEmpresas} usuário(s)
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isMaster && (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrirModulos(e)}>
                          <Blocks className="size-3.5" /> Módulos
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrirEdicao(e)}>
                        <Edit2 className="size-3.5" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setExcluirId(e.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>Dados cadastrais da empresa.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Razão social *</Label>
              <Input value={form.razaoSocial} onChange={(ev) => setForm({ ...form, razaoSocial: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome fantasia *</Label>
              <Input value={form.nomeFantasia} onChange={(ev) => setForm({ ...form, nomeFantasia: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(ev) => setForm({ ...form, cnpj: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(ev) => setForm({ ...form, telefone: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={form.email ?? ""} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ""} onChange={(ev) => setForm({ ...form, cidade: ev.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado (UF)</Label>
              <Input
                maxLength={2}
                value={form.estado ?? ""}
                onChange={(ev) => setForm({ ...form, estado: ev.target.value.toUpperCase() })}
              />
            </div>
          </div>

          {/* Identidade visual */}
          <div className="space-y-3 border-t pt-3 mt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identidade visual
            </Label>
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="Logo da empresa" className="size-full object-contain" />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label>
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} disabled={uploadingLogo} />
                  <span className="inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs font-medium cursor-pointer hover:bg-muted">
                    {uploadingLogo ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                    {uploadingLogo ? "Enviando..." : form.logoUrl ? "Trocar logo" : "Enviar logo"}
                  </span>
                </label>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logoUrl: null })}
                    className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline w-fit"
                  >
                    <X className="size-3" /> Remover logo
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground">PNG/JPG, de preferência fundo transparente. Otimizamos automaticamente (WebP ~512px).</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm">Cor da barra lateral</Label>
              <input
                type="color"
                value={form.corSidebar?.startsWith("#") ? form.corSidebar : "#0f172a"}
                onChange={(e) => setForm({ ...form, corSidebar: e.target.value })}
                className="h-8 w-12 rounded border cursor-pointer bg-transparent p-0.5"
                title="Cor da barra lateral"
              />
              {form.corSidebar && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, corSidebar: null })}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  usar padrão
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Módulos (MASTER) */}
      <Dialog open={!!modulosEmpresa} onOpenChange={(o) => !o && setModulosEmpresa(null)}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Módulos ativos</DialogTitle>
            <DialogDescription>{modulosEmpresa?.nomeFantasia} — habilite os módulos desta empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {MODULO_IDS.map((m) => (
              <label key={m} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={modulosSel.includes(m)} onCheckedChange={() => toggleModulo(m)} />
                <div>
                  <p className="text-sm font-medium">{MODULOS[m].label}</p>
                  <p className="text-[11px] text-muted-foreground">{MODULOS[m].rotas.join(", ")}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModulosEmpresa(null)} disabled={savingModulos}>
              Cancelar
            </Button>
            <Button onClick={salvarModulos} disabled={savingModulos} className="gap-2">
              {savingModulos && <Loader2 className="size-4 animate-spin" />}
              Salvar módulos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a empresa e todos os dados vinculados (clientes, pedidos, usuários etc.). Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
