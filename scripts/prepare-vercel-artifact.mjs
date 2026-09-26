import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const functionsDirectory = resolve(".vercel/output/functions");
let removed = 0;

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
console.log(`Excluded ${removed} local environment files from Vercel function bundles.`);
