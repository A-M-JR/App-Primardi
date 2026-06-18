import "server-only"

import { cache } from "react"
import type { User, UserEmpresa } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import type { RequesterContext } from "@/lib/actions/users"

/**
 * Camada de carga do contexto de autorização/multitenant — desacoplada do
 * arquivo `"use server"` (que só pode exportar funções async) para podermos
 * usar o `cache()` do React.
 *
 * Dois ganhos de performance sobre a versão sequencial anterior:
 *  - **Memoização por request**: as N Server Actions de UMA mesma requisição
 *    reaproveitam UMA carga, em vez de refazer 3-4 queries cada uma.
 *  - **Paralelismo**: user + membership + empresa vão juntos (Promise.all),
 *    reduzindo a 1 ida ao banco no caminho comum (empresa ativa já na sessão).
 *
 * A semântica de autorização é idêntica à anterior (MASTER/TI são cross-tenant;
 * PADRAO exige membership ativo na empresa).
 */

/** Busca o usuário da sessão — memoizada por request, reusada por todo o fluxo. */
export const loadSessionUser = cache(async (userId: number) => {
  return prisma.user.findUnique({ where: { id: userId } })
})

/**
 * Resolve a empresa inicial sem depender da coluna legada `User.empresaId`:
 * usa o 1º membership ativo; MASTER/TI sem membership caem na 1ª empresa.
 */
async function resolverEmpresaInicial(userId: number, crossTenant: boolean): Promise<number | null> {
  const m = await prisma.userEmpresa.findFirst({
    where: { userId, ativo: true },
    orderBy: { empresaId: "asc" },
    select: { empresaId: true },
  })
  if (m) return m.empresaId
  if (crossTenant) {
    const e = await prisma.empresa.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
    return e?.id ?? null
  }
  return null
}

function montarContexto(
  user: User,
  empresaId: number,
  membership: UserEmpresa | null,
  empresa: { modulosAtivos: unknown } | null,
  crossTenant: boolean,
): RequesterContext {
  const role: RequesterContext["role"] =
    (membership?.role as RequesterContext["role"]) ?? (crossTenant ? "GERENTE" : "OPERADOR")
  const permissoes = (membership?.permissoes as Record<string, string[]>) ?? {}
  const modulosAtivos = Array.isArray(empresa?.modulosAtivos)
    ? (empresa!.modulosAtivos as string[])
    : []

  return {
    userId: user.id,
    empresaId,
    nivelAcesso: user.nivelAcesso as RequesterContext["nivelAcesso"],
    role,
    vendedorId: membership?.vendedorId ?? null,
    permissoes,
    modulosAtivos,
    isAdmin: crossTenant || role === "GERENTE",
  }
}

export const loadRequesterContext = cache(async (userId?: number): Promise<RequesterContext> => {
  const session = await getSession()
  const resolvedId = session?.userId ?? (userId != null ? Number(userId) : undefined)

  if (resolvedId == null) {
    throw new Error("Não autenticado.")
  }

  // Caminho comum: a empresa ativa já vem na sessão → user + membership + empresa
  // EM PARALELO (1 round-trip em vez de 3 sequenciais).
  if (session?.empresaId != null) {
    const empresaId = session.empresaId
    const [user, membership, empresa] = await Promise.all([
      loadSessionUser(resolvedId),
      prisma.userEmpresa.findUnique({
        where: { userId_empresaId: { userId: resolvedId, empresaId } },
      }),
      prisma.empresa.findUnique({ where: { id: empresaId }, select: { modulosAtivos: true } }),
    ])
    if (!user || !user.ativo) {
      throw new Error("Usuário não autorizado ou inativo.")
    }
    const crossTenant = user.nivelAcesso === "MASTER" || user.nivelAcesso === "TI"
    // PADRAO só acessa empresa onde tem membership ativo. MASTER/TI têm bypass.
    if (!crossTenant && (!membership || !membership.ativo)) {
      throw new Error("Usuário sem acesso a esta empresa.")
    }
    return montarContexto(user, empresaId, membership, empresa, crossTenant)
  }

  // Sem empresa na sessão (1º acesso/fallback MASTER/TI): resolve e então paraleliza.
  const user = await loadSessionUser(resolvedId)
  if (!user || !user.ativo) {
    throw new Error("Usuário não autorizado ou inativo.")
  }
  const crossTenant = user.nivelAcesso === "MASTER" || user.nivelAcesso === "TI"
  const empresaId = await resolverEmpresaInicial(user.id, crossTenant)
  if (empresaId == null) {
    throw new Error("Usuário sem empresa vinculada.")
  }
  const [membership, empresa] = await Promise.all([
    prisma.userEmpresa.findUnique({
      where: { userId_empresaId: { userId: user.id, empresaId } },
    }),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { modulosAtivos: true } }),
  ])
  if (!crossTenant && (!membership || !membership.ativo)) {
    throw new Error("Usuário sem acesso a esta empresa.")
  }
  return montarContexto(user, empresaId, membership, empresa, crossTenant)
})
