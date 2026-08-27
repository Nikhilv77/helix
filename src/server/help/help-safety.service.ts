import { Prisma } from "@prisma/client";

import type { PrismaService } from "../database/prisma.service";
import { HelpRequestError, HelpRequestStatus } from "./help-request.types";

/** Local for the same bundling reason as HelpRequestStatus. Mirrors schema.prisma. */
export const HelpReportReason = {
  HARASSMENT: "HARASSMENT",
  SPAM: "SPAM",
  OFF_TOPIC: "OFF_TOPIC",
  SOLUTION_DUMPING: "SOLUTION_DUMPING",
  OTHER: "OTHER"
} as const;

export type HelpReportReason = (typeof HelpReportReason)[keyof typeof HelpReportReason];

const UNIQUE_VIOLATION = "P2002";

/** Long enough to describe what happened, short enough to stay readable. */
export const REPORT_DETAIL_LIMIT = 2_000;

export interface ReportInput {
  requestId: string;
  reporterId: string;
  reason: HelpReportReason;
  detail?: string;
}

/**
 * Blocking and reporting.
 *
 * Both exist before there is a helper pool big enough to need them, on purpose:
 * the cost of adding them now is an afternoon, and the cost of adding them after
 * somebody's first bad experience is that person's trust.
 */
export class HelpSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Never be paired with this person again.
   *
   * Idempotent — pressing block twice is not an error, and surfacing one would
   * only tell somebody something about state they should not have to think
   * about.
   */
  async block(ownerId: string, blockedId: string): Promise<void> {
    if (ownerId === blockedId) throw new HelpRequestError("ILLEGAL_TRANSITION");

    try {
      await this.prisma.helpBlock.create({ data: { ownerId, blockedId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        return;
      }
      throw error;
    }
  }

  async unblock(ownerId: string, blockedId: string): Promise<void> {
    await this.prisma.helpBlock.deleteMany({ where: { ownerId, blockedId } });
  }

  /**
   * Block the other participant and end an active interaction in one commit.
   * A partial safety action must never leave somebody connected to a person the
   * UI already said was blocked.
   */
  async blockForRequest(requestId: string, ownerId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.requestParties(transaction, requestId);
      const blockedId = this.counterparty(request, ownerId);

      await transaction.helpBlock.upsert({
        where: { ownerId_blockedId: { ownerId, blockedId } },
        create: { ownerId, blockedId },
        update: {}
      });
      await this.endInteraction(transaction, request, "blocked");

      return { blockedId };
    });
  }

  /**
   * True when either has blocked the other.
   *
   * Symmetry is the point. If only the blocker's view were filtered, the blocked
   * person would keep seeing them and could infer the block from the silence —
   * and worse, could still claim their requests.
   */
  async isBlocked(a: string, b: string): Promise<boolean> {
    const found = await this.prisma.helpBlock.findFirst({
      where: {
        OR: [
          { ownerId: a, blockedId: b },
          { ownerId: b, blockedId: a }
        ]
      },
      select: { id: true }
    });

    return found !== null;
  }

  /** Everyone this person cannot be paired with, in either direction. */
  async blockedIds(ownerId: string): Promise<string[]> {
    const rows = await this.prisma.helpBlock.findMany({
      where: { OR: [{ ownerId }, { blockedId: ownerId }] },
      select: { ownerId: true, blockedId: true }
    });

    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.ownerId === ownerId ? row.blockedId : row.ownerId);
    }

    return [...ids];
  }

  /**
   * File a report against the other party on a request.
   *
   * The reported person is derived from the request rather than supplied by the
   * caller: accepting an id from the client would let anybody file a report
   * against anybody. Reporting also blocks, because someone who has just had a
   * bad enough experience to report it should not have to take a second action
   * to stop it recurring.
   */
  async report(input: ReportInput) {
    return this.prisma.$transaction(async (transaction) => {
      const request = await this.requestParties(transaction, input.requestId);
      const reportedId = this.counterparty(request, input.reporterId);

      // The request-row transaction serializes retries. Return the original
      // report instead of producing duplicate moderation work.
      const existing = await transaction.helpReport.findUnique({
        where: {
          requestId_reporterId: {
            requestId: input.requestId,
            reporterId: input.reporterId
          }
        }
      });
      const report =
        existing ??
        (await transaction.helpReport.create({
          data: {
            requestId: input.requestId,
            reporterId: input.reporterId,
            reportedId,
            reason: input.reason,
            detail: input.detail?.slice(0, REPORT_DETAIL_LIMIT) ?? null
          }
        }));

      await transaction.helpBlock.upsert({
        where: {
          ownerId_blockedId: { ownerId: input.reporterId, blockedId: reportedId }
        },
        create: { ownerId: input.reporterId, blockedId: reportedId },
        update: {}
      });
      await this.endInteraction(transaction, request, "reported");

      return report;
    });
  }

  /** Unreviewed reports, oldest first — the queue an operator works through. */
  async pendingReports(limit = 50) {
    return this.prisma.helpReport.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  }

  async markReviewed(reportId: string): Promise<boolean> {
    const { count } = await this.prisma.helpReport.updateMany({
      where: { id: reportId, reviewedAt: null },
      data: { reviewedAt: new Date() }
    });

    return count > 0;
  }

  private async requestParties(transaction: Prisma.TransactionClient, requestId: string) {
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
    const request = rows[0];
    if (!request) throw new HelpRequestError("NOT_FOUND");
    return request;
  }

  private counterparty(
    request: { learnerId: string; helperId: string | null },
    ownerId: string
  ): string {
    const other =
      request.learnerId === ownerId
        ? request.helperId
        : request.helperId === ownerId
          ? request.learnerId
          : null;

    if (!other) throw new HelpRequestError("NOT_THE_HELPER");
    return other;
  }

  private async endInteraction(
    transaction: Prisma.TransactionClient,
    request: {
      id: string;
      learnerId: string;
      helperId: string | null;
      status: HelpRequestStatus;
    },
    reason: "blocked" | "reported"
  ): Promise<void> {
    const now = new Date();
    await transaction.helpSession.updateMany({
      where: { requestId: request.id, endedAt: null },
      data: { endedAt: now, endedReason: reason }
    });

    if (request.status === HelpRequestStatus.CLAIMED) {
      await transaction.helpRequest.updateMany({
        where: {
          id: request.id,
          status: HelpRequestStatus.CLAIMED,
          learnerId: request.learnerId,
          helperId: request.helperId
        },
        data: { status: HelpRequestStatus.CANCELLED, closedAt: now }
      });
    }
  }
}
