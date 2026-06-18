"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { saveProduto, getNextProdutoCode } from "@/lib/actions/produtos"
import { getCategorias } from "@/lib/actions/categorias"
import { getFornecedores } from "@/lib/actions/fornecedores"
import { consultarCmed } from "@/lib/actions/consultas"
import { Check, Box, Loader2, DollarSign, Barcode, Tags, Truck, Pill } from "lucide-react"
import { maskCurrency, parseCurrencyToNumber } from "@/lib/utils"
import type { Produto } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const produtoSchema = z.object({
  nome: z.string().min(3, "Nome obrigatório"),
  codigo: z.string().min(1, "Código obrigatório"),
  ean: z.string().min(1, "EAN/Cód. Barras obrigatório"),
  descricao: z.string().optional().nullable(),
  unidadePadrao: z.string().min(1, "Unidade obrigatória"),
  precoBase: z.union([z.string(), z.number()]).optional(),
  categoriaId: z.union([z.string(), z.number()]).optional().nullable(),
  fornecedorId: z.union([z.string(), z.number()]).optional().nullable(),
})

type ProdutoFormData = z.infer<typeof produtoSchema>

interface ProdutoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produtoToEdit?: Produto | null
  onSuccess?: () => void
}

export function ProdutoFormDialog({ open, onOpenChange, produtoToEdit, onSuccess }: ProdutoFormDialogProps) {
  const [loadingAutoCode, setLoadingAutoCode] = useState(false)
  const [categorias, setCategorias] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [pmvgSel, setPmvgSel] = useState<number | undefined>(undefined)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      precoBase: 0,
      unidadePadrao: "UN"
    }
  })

  useEffect(() => {
    async function loadInitialData() {
      if (open) {
        setPmvgSel(undefined)
        // Fetch categorias e fornecedores
        Promise.all([getCategorias(), getFornecedores()]).then(([cats, forns]) => {
          setCategorias(cats)
          setFornecedores(forns)
        })

        if (produtoToEdit) {
          reset({
            nome: produtoToEdit.nome || "",
            codigo: produtoToEdit.codigo || "",
            ean: produtoToEdit.ean || "",
            descricao: produtoToEdit.descricao || "",
            unidadePadrao: produtoToEdit.unidadePadrao || "UN",
            precoBase: produtoToEdit.precoBase ? maskCurrency(produtoToEdit.precoBase.toFixed(4).replace('.', ''), 4) : "0,0000",
            categoriaId: produtoToEdit.categoriaId ? produtoToEdit.categoriaId.toString() : "",
            fornecedorId: produtoToEdit.fornecedorId ? produtoToEdit.fornecedorId.toString() : "",
          })
        } else {
          reset({
            nome: "", codigo: "", ean: "", descricao: "", unidadePadrao: "UN", precoBase: 0, categoriaId: "", fornecedorId: ""
          })
          
          setLoadingAutoCode(true)
          try {
            const nextCode = await getNextProdutoCode()
            setValue("codigo", nextCode)
          } catch (err) {
            console.error("Erro ao buscar próximo código", err)
          } finally {
            setLoadingAutoCode(false)
          }
        }
      }
    }
    loadInitialData()
  }, [open, produtoToEdit, reset, setValue])

  async function onSubmit(data: ProdutoFormData) {
    try {
      const finalData = {
        ...data,
        id: produtoToEdit?.id,
        precoBase: typeof data.precoBase === 'string' ? parseCurrencyToNumber(data.precoBase) : data.precoBase,
        ...(pmvgSel !== undefined ? { pmvg: pmvgSel } : {}),
      }

      await saveProduto(finalData)

      toast.success(produtoToEdit ? "Produto atualizado!" : "Novo produto cadastrado!", {
        description: data.nome,
        icon: <Check className="size-4 text-green-500" />
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Erro ao salvar produto")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl p-0 border-0 shadow-2xl overflow-hidden bg-background">
        
        <div className="relative h-20 bg-gradient-to-r from-primary/90 to-primary p-6 flex flex-col justify-center overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Box className="size-24 rotate-12" />
          </div>
          <div className="z-10 flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Box className="size-5" />
                {produtoToEdit ? `Editando Produto: ${produtoToEdit.codigo}` : "Novo Produto"}
              </DialogTitle>
              <p className="text-xs text-white/70 mt-1">Preencha as informações básicas do produto.</p>
            </div>
            {produtoToEdit && <Badge className="bg-white/20 text-white border-0">Edição Ativa</Badge>}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col">
          <div className="space-y-6 animate-in fade-in duration-500">
            
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    Código Interno *
                    {loadingAutoCode && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                  </Label>
                  <Input id="codigo" {...register("codigo")} placeholder="123" className="bg-muted/30 h-9 font-mono" />
                  {errors.codigo && <p className="text-[10px] text-destructive">{errors.codigo.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Barcode className="size-3" /> EAN / Código de Barras *
                  </Label>
                  <div className="flex gap-1.5">
                    <Input id="ean" {...register("ean")} placeholder="Ex: 7890000000000" className="bg-muted/30 h-9 font-mono" />
                    <CmedEanPicker
                      initialTerm={produtoToEdit?.nome || ""}
                      onPick={(ean, pmvg, produto) => {
                        setValue("ean", ean, { shouldValidate: true })
                        setPmvgSel(pmvg)
                        toast.success("EAN atualizado pela CMED", { description: produto })
                      }}
                    />
                  </div>
                  {pmvgSel !== undefined && (
                    <p className="text-[10px] text-emerald-600">PMVG (teto gov.) {brl(pmvgSel)} será salvo no produto.</p>
                  )}
                  {errors.ean && <p className="text-[10px] text-destructive">{errors.ean.message}</p>}
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium">Nome do Produto *</Label>
                <Input id="nome" {...register("nome")} placeholder="Ex: Produto XYZ" className="bg-muted/30 focus-visible:ring-primary h-9" />
                {errors.nome && <p className="text-[10px] text-destructive italic">{errors.nome.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium">Unidade Padrão *</Label>
                  <Select 
                    defaultValue={produtoToEdit?.unidadePadrao || "UN"} 
                    onValueChange={(val) => setValue("unidadePadrao", val)} 
                    {...register("unidadePadrao")}
                  >
                    <SelectTrigger className="w-full bg-muted/30 h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                      <SelectItem value="KG">Quilograma (KG)</SelectItem>
                      <SelectItem value="CX">Caixa (CX)</SelectItem>
                      <SelectItem value="PCT">Pacote (PCT)</SelectItem>
                      <SelectItem value="MT">Metro (MT)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.unidadePadrao && <p className="text-[10px] text-destructive">{errors.unidadePadrao.message}</p>}
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Tags className="size-3" /> Categoria
                  </Label>
                  <Select 
                    defaultValue={produtoToEdit?.categoriaId ? produtoToEdit.categoriaId.toString() : ""} 
                    onValueChange={(val) => setValue("categoriaId", val)} 
                  >
                    <SelectTrigger className="w-full bg-muted/30 h-9">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Truck className="size-3" /> Fornecedor
                </Label>
                <Select 
                  defaultValue={produtoToEdit?.fornecedorId ? produtoToEdit.fornecedorId.toString() : ""} 
                  onValueChange={(val) => setValue("fornecedorId", val)} 
                >
                  <SelectTrigger className="w-full bg-muted/30 h-9">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(forn => (
                      <SelectItem key={forn.id} value={forn.id.toString()}>{forn.razaoSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium">Descrição Detalhada</Label>
                <Textarea {...register("descricao")} rows={3} placeholder="Características e informações adicionais do produto..." className="bg-muted/30 resize-none text-xs" />
              </div>

            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border/50">
             <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
               Cancelar
             </Button>
             <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 px-8 shadow-md">
                {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                {produtoToEdit ? 'Atualizar Produto' : 'Cadastrar Produto'}
             </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CmedEanPicker({
  initialTerm,
  onPick,
}: {
  initialTerm: string
  onPick: (ean: string, pmvg: number, produto: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(initialTerm)
  const [results, setResults] = useState<Awaited<ReturnType<typeof consultarCmed>>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try { setResults(await consultarCmed(q)) } catch { setResults([]) } finally { setLoading(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, open])

  useEffect(() => { if (open) setQuery(initialTerm) }, [open, initialTerm])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 shrink-0" title="Buscar EAN atual na CMED">
          <Pill className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar medicamento na CMED..." value={query} onValueChange={setQuery} />
          <CommandList>
            {query.trim().length < 2 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Digite ao menos 2 caracteres…</div>
            ) : loading ? (
              <div className="py-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            ) : results.length === 0 ? (
              <CommandEmpty>Nada na CMED. Importe a planilha em Consultas → CMED.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.filter((m) => m.ean).map((m) => (
                  <CommandItem
                    key={m.id}
                    value={String(m.id)}
                    onSelect={() => { onPick(m.ean!, m.pmvg, m.produto); setOpen(false) }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{m.produto}</span>
                      <span className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{m.ean}</span> · {[m.apresentacao, m.laboratorio].filter(Boolean).join(" · ")} · PMVG {brl(m.pmvg)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
