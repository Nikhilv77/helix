/**
 * Format A — predict-run.
 *
 * The candidate reads code, commits to what it prints, and only then does it
 * execute. Grading is a string comparison against the authored expected output,
 * so no rubric and no model judgment are involved: the runtime is the grader.
 *
 * Shared by the server evaluator and the workspace so a prediction is compared
 * the same way in both places. If these ever diverge, a candidate sees "correct"
 * in the UI and "incorrect" in their report.
 */

export interface PredictRunSnippet {
  code: string;
  language: string;
}

export interface PredictRunAnswerKey extends PredictRunSnippet {
  expectedStdout: string;
}

/**
 * Comparison is deliberately forgiving about whitespace and strict about
 * everything else. A candidate who writes the right lines with a trailing
 * newline, a stray space, or CRLF endings understood the runtime; a candidate
 * who writes the lines in the wrong order did not.
 */
export function normalizePredictedOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function predictionMatches(predicted: string, expected: string): boolean {
  return normalizePredictedOutput(predicted) === normalizePredictedOutput(expected);
}

/** Narrows an authored `answerKey` to Format A's shape. */
export function parsePredictRunAnswerKey(value: unknown): PredictRunAnswerKey | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const { code, language, expectedStdout } = record;
  if (typeof code !== "string" || code.trim().length === 0) return null;
  if (typeof language !== "string" || language.trim().length === 0) return null;
  if (typeof expectedStdout !== "string") return null;
  return { code, language, expectedStdout };
}

/**
 * The half of the answer key that is safe to send to the browser. Keeping this
 * as its own function makes the omission of `expectedStdout` deliberate rather
 * than something a future refactor can quietly undo by spreading the object.
 */
export function predictRunSnippet(value: unknown): PredictRunSnippet | null {
  const parsed = parsePredictRunAnswerKey(value);
  return parsed ? { code: parsed.code, language: parsed.language } : null;
}
