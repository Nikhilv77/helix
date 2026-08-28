/**
 * Declared here rather than imported from `@prisma/client`.
 *
 * Prisma's generated enums are runtime *values*, not just types, and Next's
 * bundler does not reliably carry them into an SSR chunk — the import resolves
 * to undefined at module evaluation, which crashes the transition table below
 * before a single request is served. Types alone are erased and would be safe;
 * values are not.
 *
 * The shape is identical to the generated enum, so Prisma still accepts these
 * where a `HelpRequestStatus` column is written. Keep the two in step: this
 * mirrors the enum in schema.prisma.
 */
export const HelpRequestStatus = {
  OPEN: "OPEN",
  CLAIMED: "CLAIMED",
  RESOLVED: "RESOLVED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
} as const;

export type HelpRequestStatus = (typeof HelpRequestStatus)[keyof typeof HelpRequestStatus];

/**
 * The workspace snapshot attached to a request.
 *
 * Captured once, when the learner asks. A helper who accepts twenty minutes
 * later has to see the state that prompted the question — by then the learner
 * has usually kept editing, and reading their live buffer would show a problem
 * nobody asked about.
 */
export interface HelpRequestContext {
  /** The learner's code at the moment of asking. Truncated to CODE_LIMIT. */
  code: string;
  /** Language paired with that captured source. It remains fixed for the room. */
  language?: string;
  /** stdout/stderr from the last run, or null if they never ran it. */
  testOutput: string | null;
  /** Failing test count from the last run, or null if never run. */
  failingTests: number | null;
  /** Bounded visible case details used by the room's results column. */
  runStatus?: string | null;
  tests?: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error: string | null;
  }> | null;
  /** Cursor or selected code range when the learner asked. */
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
  /** How many AI hints they had already taken. High counts mean AI did not land. */
  hintsUsed: number;
  /** Time on this problem before asking. */
  timeSpentMs: number;
}

/**
 * Snapshots are stored as JSONB and a pasted solution can be enormous, so the
 * code is capped. The tail is what matters least — the top of the file carries
 * the structure a helper needs to orient.
 */
export const CODE_LIMIT = 20_000;
export const TEST_OUTPUT_LIMIT = 4_000;

/** One ask window: after this the learner may send a fresh request. */
export const DEFAULT_TTL_MS = 10 * 60_000;

/**
 * Legal transitions.
 *
 * OPEN and CLAIMED are the only live states. Everything else is terminal, and a
 * terminal request is history — the service refuses to move one again rather
 * than letting a late callback resurrect a resolved request.
 *
 * CLAIMED can fall back to OPEN only before a session starts: a helper who
 * accepts and then backs out must return the request to the pool, but a request
 * with a room already attached can never be handed to a different helper.
 */
export const TRANSITIONS: Record<HelpRequestStatus, readonly HelpRequestStatus[]> = {
  [HelpRequestStatus.OPEN]: [
    HelpRequestStatus.CLAIMED,
    HelpRequestStatus.CANCELLED,
    HelpRequestStatus.EXPIRED
  ],
  [HelpRequestStatus.CLAIMED]: [
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.OPEN,
    HelpRequestStatus.CANCELLED
  ],
  [HelpRequestStatus.RESOLVED]: [],
  [HelpRequestStatus.EXPIRED]: [],
  [HelpRequestStatus.CANCELLED]: []
};

export const LIVE_STATUSES = [HelpRequestStatus.OPEN, HelpRequestStatus.CLAIMED] as const;

export function isTerminal(status: HelpRequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: HelpRequestStatus, to: HelpRequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Why a lifecycle call did not do what was asked. */
export type HelpRequestFailure =
  | "NOT_FOUND"
  | "ALREADY_CLAIMED"
  | "ALREADY_LIVE"
  | "ENGAGEMENT_ACTIVE"
  | "NOT_QUALIFIED"
  | "HELPER_UNAVAILABLE"
  | "SESSION_ALREADY_STARTED"
  | "NOT_THE_HELPER"
  | "NOT_THE_LEARNER"
  | "REQUEST_EXPIRED"
  | "ILLEGAL_TRANSITION"
  | "SELF_HELP";

export class HelpRequestError extends Error {
  constructor(readonly reason: HelpRequestFailure) {
    super(reason);
    this.name = "HelpRequestError";
  }
}

export function clampContext(context: HelpRequestContext): HelpRequestContext {
  return {
    code: context.code.slice(0, CODE_LIMIT),
    ...(context.language ? { language: context.language.slice(0, 40) } : {}),
    testOutput: context.testOutput ? context.testOutput.slice(0, TEST_OUTPUT_LIMIT) : null,
    failingTests: context.failingTests,
    runStatus: context.runStatus?.slice(0, 160) ?? null,
    tests:
      context.tests?.slice(0, 6).map((test, index) => ({
        index: Number.isInteger(test.index) && test.index >= 0 ? test.index : index,
        input: test.input.slice(0, 180),
        expectedOutput: test.expectedOutput.slice(0, 180),
        actualOutput: test.actualOutput.slice(0, 180),
        passed: test.passed,
        error: test.error?.slice(0, 180) ?? null
      })) ?? null,
    selection: context.selection ?? null,
    hintsUsed: context.hintsUsed,
    timeSpentMs: context.timeSpentMs
  };
}
