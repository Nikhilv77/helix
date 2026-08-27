import { findQuestion } from "@/lib/dsa/dsa";
import type { StuckSummary } from "./stuck-summary";

export interface HelpInboxRow {
  id: string;
  questionSlug: string;
  language: string;
  status: string;
  summary: string | null;
  context: unknown;
  createdAt: Date;
}

function contextNumber(context: unknown, field: string): number | null {
  if (!context || typeof context !== "object") return null;
  const value = (context as Record<string, unknown>)[field];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function contextString(context: unknown, field: string): string | null {
  if (!context || typeof context !== "object") return null;
  const value = (context as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

/**
 * Shape one inbox item and enforce the preview/owner disclosure boundary.
 *
 * The problem and AI summary are enough for an eligible helper to decide
 * whether to claim. Learner source and raw test output are returned only after
 * the caller has selected the row from `claimedByHelper`, proving ownership.
 */
export function presentHelpInboxRequest(row: HelpInboxRow, includeWorkspace: boolean) {
  const question = findQuestion(row.questionSlug)?.question;
  let summary: StuckSummary | null = null;

  if (row.summary) {
    try {
      summary = JSON.parse(row.summary) as StuckSummary;
    } catch {
      summary = null;
    }
  }

  return {
    id: row.id,
    slug: row.questionSlug,
    title: question?.title ?? row.questionSlug,
    questionPrompt: question?.problemStatement ?? question?.promptSummary ?? null,
    difficulty: question?.difficulty ?? null,
    language: row.language,
    status: row.status,
    headline: summary?.headline ?? null,
    blockedOn: summary?.blockedOn ?? null,
    understands: summary?.understands ?? [],
    opener: summary?.opener ?? null,
    estimatedMinutes: summary?.estimatedMinutes ?? null,
    failingTests: contextNumber(row.context, "failingTests"),
    hintsUsed: contextNumber(row.context, "hintsUsed") ?? 0,
    timeSpentMs: contextNumber(row.context, "timeSpentMs") ?? 0,
    askedAt: row.createdAt.getTime(),
    capturedWorkspace: includeWorkspace
      ? {
          code: contextString(row.context, "code") ?? "",
          language: row.language,
          testOutput: contextString(row.context, "testOutput"),
          failingTests: contextNumber(row.context, "failingTests")
        }
      : null
  };
}
