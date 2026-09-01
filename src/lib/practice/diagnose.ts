/**
 * Format D — diagnose.
 *
 * The candidate is handed the artifact a real engineer would get — a query
 * plan, a request waterfall, a log excerpt, a latency series — plus the symptom
 * someone reported, and asked what is actually wrong.
 *
 * This is the format for everything that cannot be executed. Databases,
 * networking and capacity questions have no snippet to run and no line to
 * point at; the evidence *is* the question. Grading works the same way as
 * find-the-flaw: the planted root cause is known, so the model is asked whether
 * the candidate reached it rather than whether they wrote a good essay.
 *
 * The artifact and the symptom reach the browser. The root cause and the
 * accepted fixes do not, until an attempt has been submitted.
 */

export type DiagnoseArtifactKind = "query-plan" | "waterfall" | "log" | "metrics";

const ARTIFACT_KINDS: readonly string[] = ["query-plan", "waterfall", "log", "metrics"];

export interface DiagnoseArtifact {
  /** The evidence itself, rendered monospaced and preserved verbatim. */
  body: string;
  kind: DiagnoseArtifactKind;
  /** What was reported — the operational complaint, not the cause. */
  symptom: string;
}

export interface DiagnoseAnswerKey extends DiagnoseArtifact {
  /** The single cause the artifact actually demonstrates. */
  rootCause: string;
  /**
   * Fixes that count as correct. More than one is usually defensible — an index
   * or a query rewrite can both be right — and a candidate naming any of them
   * has understood the cause.
   */
  acceptableFixes: string[];
}

export function parseDiagnoseAnswerKey(value: unknown): DiagnoseAnswerKey | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const { body, kind, symptom, rootCause, acceptableFixes } = record;
  if (typeof body !== "string" || body.trim().length === 0) return null;
  if (typeof kind !== "string" || !ARTIFACT_KINDS.includes(kind)) return null;
  if (typeof symptom !== "string" || symptom.trim().length === 0) return null;
  if (typeof rootCause !== "string" || rootCause.trim().length === 0) return null;
  if (!Array.isArray(acceptableFixes) || acceptableFixes.length === 0) return null;
  if (!acceptableFixes.every((fix) => typeof fix === "string" && fix.trim().length > 0)) {
    return null;
  }
  return {
    body,
    kind: kind as DiagnoseArtifactKind,
    symptom,
    rootCause,
    acceptableFixes: acceptableFixes as string[]
  };
}

/**
 * The half of the answer key that is safe to send before submission. Its own
 * function, for the same reason as the other two formats: omitting the answer
 * has to be deliberate, not a property of how an object happens to be spread.
 */
export function diagnoseArtifact(value: unknown): DiagnoseArtifact | null {
  const parsed = parseDiagnoseAnswerKey(value);
  return parsed ? { body: parsed.body, kind: parsed.kind, symptom: parsed.symptom } : null;
}
