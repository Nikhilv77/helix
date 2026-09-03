import { createHmac, timingSafeEqual } from "node:crypto";

const PREVIEW_TTL_MS = 20 * 60 * 1_000;
// Preview creation and confirmation can land on different server instances.
// Permit ordinary clock drift without extending the token's stated expiry.
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1_000;

export function signResumePreview(
  value: unknown,
  ownerId: string,
  secret: string,
  now = Date.now()
): { confirmationToken: string; previewExpiresAt: number } {
  const previewExpiresAt = now + PREVIEW_TTL_MS;
  return {
    confirmationToken: signature(value, ownerId, previewExpiresAt, secret),
    previewExpiresAt
  };
}

export function verifyResumePreview(
  value: unknown,
  ownerId: string,
  expiresAt: number,
  token: string,
  secret: string,
  now = Date.now()
): boolean {
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < now ||
    expiresAt > now + PREVIEW_TTL_MS + CLOCK_SKEW_TOLERANCE_MS
  ) {
    return false;
  }
  const expected = Buffer.from(signature(value, ownerId, expiresAt, secret), "hex");
  const supplied = Buffer.from(token, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function signature(value: unknown, ownerId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(canonicalJson({ ownerId, expiresAt, value }))
    .digest("hex");
}

/** Stable JSON keeps signatures valid after schema parsing reorders object keys. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}
