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

const PRISMA_SCHEMA_VERSION = "202606172800_chamados"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
  prismaSchemaVersion?: string
}

const connectionString = process.env.DB_URL_OFFICIAL || process.env.DATABASE_URL
const pool = new Pool({ connectionString })
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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}
