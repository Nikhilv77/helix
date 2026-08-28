import type { PrismaService } from "../database/prisma.service";
import { HelpHistoryService, InvalidHelpHistoryCursorError } from "./help-history.service";

describe("help history", () => {
  it("presents a learner's waiting request as their current engagement", async () => {
    const prisma = {
      helpRequest: {
        findFirst: jest.fn().mockResolvedValue({
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
        findFirst: jest.fn().mockResolvedValue({
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
    const helpRequestFindMany = jest.fn().mockResolvedValue([
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
      candidateProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            ownerId: "private-learner-id",
            headline: "Frontend candidate",
            profileImage: "/images/profile/avatars/avatar-01.jpg",
            resumeAnalysis: { fullName: "Asha Verma" }
          }
        ])
      }
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
    const count = jest
      .fn()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const prisma = {
      helpRequest: {
        count,
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest
          .fn()
          .mockResolvedValue([{ learnerId: "learner-1" }, { learnerId: "learner-1" }])
      },
      helpSession: {
        count: jest.fn().mockResolvedValue(1)
      },
      candidateProfile: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const ownerIds = where.ownerId.in as string[];
          return Promise.resolve(
            ownerIds.includes("owner-1")
              ? [
                  {
                    ownerId: "owner-1",
                    headline: "Frontend candidate",
                    profileImage: "/images/profile/avatars/avatar-01.jpg",
                    resumeAnalysis: { fullName: "Asha Verma" }
                  }
                ]
              : []
          );
        })
      }
    } as unknown as PrismaService;

    await expect(new HelpHistoryService(prisma).overview("owner-1")).resolves.toEqual({
      viewer: {
        label: "Asha Verma",
        headline: "Frontend candidate",
        profileImage: "/images/profile/avatars/avatar-01.jpg"
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
  });

  it("rejects malformed cursors before querying history", async () => {
    const prisma = {
      helpRequest: { findMany: jest.fn() }
    } as unknown as PrismaService;
    const service = new HelpHistoryService(prisma);

    await expect(
      service.history({ ownerId: "owner-1", side: "received", cursor: "not-a-cursor" })
    ).rejects.toBeInstanceOf(InvalidHelpHistoryCursorError);
  });
});
