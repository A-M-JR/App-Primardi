# AGENTS.md

> **A fonte única de verdade deste projeto é o [`CLAUDE.md`](./CLAUDE.md).**
>
> Qualquer agente/IA (Cursor, Copilot, Claude Code, etc.) deve **ler o
> `CLAUDE.md`** antes de mexer no código e seguir exatamente as convenções,
> arquitetura e regras descritas lá. Este arquivo existe só para apontar para
> ele — não duplique conteúdo aqui (evita divergência).

Resumo das regras inegociáveis (detalhes no `CLAUDE.md`):

- **Idioma:** tudo em pt-BR (código, comentários, UI, commits).
- **Stack:** Next.js 16 + React 19 + Prisma 7.8 (Neon Postgres) + Tailwind v4/shadcn. **Pacotes: somente npm** (`npm ci`).
- **Multitenancy:** sempre escopar Server Actions por `empresaId` via `getRequesterContext`/`assertAcesso`.
- **Banco (Neon = produção):** `prisma db push` aditivo **só com autorização**; nada destrutivo direto em prod.
- **Segredos:** `.env` fora do git; usar `.env.local` / env vars do host. Nunca commitar segredos.
- **Validação:** `npx tsc --noEmit` + `npx next build`; não tentar zerar os erros TS pré-existentes (`ignoreBuildErrors` ligado).
- **Antes de:** db push em prod, ações destrutivas, commits/push ou enviar dados a serviços externos → **confirmar com o usuário**.
