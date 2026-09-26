import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const functionsDirectory = resolve(".vercel/output/functions");
const HOBBY_FUNCTION_LIMIT = 12;
// API and server-rendered page functions require different Prisma targets.
const productionPrismaEngines = [
  "libquery_engine-rhel-openssl-3.0.x.so.node",
  "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
];

async function findFunctionBundles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const bundles = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const path = resolve(directory, entry.name);
    if (entry.name.endsWith(".func")) {
      bundles.push(path);
      continue;
    }

    bundles.push(...(await findFunctionBundles(path)));
  }

  return bundles;
}

let bundles;

try {
  bundles = await findFunctionBundles(functionsDirectory);
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    console.error("Vercel build output is missing. Run `vercel build --prod` first.");
    process.exit(1);
  }

  throw error;
}

let prismaBundleCount = 0;
const missingEngines = [];

for (const bundle of bundles) {
  const config = JSON.parse(await readFile(resolve(bundle, ".vc-config.json"), "utf8"));
  const files = Object.keys(config.filePathMap ?? {});

  if (files.includes(".env") || files.includes(".env.local")) {
    console.error(`Deployment stopped: local environment files are bundled in ${bundle}.`);
    process.exit(1);
  }

  if (!files.some((file) => file.includes("/.prisma/client/index.js"))) {
    continue;
  }

  prismaBundleCount += 1;
  if (productionPrismaEngines.some((engine) => !files.some((file) => file.endsWith(`/${engine}`)))) {
    missingEngines.push(
      `${bundle.slice(functionsDirectory.length + 1)} (${config.architecture ?? "unknown architecture"})`
    );
  }
}

console.log(`Vercel output contains ${bundles.length} route bundles; checked ${prismaBundleCount} Prisma bundles.`);

if (bundles.length > HOBBY_FUNCTION_LIMIT) {
  console.error(
    `Deployment stopped: ${bundles.length} functions exceed the Hobby limit of ${HOBBY_FUNCTION_LIMIT}.`
  );
  process.exit(1);
}

if (prismaBundleCount === 0 || missingEngines.length > 0) {
  console.error(
    prismaBundleCount === 0
      ? "Deployment stopped: no Prisma bundles were found in the Vercel output."
      : `Deployment stopped: the production Prisma engine is missing from:\n${missingEngines.join("\n")}`
  );
  process.exit(1);
}
