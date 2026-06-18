"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Target, Key, Plus, Trash2, GripVertical, Save, Loader2, Copy } from "lucide-react"
import { getCRMConfig, generateNewApiToken, saveFunnelStatus, saveOrigins } from "@/lib/actions/crm-config"
import { toast } from "sonner"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

type FunilStatus = { id: number | string, nome: string, cor: string };
type OrigemLead = { id: number | string, nome: string };

export function CRMConfig() {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [funil, setFunil] = useState<FunilStatus[]>([]);
  const [origens, setOrigens] = useState<OrigemLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingFunil, setIsSavingFunil] = useState(false);
  const [isSavingOrigens, setIsSavingOrigens] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const loadData = async () => {
      try {
        const data = await getCRMConfig();
        setApiToken(data.apiToken);
        setFunil(data.funil);
        setOrigens(data.origens);
      } catch (e) {
        toast.error("Erro ao carregar configurações do CRM");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleGenerateToken = async () => {
    const Swal = (await import("sweetalert2")).default
    const result = await Swal.fire({
      title: 'Deseja continuar?',
      text: "Gerar um novo token invalidará o antigo e todas as integrações atuais pararão de funcionar.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0f264a',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, gerar novo',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = await generateNewApiToken();
        setApiToken(token);
        Swal.fire({
          title: 'Sucesso!',
          text: 'Novo token gerado com sucesso.',
          icon: 'success',
          confirmButtonColor: '#0f264a'
        });
      } catch (e) {
        toast.error("Erro ao gerar token");
      }
    }
  };

  const copyToken = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken);
      toast.success("Token copiado para a área de transferência!");
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(funil);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFunil(items);
  };

  const addFunilStatus = () => {
    setFunil([...funil, { id: `new-${Date.now()}`, nome: "Nova Etapa", cor: "bg-slate-500" }]);
  };

  const removeFunilStatus = (index: number) => {
    const items = [...funil];
    items.splice(index, 1);
    setFunil(items);
  };

  const handleSaveFunil = async () => {
    setIsSavingFunil(true);
    try {
      await saveFunnelStatus(funil);
      toast.success("Funil salvo com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar funil");
    } finally {
      setIsSavingFunil(false);
    }
  };

  const addOrigem = () => {
    setOrigens([...origens, { id: `new-${Date.now()}`, nome: "Nova Origem" }]);
  };

  const removeOrigem = (index: number) => {
    const items = [...origens];
    items.splice(index, 1);
    setOrigens(items);
  };

  const handleSaveOrigens = async () => {
    setIsSavingOrigens(true);
    try {
      await saveOrigins(origens);
      toast.success("Origens salvas com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar origens");
    } finally {
      setIsSavingOrigens(false);
    }
  };

  if (!isMounted || isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Target className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Configurações de CRM (Leads)</CardTitle>
              <CardDescription>Gerencie as origens, etapas do funil e a integração com o seu site.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* API Token Section */}
          <div className="space-y-4 pb-6 border-b border-border/50">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Key className="size-4" /> Token de Integração (API)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Utilize este token no Header (Bearer) para enviar leads do seu site para o Primardi.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Input 
                value={apiToken || "Nenhum token gerado."} 
                readOnly 
                autoComplete="off"
                className="font-mono bg-muted/50 max-w-md"
              />
              {apiToken && (
                <Button variant="secondary" onClick={copyToken} title="Copiar Token">
                  <Copy className="size-4" />
                </Button>
              )}
              <Button onClick={handleGenerateToken} variant={apiToken ? "outline" : "default"}>
                {apiToken ? "Gerar Novo Token" : "Gerar Token"}
              </Button>
            </div>
          </div>

          {/* Funnel Status Section */}
          <div className="space-y-4 pb-6 border-b border-border/50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold">Etapas do Funil de Vendas</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Arraste para reordenar. A ordem define como elas aparecem no quadro Kanban.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addFunilStatus}>
                <Plus className="size-4 mr-2" /> Adicionar Etapa
              </Button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="funnel-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {funil.map((item, index) => (
                      <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg shadow-sm"
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing px-1">
                              <GripVertical className="size-4 text-muted-foreground" />
                            </div>
                            
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <Input
                                value={item.nome}
                                onChange={(e) => {
                                  const newFunil = [...funil];
                                  newFunil[index].nome = e.target.value;
                                  setFunil(newFunil);
                                }}
                                autoComplete="off"
                                placeholder="Nome da etapa"
                                className="h-9"
                              />
                              <div className="flex items-center gap-2">
                                <span className={`size-6 rounded-full shrink-0 shadow-sm ${item.cor}`} />
                                <select
                                  value={item.cor}
                                  onChange={(e) => {
                                    const newFunil = [...funil];
                                    newFunil[index].cor = e.target.value;
                                    setFunil(newFunil);
                                  }}
                                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                  <option value="bg-blue-500">Azul</option>
                                  <option value="bg-amber-500">Amarelo</option>
                                  <option value="bg-emerald-500">Verde</option>
                                  <option value="bg-purple-500">Roxo</option>
                                  <option value="bg-rose-500">Vermelho</option>
                                  <option value="bg-slate-500">Cinza</option>
                                </select>
                              </div>
                            </div>

                            <Button variant="ghost" size="icon" onClick={() => removeFunilStatus(index)} className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveFunil} disabled={isSavingFunil} size="sm">
                {isSavingFunil ? "Salvando..." : "Salvar Funil"}
              </Button>
            </div>
          </div>

          {/* Origens Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold">Origens de Leads</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  De onde seus leads estão vindo (ex: Google, Instagram, Site).
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addOrigem}>
                <Plus className="size-4 mr-2" /> Adicionar Origem
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {origens.map((item, index) => (
                <div key={item.id.toString()} className="flex items-center gap-2 p-2 bg-card border border-border/50 rounded-lg shadow-sm">
                  <Input
                    value={item.nome}
                    onChange={(e) => {
                      const newOrigens = [...origens];
                      newOrigens[index].nome = e.target.value;
                      setOrigens(newOrigens);
                    }}
                    autoComplete="off"
                    placeholder="Nome da origem"
                    className="h-9"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeOrigem(index)} className="text-destructive shrink-0 hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveOrigens} disabled={isSavingOrigens} size="sm">
                {isSavingOrigens ? "Salvando..." : "Salvar Origens"}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
