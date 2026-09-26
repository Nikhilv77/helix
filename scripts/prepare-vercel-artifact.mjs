import { copyFile, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const functionsDirectory = resolve(".vercel/output/functions");
const armEngine = "libquery_engine-linux-arm64-openssl-3.0.x.so.node";
const rhelEngine = "libquery_engine-rhel-openssl-3.0.x.so.node";
const clientPackage = await realpath(resolve("node_modules/@prisma/client"));
const generatedClient = resolve(clientPackage, "../../.prisma/client");
await copyFile(
  resolve(".vercel/prisma-engine-staging", armEngine),
  resolve(generatedClient, armEngine)
);
let removed = 0;
let prismaBundles = 0;

async function prepare(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const path = resolve(directory, entry.name);
    if (!entry.name.endsWith(".func")) {
      await prepare(path);
      continue;
    }

    const configPath = resolve(path, ".vc-config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    const rhelPath = Object.keys(config.filePathMap ?? {}).find((file) => file.endsWith(`/${rhelEngine}`));
    if (rhelPath) {
      const armPath = rhelPath.replace(rhelEngine, armEngine);
      config.filePathMap[armPath] = armPath;
      prismaBundles += 1;
    }
    for (const name of [".env", ".env.local"]) {
      if (name in (config.filePathMap ?? {})) {
        delete config.filePathMap[name];
        removed += 1;
      }
    }
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
}

await prepare(functionsDirectory);
if (prismaBundles === 0) throw new Error("No Prisma function bundles received the ARM64 engine.");
console.log(`Added both Prisma runtime engines to ${prismaBundles} function bundles; excluded ${removed} local environment files.`);
