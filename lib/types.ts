export type UserRole = "ADMIN" | "GERENTE" | "VENDEDOR" | "OPERADOR"

export interface User {
  id: number
  empresaId: number
  nome: string
  email: string
  role: UserRole
  vendedorId?: number | null
  criadoEm: string
  ativo?: boolean
}

export interface Vendedor {
  id: number
  empresaId: number
  nome: string
  email: string
  telefone: string
  comissao: number
  regiao?: string | null
  criadoEm: string
  ativo?: boolean
}

export interface Cliente {
  id: number
  empresaId: number
  razaoSocial: string
  nomeFantasia?: string | null
  telefone: string
  cnpj: string
  ie?: string | null
  logradouro?: string | null
  numeroEnd?: string | null
  complemento?: string | null
  bairro?: string | null
  cep: string
  cidade: string
  estado: string
  email?: string | null
  observacoes?: string | null
  criadoEm: string
  updatedAt?: string
  ultimaCompra?: string | null
  saldoCreditoValor: number
  saldoCreditoUnidades: number
  tabelaPrecoId?: number | null
}

export interface Produto {
  id: number
  empresaId: number
  codigo: string
  nome: string
  fornecedorId?: number | null
  ean?: string | null
  estoque: number
  precoBase: number
  categoriaId?: number | null
  unidadePadrao: string
  ativo: boolean
  criadoEm: string
}

export interface ItemOrcamento {
  id: number
  orcamentoId: number
  produtoId?: number | null
  descricao: string
  quantidade: number
  unidade: string
  precoUnitario: number
  desconto: number
  total: number
  observacao?: string | null
  quantidadeCredito: number
}

export interface Orcamento {
  id: number
  empresaId: number
  numero: string
  clienteId: number
  cliente?: Cliente
  vendedorId: number
  itens: ItemOrcamento[]
  statusId: number
  status?: { id: number, nome: string }
  observacoes?: string | null
  criadoEm: string
  atualizadoEm: string
  totalGeral: number
  descontoCredito: number
  valorFrete: number
  tipoFrete?: string | null
  formaPagamentoId?: number | null
  formaPagamento?: { id: number, nome: string }
  prazoEntrega?: string | null
  ocCliente?: string | null
}

export interface ItemPedido {
  id: number
  pedidoId: number
  produtoId?: number | null
  descricao: string
  quantidade: number
  unidade: string
  precoUnitario: number
  desconto: number
  total: number
  observacao?: string | null
  quantidadeCredito: number
}

export interface Pedido {
  id: number
  empresaId: number
  numero: string
  orcamentoId?: number | null
  orcamento?: Orcamento
  clienteId: number
  cliente?: Cliente
  vendedorId: number
  itens: ItemPedido[]
  statusId: number
  status?: { id: number, nome: string }
  prazoEntrega?: string | null
  formaPagamentoId?: number | null
  formaPagamento?: { id: number, nome: string }
  nomeVendedor?: string | null
  nomeComprador?: string | null
  valorFrete: number
  tipoFrete?: string | null
  observacoesGerais?: string | null
  criadoEm: string
  atualizadoEm: string
  totalGeral: number
  ocCliente?: string | null
}

export interface Empresa {
  id: number
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual?: string | null
  telefone: string
  email: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  estado: string
  corSidebar?: string | null
  corPrimaria?: string | null
  logoUrl?: string | null
  // Campo agregado para compatibilidade com componentes que usam empresa.endereco.cep
  endereco?: {
    cep: string
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    estado: string
  }
}

export interface AIChatMessage {
  id: number
  userId: number
  role: "user" | "assistant" | "system"
  content: string
  toolCalls?: any[]
  imageUrl?: string | null
  timestamp: string
}

export interface AIUsage {
  id: number
  count: number
  monthYear: string
  tokensUsed: number
}

export interface AIConfig {
  id?: number
  provider: string
  apiKey: string
  systemPrompt: string
  monthlyLimit: number
}

export interface Status {
  id: number
  empresaId: number
  nome: string
  cor: string
  ordem: number
  modulo: "ORCAMENTO" | "PEDIDO"
}

export interface Categoria {
  id: number
  empresaId: number
  nome: string
  ativo: boolean
}

export interface Fornecedor {
  id: number
  empresaId: number
  razaoSocial: string
  cnpj?: string | null
}
