/**
 * Format C — find-the-flaw.
 *
 * Working-looking code with exactly one planted defect. The candidate names it.
 *
 * Unlike predict-run there is no mechanical grader: "an unbounded cache" and
 * "the map is never evicted" are the same answer written two ways, and only a
 * model can see that. But the target is known, so grading is a comparison
 * against one authored defect rather than an open rubric — a far tighter
 * question to ask than "is this a good essay".
 *
 * The code and language reach the browser. The flaw, its line, and its category
 * do not, until an attempt has been submitted.
 */

export interface FindTheFlawSnippet {
  code: string;
  language: string;
}

export interface FindTheFlawAnswerKey extends FindTheFlawSnippet {
  /** The defect in one sentence, as the author would explain it. */
  flaw: string;
  /** 1-indexed line the defect lives on, for the post-submit reveal. */
  line: number;
  /** Short slug — "n-plus-one", "race-condition", "unbounded-memory". */
  category: string;
  /** What goes wrong in production if this ships. */
  consequence: string;
}

export function parseFindTheFlawAnswerKey(value: unknown): FindTheFlawAnswerKey | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const { code, language, flaw, line, category, consequence } = record;
  if (typeof code !== "string" || code.trim().length === 0) return null;
  if (typeof language !== "string" || language.trim().length === 0) return null;
  if (typeof flaw !== "string" || flaw.trim().length === 0) return null;
  if (typeof category !== "string" || category.trim().length === 0) return null;
  if (typeof consequence !== "string" || consequence.trim().length === 0) return null;
  if (!Number.isInteger(line) || (line as number) < 1) return null;
  const lineCount = code.split("\n").length;
  // A line number past the end of the snippet means the key and the code have
  // drifted apart, which would highlight nothing on the reveal.
  if ((line as number) > lineCount) return null;
  return {
    code,
    language,
    flaw,
    line: line as number,
    category,
    consequence
  };
}

/**
 * The half of the answer key that is safe to send before submission. Kept as
 * its own function for the same reason as the predict-run equivalent: dropping
 * the answer must be deliberate, not a side effect of how an object is spread.
 */
export function findTheFlawSnippet(value: unknown): FindTheFlawSnippet | null {
  const parsed = parseFindTheFlawAnswerKey(value);
  return parsed ? { code: parsed.code, language: parsed.language } : null;
}
