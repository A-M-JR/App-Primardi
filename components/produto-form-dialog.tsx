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
import { Check, Box, Loader2, DollarSign, Barcode, Tags, Truck } from "lucide-react"
import { maskCurrency, parseCurrencyToNumber } from "@/lib/utils"
import type { Produto } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
                  <Input id="ean" {...register("ean")} placeholder="Ex: 7890000000000" className="bg-muted/30 h-9 font-mono" />
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
