import { config as loadEnvFile } from "dotenv";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppContainer } from "../src/server/app-container";

// Imported Prisma code may load .env first; restore the verified local database.
const localEnvironment = loadEnvFile({ path: ".env.local", override: true });
if (!localEnvironment.parsed?.DATABASE_URL) {
  throw new Error("Interview quality evaluation requires DATABASE_URL in .env.local.");
}
loadEnvFile();

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const kind = arguments_.includes("--decisions-only")
    ? "decision"
    : arguments_.includes("--scoring-only")
      ? "scoring"
      : undefined;
  if (arguments_.includes("--decisions-only") && arguments_.includes("--scoring-only")) {
    throw new Error("Choose either --decisions-only or --scoring-only, not both.");
  }
  const caseIds = arguments_
    .filter((argument) => argument.startsWith("--case="))
    .map((argument) => argument.slice("--case=".length))
    .filter(Boolean);

  const report = await getAppContainer().interviewQualityRunner.run({
    kind,
    caseIds: caseIds.length ? caseIds : undefined
  });
  const output = JSON.stringify(report, null, 2) + "\n";
  process.stdout.write(output);

  if (arguments_.includes("--write")) {
    const directory = path.resolve(process.cwd(), "output/interview-quality");
    await mkdir(directory, { recursive: true });
    const file = path.join(
      directory,
      `${report.goldSetVersion}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    await writeFile(file, output, "utf8");
    process.stderr.write(`Wrote ${path.relative(process.cwd(), file)}\n`);
  }

  if (!report.summary.passed) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Interview quality evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exitCode = 1;
});
