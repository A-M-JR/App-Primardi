"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Edit2, Trash2, CreditCard, Search, Power, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"

interface FormaPagamento {
  id: number
  nome: string
  ativo: boolean
  quantidadeParcelas: number
}

export default function FormasPagamentoPage() {
  const { isAdmin, isLoading: isAuthLoading } = useAuth()
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null)
  const [search, setSearch] = useState("")
  const [nome, setNome] = useState("")
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteWarning, setDeleteWarning] = useState<FormaPagamento | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/formas-pagamento")
      if (!res.ok) throw new Error("Erro ao buscar dados")
      const data = await res.json()
      setFormas(data)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar formas de pagamento.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredFormas = formas.filter(f => 
    f.nome.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error("O nome é obrigatório")
      return
    }

    setIsSaving(true)
    try {
      const url = editingForma 
        ? `/api/formas-pagamento/${editingForma.id}` 
        : "/api/formas-pagamento"
      
      const res = await fetch(url, {
        method: editingForma ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nome, 
          ativo: editingForma ? editingForma.ativo : true,
          quantidadeParcelas: Number(quantidadeParcelas) || 1
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Erro ao salvar")
      }

      toast.success(editingForma ? "Atualizado com sucesso" : "Cadastrado com sucesso")
      setShowForm(false)
      setEditingForma(null)
      setNome("")
      setQuantidadeParcelas(1)
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (forma: FormaPagamento) => {
    try {
      const res = await fetch(`/api/formas-pagamento/${forma.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...forma, ativo: !forma.ativo })
      })

      if (!res.ok) throw new Error("Erro ao alterar status")

      toast.success(`Forma de pagamento ${!forma.ativo ? "ativada" : "desativada"}`)
      loadData()
    } catch (error) {
      toast.error("Erro ao atualizar status.")
    }
  }

  const handleDelete = async () => {
    if (!deleteWarning) return
    try {
      const res = await fetch(`/api/formas-pagamento/${deleteWarning.id}`, {
        method: "DELETE"
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Erro ao excluir")
      }

      toast.success("Excluído com sucesso")
      setDeleteWarning(null)
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (isAuthLoading) {
    return <AppShell><div className="p-8"><Skeleton className="h-40 w-full" /></div></AppShell>
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
          <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 ">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Formas de Pagamento</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie as opções de pagamento disponíveis para orçamentos e pedidos</p>
          </div>
          <Button
            onClick={() => {
              setEditingForma(null)
              setNome("")
              setQuantidadeParcelas(1)
              setShowForm(true)
            }}
            size="lg"
            className="gap-2"
          >
            <Plus className="size-4" />
            Nova Forma
          </Button>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar formas de pagamento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Parcelas</th>
                  <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      <td colSpan={3} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                ) : filteredFormas.map((forma) => (
                  <tr key={forma.id} className={`hover:bg-muted/30 transition-colors ${!forma.ativo ? "opacity-60" : ""}`}>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-foreground">{forma.nome}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{forma.quantidadeParcelas || 1}x</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-2 w-2 rounded-full ${forma.ativo ? "bg-emerald-500" : "bg-destructive"}`}></span>
                        <span className={`text-xs font-medium ${forma.ativo ? "text-emerald-600" : "text-destructive"}`}>
                          {forma.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingForma(forma)
                            setNome(forma.nome)
                            setQuantidadeParcelas(forma.quantidadeParcelas || 1)
                            setShowForm(true)
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="size-[15px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(forma)}
                          className={`h-8 w-8 p-0 ${forma.ativo ? "text-muted-foreground hover:text-destructive" : "text-destructive hover:text-emerald-600"}`}
                        >
                          <Power className="size-[15px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteWarning(forma)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-[15px]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingForma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle>
              <DialogDescription>
                Defina o nome da forma de pagamento que aparecerá nos documentos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="py-4 space-y-4">
                <div className="gap-4 flex">
                  <div className="space-y-2 flex-grow">
                    <Label htmlFor="nome">Nome da Forma</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: 30/60/90 Dias"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 w-24">
                    <Label htmlFor="parcelas">Parcelas</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Forma"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete AlertDialog */}
        <AlertDialog open={!!deleteWarning} onOpenChange={(open) => !open && setDeleteWarning(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{deleteWarning?.nome}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  )
}
