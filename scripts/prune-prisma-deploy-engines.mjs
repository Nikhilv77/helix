import { readdir, realpath, unlink } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.TRAILGRAD_PRUNE_PRISMA_NATIVE !== "1") {
  process.exit(0);
}

const productionEngine = "libquery_engine-rhel-openssl-3.0.x.so.node";
const clientPackage = await realpath(resolve("node_modules/@prisma/client"));
const generatedClient = resolve(clientPackage, "../../.prisma/client");
const engines = (await readdir(generatedClient)).filter((name) => name.startsWith("libquery_engine-"));

if (!engines.includes(productionEngine)) {
  throw new Error(`Prisma production engine is missing: ${productionEngine}`);
}

for (const engine of engines) {
  if (engine !== productionEngine) {
    await unlink(resolve(generatedClient, engine));
  }
}

console.log(`Prisma deployment client contains only ${productionEngine}.`);
