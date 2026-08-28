import { Prisma } from "@prisma/client";

import type { PrismaService } from "../database/prisma.service";
import {
  MIN_HELPER_ELIGIBILITY_SCORE,
  type EligibilityRequest,
  type HelperEligibilityService
} from "./helper-eligibility";
import {
  clampContext,
  DEFAULT_TTL_MS,
  HelpRequestError,
  HelpRequestStatus,
  LIVE_STATUSES,
  canTransition,
  type HelpRequestContext
} from "./help-request.types";

/** Postgres unique-violation, raised here by the one-live-request index. */
const UNIQUE_VIOLATION = "P2002";

export interface OpenHelpRequestInput {
  learnerId: string;
  questionSlug: string;
  language: string;
  context: HelpRequestContext;
  /** Overrides the default ten-minute window. Used by lifecycle tests. */
  ttlMs?: number;
}

/**
 * Lifecycle of a contextual peer-help request.
 *
 * Every transition here is guarded on the status the caller believes the
 * request is in, and performed as a single conditional UPDATE. That is the
 * whole concurrency story: two helpers pressing "Help them" at the same instant
 * both issue `UPDATE ... WHERE status = 'OPEN'`, Postgres serialises them, and
 * the loser updates zero rows and is told the request was already claimed.
 *
 * Read-then-write would need a transaction and a version column to be safe.
 * Guarding on status inside the write makes the row its own lock, which is why
 * there is no `version` field on this model.
 */
export class HelpRequestService {
  /**
   * `safety` is optional so the lifecycle can be constructed and tested without
   * it; when present, blocks are enforced on claim as well as in listings.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: { isBlocked(a: string, b: string): Promise<boolean> } | undefined,
    private readonly eligibility: Pick<HelperEligibilityService, "score" | "scoresForRequests">
  ) {}

  /**
   * Open a request. Fails with ALREADY_LIVE if this learner already has an open
   * or claimed request for the same question — enforced by a partial unique
   * index, so it holds even when two clicks race.
   */
  async open(input: OpenHelpRequestInput) {
    const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
    const now = new Date();

    // A request must be renewable at the end of its window even if no inbox or
    // status poll happened to run the general expiry sweep first.
    await this.prisma.helpRequest.updateMany({
      where: {
        learnerId: input.learnerId,
        questionSlug: input.questionSlug,
        status: HelpRequestStatus.OPEN,
        expiresAt: { lte: now }
      },
      data: { status: HelpRequestStatus.EXPIRED, closedAt: now }
    });

    try {
      return await this.prisma.helpRequest.create({
        data: {
          learnerId: input.learnerId,
          questionSlug: input.questionSlug,
          language: input.language,
          context: clampContext(input.context) as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(now.getTime() + ttl)
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new HelpRequestError("ALREADY_LIVE");
      }
      throw error;
    }
  }

  /**
   * Claim an open request for a helper.
   *
   * Returns the claimed request, or throws ALREADY_CLAIMED when another helper
   * won the race. A learner may not claim their own request.
   */
  async claim(requestId: string, helperId: string) {
    const now = new Date();
    const existing = await this.prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: {
        learnerId: true,
        questionSlug: true,
        language: true,
        status: true,
        expiresAt: true
      }
    });

    if (!existing) throw new HelpRequestError("NOT_FOUND");
    if (existing.learnerId === helperId) throw new HelpRequestError("SELF_HELP");
    if (existing.status !== HelpRequestStatus.OPEN) {
      throw new HelpRequestError("ALREADY_CLAIMED");
    }

    if (existing.expiresAt <= now) {
      await this.prisma.helpRequest.updateMany({
        where: {
          id: requestId,
          status: HelpRequestStatus.OPEN,
          expiresAt: { lte: now }
        },
        data: { status: HelpRequestStatus.EXPIRED, closedAt: now }
      });
      throw new HelpRequestError("REQUEST_EXPIRED");
    }

    if (!(await this.isQualified(helperId, existing.questionSlug, existing.language))) {
      throw new HelpRequestError("NOT_QUALIFIED");
    }
    if (!(await this.isHelperAvailable(helperId))) {
      throw new HelpRequestError("HELPER_UNAVAILABLE");
    }

    // Hiding a request is presentation; refusing the claim is the actual rule.
    // A blocked helper who kept the id from an earlier page must still be
    // stopped here.
    if (this.safety && (await this.safety.isBlocked(existing.learnerId, helperId))) {
      throw new HelpRequestError("NOT_THE_HELPER");
    }

    /*
     * This UPDATE is the authorization boundary, not merely the write.
     *
     * Every fact that permits a claim is re-proved in the same statement that
     * changes the row: the request is still open and unexpired, the helper
     * still has qualifying evidence, and neither party has blocked the other.
     * A preflight read above only chooses a helpful error; it never grants the
     * claim. That closes the gaps where an attempt, block, expiry or competing
     * claim changes between a read and the write.
     */
    let claimed: number;
    try {
      claimed = await this.prisma.$executeRaw`
        UPDATE "HelpRequest" AS request
        SET "status" = 'CLAIMED'::"HelpRequestStatus",
            "helperId" = ${helperId},
            "claimedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE request."id" = ${requestId}::uuid
          AND request."status" = 'OPEN'::"HelpRequestStatus"
          AND request."expiresAt" > CURRENT_TIMESTAMP
          AND request."learnerId" <> ${helperId}
          AND "helpHelperEligibilityScore"(
            ${helperId},
            request."questionSlug",
            request."language"
          ) > ${MIN_HELPER_ELIGIBILITY_SCORE}
          AND NOT EXISTS (
            SELECT 1 FROM "HelpRequest" AS own_request
            WHERE own_request."learnerId" = ${helperId}
              AND (own_request."status" = 'CLAIMED'::"HelpRequestStatus"
                OR (own_request."status" = 'OPEN'::"HelpRequestStatus"
                  AND own_request."expiresAt" > CURRENT_TIMESTAMP))
          )
          AND NOT EXISTS (
            SELECT 1 FROM "HelpRequest" AS active_help
            WHERE active_help."helperId" = ${helperId}
              AND active_help."status" = 'CLAIMED'::"HelpRequestStatus"
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "HelpBlock" AS block
            WHERE (block."ownerId" = request."learnerId" AND block."blockedId" = ${helperId})
               OR (block."ownerId" = ${helperId} AND block."blockedId" = request."learnerId")
          )
      `;
    } catch (error) {
      if (isClaimedHelperUniqueViolation(error)) {
        throw new HelpRequestError("HELPER_UNAVAILABLE");
      }
      throw error;
    }

    if (claimed === 0) {
      await this.throwClaimFailure(requestId, helperId);
    }

    return this.byId(requestId);
  }

  /**
   * Pass on one open request without affecting its lifecycle for other helpers.
   * The unique key makes repeated clicks and retries idempotent.
   */
  async decline(requestId: string, helperId: string) {
    const now = new Date();
    const existing = await this.prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: {
        learnerId: true,
        questionSlug: true,
        language: true,
        status: true,
        expiresAt: true
      }
    });

    if (!existing) throw new HelpRequestError("NOT_FOUND");
    if (existing.learnerId === helperId) throw new HelpRequestError("SELF_HELP");
    if (existing.status !== HelpRequestStatus.OPEN) {
      throw new HelpRequestError("ALREADY_CLAIMED");
    }
    if (existing.expiresAt <= now) {
      await this.prisma.helpRequest.updateMany({
        where: {
          id: requestId,
          status: HelpRequestStatus.OPEN,
          expiresAt: { lte: now }
        },
        data: { status: HelpRequestStatus.EXPIRED, closedAt: now }
      });
      throw new HelpRequestError("REQUEST_EXPIRED");
    }
    if (!(await this.isQualified(helperId, existing.questionSlug, existing.language))) {
      throw new HelpRequestError("NOT_QUALIFIED");
    }
    if (this.safety && (await this.safety.isBlocked(existing.learnerId, helperId))) {
      throw new HelpRequestError("NOT_THE_HELPER");
    }

    await this.prisma.helpRequestDecline.upsert({
      where: { requestId_helperId: { requestId, helperId } },
      create: { requestId, helperId },
      update: {}
    });

    return this.byId(requestId);
  }

  private async isQualified(
    helperId: string,
    questionSlug: string,
    language: string
  ): Promise<boolean> {
    return (
      (await this.eligibility.score(helperId, questionSlug, language)) >=
      MIN_HELPER_ELIGIBILITY_SCORE
    );
  }

  /** Helpers can only carry one active side of peer help at a time. */
  private async isHelperAvailable(helperId: string): Promise<boolean> {
    const [ownRequest, helping] = await Promise.all([
      this.prisma.helpRequest.findFirst({
        where: {
          learnerId: helperId,
          OR: [
            { status: HelpRequestStatus.CLAIMED },
            { status: HelpRequestStatus.OPEN, expiresAt: { gt: new Date() } }
          ]
        },
        select: { id: true }
      }),
      this.prisma.helpRequest.findFirst({
        where: { helperId, status: HelpRequestStatus.CLAIMED },
        select: { id: true }
      })
    ]);

    return ownRequest === null && helping === null;
  }

  /** Resolve why the authoritative claim UPDATE matched no row. */
  private async throwClaimFailure(requestId: string, helperId: string): Promise<never> {
    const current = await this.prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: {
        learnerId: true,
        questionSlug: true,
        language: true,
        status: true,
        expiresAt: true
      }
    });

    if (!current) throw new HelpRequestError("NOT_FOUND");
    if (current.learnerId === helperId) throw new HelpRequestError("SELF_HELP");
    if (current.status !== HelpRequestStatus.OPEN) {
      if (current.status === HelpRequestStatus.EXPIRED) {
        throw new HelpRequestError("REQUEST_EXPIRED");
      }
      throw new HelpRequestError("ALREADY_CLAIMED");
    }
    if (current.expiresAt <= new Date()) throw new HelpRequestError("REQUEST_EXPIRED");
    if (!(await this.isQualified(helperId, current.questionSlug, current.language))) {
      throw new HelpRequestError("NOT_QUALIFIED");
    }
    if (!(await this.isHelperAvailable(helperId))) {
      throw new HelpRequestError("HELPER_UNAVAILABLE");
    }
    if (this.safety && (await this.safety.isBlocked(current.learnerId, helperId))) {
      throw new HelpRequestError("NOT_THE_HELPER");
    }

    // The SQL also checks blocks when no safety adapter was supplied, so an
    // otherwise unexplained miss is still an authorization refusal.
    throw new HelpRequestError("NOT_THE_HELPER");
  }

  /**
   * A helper who accepted but cannot continue. The request returns to the pool
   * rather than stranding the learner with a helper who is never coming.
   */
  async release(requestId: string, helperId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.lockRequest(transaction, requestId);

      if (!existing) throw new HelpRequestError("NOT_FOUND");
      if (existing.status !== HelpRequestStatus.CLAIMED || existing.helperId !== helperId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }

      // HelpSession.requestId is unique, so once any room has existed this
      // request cannot safely be reassigned: the next helper would inherit an
      // ended room they cannot join. The row lock makes this check atomic with
      // first join, which takes the same lock before creating the session.
      const session = await transaction.helpSession.findUnique({
        where: { requestId },
        select: { id: true }
      });
      if (session) throw new HelpRequestError("SESSION_ALREADY_STARTED");

      await transaction.helpRequest.update({
        where: { id: requestId },
        data: { status: HelpRequestStatus.OPEN, helperId: null, claimedAt: null }
      });

      return this.byIdWith(transaction, requestId);
    });
  }

  /** Mark a claimed request as helped and close its room in one transaction. */
  async resolve(requestId: string, helperId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.lockRequest(transaction, requestId);
      if (!existing) throw new HelpRequestError("NOT_FOUND");
      if (existing.status !== HelpRequestStatus.CLAIMED || existing.helperId !== helperId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }

      const now = new Date();
      await transaction.helpRequest.update({
        where: { id: requestId },
        data: { status: HelpRequestStatus.RESOLVED, resolvedAt: now }
      });
      await transaction.helpSession.updateMany({
        where: { requestId, endedAt: null },
        data: { endedAt: now, endedReason: "resolved" }
      });

      return this.byIdWith(transaction, requestId);
    });
  }

  /** The learner withdrawing, closing an attached room in the same commit. */
  async cancel(requestId: string, learnerId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.lockRequest(transaction, requestId);
      if (!existing) throw new HelpRequestError("NOT_FOUND");
      if (
        existing.learnerId !== learnerId ||
        !LIVE_STATUSES.some((status) => status === existing.status)
      ) {
        throw new HelpRequestError("NOT_THE_LEARNER");
      }

      const now = new Date();
      await transaction.helpRequest.update({
        where: { id: requestId },
        data: { status: HelpRequestStatus.CANCELLED, closedAt: now }
      });
      await transaction.helpSession.updateMany({
        where: { requestId, endedAt: null },
        data: { endedAt: now, endedReason: "cancelled" }
      });

      return this.byIdWith(transaction, requestId);
    });
  }

  /**
   * Retire unclaimed requests past their window. Claimed ones are left alone:
   * someone is on the hook for those, and expiring them under a helper who is
   * mid-call would be worse than letting them run long.
   */
  async expireStale(now = new Date()): Promise<number> {
    const { count } = await this.prisma.helpRequest.updateMany({
      where: { status: HelpRequestStatus.OPEN, expiresAt: { lte: now } },
      data: { status: HelpRequestStatus.EXPIRED, closedAt: now }
    });

    return count;
  }

  /** Attaches the summary once it has been generated. Never blocks the ask. */
  async attachSummary(requestId: string, summary: string) {
    const updated = await this.prisma.helpRequest.updateMany({
      where: { id: requestId, status: { in: [...LIVE_STATUSES] } },
      data: { summary }
    });

    if (updated.count === 0) throw new HelpRequestError("ILLEGAL_TRANSITION");

    return this.byId(requestId);
  }

  /**
   * Open requests this helper is qualified to take.
   *
   * Exact-question proof is one qualification path, not the gate. The same
   * shared policy also recognizes same-pattern results, demonstrated interview
   * performance, and strong verified profiles.
   *
   * Stronger relevant evidence comes first; ties are oldest first so waiting
   * requests are not starved.
   */
  async openRequestsForHelper(helperId: string, limit = 20, blockedIds: string[] = []) {
    if (!(await this.isHelperAvailable(helperId))) return [];

    const now = new Date();
    const requests = await this.prisma.helpRequest.findMany({
      where: {
        status: HelpRequestStatus.OPEN,
        expiresAt: { gt: now },
        learnerId: blockedIds.length > 0 ? { notIn: [helperId, ...blockedIds] } : { not: helperId },
        declines: { none: { helperId } }
      },
      orderBy: { createdAt: "asc" },
      // Eligibility is profile-driven and therefore cannot be represented as
      // a Prisma relation filter. Bound the candidate window before the batch
      // policy call so an old table never turns one inbox load into an audit.
      take: Math.min(Math.max(limit * 20, 100), 400)
    });

    const scores = await this.eligibility.scoresForRequests(
      helperId,
      requests satisfies EligibilityRequest[]
    );

    return requests
      .filter((request) => (scores.get(request.id) ?? 0) >= MIN_HELPER_ELIGIBILITY_SCORE)
      .sort((a, b) => {
        const evidence = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        return evidence || a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, limit);
  }

  /** Requests this helper has accepted and not yet finished. */
  async claimedByHelper(helperId: string) {
    return this.prisma.helpRequest.findMany({
      where: { status: HelpRequestStatus.CLAIMED, helperId },
      orderBy: { claimedAt: "asc" }
    });
  }

  /** Unique learners this helper has completed at least one request for. */
  async helpedPeopleCount(helperId: string): Promise<number> {
    const people = await this.prisma.helpRequest.findMany({
      where: { status: HelpRequestStatus.RESOLVED, helperId },
      select: { learnerId: true },
      distinct: ["learnerId"]
    });

    // The Set also keeps lightweight test adapters honest if they do not
    // implement Prisma's `distinct` option themselves.
    return new Set(people.map((person) => person.learnerId)).size;
  }

  /**
   * Requests that just expired, returned so callers can tell the learners.
   * UPDATE ... RETURNING makes selection, transition and notification payload
   * one operation. A helper claim racing this sweep therefore wins or loses on
   * the OPEN row guard; neither operation can overwrite the other's result.
   */
  async expireStaleAndReport(now = new Date()) {
    return this.prisma.$queryRaw<Array<{ id: string; learnerId: string; questionSlug: string }>>`
      UPDATE "HelpRequest"
      SET "status" = 'EXPIRED'::"HelpRequestStatus",
          "closedAt" = ${now},
          "updatedAt" = ${now}
      WHERE "status" = 'OPEN'::"HelpRequestStatus"
        AND "expiresAt" <= ${now}
      RETURNING "id", "learnerId", "questionSlug"
    `;
  }

  /** The learner's own live request for a question, if any. */
  async liveForLearner(learnerId: string, questionSlug: string) {
    const request = await this.prisma.helpRequest.findFirst({
      where: { learnerId, questionSlug, status: { in: [...LIVE_STATUSES] } }
    });

    if (!request || request.status !== HelpRequestStatus.OPEN || request.expiresAt > new Date()) {
      return request;
    }

    // A learner checking their own request should not remain blocked by a stale
    // OPEN row merely because no helper happened to load the inbox sweep.
    const now = new Date();
    const expired = await this.prisma.helpRequest.updateMany({
      where: {
        id: request.id,
        status: HelpRequestStatus.OPEN,
        expiresAt: { lte: now }
      },
      data: { status: HelpRequestStatus.EXPIRED, closedAt: now }
    });

    if (expired.count > 0) return null;

    // A helper may have claimed between the read and the guarded expiry. Return
    // that newer live state rather than falsely telling the learner it vanished.
    return this.prisma.helpRequest.findFirst({
      where: { learnerId, questionSlug, status: { in: [...LIVE_STATUSES] } }
    });
  }

  async byId(requestId: string) {
    const request = await this.prisma.helpRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new HelpRequestError("NOT_FOUND");
    return request;
  }

  /** Lock ordering shared with first-join so release can never race room creation. */
  private async lockRequest(transaction: Prisma.TransactionClient, requestId: string) {
    const rows = await transaction.$queryRaw<
      Array<{
        id: string;
        learnerId: string;
        helperId: string | null;
        status: HelpRequestStatus;
      }>
    >`
      SELECT "id", "learnerId", "helperId", "status"
      FROM "HelpRequest"
      WHERE "id" = ${requestId}::uuid
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private async byIdWith(transaction: Prisma.TransactionClient, requestId: string) {
    const request = await transaction.helpRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new HelpRequestError("NOT_FOUND");
    return request;
  }

  /**
   * Exposed for callers that want to check a move before attempting it — the
   * writes above are already guarded, so this is for UI affordances rather than
   * for safety.
   */
  static canTransition = canTransition;
}

function isClaimedHelperUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const detail = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  return (
    (error.code === "P2002" || error.code === "P2010") &&
    (detail.includes("HelpRequest_one_claimed_per_helper_idx") || detail.includes("23505"))
  );
}
