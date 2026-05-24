import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Building2, Calendar, DollarSign, Mail, Phone, ExternalLink, ArrowRight, AlertCircle, Link as LinkIcon, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { checkLeadClientMatch, vincularLeadACliente } from "@/lib/actions/leads"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Lead = {
  id: string;
  dbId: number;
  name: string;
  company: string;
  value: number;
  origin: string;
  date: string;
  email?: string;
  telefone?: string;
  cep?: string;
  observacoes?: string;
  clienteId?: number | null;
}

export function LeadDetailsDialog({ 
  lead, 
  open, 
  onOpenChange 
}: { 
  lead: Lead | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void 
}) {
  const [matchedClient, setMatchedClient] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setIsChecking(true);
      setMatchedClient(null);
      checkLeadClientMatch(lead.dbId)
        .then(match => {
          if (match) setMatchedClient(match);
        })
        .catch(err => console.error("Erro ao verificar cliente correspondente:", err))
        .finally(() => setIsChecking(false));
    }
  }, [open, lead]);

  const handleLinkExisting = async () => {
    if (!lead || !matchedClient) return;
    setIsLinking(true);
    try {
      await vincularLeadACliente(lead.dbId, matchedClient.id);
      toast.success("Lead vinculado com sucesso ao cliente existente!");
      onOpenChange(false);
      // Aqui idealmente o parent component deveria recarregar os leads (ex: onLinked callback).
      // Como não passamos isso nas props, podemos dar reload na página ou assumir que o usuário fará F5,
      // mas o ideal é window.location.reload() como fallback rápido para limpar o funil.
      window.location.reload();
    } catch (err) {
      toast.error("Erro ao vincular lead.");
    } finally {
      setIsLinking(false);
    }
  };

  if (!lead) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getWhatsappLink = () => {
    if (!lead.telefone) return "#"
    const numbers = lead.telefone.replace(/\D/g, "")
    return `https://wa.me/55${numbers}`
  }

  // Create query params for auto-filling the Novo Cliente form
  const queryParams = new URLSearchParams()
  if (lead.company && lead.company !== "S/ Empresa") queryParams.append("razao", lead.company)
  if (lead.name) queryParams.append("comprador", lead.name)
  if (lead.telefone) queryParams.append("tel", lead.telefone)
  if (lead.email) queryParams.append("email", lead.email)
  if (lead.cep) queryParams.append("cep", lead.cep)
  // You could also append a leadId if you want to handle conversion status later
  queryParams.append("leadId", String(lead.dbId))

  const newClientUrl = `/clientes/novo?${queryParams.toString()}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex justify-between items-start pr-6">
            <div>
              <DialogTitle className="text-xl">{lead.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 mt-1">
                <Building2 className="size-3.5" />
                {lead.company}
              </DialogDescription>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded border border-border/50">
              {lead.origin}
            </div>
          </div>
        </DialogHeader>

        {lead.clienteId ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="size-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-indigo-700 dark:text-indigo-400">Lead Convertido</h3>
              <p className="text-sm text-muted-foreground mt-1">Este lead já foi transformado em um cliente oficial na base.</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 w-full mt-4">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button asChild className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Link href={`/clientes/${lead.clienteId}`}>
                  Acessar Cadastro <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {matchedClient && (
          <Alert className="mt-4 bg-primary/5 border-primary/20 text-primary flex flex-col gap-3">
            <div className="flex gap-2">
              <AlertCircle className="size-4 mt-0.5" />
              <div>
                <AlertTitle className="font-semibold text-sm">Cliente já cadastrado na base!</AlertTitle>
                <AlertDescription className="text-xs text-foreground/80 mt-1">
                  Encontramos o cliente <strong>{matchedClient.razaoSocial}</strong> (CNPJ: {matchedClient.cnpj || "N/A"}). Deseja vincular este lead a ele?
                </AlertDescription>
              </div>
            </div>
            <Button 
              size="sm" 
              className="w-full sm:w-auto self-end bg-primary/20 hover:bg-primary/30 text-primary border-0 font-medium"
              onClick={handleLinkExisting}
              disabled={isLinking}
            >
              {isLinking ? "Vinculando..." : (
                <>
                  <LinkIcon className="size-3.5 mr-1.5" /> Vincular a este Cliente
                </>
              )}
            </Button>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="col-span-2 sm:col-span-1 bg-muted/20 border border-border/50 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Contato</span>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Phone className="size-4 text-primary" />
              {lead.telefone ? (
                <a href={getWhatsappLink()} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
                  {lead.telefone}
                  <ExternalLink className="size-3" />
                </a>
              ) : "Não informado"}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-muted/20 border border-border/50 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">E-mail</span>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4 text-primary" />
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="hover:text-primary transition-colors truncate block">
                  {lead.email}
                </a>
              ) : "Não informado"}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Valor Estimado</span>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-lg">
              <DollarSign className="size-5" />
              {formatCurrency(lead.value).replace('R$', '').trim()}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-muted/20 border border-border/50 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Data do Lead</span>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar className="size-4 text-primary" />
              {lead.date}
            </div>
          </div>

          {(lead.observacoes && lead.observacoes.trim() !== "") && (
            <div className="col-span-2 bg-muted/10 border border-border/50 p-4 rounded-lg mt-2">
              <span className="text-[11px] uppercase font-bold text-muted-foreground block mb-2">Observações</span>
              <p className="text-sm text-foreground/90 whitespace-pre-line">
                {lead.observacoes}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-border/50">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button asChild className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Link href={newClientUrl}>
              Converter em Cliente <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
