/**
 * Conteúdo central dos manuais da plataforma (POPs).
 *
 * Para adicionar um manual: inclua um objeto em MANUAIS. O hub (/manuais) e o
 * renderizador (/manuais/[slug]) leem daqui. O manual de Licitações é uma
 * página própria e rica (/manuais/licitacoes) e entra só como META abaixo.
 */

import type { LucideIcon } from "lucide-react"
import {
  Gavel,
  Compass,
  Headset,
  Users,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
} from "lucide-react"

export interface Tela {
  nome: string
  caminho: string
  desc: string
}
export interface ApiDoc {
  nome: string
  tipo: "Grava no sistema" | "Só consulta"
  oQueFaz: string
  paraQueServe: string
  comoAlimentar: string
  ondeBuscar: string
  impacto: string
  onde: string
}
export interface Campo {
  termo: string
  desc: string
}
export interface SecaoExtra {
  titulo: string
  itens: { t: string; d: string }[]
}
export interface ManualConteudo {
  slug: string
  titulo: string
  icon: LucideIcon
  intro: string
  telas: Tela[]
  fluxo?: string[]
  apis?: ApiDoc[]
  campos?: Campo[]
  secoes?: SecaoExtra[]
  comoAlimentar?: string[]
  glossario?: Campo[]
}

export interface ManualMeta {
  slug: string
  titulo: string
  descricao: string
  icon: LucideIcon
  tags: string[]
  href: string
}

export const MANUAIS: ManualConteudo[] = [
  // ───────────────────────── PLATAFORMA ─────────────────────────
  {
    slug: "plataforma",
    titulo: "Primeiros passos (Plataforma)",
    icon: Compass,
    intro:
      "Como acessar, navegar e entender a estrutura multiempresa da plataforma. Comece por aqui se é seu primeiro acesso.",
    telas: [
      { nome: "Login", caminho: "/login", desc: "Acesso com e-mail e senha. A sessão é segura (cookie) e expira ao sair." },
      { nome: "Painel inicial", caminho: "/", desc: "Visão geral e atalhos. O que aparece depende dos módulos liberados para a empresa e das suas permissões." },
      { nome: "Seletor de empresa", caminho: "rodapé da barra lateral", desc: "Se você tem acesso a mais de uma empresa do grupo, troca a empresa ativa por aqui. Tudo passa a refletir a empresa escolhida." },
      { nome: "Assistente IA / Oportunidades IA", caminho: "barra lateral (quando ativo)", desc: "Assistente para tirar dúvidas e análise de oportunidades. Aparece quando a IA está habilitada para a empresa." },
      { nome: "Manuais", caminho: "/manuais", desc: "Esta central de manuais — um guia por módulo." },
    ],
    secoes: [
      {
        titulo: "Como funcionam os acessos",
        itens: [
          { t: "Nível de plataforma", d: "MASTER (dono, controla configurações sensíveis), TI (suporte, faz quase tudo) e PADRÃO (acesso só pelos vínculos com empresas)." },
          { t: "Papel por empresa", d: "GERENTE (vê tudo da empresa) ou OPERADOR (vê o que as permissões liberam). 'Vendedor' é um operador com um vendedor vinculado." },
          { t: "Módulos", d: "Cada empresa tem módulos liberados (Comercial, CRM, Compras, Estoque, Cobrança, Licitações, Faturamento). O menu mostra só o que está liberado para você." },
        ],
      },
    ],
    glossario: [
      { termo: "Empresa ativa", desc: "A empresa atualmente selecionada; define quais dados você vê e edita." },
      { termo: "Módulo", desc: "Conjunto de telas/funções (ex.: Compras). Liberado por empresa." },
      { termo: "Permissão", desc: "O que um operador pode fazer num módulo: ver, editar ou aprovar." },
    ],
  },

  // ───────────────────────── COMERCIAL ─────────────────────────
  {
    slug: "comercial",
    titulo: "Comercial / Televendas",
    icon: Headset,
    intro:
      "Montagem de orçamentos e pedidos, com entrada rápida por lista colada (televendas) e indicador de crédito do cliente.",
    telas: [
      { nome: "Orçamentos", caminho: "/orcamentos", desc: "Lista de orçamentos. Botão 'Entrada rápida' abre o televendas." },
      { nome: "Entrada rápida (Televendas)", caminho: "/orcamentos/televendas", desc: "Cole uma lista (ex.: do WhatsApp), o sistema casa com os produtos e você gera o orçamento." },
      { nome: "Novo orçamento", caminho: "/orcamentos/novo", desc: "Monta o orçamento item a item, com a precificação do cliente (tabela de preço ou preço base)." },
      { nome: "Pedidos de Produção", caminho: "/pedidos", desc: "Pedidos gerados a partir dos orçamentos." },
      { nome: "Comissões", caminho: "/comissoes", desc: "Cálculo de comissões (admin/vendedor)." },
    ],
    fluxo: [
      "Em Orçamentos, clique em 'Entrada rápida'.",
      "Escolha o cliente (o indicador de crédito aparece ao lado).",
      "Cole a lista de itens (entende quantidades como '10x', '5cx', '2un').",
      "Clique em Processar: cada linha vira 'Tem', 'Alerta' (ambíguo ou sem estoque) ou 'Não encontrado'.",
      "Revise — ajuste quantidade, escolha o produto certo ou busque manualmente os não encontrados.",
      "Clique em 'Gerar orçamento' — o orçamento abre já preenchido e precificado. Depois converta em pedido.",
    ],
    secoes: [
      {
        titulo: "Entrada por lista colada",
        itens: [
          { t: "Como casa os produtos", d: "Por código/EAN exato ou por todos os termos do nome. Mostra candidatos quando há dúvida." },
          { t: "Indicador de crédito", d: "Exibe o saldo de crédito acumulado do cliente na hora de montar a venda." },
        ],
      },
    ],
  },

  // ───────────────────────── CRM ─────────────────────────
  {
    slug: "crm",
    titulo: "CRM (Clientes, Leads e Agenda)",
    icon: Users,
    intro:
      "Relacionamento com clientes e prospecção: cadastro, atividades de follow-up, funil, temperatura e agenda de retornos.",
    telas: [
      { nome: "Clientes", caminho: "/clientes", desc: "Cadastro e lista de clientes." },
      { nome: "Cliente › aba CRM", caminho: "/clientes/(abrir) › aba CRM", desc: "Atividades (ligação, visita, proposta...), próximo retorno, etapa do funil e temperatura (Frio/Morno/Quente)." },
      { nome: "Leads (CRM)", caminho: "/leads", desc: "Funil de prospecção em kanban: valor por etapa, temperatura, responsável e 'parado há X dias'." },
      { nome: "Agenda", caminho: "/agenda", desc: "Retornos agendados em Vencidos / Hoje / Próximos. O badge no menu mostra os pendentes." },
    ],
    fluxo: [
      "Abra o cliente e vá na aba CRM.",
      "Registre uma atividade (ex.: Ligação) e defina o 'próximo retorno'.",
      "O retorno aparece na Agenda e conta no badge do menu.",
      "No dia, abra pela Agenda, fale com o cliente e clique em Concluir (ou registre a próxima atividade).",
      "Mova o cliente/lead pelas etapas do funil e ajuste a temperatura conforme o interesse.",
    ],
    secoes: [
      {
        titulo: "Conceitos do CRM",
        itens: [
          { t: "Próximo retorno", d: "Data do follow-up mais próximo em aberto. Vencidos ficam destacados." },
          { t: "Funil e temperatura", d: "Etapa do funil (reaproveitada de Leads) e termômetro de interesse do cliente." },
        ],
      },
    ],
  },

  // ───────────────────────── COMPRAS ─────────────────────────
  {
    slug: "compras",
    titulo: "Compras",
    icon: ShoppingCart,
    intro:
      "Fluxo completo de compras: do planejamento da necessidade à cotação com fornecedores (portal seguro), escolha de vencedores, pedido, aprovação e recebimento com baixa de estoque.",
    telas: [
      { nome: "Visão geral", caminho: "/compras", desc: "Dashboard: gasto no período, pedidos por status, itens em ruptura, top fornecedores e cotações pendentes." },
      { nome: "Planejamento", caminho: "/compras/planejamentos", desc: "Calcula a necessidade (consumo médio × fator − estoque) e monta a matriz de compra por fornecedor." },
      { nome: "Importações", caminho: "/compras/importacoes", desc: "Importa tabelas de preço de laboratório/fornecedor (por EAN, código ou nome) e vincula aos produtos." },
      { nome: "Cotações", caminho: "/compras/cotacoes", desc: "Cria a cotação e gera o link seguro para cada fornecedor responder." },
      { nome: "Pedidos de Compra", caminho: "/compras/pedidos", desc: "Pedido com stepper de status (Rascunho → Aprovação → Enviado → Confirmado → Recebido) e export Excel." },
      { nome: "Portal do fornecedor", caminho: "/portal/cotacao/(link)", desc: "Página externa onde o fornecedor preenche os preços. Tem auto-save e bloqueia edição após o envio." },
    ],
    fluxo: [
      "Crie um Planejamento e calcule a necessidade (importe estoque/consumo antes, se preciso).",
      "Ajuste a matriz, marque os itens e gere a Cotação.",
      "Copie o link de cada fornecedor (portal seguro) e envie. Ele responde os preços online.",
      "Compare os preços (com 'última compra') e escolha os vencedores (ou 'menor preço').",
      "Gere o Pedido de Compra. Se exigir, ele passa por aprovação antes de ser enviado.",
      "Ao chegar a mercadoria, registre o recebimento — dá entrada automática no estoque.",
    ],
    secoes: [
      {
        titulo: "Pontos importantes",
        itens: [
          { t: "Cálculo de necessidade", d: "Consumo médio × multiplicador − estoque. O multiplicador e a janela de consumo são configuráveis." },
          { t: "Portal do fornecedor", d: "Link exclusivo por fornecedor; a resposta não pode ser editada após o envio." },
          { t: "Aprovação", d: "Etapas após a aprovação ficam bloqueadas para quem não tem a permissão 'aprovar' em Compras." },
          { t: "Recebimento", d: "Informar a quantidade recebida gera movimentação de entrada no estoque." },
        ],
      },
    ],
    comoAlimentar: [
      "Tabelas de preço de fornecedor: importe em Compras → Importações (arquivo XLS/CSV/XLSX por EAN, código ou nome).",
      "Estoque e consumo: mantidos pelo módulo de Estoque (importação e movimentações).",
    ],
  },

  // ───────────────────────── ESTOQUE ─────────────────────────
  {
    slug: "estoque",
    titulo: "Estoque e Catálogo de Produtos",
    icon: Package,
    intro:
      "Cadastro de produtos, controle de estoque por cobertura, separação de pedidos e manutenção do EAN pela base CMED.",
    telas: [
      { nome: "Catálogo de Produtos", caminho: "/produtos", desc: "Cadastro de produtos (código, EAN, preço base, categoria, fornecedor)." },
      { nome: "Conciliar EAN (CMED)", caminho: "/produtos/conciliar-ean", desc: "Atualiza o EAN dos produtos a partir da base CMED quando o código fica defasado (grava também o PMVG)." },
      { nome: "Categorias", caminho: "/categorias", desc: "Organização dos produtos por categoria." },
      { nome: "Fornecedores", caminho: "/fornecedores", desc: "Cadastro de fornecedores." },
      { nome: "Estoque", caminho: "/estoque", desc: "Situação por cobertura: ruptura, baixo ou ok, com dias de cobertura e valor em estoque." },
      { nome: "Separação", caminho: "/separacao", desc: "Fila de separação por prazo: Atrasados, Hoje, Próximos e Sem prazo." },
      { nome: "Tabelas de Preço", caminho: "/tabelas-preco", desc: "Tabelas de preço aplicáveis a clientes." },
    ],
    secoes: [
      {
        titulo: "Como ler o estoque",
        itens: [
          { t: "Cobertura", d: "Dias que o estoque cobre o consumo médio. 'Ruptura' (zerado), 'Baixo' (<15 dias) ou 'Ok'." },
          { t: "Separação", d: "Pedidos não entregues ordenados por prazo, para priorizar o que está atrasado/para hoje." },
          { t: "Conciliar EAN", d: "Use a base CMED para reencontrar e gravar o EAN atual dos medicamentos (veja o manual de Licitações para alimentar a CMED)." },
        ],
      },
    ],
    comoAlimentar: [
      "Produtos/estoque: cadastro manual ou importação de planilha de estoque.",
      "Entradas automáticas: o recebimento de pedidos de compra dá entrada no estoque.",
      "Base CMED (para EAN/PMVG): importe em Consultas → CMED/PMVG (módulo Licitações).",
    ],
  },

  // ───────────────────────── COBRANÇA ─────────────────────────
  {
    slug: "cobranca",
    titulo: "Crédito / Cobrança",
    icon: Wallet,
    intro:
      "Importa o borderô de cobrança do ERP e organiza os devedores e títulos em aberto, com disparo de lembrete por WhatsApp.",
    telas: [
      { nome: "Cobrança", caminho: "/cobranca", desc: "Importa o borderô, mostra o painel de devedores/títulos (com vencidos) e dispara mensagens." },
    ],
    fluxo: [
      "Clique em 'Importar borderô' e selecione o arquivo .xls do ERP.",
      "O painel mostra os devedores com total, total vencido e o título mais antigo.",
      "Preencha o telefone do devedor (salva automaticamente).",
      "Ajuste o modelo da mensagem (variáveis {nome} {qtd} {total} {vencido}) e clique em WhatsApp para enviar.",
    ],
    secoes: [
      {
        titulo: "Importante",
        itens: [
          { t: "Snapshot", d: "Cada importação SUBSTITUI os títulos atuais (representa o que está em aberto hoje). O telefone preenchido é mantido." },
          { t: "WhatsApp", d: "É manual: abre o WhatsApp (wa.me) com a mensagem pronta. Não há envio automático." },
        ],
      },
    ],
    comoAlimentar: [
      "Borderô: relatório 'BORDERO DE COBRANÇA.xls' exportado do ERP (aba Dados). Suba na própria tela de Cobrança.",
    ],
    glossario: [
      { termo: "Borderô", desc: "Relatório de títulos a receber por cliente, exportado do ERP." },
      { termo: "Título vencido", desc: "Título cujo vencimento já passou da data de hoje." },
    ],
  },

  // ───────────────────────── ADMINISTRAÇÃO ─────────────────────────
  {
    slug: "administracao",
    titulo: "Administração (Empresas, Usuários e Configurações)",
    icon: Settings,
    intro:
      "Gestão da plataforma: empresas do grupo, módulos liberados, usuários e permissões, e configurações da empresa/IA. Restrito a TI/MASTER.",
    telas: [
      { nome: "Empresas", caminho: "/empresas", desc: "Cadastro das empresas do grupo e, para o MASTER, os módulos liberados de cada uma." },
      { nome: "Usuários", caminho: "/usuarios", desc: "Cria/edita usuários, define o nível (PADRÃO/TI/MASTER) e os vínculos por empresa (papel + permissões por módulo)." },
      { nome: "Vendedores", caminho: "/vendedores", desc: "Cadastro de vendedores (vinculáveis a usuários operadores)." },
      { nome: "Formas de Pagamento", caminho: "/formas-pagamento", desc: "Formas e parcelamentos usados em orçamentos/pedidos." },
      { nome: "Configurações", caminho: "/configuracoes", desc: "Dados e identidade visual da empresa e configuração da IA (token/contexto — só MASTER)." },
    ],
    secoes: [
      {
        titulo: "Acessos e permissões",
        itens: [
          { t: "Níveis", d: "MASTER (dono; configura IA e módulos), TI (suporte; tudo menos as 3 configs sensíveis) e PADRÃO (só via vínculos)." },
          { t: "Papel por empresa", d: "GERENTE vê tudo da empresa; OPERADOR é governado pelas permissões (ver/editar/aprovar) por módulo." },
          { t: "Módulos ativos", d: "Só o MASTER liga/desliga módulos por empresa, em Empresas → Módulos. O menu reflete isso." },
        ],
      },
    ],
    glossario: [
      { termo: "Membership (vínculo)", desc: "Relação usuário↔empresa que carrega papel e permissões daquele usuário naquela empresa." },
      { termo: "Permissão por módulo", desc: "Lista de ações (ver/editar/aprovar) liberadas a um operador em cada módulo." },
    ],
  },
]

/** Metadados de TODOS os manuais (inclui o de Licitações, que tem página própria). */
export const MANUAIS_META: ManualMeta[] = [
  {
    slug: "plataforma",
    titulo: "Primeiros passos (Plataforma)",
    descricao: "Acesso, navegação, empresa ativa, níveis de acesso e módulos. Comece por aqui.",
    icon: Compass,
    tags: ["Início", "Acessos", "Multiempresa"],
    href: "/manuais/plataforma",
  },
  {
    slug: "licitacoes",
    titulo: "Licitações & Faturamento",
    descricao: "Pregões, contratos/atas, cronograma, faturamento por empenho e todas as integrações (PNCP, Compras.gov.br, CMED, CNPJ, EAN).",
    icon: Gavel,
    tags: ["Licitações", "Faturamento", "APIs", "CMED"],
    href: "/manuais/licitacoes",
  },
  {
    slug: "comercial",
    titulo: "Comercial / Televendas",
    descricao: "Orçamentos, pedidos e entrada rápida por lista colada com indicador de crédito.",
    icon: Headset,
    tags: ["Orçamentos", "Pedidos", "Televendas"],
    href: "/manuais/comercial",
  },
  {
    slug: "crm",
    titulo: "CRM (Clientes, Leads e Agenda)",
    descricao: "Atividades, funil, temperatura e agenda de retornos.",
    icon: Users,
    tags: ["Clientes", "Leads", "Agenda"],
    href: "/manuais/crm",
  },
  {
    slug: "compras",
    titulo: "Compras",
    descricao: "Planejamento, cotação no portal do fornecedor, pedido, aprovação e recebimento.",
    icon: ShoppingCart,
    tags: ["Cotação", "Pedido", "Fornecedor"],
    href: "/manuais/compras",
  },
  {
    slug: "estoque",
    titulo: "Estoque e Catálogo de Produtos",
    descricao: "Produtos, cobertura de estoque, separação e conciliação de EAN (CMED).",
    icon: Package,
    tags: ["Produtos", "Estoque", "Separação"],
    href: "/manuais/estoque",
  },
  {
    slug: "cobranca",
    titulo: "Crédito / Cobrança",
    descricao: "Importação de borderô, painel de devedores e lembretes por WhatsApp.",
    icon: Wallet,
    tags: ["Borderô", "Devedores", "WhatsApp"],
    href: "/manuais/cobranca",
  },
  {
    slug: "administracao",
    titulo: "Administração",
    descricao: "Empresas, módulos, usuários, permissões e configurações (TI/MASTER).",
    icon: Settings,
    tags: ["Empresas", "Usuários", "Permissões"],
    href: "/manuais/administracao",
  },
]

export function getManual(slug: string): ManualConteudo | undefined {
  return MANUAIS.find((m) => m.slug === slug)
}
