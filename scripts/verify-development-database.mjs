import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";
import { parse } from "dotenv";

const LOCAL_ENV_PATH = ".env.local";
const COMPARISON_FILES = [".env", ".vercel/.env.production.local"];

function readEnvironment(path) {
  return existsSync(path) ? parse(readFileSync(path)) : {};
}

function fail(message) {
  process.stderr.write(`Development database check failed: ${message}\n`);
  process.exitCode = 1;
}

const localEnvironment = readEnvironment(LOCAL_ENV_PATH);
const databaseUrl = localEnvironment.DATABASE_URL?.trim();
const directUrl = localEnvironment.DIRECT_URL?.trim();
const requireDirect = process.argv.includes("--require-direct");
const ambientDatabaseUrl = process.env.DATABASE_URL?.trim();
const ambientDirectUrl = process.env.DIRECT_URL?.trim();

function parsePostgresUrl(value, variableName) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${variableName} in .env.local is not a valid URL.`);
    return null;
  }
  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    fail(`${variableName} in .env.local must use the PostgreSQL protocol.`);
    return null;
  }
  return parsed;
}

function databaseIdentity(url) {
  return `${url.hostname.replace("-pooler.", ".")}${url.pathname}`.toLowerCase();
}

if (!databaseUrl) {
  fail(".env.local must define DATABASE_URL before any local app or database command can run.");
} else {
  const parsed = parsePostgresUrl(databaseUrl, "DATABASE_URL");
  const parsedDirect = directUrl ? parsePostgresUrl(directUrl, "DIRECT_URL") : null;
  if (ambientDatabaseUrl && ambientDatabaseUrl !== databaseUrl) {
    fail("The shell DATABASE_URL overrides .env.local; unset it before local development.");
  }
  if (ambientDirectUrl && ambientDirectUrl !== directUrl) {
    fail("The shell DIRECT_URL overrides .env.local; unset it before local database commands.");
  }
  if (requireDirect && !directUrl) {
    fail(
      "DIRECT_URL is required for migrations and Prisma Studio. Copy the non-pooled dev URL from Neon."
    );
  }
  if (parsed && parsedDirect && databaseIdentity(parsed) !== databaseIdentity(parsedDirect)) {
    fail("DATABASE_URL and DIRECT_URL do not point to the same development database.");
  }

  const matchingFile = parsed
    ? COMPARISON_FILES.find((path) => {
        const comparison = readEnvironment(path);
        return [comparison.DATABASE_URL, comparison.DIRECT_URL].some((value) => {
          if (!value?.trim()) return false;
          try {
            return databaseIdentity(new URL(value.trim())) === databaseIdentity(parsed);
          } catch {
            return false;
          }
        });
      })
    : undefined;
  if (matchingFile) {
    fail(`The database in .env.local matches ${matchingFile}; refusing to target production.`);
  }

  if (!process.exitCode && parsed) {
    const endpoint = createHash("sha256").update(parsed.hostname).digest("hex").slice(0, 10);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(default)";
    process.stdout.write(
      `Development database verified: endpoint ${endpoint}, database ${database}.\n`
    );
  }
}
