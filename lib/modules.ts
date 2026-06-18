/**
 * Catálogo central de módulos da plataforma (fonte da verdade).
 *
 * Permissões de usuário (UserEmpresa.permissoes, em JSON) e os módulos ativos
 * por empresa (Empresa.modulosAtivos) referenciam estas chaves.
 *
 * Módulos futuros (telas a construir): licitacoes, faturamento, contas_receber.
 * Ver docs/PLANO_MULTITENANCY.md.
 */

export const MODULOS = {
  comercial: { label: "Comercial", rotas: ["/orcamentos", "/pedidos", "/comissoes"] },
  crm: { label: "CRM", rotas: ["/clientes", "/leads"] },
  compras: { label: "Compras", rotas: ["/compras"] },
  estoque: {
    label: "Estoque",
    rotas: ["/produtos", "/estoque", "/categorias", "/tabelas-preco", "/fornecedores", "/separacao"],
  },
  cobranca: { label: "Crédito / Cobrança", rotas: ["/cobranca"] },
  licitacoes: { label: "Licitações", rotas: ["/licitacoes"] },
  faturamento: { label: "Faturamento", rotas: ["/faturamento"] },
  promocoes: { label: "Promoções", rotas: ["/promocoes"] },
  chamados: { label: "Chamados", rotas: ["/chamados", "/departamentos"] },
} as const

export type ModuloId = keyof typeof MODULOS
export type Acao = "view" | "edit" | "approve"

export const MODULO_IDS = Object.keys(MODULOS) as ModuloId[]

export type NivelAcesso = "MASTER" | "TI" | "PADRAO"
export type RoleEmpresa = "GERENTE" | "OPERADOR"

export interface AccessContext {
  nivelAcesso: NivelAcesso
  role: RoleEmpresa
  permissoes: Partial<Record<ModuloId, Acao[]>>
  modulosAtivos: ModuloId[]
}

/**
 * Decide se o contexto tem permissão para uma ação num módulo.
 *
 * Regras:
 * 1. Módulo precisa estar ativo na empresa (senão ninguém acessa, nem GERENTE).
 * 2. MASTER e TI têm bypass total dentro dos módulos ativos.
 * 3. GERENTE tem bypass dentro da empresa.
 * 4. OPERADOR é governado pelo JSON de permissões.
 *
 * Obs: "Vendedor" não é role — é um OPERADOR com vendedorId vinculado.
 */
export function can(ctx: AccessContext, modulo: ModuloId, acao: Acao = "view"): boolean {
  if (!ctx.modulosAtivos?.includes(modulo)) return false
  if (ctx.nivelAcesso === "MASTER" || ctx.nivelAcesso === "TI") return true
  if (ctx.role === "GERENTE") return true
  return ctx.permissoes?.[modulo]?.includes(acao) ?? false
}

/** Resolve qual módulo (se houver) corresponde a uma rota. */
export function moduloDaRota(pathname: string): ModuloId | null {
  for (const id of MODULO_IDS) {
    if (MODULOS[id].rotas.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return id
    }
  }
  return null
}
