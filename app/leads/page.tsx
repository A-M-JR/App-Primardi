"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Target, Plus, Settings, GripVertical, Calendar, DollarSign, Building2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { getKanbanData, updateLeadStatus } from "@/lib/actions/leads"
import { toast } from "sonner"
import { NovoLeadDialog } from "@/components/novo-lead-dialog"
import { LeadDetailsDialog } from "@/components/lead-details-dialog"

type Lead = {
  id: string;
  dbId: number;
  name: string;
  company: string;
  value: number;
  origin: string;
  date: string;
};

type Column = {
  id: string;
  dbId: number;
  title: string;
  color: string;
  leadIds: string[];
};

type DataState = {
  leads: Record<string, Lead>;
  columns: Record<string, Column>;
  columnOrder: string[];
};

export default function LeadsPage() {
  const [data, setData] = useState<DataState | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load data from DB
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getKanbanData();
      setData(res as any);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const onDragEnd = async (result: DropResult) => {
    if (!data) return;
    
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const startColumn = data.columns[source.droppableId];
    const finishColumn = data.columns[destination.droppableId];

    // Movendo dentro da mesma coluna
    if (startColumn === finishColumn) {
      const newLeadIds = Array.from(startColumn.leadIds);
      newLeadIds.splice(source.index, 1);
      newLeadIds.splice(destination.index, 0, draggableId);

      const newColumn = {
        ...startColumn,
        leadIds: newLeadIds,
      };

      setData({
        ...data,
        columns: {
          ...data.columns,
          [newColumn.id]: newColumn,
        },
      });
      return;
    }

    // Movendo de uma coluna para outra
    if (finishColumn.dbId === -1) {
      toast.info("Para converter, clique no card e use o botão 'Converter em Cliente'.");
      return;
    }

    const startLeadIds = Array.from(startColumn.leadIds);
    startLeadIds.splice(source.index, 1);
    const newStart = {
      ...startColumn,
      leadIds: startLeadIds,
    };

    const finishLeadIds = Array.from(finishColumn.leadIds);
    finishLeadIds.splice(destination.index, 0, draggableId);
    const newFinish = {
      ...finishColumn,
      leadIds: finishLeadIds,
    };

    // Atualiza estado local (optimistic update)
    setData({
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    });

    // Atualiza no banco
    const leadDbId = data.leads[draggableId].dbId;
    const newStatusDbId = newFinish.dbId;
    try {
      await updateLeadStatus(leadDbId, newStatusDbId);
      toast.success(`Lead movido para ${newFinish.title}`);
    } catch (error) {
      toast.error("Erro ao mover lead.");
      loadData(); // Reverte state
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  if (!isMounted) return null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-6rem)]">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2 sm:gap-3">
              <Target className="size-6 sm:size-8 text-primary" />
              Leads (CRM)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie seus leads e avance nas etapas do funil de vendas.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link href="/configuracoes?tab=crm" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto shadow-sm">
                <Settings className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Configurar Funil</span>
              </Button>
            </Link>
            <NovoLeadDialog onCreated={loadData} />
          </div>
        </div>

        {/* Kanban Board Area */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {loading ? (
             <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                Carregando funil...
             </div>
          ) : data ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 h-full items-start w-max sm:w-auto">
                
                {data.columnOrder.map((columnId) => {
                  const column = data.columns[columnId];
                  const leads = column.leadIds.map((leadId) => data.leads[leadId]);

                  return (
                    <div key={column.id} className="flex flex-col w-[85vw] sm:w-80 shrink-0 h-full max-h-full">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-[15px] flex items-center gap-2 text-foreground/90">
                          <span className={`size-2.5 rounded-full ${column.color} shadow-sm`} />
                          {column.title}
                          <span className="text-[11px] bg-muted/80 px-2 py-0.5 rounded-full text-muted-foreground ml-1 font-semibold border border-border/50">
                            {leads.length}
                          </span>
                        </h3>
                      </div>
                      
                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`
                              flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 p-2 rounded-xl border-2 transition-colors
                              ${snapshot.isDraggingOver ? 'bg-primary/5 border-primary/20 border-dashed' : 'bg-muted/10 border-transparent'}
                              ${leads.length === 0 && !snapshot.isDraggingOver ? 'border-dashed border-border/50 bg-muted/20 items-center justify-center' : ''}
                            `}
                          >
                            {leads.length === 0 && !snapshot.isDraggingOver && (
                              <span className="text-sm text-muted-foreground/60 text-center px-4">
                                Arraste leads para cá
                              </span>
                            )}

                            {leads.map((lead, index) => (
                              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`
                                      cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all shadow-sm
                                      ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-primary/20 ring-offset-1 z-50 bg-card' : 'bg-card'}
                                    `}
                                    onClick={() => {
                                      setSelectedLead(lead as any);
                                      setIsDetailsOpen(true);
                                    }}
                                  >
                                    <CardContent className="p-4 flex flex-col gap-3 group">
                                      <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors flex-1 break-words">
                                          {lead.name}
                                        </h4>
                                        <GripVertical className="size-4 text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                      
                                      <div className="flex flex-col gap-1.5 mt-1">
                                        <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                                          <Building2 className="size-3.5 shrink-0" />
                                          <span className="truncate">{lead.company}</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                                          <Calendar className="size-3.5 shrink-0" />
                                          {lead.date}
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/40">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/50">
                                          {lead.origin}
                                        </span>
                                        <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                          <DollarSign className="size-3" />
                                          {formatCurrency(lead.value).replace('R$', '').trim()}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          ) : null}
        </div>
      </div>
      <LeadDetailsDialog 
        lead={selectedLead} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
      />
    </AppShell>
  )
}
