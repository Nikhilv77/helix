import { describe, expect, it } from "vitest";
import { parseDiagnoseAnswerKey, type DiagnoseAnswerKey } from "@/lib/practice/diagnose";
import { loadPrepTemplates } from "./load-prep-templates";

/**
 * Format D has no mechanical grader — a root cause is a judgment. What can be
 * checked is that the artifact supports the diagnosis it claims, and that the
 * question does not give itself away.
 *
 * The leak check matters most here. In this format the answer is a sentence of
 * prose, and it is very easy to write a symptom or a prompt that already
 * contains it — at which point the question grades reading rather than
 * diagnosis.
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
  difficulty: string;
  expectedMinutes: number;
  answerKey?: unknown;
}

const templates = loadPrepTemplates<BankTemplate>("diagnose");

const PLACEHOLDER = /\b(?:todo|tbd|lorem ipsum|coming soon|placeholder)\b/i;

/** Words too common to signal a leak on their own. */
const STOPWORDS = new Set([
  "there", "that", "this", "with", "from", "into", "than", "then", "they", "them",
  "have", "been", "were", "which", "while", "because", "every", "some", "more",
  "most", "over", "under", "does", "will", "would", "could", "should", "being",
  "before", "after", "about", "still", "even", "only", "when", "what", "each"
]);

const significantWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 4 && !STOPWORDS.has(word))
  );

describe("diagnose questions across all banks", () => {
  it("spans more than one session and several chapters", () => {
    expect(new Set(templates.map((t) => t.sessionKey)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(templates.map((t) => t.chapterKey)).size).toBeGreaterThanOrEqual(3);
  });

  it("has a unique id per question", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses a spread of artifact kinds rather than only query plans", () => {
    const kinds = new Set(
      templates.map((t) => parseDiagnoseAnswerKey(t.answerKey)?.kind).filter(Boolean)
    );
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  describe.each(templates.map((t) => [t.id, t.title, t] as const))(
    "%s — %s",
    (_id, _title, template) => {
      const key = parseDiagnoseAnswerKey(template.answerKey);

      it("has a well-formed answer key", () => {
        expect(key).not.toBeNull();
      });

      it("offers more than one acceptable fix, or says why one is enough", () => {
        const { acceptableFixes } = key as DiagnoseAnswerKey;
        expect(acceptableFixes.length).toBeGreaterThanOrEqual(1);
        expect(new Set(acceptableFixes).size).toBe(acceptableFixes.length);
      });

      it("gives an artifact substantial enough to reason from", () => {
        const { body } = key as DiagnoseAnswerKey;
        // A one-line artifact is a statement, not evidence.
        expect(body.split("\n").filter((line) => line.trim()).length).toBeGreaterThanOrEqual(4);
      });

      it("does not state the root cause in the symptom or the prompt", () => {
        const { rootCause, symptom } = key as DiagnoseAnswerKey;
        const cause = significantWords(rootCause);
        for (const visible of [symptom, template.prompt]) {
          const shown = significantWords(visible);
          const shared = [...cause].filter((word) => shown.has(word));
          // Some overlap is unavoidable — both discuss the same system. A
          // majority means the answer is on screen.
          expect(shared.length / Math.max(cause.size, 1)).toBeLessThan(0.4);
        }
      });

      it("clears the seed-time audit thresholds", () => {
        expect(template.format).toBe("diagnose");
        expect(template.prompt.trim().length).toBeGreaterThanOrEqual(30);
        expect(template.objective.trim().length).toBeGreaterThanOrEqual(20);
        expect(template.explanation.trim().length).toBeGreaterThanOrEqual(40);
        expect(template.hints.length).toBeGreaterThanOrEqual(2);
        expect(template.hints.every((h) => h.trim().length >= 12)).toBe(true);
        expect(template.goodAnswerSignals.length).toBeGreaterThanOrEqual(2);
        expect(template.weakAnswerSignals.length).toBeGreaterThanOrEqual(2);
        expect(template.roles.length).toBeGreaterThan(0);
        expect(template.levels.length).toBeGreaterThan(0);
        expect(["easy", "medium", "hard"]).toContain(template.difficulty);
        expect(template.expectedMinutes).toBeGreaterThanOrEqual(2);
        expect(PLACEHOLDER.test(`${template.title} ${template.prompt} ${template.explanation}`)).toBe(
          false
        );
      });
    }
  );
});
