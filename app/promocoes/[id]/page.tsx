"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Megaphone, ArrowLeft, Loader2, ShieldAlert, Pencil, Trash2, MessageCircle,
  Copy, Check, Search, Send, FileDown,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  getPromocao, atualizarStatusPromocao, excluirPromocao, getDestinatariosPromo,
} from "@/lib/actions/promocoes"
import { montarMensagemPromo, linkWhatsPromo, type PromoTexto } from "@/lib/promocoes/whats"
import { gerarPromoPDF } from "@/lib/promocoes/promo-pdf"
import { gerarPromoPdfHtml } from "@/lib/promocoes/promo-pdf-html"
import { PromocaoFormDialog } from "@/components/promocoes/promocao-form-dialog"
import type { StatusPromocao } from "@prisma/client"

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const STATUS: { v: StatusPromocao; label: string }[] = [
  { v: "RASCUNHO", label: "Rascunho" }, { v: "ATIVA", label: "Ativa" }, { v: "ENCERRADA", label: "Encerrada" },
]

type Detalhe = Awaited<ReturnType<typeof getPromocao>>
type Destinatarios = Awaited<ReturnType<typeof getDestinatariosPromo>>

export default function PromocaoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)
  const { can, isLoading: authLoading, empresaBranding } = useAuth()
  const podeEditar = can("promocoes", "edit")

  const [promo, setPromo] = useState<Detalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const [dest, setDest] = useState<Destinatarios>([])
  const [buscaDest, setBuscaDest] = useState("")
  const [loadingDest, setLoadingDest] = useState(false)
  const [enviados, setEnviados] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try { setPromo(await getPromocao(id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
    finally { setLoading(false) }
  }, [id])

  const loadDest = useCallback(async () => {
    setLoadingDest(true)
    try { setDest(await getDestinatariosPromo(buscaDest || undefined)) }
    catch { /* silencioso */ }
    finally { setLoadingDest(false) }
  }, [buscaDest])

  useEffect(() => { if (!authLoading && can("promocoes") && id) load() }, [authLoading, can, id, load])
  useEffect(() => {
    if (!authLoading && can("promocoes")) {
      const t = setTimeout(loadDest, 300)
      return () => clearTimeout(t)
    }
  }, [authLoading, can, loadDest])

  const promoTexto: PromoTexto | null = useMemo(
    () => promo ? { titulo: promo.titulo, fim: promo.fim, itens: promo.itens.map((i) => ({ descricao: i.descricao, precoNormal: i.precoNormal, precoPromo: i.precoPromo })) } : null,
    [promo]
  )
  const template = promo?.mensagemTemplate || ""
  const mensagemBase = useMemo(
    () => (promoTexto ? montarMensagemPromo(template, promoTexto) : ""),
    [promoTexto, template]
  )

  const mudarStatus = async (s: StatusPromocao) => {
    try { await atualizarStatusPromocao(id, s); toast.success("Status atualizado."); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
  }
  const confirmarExcluir = async () => {
    try { await excluirPromocao(id); toast.success("Promoção excluída."); router.push("/promocoes") }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro.") }
  }
  const copiar = async () => {
    await navigator.clipboard.writeText(mensagemBase)
    setCopiado(true); toast.success("Texto copiado.")
    setTimeout(() => setCopiado(false), 2000)
  }
  const enviarWhats = (d: Destinatarios[number]) => {
    if (!promoTexto) return
    const msg = montarMensagemPromo(template, promoTexto, d.nome)
    window.open(linkWhatsPromo(d.telefone, msg), "_blank")
    setEnviados((p) => new Set(p).add(d.id))
  }
  const baixarPdf = async () => {
    if (!promo) return
    setGerandoPdf(true)
    try {
      // Versão visual (flyer HTML em iframe isolado → canvas → PDF), com emojis.
      await gerarPromoPdfHtml({
        titulo: promo.titulo,
        fim: promo.fim,
        itens: promo.itens.map((i) => ({ descricao: i.descricao, precoNormal: i.precoNormal, precoPromo: i.precoPromo })),
        empresaNome: empresaBranding?.nomeFantasia,
        logoUrl: empresaBranding?.logoUrl,
        cor: empresaBranding?.corPrimaria || empresaBranding?.corSidebar,
      })
    } catch {
      // Fallback: PDF simples via jsPDF (sem emoji), caso o html2canvas falhe.
      try {
        gerarPromoPDF({
          titulo: promo.titulo,
          fim: promo.fim,
          itens: promo.itens.map((i) => ({ descricao: i.descricao, precoNormal: i.precoNormal, precoPromo: i.precoPromo })),
          empresaNome: empresaBranding?.nomeFantasia,
          logoDataUrl: empresaBranding?.logoUrl,
          corPrimaria: empresaBranding?.corPrimaria || empresaBranding?.corSidebar,
        })
        toast.message("PDF gerado em modo simples.")
      } catch {
        toast.error("Não foi possível gerar o PDF.")
      }
    } finally {
      setGerandoPdf(false)
    }
  }

  if (authLoading || loading) {
    return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (!can("promocoes")) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground"><ShieldAlert className="size-10 text-destructive/70" /> Sem acesso.</div></AppShell>
  }
  if (!promo) {
    return <AppShell><div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-muted-foreground">Promoção não encontrada.<Button variant="outline" onClick={() => router.push("/promocoes")}>Voltar</Button></div></AppShell>
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <button onClick={() => router.push("/promocoes")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="size-3.5" /> Promoções
            </button>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="size-5 text-primary shrink-0" /> {promo.titulo}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{promo.itens.length} item(ns){promo.fim ? ` · válida até ${new Date(promo.fim).toLocaleDateString("pt-BR")}` : ""}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {podeEditar ? (
              <Select value={promo.status} onValueChange={(v) => mudarStatus(v as StatusPromocao)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Badge variant="outline">{promo.status}</Badge>}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={baixarPdf} disabled={gerandoPdf} title="Baixar flyer em PDF">
              {gerandoPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} PDF
            </Button>
            {podeEditar && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Editar</Button>}
            {podeEditar && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setExcluir(true)}><Trash2 className="size-4" /></Button>}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Itens */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold mb-3">Itens</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b"><tr>
                    <th className="text-left p-2">Produto</th><th className="text-right p-2">De</th><th className="text-right p-2">Por</th><th className="text-right p-2">%</th>
                  </tr></thead>
                  <tbody>
                    {promo.itens.map((it) => (
                      <tr key={it.id} className="border-b border-border/40">
                        <td className="p-2">{it.descricao}</td>
                        <td className="p-2 text-right text-muted-foreground line-through">{it.precoNormal > 0 ? brl(it.precoNormal) : "—"}</td>
                        <td className="p-2 text-right font-semibold">{brl(it.precoPromo)}</td>
                        <td className="p-2 text-right text-emerald-600">{it.desconto > 0 ? `-${Math.round(it.desconto)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mensagem */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Mensagem (WhatsApp)</h3>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copiar}>
                  {copiado ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} Copiar
                </Button>
              </div>
              <Textarea readOnly value={mensagemBase} rows={10} className="text-sm font-mono bg-muted/30" />
              <p className="text-[11px] text-muted-foreground">Pré-visualização. No envio individual, o <code>{"{nome}"}</code> é preenchido com o cliente.</p>
            </CardContent>
          </Card>
        </div>

        {/* Envio em lote */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold flex items-center gap-2"><Send className="size-4 text-primary" /> Envio em lote (WhatsApp)</h3>
              <span className="text-xs text-muted-foreground">{enviados.size} enviado(s) · {dest.length} cliente(s)</span>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={buscaDest} onChange={(e) => setBuscaDest(e.target.value)} className="pl-9 h-9" />
            </div>
            {loadingDest ? (
              <div className="flex h-24 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : dest.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum cliente com telefone cadastrado.</p>
            ) : (
              <div className="grid gap-1.5 max-h-[420px] overflow-y-auto">
                {dest.map((d) => (
                  <div key={d.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${enviados.has(d.id) ? "bg-emerald-500/5 border-emerald-500/30" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{d.telefone}{d.cidade ? ` · ${d.cidade}` : ""}</p>
                    </div>
                    {enviados.has(d.id) && <Check className="size-4 text-emerald-600 shrink-0" />}
                    <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={() => enviarWhats(d)}>
                      <MessageCircle className="size-4" /> WhatsApp
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              O WhatsApp abre uma conversa por cliente com a mensagem pronta (envio manual, sem custo de API). Os marcados ✓ já foram abertos nesta sessão.
            </p>
          </CardContent>
        </Card>
      </div>

      <PromocaoFormDialog open={editOpen} onOpenChange={setEditOpen} promocaoId={id} onSaved={load} />

      <AlertDialog open={excluir} onOpenChange={(o) => !o && setExcluir(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir promoção?</AlertDialogTitle>
            <AlertDialogDescription>Remove a campanha e seus itens. Não pode ser desfeito.</AlertDialogDescription>
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
