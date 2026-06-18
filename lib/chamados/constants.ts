import type { ChamadoStatus, ChamadoPrioridade, ChamadoDestino } from "@prisma/client"

export const STATUS_CHAMADO_META: Record<ChamadoStatus, { label: string; cor: string; dot: string; aberto: boolean }> = {
  ABERTO: { label: "Aberto", cor: "bg-sky-500/10 text-sky-600 border-sky-500/20", dot: "bg-sky-500", aberto: true },
  EM_ANDAMENTO: { label: "Em andamento", cor: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500", aberto: true },
  AGUARDANDO: { label: "Aguardando", cor: "bg-violet-500/10 text-violet-600 border-violet-500/20", dot: "bg-violet-500", aberto: true },
  RESOLVIDO: { label: "Resolvido", cor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", aberto: false },
  FECHADO: { label: "Fechado", cor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", dot: "bg-zinc-400", aberto: false },
  CANCELADO: { label: "Cancelado", cor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", dot: "bg-zinc-400", aberto: false },
}
export const STATUS_CHAMADO = Object.keys(STATUS_CHAMADO_META) as ChamadoStatus[]

export const PRIORIDADE_META: Record<ChamadoPrioridade, { label: string; cor: string }> = {
  BAIXA: { label: "Baixa", cor: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" },
  MEDIA: { label: "Média", cor: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  ALTA: { label: "Alta", cor: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  URGENTE: { label: "Urgente", cor: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
}
export const PRIORIDADES = Object.keys(PRIORIDADE_META) as ChamadoPrioridade[]

export const DESTINO_META: Record<ChamadoDestino, { label: string }> = {
  INTERNO: { label: "Interno (equipe)" },
  DESENVOLVEDOR: { label: "Desenvolvedores da plataforma" },
}
export const DESTINOS = Object.keys(DESTINO_META) as ChamadoDestino[]
