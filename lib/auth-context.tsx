"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Vendedor } from "./types"
import { verifySession } from "./actions/users"
import { clearDataCache } from "@/hooks/use-data-query"

export type LoginResult = "success" | "invalid_credentials" | "user_blocked" | "user_not_found"

interface AuthContextType {
  currentUser: User | null
  vendedor: Vendedor | null
  isAdmin: boolean
  isVendedor: boolean
  isLoading: boolean
  login: (email: string, senha?: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [vendedor, setVendedor] = useState<Vendedor | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const router = useRouter()


  useEffect(() => {
    checkSession()

    // Configura um vigia que checa a expiração a cada 1 minuto
    const interval = setInterval(checkSession, 60000)
    return () => clearInterval(interval)
  }, [])

  const checkSession = async () => {
    const sessionData = localStorage.getItem("flexo_session")

    if (sessionData) {
      try {
        const { userId, expiresAt } = JSON.parse(sessionData)

        // Verifica se a sessão de 12 horas expirou
        if (Date.now() > expiresAt) {
          logout()
          setIsLoading(false)
          return
        }

        const result = await verifySession(userId)
        if (result && result.user) {
          setCurrentUser(result.user)
          setVendedor(result.vendor)
        } else {
          logout() // Usuário foi deletado ou inativado
        }
      } catch (e) {
        logout() // Objeto corrompido
      }
    }

    setIsLoading(false)
  }

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

      const { user, vendor: dbVendor } = await response.json()
      setCurrentUser(user)

      // Cria Sessão de 12 Horas em Milissegundos
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
      const sessionObject = {
        userId: user.id,
        expiresAt: Date.now() + TWELVE_HOURS_MS
      }

      localStorage.setItem("flexo_session", JSON.stringify(sessionObject))

      // Limpa cache de dados anteriores para a nova sessão
      clearDataCache()

      setVendedor(dbVendor || null)
      return "success"
    } catch (error) {
      console.error("Login Error:", error)
      return "invalid_credentials"
    }
  }

  const logout = () => {
    setCurrentUser(null)
    setVendedor(null)
    localStorage.removeItem("flexo_session")
    // O legacy identifier se existir
    localStorage.removeItem("currentUserId")
    
    // Limpa cache ao sair também por segurança
    clearDataCache()

    router.push("/login")
  }

  const isAdmin = currentUser?.role === "ADMIN"
  const isVendedor = currentUser?.role === "VENDEDOR"

  return (
    <AuthContext.Provider value={{ currentUser, vendedor, isAdmin, isVendedor, isLoading, login, logout }}>
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
