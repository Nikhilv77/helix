import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { parse } from "dotenv";

/**
 * Runs scripts/rescore-dsa-block-assessments.ts against the production
 * database, using the same credential pull and database-name check as
 * `pnpm db:migrate:production`. Dry run unless `-- --apply` is passed.
 */
const temporaryDirectory = mkdtempSync(join(tmpdir(), "trailgrad-production-rescore-"));
const environmentFile = join(temporaryDirectory, "production.env");

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
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
  if (!databaseUrl) throw new Error("Vercel Production must supply DATABASE_URL");
  if (new URL(databaseUrl).pathname !== "/trailgrad-production") {
    throw new Error("Vercel Production database name does not match trailgrad-production");
  }

  run(
    "node",
    ["--import", "tsx", "scripts/rescore-dsa-block-assessments.ts", ...process.argv.slice(2)],
    { ...process.env, DATABASE_URL: databaseUrl }
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
