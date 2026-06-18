"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User, Vendedor } from "./types"
import { trocarEmpresa as trocarEmpresaAction } from "./actions/users"
import { can as canModulo, type ModuloId, type Acao, type AccessContext } from "./modules"
import { clearDataCache } from "@/hooks/use-data-query"

export type LoginResult = "success" | "invalid_credentials" | "user_blocked" | "user_not_found"

export interface EmpresaResumo {
  id: number
  nomeFantasia: string
  razaoSocial: string
}

export interface EmpresaBranding {
  id: number
  nomeFantasia: string
  logoUrl: string | null
  corSidebar: string | null
  corPrimaria: string | null
}

// Contexto de acesso enriquecido enviado pelo /api/auth/me.
export type ClientAccess = AccessContext & {
  isAdmin: boolean
  vendedorId: number | null
}

interface AuthContextType {
  currentUser: User | null
  vendedor: Vendedor | null
  access: ClientAccess | null
  empresas: EmpresaResumo[]
  empresaAtivaId: number | null
  empresaBranding: EmpresaBranding | null
  isAdmin: boolean
  isVendedor: boolean
  isLoading: boolean
  login: (email: string, senha?: string) => Promise<LoginResult>
  logout: () => void
  trocarEmpresa: (empresaId: number) => Promise<void>
  refreshSession: () => Promise<void>
  can: (modulo: ModuloId, acao?: Acao) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [vendedor, setVendedor] = useState<Vendedor | null>(null)
  const [access, setAccess] = useState<ClientAccess | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([])
  const [empresaAtivaId, setEmpresaAtivaId] = useState<number | null>(null)
  const [empresaBranding, setEmpresaBranding] = useState<EmpresaBranding | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const router = useRouter()

  // O cookie httpOnly é a fonte de verdade. /api/auth/me valida assinatura,
  // expiração e se o usuário continua ativo, e devolve o contexto de acesso.
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setCurrentUser(data.user)
        setVendedor(data.vendor || null)
        setAccess(data.access || null)
        setEmpresas(data.empresas || [])
        setEmpresaAtivaId(data.empresaAtivaId ?? null)
        setEmpresaBranding(data.empresaAtiva || null)
      } else {
        setCurrentUser(null)
        setVendedor(null)
        setAccess(null)
        setEmpresas([])
        setEmpresaAtivaId(null)
        setEmpresaBranding(null)
      }
    } catch {
      setCurrentUser(null)
      setVendedor(null)
      setAccess(null)
      setEmpresaBranding(null)
    }
  }, [])

  useEffect(() => {
    checkSession().finally(() => setIsLoading(false))
    // Revalida a sessão a cada 5 minutos (cookie httpOnly expira em 12h).
    const interval = setInterval(checkSession, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkSession])

  const login = async (email: string, senha?: string): Promise<LoginResult> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha }),
      })

      if (!response.ok) {
        if (response.status === 404) return "user_not_found"
        if (response.status === 403) return "user_blocked"
        return "invalid_credentials"
      }

      // O cookie httpOnly (12h) já foi setado pelo servidor; carrega o contexto.
      clearDataCache()
      await checkSession()
      return "success"
    } catch (error) {
      console.error("Login Error:", error)
      return "invalid_credentials"
    }
  }

  const logout = useCallback(() => {
    setCurrentUser(null)
    setVendedor(null)
    setAccess(null)
    setEmpresas([])
    setEmpresaAtivaId(null)
    setEmpresaBranding(null)

    // Remove o cookie de sessão no servidor.
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {})

    // Limpa resíduos antigos do esquema localStorage (transição).
    localStorage.removeItem("flexo_session")
    localStorage.removeItem("currentUserId")
    clearDataCache()

    router.push("/login")
  }, [router])

  const trocarEmpresa = useCallback(
    async (empresaId: number) => {
      await trocarEmpresaAction(empresaId)
      clearDataCache()
      await checkSession()
      router.refresh()
    },
    [checkSession, router]
  )

  const can = useCallback(
    (modulo: ModuloId, acao: Acao = "view") => {
      if (!access) return false
      return canModulo(access, modulo, acao)
    },
    [access]
  )

  const isAdmin = access?.isAdmin ?? false
  const isVendedor = !!access?.vendedorId

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        vendedor,
        access,
        empresas,
        empresaAtivaId,
        empresaBranding,
        isAdmin,
        isVendedor,
        isLoading,
        login,
        logout,
        trocarEmpresa,
        refreshSession: checkSession,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
