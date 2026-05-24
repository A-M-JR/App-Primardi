import {
  Cliente,
  Produto,
  Orcamento,
  Pedido,
  Vendedor,
  User,
  Empresa
} from "./types"

export let empresaDefault: Empresa = {
  id: 1,
  razaoSocial: "M F LABELS INDUSTRIA GRAFICA LTDA",
  nomeFantasia: "Primardi",
  cnpj: "18.330.143/0001-38",
  telefone: "(62) 3142-9993",
  email: "contato@primardi.com",
  cep: "74474-046",
  logradouro: "R Jg 17",
  numero: "S/N",
  complemento: "Qa 27 Lt 18 Ao 20",
  bairro: "Jardim Guanabara II",
  cidade: "Goiânia",
  estado: "GO",
  corSidebar: "#0f264a",
  // Campo agregado para compatibilidade com ConfiguracoesForm
  endereco: {
    cep: "74474-046",
    logradouro: "R Jg 17",
    numero: "S/N",
    complemento: "Qa 27 Lt 18 Ao 20",
    bairro: "Jardim Guanabara II",
    cidade: "Goiânia",
    estado: "GO",
  }
}

export const vendedores: Vendedor[] = []
export const users: User[] = []
export const clientes: Cliente[] = []
export const produtos: Produto[] = [] // Substitui etiquetas
export const orcamentos: Orcamento[] = []
export const pedidos: Pedido[] = []

export function getUserById(id: number | string): User | undefined {
  return users.find((u) => u.id === Number(id))
}

export function getUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email)
}

export function getVendedorById(id: number | string): Vendedor | undefined {
  return vendedores.find((v) => v.id === Number(id))
}

export function getVendedorByEmail(email: string): Vendedor | undefined {
  return vendedores.find((v) => v.email === email)
}

export function getClienteById(id: number | string): Cliente | undefined {
  return clientes.find((c) => c.id === Number(id))
}

export function getProdutoById(id: number | string): Produto | undefined {
  return produtos.find((e) => e.id === Number(id))
}

export function getOrcamentoById(id: number | string): Orcamento | undefined {
  return orcamentos.find((o) => o.id === Number(id))
}

export function getPedidoById(id: number | string): Pedido | undefined {
  return pedidos.find((p) => p.id === Number(id))
}

export function getOrcamentosByCliente(clienteId: number | string): Orcamento[] {
  return orcamentos.filter((o) => o.clienteId === Number(clienteId))
}

export function getOrcamentosByVendedor(vendedorId: number | string): Orcamento[] {
  return orcamentos.filter((o) => o.vendedorId === Number(vendedorId))
}

export function getPedidosByVendedor(vendedorId: number | string): Pedido[] {
  return pedidos.filter((p) => p.vendedorId === Number(vendedorId))
}

export function getPedidosByCliente(clienteId: number | string): Pedido[] {
  return pedidos.filter((p) => p.clienteId === Number(clienteId))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    em_analise: "Em Análise",
    enviado: "Enviado",
    aprovado: "Aprovado",
    recusado: "Recusado",
    em_producao: "Em Produção",
    separacao: "Em Separação",
    faturado: "Faturado",
    entregue: "Entregue",
    cancelado: "Cancelado",
    ORCAMENTO: "Orçamento",
    PEDIDO: "Pedido"
  }
  return map[status] || status
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    rascunho: "bg-muted/50 text-muted-foreground border-border/50 border",
    em_analise: "bg-violet-500/10 text-violet-700 border-violet-500/20 border dark:text-violet-400",
    enviado: "bg-blue-500/10 text-blue-700 border-blue-500/20 border dark:text-blue-400",
    aprovado: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 border dark:text-emerald-400",
    recusado: "bg-red-500/10 text-red-700 border-red-500/20 border dark:text-red-400",
    em_producao: "bg-amber-500/10 text-amber-700 border-amber-500/20 border dark:text-amber-400",
    separacao: "bg-purple-500/10 text-purple-700 border-purple-500/20 border dark:text-purple-400",
    faturado: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 border dark:text-emerald-400",
    entregue: "bg-teal-500/10 text-teal-700 border-teal-500/20 border dark:text-teal-400",
    cancelado: "bg-red-500/10 text-red-700 border-red-500/20 border dark:text-red-400",
  }
  return map[status?.toLowerCase()] || "bg-muted/50 text-muted-foreground border-border/50 border"
}
