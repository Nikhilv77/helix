import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve(process.cwd(), "scripts/verify-development-database.mjs");
const directories: string[] = [];

function temporaryProject(files: Record<string, string>): string {
  const directory = mkdtempSync(resolve(tmpdir(), "trailgrad-db-check-"));
  directories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(resolve(directory, name), contents);
  }
  return directory;
}

function verify(
  cwd: string,
  requireDirect = false,
  environment: Record<string, string | undefined> = {}
) {
  return spawnSync(process.execPath, [script, ...(requireDirect ? ["--require-direct"] : [])], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: undefined, DIRECT_URL: undefined, ...environment }
  });
}

describe("development database safety check", () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
  });

  it("fails closed when .env.local has no database URL", () => {
    const result = verify(temporaryProject({ ".env.local": "VERCEL_OIDC_TOKEN=test\n" }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.local must define DATABASE_URL");
  });

  it("rejects the production database even when one URL is pooled", () => {
    const pooled =
      "postgresql://user:password@ep-production-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const direct =
      "postgresql://user:password@ep-production.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const result = verify(
      temporaryProject({
        ".env.local": `DATABASE_URL=${direct}\nDIRECT_URL=${direct}\n`,
        ".env": `DATABASE_URL=${pooled}\n`
      }),
      true
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("matches .env");
  });

  it("accepts matching pooled and direct URLs for a separate dev endpoint", () => {
    const result = verify(
      temporaryProject({
        ".env.local": [
          "DATABASE_URL=postgresql://user:password@ep-development-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
          "DIRECT_URL=postgresql://user:password@ep-development.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
        ].join("\n"),
        ".env":
          "DATABASE_URL=postgresql://user:password@ep-production-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require\n"
      }),
      true
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Development database verified");
    expect(result.stdout).not.toContain("password");
  });

  it("rejects a shell URL that would override the verified local target", () => {
    const result = verify(
      temporaryProject({
        ".env.local":
          "DATABASE_URL=postgresql://user:password@ep-development-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require\n"
      }),
      false,
      {
        DATABASE_URL:
          "postgresql://user:password@ep-production-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("shell DATABASE_URL overrides .env.local");
  });
});
