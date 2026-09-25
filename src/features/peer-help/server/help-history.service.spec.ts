import type { PrismaService } from "@/server/database/prisma.service";
import { HelpHistoryService, InvalidHelpHistoryCursorError } from "./help-history.service";

describe("help history", () => {
  it("builds the urgent-help version in one database round trip", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        invitationCount: 3,
        latestInvitationAt: new Date("2026-09-03T00:00:00.000Z"),
        engagementCount: 2,
        latestEngagementAt: new Date("2026-09-03T00:01:00.000Z")
      }
    ]);
    const service = new HelpHistoryService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(service.pollingStatus("owner-1")).resolves.toEqual({
      version: "3:1788393600000:2:1788393660000"
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const query = queryRaw.mock.calls[0]![0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join(" ")).toContain('notification."createdAt" >');
    expect(query.values).toContain("owner-1");
    expect(query.values.some((value) => value instanceof Date)).toBe(true);
  });

  it("presents a learner's waiting request as their current engagement", async () => {
    const prisma = {
      helpRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000001",
          learnerId: "owner-1",
          helperId: null,
          status: "OPEN",
          questionSlug: "contains-duplicate",
          language: "javascript",
          question: { title: "Contains Duplicate" },
          session: null
        })
      }
    } as unknown as PrismaService;

    await expect(new HelpHistoryService(prisma).activeEngagement("owner-1")).resolves.toEqual({
      requestId: "00000000-0000-4000-8000-000000000001",
      seat: "learner",
      status: "OPEN",
      slug: "contains-duplicate",
      title: "Contains Duplicate",
      language: "javascript",
      started: false,
      peer: null
    });
  });

  it("never presents an ended room as resumable", async () => {
    const prisma = {
      helpRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000001",
          learnerId: "owner-1",
          helperId: "helper-1",
          status: "CLAIMED",
          questionSlug: "contains-duplicate",
          language: "javascript",
          question: { title: "Contains Duplicate" },
          session: { endedAt: new Date() }
        })
      }
    } as unknown as PrismaService;

    await expect(new HelpHistoryService(prisma).activeEngagement("owner-1")).resolves.toBeNull();
  });

  it("returns owner-scoped help-given history without exposing internal participant ids", async () => {
    const helpRequestFindMany = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        learnerId: "private-learner-id",
        helperId: "owner-1",
        questionSlug: "two-sum",
        language: "javascript",
        status: "RESOLVED",
        createdAt: new Date("2026-08-28T08:00:00.000Z"),
        claimedAt: new Date("2026-08-28T08:05:00.000Z"),
        resolvedAt: new Date("2026-08-28T08:15:00.000Z"),
        closedAt: null,
        question: { title: "Two Sum", primaryPattern: "Arrays & Hashing" },
        session: {
          startedAt: new Date("2026-08-28T08:05:00.000Z"),
          endedAt: new Date("2026-08-28T08:15:00.000Z"),
          learnerRating: 5
        }
      }
    ]);
    const prisma = {
      helpRequest: { findMany: helpRequestFindMany },
      $queryRaw: rawQuery({
        profiles: [profile("private-learner-id", "Asha Verma", "Frontend candidate", AVATAR_1)]
      })
    } as unknown as PrismaService;

    const result = await new HelpHistoryService(prisma).history({
      ownerId: "owner-1",
      side: "given",
      filter: "resolved"
    });

    expect(helpRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ helperId: "owner-1" })
      })
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000001",
        learnerRating: 5,
        sessionDurationMs: 600_000,
        participant: {
          label: "Asha Verma",
          headline: "Frontend candidate",
          profileImage: "/images/profile/avatars/avatar-01.jpg"
        }
      })
    );
    expect(JSON.stringify(result)).not.toContain("private-learner-id");
    expect(JSON.stringify(result)).not.toContain("owner-1");
  });

  it("returns only the lightweight counts used by the simplified Help page", async () => {
    const queryRaw = rawQuery({
      counts: [
        {
          helpReceived: 4,
          peopleHelped: 1,
          activeReceived: 1,
          activeGiven: 0,
          positiveHelps: 1,
          availabilityCredits: 1
        }
      ],
      leaderboard: [],
      profiles: [profile("owner-1", "Asha Verma", "Frontend candidate", AVATAR_1)]
    });
    const prisma = {
      helpRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      $queryRaw: queryRaw
    } as unknown as PrismaService;

    await expect(new HelpHistoryService(prisma).overview("owner-1")).resolves.toEqual({
      viewer: {
        label: "Asha Verma",
        headline: "Frontend candidate",
        profileImage: AVATAR_1
      },
      helpReceived: 4,
      peopleHelped: 1,
      activeReceived: 1,
      activeGiven: 0,
      positiveHelps: 1,
      availabilityCredits: 1,
      activeConversation: null,
      topHelpers: []
    });
    // Counters, leaderboard, and the viewer's profile: one statement each.
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it("aggregates the leaderboard in SQL and shares it for 45 seconds", async () => {
    let now = 1_000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => now);
    const queryRaw = rawQuery({
      leaderboard: [
        { helperId: "helper-1", helpedCount: 8, thankedCount: 6 },
        { helperId: "helper-2", helpedCount: 11, thankedCount: 4 }
      ],
      profiles: [
        profile("helper-1", "Asha Verma", "Backend candidate", AVATAR_1),
        profile("helper-2", "Dev Shah", null, null)
      ]
    });
    const leaderboardReads = () => callsMatching(queryRaw, LEADERBOARD_SQL);
    const profileReads = () => callsMatching(queryRaw, PROFILE_SQL);
    const service = new HelpHistoryService({ $queryRaw: queryRaw } as unknown as PrismaService);

    try {
      const [first, concurrent] = await Promise.all([service.topHelpers(), service.topHelpers()]);
      expect(first).toEqual([
        {
          participant: {
            label: "Asha Verma",
            headline: "Backend candidate",
            profileImage: "/images/profile/avatars/avatar-01.jpg"
          },
          helpedCount: 8,
          thankedCount: 6
        },
        {
          participant: { label: "Dev Shah", headline: null, profileImage: null },
          helpedCount: 11,
          thankedCount: 4
        }
      ]);
      expect(concurrent).toEqual(first);
      expect(leaderboardReads()).toBe(1);
      expect(profileReads()).toBe(1);

      now = 45_999;
      await service.topHelpers();
      expect(leaderboardReads()).toBe(1);

      now = 46_001;
      await service.topHelpers();
      expect(leaderboardReads()).toBe(2);
      expect(profileReads()).toBe(2);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("uses the consolidated counters for the lightweight dashboard overview", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        helpReceived: 7,
        peopleHelped: 3,
        activeReceived: 0,
        activeGiven: 0,
        positiveHelps: 2,
        availabilityCredits: 1
      }
    ]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new HelpHistoryService({
      $queryRaw: queryRaw,
      helpRequest: { findFirst }
    } as unknown as PrismaService);

    await expect(service.dashboardOverview("owner-1")).resolves.toEqual({
      helpReceived: 7,
      peopleHelped: 3,
      activeConversation: null
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("resolves the other participant for Trailmate notification portraits", async () => {
    const prisma = {
      helpRequest: {
        findMany: vi.fn().mockResolvedValue([
          { id: "opened", learnerId: "learner-1", helperId: null },
          { id: "claimed", learnerId: "owner-1", helperId: "helper-1" },
          { id: "expired", learnerId: "owner-1", helperId: null }
        ])
      },
      $queryRaw: rawQuery({
        profiles: [
          profile("learner-1", "Asha Verma", null, AVATAR_1),
          profile("helper-1", "Dev Shah", null, "/images/profile/avatars/avatar-02.jpg")
        ]
      })
    } as unknown as PrismaService;

    const participants = await new HelpHistoryService(prisma).notificationParticipants("owner-1", [
      "opened",
      "claimed",
      "expired",
      "opened"
    ]);

    expect(participants.get("opened")).toEqual({
      label: "Asha Verma",
      headline: null,
      profileImage: "/images/profile/avatars/avatar-01.jpg"
    });
    expect(participants.get("claimed")).toEqual({
      label: "Dev Shah",
      headline: null,
      profileImage: "/images/profile/avatars/avatar-02.jpg"
    });
    expect(participants.has("expired")).toBe(false);
  });

  it("rejects malformed cursors before querying history", async () => {
    const prisma = {
      helpRequest: { findMany: vi.fn() }
    } as unknown as PrismaService;
    const service = new HelpHistoryService(prisma);

    await expect(
      service.history({ ownerId: "owner-1", side: "received", cursor: "not-a-cursor" })
    ).rejects.toBeInstanceOf(InvalidHelpHistoryCursorError);
  });
});

const AVATAR_1 = "/images/profile/avatars/avatar-01.jpg";
const PROFILE_SQL = 'FROM "CandidateProfile"';
const LEADERBOARD_SQL = 'GROUP BY request."helperId"';

type ProfileRow = {
  ownerId: string;
  headline: string | null;
  profileImage: string | null;
  fullName: string | null;
};

function profile(
  ownerId: string,
  fullName: string,
  headline: string | null,
  profileImage: string | null
): ProfileRow {
  return { ownerId, fullName, headline, profileImage };
}

/** Fake `$queryRaw` that answers each statement by the table it reads. */
function rawQuery(responses: {
  counts?: unknown[];
  leaderboard?: unknown[];
  profiles?: ProfileRow[];
}) {
  return vi.fn(async ({ sql, values }: { sql: string; values: unknown[] }) => {
    if (sql.includes(PROFILE_SQL)) {
      return (responses.profiles ?? []).filter((row) => values.includes(row.ownerId));
    }
    if (sql.includes("request_counts")) return responses.counts ?? [];
    if (sql.includes(LEADERBOARD_SQL)) return responses.leaderboard ?? [];
    throw new Error(`Unexpected query: ${sql}`);
  });
}

function callsMatching(query: ReturnType<typeof rawQuery>, fragment: string): number {
  return query.mock.calls.filter(([statement]) => statement.sql.includes(fragment)).length;
}
