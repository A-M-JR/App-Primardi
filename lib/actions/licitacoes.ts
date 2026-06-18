"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { STATUS_COM_SALDO } from "@/lib/licitacoes/constants"
import {
  buscarEditaisPNCP,
  buscarItensPNCP,
  buscarArquivosPNCP,
  type BuscarPncpParams,
  type PncpEdital,
} from "@/lib/licitacoes/pncp"
import { uploadR2, removerR2PorUrl, r2Configurado } from "@/lib/storage/r2"
import { Prisma, type ModalidadeLicitacao, type StatusLicitacao } from "@prisma/client"

interface AnexoLicitacao {
  nome: string
  url: string
  tipo: string
  tamanho: number
  criadoEm: string
  origem?: "PNCP" | "MANUAL"
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
const toDate = (v?: string | null) => (v ? new Date(v) : null)

// ─────────────────────────────────────────────
// Tipos de entrada/saída
// ─────────────────────────────────────────────

export interface LicitacaoItemInput {
  id?: number
  produtoId?: number | null
  numeroItem?: string | null
  descricao: string
  marca?: string | null
  unidade?: string
  quantidade: number
  precoUnitario: number
  precoReferencia?: number
  observacao?: string | null
}

export interface LicitacaoInput {
  id?: number
  numeroProcesso?: string | null
  numeroEdital?: string | null
  numeroAta?: string | null
  numeroContrato?: string | null
  modalidade: ModalidadeLicitacao
  objeto: string
  orgaoNome: string
  orgaoCnpj?: string | null
  orgaoUf?: string | null
  orgaoCidade?: string | null
  clienteId?: number | null
  portal?: string | null
  linkEdital?: string | null
  dataPublicacao?: string | null
  dataAbertura?: string | null
  vigenciaInicio?: string | null
  vigenciaFim?: string | null
  valorEstimado?: number
  valorHomologado?: number
  status: StatusLicitacao
  observacoes?: string | null
  responsavelUserId?: number | null
  itens: LicitacaoItemInput[]
}

export interface LicitacaoFiltros {
  search?: string
  status?: StatusLicitacao | "todos" | "comSaldo"
  modalidade?: ModalidadeLicitacao
  uf?: string
  page?: number
}

// ─────────────────────────────────────────────
// Listagem + KPIs
// ─────────────────────────────────────────────

export async function getLicitacoes(filtros?: LicitacaoFiltros) {
  noStore()
  const ctx = await assertAcesso("licitacoes")
  const page = filtros?.page || 1
  const take = 20
  const skip = (page - 1) * take
  const search = filtros?.search?.trim()

  const where: Prisma.LicitacaoWhereInput = { empresaId: ctx.empresaId }
  if (filtros?.status === "comSaldo") {
    where.status = { in: STATUS_COM_SALDO }
  } else if (filtros?.status && filtros.status !== "todos") {
    where.status = filtros.status
  }
  if (filtros?.modalidade) where.modalidade = filtros.modalidade
  if (filtros?.uf) where.orgaoUf = filtros.uf
  if (search) {
    where.OR = [
      { objeto: { contains: search, mode: "insensitive" } },
      { orgaoNome: { contains: search, mode: "insensitive" } },
      { numeroProcesso: { contains: search, mode: "insensitive" } },
      { numeroEdital: { contains: search, mode: "insensitive" } },
      { numeroAta: { contains: search, mode: "insensitive" } },
      { numeroContrato: { contains: search, mode: "insensitive" } },
    ]
  }

  const [rows, total, agregados] = await Promise.all([
    prisma.licitacao.findMany({
      where,
      orderBy: [{ dataAbertura: "desc" }, { criadoEm: "desc" }],
      skip,
      take,
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        _count: { select: { itens: true, empenhos: true } },
      },
    }),
    prisma.licitacao.count({ where }),
    prisma.licitacao.groupBy({
      by: ["status"],
      where: { empresaId: ctx.empresaId },
      _count: { _all: true },
      _sum: { valorEstimado: true, valorHomologado: true },
    }),
  ])

  const porStatus: Record<string, number> = {}
  let valorEstimadoTotal = 0
  let valorGanhoTotal = 0
  for (const g of agregados) {
    porStatus[g.status] = g._count._all
    valorEstimadoTotal += g._sum.valorEstimado || 0
    if (STATUS_COM_SALDO.includes(g.status)) valorGanhoTotal += g._sum.valorHomologado || 0
  }
  const totalGeral = agregados.reduce((s, g) => s + g._count._all, 0)
  const emAndamento =
    (porStatus.ACOMPANHANDO || 0) +
    (porStatus.EM_ANALISE || 0) +
    (porStatus.VAI_PARTICIPAR || 0) +
    (porStatus.EM_DISPUTA || 0)
  const ganhas = STATUS_COM_SALDO.reduce((s, st) => s + (porStatus[st] || 0), 0)

  return {
    data: rows.map((r) => ({
      id: r.id,
      numeroProcesso: r.numeroProcesso,
      numeroEdital: r.numeroEdital,
      numeroAta: r.numeroAta,
      numeroContrato: r.numeroContrato,
      modalidade: r.modalidade,
      objeto: r.objeto,
      orgaoNome: r.orgaoNome,
      orgaoUf: r.orgaoUf,
      orgaoCidade: r.orgaoCidade,
      portal: r.portal,
      status: r.status,
      dataAbertura: iso(r.dataAbertura),
      vigenciaFim: iso(r.vigenciaFim),
      valorEstimado: r.valorEstimado,
      valorHomologado: r.valorHomologado,
      cliente: r.cliente,
      qtdItens: r._count.itens,
      qtdEmpenhos: r._count.empenhos,
    })),
    total,
    page,
    totalPages: Math.ceil(total / take),
    kpis: {
      total: totalGeral,
      emAndamento,
      ganhas,
      valorEstimadoTotal,
      valorGanhoTotal,
      porStatus,
    },
  }
}

// ─────────────────────────────────────────────
// Detalhe (com saldo por item)
// ─────────────────────────────────────────────

export async function getLicitacao(id: number) {
  noStore()
  const ctx = await assertAcesso("licitacoes")
  const lic = await prisma.licitacao.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true } },
      itens: {
        orderBy: { id: "asc" },
        include: {
          produto: { select: { id: true, codigo: true, nome: true } },
          empenhoItens: {
            include: { empenho: { select: { status: true } } },
          },
        },
      },
      empenhos: {
        orderBy: { criadoEm: "desc" },
        include: { _count: { select: { itens: true } } },
      },
    },
  })
  if (!lic) throw new Error("Licitação não encontrada.")

  let valorContratado = 0
  let valorFaturado = 0
  const itens = lic.itens.map((it) => {
    const faturadoQtd = it.empenhoItens
      .filter((ei) => ei.empenho.status !== "CANCELADO")
      .reduce((s, ei) => s + ei.quantidade, 0)
    const faturadoValor = it.empenhoItens
      .filter((ei) => ei.empenho.status !== "CANCELADO")
      .reduce((s, ei) => s + ei.total, 0)
    const saldoQtd = it.quantidade - faturadoQtd
    const valorItem = it.quantidade * it.precoUnitario
    valorContratado += valorItem
    valorFaturado += faturadoValor
    return {
      id: it.id,
      produtoId: it.produtoId,
      produto: it.produto,
      numeroItem: it.numeroItem,
      descricao: it.descricao,
      marca: it.marca,
      unidade: it.unidade,
      quantidade: it.quantidade,
      precoUnitario: it.precoUnitario,
      precoReferencia: it.precoReferencia,
      observacao: it.observacao,
      faturadoQtd,
      saldoQtd,
      valorItem,
      percExecutado: it.quantidade > 0 ? (faturadoQtd / it.quantidade) * 100 : 0,
    }
  })

  return {
    id: lic.id,
    numeroProcesso: lic.numeroProcesso,
    numeroEdital: lic.numeroEdital,
    numeroAta: lic.numeroAta,
    numeroContrato: lic.numeroContrato,
    modalidade: lic.modalidade,
    objeto: lic.objeto,
    orgaoNome: lic.orgaoNome,
    orgaoCnpj: lic.orgaoCnpj,
    orgaoUf: lic.orgaoUf,
    orgaoCidade: lic.orgaoCidade,
    clienteId: lic.clienteId,
    cliente: lic.cliente,
    portal: lic.portal,
    linkEdital: lic.linkEdital,
    dataPublicacao: iso(lic.dataPublicacao),
    dataAbertura: iso(lic.dataAbertura),
    vigenciaInicio: iso(lic.vigenciaInicio),
    vigenciaFim: iso(lic.vigenciaFim),
    valorEstimado: lic.valorEstimado,
    valorHomologado: lic.valorHomologado,
    status: lic.status,
    observacoes: lic.observacoes,
    fonteExterna: lic.fonteExterna,
    arquivos: (Array.isArray(lic.arquivos) ? lic.arquivos : []) as { titulo: string; tipo: string; url: string; data: string | null }[],
    anexos: (Array.isArray(lic.anexos) ? lic.anexos : []) as unknown as AnexoLicitacao[],
    linkEditalExterno: lic.linkEdital,
    criadoEm: iso(lic.criadoEm),
    itens,
    empenhos: lic.empenhos.map((e) => ({
      id: e.id,
      numero: e.numero,
      numeroNotaFiscal: e.numeroNotaFiscal,
      status: e.status,
      dataEmpenho: iso(e.dataEmpenho),
      prazoEntrega: iso(e.prazoEntrega),
      dataEntrega: iso(e.dataEntrega),
      valorTotal: e.valorTotal,
      qtdItens: e._count.itens,
    })),
    resumo: {
      valorContratado,
      valorFaturado,
      saldo: valorContratado - valorFaturado,
      percExecutado: valorContratado > 0 ? (valorFaturado / valorContratado) * 100 : 0,
    },
  }
}

// ─────────────────────────────────────────────
// Criar / Atualizar
// ─────────────────────────────────────────────

export async function salvarLicitacao(input: LicitacaoInput) {
  const ctx = await assertAcesso("licitacoes", "edit")
  if (!input.objeto?.trim()) throw new Error("Informe o objeto da licitação.")
  if (!input.orgaoNome?.trim()) throw new Error("Informe o órgão/cliente.")

  const dados = {
    numeroProcesso: input.numeroProcesso?.trim() || null,
    numeroEdital: input.numeroEdital?.trim() || null,
    numeroAta: input.numeroAta?.trim() || null,
    numeroContrato: input.numeroContrato?.trim() || null,
    modalidade: input.modalidade,
    objeto: input.objeto.trim(),
    orgaoNome: input.orgaoNome.trim(),
    orgaoCnpj: input.orgaoCnpj?.trim() || null,
    orgaoUf: input.orgaoUf?.trim()?.toUpperCase() || null,
    orgaoCidade: input.orgaoCidade?.trim() || null,
    clienteId: input.clienteId || null,
    portal: input.portal?.trim() || null,
    linkEdital: input.linkEdital?.trim() || null,
    dataPublicacao: toDate(input.dataPublicacao),
    dataAbertura: toDate(input.dataAbertura),
    vigenciaInicio: toDate(input.vigenciaInicio),
    vigenciaFim: toDate(input.vigenciaFim),
    valorEstimado: input.valorEstimado || 0,
    valorHomologado: input.valorHomologado || 0,
    status: input.status,
    observacoes: input.observacoes?.trim() || null,
    responsavelUserId: input.responsavelUserId || null,
  }

  const id = await prisma.$transaction(async (tx) => {
    let licId = input.id
    if (licId) {
      const existe = await tx.licitacao.findFirst({ where: { id: licId, empresaId: ctx.empresaId } })
      if (!existe) throw new Error("Licitação não encontrada.")
      await tx.licitacao.update({ where: { id: licId }, data: dados })
    } else {
      const criada = await tx.licitacao.create({
        data: { ...dados, empresaId: ctx.empresaId, criadoPorUserId: ctx.userId },
      })
      licId = criada.id
    }

    // Sincroniza itens: remove ausentes, upsert dos enviados.
    const idsEnviados = input.itens.filter((i) => i.id).map((i) => i.id!)
    await tx.licitacaoItem.deleteMany({
      where: { licitacaoId: licId, ...(idsEnviados.length ? { id: { notIn: idsEnviados } } : {}) },
    })
    for (const it of input.itens) {
      const itemData = {
        produtoId: it.produtoId || null,
        numeroItem: it.numeroItem?.trim() || null,
        descricao: it.descricao.trim(),
        marca: it.marca?.trim() || null,
        unidade: it.unidade?.trim() || "UN",
        quantidade: it.quantidade || 0,
        precoUnitario: it.precoUnitario || 0,
        precoReferencia: it.precoReferencia || 0,
        observacao: it.observacao?.trim() || null,
      }
      if (it.id) {
        await tx.licitacaoItem.update({ where: { id: it.id }, data: itemData })
      } else {
        await tx.licitacaoItem.create({ data: { ...itemData, licitacaoId: licId! } })
      }
    }
    return licId!
  })

  revalidatePath("/licitacoes")
  revalidatePath("/faturamento")
  return { id }
}

export async function atualizarStatusLicitacao(id: number, status: StatusLicitacao) {
  const ctx = await assertAcesso("licitacoes", "edit")
  await prisma.licitacao.updateMany({ where: { id, empresaId: ctx.empresaId }, data: { status } })
  revalidatePath("/licitacoes")
  revalidatePath(`/licitacoes/${id}`)
  return { ok: true }
}

export async function excluirLicitacao(id: number) {
  const ctx = await assertAcesso("licitacoes", "edit")
  await prisma.licitacao.deleteMany({ where: { id, empresaId: ctx.empresaId } })
  revalidatePath("/licitacoes")
  return { ok: true }
}

// ─────────────────────────────────────────────
// Anexos (arquivos hospedados no R2)
// ─────────────────────────────────────────────

/** Registra um anexo já enviado ao R2 (via /api/upload scope=licitacao). */
export async function adicionarAnexoLicitacao(
  licitacaoId: number,
  anexo: { nome: string; url: string; tipo: string; tamanho: number }
) {
  const ctx = await assertAcesso("licitacoes", "edit")
  const lic = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, empresaId: ctx.empresaId },
    select: { anexos: true },
  })
  if (!lic) throw new Error("Licitação não encontrada.")
  const atuais = (Array.isArray(lic.anexos) ? lic.anexos : []) as unknown as AnexoLicitacao[]
  const novo: AnexoLicitacao = {
    nome: anexo.nome,
    url: anexo.url,
    tipo: anexo.tipo,
    tamanho: anexo.tamanho,
    criadoEm: new Date().toISOString(),
    origem: "MANUAL",
  }
  await prisma.licitacao.update({
    where: { id: licitacaoId },
    data: { anexos: [...atuais, novo] as unknown as Prisma.InputJsonValue },
  })
  revalidatePath(`/licitacoes/${licitacaoId}`)
  return { ok: true }
}

/** Remove um anexo do registro e do R2. */
export async function removerAnexoLicitacao(licitacaoId: number, url: string) {
  const ctx = await assertAcesso("licitacoes", "edit")
  const lic = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, empresaId: ctx.empresaId },
    select: { anexos: true },
  })
  if (!lic) throw new Error("Licitação não encontrada.")
  const atuais = (Array.isArray(lic.anexos) ? lic.anexos : []) as unknown as AnexoLicitacao[]
  await prisma.licitacao.update({
    where: { id: licitacaoId },
    data: { anexos: atuais.filter((a) => a.url !== url) as unknown as Prisma.InputJsonValue },
  })
  await removerR2PorUrl(url)
  revalidatePath(`/licitacoes/${licitacaoId}`)
  return { ok: true }
}

/** Baixa os documentos do edital (links PNCP) e hospeda no nosso R2. */
export async function arquivarDocumentosPNCP(licitacaoId: number) {
  const ctx = await assertAcesso("licitacoes", "edit")
  if (!r2Configurado()) throw new Error("Storage (R2) não configurado.")
  const lic = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, empresaId: ctx.empresaId },
    select: { arquivos: true, anexos: true },
  })
  if (!lic) throw new Error("Licitação não encontrada.")
  const arquivos = (Array.isArray(lic.arquivos) ? lic.arquivos : []) as unknown as { titulo: string; tipo: string; url: string }[]
  if (!arquivos.length) return { arquivados: 0, total: 0 }
  const anexos = (Array.isArray(lic.anexos) ? lic.anexos : []) as unknown as AnexoLicitacao[]

  let arquivados = 0
  let i = 0
  for (const a of arquivos) {
    i++
    const nome = a.titulo || `documento-${i}`
    if (anexos.some((an) => an.origem === "PNCP" && an.nome === nome)) continue // já arquivado
    try {
      const resp = await fetch(a.url, { signal: AbortSignal.timeout(20000) })
      if (!resp.ok) continue
      const ct = resp.headers.get("content-type") || "application/octet-stream"
      const buf = Buffer.from(await resp.arrayBuffer())
      const ext = ct.includes("pdf") ? "pdf" : ct.includes("zip") ? "zip" : ct.includes("html") ? "html" : "bin"
      const key = `licitacoes/${ctx.empresaId}/${licitacaoId}/edital-${Date.now()}-${i}.${ext}`
      const url = await uploadR2(key, buf, ct)
      anexos.push({ nome, url, tipo: ct, tamanho: buf.length, criadoEm: new Date().toISOString(), origem: "PNCP" })
      arquivados++
    } catch {
      /* ignora documento que falhar */
    }
  }
  if (arquivados) {
    await prisma.licitacao.update({
      where: { id: licitacaoId },
      data: { anexos: anexos as unknown as Prisma.InputJsonValue },
    })
    revalidatePath(`/licitacoes/${licitacaoId}`)
  }
  return { arquivados, total: arquivos.length }
}

// ─────────────────────────────────────────────
// Cronograma / Agenda
// ─────────────────────────────────────────────

export interface EventoCronograma {
  id: string
  licitacaoId: number
  tipo: "abertura" | "vigenciaFim"
  data: string // ISO
  titulo: string
  orgao: string
  status: StatusLicitacao
  modalidade: ModalidadeLicitacao
}

/** Eventos do cronograma num intervalo (sessões de pregão + fim de vigência). */
export async function getCronograma(inicioIso: string, fimIso: string): Promise<EventoCronograma[]> {
  noStore()
  const ctx = await assertAcesso("licitacoes")
  const inicio = new Date(inicioIso)
  const fim = new Date(fimIso)

  const [aberturas, vigencias] = await Promise.all([
    prisma.licitacao.findMany({
      where: { empresaId: ctx.empresaId, dataAbertura: { gte: inicio, lte: fim } },
      select: { id: true, objeto: true, orgaoNome: true, status: true, modalidade: true, dataAbertura: true },
    }),
    prisma.licitacao.findMany({
      where: {
        empresaId: ctx.empresaId,
        vigenciaFim: { gte: inicio, lte: fim },
        status: { in: STATUS_COM_SALDO },
      },
      select: { id: true, objeto: true, orgaoNome: true, status: true, modalidade: true, vigenciaFim: true },
    }),
  ])

  const eventos: EventoCronograma[] = []
  for (const a of aberturas) {
    eventos.push({
      id: `ab-${a.id}`,
      licitacaoId: a.id,
      tipo: "abertura",
      data: a.dataAbertura!.toISOString(),
      titulo: a.objeto,
      orgao: a.orgaoNome,
      status: a.status,
      modalidade: a.modalidade,
    })
  }
  for (const v of vigencias) {
    eventos.push({
      id: `vg-${v.id}`,
      licitacaoId: v.id,
      tipo: "vigenciaFim",
      data: v.vigenciaFim!.toISOString(),
      titulo: v.objeto,
      orgao: v.orgaoNome,
      status: v.status,
      modalidade: v.modalidade,
    })
  }
  return eventos.sort((a, b) => a.data.localeCompare(b.data))
}

/** Próximos eventos (para o widget de "próximas sessões"). */
export async function getProximasSessoes(limite = 8) {
  noStore()
  const ctx = await assertAcesso("licitacoes")
  const agora = new Date()
  const rows = await prisma.licitacao.findMany({
    where: {
      empresaId: ctx.empresaId,
      dataAbertura: { gte: agora },
      status: { notIn: ["PERDIDA", "CANCELADA", "FRACASSADA", "DESERTA"] },
    },
    orderBy: { dataAbertura: "asc" },
    take: limite,
    select: {
      id: true, objeto: true, orgaoNome: true, orgaoUf: true,
      status: true, modalidade: true, dataAbertura: true, portal: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    objeto: r.objeto,
    orgaoNome: r.orgaoNome,
    orgaoUf: r.orgaoUf,
    status: r.status,
    modalidade: r.modalidade,
    portal: r.portal,
    dataAbertura: iso(r.dataAbertura),
  }))
}

/**
 * Contadores de alerta para badges no menu:
 * - sessoesProximas: pregões com sessão nos próximos 7 dias.
 * - contratosVencendo: contratos/atas com saldo cuja vigência termina em ≤30 dias.
 */
export async function getAlertasLicitacoes() {
  noStore()
  const ctx = await assertAcesso("licitacoes")
  const agora = new Date()
  const em7 = new Date(agora.getTime() + 7 * 86400000)
  const hoje0 = new Date(agora); hoje0.setHours(0, 0, 0, 0)
  const em30 = new Date(hoje0.getTime() + 30 * 86400000)

  const [sessoesProximas, contratos] = await Promise.all([
    prisma.licitacao.count({
      where: {
        empresaId: ctx.empresaId,
        dataAbertura: { gte: agora, lte: em7 },
        status: { notIn: ["PERDIDA", "CANCELADA", "FRACASSADA", "DESERTA"] },
      },
    }),
    prisma.licitacao.findMany({
      where: {
        empresaId: ctx.empresaId,
        status: { in: STATUS_COM_SALDO },
        vigenciaFim: { gte: hoje0, lte: em30 },
      },
      select: {
        itens: { select: { quantidade: true, precoUnitario: true, empenhoItens: { select: { total: true, empenho: { select: { status: true } } } } } },
      },
    }),
  ])

  // Conta só contratos vencendo que ainda têm saldo a faturar.
  let contratosVencendo = 0
  for (const c of contratos) {
    let contratado = 0
    let faturado = 0
    for (const it of c.itens) {
      contratado += it.quantidade * it.precoUnitario
      faturado += it.empenhoItens.filter((ei) => ei.empenho.status !== "CANCELADO").reduce((s, ei) => s + ei.total, 0)
    }
    if (contratado - faturado > 0.01) contratosVencendo++
  }

  return { sessoesProximas, contratosVencendo }
}

// ─────────────────────────────────────────────
// Integração PNCP (busca + importação)
// ─────────────────────────────────────────────

export async function buscarPNCP(params: BuscarPncpParams) {
  await assertAcesso("licitacoes")
  return buscarEditaisPNCP(params)
}

/** Importa editais selecionados do PNCP, evitando duplicar (fonteExterna+idExterno). */
export async function importarEditaisPNCP(editais: PncpEdital[]) {
  const ctx = await assertAcesso("licitacoes", "edit")
  if (!editais?.length) return { criados: 0, ignorados: 0 }

  const ids = editais.map((e) => e.idExterno).filter(Boolean)
  const existentes = await prisma.licitacao.findMany({
    where: { empresaId: ctx.empresaId, fonteExterna: "PNCP", idExterno: { in: ids } },
    select: { idExterno: true },
  })
  const jaTem = new Set(existentes.map((e) => e.idExterno))

  let criados = 0
  let ignorados = 0
  let comItens = 0
  let comArquivos = 0
  for (const e of editais) {
    if (jaTem.has(e.idExterno)) {
      ignorados++
      continue
    }

    // Traz itens e documentos (PDF do edital). Falha aqui não impede a criação.
    const [itens, arquivos] = await Promise.all([
      buscarItensPNCP(e.orgaoCnpj, e.anoCompra, e.sequencialCompra),
      buscarArquivosPNCP(e.orgaoCnpj, e.anoCompra, e.sequencialCompra),
    ])
    if (itens.length) comItens++
    if (arquivos.length) comArquivos++

    await prisma.licitacao.create({
      data: {
        empresaId: ctx.empresaId,
        criadoPorUserId: ctx.userId,
        numeroProcesso: e.numeroProcesso || null,
        numeroEdital: e.numeroEdital || null,
        modalidade: e.modalidade,
        objeto: e.objeto || "(sem objeto)",
        orgaoNome: e.orgaoNome || "(órgão não informado)",
        orgaoCnpj: e.orgaoCnpj || null,
        orgaoUf: e.orgaoUf || null,
        orgaoCidade: e.orgaoCidade || null,
        portal: "PNCP",
        linkEdital: e.linkEdital || null,
        dataPublicacao: toDate(e.dataPublicacao),
        dataAbertura: toDate(e.dataAbertura),
        valorEstimado: e.valorEstimado || 0,
        status: "ACOMPANHANDO",
        fonteExterna: "PNCP",
        idExterno: e.idExterno,
        arquivos: arquivos.length ? (arquivos as unknown as Prisma.InputJsonValue) : undefined,
        itens: itens.length
          ? {
              create: itens.map((it) => ({
                numeroItem: it.numeroItem ? String(it.numeroItem) : null,
                descricao: it.descricao || "(sem descrição)",
                unidade: it.unidade || "UN",
                quantidade: it.quantidade || 0,
                precoUnitario: 0,
                precoReferencia: it.precoReferencia || 0,
              })),
            }
          : undefined,
      },
    })
    criados++
  }

  revalidatePath("/licitacoes")
  return { criados, ignorados, comItens, comArquivos }
}

// ─────────────────────────────────────────────
// Apoio: clientes para vínculo
// ─────────────────────────────────────────────

export async function getClientesParaVinculo(search?: string) {
  const ctx = await assertAcesso("licitacoes")
  const q = search?.trim()
  const rows = await prisma.cliente.findMany({
    where: {
      empresaId: ctx.empresaId,
      ativo: true,
      ...(q
        ? {
            OR: [
              { razaoSocial: { contains: q, mode: "insensitive" } },
              { nomeFantasia: { contains: q, mode: "insensitive" } },
              { cnpj: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { razaoSocial: "asc" },
    take: 20,
    select: { id: true, razaoSocial: true, nomeFantasia: true, cidade: true, estado: true },
  })
  return rows
}
