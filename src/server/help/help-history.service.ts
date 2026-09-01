import type { Prisma } from "@prisma/client";

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

interface HistoryCursor {
  createdAt: string;
  id: string;
}

export class InvalidHelpHistoryCursorError extends Error {}

export class HelpHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(ownerId: string): Promise<HelpOverview> {
    const liveStatuses = [HelpRequestStatus.OPEN, HelpRequestStatus.CLAIMED];
    const [
      helpReceived,
      helpedPeople,
      activeReceived,
      activeGiven,
      positiveHelps,
      availabilityCredits,
      activeConversation,
      topHelpers,
      viewer
    ] = await Promise.all([
      this.prisma.helpRequest.count({ where: { learnerId: ownerId } }),
      this.prisma.helpRequest.findMany({
        where: { helperId: ownerId, status: HelpRequestStatus.RESOLVED },
        select: { learnerId: true },
        distinct: ["learnerId"]
      }),
      this.prisma.helpRequest.count({
        where: { learnerId: ownerId, status: { in: liveStatuses } }
      }),
      this.prisma.helpRequest.count({
        where: { helperId: ownerId, status: HelpRequestStatus.CLAIMED }
      }),
      this.prisma.helpSession.count({
        where: {
          learnerRating: 5,
          learnerJoinedAt: { not: null },
          helperJoinedAt: { not: null },
          request: { helperId: ownerId }
        }
      }),
      this.prisma.helpSession.count({
        where: {
          helperWaitCreditAt: { not: null },
          request: { helperId: ownerId }
        }
      }),
      this.activeConversation(ownerId),
      this.topHelpers(),
      this.participant(ownerId)
    ]);

    return {
      viewer,
      helpReceived,
      peopleHelped: new Set(helpedPeople.map((row) => row.learnerId)).size,
      activeReceived,
      activeGiven,
      positiveHelps,
      availabilityCredits,
      activeConversation,
      topHelpers
    };
  }

  /** Lightweight read for the home dashboard; skips rankings and recognition queries. */
  async dashboardOverview(ownerId: string): Promise<HelpDashboardOverview> {
    const [helpReceived, helpedPeople, activeConversation] = await Promise.all([
      this.prisma.helpRequest.count({ where: { learnerId: ownerId } }),
      this.prisma.helpRequest.findMany({
        where: { helperId: ownerId, status: HelpRequestStatus.RESOLVED },
        select: { learnerId: true },
        distinct: ["learnerId"]
      }),
      this.activeConversation(ownerId)
    ]);

    return {
      helpReceived,
      peopleHelped: new Set(helpedPeople.map((row) => row.learnerId)).size,
      activeConversation
    };
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
    const rows = await this.prisma.helpRequest.findMany({
      where: { status: HelpRequestStatus.RESOLVED, helperId: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: 1_000,
      select: {
        helperId: true,
        session: { select: { learnerRating: true } }
      }
    });
    const totals = new Map<string, { helpedCount: number; thankedCount: number }>();
    for (const row of rows) {
      if (!row.helperId) continue;
      const current = totals.get(row.helperId) ?? { helpedCount: 0, thankedCount: 0 };
      current.helpedCount += 1;
      if (row.session?.learnerRating === 5) current.thankedCount += 1;
      totals.set(row.helperId, current);
    }

    const ranked = [...totals.entries()]
      .sort(([, a], [, b]) => b.thankedCount - a.thankedCount || b.helpedCount - a.helpedCount)
      .slice(0, Math.min(Math.max(limit, 1), 10));
    const profiles = await this.participants(ranked.map(([ownerId]) => ownerId));
    return ranked.map(([ownerId, totalsForHelper]) => ({
      participant: profiles.get(ownerId) ?? presentHelpParticipant(null),
      ...totalsForHelper
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
