"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  ArrowLeft,
  Gavel,
  CalendarClock,
  Receipt,
  Database,
  Barcode,
  ListChecks,
  Workflow,
  Plug,
  BookMarked,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Zap,
  Search,
} from "lucide-react"

// ─── helpers de apresentação ───────────────────────────────
function Caminho({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono text-primary">{children}</code>
}
function LinkExt({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-0.5 hover:underline">
      {children} <ExternalLink className="size-3" />
    </a>
  )
}
function Secao({ id, icon: Icon, titulo, children }: { id: string; icon: typeof Gavel; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
        <Icon className="size-5 text-primary" /> {titulo}
      </h2>
      {children}
    </section>
  )
}

// ─── telas do módulo ───────────────────────────────────────
const TELAS = [
  { nome: "Licitações", caminho: "/licitacoes", desc: "Lista de licitações/contratos com KPIs e filtros. Abas Acompanhamento e Cronograma. Aqui você cria/edita licitações e importa editais do PNCP." },
  { nome: "Detalhe da licitação", caminho: "/licitacoes/(abrir uma)", desc: "Todos os dados do processo/contrato, resumo financeiro (saldo), itens com execução e os empenhos vinculados." },
  { nome: "Cronograma", caminho: "/licitacoes › aba Cronograma", desc: "Calendário mensal (estilo Google Agenda) com as sessões de pregão e os fins de vigência. Clique no evento para abrir a licitação." },
  { nome: "Faturamento", caminho: "/faturamento", desc: "Painel de saldo dos contratos/atas e registro de empenhos (faturamento). Mostra contratado × faturado × saldo e o que está vencendo." },
  { nome: "Central de Consultas (APIs)", caminho: "/licitacoes/consultas", desc: "Reúne todas as consultas a bases públicas: CNPJ, EAN, CMED/PMVG, Preços praticados, Contratos e Atas." },
  { nome: "Conciliar EAN (CMED)", caminho: "/produtos/conciliar-ean", desc: "Atualiza o EAN dos seus produtos a partir da base CMED quando o código fica defasado." },
]

// ─── campos de uma licitação ───────────────────────────────
const CAMPOS = [
  ["Objeto", "Descrição do que está sendo licitado (ex.: aquisição de medicamentos)."],
  ["Modalidade", "Pregão Eletrônico, Concorrência, Dispensa, Adesão a Ata, etc."],
  ["Status", "Estágio: Acompanhando → Em análise → Vai participar → Em disputa → Ganha/Homologada/Contratada (ou Perdida/Fracassada...)."],
  ["Nº processo / edital / ata / contrato", "Identificadores oficiais do processo e do contrato/ata resultante."],
  ["Órgão / Cliente", "Órgão licitante (prefeitura/secretaria), CNPJ, UF e cidade. Pode vincular a um cliente cadastrado."],
  ["Portal e link do edital", "Onde a disputa ocorre (ComprasNet, BLL...) e o link para o edital."],
  ["Sessão / abertura", "Data e hora da disputa — alimenta o Cronograma."],
  ["Vigência início/fim", "Período do contrato/ata — usado nos alertas de vencimento."],
  ["Valor estimado / homologado", "Valor global estimado e o valor efetivamente ganho."],
  ["Itens / medicamentos", "Produtos com quantidade, preço e marca. A quantidade é a BASE DO SALDO consumido pelo faturamento."],
]

// ─── APIs / integrações ────────────────────────────────────
type Api = {
  nome: string
  tipo: "Grava no sistema" | "Só consulta"
  oQueFaz: string
  paraQueServe: string
  comoAlimentar: string
  ondeBuscar: React.ReactNode
  impacto: string
  onde: string
}
const APIS: Api[] = [
  {
    nome: "PNCP — Editais",
    tipo: "Grava no sistema",
    oQueFaz: "Busca editais de licitação publicados em todo o Brasil na base oficial do governo (Portal Nacional de Contratações Públicas) e traz, junto, os itens e os documentos (PDF do edital).",
    paraQueServe: "Encontrar novas oportunidades de pregão por UF, modalidade, período de publicação e palavra-chave (ex.: 'medicamento') — já com a lista de itens e o edital anexado.",
    comoAlimentar: "Automático/online. Em Licitações, clique em 'Buscar editais (PNCP)', filtre, selecione os de interesse e clique em Importar.",
    ondeBuscar: "Online (sem upload). É a alternativa oficial e gratuita ao ConLicitação.",
    impacto: "Cria a Licitação (status 'Acompanhando'), importa os ITENS automaticamente e guarda os DOCUMENTOS do edital (PDF) para download na tela de detalhe. Alimenta o Cronograma. Não duplica (dedupe pelo identificador do PNCP).",
    onde: "/licitacoes › Buscar editais (PNCP)",
  },
  {
    nome: "PNCP — Contratos",
    tipo: "Só consulta",
    oQueFaz: "Lista contratos públicos firmados, por período e palavra-chave.",
    paraQueServe: "Inteligência de mercado: ver quem contratou o quê, por quanto e com qual fornecedor.",
    comoAlimentar: "Automático/online. Central de Consultas › aba Contratos.",
    ondeBuscar: "Online (sem upload).",
    impacto: "Consulta. Tem o atalho 'Usar em nova licitação', que abre o formulário já preenchido (órgão, objeto, nº do contrato, vigência e valor) para você acompanhar.",
    onde: "/licitacoes/consultas › Contratos",
  },
  {
    nome: "PNCP — Atas de Registro de Preços",
    tipo: "Só consulta",
    oQueFaz: "Lista atas de registro de preços e indica quais permitem adesão (carona).",
    paraQueServe: "Identificar atas vigentes às quais a empresa pode aderir, sem precisar de nova licitação.",
    comoAlimentar: "Automático/online. Central de Consultas › aba Atas.",
    ondeBuscar: "Online (sem upload).",
    impacto: "Consulta. Tem o atalho 'Usar em nova licitação (adesão)', que abre o formulário já preenchido como modalidade Adesão a Ata (órgão, objeto, nº da ata e vigência).",
    onde: "/licitacoes/consultas › Atas",
  },
  {
    nome: "Compras.gov.br — Preços praticados",
    tipo: "Só consulta",
    oQueFaz: "Mostra preços efetivamente pagos em compras públicas federais para um item (por código CATMAT).",
    paraQueServe: "Apoiar a precificação da proposta — saber por quanto o item já foi comprado, por quem e quando.",
    comoAlimentar: "Automático/online. Central de Consultas › aba Preços praticados (informe o código CATMAT do item).",
    ondeBuscar: "Online (sem upload).",
    impacto: "Apenas consulta — não grava nada no sistema.",
    onde: "/licitacoes/consultas › Preços praticados",
  },
  {
    nome: "BrasilAPI — CNPJ (Receita)",
    tipo: "Grava no sistema",
    oQueFaz: "Retorna os dados cadastrais de um CNPJ (razão social, nome fantasia, endereço, município/UF).",
    paraQueServe: "Preencher automaticamente os dados do órgão (ou cliente) sem digitar tudo à mão.",
    comoAlimentar: "Automático/online. No formulário de licitação, digite o CNPJ do órgão e clique na lupa. Também há a aba CNPJ na Central de Consultas.",
    ondeBuscar: "Online (sem upload).",
    impacto: "Preenche os campos do órgão no formulário (gravado ao salvar). Na aba CNPJ há o atalho 'Usar em nova licitação', que abre o formulário já com o órgão preenchido.",
    onde: "Formulário da licitação · /licitacoes/consultas › CNPJ",
  },
  {
    nome: "Open Food Facts — EAN",
    tipo: "Só consulta",
    oQueFaz: "Identifica um produto de consumo a partir do código de barras (EAN/GTIN).",
    paraQueServe: "Conferir rapidamente a que produto pertence um código de barras (cobre bens de consumo; medicamentos vêm melhor da CMED).",
    comoAlimentar: "Automático/online. Central de Consultas › aba EAN.",
    ondeBuscar: "Online (sem upload).",
    impacto: "Apenas consulta. (A atualização de EAN no cadastro é feita pela conciliação com a CMED.)",
    onde: "/licitacoes/consultas › EAN",
  },
  {
    nome: "CMED / PMVG (ANVISA)",
    tipo: "Grava no sistema",
    oQueFaz: "Tabela oficial de preços de medicamentos da ANVISA, incluindo o PMVG — Preço Máximo de Venda ao Governo (teto legal).",
    paraQueServe: "Precificar medicamentos dentro do teto permitido em vendas públicas e manter o EAN dos produtos atualizado.",
    comoAlimentar: "Por UPLOAD da planilha oficial. Central de Consultas › aba CMED/PMVG › Importar planilha. Atualize mensalmente.",
    ondeBuscar: (
      <>
        Baixe em{" "}
        <LinkExt href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos">gov.br/anvisa › Lista de preços</LinkExt>
        {" "}— use o arquivo <b>xls_conformidade_gov_*</b> (versão PMVG/governo).
      </>
    ),
    impacto: "Alimenta a base CMED interna. Usada na consulta por EAN, como referência de preço (PMVG) e na Conciliação de EAN do catálogo (grava EAN e PMVG nos produtos).",
    onde: "/licitacoes/consultas › CMED/PMVG",
  },
]

// ─── fluxo recomendado ─────────────────────────────────────
const FLUXO = [
  "Encontre oportunidades: em Licitações, use 'Buscar editais (PNCP)' (ex.: UF + 'medicamento') e importe os de interesse.",
  "Acompanhe: a licitação entra como 'Acompanhando' e aparece no Cronograma na data da sessão. Atualize o status conforme avança.",
  "Monte a proposta: nos itens, use 'Preços praticados' (referência de mercado) e a CMED/PMVG (teto de medicamento) para precificar.",
  "Ganhou? Mude o status para Ganha/Homologada/Contratada e preencha nº da ata/contrato, vigência e valores. Os itens definem o saldo.",
  "Fature: em Faturamento, abra o contrato e registre os empenhos. Cada empenho dá baixa no saldo, item a item.",
  "Controle: acompanhe saldo, % executado e vigências vencendo no painel de Faturamento.",
]

export default function ManualLicitacoesPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-12">
        {/* Cabeçalho */}
        <div>
          <Link href="/manuais" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3.5" /> Manuais
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6 text-primary" /> Manual — Licitações & Faturamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Como funcionam os dois módulos que conversam entre si, cada tela, cada integração (API) e como alimentar os dados.
          </p>
        </div>

        {/* Índice */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Índice</p>
            <div className="grid sm:grid-cols-2 gap-1.5 text-sm">
              {[
                ["#visao", "Visão geral"],
                ["#telas", "Telas do módulo"],
                ["#campos", "Campos de uma licitação"],
                ["#apis", "Integrações (APIs)"],
                ["#fluxo", "Fluxo recomendado"],
                ["#manter", "Como manter atualizado"],
                ["#glossario", "Glossário"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="text-primary hover:underline">• {label}</a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visão geral */}
        <Secao id="visao" icon={Workflow} titulo="Visão geral">
          <Card><CardContent className="p-4 text-sm space-y-3 leading-relaxed">
            <p>
              O módulo cobre todo o ciclo de licitação pública: do <b>acompanhamento do pregão</b> (Licitações) até o
              <b> controle de saldo do contrato</b> (Faturamento). Os dois conversam: quando uma licitação é ganha e vira
              contrato/ata, seus <b>itens</b> definem o saldo; cada <b>empenho</b> registrado no Faturamento dá baixa nesse saldo.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="font-semibold flex items-center gap-1.5"><Gavel className="size-4 text-primary" /> Licitações</p>
                <p className="text-muted-foreground text-xs mt-1">Radar de editais, acompanhamento do pregão, contrato/ata, cronograma e consultas a bases públicas.</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold flex items-center gap-1.5"><Receipt className="size-4 text-primary" /> Faturamento</p>
                <p className="text-muted-foreground text-xs mt-1">Saldo dos contratos/atas e registro de empenhos (faturamento), com baixa item a item.</p>
              </div>
            </div>
          </CardContent></Card>
        </Secao>

        {/* Telas */}
        <Secao id="telas" icon={ListChecks} titulo="Telas do módulo">
          <div className="grid gap-2">
            {TELAS.map((t) => (
              <Card key={t.nome}><CardContent className="p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.nome}</span>
                  <Caminho>{t.caminho}</Caminho>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
              </CardContent></Card>
            ))}
          </div>
        </Secao>

        {/* Campos */}
        <Secao id="campos" icon={BookMarked} titulo="Campos de uma licitação">
          <Card><CardContent className="p-4">
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {CAMPOS.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-muted-foreground text-xs mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent></Card>
        </Secao>

        {/* APIs */}
        <Secao id="apis" icon={Plug} titulo="Integrações (APIs)">
          <p className="text-sm text-muted-foreground mb-3">
            Todas as fontes abaixo são <b>oficiais e gratuitas</b>. Cada cartão explica o que a API faz, para que serve, como alimentar, onde buscar e o <b>impacto no sistema</b>.
          </p>
          <div className="grid gap-3">
            {APIS.map((a) => (
              <Card key={a.nome} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="font-semibold flex items-center gap-2"><Plug className="size-4 text-primary" /> {a.nome}</span>
                    {a.tipo === "Grava no sistema" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"><Zap className="size-3 mr-1" /> {a.tipo}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground"><Search className="size-3 mr-1" /> {a.tipo}</Badge>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Item l="O que faz" v={a.oQueFaz} />
                    <Item l="Para que serve" v={a.paraQueServe} />
                    <Item l="Como alimentar" v={a.comoAlimentar} />
                    <Item l="Onde buscar" v={a.ondeBuscar} />
                    <div className="sm:col-span-2">
                      <Item l="Impacto no sistema" v={a.impacto} destaque />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Onde usar: <Caminho>{a.onde}</Caminho></p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Secao>

        {/* Fluxo */}
        <Secao id="fluxo" icon={Workflow} titulo="Fluxo recomendado (passo a passo)">
          <Card><CardContent className="p-4">
            <ol className="space-y-3">
              {FLUXO.map((passo, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                  <span className="leading-relaxed">{passo}</span>
                </li>
              ))}
            </ol>
          </CardContent></Card>
        </Secao>

        {/* Manter atualizado */}
        <Secao id="manter" icon={Upload} titulo="Como manter os dados atualizados">
          <div className="grid gap-2">
            <Card><CardContent className="p-3.5 text-sm">
              <p className="font-medium flex items-center gap-1.5"><Database className="size-4 text-primary" /> Base CMED (mensal)</p>
              <p className="text-muted-foreground text-xs mt-1">
                Todo mês, baixe a planilha em{" "}
                <LinkExt href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos">gov.br/anvisa</LinkExt>{" "}
                (arquivo <b>xls_conformidade_gov_*</b>) e importe em <Caminho>/licitacoes/consultas › CMED/PMVG</Caminho>. A importação substitui a base anterior.
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-3.5 text-sm">
              <p className="font-medium flex items-center gap-1.5"><Barcode className="size-4 text-primary" /> EAN dos produtos (quando ficar defasado)</p>
              <p className="text-muted-foreground text-xs mt-1">
                O EAN não muda sozinho — o laboratório descontinua a apresentação e lança outra com código novo. Em{" "}
                <Caminho>/produtos/conciliar-ean</Caminho>, busque o produto, confira a sugestão da CMED e clique em <b>Aplicar</b> para gravar o EAN e o PMVG atuais. Também há o botão 💊 no cadastro do produto.
              </p>
            </CardContent></Card>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 flex gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>A aba CMED e a conciliação de EAN só mostram resultados <b>depois</b> que a planilha da ANVISA for importada pelo menos uma vez.</span>
            </div>
          </div>
        </Secao>

        {/* Glossário */}
        <Secao id="glossario" icon={BookMarked} titulo="Glossário">
          <Card><CardContent className="p-4">
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["PMVG", "Preço Máximo de Venda ao Governo — teto legal para vender o medicamento ao setor público (CMED/ANVISA)."],
                ["PF / PMC", "Preço Fábrica e Preço Máximo ao Consumidor (também na tabela CMED)."],
                ["CATMAT", "Código do catálogo de materiais do governo federal — chave para consultar preços praticados."],
                ["Ata de Registro de Preços", "Documento que registra preços para compras futuras; outros órgãos podem aderir (carona)."],
                ["Adesão / Carona", "Comprar com base numa ata existente de outro órgão, sem nova licitação."],
                ["Empenho", "Reserva orçamentária do órgão para pagar o fornecedor; aqui é o 'faturamento' que baixa o saldo."],
                ["Saldo", "Quantidade contratada menos o que já foi empenhado/faturado, item a item."],
                ["PNCP", "Portal Nacional de Contratações Públicas — base oficial de editais, contratos e atas."],
                ["EAN / GTIN", "Código de barras do produto."],
                ["Homologação", "Ato que confirma o vencedor da licitação."],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-muted-foreground text-xs mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent></Card>
        </Secao>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <span>Pronto para usar? Comece importando editais em <Link href="/licitacoes" className="text-primary hover:underline">Licitações</Link> ou abrindo a <Link href="/licitacoes/consultas" className="text-primary hover:underline">Central de Consultas</Link>.</span>
        </div>
      </div>
    </AppShell>
  )
}

function Item({ l, v, destaque }: { l: string; v: React.ReactNode; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</p>
      <p className={`text-sm mt-0.5 ${destaque ? "text-foreground font-medium" : "text-muted-foreground"}`}>{v}</p>
    </div>
  )
}
