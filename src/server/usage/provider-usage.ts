import { after } from "next/server";

import { Logger } from "../common/logger";

/**
 * One paid call to an outside service. Counts and timing only: never a
 * prompt, answer, audio clip, or piece of code.
 */
export interface ProviderUsage {
  kind: "text" | "speech" | "code";
  provider: string;
  model: string;
  operation: string;
  ownerId?: string | null;
  outcome: "success" | "failure";
  errorCode?: string | null;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Characters for speech, runs for code. */
  units?: number;
}

export type ProviderUsageSink = (
  events: Array<ProviderUsage & { createdAt: Date }>
) => Promise<unknown>;

const logger = new Logger("ProviderUsage");
const FLUSH_DELAY_MS = 250;
const MAX_BUFFER = 200;

let sink: ProviderUsageSink | null = null;
let buffer: Array<ProviderUsage & { createdAt: Date }> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Set once by the app container. Until then (tests, scripts) recording is a no-op. */
export function configureProviderUsageSink(next: ProviderUsageSink | null): void {
  sink = next;
}

/**
 * Queues one usage row. Writes are batched and run after the response, so
 * recording never adds latency to the call it describes, and a failed write
 * is logged and dropped rather than failing that call.
 */
export function recordProviderUsage(event: ProviderUsage): void {
  if (!sink) return;
  if (buffer.length >= MAX_BUFFER) return;
  buffer.push({
    ...event,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    inputTokens: Math.max(0, Math.round(event.inputTokens ?? 0)),
    outputTokens: Math.max(0, Math.round(event.outputTokens ?? 0)),
    units: Math.max(0, Math.round(event.units ?? 0)),
    createdAt: new Date()
  });
  try {
    // Inside a request this runs once the response is sent, and keeps a
    // serverless function alive long enough to write.
    after(flushProviderUsage);
  } catch {
    // Outside a request (cron, scripts): a short timer batches the writes.
    timer ??= setTimeout(() => void flushProviderUsage(), FLUSH_DELAY_MS);
  }
}

export async function flushProviderUsage(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!sink || !buffer.length) return;
  const events = buffer;
  buffer = [];
  try {
    await sink(events);
  } catch (error) {
    logger.warn(
      JSON.stringify({
        event: "provider.usage.write_failed",
        count: events.length,
        reason: error instanceof Error ? error.message : String(error)
      })
    );
  }
}
