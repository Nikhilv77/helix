import {
  ResumeRoastResultSchema,
  ResumeRoastStreamEventSchema,
  ResumeRoastTargetSchema,
  type ResumeRoastResult,
  type ResumeRoastStreamEvent,
  type ResumeRoastTarget
} from "./contracts";

/** Maps a fully validated result into the only semantic events exposed to clients. */
export function resumeRoastResultEvents(input: {
  roastId: string;
  replayed: boolean;
  target: ResumeRoastTarget;
  result: ResumeRoastResult;
}): ResumeRoastStreamEvent[] {
  const target = ResumeRoastTargetSchema.parse(input.target);
  const result = ResumeRoastResultSchema.parse(input.result);
  const events: ResumeRoastStreamEvent[] = [
    { type: "session", roastId: input.roastId, replayed: input.replayed, target },
    { type: "opening_roast", openingRoast: result.openingRoast },
    ...(result.spokenSummary
      ? [{ type: "spoken_summary" as const, spokenSummary: result.spokenSummary }]
      : []),
    { type: "strength", strength: result.strength },
    ...result.problems.map((problem) => ({ type: "problem" as const, problem })),
    ...(result.rewrite ? [{ type: "rewrite" as const, rewrite: result.rewrite }] : []),
    { type: "verdict", verdict: result.verdict },
    { type: "action_plan", actionPlan: result.actionPlan },
    { type: "done" }
  ];
  return events.map(validateResumeRoastStreamEvent);
}

/** Encodes one validated semantic event as standard Server-Sent Events. */
export function encodeResumeRoastStreamEvent(event: ResumeRoastStreamEvent): string {
  const parsed = validateResumeRoastStreamEvent(event);
  return `event: ${parsed.type}\ndata: ${JSON.stringify(parsed)}\n\n`;
}

export function validateResumeRoastStreamEvent(value: unknown): ResumeRoastStreamEvent {
  return ResumeRoastStreamEventSchema.parse(value);
}

/**
 * Incremental, browser-safe parser for the strict Roast SSE contract. It is
 * useful to the UI without leaking server-only implementation dependencies.
 */
export function createResumeRoastEventParser(): {
  push(chunk: string): ResumeRoastStreamEvent[];
  finish(): ResumeRoastStreamEvent[];
} {
  let buffer = "";
  let trailingCarriageReturn = false;
  return {
    push(chunk) {
      let normalized = chunk;
      if (trailingCarriageReturn) {
        // A CRLF pair may be split across network chunks. Consume the next LF
        // as the other half of that line ending instead of leaving a stray CR
        // in the next frame.
        if (normalized.startsWith("\n")) normalized = normalized.slice(1);
        buffer += "\n";
        trailingCarriageReturn = false;
      }
      normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (normalized.endsWith("\n") && chunk.endsWith("\r")) {
        buffer += normalized.slice(0, -1);
        trailingCarriageReturn = true;
      } else {
        buffer += normalized;
      }
      const events: ResumeRoastStreamEvent[] = [];
      for (;;) {
        const delimiter = buffer.indexOf("\n\n");
        if (delimiter < 0) return events;
        const frame = buffer.slice(0, delimiter);
        buffer = buffer.slice(delimiter + 2);
        if (!frame.trim()) continue;
        events.push(parseFrame(frame));
      }
    },
    finish() {
      if (trailingCarriageReturn) {
        buffer += "\n";
        trailingCarriageReturn = false;
      }
      if (!buffer.trim()) return [];
      // A complete semantic event must carry its blank-line delimiter. Treat a
      // truncated final frame as an interruption, never as usable feedback.
      throw new ResumeRoastStreamParseError("Resume Roast stream ended mid-event.");
    }
  };
}

function parseFrame(frame: string): ResumeRoastStreamEvent {
  let eventType: string | null = null;
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") eventType = value;
    else if (field === "data") data.push(value);
    else throw new ResumeRoastStreamParseError("Unsupported Resume Roast stream field.");
  }
  if (!eventType || data.length !== 1) {
    throw new ResumeRoastStreamParseError("Malformed Resume Roast stream event.");
  }

  let value: unknown;
  try {
    value = JSON.parse(data[0]!);
  } catch {
    throw new ResumeRoastStreamParseError("Malformed Resume Roast stream JSON.");
  }
  const parsed = ResumeRoastStreamEventSchema.safeParse(value);
  if (!parsed.success || parsed.data.type !== eventType) {
    throw new ResumeRoastStreamParseError("Invalid Resume Roast stream event.");
  }
  return parsed.data;
}

export class ResumeRoastStreamParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = ResumeRoastStreamParseError.name;
  }
}
