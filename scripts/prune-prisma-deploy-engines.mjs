import { copyFile, mkdir, readdir, realpath, unlink } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.TRAILGRAD_PRUNE_PRISMA_NATIVE !== "1") {
  process.exit(0);
}

const productionEngine = "libquery_engine-rhel-openssl-3.0.x.so.node";
const armEngine = "libquery_engine-linux-arm64-openssl-3.0.x.so.node";
const clientPackage = await realpath(resolve("node_modules/@prisma/client"));
const generatedClient = resolve(clientPackage, "../../.prisma/client");
const engines = (await readdir(generatedClient)).filter((name) => name.startsWith("libquery_engine-"));

if (!engines.includes(productionEngine) || !engines.includes(armEngine)) {
  throw new Error("Prisma deployment engines are missing before the build.");
}

const stagedEngines = resolve(".vercel/prisma-engine-staging");
await mkdir(stagedEngines, { recursive: true });
await copyFile(resolve(generatedClient, armEngine), resolve(stagedEngines, armEngine));

for (const engine of engines) {
  if (engine !== productionEngine) {
    await unlink(resolve(generatedClient, engine));
  }
}

console.log(`Next.js build client contains only ${productionEngine}; staged ${armEngine} for packaging.`);
