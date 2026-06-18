"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users,
  Tags,
  FileText,
  Factory,
  LayoutDashboard,
  UserCog,
  Settings,
  LogOut,
  Sparkles,
  CreditCard,
  LineChart,
  Truck,
  Package,
  Table2,
  Target,
  ShoppingCart,
  FileSpreadsheet,
  ClipboardList,
  Building2,
  CalendarClock,
  PackageSearch,
  Wallet,
  Gavel,
  Receipt,
  Database,
  Barcode,
  BookOpen,
  Megaphone,
  Headphones,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { useAI } from "@/lib/ai-context"
import type { ModuloId } from "@/lib/modules"
import { EmpresaSelector } from "@/components/empresa-selector"
import { useEffect, useState } from "react"
import { contarRetornosPendentes } from "@/lib/actions/clientes-crm"
import { getAlertasLicitacoes } from "@/lib/actions/licitacoes"

const mainMenuItems: {
  label: string
  href: string
  icon: typeof LayoutDashboard
  highlight?: boolean
  modulo?: ModuloId
}[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Orçamentos",
    href: "/orcamentos",
    icon: FileText,
    highlight: true,
    modulo: "comercial",
  },
  {
    label: "Pedidos de Produção",
    href: "/pedidos",
    icon: Factory,
    modulo: "comercial",
  },
  {
    label: "Clientes",
    href: "/clientes",
    icon: Users,
    modulo: "crm",
  },
  {
    label: "Leads (CRM)",
    href: "/leads",
    icon: Target,
    modulo: "crm",
  },
  {
    label: "Agenda",
    href: "/agenda",
    icon: CalendarClock,
    modulo: "crm",
  },
  {
    label: "Cobrança",
    href: "/cobranca",
    icon: Wallet,
    modulo: "cobranca",
  },
  {
    label: "Promoções",
    href: "/promocoes",
    icon: Megaphone,
    modulo: "promocoes",
  },
  {
    label: "Manuais",
    href: "/manuais",
    icon: BookOpen,
  },
]

const comprasMenuItems = [
  { label: "Visão geral", href: "/compras", icon: LayoutDashboard },
  { label: "Planejamento", href: "/compras/planejamentos", icon: ClipboardList },
  { label: "Importações", href: "/compras/importacoes", icon: FileSpreadsheet },
  { label: "Cotações", href: "/compras/cotacoes", icon: FileText },
  { label: "Pedidos de Compra", href: "/compras/pedidos", icon: ShoppingCart },
]

const produtoMenuItems = [
  {
    label: "Catálogo de Produtos",
    href: "/produtos",
    icon: Tags,
  },
  {
    label: "Conciliar EAN (CMED)",
    href: "/produtos/conciliar-ean",
    icon: Barcode,
  },
  {
    label: "Categorias",
    href: "/categorias",
    icon: Tags,
  },
  {
    label: "Fornecedores",
    href: "/fornecedores",
    icon: Truck,
  },
  {
    label: "Estoque",
    href: "/estoque",
    icon: Package,
  },
  {
    label: "Separação",
    href: "/separacao",
    icon: PackageSearch,
  },
  {
    label: "Tabelas de Preço",
    href: "/tabelas-preco",
    icon: Table2,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { currentUser, isAdmin, logout, can, access, empresaBranding } = useAuth()
  const nivel = access?.nivelAcesso
  const isMaster = nivel === "MASTER"
  const isTI = nivel === "TI"
  const showCompras = can("compras")
  const showEstoque = can("estoque")
  const showLicitacoes = can("licitacoes")
  const showFaturamento = can("faturamento")
  const showChamados = can("chamados")
  const mainItensVisiveis = mainMenuItems.filter((i) => !i.modulo || can(i.modulo))

  const [alertasLic, setAlertasLic] = useState({ sessoesProximas: 0, contratosVencendo: 0 })
  useEffect(() => {
    if (!showLicitacoes && !showFaturamento) return
    let ativo = true
    const carregar = () => getAlertasLicitacoes().then((a) => ativo && setAlertasLic(a)).catch(() => {})
    carregar()
    const t = setInterval(carregar, 5 * 60 * 1000)
    return () => {
      ativo = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLicitacoes, showFaturamento])

  const [retornosPendentes, setRetornosPendentes] = useState(0)
  useEffect(() => {
    if (!can("crm")) return
    let ativo = true
    const carregar = () => contarRetornosPendentes().then((n) => ativo && setRetornosPendentes(n)).catch(() => {})
    carregar()
    const t = setInterval(carregar, 5 * 60 * 1000)
    return () => {
      ativo = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can("crm")])
  const { isActive: isAIActive } = useAI()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-1.5 border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar-accent/50 to-transparent">
        <Link
          href="/"
          className="flex items-center justify-center overflow-hidden transition-transform hover:scale-[1.02] group/logo"
        >
          <img
            src={empresaBranding?.logoUrl || "/logo_sem_fundo_primardi.png"}
            alt={empresaBranding?.nomeFantasia || "Logo"}
            className="h-12 w-auto max-w-[140px] object-contain group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:max-w-[34px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_4px_rgba(255,255,255,0.1)]"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="custom-scrollbar">
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItensVisiveis.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href} className="px-2">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={`
                        my-0.5 h-10 transition-all duration-200 
                        ${isActive
                          ? "bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
                          : (item as any).highlight 
                            ? "bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90 hover:text-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="size-[18px]" />
                        <span>{item.label}</span>
                        {item.href === "/agenda" && retornosPendentes > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                            {retornosPendentes > 99 ? "99+" : retornosPendentes}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showCompras && (
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-2">
            Compras
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {comprasMenuItems.map((item) => {
                const isActive =
                  item.href === "/compras" ? pathname === "/compras" : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href} className="px-2">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={`
                        my-0.5 h-10 transition-all duration-200 
                        ${isActive
                          ? "bg-primary/10 text-primary font-bold hover:bg-primary/15 hover:text-primary shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className={`size-[18px] ${isActive ? "text-primary fill-primary/10" : ""}`} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {showEstoque && (
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-2">
            Gestão de Produtos
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {produtoMenuItems.map((item) => {
                const isActive =
                  item.href === "/produtos"
                    ? pathname === "/produtos" ||
                      (pathname.startsWith("/produtos/") && !pathname.startsWith("/produtos/conciliar-ean"))
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href} className="px-2">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={`
                        my-0.5 h-10 transition-all duration-200 
                        ${isActive
                          ? "bg-primary/10 text-primary font-bold hover:bg-primary/15 hover:text-primary shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className={`size-[18px] ${isActive ? "text-primary fill-primary/10" : ""}`} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Botão de Comissões Adicional Pós-Catálogo */}
              {(isAdmin || access?.vendedorId) && (
                <SidebarMenuItem className="px-2 mt-2 pt-2 border-t border-sidebar-border/30">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/comissoes")}
                    tooltip="Cálculo de Comissões"
                    className={`
                      my-0.5 h-10 transition-all duration-200 
                      ${pathname.startsWith("/comissoes")
                        ? "bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/comissoes" className="flex items-center gap-3">
                      <CreditCard className="size-[18px]" />
                      <span>Comissões</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {(showLicitacoes || showFaturamento) && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-2">
              Licitações
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {[
                  ...(showLicitacoes
                    ? [
                        { label: "Licitações", href: "/licitacoes", icon: Gavel },
                        { label: "Consultas (APIs)", href: "/licitacoes/consultas", icon: Database },
                      ]
                    : []),
                  ...(showFaturamento ? [{ label: "Faturamento", href: "/faturamento", icon: Receipt }] : []),
                ].map((item) => {
                  const isActive =
                    item.href === "/licitacoes"
                      ? pathname === "/licitacoes" ||
                        (pathname.startsWith("/licitacoes/") && !pathname.startsWith("/licitacoes/consultas"))
                      : pathname.startsWith(item.href)
                  return (
                    <SidebarMenuItem key={item.href} className="px-2">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={`
                          my-0.5 h-10 transition-all duration-200
                          ${isActive
                            ? "bg-primary/10 text-primary font-bold hover:bg-primary/15 hover:text-primary shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }
                        `}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className={`size-[18px] ${isActive ? "text-primary fill-primary/10" : ""}`} />
                          <span>{item.label}</span>
                          {item.href === "/licitacoes" && alertasLic.sessoesProximas > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white" title="Sessões nos próximos 7 dias">
                              {alertasLic.sessoesProximas > 99 ? "99+" : alertasLic.sessoesProximas}
                            </span>
                          )}
                          {item.href === "/faturamento" && alertasLic.contratosVencendo > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white" title="Contratos vencendo em 30 dias">
                              {alertasLic.contratosVencendo > 99 ? "99+" : alertasLic.contratosVencendo}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showChamados && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-2">
              Suporte
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {[
                  { label: "Chamados", href: "/chamados", icon: Headphones },
                  { label: "Departamentos", href: "/departamentos", icon: Building2 },
                ].map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <SidebarMenuItem key={item.href} className="px-2">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={`
                          my-0.5 h-10 transition-all duration-200
                          ${isActive
                            ? "bg-primary/10 text-primary font-bold hover:bg-primary/15 hover:text-primary shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }
                        `}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className={`size-[18px] ${isActive ? "text-primary fill-primary/10" : ""}`} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Módulo IA — visível quando ativado */}
        {isAIActive && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-2">
              Inteligência Artificial
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    tooltip="Assistente IA"
                    className="my-0.5 h-10 transition-all duration-200 text-sidebar-foreground/70 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
                  >
                    <button
                      onClick={() => {
                        // Dispara abertura do chat via evento customizado
                        window.dispatchEvent(new CustomEvent('toggle-ai-chat'))
                      }}
                      className="flex items-center gap-3 w-full"
                    >
                      <Sparkles className="size-[18px]" />
                      <span>Assistente IA</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/oportunidades"}
                    tooltip="Oportunidades IA"
                    className={`
                      my-0.5 h-10 transition-all duration-200 
                      ${pathname === "/oportunidades"
                        ? "bg-violet-500 text-white font-bold shadow-md hover:bg-violet-600"
                        : "text-sidebar-foreground/70 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
                      }
                    `}
                  >
                    <Link href="/oportunidades" className="flex items-center gap-3">
                      <LineChart className="size-[18px]" />
                      <span>Oportunidades IA</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Menu */}
        {isAdmin && (
          <SidebarGroup className="mt-2 text-foreground/80">
            <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/30 px-4 mt-4">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {(isMaster || isTI) && (
                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/usuarios")}
                    tooltip="Gestão de Usuários"
                    className={`
                      my-0.5 h-10 transition-all duration-200
                      ${pathname.startsWith("/usuarios")
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/usuarios" className="flex items-center gap-3">
                      <Users className={`size-[18px] ${pathname.startsWith("/usuarios") ? "text-primary fill-primary/10" : ""}`} />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
                {(isMaster || isTI) && (
                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/empresas")}
                    tooltip="Empresas"
                    className={`
                      my-0.5 h-10 transition-all duration-200
                      ${pathname.startsWith("/empresas")
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/empresas" className="flex items-center gap-3">
                      <Building2 className={`size-[18px] ${pathname.startsWith("/empresas") ? "text-primary fill-primary/10" : ""}`} />
                      <span>Empresas</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/vendedores")}
                    tooltip="Gestão de Vendedores"
                    className={`
                      my-0.5 h-10 transition-all duration-200 
                      ${pathname.startsWith("/vendedores")
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/vendedores" className="flex items-center gap-3">
                      <UserCog className={`size-[18px] ${pathname.startsWith("/vendedores") ? "text-primary fill-primary/10" : ""}`} />
                      <span>Vendedores</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem className="px-2">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/formas-pagamento")}
                    tooltip="Formas de Pagamento"
                    className={`
                      my-0.5 h-10 transition-all duration-200 
                      ${pathname.startsWith("/formas-pagamento")
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/formas-pagamento" className="flex items-center gap-3">
                      <CreditCard className={`size-[18px] ${pathname.startsWith("/formas-pagamento") ? "text-primary fill-primary/10" : ""}`} />
                      <span>Formas de Pagto</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isMaster && (
                <SidebarMenuItem className="px-2 mt-2 pt-2 border-t border-sidebar-border/30">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/configuracoes")}
                    tooltip="Configurações da Empresa"
                    className={`
                      my-0.5 h-10 transition-all duration-200
                      ${pathname.startsWith("/configuracoes")
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Link href="/configuracoes" className="flex items-center gap-3">
                      <Settings className={`size-[18px] ${pathname.startsWith("/configuracoes") ? "text-primary fill-primary/10" : ""}`} />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden p-4 pt-1 border-t border-sidebar-border/30 bg-gradient-to-t from-sidebar-accent/20 to-transparent">
        <div className="space-y-4">
          <EmpresaSelector />
          {currentUser && (
            <div className="flex items-center gap-3 py-2 px-1 relative group transition-all">
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-sm group-hover:bg-primary/20 transition-colors border border-primary/10">
                {currentUser.nome.charAt(0).toUpperCase()}
                <div className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-emerald-500 rounded-full border-2 border-sidebar shadow-sm" />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-bold tracking-tight text-sidebar-foreground truncate group-hover:text-primary transition-colors">
                  {currentUser.nome}
                </p>
                <p className="text-sidebar-foreground/70 truncate font-medium" style={{ fontSize: "10px" }}>
                  {currentUser.email}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 px-1">
            <div className="flex items-center justify-between gap-2 border-t border-sidebar-border/30 pt-4">
              <span className="text-[10px] font-bold text-sidebar-foreground/40 tracking-[0.2em]">
                V1.0.84
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-sidebar-foreground/80 hover:bg-destructive/10 hover:text-destructive transition-all group/logout border border-sidebar-border/30 hover:border-destructive/40 bg-sidebar-accent/50"
              >
                <LogOut className="size-3.5 transition-transform group-hover/logout:-translate-x-0.5 text-destructive" />
                <span>Encerrar Sessão</span>
              </button>
            </div>

            
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
