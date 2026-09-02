import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizePredictedOutput,
  parsePredictRunAnswerKey,
  type PredictRunAnswerKey
} from "@/lib/practice/predict-run";

/**
 * Format A is only trustworthy if the authored expected output is what the code
 * actually prints. Grading compares against `expectedStdout` rather than running
 * the snippet per submission, so this suite is the thing standing between a typo
 * in an answer key and every candidate being marked wrong on a correct answer.
 *
 * It executes each snippet for real. If a question ever drifts, this fails
 * rather than the candidate.
 *
 * Every language bank runs here, not just JavaScript. Placement gates
 * `predict-run` on the candidate's language, so an unverified Java bank is not
 * a smaller problem than an unverified JavaScript one — it is the same problem
 * for whoever picked Java.
 */

interface BankTemplate {
  id: string;
  title: string;
  format?: string;
  answerKey?: unknown;
}

/** Compiles and/or runs one snippet, returning what it wrote to stdout. */
type Runner = (id: string, code: string) => string;

interface LanguageBank {
  /** Matches `answerKey.language`, which is what the placement gate filters on. */
  language: string;
  path: string;
  run: Runner;
}

const TIMEOUT_MS = 20_000;

/** One scratch directory per snippet, so C++ binaries never collide. */
function scratchDir(id: string): string {
  return mkdtempSync(join(tmpdir(), `trailgrad-${id}-`));
}

function runNode(id: string, code: string): string {
  const file = join(scratchDir(id), "snippet.mjs");
  writeFileSync(file, code);
  return execFileSync("node", [file], { encoding: "utf8", timeout: TIMEOUT_MS });
}

function runPython(id: string, code: string): string {
  const file = join(scratchDir(id), "snippet.py");
  writeFileSync(file, code);
  return execFileSync("python3", [file], { encoding: "utf8", timeout: TIMEOUT_MS });
}

/**
 * Java's single-file source mode requires the filename to match the public
 * class, so the class name is read out of the snippet rather than assumed.
 */
function runJava(id: string, code: string): string {
  const className = /public\s+class\s+(\w+)/.exec(code)?.[1];
  if (!className) {
    throw new Error(`${id}: Java snippet has no public class to name the file after`);
  }
  const file = join(scratchDir(id), `${className}.java`);
  writeFileSync(file, code);
  return execFileSync("java", [file], { encoding: "utf8", timeout: TIMEOUT_MS });
}

function runCpp(id: string, code: string): string {
  const dir = scratchDir(id);
  const source = join(dir, "snippet.cpp");
  const binary = join(dir, "snippet");
  writeFileSync(source, code);
  execFileSync("g++", ["-std=c++17", "-o", binary, source], {
    encoding: "utf8",
    timeout: TIMEOUT_MS
  });
  return execFileSync(binary, [], { encoding: "utf8", timeout: TIMEOUT_MS });
}

const LANGUAGE_BANKS: LanguageBank[] = [
  {
    language: "javascript",
    path: "src/data/prep/javascript-runtime-predict.json",
    run: runNode
  },
  { language: "python", path: "src/data/prep/python-runtime-predict.json", run: runPython },
  { language: "java", path: "src/data/prep/java-runtime-predict.json", run: runJava },
  { language: "cpp", path: "src/data/prep/cpp-runtime-predict.json", run: runCpp }
];

describe.each(LANGUAGE_BANKS)("$path", ({ language, path, run }) => {
  const bank = JSON.parse(readFileSync(path, "utf8")) as {
    bank: string;
    templates: BankTemplate[];
  };
  const predictRunTemplates = bank.templates.filter(
    (template) => template.format === "predict-run"
  );

  it("is entirely predict-run", () => {
    expect(predictRunTemplates).toHaveLength(bank.templates.length);
    expect(predictRunTemplates.length).toBeGreaterThanOrEqual(10);
  });

  it("has a unique id per question", () => {
    const ids = bank.templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The gate in `selectPracticeQuestionPlacements` reads this field. A bank
  // whose questions claim the wrong language is silently unreachable.
  it("declares its own language on every answer key", () => {
    for (const template of predictRunTemplates) {
      expect(parsePredictRunAnswerKey(template.answerKey)?.language).toBe(language);
    }
  });

  describe.each(predictRunTemplates.map((t) => [t.id, t.title, t] as const))(
    "%s — %s",
    (id, _title, template) => {
      const answerKey = parsePredictRunAnswerKey(template.answerKey);

      it("has a well-formed answer key", () => {
        expect(answerKey).not.toBeNull();
      });

      it("prints exactly what the answer key claims", () => {
        const key = answerKey as PredictRunAnswerKey;
        const actual = run(id, key.code);
        expect(normalizePredictedOutput(actual)).toBe(
          normalizePredictedOutput(key.expectedStdout)
        );
      });

      it("produces more than one line, or the prediction is trivial", () => {
        const key = answerKey as PredictRunAnswerKey;
        expect(normalizePredictedOutput(key.expectedStdout).split("\n").length).toBeGreaterThan(0);
      });
    }
  );
});
