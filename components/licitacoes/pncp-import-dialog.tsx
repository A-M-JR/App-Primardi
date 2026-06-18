"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, Download, Radar, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { buscarPNCP, importarEditaisPNCP } from "@/lib/actions/licitacoes"
import { PNCP_MODALIDADES, UFS, type PncpEdital } from "@/lib/licitacoes/pncp"
import { brl } from "@/lib/licitacoes/constants"

const hojeYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const diasAtras = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const toPncp = (ymd: string) => ymd.replaceAll("-", "")
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")

export function PncpImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onImported: () => void
}) {
  const [uf, setUf] = useState("")
  const [modalidade, setModalidade] = useState("6")
  const [dataInicial, setDataInicial] = useState(diasAtras(7))
  const [dataFinal, setDataFinal] = useState(hojeYmd())
  const [palavraChave, setPalavraChave] = useState("medicamento")
  const [buscando, setBuscando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultados, setResultados] = useState<PncpEdital[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)

  const buscar = async (pg = 1) => {
    setBuscando(true)
    try {
      const r = await buscarPNCP({
        uf: uf || undefined,
        modalidadeCodigo: Number(modalidade),
        dataInicial: toPncp(dataInicial),
        dataFinal: toPncp(dataFinal),
        palavraChave: palavraChave || undefined,
        pagina: pg,
      })
      setResultados(r.editais)
      setTotalPaginas(r.totalPaginas)
      setPagina(r.pagina)
      setSel(new Set())
      if (r.editais.length === 0) toast.info("Nenhum edital encontrado para esse filtro.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar no PNCP.")
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const toggleTodos = () => {
    if (!resultados) return
    if (sel.size === resultados.length) setSel(new Set())
    else setSel(new Set(resultados.map((r) => r.idExterno)))
  }

  const importar = async () => {
    if (!resultados || sel.size === 0) return
    setImportando(true)
    try {
      const selecionados = resultados.filter((r) => sel.has(r.idExterno))
      const res = await importarEditaisPNCP(selecionados)
      toast.success(`${res.criados} importado(s)${res.ignorados ? `, ${res.ignorados} já existia(m)` : ""}.`, {
        description:
          res.comItens || res.comArquivos
            ? `${res.comItens} com itens · ${res.comArquivos} com documentos do edital`
            : undefined,
      })
      onImported()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.")
    } finally {
      setImportando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="size-5 text-primary" /> Buscar editais no PNCP
          </DialogTitle>
          <DialogDescription>
            Portal Nacional de Contratações Públicas — base oficial e gratuita do governo. Busque por período de
            publicação, UF e palavra-chave. Ao importar, trazemos também os <b>itens</b> e os <b>documentos do edital (PDF)</b>.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">UF</Label>
            <Select value={uf || "BR"} onValueChange={(v) => setUf(v === "BR" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BR">Todas</SelectItem>
                {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Modalidade</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PNCP_MODALIDADES.map((m) => <SelectItem key={m.codigo} value={String(m.codigo)}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Publicado de</Label>
            <Input type="date" className="h-9" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">até</Label>
            <Input type="date" className="h-9" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Palavra-chave</Label>
            <Input className="h-9" value={palavraChave} onChange={(e) => setPalavraChave(e.target.value)} placeholder="medicamento" />
          </div>
        </div>
        <Button onClick={() => buscar(1)} disabled={buscando} className="gap-2 w-fit">
          {buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Buscar editais
        </Button>

        {/* Resultados */}
        {resultados !== null && (
          <div className="space-y-2">
            {resultados.length > 0 && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={sel.size === resultados.length && resultados.length > 0} onCheckedChange={toggleTodos} />
                  Selecionar todos ({sel.size}/{resultados.length})
                </label>
                <span className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</span>
              </div>
            )}

            <div className="space-y-1.5 max-h-[42vh] overflow-y-auto">
              {resultados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum edital encontrado.</p>
              ) : (
                resultados.map((e) => (
                  <label
                    key={e.idExterno}
                    className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox checked={sel.has(e.idExterno)} onCheckedChange={() => toggle(e.idExterno)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{e.orgaoNome}</span>
                        {e.orgaoUf && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{e.orgaoCidade}/{e.orgaoUf}</span>}
                        <span className="text-[10px] text-muted-foreground">{e.modalidadeNome}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{e.objeto}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {e.numeroEdital && <span>Edital {e.numeroEdital}</span>}
                        <span>Abertura: {dataBR(e.dataAbertura)}</span>
                        {e.valorEstimado > 0 && <span>Est. {brl(e.valorEstimado)}</span>}
                        {e.linkEdital && (
                          <a href={e.linkEdital} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                            <ExternalLink className="size-3" /> portal
                          </a>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button variant="outline" size="sm" disabled={pagina <= 1 || buscando} onClick={() => buscar(pagina - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={pagina >= totalPaginas || buscando} onClick={() => buscar(pagina + 1)}>Próxima</Button>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={importar} disabled={importando || sel.size === 0} className="gap-2">
                {importando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Importar {sel.size > 0 ? `(${sel.size})` : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
