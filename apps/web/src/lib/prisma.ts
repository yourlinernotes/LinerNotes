import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Keep the exact (omit-aware) client type so per-query `omit: { email: false }`
// overrides stay type-correct across the app.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Secret User fields are NEVER selected by default (defense against accidental
// serialization via `include: { user: true }` / `...user`). Routes that must
// read these for the *authenticated owner* (auth, users/me, mobile auth) opt in
// per-query with `omit: { email: false }` / `select`.
const GLOBAL_OMIT = {
  user: { passwordHash: true, email: true },
} as const;

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    // Return a dummy client during build that will error if used
    console.warn("DATABASE_URL not set, Prisma client will not work");
    return new PrismaClient({ omit: GLOBAL_OMIT });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    omit: GLOBAL_OMIT,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
