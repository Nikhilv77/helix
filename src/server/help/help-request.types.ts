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
  /** stdout/stderr from the last run, or null if they never ran it. */
  testOutput: string | null;
  /** Failing test count from the last run, or null if never run. */
  failingTests: number | null;
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

/** How long an unclaimed request stays live before a sweep retires it. */
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

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
    testOutput: context.testOutput ? context.testOutput.slice(0, TEST_OUTPUT_LIMIT) : null,
    failingTests: context.failingTests,
    hintsUsed: context.hintsUsed,
    timeSpentMs: context.timeSpentMs
  };
}
