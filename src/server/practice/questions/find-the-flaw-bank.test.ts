import { describe, expect, it } from "vitest";
import {
  parseFindTheFlawAnswerKey,
  type FindTheFlawAnswerKey
} from "@/lib/practice/find-the-flaw";
import { loadPrepTemplates } from "./load-prep-templates";

/**
 * Format C cannot be verified by execution — a planted N+1 or race condition is
 * a judgment, not an assertion. What can be checked mechanically is that the
 * answer key is internally consistent with the snippet it describes, and that
 * every question clears the same bar `prep-bank-audit.ts` enforces at seed time.
 *
 * The line check matters most: the reveal highlights `answerKey.line`, so a key
 * that drifts from its code silently points the candidate at the wrong row.
 */

interface BankTemplate {
  id: string;
  title: string;
  format?: string;
  prompt: string;
  objective: string;
  explanation: string;
  hints: string[];
  goodAnswerSignals: string[];
  weakAnswerSignals: string[];
  roles: string[];
  levels: string[];
  chapterKey?: string;
  sessionKey?: string;
  competency: string;
  difficulty: string;
  expectedMinutes: number;
  answerKey?: unknown;
  promptTemplate?: string;
}

const templates = loadPrepTemplates<BankTemplate>("find-the-flaw");

const PLACEHOLDER = /\b(?:todo|tbd|lorem ipsum|coming soon|placeholder)\b/i;

describe("find-the-flaw questions across all banks", () => {
  it("spans more than one session now that LLD uses this format too", () => {
    expect(new Set(templates.map((t) => t.sessionKey)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(templates.map((t) => t.chapterKey)).size).toBeGreaterThanOrEqual(4);
  });

  it("has a unique id per question", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(templates.map((t) => [t.id, t.title, t] as const))(
    "%s — %s",
    (_id, _title, template_) => {
      const key = parseFindTheFlawAnswerKey(template_.answerKey);

      it("has a well-formed answer key", () => {
        expect(key).not.toBeNull();
      });

      it("points at a line that exists and is not blank", () => {
        const { code, line } = key as FindTheFlawAnswerKey;
        const lines = code.split("\n");
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lines.length);
        expect(lines[line - 1]?.trim()).not.toBe("");
      });

      it("clears the seed-time audit thresholds", () => {
        expect(template_.format).toBe("find-the-flaw");
        expect(template_.prompt.trim().length).toBeGreaterThanOrEqual(30);
        expect(template_.objective.trim().length).toBeGreaterThanOrEqual(20);
        expect(template_.explanation.trim().length).toBeGreaterThanOrEqual(40);
        expect(template_.hints.length).toBeGreaterThanOrEqual(2);
        expect(template_.hints.every((h) => h.trim().length >= 12)).toBe(true);
        expect(template_.goodAnswerSignals.length).toBeGreaterThanOrEqual(2);
        expect(template_.weakAnswerSignals.length).toBeGreaterThanOrEqual(2);
        expect(template_.roles.length).toBeGreaterThan(0);
        expect(template_.levels.length).toBeGreaterThan(0);
        expect(["easy", "medium", "hard"]).toContain(template_.difficulty);
        expect(Number.isInteger(template_.expectedMinutes)).toBe(true);
        expect(template_.expectedMinutes).toBeGreaterThanOrEqual(2);
      });

      it("contains no placeholder copy", () => {
        const text = [
          template_.title,
          template_.prompt,
          template_.objective,
          template_.explanation
        ].join(" ");
        expect(PLACEHOLDER.test(text)).toBe(false);
      });

      it("keeps promptTemplate describing the same question as prompt", () => {
        // A promptTemplate is a reframing of `prompt`, not a different question.
        // Writing them independently let a template drift onto the wrong
        // question entirely — the code said N+1 while the prose described a
        // regex. Requiring heavy word overlap makes that impossible.
        const template = template_.promptTemplate;
        if (!template) return;

        const words = (text: string) =>
          new Set(
            text
              .toLowerCase()
              .replace(/\{\{\w+\}\}/g, " ")
              .split(/[^a-z0-9]+/)
              .filter((word) => word.length > 3)
          );

        const base = words(template_.prompt);
        const shared = [...words(template)].filter((word) => base.has(word));
        const overlap = shared.length / Math.max(base.size, 1);
        expect(overlap).toBeGreaterThan(0.7);
      });

      it("leaves no unrendered slot syntax in the plain prompt", () => {
        expect(template_.prompt).not.toMatch(/\{\{|\}\}/);
      });

      it("does not name the defect in the prompt", () => {
        // The prompt is the only prose the candidate sees before answering. If
        // it states the defect, the question grades reading comprehension.
        //
        // Only the prompt is checked, not the code: a category slug like
        // "sequential-await" shares words with the language itself, and the
        // snippet must be free to use them.
        const { category, flaw } = key as FindTheFlawAnswerKey;
        const prompt = template_.prompt.toLowerCase();
        expect(prompt).not.toContain(category.replace(/-/g, " "));
        expect(prompt).not.toContain(flaw.toLowerCase());
      });
    }
  );
});
