import { canManageCompras } from "./permissions"

/** Módulo Compras — ponto central para permissões futuras por tela/ação */
export const COMPRAS_MODULE = {
  id: "compras",
  name: "Compras",
  basePath: "/compras",
  screens: {
    planejamentos: "/compras/planejamentos",
    importacoes: "/compras/importacoes",
    cotacoes: "/compras/cotacoes",
    pedidos: "/compras/pedidos",
  },
} as const

/** Acesso ao módulo (hoje = canManageCompras; depois: permissões granulares) */
export function canAccessComprasModule(role?: string | null): boolean {
  if (!role) return false
  return canManageCompras(role)
}
