import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const HOBBY_FUNCTION_LIMIT = 12;
const functionsDirectory = resolve(".vercel/output/functions");

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

const relativeBundles = bundles.map((path) => path.slice(functionsDirectory.length + 1)).sort();

console.log(
  `Vercel output contains ${relativeBundles.length}/${HOBBY_FUNCTION_LIMIT} physical function bundles.`
);

for (const bundle of relativeBundles) {
  console.log(`- ${bundle}`);
}

if (relativeBundles.length > HOBBY_FUNCTION_LIMIT) {
  console.error(
    `Deployment stopped: ${relativeBundles.length} functions exceed the Hobby limit of ${HOBBY_FUNCTION_LIMIT}.`
  );
  process.exit(1);
}
