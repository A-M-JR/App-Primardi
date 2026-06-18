import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getRequesterContext, getEmpresasDoUsuario } from "@/lib/actions/users"
import { loadSessionUser } from "@/lib/request-context"

/**
 * Retorna o usuário autenticado a partir do cookie de sessão (fonte de verdade).
 * Inclui o contexto de acesso da empresa ativa (nível, role, permissões,
 * módulos ativos) e a lista de empresas acessíveis — base para a sidebar por
 * permissão e o seletor de empresa. Substitui o fluxo antigo de localStorage.
 *
 * Caminho quente do 1º paint de TODA página: por isso reusamos a carga
 * memoizada do contexto (mesmo `user`/membership/empresa) e paralelizamos o
 * que sobra, em vez de refazer ~6-8 queries sequenciais.
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // Valida sessão + carrega contexto (user+membership+empresa em paralelo, cacheado).
  let ctx
  try {
    ctx = await getRequesterContext()
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // `user` (linha completa), vendedor, empresas e branding — tudo em paralelo.
  // `loadSessionUser`/`getEmpresasDoUsuario` reaproveitam a carga já feita.
  const [user, vendor, empresasResult, empresaAtiva] = await Promise.all([
    loadSessionUser(session.userId),
    ctx.vendedorId ? prisma.vendedor.findUnique({ where: { id: ctx.vendedorId } }) : Promise.resolve(null),
    getEmpresasDoUsuario(),
    prisma.empresa.findUnique({
      where: { id: session.empresaId },
      select: { id: true, nomeFantasia: true, logoUrl: true, corSidebar: true, corPrimaria: true },
    }),
  ])

  if (!user || !user.ativo) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { empresas } = empresasResult

  return NextResponse.json({
    user: { ...user, criadoEm: user.criadoEm.toISOString() },
    vendor: vendor ? { ...vendor, criadoEm: vendor.criadoEm.toISOString() } : null,
    empresaAtivaId: session.empresaId,
    empresas,
    empresaAtiva,
    access: {
      nivelAcesso: ctx.nivelAcesso,
      role: ctx.role,
      permissoes: ctx.permissoes,
      modulosAtivos: ctx.modulosAtivos,
      isAdmin: ctx.isAdmin,
      vendedorId: ctx.vendedorId,
    },
  })
}
