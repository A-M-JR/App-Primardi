<div align="center">
  <img src="https://ui.shadcn.com/favicon.ico" alt="Logo" width="80" height="80">
  <h1 align="center">App Primardi</h1>
  <p align="center">
    Sistema Premium de Gestão Comercial e Operacional para Indústria de Etiquetas e Embalagens Flexográficas.
    <br />
    <br />
    <a href="#-funcionalidades">Funcionalidades</a>
    ·
    <a href="#-arquitetura-e-tecnologias">Tecnologias</a>
    ·
    <a href="#-instalação-e-uso">Instalação</a>
  </p>
</div>

---

## 🚀 Visão Geral

O **App Primardi** é um sistema B2B tailormade criado para gerenciar o clico de vendas e produção na indústria flexográfica. Ele oferece uma interface moderna em *Glassmorphism* (via Tailwind CSS / Shadcn UI) e alta performance utilizando Server Actions do Next.js. De orçamentos complexos até Inteligência Artificial embutida que interage com os dados: tudo flui numa única plataforma B2B.

## ✨ Funcionalidades

- 📈 **Dashboard B2B:** Métricas financeiras, conversão de Vendas x Orçamentos, avisos de inatividade (SLA e churn de clientes).
- 🏷️ **Catalogo de Matrizes/Etiquetas:** Construção dinâmica de produtos (metragem, tubete, layout e facas).
- 💰 **Orçamentos com Funil Comercial:** Geração ágil de cotações com cálculo em tempo real de lucratividade, histórico comercial e emissão direta de propostas em PDF.
- 🏭 **Ordens de Produção (Pedidos):** Conversão em 1-click de propostas aprovadas para ordens de serviço (O.S), com rastreador visual de fabricação e despacho.
- ⚡ **Copilot AI (Integração LLM):** Chat inteligente embutido capaz de consultar orçamentos, dados de clientes e pedidos através do banco de dados vetorial/PG.
- 👥 **Gestão de Roles:** Vendedores, Compradores Externos e Administradores com visualizações parametrizadas e logs rigorosos de proteção de _Double Submit_.

## 🛠️ Arquitetura e Tecnologias

Este projeto foi construído usando o estado da arte do ecossistema React/Node:

- **Core & Roteamento:** [Next.js](https://nextjs.org/) (App Router & Server Actions)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização e UI:** [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), Framer Motion, Lucide Icons
- **Gerenciamento de DB:** [Prisma ORM](https://www.prisma.io/)
- **Banco de Dados (Produção/Dev):** [PostgreSQL](https://www.postgresql.org/) (Pode ser integrado ao Vercel Postgres / Neon)
- **IA e Tools:** [Gemini / LLM Tools]
- **Renderização e PDFs:** Componentização assíncrona com renderização segura Server-Side.

## 🚀 Instalação e Uso

### 1. Requisitos
- Node.js (v18.17 ou superior)
- Yarn / NPM 
- Instância PostgreSQL (Local ou Nuvem)

### 2. Passo-a-Passo

```bash
# Clone o repositório 
git clone <SEU_REPOSITORIO>
cd app_primardi

# Instale os pacotes e dependências
yarn install # ou npm install

# Configure as chaves de ambiente
cp .env.example .env
```

Abra o arquivo `.env` e ajuste apenas o estritamente necessário (não comitar dados sensíveis).
```env
# Exemplo genérico
DATABASE_URL="postgresql://usuario:senha@localhost:5432/primardidb"
```

### 3. Subindo o Banco e Populando

Sincronize as tabelas e o Schema via Prisma e injete as cores e layouts usando nossos scripts de setup:

```bash
npx prisma db push

# (Opcional) Rodar seeders (Administrador padrão, cores dos Funis)
npx tsx prisma/seed.ts
npx tsx scripts/fix-status.ts
```

### 4. Rodando o Projeto

```bash
yarn dev 
```

O App estará disponível em: `http://localhost:3000`

---

## 🔒 Boas Práticas e Segurança

- **Double-Submit Protection:** Diversos formulários sensíveis no Front-End implementam `isSubmitting` patterns no lock da Thread.
- **Server-Side Rendering (SSR):** As regras estritas de faturamento, validações financeiras e requisição BD encontram-se isoladas com a tag implícita de `"use server"` para não vazar código JS proprietário no browser.
- **Environment Variables:** Credentials de Auth e API Keys externas JAMÁIS devem ser indexadas. Utilize o painel de variáveis ocultas do seu ambiente de Deploy (ex: _Vercel environment configs_).

## 📄 Licença

Uso Privado / Restrito. Nenhuma informação confidencial cruza o repositório sem encriptação prévia.
