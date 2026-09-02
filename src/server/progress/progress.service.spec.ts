import { RoadmapQuestionAttemptStatus } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import { ProgressService } from "./progress.service";

const EMPTY_INTERVIEW = { completedSessions: 0 };

describe("ProgressService briefing", () => {
  it("reads and returns only the data used by the Maya progress screen", async () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({ completedQuestions: 7 });
    const findMany = vi.fn().mockResolvedValue([
      {
        status: RoadmapQuestionAttemptStatus.COMPLETED,
        createdAt: new Date("2026-09-02T08:00:00.000Z")
      },
      {
        status: RoadmapQuestionAttemptStatus.COMPLETED,
        createdAt: new Date("2026-09-01T08:00:00.000Z")
      }
    ]);
    const prisma = {
      userRoadmap: { findUnique },
      userQuestionAttempt: { findMany }
    } as unknown as PrismaService;

    const result = await new ProgressService(prisma).briefing("owner-1", EMPTY_INTERVIEW, now);

    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId_role: { ownerId: "owner-1", role: "fullstack" } },
      select: { completedQuestions: true }
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: "owner-1" }),
        select: { status: true, createdAt: true }
      })
    );
    expect(result.totals).toEqual({ totalAttempts: 2, completedQuestions: 7 });
    expect(result.streak.currentDays).toBe(2);
    expect(result.activity).toHaveLength(7);
    expect(result.activity.at(-1)).toEqual({ date: "2026-09-02", solved: 1, attempts: 1 });
    expect(Object.keys(result).sort()).toEqual(["activity", "interview", "streak", "totals"]);
  });
});

describe("ProgressService dashboard", () => {
  it("uses roadmap counters and one compact next-question read", async () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({
      id: "roadmap-1",
      nextQuestionKey: "two-sum",
      totalQuestions: 40,
      completedQuestions: 10
    });
    const findMany = vi.fn().mockResolvedValue([
      {
        status: RoadmapQuestionAttemptStatus.COMPLETED,
        createdAt: new Date("2026-09-02T08:00:00.000Z")
      },
      {
        status: RoadmapQuestionAttemptStatus.COMPLETED,
        createdAt: new Date("2026-09-01T08:00:00.000Z")
      }
    ]);
    const findFirst = vi.fn().mockResolvedValue({
      dsaQuestionSlug: "two-sum",
      roadmapQuestionTemplateId: null,
      dsaQuestion: {
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "easy",
        expectedTimeMinutes: 20
      },
      roadmapQuestionTemplate: null,
      chapterProgress: { chapterTemplate: { title: "Arrays" } }
    });
    const prisma = {
      userRoadmap: { findUnique },
      userQuestionAttempt: { findMany },
      userQuestionProgress: { findFirst }
    } as unknown as PrismaService;

    const result = await new ProgressService(prisma).dashboard("owner-1", now);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          nextQuestionKey: true,
          totalQuestions: true,
          completedQuestions: true
        }
      })
    );
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roadmapId: "roadmap-1" })
      })
    );
    expect(result).toEqual({
      totals: {
        completedQuestions: 10,
        totalQuestions: 40,
        completionPercent: 25,
        totalAttempts: 2,
        solvedThisWeek: 2
      },
      streak: {
        currentDays: 2,
        lastActiveAt: new Date("2026-09-02T08:00:00.000Z").getTime()
      },
      activity: expect.any(Array),
      nextUp: {
        title: "Two Sum",
        href: "/dsa-questions/two-sum",
        chapterTitle: "Arrays",
        difficulty: "easy",
        minutes: 20
      }
    });
    expect(result.activity).toHaveLength(7);
  });
});
