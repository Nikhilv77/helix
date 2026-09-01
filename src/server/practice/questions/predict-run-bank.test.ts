import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
 */

interface BankTemplate {
  id: string;
  title: string;
  format?: string;
  answerKey?: unknown;
}

const BANK_PATH = "src/data/prep/javascript-runtime-predict.json";

const bank = JSON.parse(readFileSync(BANK_PATH, "utf8")) as {
  bank: string;
  templates: BankTemplate[];
};

const predictRunTemplates = bank.templates.filter(
  (template) => template.format === "predict-run"
);

function runSnippet(id: string, code: string): string {
  const file = join(tmpdir(), `trailgrad-${id}.mjs`);
  writeFileSync(file, code);
  return execFileSync("node", [file], { encoding: "utf8", timeout: 10_000 });
}

describe("javascript-runtime-predict bank", () => {
  it("is entirely predict-run", () => {
    expect(predictRunTemplates).toHaveLength(bank.templates.length);
    expect(predictRunTemplates.length).toBeGreaterThanOrEqual(10);
  });

  it("has a unique id per question", () => {
    const ids = bank.templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
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
        const actual = runSnippet(id, key.code);
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
