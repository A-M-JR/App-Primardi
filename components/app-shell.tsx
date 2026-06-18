"use client"

import React, { useEffect } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { usePathname, useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

const breadcrumbMap: Record<string, string> = {
  clientes: "Clientes",
  produtos: "Catálogo de Produtos",
  categorias: "Categorias",
  fornecedores: "Fornecedores",
  orcamentos: "Orçamentos",
  pedidos: "Pedidos de Produção",
  comissoes: "Comissões",
  usuarios: "Usuários",
  empresas: "Empresas",
  vendedores: "Vendedores",
  configuracoes: "Configurações",
  licitacoes: "Licitações",
  faturamento: "Faturamento",
  promocoes: "Promoções",
  chamados: "Chamados",
  departamentos: "Departamentos",
  consultas: "Consultas (APIs)",
  "conciliar-ean": "Conciliar EAN",
  manuais: "Manuais",
  novo: "Novo",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, isLoading, empresaBranding } = useAuth()
  const segments = pathname.split("/").filter(Boolean)

  const applyTheme = (savedColor: string) => {
    if (!savedColor) return
    // Aplica no CSS Variable padrão (para cor sólida)
    document.documentElement.style.setProperty('--sidebar', savedColor.startsWith('#') ? savedColor : 'transparent')
    document.documentElement.style.setProperty('--sidebar-border', savedColor.startsWith('#') ? `${savedColor}40` : '#ffffff20')

    // Para gradiente, aplica inline diretamente no elemento DOM
    if (!savedColor.startsWith('#')) {
      // É um preset de gradiente — aguarda a sidebar montar para injetar o estilo
      const tryApply = (attempts = 0) => {
        const sidebarEl = document.querySelector('[data-sidebar="sidebar-inner"]') as HTMLElement | null
        if (sidebarEl) {
          sidebarEl.style.background = savedColor
        } else if (attempts < 10) {
          setTimeout(() => tryApply(attempts + 1), 50)
        }
      }
      tryApply()
    } else {
      // Cor sólida — limpa qualquer gradient inline anterior
      const sidebarEl = document.querySelector('[data-sidebar="sidebar-inner"]') as HTMLElement | null
      if (sidebarEl) sidebarEl.style.background = ''
    }
  }

  // Volta a sidebar ao tema padrão (empresa sem cor personalizada).
  const resetTheme = () => {
    document.documentElement.style.removeProperty('--sidebar')
    document.documentElement.style.removeProperty('--sidebar-border')
    const sidebarEl = document.querySelector('[data-sidebar="sidebar-inner"]') as HTMLElement | null
    if (sidebarEl) sidebarEl.style.background = ''
  }

  // Paint rápido a partir do cache, evitando flash antes do branding carregar.
  useEffect(() => {
    const cached = localStorage.getItem('flexo_theme_sidebar')
    if (cached) applyTheme(cached)
  }, [])

  // Aplica a identidade visual da empresa ATIVA; reage à troca de empresa.
  useEffect(() => {
    if (!empresaBranding) return
    const cor = empresaBranding.corSidebar
    if (cor) {
      applyTheme(cor)
      localStorage.setItem('flexo_theme_sidebar', cor)
    } else {
      localStorage.removeItem('flexo_theme_sidebar')
      resetTheme()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaBranding?.id, empresaBranding?.corSidebar])

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push("/login")
    }
  }, [currentUser, isLoading, router])

  // Se estiver carregando, mostramos a estrutura mas com o conteúdo pulsando (skeleton)
  const isAuthorized = !!currentUser;

  // Se estiver carregando ou não autorizado, não renderizamos a estrutura da sidebar
  // para evitar o "flicker" (piscar) do menu antes de redirecionar para o login.
  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center">
        <Loader2 className="size-8 text-primary animate-spin" />
        <Toaster richColors position="top-right" />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
              </BreadcrumbItem>
              {segments.map((segment, i) => {
                const href = "/" + segments.slice(0, i + 1).join("/")
                const isLast = i === segments.length - 1
                const label = breadcrumbMap[segment] || segment
                return (
                  <React.Fragment key={href}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
