import { createHash } from "node:crypto";

/** One representation for editor runs and fenced interview submissions. */
export function canonicalCode(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function codeFingerprint(value: string): string {
  return createHash("sha256").update(canonicalCode(value), "utf8").digest("hex");
}

export function fencedCodeFingerprint(answer: string): string | null {
  const match = answer.match(/```(?:javascript|python|cpp|java)?\n([\s\S]*?)```/i);
  return match ? codeFingerprint(match[1]!) : null;
}
