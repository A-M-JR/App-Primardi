/**
 * Catálogo de rótulos/cores do módulo de Licitações & Faturamento.
 * Sem dependências de servidor — pode ser importado por client components.
 */

import type {
  ModalidadeLicitacao,
  StatusLicitacao,
  StatusEmpenho,
} from "@prisma/client"

export const MODALIDADE_LABEL: Record<ModalidadeLicitacao, string> = {
  PREGAO_ELETRONICO: "Pregão Eletrônico",
  PREGAO_PRESENCIAL: "Pregão Presencial",
  CONCORRENCIA_ELETRONICA: "Concorrência Eletrônica",
  CONCORRENCIA_PRESENCIAL: "Concorrência Presencial",
  DIALOGO_COMPETITIVO: "Diálogo Competitivo",
  CONCURSO: "Concurso",
  LEILAO: "Leilão",
  DISPENSA: "Dispensa",
  INEXIGIBILIDADE: "Inexigibilidade",
  CREDENCIAMENTO: "Credenciamento",
  PRE_QUALIFICACAO: "Pré-qualificação",
  ADESAO_ATA: "Adesão a Ata (Carona)",
  OUTRA: "Outra",
}

export const MODALIDADES = Object.keys(MODALIDADE_LABEL) as ModalidadeLicitacao[]

/** Metadados de cada status: rótulo, cor (classes Tailwind) e agrupamento. */
export const STATUS_LICITACAO_META: Record<
  StatusLicitacao,
  { label: string; cor: string; dot: string; grupo: "radar" | "disputa" | "ganho" | "encerrado" }
> = {
  ACOMPANHANDO: { label: "Acompanhando", cor: "bg-sky-500/10 text-sky-600 border-sky-500/20", dot: "bg-sky-500", grupo: "radar" },
  EM_ANALISE: { label: "Em análise", cor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", dot: "bg-indigo-500", grupo: "radar" },
  VAI_PARTICIPAR: { label: "Vai participar", cor: "bg-violet-500/10 text-violet-600 border-violet-500/20", dot: "bg-violet-500", grupo: "disputa" },
  EM_DISPUTA: { label: "Em disputa", cor: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500", grupo: "disputa" },
  GANHA: { label: "Ganha", cor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", grupo: "ganho" },
  HOMOLOGADA: { label: "Homologada", cor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", dot: "bg-emerald-600", grupo: "ganho" },
  CONTRATADA: { label: "Contratada / Ata", cor: "bg-teal-500/10 text-teal-700 border-teal-500/30", dot: "bg-teal-600", grupo: "ganho" },
  PERDIDA: { label: "Perdida", cor: "bg-rose-500/10 text-rose-600 border-rose-500/20", dot: "bg-rose-500", grupo: "encerrado" },
  FRACASSADA: { label: "Fracassada", cor: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20", dot: "bg-zinc-500", grupo: "encerrado" },
  DESERTA: { label: "Deserta", cor: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20", dot: "bg-zinc-500", grupo: "encerrado" },
  SUSPENSA: { label: "Suspensa", cor: "bg-orange-500/10 text-orange-600 border-orange-500/20", dot: "bg-orange-500", grupo: "encerrado" },
  CANCELADA: { label: "Cancelada", cor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", dot: "bg-zinc-400", grupo: "encerrado" },
}

export const STATUS_LICITACAO = Object.keys(STATUS_LICITACAO_META) as StatusLicitacao[]

export const STATUS_EMPENHO_META: Record<
  StatusEmpenho,
  { label: string; cor: string }
> = {
  PENDENTE: { label: "Pendente", cor: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  FATURADO: { label: "Faturado", cor: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  ENTREGUE: { label: "Entregue", cor: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  PAGO: { label: "Pago", cor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  CANCELADO: { label: "Cancelado", cor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
}

export const STATUS_EMPENHO = Object.keys(STATUS_EMPENHO_META) as StatusEmpenho[]

/** Status que representam um contrato/ata "vivo" (com saldo a faturar). */
export const STATUS_COM_SALDO: StatusLicitacao[] = ["GANHA", "HOMOLOGADA", "CONTRATADA"]

/** Formatação utilitária. */
export const brl = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export const num = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
