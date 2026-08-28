import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../database/prisma.service";
import { HelpRequestError, HelpRequestStatus } from "./help-request.types";

/**
 * How long one help call may run.
 *
 * A cap is a kindness in both directions: a helper who volunteered ten minutes
 * should not discover they are trapped, and a learner should not feel they are
 * imposing indefinitely. The token is minted against the remaining time, so a
 * leaked one cannot outlive the cap it enforces.
 */
export const SESSION_CAP_MS = 30 * 60_000;
/** An accepted request must begin joining promptly or return to the helper pool. */
export const CLAIM_JOIN_GRACE_MS = 2 * 60_000;
export const MAX_COLLABORATION_STATE_BYTES = 512_000;
export const HELPER_NO_SHOW_CREDIT_WAIT_MS = 2 * 60_000;
export const RATABLE_END_REASONS = ["left", "timeout", "resolved"] as const;

export type Seat = "learner" | "helper";

export interface SessionAccess {
  session: { id: string; roomName: string; startedAt: Date; endedAt: Date | null };
  seat: Seat;
  /** Milliseconds left before the cap. Always positive when access is granted. */
  remainingMs: number;
}

export interface LeaveResult {
  ended: boolean;
  /** True only for the call that moved CLAIMED -> RESOLVED. */
  resolved: boolean;
  canRate: boolean;
  request: { id: string; learnerId: string; helperId: string | null; questionSlug: string };
}

export interface SessionStatus {
  active: boolean;
  ended: boolean;
  /** Null before either participant has started the call. */
  remainingMs: number | null;
  /** True only for the poll that moved a timed-out request to RESOLVED. */
  resolved: boolean;
  canRate: boolean;
  request: { id: string; learnerId: string; helperId: string | null; questionSlug: string };
}

export interface ReconciledHelpConversation {
  id: string;
  learnerId: string;
  questionSlug: string;
}

interface LockedRequest {
  id: string;
  status: HelpRequestStatus;
  learnerId: string;
  helperId: string | null;
  questionSlug: string;
}

/**
 * The live call attached to a claimed request.
 *
 * A session exists only while somebody is on the hook: it is created the first
 * time either party joins, never at claim time, because a helper who accepts and
 * then never shows up should not leave an empty room and a started clock behind.
 */
export class HelpSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Repair conversations whose browser disappeared before it could close them.
   *
   * A helper claim with no room is released after a short grace period. A room
   * that reached the normal call cap is ended and resolved. This runs before an
   * inbox is listed, so abandoned rows cannot leave both people permanently
   * "busy" and silently suppress future notifications.
   */
  async reconcileStale(now = new Date()): Promise<ReconciledHelpConversation[]> {
    const sessionCutoff = new Date(now.getTime() - SESSION_CAP_MS);
    const claimCutoff = new Date(now.getTime() - CLAIM_JOIN_GRACE_MS);

    return this.prisma.$queryRaw<ReconciledHelpConversation[]>`
      WITH released AS (
        UPDATE "HelpRequest" AS request
        SET "status" = 'OPEN'::"HelpRequestStatus",
            "helperId" = NULL,
            "claimedAt" = NULL,
            "updatedAt" = ${now}
        WHERE request."status" = 'CLAIMED'::"HelpRequestStatus"
          AND request."claimedAt" <= ${claimCutoff}
          AND request."expiresAt" > ${now}
          AND NOT EXISTS (
            SELECT 1 FROM "HelpSession" AS session
            WHERE session."requestId" = request."id"
          )
        RETURNING request."id"
      ),
      resolved AS (
        UPDATE "HelpRequest" AS request
        SET "status" = 'RESOLVED'::"HelpRequestStatus",
            "resolvedAt" = ${now},
            "updatedAt" = ${now}
        WHERE request."status" = 'CLAIMED'::"HelpRequestStatus"
          AND EXISTS (
            SELECT 1 FROM "HelpSession" AS session
            WHERE session."requestId" = request."id"
              AND session."endedAt" IS NULL
              AND session."startedAt" <= ${sessionCutoff}
          )
        RETURNING request."id", request."learnerId", request."questionSlug"
      ),
      ended AS (
        UPDATE "HelpSession" AS session
        SET "endedAt" = ${now},
            "endedReason" = 'timeout',
            "helperWaitCreditAt" = CASE
              WHEN session."helperJoinedAt" IS NOT NULL
                AND session."learnerJoinedAt" IS NULL
                AND session."helperJoinedAt" <= ${new Date(now.getTime() - HELPER_NO_SHOW_CREDIT_WAIT_MS)}
              THEN COALESCE(session."helperWaitCreditAt", ${now})
              ELSE session."helperWaitCreditAt"
            END,
            "updatedAt" = ${now}
        FROM resolved
        WHERE session."requestId" = resolved."id"
          AND session."endedAt" IS NULL
        RETURNING session."requestId"
      )
      SELECT resolved."id", resolved."learnerId", resolved."questionSlug"
      FROM resolved
      WHERE EXISTS (SELECT 1 FROM ended WHERE ended."requestId" = resolved."id")
    `;
  }

  /**
   * Resolve the caller's seat and hand back the room, creating it on first join.
   *
   * Access is deliberately narrow: only the learner who asked and the helper who
   * claimed may enter, and only while the request is CLAIMED. Everyone else —
   * including a helper who released it, and the operator — is a stranger to this
   * room.
   */
  async join(requestId: string, userId: string): Promise<SessionAccess> {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      // First join and hand-back take this same lock. One therefore observes
      // the other's completed state instead of creating a room for an OPEN
      // request or reopening a request that already owns a room.
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");

      if (request.status !== HelpRequestStatus.CLAIMED) {
        throw new HelpRequestError("ILLEGAL_TRANSITION");
      }

      const seat: Seat | null =
        request.learnerId === userId ? "learner" : request.helperId === userId ? "helper" : null;
      if (!seat) throw new HelpRequestError("NOT_THE_HELPER");

      const session = await this.ensureSession(transaction, requestId);
      if (session.endedAt) throw new HelpRequestError("ILLEGAL_TRANSITION");

      const remainingMs = SESSION_CAP_MS - (Date.now() - session.startedAt.getTime());
      if (remainingMs <= 0) {
        const now = new Date();
        const helperWaitCredit = this.earnedNoShowCredit(session, now);
        await transaction.helpSession.updateMany({
          where: { id: session.id, endedAt: null },
          data: {
            endedAt: now,
            endedReason: "timeout",
            ...(helperWaitCredit ? { helperWaitCreditAt: now } : {})
          }
        });
        await transaction.helpRequest.update({
          where: { id: requestId },
          data: { status: HelpRequestStatus.RESOLVED, resolvedAt: now }
        });
        return null;
      }

      return { session, seat, remainingMs };
    });

    // Throwing inside the transaction would roll back the timeout cleanup.
    if (!outcome) throw new HelpRequestError("ILLEGAL_TRANSITION");
    return outcome;
  }

  /** Record a seat only after the browser has actually connected to LiveKit. */
  async connected(requestId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");
      if (request.status !== HelpRequestStatus.CLAIMED) {
        throw new HelpRequestError("ILLEGAL_TRANSITION");
      }

      const seat: Seat | null =
        request.learnerId === userId ? "learner" : request.helperId === userId ? "helper" : null;
      if (!seat) throw new HelpRequestError("NOT_THE_HELPER");

      const session = await transaction.helpSession.findUnique({ where: { requestId } });
      if (
        !session ||
        session.endedAt ||
        Date.now() - session.startedAt.getTime() >= SESSION_CAP_MS
      ) {
        throw new HelpRequestError("ILLEGAL_TRANSITION");
      }

      const { count } = await transaction.helpSession.updateMany({
        where: {
          id: session.id,
          ...(seat === "learner" ? { learnerJoinedAt: null } : { helperJoinedAt: null })
        },
        data: seat === "learner" ? { learnerJoinedAt: new Date() } : { helperJoinedAt: new Date() }
      });

      // A reconnect is successful even though the first-join timestamp remains.
      return (
        count > 0 || Boolean(seat === "learner" ? session.learnerJoinedAt : session.helperJoinedAt)
      );
    });
  }

  /**
   * Create the room, or return the one that already exists.
   *
   * `requestId` is unique on the table, and both joins hold the request row lock,
   * so the second join reads the first room after its transaction commits.
   */
  private async ensureSession(transaction: Prisma.TransactionClient, requestId: string) {
    const existing = await transaction.helpSession.findUnique({ where: { requestId } });
    if (existing) return existing;

    return transaction.helpSession.create({
      data: { requestId, roomName: `help-${requestId}` }
    });
  }

  /**
   * End a call only after proving the caller occupies one of its two seats.
   * Knowing a request UUID is never permission to disconnect its participants.
   */
  async leave(requestId: string, userId: string): Promise<LeaveResult> {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");
      if (request.learnerId !== userId && request.helperId !== userId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }

      const session = await transaction.helpSession.findUnique({ where: { requestId } });
      if (!session || session.endedAt) {
        return {
          ended: false,
          resolved: false,
          canRate: false,
          request: this.presentRequest(request)
        };
      }

      const now = new Date();
      const learnerNoShow = request.helperId === userId && this.earnedNoShowCredit(session, now);
      await transaction.helpSession.update({
        where: { id: session.id },
        data: {
          endedAt: now,
          endedReason: learnerNoShow ? "learner_no_show" : "left",
          ...(learnerNoShow ? { helperWaitCreditAt: now } : {})
        }
      });

      const resolved = request.status === HelpRequestStatus.CLAIMED;
      if (resolved) {
        await transaction.helpRequest.update({
          where: { id: requestId },
          data: { status: HelpRequestStatus.RESOLVED, resolvedAt: now }
        });
      }

      return {
        ended: true,
        resolved,
        canRate: this.canRate(session),
        request: this.presentRequest(request)
      };
    });
  }

  /**
   * Reconcile a browser with the authoritative session lifecycle.
   *
   * A JWT's expiry controls new connections; it cannot be trusted to evict an
   * already-connected participant. Polling this method keeps background tabs,
   * reconnects, and both sides of a hang-up aligned with the database cap.
   */
  async status(requestId: string, userId: string): Promise<SessionStatus> {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");
      if (request.learnerId !== userId && request.helperId !== userId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }

      const presented = this.presentRequest(request);
      const session = await transaction.helpSession.findUnique({ where: { requestId } });
      if (!session) {
        return {
          active: false,
          ended: false,
          remainingMs: null,
          resolved: false,
          canRate: false,
          request: presented
        };
      }

      if (session.endedAt) {
        return {
          active: false,
          ended: true,
          remainingMs: 0,
          resolved: false,
          canRate: this.canRate(session),
          request: presented
        };
      }

      // A safety action or another terminal request transition also owns the
      // room lifecycle, even if its best-effort session update was interrupted.
      if (request.status !== HelpRequestStatus.CLAIMED) {
        await transaction.helpSession.updateMany({
          where: { id: session.id, endedAt: null },
          data: { endedAt: new Date(), endedReason: "request_closed" }
        });
        return {
          active: false,
          ended: true,
          remainingMs: 0,
          resolved: false,
          canRate: this.canRate(session),
          request: presented
        };
      }

      const remainingMs = SESSION_CAP_MS - (Date.now() - session.startedAt.getTime());
      if (remainingMs > 0) {
        return {
          active: true,
          ended: false,
          remainingMs,
          resolved: false,
          canRate: this.canRate(session),
          request: presented
        };
      }

      const now = new Date();
      const helperWaitCredit = this.earnedNoShowCredit(session, now);
      await transaction.helpSession.updateMany({
        where: { id: session.id, endedAt: null },
        data: {
          endedAt: now,
          endedReason: "timeout",
          ...(helperWaitCredit ? { helperWaitCreditAt: now } : {})
        }
      });
      await transaction.helpRequest.update({
        where: { id: requestId },
        data: { status: HelpRequestStatus.RESOLVED, resolvedAt: now }
      });

      return {
        active: false,
        ended: true,
        remainingMs: 0,
        resolved: true,
        canRate: this.canRate(session),
        request: presented
      };
    });
  }

  /**
   * Blocking or reporting ends both halves of a live interaction. It uses a
   * terminal request state because the same pair must not be rematched through
   * a request that has already become unsafe.
   */
  async terminate(requestId: string, userId: string, reason: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");
      if (request.learnerId !== userId && request.helperId !== userId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }

      const now = new Date();
      const ended = await transaction.helpSession.updateMany({
        where: { requestId, endedAt: null },
        data: { endedAt: now, endedReason: reason }
      });

      if (request.status === HelpRequestStatus.CLAIMED) {
        await transaction.helpRequest.update({
          where: { id: requestId },
          data: { status: HelpRequestStatus.CANCELLED, closedAt: now }
        });
      }

      return ended.count > 0;
    });
  }

  /**
   * Only the learner rates, and only their own session. A helper rating the
   * person they helped would turn asking for help into something with a score
   * attached, which is the opposite of what makes people ask.
   */
  async rate(requestId: string, learnerId: string, rating: number): Promise<boolean> {
    if (rating !== 1 && rating !== 5) {
      throw new HelpRequestError("ILLEGAL_TRANSITION");
    }

    const request = await this.prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { learnerId: true }
    });

    if (!request) throw new HelpRequestError("NOT_FOUND");
    if (request.learnerId !== learnerId) throw new HelpRequestError("NOT_THE_LEARNER");

    const { count } = await this.prisma.helpSession.updateMany({
      where: {
        requestId,
        endedAt: { not: null },
        endedReason: { in: [...RATABLE_END_REASONS] },
        learnerJoinedAt: { not: null },
        helperJoinedAt: { not: null },
        learnerRating: null,
        learnerRatingSkippedAt: null
      },
      data: { learnerRating: rating }
    });

    return count > 0;
  }

  /** Latest normal conversation this learner has not answered yet. */
  async pendingRatingForLearner(learnerId: string, questionSlug: string) {
    const latest = await this.prisma.helpSession.findFirst({
      where: {
        endedAt: { not: null },
        endedReason: { in: [...RATABLE_END_REASONS] },
        learnerJoinedAt: { not: null },
        helperJoinedAt: { not: null },
        request: { is: { learnerId, questionSlug } }
      },
      select: { requestId: true, learnerRating: true, learnerRatingSkippedAt: true },
      orderBy: { endedAt: "desc" }
    });

    if (!latest || latest.learnerRating !== null || latest.learnerRatingSkippedAt !== null) {
      return null;
    }
    return { requestId: latest.requestId };
  }

  async forRequest(requestId: string) {
    return this.prisma.helpSession.findUnique({ where: { requestId } });
  }

  /** Persist the bounded Yjs room document for reconnects and later review. */
  async saveCollaborationState(
    requestId: string,
    userId: string,
    state: Uint8Array
  ): Promise<boolean> {
    if (state.byteLength > MAX_COLLABORATION_STATE_BYTES) {
      throw new HelpRequestError("ILLEGAL_TRANSITION");
    }

    return this.prisma.$transaction(async (transaction) => {
      const request = await this.lockRequest(transaction, requestId);
      if (!request) throw new HelpRequestError("NOT_FOUND");
      if (request.learnerId !== userId && request.helperId !== userId) {
        throw new HelpRequestError("NOT_THE_HELPER");
      }
      if (request.status !== HelpRequestStatus.CLAIMED) return false;

      const { count } = await transaction.helpSession.updateMany({
        where: { requestId, endedAt: null },
        data: {
          collaborationState: Buffer.from(state),
          collaborationUpdatedAt: new Date()
        }
      });
      return count > 0;
    });
  }

  private async lockRequest(
    transaction: Prisma.TransactionClient,
    requestId: string
  ): Promise<LockedRequest | null> {
    const rows = await transaction.$queryRaw<LockedRequest[]>`
      SELECT "id", "status", "learnerId", "helperId", "questionSlug"
      FROM "HelpRequest"
      WHERE "id" = ${requestId}::uuid
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private presentRequest(request: LockedRequest) {
    return {
      id: request.id,
      learnerId: request.learnerId,
      helperId: request.helperId,
      questionSlug: request.questionSlug
    };
  }

  private earnedNoShowCredit(
    session: { helperJoinedAt: Date | null; learnerJoinedAt: Date | null },
    now: Date
  ): boolean {
    return Boolean(
      session.helperJoinedAt &&
      !session.learnerJoinedAt &&
      now.getTime() - session.helperJoinedAt.getTime() >= HELPER_NO_SHOW_CREDIT_WAIT_MS
    );
  }

  private canRate(session: { learnerJoinedAt: Date | null; helperJoinedAt: Date | null }): boolean {
    return Boolean(session.learnerJoinedAt && session.helperJoinedAt);
  }
}
