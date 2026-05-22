"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

const clienteSchema = z.object({
  razaoSocial: z.string().min(3, "Razao social obrigatoria"),
  cnpj: z.string().min(14, "CNPJ invalido"),
  ie: z.string().optional(),
  endereco: z.string().min(3, "Endereco obrigatorio"),
  telefone: z.string().min(8, "Telefone obrigatorio"),
  cep: z.string().min(8, "CEP obrigatorio"),
  cidade: z.string().min(2, "Cidade obrigatoria"),
  estado: z.string().min(2, "Estado obrigatorio").max(2, "Use sigla do estado"),
  observacoes: z.string().optional(),
})

type ClienteFormData = z.infer<typeof clienteSchema>

interface ClienteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClienteFormDialog({ open, onOpenChange }: ClienteFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
  })

  function onSubmit(data: ClienteFormData) {
    toast.success("Cliente cadastrado com sucesso!", {
      description: data.razaoSocial,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo Cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente para cadastro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="razaoSocial">Razao Social *</Label>
              <Input id="razaoSocial" {...register("razaoSocial")} className="mt-1" />
              {errors.razaoSocial && (
                <p className="text-xs text-destructive mt-1">{errors.razaoSocial.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" {...register("cnpj")} className="mt-1" />
              {errors.cnpj && (
                <p className="text-xs text-destructive mt-1">{errors.cnpj.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="ie">Inscricao Estadual</Label>
              <Input id="ie" {...register("ie")} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="endereco">Endereco *</Label>
              <Input id="endereco" {...register("endereco")} className="mt-1" />
              {errors.endereco && (
                <p className="text-xs text-destructive mt-1">{errors.endereco.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="telefone">Telefone *</Label>
              <Input id="telefone" placeholder="(00) 0000-0000" {...register("telefone")} className="mt-1" />
              {errors.telefone && (
                <p className="text-xs text-destructive mt-1">{errors.telefone.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cep">CEP *</Label>
              <Input id="cep" placeholder="00000-000" {...register("cep")} className="mt-1" />
              {errors.cep && (
                <p className="text-xs text-destructive mt-1">{errors.cep.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cidade">Cidade *</Label>
              <Input id="cidade" {...register("cidade")} className="mt-1" />
              {errors.cidade && (
                <p className="text-xs text-destructive mt-1">{errors.cidade.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="estado">Estado (UF) *</Label>
              <Input id="estado" placeholder="SP" maxLength={2} {...register("estado")} className="mt-1" />
              {errors.estado && (
                <p className="text-xs text-destructive mt-1">{errors.estado.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea id="observacoes" rows={3} {...register("observacoes")} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
