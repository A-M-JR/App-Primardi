// Force reload for schema sync - Updated at 2026-04-21T17:53:00
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Força o recarregamento do cache do Prisma em ambiente de desenvolvimento
if (process.env.NODE_ENV !== "production") {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(".prisma") || key.includes("@prisma/client")) {
      delete require.cache[key];
    }
  });
}

const PRISMA_SCHEMA_VERSION = "202606173000_licitacao_anexos"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
  prismaSchemaVersion?: string
}

// Runtime do APP (serverless/Vercel): use SEMPRE o endpoint POOLED do Neon
// (host com "-pooler"). As migrations/`db push` usam o endpoint DIRETO via
// DB_URL_OFFICIAL (ver prisma.config.ts). Por isso o runtime prioriza
// DATABASE_URL (pooled) e só cai em DB_URL_OFFICIAL como fallback.
const connectionString = process.env.DATABASE_URL || process.env.DB_URL_OFFICIAL

// Em serverless cada instância mantém poucas conexões; o pooler do Neon
// (PgBouncer) faz o pool real. Um `max` alto aqui só geraria tempestade de
// conexões e cold starts. Timeouts curtos devolvem conexões ociosas ao pooler.
const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
})
const adapter = new PrismaPg(pool as any)

function createPrismaClient() {
  return new PrismaClient({ adapter })
}

function isStalePrismaClient(client?: PrismaClient): boolean {
  if (!client) return true
  if (globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION) return true
  const c = client as PrismaClient & Record<string, unknown>
  return (
    !("estoqueImportacao" in c) ||
    !("planejamentoCompra" in c) ||
    !("userEmpresa" in c) ||
    !("devedor" in c) ||
    !("clienteAtividade" in c) ||
    !("licitacao" in c) ||
    !("empenho" in c) ||
    !("cmed" in c) ||
    !("consultaApiUsage" in c) ||
    !("promocao" in c) ||
    !("chamado" in c) ||
    !("departamento" in c)
  )
}

if (process.env.NODE_ENV !== "production" && isStalePrismaClient(globalForPrisma.prisma)) {
  void globalForPrisma.prisma?.$disconnect()
  globalForPrisma.prisma = undefined as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

// Reaproveita o client (e o pool pg) entre invocações QUENTES — inclusive em
// produção serverless, onde abrir conexão nova ao Neon a cada request era o que
// mais pesava. Em dev, o bloco acima cuida do reload por versão de schema.
globalForPrisma.prisma = prisma
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}
