import "server-only"

import { cookies } from "next/headers"
import crypto from "crypto"

/**
 * Sessão server-side via cookie httpOnly assinado (HMAC-SHA256).
 *
 * Substitui o esquema antigo de `localStorage` + `requesterId` passado pelo
 * cliente. O `empresaId` da empresa ATIVA passa a sair daqui (servidor),
 * nunca de parâmetro vindo do browser — base do isolamento multitenant.
 *
 * Requer a env `SESSION_SECRET` (string longa e aleatória) em produção.
 *
 * NOTA (Fase 0): este módulo ainda NÃO está plugado no fluxo de login.
 * Ver docs/PLANO_MULTITENANCY.md.
 */

const COOKIE_NAME = "primardi_session"
const TWELVE_HOURS_S = 12 * 60 * 60

export interface SessionPayload {
  userId: number
  empresaId: number // empresa ativa selecionada
  exp: number // epoch em segundos
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    // Em dev evitamos quebrar tudo, mas isso NÃO pode acontecer em produção.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET não configurada — sessão não pode ser assinada.")
    }
    return "dev-insecure-secret-change-me"
  }
  return secret
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url")
}

/** Gera o token assinado a partir do payload. */
export function createSessionToken(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload))
  const sig = sign(body)
  return `${body}.${sig}`
}

/** Valida assinatura + expiração e retorna o payload, ou null se inválido. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  // Comparação em tempo constante para evitar timing attacks.
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (!payload?.userId || !payload?.empresaId || !payload?.exp) return null
    if (Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/** Cria/atualiza o cookie de sessão. Use em Route Handlers e Server Actions. */
export async function setSession(userId: number, empresaId: number): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TWELVE_HOURS_S
  const token = createSessionToken({ userId, empresaId, exp })
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWELVE_HOURS_S,
  })
}

/** Lê e valida a sessão atual do cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value)
}

/** Troca a empresa ativa mantendo o mesmo usuário (renova o cookie). */
export async function switchEmpresa(empresaId: number): Promise<void> {
  const current = await getSession()
  if (!current) throw new Error("Sessão inválida.")
  await setSession(current.userId, empresaId)
}

/** Remove o cookie de sessão (logout). */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
