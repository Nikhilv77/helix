"use client";

import { SessionLoadingScreen } from "./session-state";

/**
 * Route-level fallback for the voice room. It is the same "Preparing your
 * interview" screen the client shows while it loads the session, so opening
 * an interview reads as one continuous step instead of a skeleton flash.
 */
export function PreparingInterviewScreen() {
  return <SessionLoadingScreen error={null} onRetry={() => undefined} />;
}
