import { config as loadEnvFile } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Explicit shell/Vercel variables always win. For local Prisma commands, load
// .env.local first so migrations cannot silently use the production-like URL
// kept in .env. The development preflight performs the stricter identity check.
if (!process.env.DATABASE_URL) {
  loadEnvFile({ path: ".env.local" });
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Put the development Neon connection string in .env.local."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --project tsconfig.seed.json prisma/seed.ts"
  },
  engine: "classic",
  datasource: {
    // Prefer a direct Neon connection for migrations/admin tools when one is
    // supplied. Existing Vercel environments without DIRECT_URL continue to
    // use DATABASE_URL exactly as before.
    url: process.env.DIRECT_URL || env("DATABASE_URL")
  }
});
