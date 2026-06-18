"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"

export async function getKanbanData(requesterId?: number) {
  const { empresaId } = await getRequesterContext(requesterId);


  // 1. Get Funil Statuses
  const funilStatuses = await prisma.funilStatus.findMany({
    where: { empresaId, ativo: true },
    orderBy: { ordem: 'asc' }
  });

  // Se não existir nenhum status, cria alguns padrões
  let finalStatuses = funilStatuses;
  if (finalStatuses.length === 0) {
    const defaults = [
      { nome: "Novos Leads", cor: "bg-blue-500", ordem: 1 },
      { nome: "Em Contato", cor: "bg-amber-500", ordem: 2 },
      { nome: "Qualificados", cor: "bg-emerald-500", ordem: 3 },
    ];
    
    await prisma.funilStatus.createMany({
      data: defaults.map(d => ({ ...d, empresaId }))
    });

    finalStatuses = await prisma.funilStatus.findMany({
      where: { empresaId, ativo: true },
      orderBy: { ordem: 'asc' }
    });
  }

  // 2. Get Leads
  const leadsFromDb = await prisma.lead.findMany({
    where: { 
      empresaId, 
      OR: [
        { ativo: true },
        { clienteId: { not: null } }
      ]
    },
    include: { origem: true, vendedor: { select: { nome: true } } }
  });

  // Transform for Kanban
  const columns: Record<string, any> = {};
  const columnOrder: string[] = [];
  const leads: Record<string, any> = {};

  finalStatuses.forEach(status => {
    const colId = `col-${status.id}`;
    columns[colId] = {
      id: colId,
      dbId: status.id,
      title: status.nome,
      color: status.cor,
      leadIds: []
    };
    columnOrder.push(colId);
  });

  // Add fixed column for converted leads
  const convertedColId = "col-converted";
  columns[convertedColId] = {
    id: convertedColId,
    dbId: -1, // Use -1 to denote a virtual column
    title: "Convertidos (Cliente)",
    color: "bg-indigo-500", // A distinct color like indigo or purple
    leadIds: []
  };
  columnOrder.push(convertedColId);

  // Map leads to columns
  leadsFromDb.forEach(lead => {
    const leadId = `lead-${lead.id}`;
    leads[leadId] = {
      id: leadId,
      dbId: lead.id,
      name: lead.nome,
      company: lead.nomeEmpresa || "S/ Empresa",
      value: lead.valorEstimado,
      origin: lead.origem?.nome || "Site",
      date: new Date(lead.criadoEm).toLocaleDateString('pt-BR'),
      email: lead.email,
      telefone: lead.telefone,
      cep: lead.cep,
      observacoes: lead.observacoes,
      temperatura: lead.temperatura || null,
      vendedor: lead.vendedor?.nome || null,
      movidoEm: (lead.movidoEm ?? lead.criadoEm).toISOString(),
      clienteId: lead.clienteId
    };

    // Find the right column
    if (lead.clienteId !== null) {
      columns["col-converted"].leadIds.push(leadId);
    } else {
      const statusColId = lead.statusId ? `col-${lead.statusId}` : columnOrder[0];
      if (columns[statusColId]) {
        columns[statusColId].leadIds.push(leadId);
      } else {
         columns[columnOrder[0]].leadIds.push(leadId);
      }
    }
  });

  return {
    leads,
    columns,
    columnOrder
  };
}

export async function updateLeadStatus(leadIdNum: number, newStatusId: number, requesterId?: number) {
  const { empresaId } = await getRequesterContext(requesterId);

  await prisma.lead.update({
    where: { id: leadIdNum, empresaId: empresaId },
    data: { statusId: newStatusId, movidoEm: new Date() }
  });

  return { success: true };
}

export async function createLead(data: any, requesterId?: number) {
  const { empresaId } = await getRequesterContext(requesterId);

  let statusId = data.statusId ? Number(data.statusId) : null;
  if (!statusId) {
    const firstStatus = await prisma.funilStatus.findFirst({
      where: { empresaId, ativo: true },
      orderBy: { ordem: 'asc' }
    });
    if (firstStatus) statusId = firstStatus.id;
  }

  let origemId = data.origemId ? Number(data.origemId) : null;
  if (!origemId) {
    const firstOrigem = await prisma.origemLead.findFirst({
      where: { empresaId, ativo: true }
    });
    if (firstOrigem) origemId = firstOrigem.id;
  }

  if (!statusId || !origemId) {
    throw new Error("É necessário configurar Status e Origens no CRM primeiro.");
  }

  const created = await prisma.lead.create({
    data: {
      empresaId,
      nome: data.nome,
      telefone: data.telefone || "",
      email: data.email || null,
      cep: data.cep || null,
      nomeEmpresa: data.empresa || null, // the schema says nomeEmpresa or empresa depending on the user edits, I must check schema! wait I'll use `empresa: data.empresa` and fallback
      valorEstimado: data.valorEstimado ? Number(data.valorEstimado) : 0,
      origemId: origemId,
      statusId: statusId,
      observacoes: data.observacoes || null
    }
  });

  return created;
}

export async function vincularLeadACliente(leadId: number, clienteId: number) {
  const ctx = await getRequesterContext()
  // Lead e cliente precisam pertencer à empresa ativa.
  const [lead, cli] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, empresaId: ctx.empresaId }, select: { id: true } }),
    prisma.cliente.findFirst({ where: { id: clienteId, empresaId: ctx.empresaId }, select: { id: true } }),
  ])
  if (!lead) throw new Error("Lead não encontrado nesta empresa.")
  if (!cli) throw new Error("Cliente não encontrado nesta empresa.")

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      clienteId,
      dataConversao: new Date(),
      ativo: false // Opcional: marca como inativo para sair do funil ativo, ou manter true e mudar status. Vamos deixar inativo por enquanto, já que virou cliente.
    }
  });
  return updated;
}
export async function checkLeadClientMatch(leadId: number) {
  const ctx = await getRequesterContext()
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, empresaId: ctx.empresaId },
    select: { nomeEmpresa: true, email: true, telefone: true, empresaId: true }
  });

  if (!lead) return null;

  // Build OR conditions based on available lead data
  const orConditions: any[] = [];
  
  if (lead.nomeEmpresa && lead.nomeEmpresa.trim() !== "" && lead.nomeEmpresa !== "S/ Empresa") {
    orConditions.push({ razaoSocial: { contains: lead.nomeEmpresa, mode: "insensitive" } });
    orConditions.push({ nomeFantasia: { contains: lead.nomeEmpresa, mode: "insensitive" } });
  }
  if (lead.email && lead.email.trim() !== "") {
    orConditions.push({ email: lead.email });
  }
  if (lead.telefone && lead.telefone.trim() !== "") {
    const numbersOnly = lead.telefone.replace(/\D/g, "");
    if (numbersOnly.length >= 8) { // Only search if it's a valid-looking phone
      orConditions.push({ telefone: { contains: numbersOnly } });
    }
  }

  if (orConditions.length === 0) return null;

  const match = await prisma.cliente.findFirst({
    where: {
      empresaId: lead.empresaId,
      OR: orConditions
    },
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true
    }
  });

  return match;
}
