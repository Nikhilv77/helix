import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { Logger } from "@/server/common/logger";

const logger = new Logger("RequestAuth");

/** Reuse Clerk's user lookup across layouts and pages in one render request. */
export const getUserIdForRequest = cache(async () => {
  const startedAt = Date.now();
  const userId = (await auth()).userId;
  if (Date.now() - startedAt >= 1_000) {
    logger.warn({ event: "request_auth_slow", durationMs: Date.now() - startedAt });
  }
  return userId;
});
