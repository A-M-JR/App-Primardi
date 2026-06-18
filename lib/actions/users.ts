"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { getSession, setSession } from "@/lib/session"
import { loadRequesterContext, loadSessionUser } from "@/lib/request-context"

import { Prisma } from "@prisma/client"

export async function getUsers(params: {
  page?: number
  limit?: number
  search?: string
  status?: 'todos' | 'ativo' | 'inativo'
} = {}) {
  const ctx = await getRequesterContext()
  const page = params.page || 1
  const limit = params.limit || 20
  const searchPattern = `%${params.search || ""}%`
  const status = params.status || 'todos'

  // 1. SQL Raw para contadores de status (escopado por empresa via membership)
  let statusFilterSql = Prisma.sql`TRUE`
  if (status === 'ativo') statusFilterSql = Prisma.sql`u."ativo" = TRUE`
  else if (status === 'inativo') statusFilterSql = Prisma.sql`u."ativo" = FALSE`

  const counts: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE ${statusFilterSql})::int as total_filtrado,
      COUNT(*) FILTER (WHERE u."ativo" = TRUE)::int as ativos,
      COUNT(*) FILTER (WHERE u."ativo" = FALSE)::int as bloqueados,
      COUNT(*)::int as total_global
    FROM "crm_users" u
    JOIN "crm_user_empresas" ue ON ue."userId" = u.id AND ue."empresaId" = ${ctx.empresaId}
    WHERE (u."nome" ILIKE ${searchPattern} OR u."email" ILIKE ${searchPattern})
  `
  const stats = counts[0] || { total_filtrado: 0, ativos: 0, bloqueados: 0, total_global: 0 }

  // 2. Busca paginada (escopada por empresa via membership)
  const where: any = { memberships: { some: { empresaId: ctx.empresaId } } }
  if (params.search) {
    where.OR = [
      { nome: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ]
  }
  if (status === 'ativo') where.ativo = true
  else if (status === 'inativo') where.ativo = false

  const dbUsers = await prisma.user.findMany({
    where,
    orderBy: { nome: "asc" },
    skip: (page - 1) * limit,
    take: limit,
  })

  return {
    data: dbUsers.map(u => ({
      ...u,
      criadoEm: u.criadoEm.toISOString(),
    })),
    total: stats.total_filtrado,
    page,
    totalPages: Math.ceil(stats.total_filtrado / limit),
    kpis: {
      total: stats.total_global,
      ativos: stats.ativos,
      bloqueados: stats.bloqueados
    }
  }
}

export async function toggleUserActive(id: number) {
  await requireMasterOrTI()
  const user = await prisma.user.findUnique({ where: { id: id as any } })
  if (!user) throw new Error("Usuário não encontrado")
  
  const updated = await prisma.user.update({
    where: { id: id as any },
    data: { ativo: !user.ativo },
  })
  revalidatePath("/usuarios")
  return updated
}

export async function updateUserPassword(id: number, senha: string) {
  await requireMasterOrTI()
  const hashedPassword = await bcrypt.hash(senha, 10)
  return prisma.user.update({
    where: { id: id as any },
    data: { senha: hashedPassword },
  })
}

/**
 * Retorna 'ADMIN' se o solicitante tem visão total (MASTER/TI/GERENTE),
 * ou o vendedorId quando é um OPERADOR limitado a um vendedor.
 * Usado para forçar filtros de segurança no lado do servidor.
 */
export async function getRequesterVendedorId(userId?: number): Promise<number | 'ADMIN'> {
  const ctx = await getRequesterContext(userId)
  if (ctx.isAdmin) return 'ADMIN'
  return ctx.vendedorId || -1
}

export interface RequesterContext {
  userId: number
  empresaId: number
  nivelAcesso: "MASTER" | "TI" | "PADRAO"
  role: "GERENTE" | "OPERADOR"
  vendedorId: number | null
  permissoes: Record<string, string[]>
  modulosAtivos: string[]
  isAdmin: boolean // compat: "vê tudo" = MASTER/TI ou GERENTE
}

/**
 * Contexto de autorização e multitenant da requisição.
 *
 * Fonte de verdade: o cookie de sessão (server-side). O parâmetro `userId`
 * é apenas fallback de compatibilidade (chamadas antigas que ainda passam o
 * requesterId vindo do cliente).
 *
 * A carga real — memoizada por request (React `cache`) e com as queries em
 * paralelo — fica em `lib/request-context.ts`. Aqui só a reexpomos como Server
 * Action. Assim as N actions de uma mesma requisição reaproveitam UMA carga.
 */
export async function getRequesterContext(userId?: number): Promise<RequesterContext> {
  return loadRequesterContext(userId)
}

/**
 * Lista as empresas que o usuário da sessão pode acessar (para o seletor).
 * MASTER/TI veem todas; demais, apenas as dos memberships ativos.
 */
export async function getEmpresasDoUsuario() {
  const session = await getSession()
  if (!session) throw new Error("Não autenticado.")

  // Memoizado por request: reusa a mesma carga do usuário já feita no fluxo.
  const user = await loadSessionUser(session.userId)
  if (!user || !user.ativo) throw new Error("Não autenticado.")

  const crossTenant = user.nivelAcesso === "MASTER" || user.nivelAcesso === "TI"

  const empresas = crossTenant
    ? await prisma.empresa.findMany({
        orderBy: { nomeFantasia: "asc" },
        select: { id: true, nomeFantasia: true, razaoSocial: true },
      })
    : await prisma.userEmpresa
        .findMany({
          where: { userId: user.id, ativo: true },
          include: { empresa: { select: { id: true, nomeFantasia: true, razaoSocial: true } } },
          orderBy: { empresa: { nomeFantasia: "asc" } },
        })
        .then((ms) => ms.map((m) => m.empresa))

  return { empresaAtivaId: session.empresaId, empresas }
}

/**
 * Troca a empresa ativa da sessão, validando que o usuário tem acesso a ela.
 * Retorna o novo empresaAtivaId.
 */
export async function trocarEmpresa(empresaId: number): Promise<{ empresaAtivaId: number }> {
  const { empresas } = await getEmpresasDoUsuario()
  const permitido = empresas.some((e) => e.id === Number(empresaId))
  if (!permitido) throw new Error("Empresa não permitida para este usuário.")

  await setSession((await getSession())!.userId, Number(empresaId))
  return { empresaAtivaId: Number(empresaId) }
}

/** Exige nível MASTER ou TI (administração da plataforma). Lança se não for. */
export async function requireMasterOrTI(): Promise<RequesterContext> {
  const ctx = await getRequesterContext()
  if (ctx.nivelAcesso !== "MASTER" && ctx.nivelAcesso !== "TI") {
    throw new Error("Acesso restrito à administração (TI/Master).")
  }
  return ctx
}

/** Exige nível MASTER (configs sensíveis: token IA, contexto, módulos ativos). */
export async function requireMaster(): Promise<RequesterContext> {
  const ctx = await getRequesterContext()
  if (ctx.nivelAcesso !== "MASTER") {
    throw new Error("Acesso restrito ao Master da plataforma.")
  }
  return ctx
}

// ─── Gestão de acesso de usuários (memberships + nível) — MASTER/TI ───

export interface MembershipInput {
  empresaId: number
  role: "GERENTE" | "OPERADOR"
  vendedorId?: number | null
  permissoes: Record<string, string[]>
  ativo: boolean
}

export interface SalvarUsuarioInput {
  id?: number
  nome: string
  email: string
  senha?: string
  ativo: boolean
  nivelAcesso: "MASTER" | "TI" | "PADRAO"
  memberships: MembershipInput[]
}

/** Carrega os vínculos (memberships) de um usuário para o editor. */
export async function getUserMemberships(userId: number) {
  await requireMasterOrTI()
  return prisma.userEmpresa.findMany({
    where: { userId: Number(userId) },
    select: { empresaId: true, role: true, vendedorId: true, permissoes: true, ativo: true },
  })
}

/**
 * Cria/atualiza usuário com nível de plataforma e seus vínculos por empresa.
 * - MASTER/TI podem gerir usuários; definir nível MASTER/TI exige MASTER.
 * - Sincroniza memberships: faz upsert dos enviados e remove os ausentes.
 */
export async function salvarUsuarioComAcesso(input: SalvarUsuarioInput) {
  const ctx = await requireMasterOrTI()

  if ((input.nivelAcesso === "MASTER" || input.nivelAcesso === "TI") && ctx.nivelAcesso !== "MASTER") {
    throw new Error("Apenas o Master pode conceder nível MASTER ou TI.")
  }

  const email = input.email.toLowerCase().trim()

  // E-mail é a identidade global (1 e-mail = 1 usuário).
  const emailDono = await prisma.user.findFirst({
    where: { email, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  })
  if (emailDono) throw new Error("Já existe um usuário com este e-mail.")

  if (!input.id && !input.senha) throw new Error("Senha é obrigatória para novos usuários.")

  const senhaHash = input.senha ? await bcrypt.hash(input.senha, 10) : undefined

  const userId = await prisma.$transaction(async (tx) => {
    let uid = input.id
    if (uid) {
      await tx.user.update({
        where: { id: uid },
        data: {
          nome: input.nome,
          email,
          nivelAcesso: input.nivelAcesso,
          ativo: input.ativo,
          ...(senhaHash ? { senha: senhaHash } : {}),
        },
      })
    } else {
      const created = await tx.user.create({
        data: {
          nome: input.nome,
          email,
          senha: senhaHash!,
          nivelAcesso: input.nivelAcesso,
          ativo: input.ativo,
        },
      })
      uid = created.id
    }

    // Sincroniza memberships
    const empresaIdsEnviadas = input.memberships.map((m) => m.empresaId)
    await tx.userEmpresa.deleteMany({
      where: { userId: uid, ...(empresaIdsEnviadas.length ? { empresaId: { notIn: empresaIdsEnviadas } } : {}) },
    })
    for (const m of input.memberships) {
      await tx.userEmpresa.upsert({
        where: { userId_empresaId: { userId: uid!, empresaId: m.empresaId } },
        update: {
          role: m.role,
          vendedorId: m.vendedorId ?? null,
          permissoes: m.permissoes,
          ativo: m.ativo,
        },
        create: {
          userId: uid!,
          empresaId: m.empresaId,
          role: m.role,
          vendedorId: m.vendedorId ?? null,
          permissoes: m.permissoes,
          ativo: m.ativo,
        },
      })
    }
    return uid
  })

  revalidatePath("/usuarios")
  return { id: userId }
}
