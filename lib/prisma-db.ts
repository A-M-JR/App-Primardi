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

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DB_URL_OFFICIAL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
