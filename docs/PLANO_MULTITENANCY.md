# Plano — Multitenancy, Permissões por Módulo e Otimização do Schema

> Status: **proposta para aprovação** · Banco: PostgreSQL + Prisma · App: Next.js (App Router, server actions)
>
> Decisões já tomadas:
> - Permissões por módulo → **JSON no vínculo usuário↔empresa** + catálogo de módulos em código
> - Role → **por empresa** (no vínculo, não no usuário)
> - Email → **global único** (1 identidade, vinculada a N empresas)
> - **Dois níveis de acesso**: nível de plataforma (MASTER/TI) global + role por empresa
> - **Módulos ativos por empresa** (habilitação controlada só pelo MASTER)
> - Entregar **plano primeiro**, implementar depois

---

## 1. Diagnóstico do estado atual

| Tema | Hoje | Problema |
|---|---|---|
| Tenant | Toda tabela tem `empresaId` (row-level multitenancy) | ✅ Base correta |
| Vínculo usuário↔empresa | `User.empresaId` **1:1** | ❌ Não permite usuário em N empresas |
| Isolamento | `empresaId: 1` hardcoded em ~28 pontos; `getUsers` não filtra por empresa | ❌ Vazamento entre empresas / furo de segurança |
| Permissão | Enum `role` + checagens hardcoded em código | ❌ Sem granularidade por módulo/empresa |
| Sessão | `localStorage` com `userId`; `requesterId` passado como parâmetro nas actions | ❌ Frágil e não confiável p/ isolamento |
| Role/Vendedor | `User.role` e `User.vendedorId` fixos no usuário | ❌ Não podem variar por empresa |
| Uso de JSON | Staging de importação, snapshots, configs já em JSON | ✅ Bem aplicado |

**Conclusão:** a estrutura de dados de negócio (orçamentos, pedidos, produtos…) **não precisa mudar** — todas já têm `empresaId`. A reforma é na **camada de identidade/autorização** e no **enforcement** do tenant.

---

## 2. Modelo de acesso (dois níveis)

O sistema tem **duas dimensões de autorização independentes**:

### Nível de plataforma (global, no `User`) — cross-tenant

| Nível | Quem | Pode |
|---|---|---|
| **MASTER** | Você (dono da plataforma) | **Tudo**, incluindo as 3 configs reservadas: token da API do chat, contexto/prompt da IA, e **módulos ativos** de cada empresa |
| **TI** | Suporte | Tudo do MASTER **exceto** as 3 configs acima: gere usuários/permissões, cria/exclui empresas, edita cadastro da empresa, vê/opera dados das 3 empresas para chamados |
| **PADRAO** | Usuário comum | Nada cross-tenant; acessa só pelas empresas vinculadas (memberships) |

> Resumo: **TI = MASTER − {token IA, contexto IA, módulos ativos}**. Essas 3 ficam exclusivas do MASTER.

### Role por empresa (no `UserEmpresa`) — tenant-level

`GERENTE` / `OPERADOR` / `VENDEDOR`, mais o JSON de permissões por módulo. ADMIN/GERENTE com bypass dentro da empresa.

### Matriz resumida

| Recurso | MASTER | TI | GERENTE (na empresa) | OPERADOR/VENDEDOR |
|---|:--:|:--:|:--:|:--:|
| Token API IA / contexto IA | ✅ | ❌ | ❌ | ❌ |
| Ativar/desativar módulos da empresa | ✅ | ❌ | ❌ | ❌ |
| Criar/excluir empresas | ✅ | ✅ | ❌ | ❌ |
| Editar cadastro da empresa | ✅ | ✅ | ❌ | ❌ |
| Gerir usuários e permissões | ✅ | ✅ | (só da sua empresa, opcional) | ❌ |
| Ver/operar dados das empresas | ✅ (todas) | ✅ (todas) | ✅ (suas) | ✅ (conforme permissão) |

---

## 3. Schema final proposto

### 3.1. Usuário e vínculo (mudança central)

```prisma
enum NivelAcesso {            // acesso de plataforma (cross-tenant)
  MASTER                      // dono da plataforma (você)
  TI                          // suporte
  PADRAO                      // usuário comum
  @@map("crm_nivel_acesso")
}

model User {
  id           Int         @id @default(autoincrement())
  nome         String
  email        String      @unique       // global: a identidade cruza empresas
  senha        String
  nivelAcesso  NivelAcesso @default(PADRAO)
  ativo        Boolean     @default(true)
  criadoEm     DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  memberships  UserEmpresa[]
  chatMessages AIChatMessage[]
  compraAuditorias CompraAuditoria[]

  @@index([ativo])
  @@map("crm_users")
}

model UserEmpresa {                       // vínculo usuário ↔ empresa
  id         Int      @id @default(autoincrement())
  userId     Int
  empresaId  Int
  role       UserRole @default(OPERADOR)  // role POR empresa
  permissoes Json     @default("{}")      // módulos liberados nesta empresa
  vendedorId Int?                         // vínculo de vendedor é por empresa
  ativo      Boolean  @default(true)
  criadoEm   DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  empresa  Empresa   @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  vendedor Vendedor? @relation(fields: [vendedorId], references: [id], onDelete: SetNull)

  @@unique([userId, empresaId])
  @@index([empresaId])
  @@index([userId])
  @@map("crm_user_empresas")
}
```

**Removido de `User`:** `empresaId`, `role`, `vendedorId` (migram para `UserEmpresa`).
**Adicionado em `Empresa`:** `memberships UserEmpresa[]` + `modulosAtivos`.
**Adicionado em `Vendedor`:** `memberships UserEmpresa[]` (substitui o atual `users User[]`).

### 3.2. Empresa — módulos ativos e config restrita

```prisma
model Empresa {
  // ... campos cadastrais atuais (editáveis por MASTER e TI) ...
  modulosAtivos Json @default("[]")   // ex.: ["comercial","compras","estoque"] — só MASTER altera
  // ... relações ...
  memberships   UserEmpresa[]
}
```

- `modulosAtivos` lista os módulos **habilitados** na empresa. Controlado **só pelo MASTER**.
- `AIConfig` (apiKey, systemPrompt/contexto) já existe e passa a ser **acessível só pelo MASTER**.
- **Gating efetivo do usuário** = `empresa.modulosAtivos` ∩ `userEmpresa.permissoes`. Um módulo não ativo na empresa não aparece para ninguém (nem para GERENTE), só o MASTER pode ativá-lo.

### 3.3. Formato do JSON de permissões

```jsonc
// UserEmpresa.permissoes
{
  "comercial": ["view", "edit"],
  "crm":       ["view"],
  "compras":   ["view", "edit", "approve"],
  "estoque":   ["view"]
}
```

Regras:
- `GERENTE` → **bypass** (enxerga todos os módulos ativos da empresa). O JSON governa o `OPERADOR`.
- Ação ausente ou array vazio = sem acesso.
- Ações padrão: `view`, `edit`, `approve` (extensível por módulo).

### 3.4. Catálogo de módulos (em código, fonte da verdade)

> Módulos atuais. Licitação, Faturamento e Contas a Receber entram depois (telas a construir).

```typescript
// lib/modules.ts
export const MODULOS = {
  comercial: { label: "Comercial", rotas: ["/orcamentos", "/pedidos", "/comissoes"] },
  crm:       { label: "CRM",       rotas: ["/clientes", "/leads"] },
  compras:   { label: "Compras",   rotas: ["/compras"] },
  estoque:   { label: "Estoque",   rotas: ["/produtos", "/estoque", "/categorias", "/tabelas-preco", "/fornecedores"] },
  // futuros: licitacoes, faturamento, contas_receber
} as const

export type ModuloId = keyof typeof MODULOS

export function can(
  ctx: {
    nivelAcesso: string                 // MASTER | TI | PADRAO
    role: string                        // role na empresa ativa
    permissoes: Record<string, string[]>
    modulosAtivos: string[]             // módulos habilitados na empresa ativa
  },
  modulo: ModuloId,
  acao: "view" | "edit" | "approve" = "view",
): boolean {
  if (!ctx.modulosAtivos.includes(modulo)) return false       // empresa não habilitou
  if (ctx.nivelAcesso === "MASTER" || ctx.nivelAcesso === "TI") return true
  if (ctx.role === "GERENTE") return true                     // bypass dentro da empresa
  return ctx.permissoes?.[modulo]?.includes(acao) ?? false    // OPERADOR
}
// Role por empresa simplificada: GERENTE | OPERADOR.
// "Vendedor" não é role — é OPERADOR com vendedorId vinculado no UserEmpresa.
```

---

## 4. Otimizações de schema (JSON + índices)

### 4.1. JSON — onde aplicar e onde NÃO

| Aplicar JSON | Manter relacional |
|---|---|
| ✅ `UserEmpresa.permissoes` (lido por usuário no login) | ❌ `ItemPedido` / `ItemOrcamento` / `ItemPedidoCompra` (join c/ Produto, soma de totais, relatórios) |
| ✅ Endereço de `Empresa`/`Cliente` → campo `endereco Json` mantendo `cidade`/`estado` como coluna (há índice) | ❌ `MovimentacaoEstoque` / `MovimentacaoCredito` (filtro por período, agregação de saldo) |
| ✅ Já corretos: `consumoMensal`, `precosFornecedor`, `estoqueSnapshot`, `linhas`, `respostas`, `toolCalls`, `detalhes` | ❌ Saldos de crédito no `Cliente` (agregados quentes, ficam como colunas) |

> Regra: JSON só para dados lidos/gravados **em bloco** que você **não filtra, ordena, agrega ou faz join**. Converter itens de documento para JSON **pioraria** performance e integridade.

### 4.2. Índices compostos com `empresaId` na frente

Em multitenant quase toda query é `WHERE empresaId = ? AND ...`. Ajustes:

- `Orcamento`: trocar índices isolados por `@@index([empresaId, statusId])`, `@@index([empresaId, criadoEm])`, `@@index([empresaId, clienteId])`.
- `Pedido`: idem (`[empresaId, statusId]`, `[empresaId, criadoEm]`).
- `Produto`: remover `@@index([nome])` isolado (já existe `[empresaId, nome]`); avaliar `[empresaId, ativo]`.
- `Cliente`: consolidar `[empresaId, ativo]`, `[empresaId, criadoEm]`.
- `Lead`, `MovimentacaoCredito`, `MovimentacaoEstoque`: `[empresaId, criadoEm]`.

Ganho: menos I/O e índices mais seletivos; remove índices redundantes (mantém escrita mais barata).

---

## 5. Enforcement de tenant (ponto crítico de segurança)

1. **Sessão server-side**: substituir `localStorage` por **cookie httpOnly assinado** contendo `userId` + `empresaAtivaId`. Trocar empresa = atualizar cookie (validando acesso).
2. **Helper único de contexto** (`getRequesterContext`) passa a:
   - ler `userId` + `empresaAtivaId` da sessão (não de parâmetro do cliente);
   - **validar acesso**: MASTER/TI acessam qualquer empresa; demais precisam de `UserEmpresa` ativo nesse par;
   - retornar `{ userId, empresaId, nivelAcesso, role, vendedorId, permissoes, modulosAtivos }`.
3. **Eliminar todos os `empresaId: 1`** (~28 pontos) e fazer toda action filtrar por `ctx.empresaId`.
4. `getUsers` e demais listagens passam a escopar por empresa (hoje `getUsers` não escopa).
5. **Configs reservadas ao MASTER**: as actions de `AIConfig` (token/contexto) e de `modulosAtivos` checam `nivelAcesso === "MASTER"` no servidor — não confiar só no esconder do menu.

---

## 6. Mudanças na aplicação

### 6.1. Telas (UI) necessárias

| Tela | Rota | Acesso | O que faz |
|---|---|---|---|
| **Gestão de Empresas** | `/empresas` (nova) | MASTER, TI | CRUD das empresas + cadastro (razão social, CNPJ, endereço, logo, cores) |
| **Config de plataforma da empresa** | `/empresas/[id]/plataforma` (nova) ou aba em `/configuracoes` | **só MASTER** | Token API IA, contexto/prompt IA, **módulos ativos** |
| **Gestão de Usuários** | `/usuarios` (refatorar) | MASTER, TI | CRUD de usuário, vincular a empresas (memberships), role + permissões por empresa, reset senha, definir nível (MASTER/TI/PADRAO) |
| **Seletor de empresa** | header (novo componente) | todos | Lista empresas acessíveis; troca a empresa ativa |
| **Configurações da empresa** | `/configuracoes` (ajustar) | conforme item | Separar config sensível (MASTER) do resto |

### 6.2. Código

| Camada | Arquivo(s) | Mudança |
|---|---|---|
| Schema | `prisma/schema.prisma` | `User` enxuto + `NivelAcesso` + `UserEmpresa` + `Empresa.modulosAtivos` + índices |
| Migration | `prisma/migrations/*` | Criar tabela/enum/coluna, migrar dados, dropar colunas antigas |
| Seed | `prisma/seed.ts` | Criar 3 empresas + usuário MASTER + memberships + permissões padrão |
| Auth (servidor) | `app/api/auth/login/route.ts`, `lib/actions/users.ts` | Login retorna memberships + nível; setar cookie; `getRequesterContext` valida tenant/nível |
| Auth (cliente) | `lib/auth-context.tsx` | Guardar empresa ativa + lista de empresas + nível; trocar empresa |
| Seletor | `components/user-selector.tsx` (hoje usa `mock-data`!) + header | Reescrito como seletor de **empresa** |
| Módulos | novo `lib/modules.ts`; refatorar `lib/compras/permissions.ts` e `lib/compras/module.ts` | `can(ctx, modulo, acao)` |
| Sidebar | `components/app-sidebar.tsx` | Renderizar grupos por `can(...)` + itens MASTER/TI por `nivelAcesso` |
| Actions | ~28 arquivos em `lib/actions/**` | Trocar fallback `empresaId:1` por `ctx.empresaId`; guard de MASTER nas configs sensíveis |
| Admin | `app/usuarios/page.tsx`, `components/usuario-form-dialog.tsx` | Gerir memberships + permissões + nível |

> ⚠️ `components/user-selector.tsx` importa `@/lib/mock-data` (não existe mais no schema real) — será reescrito.

---

## 7. Migração de dados (sem perda)

1. Criar enum `NivelAcesso`, tabela `UserEmpresa` e coluna `Empresa.modulosAtivos`.
2. Para cada `User` atual: inserir 1 `UserEmpresa` com `empresaId`, `role`, `vendedorId` atuais e `permissoes` padrão conforme a role. ADMIN atual → `nivelAcesso = MASTER` (revisar); demais → `PADRAO`.
3. `email` passa a `@unique` global. **Decisão tomada:** não faz sentido email duplicado entre empresas — 1 email = 1 usuário. Verificar/consolidar eventuais duplicados existentes em 1 usuário com múltiplos memberships antes de aplicar o `@unique`.
4. Popular `modulosAtivos` de cada empresa com os módulos hoje em uso.
5. Só então dropar `User.empresaId`, `User.role`, `User.vendedorId`.

Script de migração de dados acompanha a migration (padrão já usado em `prisma/scripts/migrate-compras-json.ts`).

### 7.1. Estratégia em 2 migrations (aditiva → destrutiva)

Para não quebrar o app em produção, a Fase 1 é dividida:

**Migration A — aditiva (não destrutiva), feita agora no schema:**
- enum `crm_nivel_acesso`; coluna `crm_users.nivelAcesso` (default PADRAO); coluna `crm_empresas.modulosAtivos` (default `[]`); tabela `crm_user_empresas`.
- Mantém `User.empresaId/role/vendedorId` intactos → código atual continua funcionando.

**Backfill — `prisma/scripts/migrate-multitenancy.ts` (idempotente):**
- popula `modulosAtivos` das empresas; define `nivelAcesso` (ADMIN→MASTER, demais→PADRAO); cria 1 `UserEmpresa` por usuário (ADMIN→GERENTE, VENDEDOR→OPERADOR; OPERADOR ganha view+edit nos módulos atuais).

**Migration B — destrutiva (só depois da Fase 2):** quando todo o código usar memberships, remover `User.empresaId/role/vendedorId` e tornar `User.email` globalmente `@unique`.

### 7.2. Como aplicar com segurança (Neon)

1. Criar uma **branch do banco no Neon** e apontar `DB_URL_OFFICIAL` para ela.
2. `npx prisma migrate dev --name add_multitenancy_additive` (gera + aplica a Migration A na branch).
3. `npx tsx prisma/scripts/migrate-multitenancy.ts` (backfill).
4. Validar dados; rodar o app contra a branch.
5. Só então aplicar em produção: `npx prisma migrate deploy` + rodar o backfill.

> Pendência: atualizar `prisma/seed.ts` para bancos novos já criarem membership + `modulosAtivos` + usuário MASTER.

---

## 8. Fases de execução

| Fase | Entrega | Risco | Reversível? |
|---|---|---|---|
| **0** | Sessão httpOnly + `getRequesterContext` validando tenant/nível + remover `empresaId:1` | Médio | Sim |
| **1** | `NivelAcesso` + `UserEmpresa` + `modulosAtivos` + migração de dados + remoção de colunas do `User` | Médio | Sim (backup) |
| **2** | `lib/modules.ts` + `permissoes` JSON + seletor de empresa + sidebar por `can(...)`/nível | Baixo | Sim |
| **3** | Telas: `/empresas`, config de plataforma (MASTER), `/usuarios` refatorada | Médio | Sim |
| **4** | Índices `[empresaId, ...]` + endereço em JSON (opcional) | Baixo | Sim |

Cada fase em branch própria, testada antes do merge.

---

## 9. Decisões fechadas

- ✅ Email global único (1 email = 1 usuário, vinculado a N empresas).
- ✅ Níveis de plataforma: **MASTER** (você, configs sensíveis), **TI** (suporte: gere usuários/permissões, cria/exclui e edita empresas, opera dados das 3 — sem token IA / contexto IA / módulos ativos), **PADRAO**.
- ✅ Módulos ativos por empresa, controlados só pelo MASTER.
- ✅ Permissões por módulo em JSON; role por empresa.
- ✅ **Módulos atuais:** `comercial`, `crm`, `compras`, `estoque`. Licitação, Faturamento e Contas a Receber entram **depois** (telas a construir).
- ✅ **Roles por empresa simplificadas:** `GERENTE` | `OPERADOR`. "Vendedor" deixa de ser role — é um `OPERADOR` com `vendedorId` vinculado no membership (ao vincular um vendedor, o operador passa a assinar orçamentos/pedidos).
- ✅ `ADMIN` da role antiga é absorvido pelo nível de plataforma `MASTER`.
