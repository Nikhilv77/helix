import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { parse } from "dotenv";

// Publishes approved Architecture scenarios to the production database. The
// URL is pulled from Vercel Production into a temporary file, never .env.local.
const temporaryDirectory = mkdtempSync(join(tmpdir(), "trailgrad-production-publish-"));
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
  const scenarioArguments = process.argv.slice(2);
  if (
    scenarioArguments.length === 0 ||
    scenarioArguments.some((argument) => !argument.startsWith("--scenario="))
  ) {
    throw new Error("Pass the scenarios to publish as --scenario=<key>.");
  }

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

  run(
    "pnpm",
    ["exec", "tsx", "scripts/architecture-design-publish.ts", "--production", ...scenarioArguments],
    {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl,
      TRAILGRAD_PUBLISH_TARGET: "production"
    }
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
