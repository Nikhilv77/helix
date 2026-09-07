import { CoreTechnicalQuestionStatus } from "@prisma/client";
import rawFirst from "@/lib/practice/core-technical/generated/follow-operation-guided-benchmark.json";
import { toPublicCoreTechnicalQuestion } from "@/lib/practice/core-technical/question-contracts";
import { coreTechnicalStoryReviewArtifactSchema } from "@/lib/practice/core-technical/review-artifact-contracts";
import {
  mergeDashboardPractice,
  mergePracticeActivity
} from "@/lib/practice/core-technical/workspace-analytics";
import type { ProgressDashboardOverview } from "@/lib/roadmap/progress";
import type { PrismaService } from "@/server/database/prisma.service";
import { CoreTechnicalWorkspaceAnalyticsService } from "./workspace-analytics.service";

const story = coreTechnicalStoryReviewArtifactSchema.parse(rawFirst);

describe("CoreTechnicalWorkspaceAnalyticsService", () => {
  it("counts completed and learned Core Technical questions in the same daily completion bars", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const completedAt = new Date("2026-09-08T09:00:00.000Z");
    const questions = [
      {
        id: "question-1",
        blockId: "block-1",
        order: 1,
        status: CoreTechnicalQuestionStatus.COMPLETED,
        publicSnapshot: toPublicCoreTechnicalQuestion(story.questionBlock.questions[0]!, true),
        completedAt,
        learnedAt: null,
        block: { isCurrent: true, storySnapshot: story.story }
      },
      {
        id: "question-2",
        blockId: "block-1",
        order: 2,
        status: CoreTechnicalQuestionStatus.LEARNED,
        publicSnapshot: toPublicCoreTechnicalQuestion(story.questionBlock.questions[1]!, true),
        completedAt: null,
        learnedAt: completedAt,
        block: { isCurrent: true, storySnapshot: story.story }
      },
      {
        id: "question-3",
        blockId: "block-1",
        order: 3,
        status: CoreTechnicalQuestionStatus.ACTIVE,
        publicSnapshot: toPublicCoreTechnicalQuestion(story.questionBlock.questions[2]!, false),
        completedAt: null,
        learnedAt: null,
        block: { isCurrent: true, storySnapshot: story.story }
      }
    ];
    const prisma = {
      coreTechnicalBlockQuestion: { findMany: vi.fn().mockResolvedValue(questions) },
      coreTechnicalQuestionAttempt: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ createdAt: completedAt }, { createdAt: completedAt }])
      }
    } as unknown as PrismaService;

    const result = await new CoreTechnicalWorkspaceAnalyticsService(prisma).practice(
      "owner-1",
      7,
      now
    );

    expect(result).toMatchObject({
      totalQuestions: 3,
      completedQuestions: 2,
      totalAttempts: 2,
      solvedThisWeek: 2,
      currentStreakDays: 1,
      nextUp: {
        title: story.story.stages[2]!.title,
        href: "/practice/core-technical/questions/question-3?block=block-1"
      }
    });
    expect(result.activity.at(-1)).toEqual({
      date: "2026-09-08",
      solved: 2,
      attempts: 2
    });
  });
});

describe("mergeDashboardPractice", () => {
  it("adds Core Technical totals and activity to the existing roadmap projection", () => {
    const roadmap: ProgressDashboardOverview = {
      totals: {
        completedQuestions: 4,
        totalQuestions: 20,
        completionPercent: 20,
        totalAttempts: 6,
        solvedThisWeek: 2
      },
      streak: { currentDays: 1, lastActiveAt: 100 },
      activity: [{ date: "2026-09-08", solved: 1, attempts: 2 }],
      nextUp: {
        title: "Two Sum",
        href: "/dsa-questions/two-sum",
        chapterTitle: "Arrays",
        difficulty: "easy",
        minutes: 15
      }
    };

    const merged = mergeDashboardPractice(roadmap, {
      totalQuestions: 8,
      completedQuestions: 2,
      totalAttempts: 3,
      solvedThisWeek: 2,
      currentStreakDays: 1,
      lastActiveAt: 200,
      activity: [{ date: "2026-09-08", solved: 2, attempts: 3 }],
      nextUp: null
    });

    expect(merged.totals).toEqual({
      completedQuestions: 6,
      totalQuestions: 28,
      completionPercent: 21,
      totalAttempts: 9,
      solvedThisWeek: 4
    });
    expect(merged.activity).toEqual([{ date: "2026-09-08", solved: 3, attempts: 5 }]);
    expect(merged.streak.lastActiveAt).toBe(200);
    expect(merged.nextUp?.title).toBe("Two Sum");
  });
});

describe("mergePracticeActivity", () => {
  it("adds Core Technical counts into the existing chart slots without adding bars", () => {
    const roadmap = [
      { date: "2026-09-01", solved: 0, attempts: 0 },
      { date: "2026-09-02", solved: 2, attempts: 2 }
    ];
    const coreTechnical = [
      { date: "2026-09-02", solved: 1, attempts: 1 },
      { date: "2026-09-03", solved: 4, attempts: 4 }
    ];

    expect(mergePracticeActivity(roadmap, coreTechnical)).toEqual([
      { date: "2026-09-01", solved: 0, attempts: 0 },
      { date: "2026-09-02", solved: 3, attempts: 3 }
    ]);
  });

  it("uses the Core Technical slots when the roadmap has no activity payload", () => {
    const coreTechnical = [
      { date: "2026-09-01", solved: 1, attempts: 2 },
      { date: "2026-09-02", solved: 0, attempts: 0 }
    ];

    expect(mergePracticeActivity([], coreTechnical)).toEqual(coreTechnical);
  });
});
