import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { parse } from "dotenv";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "trailgrad-production-migrate-"));
const environmentFile = join(temporaryDirectory, "production.env");

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 2).join(" ")} failed (exit ${result.status})`);
  }
}

try {
  run("npx", [
    "--yes",
    "vercel@59.14.0",
    "env",
    "pull",
    environmentFile,
    "--environment",
    "production",
    "--yes"
  ]);

  const productionEnvironment = parse(readFileSync(environmentFile));
  const databaseUrl = productionEnvironment.DATABASE_URL;
  const directUrl = productionEnvironment.DIRECT_URL;
  if (!databaseUrl || !directUrl) {
    throw new Error("Vercel Production must supply DATABASE_URL and DIRECT_URL");
  }
  if (
    new URL(databaseUrl).pathname !== "/trailgrad-production" ||
    new URL(directUrl).pathname !== "/trailgrad-production"
  ) {
    throw new Error("Vercel Production database name does not match trailgrad-production");
  }

  run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
