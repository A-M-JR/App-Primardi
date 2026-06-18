import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getRequesterContext, getEmpresasDoUsuario } from "@/lib/actions/users"

/**
 * Retorna o usuário autenticado a partir do cookie de sessão (fonte de verdade).
 * Inclui o contexto de acesso da empresa ativa (nível, role, permissões,
 * módulos ativos) e a lista de empresas acessíveis — base para a sidebar por
 * permissão e o seletor de empresa. Substitui o fluxo antigo de localStorage.
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user || !user.ativo) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const ctx = await getRequesterContext()

  let vendor = null
  if (ctx.vendedorId) {
    vendor = await prisma.vendedor.findUnique({ where: { id: ctx.vendedorId } })
  }

  const { empresas } = await getEmpresasDoUsuario()

  // Branding da empresa ativa (logo + cores) para a identidade visual dinâmica.
  const empresaAtiva = await prisma.empresa.findUnique({
    where: { id: session.empresaId },
    select: { id: true, nomeFantasia: true, logoUrl: true, corSidebar: true, corPrimaria: true },
  })

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
