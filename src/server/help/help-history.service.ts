import { Prisma } from "@prisma/client";

import type {
  ActivePeerHelp,
  CurrentPeerHelpEngagement,
  HelpDashboardOverview,
  HelpHistoryFilter,
  HelpHistoryItem,
  HelpHistoryPage,
  HelpHistoryParticipant,
  HelpHistorySide,
  HelpOverview,
  TopPeerHelper
} from "@/lib/help/help-history";
import type { PrismaService } from "../database/prisma.service";
import { presentHelpParticipant } from "./help-participant";
import { HelpRequestStatus } from "./help-request.types";

export const HELP_HISTORY_DEFAULT_LIMIT = 10;
export const HELP_HISTORY_MAX_LIMIT = 25;
const TOP_HELPERS_CACHE_MS = 45_000;
const TOP_HELPERS_CACHE_LIMIT = 10;

interface OverviewCountsRow {
  helpReceived: number;
  peopleHelped: number;
  activeReceived: number;
  activeGiven: number;
  positiveHelps: number;
  availabilityCredits: number;
}

interface TopHelperAggregateRow {
  helperId: string;
  helpedCount: number;
  thankedCount: number;
}

interface HelpPollingStatusRow {
  invitationCount: number;
  latestInvitationAt: Date | null;
  engagementCount: number;
  latestEngagementAt: Date | null;
}

interface HistoryCursor {
  createdAt: string;
  id: string;
}

export class InvalidHelpHistoryCursorError extends Error {}

export class HelpHistoryService {
  private topHelpersCache: { expiresAt: number; helpers: TopPeerHelper[] } | null = null;
  private topHelpersInFlight: Promise<TopPeerHelper[]> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cheap change token for the 15-second urgent-help loop.
   *
   * Invitation rows were already materialized when the learner asked, so this
   * avoids rerunning matching, inbox presentation, profile hydration, and
   * active-session reconciliation when nothing changed.
   */
  async pollingStatus(ownerId: string): Promise<{ version: string }> {
    const rows = await this.prisma.$queryRaw<HelpPollingStatusRow[]>(Prisma.sql`
      WITH invitations AS (
        SELECT
          COUNT(*)::int AS "invitationCount",
          MAX(notification."createdAt") AS "latestInvitationAt"
        FROM "Notification" notification
        WHERE notification."ownerId" = ${ownerId}
          AND notification."kind" = 'HELP_REQUEST_OPENED'::"NotificationKind"
      ),
      engagements AS (
        SELECT
          COUNT(*)::int AS "engagementCount",
          MAX(request."updatedAt") AS "latestEngagementAt"
        FROM "HelpRequest" request
        WHERE request."learnerId" = ${ownerId}
           OR request."helperId" = ${ownerId}
      )
      SELECT invitations.*, engagements.*
      FROM invitations
      CROSS JOIN engagements
    `);
    const row = rows[0] ?? {
      invitationCount: 0,
      latestInvitationAt: null,
      engagementCount: 0,
      latestEngagementAt: null
    };

    return {
      version: [
        row.invitationCount,
        row.latestInvitationAt?.getTime() ?? 0,
        row.engagementCount,
        row.latestEngagementAt?.getTime() ?? 0
      ].join(":")
    };
  }

  async overview(ownerId: string): Promise<HelpOverview> {
    const [counts, activeConversation, topHelpers, viewer] = await Promise.all([
      this.overviewCounts(ownerId),
      this.activeConversation(ownerId),
      this.topHelpers(),
      this.participant(ownerId)
    ]);

    return {
      viewer,
      ...counts,
      activeConversation,
      topHelpers
    };
  }

  /** Lightweight read for the home dashboard; skips rankings and recognition queries. */
  async dashboardOverview(ownerId: string): Promise<HelpDashboardOverview> {
    const [counts, activeConversation] = await Promise.all([
      this.overviewCounts(ownerId),
      this.activeConversation(ownerId)
    ]);

    return {
      helpReceived: counts.helpReceived,
      peopleHelped: counts.peopleHelped,
      activeConversation
    };
  }

  /** All recognition counters for one person in one database round trip. */
  private async overviewCounts(ownerId: string): Promise<OverviewCountsRow> {
    const rows = await this.prisma.$queryRaw<OverviewCountsRow[]>(Prisma.sql`
      WITH request_counts AS (
        SELECT
          COUNT(*) FILTER (WHERE request."learnerId" = ${ownerId})::int AS "helpReceived",
          COUNT(DISTINCT request."learnerId") FILTER (
            WHERE request."helperId" = ${ownerId}
              AND request."status" = 'RESOLVED'::"HelpRequestStatus"
          )::int AS "peopleHelped",
          COUNT(*) FILTER (
            WHERE request."learnerId" = ${ownerId}
              AND request."status" IN (
                'OPEN'::"HelpRequestStatus",
                'CLAIMED'::"HelpRequestStatus"
              )
          )::int AS "activeReceived",
          COUNT(*) FILTER (
            WHERE request."helperId" = ${ownerId}
              AND request."status" = 'CLAIMED'::"HelpRequestStatus"
          )::int AS "activeGiven"
        FROM "HelpRequest" request
        WHERE request."learnerId" = ${ownerId}
           OR request."helperId" = ${ownerId}
      ),
      session_counts AS (
        SELECT
          COUNT(*) FILTER (
            WHERE session."learnerRating" = 5
              AND session."learnerJoinedAt" IS NOT NULL
              AND session."helperJoinedAt" IS NOT NULL
          )::int AS "positiveHelps",
          COUNT(*) FILTER (
            WHERE session."helperWaitCreditAt" IS NOT NULL
          )::int AS "availabilityCredits"
        FROM "HelpSession" session
        INNER JOIN "HelpRequest" request ON request."id" = session."requestId"
        WHERE request."helperId" = ${ownerId}
      )
      SELECT request_counts.*, session_counts.*
      FROM request_counts
      CROSS JOIN session_counts
    `);

    return (
      rows[0] ?? {
        helpReceived: 0,
        peopleHelped: 0,
        activeReceived: 0,
        activeGiven: 0,
        positiveHelps: 0,
        availabilityCredits: 0
      }
    );
  }

  async activeConversation(ownerId: string): Promise<ActivePeerHelp | null> {
    const request = await this.prisma.helpRequest.findFirst({
      where: {
        status: HelpRequestStatus.CLAIMED,
        OR: [{ learnerId: ownerId }, { helperId: ownerId }]
      },
      orderBy: { claimedAt: "desc" },
      select: {
        id: true,
        learnerId: true,
        helperId: true,
        questionSlug: true,
        language: true,
        question: { select: { title: true } },
        session: { select: { endedAt: true } }
      }
    });
    if (!request?.helperId) return null;

    const seat = request.learnerId === ownerId ? "learner" : "helper";
    const peerId = seat === "learner" ? request.helperId : request.learnerId;
    return {
      requestId: request.id,
      seat,
      slug: request.questionSlug,
      title: request.question.title,
      language: request.language,
      started: Boolean(request.session && !request.session.endedAt),
      peer: await this.participant(peerId)
    };
  }

  /** The one waiting request or accepted conversation currently occupying this person. */
  async activeEngagement(ownerId: string): Promise<CurrentPeerHelpEngagement | null> {
    const request = await this.prisma.helpRequest.findFirst({
      where: {
        OR: [
          {
            learnerId: ownerId,
            status: HelpRequestStatus.OPEN,
            expiresAt: { gt: new Date() }
          },
          { learnerId: ownerId, status: HelpRequestStatus.CLAIMED },
          { helperId: ownerId, status: HelpRequestStatus.CLAIMED }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        learnerId: true,
        helperId: true,
        status: true,
        questionSlug: true,
        language: true,
        question: { select: { title: true } },
        session: { select: { endedAt: true } }
      }
    });

    // A room that either participant ended must never be advertised as resumable,
    // even during a short reconciliation window before its request row is closed.
    if (!request || request.session?.endedAt) return null;

    const seat = request.learnerId === ownerId ? "learner" : "helper";
    const peerId = seat === "learner" ? request.helperId : request.learnerId;
    return {
      requestId: request.id,
      seat,
      status: request.status as "OPEN" | "CLAIMED",
      slug: request.questionSlug,
      title: request.question.title,
      language: request.language,
      started: Boolean(request.session),
      peer: peerId ? await this.participant(peerId) : null
    };
  }

  async topHelpers(limit = 5): Promise<TopPeerHelper[]> {
    const normalizedLimit = Math.min(Math.max(limit, 1), TOP_HELPERS_CACHE_LIMIT);
    const now = Date.now();
    if (this.topHelpersCache && this.topHelpersCache.expiresAt > now) {
      return this.topHelpersCache.helpers.slice(0, normalizedLimit);
    }

    if (!this.topHelpersInFlight) {
      this.topHelpersInFlight = this.loadTopHelpers()
        .then((helpers) => {
          this.topHelpersCache = { expiresAt: Date.now() + TOP_HELPERS_CACHE_MS, helpers };
          return helpers;
        })
        .finally(() => {
          this.topHelpersInFlight = null;
        });
    }

    const helpers = await this.topHelpersInFlight;
    return helpers.slice(0, normalizedLimit);
  }

  private async loadTopHelpers(): Promise<TopPeerHelper[]> {
    const ranked = await this.prisma.$queryRaw<TopHelperAggregateRow[]>(Prisma.sql`
      SELECT
        request."helperId" AS "helperId",
        COUNT(*)::int AS "helpedCount",
        COUNT(*) FILTER (WHERE session."learnerRating" = 5)::int AS "thankedCount"
      FROM "HelpRequest" request
      LEFT JOIN "HelpSession" session ON session."requestId" = request."id"
      WHERE request."status" = 'RESOLVED'::"HelpRequestStatus"
        AND request."helperId" IS NOT NULL
      GROUP BY request."helperId"
      ORDER BY "thankedCount" DESC, "helpedCount" DESC, request."helperId" ASC
      LIMIT ${TOP_HELPERS_CACHE_LIMIT}
    `);
    const profiles = await this.participants(ranked.map((row) => row.helperId));
    return ranked.map(({ helperId, helpedCount, thankedCount }) => ({
      participant: profiles.get(helperId) ?? presentHelpParticipant(null),
      helpedCount,
      thankedCount
    }));
  }

  async participant(ownerId: string): Promise<HelpHistoryParticipant> {
    const participants = await this.participants([ownerId]);
    return participants.get(ownerId) ?? presentHelpParticipant(null);
  }

  /**
   * Resolve the other person behind Trailmate notifications in two queries:
   * one for the requests and one for every distinct profile they reference.
   * An invitation recipient is not on the request yet, so anybody other than
   * the learner sees the learner as the source until they claim it.
   */
  async notificationParticipants(
    ownerId: string,
    requestIds: string[]
  ): Promise<Map<string, HelpHistoryParticipant>> {
    const uniqueIds = [...new Set(requestIds.filter(Boolean))].slice(0, 25);
    if (uniqueIds.length === 0) return new Map();

    const requests = await this.prisma.helpRequest.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, learnerId: true, helperId: true }
    });
    const peerByRequest = new Map<string, string>();
    for (const request of requests) {
      const peerId = request.learnerId === ownerId ? request.helperId : request.learnerId;
      if (peerId) peerByRequest.set(request.id, peerId);
    }

    const participants = await this.participants([...new Set(peerByRequest.values())]);
    return new Map(
      [...peerByRequest].flatMap(([requestId, peerId]) => {
        const participant = participants.get(peerId);
        return participant ? ([[requestId, participant]] as const) : [];
      })
    );
  }

  async participants(ownerIds: string[]): Promise<Map<string, HelpHistoryParticipant>> {
    const uniqueIds = [...new Set(ownerIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();
    const profiles = await this.prisma.candidateProfile.findMany({
      where: { ownerId: { in: uniqueIds } },
      select: {
        ownerId: true,
        headline: true,
        profileImage: true,
        resumeAnalysis: true
      }
    });
    return new Map(
      profiles.map((profile) => [profile.ownerId, presentHelpParticipant(profile)] as const)
    );
  }

  async history(input: {
    ownerId: string;
    side: HelpHistorySide;
    filter?: HelpHistoryFilter;
    cursor?: string | null;
    limit?: number;
  }): Promise<HelpHistoryPage> {
    const limit = Math.min(
      Math.max(input.limit ?? HELP_HISTORY_DEFAULT_LIMIT, 1),
      HELP_HISTORY_MAX_LIMIT
    );
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const status = statusWhere(input.filter ?? "all");
    const where: Prisma.HelpRequestWhereInput = {
      ...(input.side === "received" ? { learnerId: input.ownerId } : { helperId: input.ownerId }),
      ...(status ? { status } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }
            ]
          }
        : {})
    };

    const rows = await this.prisma.helpRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        learnerId: true,
        helperId: true,
        questionSlug: true,
        language: true,
        status: true,
        createdAt: true,
        claimedAt: true,
        resolvedAt: true,
        closedAt: true,
        question: { select: { title: true, primaryPattern: true } },
        session: {
          select: {
            startedAt: true,
            endedAt: true,
            learnerRating: true
          }
        }
      }
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const participantIds = pageRows
      .map((row) => (input.side === "received" ? row.helperId : row.learnerId))
      .filter((id): id is string => Boolean(id));
    const profileByOwner = await this.participants(participantIds);

    const items: HelpHistoryItem[] = pageRows.map((row) => {
      const participantId = input.side === "received" ? row.helperId : row.learnerId;
      const profile = participantId ? profileByOwner.get(participantId) : null;
      const duration = row.session
        ? Math.max(
            0,
            (row.session.endedAt?.getTime() ?? Date.now()) - row.session.startedAt.getTime()
          )
        : null;

      return {
        id: row.id,
        question: {
          slug: row.questionSlug,
          title: row.question.title,
          topic: row.question.primaryPattern,
          href: `/dsa-questions/${encodeURIComponent(row.questionSlug)}`
        },
        language: row.language,
        status: row.status,
        participant: participantId ? (profile ?? presentHelpParticipant(null)) : null,
        askedAt: row.createdAt.getTime(),
        claimedAt: row.claimedAt?.getTime() ?? null,
        resolvedAt: row.resolvedAt?.getTime() ?? null,
        closedAt: row.closedAt?.getTime() ?? null,
        sessionDurationMs: duration,
        learnerRating: row.session?.learnerRating ?? null,
        canReportOrBlock: Boolean(participantId && row.status === HelpRequestStatus.CLAIMED)
      };
    });

    const last = hasMore ? pageRows.at(-1) : null;
    return {
      items,
      nextCursor: last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null
    };
  }
}

function statusWhere(filter: HelpHistoryFilter): Prisma.EnumHelpRequestStatusFilter | undefined {
  if (filter === "active") {
    return { in: [HelpRequestStatus.OPEN, HelpRequestStatus.CLAIMED] };
  }
  if (filter === "resolved") return { equals: HelpRequestStatus.RESOLVED };
  if (filter === "expired") return { equals: HelpRequestStatus.EXPIRED };
  if (filter === "cancelled") return { equals: HelpRequestStatus.CANCELLED };
  return undefined;
}

function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): HistoryCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<HistoryCursor>;
    if (
      typeof parsed.createdAt !== "string" ||
      Number.isNaN(new Date(parsed.createdAt).getTime()) ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new Error("invalid cursor");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new InvalidHelpHistoryCursorError("Invalid help history cursor");
  }
}
