import { PrismaClient } from "@prisma/client";

/**
 * Marq AI Aggregator — Prisma client.
 *
 * In local dev we use SQLite; on Vercel we use PostgreSQL. The provider is
 * picked via `DATABASE_PROVIDER` env var (see prisma/schema.prisma).
 *
 * We cache the PrismaClient on `globalThis` to avoid exhausting DB
 * connections during Next.js hot-reload in dev and across serverless
 * invocations in production.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
