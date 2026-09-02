import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dsaPhases } from "@/lib/dsa/dsa";
import {
  dsaFunctionName,
  dsaStarterCode,
  supportedDsaCodeLanguages
} from "@/lib/dsa/dsa-code-templates";
import { buildTestCases, buildTestHarness } from "./code-test-harness";

const compilerDescribe =
  process.env.RUN_DSA_LOCAL_COMPILER_AUDIT === "1" ? describe : describe.skip;

/**
 * Opt-in because this compiles hundreds of generated programs. It requires
 * local `javac` and `clang++` binaries and never calls an external provider.
 */
compilerDescribe("full DSA starter compiler audit", () => {
  vi.setConfig({ testTimeout: 10 * 60 * 1000 });

  it("compiles every advertised Java and C++ starter against its authored harness", () => {
    const directory = mkdtempSync(join(tmpdir(), "trailgrad-dsa-compiler-audit-"));
    const failures: Array<{ slug: string; language: string; error: string }> = [];
    const slugFilter = new Set(
      (process.env.DSA_COMPILER_AUDIT_SLUGS ?? "").split(",").filter(Boolean)
    );

    try {
      for (const question of dsaPhases().flatMap((phase) => phase.questions)) {
        if (slugFilter.size && !slugFilter.has(question.slug)) continue;
        const testCases = buildTestCases(question.examples ?? [], question.slug);
        const functionName = dsaFunctionName(question.slug);

        for (const language of supportedDsaCodeLanguages(question.slug)) {
          if (language !== "java" && language !== "cpp") continue;
          try {
            const source = buildTestHarness(
              dsaStarterCode(question, language),
              language,
              functionName,
              testCases
            );
            if (language === "java") {
              const file = join(directory, "Main.java");
              writeFileSync(file, source);
              execFileSync("javac", [file], { cwd: directory, stdio: "pipe", timeout: 20_000 });
            } else {
              const file = join(directory, "main.cpp");
              writeFileSync(file, portableCppIncludes(source));
              execFileSync("clang++", ["-std=c++17", "-fsyntax-only", file], {
                cwd: directory,
                stdio: "pipe",
                timeout: 20_000
              });
            }
          } catch (error) {
            failures.push({
              slug: question.slug,
              language,
              error: compilerError(error)
            });
          }
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }

    expect(failures).toEqual([]);
  });
});

function portableCppIncludes(source: string): string {
  return source.replaceAll(
    "#include <bits/stdc++.h>",
    [
      "#include <algorithm>",
      "#include <cmath>",
      "#include <functional>",
      "#include <iostream>",
      "#include <map>",
      "#include <optional>",
      "#include <queue>",
      "#include <set>",
      "#include <stack>",
      "#include <string>",
      "#include <unordered_map>",
      "#include <unordered_set>",
      "#include <vector>"
    ].join("\n")
  );
}

function compilerError(error: unknown): string {
  const details = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  const stderr = details?.stderr ? String(details.stderr).trim() : "";
  const stdout = details?.stdout ? String(details.stdout).trim() : "";
  return (stderr || stdout || String(details?.message ?? error ?? "Compiler failed.")).slice(
    0,
    2_000
  );
}
