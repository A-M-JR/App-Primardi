# CLAUDE.md — Guia do Projeto (App-Primardi)

> Leia este arquivo ANTES de mexer no código. Ele define stack, convenções,
> arquitetura e **regras inegociáveis**. Siga o padrão existente — não invente
> abordagens diferentes. Tudo em **português (pt-BR)**: código, comentários, UI,
> commits e mensagens ao usuário.

---

## 1. O que é
ERP/CRM **multiempresa** (multitenant) do grupo Primardi/Tangipar — gestão
comercial (orçamentos, pedidos, clientes/CRM), compras, estoque, cobrança,
licitações/faturamento, promoções e chamados. App web único, com isolamento por
empresa.

## 2. Stack & ferramentas (NÃO troque sem motivo forte)
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**.
- **Prisma 7.8** (engine `library` + **adapter pg**) sobre **Postgres no Neon** (produção).
- **Tailwind CSS v4** + **shadcn/ui** (Radix) + **lucide-react** (ícones) + **sonner** (toasts).
- **xlsx (SheetJS, via CDN oficial)** para planilhas; **jspdf** + **html2canvas** para PDFs.
- **@aws-sdk/client-s3** para storage no **Cloudflare R2**.
- **bcryptjs** (senha), **IA Gemini** (módulo IA).
- **Gerenciador de pacotes: SOMENTE npm** (`package-lock.json`). NÃO usar yarn/pnpm
  (lockfiles deles estão no .gitignore). No deploy use **`npm ci`**.

## 3. Estrutura
- `app/` — rotas (App Router). Páginas são **`"use client"`** e usam `<AppShell>`.
- `lib/actions/*` — **Server Actions** (`"use server"`). Toda a lógica de dados.
- `lib/` — domínio/helpers (`modules.ts`, `session.ts`, `integracoes/`, `storage/`, `licitacoes/`, `chamados/`, `promocoes/`, `cmed/`, `cobranca/`).
- `components/` — UI; `components/ui/*` é shadcn (não reescrever do zero).
- `prisma/schema.prisma` — tabelas prefixadas `crm_` via `@@map`.

## 4. Multitenancy & autorização (CRÍTICO)
- Vínculo usuário↔empresa é **N:N** via `UserEmpresa` (memberships). **NÃO existem
  mais** `User.empresaId/role/vendedorId` (removidos na Migração B). Email é `@unique` global.
- Níveis (em `User.nivelAcesso`): **MASTER** (dono; configs sensíveis: token IA,
  contexto IA, módulos ativos), **TI** (tudo menos essas 3), **PADRAO** (só via membership).
- Role por empresa (em `UserEmpresa.role`): **GERENTE** (vê tudo) | **OPERADOR**
  (governado por permissões JSON). "Vendedor" = OPERADOR com `vendedorId` no membership.
- Catálogo de módulos em `lib/modules.ts` + função `can(ctx, modulo, acao)`.
  Gating efetivo = `empresa.modulosAtivos` ∩ permissões do usuário.
- **Toda Server Action DEVE** começar resolvendo o contexto e escopando por empresa:
  - `getRequesterContext()` (lib/actions/users.ts) → `{ userId, empresaId, nivelAcesso, role, permissoes, modulosAtivos, isAdmin, vendedorId }`.
  - `assertAcesso(modulo, "view"|"edit")` (lib/licitacoes/guards.ts) para checar permissão.
  - **Sempre filtrar queries por `empresaId: ctx.empresaId`** (e validar posse em updates/deletes). Nunca confie em id vindo do cliente sem escopar.
- Sessão: cookie httpOnly assinado (HMAC, `SESSION_SECRET`). Login resolve a empresa
  ativa pelo 1º membership (MASTER/TI sem membership → 1ª empresa).

## 5. Banco de dados (Neon) — REGRAS INEGOCIÁVEIS
- É **produção**. Antes de migrar, leia a memória `db-neon-producao`.
- **Mudanças ADITIVAS** (novas tabelas/colunas) → `npx prisma db push` **somente com
  autorização explícita do usuário** a cada migração.
- **NUNCA** rodar `prisma migrate dev` nem mudanças destrutivas direto em prod. Destrutivo
  só em **branch do Neon** (testar) + backup + ok do usuário.
- Ao **adicionar um model novo**: bumpar `PRISMA_SCHEMA_VERSION` em `lib/prisma-db.ts`
  e incluí-lo no `isStalePrismaClient` (senão o dev server segura client antigo).
- **Prisma 7**: a `url` do datasource fica **só em `prisma.config.ts`** (`datasource.url = env("DB_URL_OFFICIAL")`), **nunca** no `schema.prisma` (dá erro de validação).
- Campos `Json`: gravar com `as unknown as Prisma.InputJsonValue`; ler com `Array.isArray(...) ? (... as unknown as Tipo[]) : []`.
- Datas: Server Actions retornam **ISO string** (`.toISOString()`), não `Date`. Reads usam `unstable_noStore()`.

## 6. Segredos & ambiente
- **`.env` NÃO é versionado** (gitignored). Use **`.env.local`** localmente e as env
  vars do host em produção. `.env.example` é o modelo (sem segredos).
- **Nunca** commitar segredos. Chaves atuais: `DB_URL_OFFICIAL`/`DATABASE_URL`,
  `SESSION_SECRET`, `COSMOS_TOKEN`, `R2_*`, (futuro) `CHAMADO_DEV_*`.

## 7. Storage de arquivos (Cloudflare R2)
- `lib/storage/r2.ts` (`uploadR2`, `removerR2PorUrl`, `r2Configurado`) + rota `/api/upload`.
- Padrão: **comprimir imagem no cliente** (`lib/storage/compress-image.ts`, WebP ~512px) →
  upload → **guardar só a URL** no banco (NUNCA base64; base64 é só fallback se o R2 não estiver configurado).
- Ao trocar/excluir um arquivo, **remover o anterior do R2** (evitar órfãos).

## 8. Integrações externas (oficiais/gratuitas) — `lib/integracoes/`
- **PNCP** (`/api/consulta` e `/api/pncp/v1`): editais, itens, arquivos (PDF), contratos, atas.
- **Compras.gov.br** (dados abertos): preços praticados (por CATMAT).
- **BrasilAPI** CNPJ com **fallback** (BrasilAPI → minhareceita.org → publica.cnpj.ws).
- **EAN/GTIN**: Open Food Facts (grátis) → **Bluesoft Cosmos** (token, **cota 25/dia** controlada em `crm_consulta_api_usage`).
- **CMED/ANVISA**: upload da planilha (PMVG/preço-teto governo).
- Adapters são **defensivos** (timeout, optional chaining, degradam sem quebrar).
- **WhatsApp**: SEMPRE `wa.me` manual (sem API oficial). Não implementar disparo automático sem pedido explícito.

## 9. Convenções de UI
- Página nova = `"use client"` + `<AppShell>` + gate `can("modulo")` (mostra `ShieldAlert` se sem acesso).
- Padrão: **lista (cards/tabela) + filtros + dialog de criar/editar + página de detalhe**.
- Dialogs largos: usar largura com prefixo `sm:` (ex.: `w-[calc(100%-1rem)] sm:max-w-3xl`).
  **NÃO** usar `max-w-4xl` sem prefixo — o `DialogContent` base tem `sm:max-w-lg` que sobrescreve.
- Grids responsivos: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` (não forçar muitas colunas em telas estreitas).
- **html2canvas (1.x/usado nos flyers) NÃO entende `oklch`/`lab` do Tailwind v4.** Para PDF visual,
  renderizar HTML com **estilos inline em hex** dentro de um **iframe isolado** (ver `lib/promocoes/promo-pdf-html.ts`).
- Ícones: `lucide-react`. Toasts: `sonner` (`toast.success/error`).

## 10. Adicionar um MÓDULO novo (checklist)
1. `lib/modules.ts`: nova chave em `MODULOS` (label + rotas).
2. `prisma/seed.ts`: incluir em `MODULOS_PADRAO` (se padrão).
3. Sidebar (`components/app-sidebar.tsx`): item/grupo com gate `can("modulo")`.
4. Breadcrumb (`components/app-shell.tsx`): labels das rotas.
5. Schema + actions + páginas seguindo os padrões acima.
6. Ativar o módulo na empresa em **/empresas → Módulos** (MASTER) para aparecer no menu.

## 11. Fluxo de trabalho ao mudar código
- Validar com **`npx tsc --noEmit`** e, para mudanças relevantes, **`npx next build`**.
- O projeto tem ~106 erros TS **pré-existentes** e `typescript.ignoreBuildErrors: true` no
  `next.config`. **NÃO tente zerar os erros antigos**; só garanta que **seus arquivos** ficam limpos
  e que o `next build` passa.
- Após mudança de schema, reiniciar o dev: **`npm run dev:fresh`** (limpa `.next`).
- Confirmar com o usuário antes de: `db push` em prod, ações destrutivas, commits/push,
  enviar dados a serviços externos.

## 12. Memória do projeto (status detalhado)
O histórico, decisões e status por módulo ficam no **sistema de memória** (fora do repo,
em `…/memory/MEMORY.md` e arquivos linkados). Consulte-o para "o que já foi feito".
Módulos implementados: Comercial/Televendas, CRM+Agenda, Compras, Estoque/Logística,
Crédito/Cobrança, Licitações/Faturamento (+Consultas de APIs, conciliação de EAN),
Promoções, Chamados/Suporte, Administração (empresas/usuários/permissões), IA.

## 13. Pendências conhecidas (não recriar do zero; ver memória)
- Ativar módulos novos em /empresas (operacional do usuário).
- Endpoint dos desenvolvedores nos Chamados (stub em `lib/chamados/dispatch-dev.ts`, aguarda parâmetros).
- Rotacionar credenciais que já vazaram no histórico do git (senha Neon, SESSION_SECRET).
- 6 vulnerabilidades npm moderadas restantes são **dev-only/transitivas** (Next/postcss + prisma CLI). NÃO rodar `npm audit fix --force` (rebaixa o Prisma e quebra o client).
