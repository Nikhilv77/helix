import { createHash } from "node:crypto";
import type { SharedGuard } from "@/server/rate-limit/shared-guard";

const NAMESPACE = "dsa-accepted-run";
/** Long enough to reopen the debrief later in the same study session. */
const ACCEPTED_RUN_TTL_MS = 6 * 60 * 60_000;

function identity(ownerId: string, slug: string, code: string): string {
  return `${ownerId}:${slug}:${createHash("sha256").update(code).digest("hex")}`;
}

/**
 * Records that the runner accepted this exact code, so the teacher debrief is
 * given only for solutions the server verified rather than a client's claim.
 */
export function rememberAcceptedRun(
  guard: Pick<SharedGuard, "setCached">,
  ownerId: string,
  slug: string,
  code: string
): Promise<void> {
  return guard.setCached(NAMESPACE, identity(ownerId, slug, code), true, ACCEPTED_RUN_TTL_MS);
}

export async function wasAcceptedRun(
  guard: Pick<SharedGuard, "getCached">,
  ownerId: string,
  slug: string,
  code: string
): Promise<boolean> {
  return (await guard.getCached<boolean>(NAMESPACE, identity(ownerId, slug, code))) === true;
}
