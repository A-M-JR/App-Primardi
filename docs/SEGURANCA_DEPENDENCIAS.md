# Vulnerabilidades de dependências (npm audit) — TODO

> Levantado em 2026-06-16. **Adiado** a pedido (a plataforma será customizada inteira; tratar depois).
> Total: **17** — 1 crítica, 10 altas, 6 moderadas.

## 🔴 Crítica
- **jspdf** `<=4.2.0` — ReDoS, DoS, **Path Traversal / Local File Inclusion**. Fix: `jspdf@4.2.1` (**major** — testar PDFs). Usado em `components/pdf-quotation.tsx`, `components/pdf-order.tsx`. `dompurify` é dependência dele.

## 🟠 Altas — exposição real (priorizar)
- **next** `<=16.3.0-canary` — HTTP request smuggling, cache de imagem ilimitado. Fix: `next@16.2.9` (não-major). **Framework exposto à internet — mais importante.**
- **xlsx** `*` — Prototype Pollution + ReDoS. **SEM fix no npm.** Usado em `lib/compras/import-parser.ts` (upload de planilha). Mitigar: validar/limitar uploads, migrar p/ SheetJS oficial (cdn.sheetjs.com) ou `exceljs`.
- **lodash** `<=4.17.23` — code injection via `_.template`, prototype pollution. Tem fix. Confirmar se é uso direto.

## 🟠 Altas — tooling do Prisma 7 (risco baixo em produção, rodam em dev/build)
- **prisma**, **@prisma/config**, **@prisma/dev**, **effect**, **hono**, **@hono/node-server**, **defu** — dependências do dev server embutido do Prisma. Saem com `npm audit fix`.

## 🟡 Moderadas
- **dompurify** `<=3.4.8` (XSS) — via jspdf, sai junto do `jspdf@4.2.1`.
- **postcss** `<8.5.10` (XSS no stringify) — via next, sai junto do `next@16.2.9`.
- **chevrotain**, **@chevrotain/cst-dts-gen**, **@chevrotain/gast**, **@mrleebo/prisma-ast** — tooling Prisma (via lodash). `npm audit fix`.

## Plano recomendado (quando for tratar)
1. `npm audit fix` — resolve cluster Prisma/postcss/chevrotain (não-major, seguro).
2. `next@16.2.9` — patch importante; testar build + rotas.
3. `npm i jspdf@4.2.1` — major; **testar geração de PDF** depois.
4. **xlsx** — sem fix npm; mitigar uploads ou trocar de lib.
5. **lodash** — atualizar; confirmar uso direto.
