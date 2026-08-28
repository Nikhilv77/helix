import { findQuestion } from "@/lib/dsa/dsa";
import type { HelpHistoryParticipant } from "@/lib/help/help-history";
import type { CodeSelection, WorkspaceTestCase } from "@/lib/help/snapshot";
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

function contextSelection(context: unknown): CodeSelection | null {
  if (!context || typeof context !== "object") return null;
  const value = (context as Record<string, unknown>).selection;
  if (!value || typeof value !== "object") return null;
  const selection = value as Record<string, unknown>;
  const fields = [
    selection.startLineNumber,
    selection.startColumn,
    selection.endLineNumber,
    selection.endColumn
  ];
  if (fields.some((field) => !Number.isInteger(field) || (field as number) < 1)) return null;
  return {
    startLineNumber: selection.startLineNumber as number,
    startColumn: selection.startColumn as number,
    endLineNumber: selection.endLineNumber as number,
    endColumn: selection.endColumn as number
  };
}

function contextTests(context: unknown): WorkspaceTestCase[] | null {
  if (!context || typeof context !== "object") return null;
  const value = (context as Record<string, unknown>).tests;
  if (!Array.isArray(value)) return null;

  const tests: WorkspaceTestCase[] = [];
  for (const candidate of value.slice(0, 6)) {
    if (!candidate || typeof candidate !== "object") return null;
    const test = candidate as Record<string, unknown>;
    if (
      !Number.isInteger(test.index) ||
      typeof test.input !== "string" ||
      typeof test.expectedOutput !== "string" ||
      typeof test.actualOutput !== "string" ||
      typeof test.passed !== "boolean" ||
      (test.error !== null && typeof test.error !== "string")
    ) {
      return null;
    }
    tests.push({
      index: test.index as number,
      input: test.input,
      expectedOutput: test.expectedOutput,
      actualOutput: test.actualOutput,
      passed: test.passed,
      error: test.error as string | null
    });
  }
  return tests;
}

/**
 * Shape one inbox item and enforce the preview/owner disclosure boundary.
 *
 * The problem and AI summary are enough for an eligible helper to decide
 * whether to claim. Learner source and raw test output are returned only after
 * the caller has selected the row from `claimedByHelper`, proving ownership.
 */
export function presentHelpInboxRequest(
  row: HelpInboxRow,
  includeWorkspace: boolean,
  learner: HelpHistoryParticipant | null = null
) {
  const question = findQuestion(row.questionSlug)?.question;
  const capturedLanguage = contextString(row.context, "language") ?? row.language;
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
    learner,
    slug: row.questionSlug,
    title: question?.title ?? row.questionSlug,
    questionPrompt: question?.problemStatement ?? question?.promptSummary ?? null,
    difficulty: question?.difficulty ?? null,
    language: capturedLanguage,
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
          language: capturedLanguage,
          testOutput: contextString(row.context, "testOutput"),
          failingTests: contextNumber(row.context, "failingTests"),
          selection: contextSelection(row.context),
          runStatus: contextString(row.context, "runStatus"),
          tests: contextTests(row.context)
        }
      : null
  };
}
