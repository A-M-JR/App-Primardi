/** Checagens de papel — sem Prisma; seguro para Client Components */

export function canManageCompras(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE" || role === "OPERADOR"
}

export function canApproveCompras(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE"
}
