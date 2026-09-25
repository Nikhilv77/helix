import { Logger } from "@/server/common/logger";

const logger = new Logger("ActionTiming");

/** Actions at or above this duration log as warnings so they are easy to filter. */
export const SLOW_ACTION_MS = 2_000;

/**
 * Times one API action end to end. Logs `api.action_timing` with the action,
 * status, and duration, and exposes the duration as a `Server-Timing` header
 * so it appears in the browser's network panel.
 */
export async function timeAction(action: string, run: () => Promise<Response>): Promise<Response> {
  const startedAt = performance.now();
  let response: Response | undefined;
  try {
    response = await run();
    return response;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    const entry = {
      event: "api.action_timing",
      action,
      status: response?.status ?? 500,
      durationMs
    };
    if (durationMs >= SLOW_ACTION_MS) logger.warn(entry);
    else logger.log(entry);
    try {
      response?.headers.append("server-timing", `action;desc="${action}";dur=${durationMs}`);
    } catch {
      // Some responses (for example redirects) have immutable headers.
    }
  }
}
