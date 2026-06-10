"use server"

import { getRequesterContext } from "../users"
import { getAuditoriaCompra } from "@/lib/compras/auditoria"
import { unstable_noStore as noStore } from "next/cache"

export async function listarAuditoriaCompra(
  filtros?: { entidade?: string; entidadeId?: number; limit?: number },
  requesterId?: number
) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return getAuditoriaCompra(ctx.empresaId, filtros)
}
