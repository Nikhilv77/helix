import { randomUUID } from "node:crypto";
import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import { PRACTICE_SESSION_KEYS } from "@/lib/practice/practice-roadmap";
import { PrismaService } from "../database/prisma.service";
import type { PersonalizedInterviewPlanningService } from "../interview/personalized-interview-planning.service";
import { PersonalizedPlanningStore } from "../interview/personalized-planning-store";
import { FrontendRoadmapService } from "../roadmap/frontend-roadmap.service";
import { PracticeRoadmapService } from "./practice-roadmap.service";
import { PrepPracticeService } from "./prep-practice.service";
import { PrepPracticeEvaluator } from "./prep-practice-evaluator";

const describeDatabase = process.env.RUN_PRACTICE_DB_INTEGRATION === "1" ? describe : describe.skip;
const ROLLBACK = Symbol("ROLLBACK_PRACTICE_REGENERATION_TEST");

vi.setConfig({ testTimeout: 120_000 });

describeDatabase("PracticeRoadmapService database integration", () => {
  const prisma = new PrismaService();
  let sourcePlan: PersonalizedInterviewPlan;

  beforeAll(async () => {
    await prisma.$connect();
    const ready = await prisma.personalizedInterviewPlanVersion.findFirst({
      where: { status: "READY" },
      orderBy: { generatedAt: "desc" },
      select: { ownerId: true }
    });
    if (!ready) throw new Error("The Practice integration test needs one READY interview plan.");

    const store = new PersonalizedPlanningStore(prisma, {
      get: async () => {
        throw new Error("Profile reads are not used by getActivePlan.");
      }
    });
    const loaded = await store.getActivePlan(ready.ownerId);
    if (!loaded) throw new Error("The selected READY interview plan could not be loaded.");
    sourcePlan = loaded;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("regenerates personalized snapshots while preserving every persisted progress field", async () => {
    const candidates = await prisma.userRoadmap.findMany({
      where: {
        role: "fullstack",
        owner: { interviewPlanVersions: { some: { status: "READY" } } }
      },
      select: { ownerId: true, _count: { select: { sessionProgress: true } } }
    });
    const candidate = candidates.find((row) => row._count.sessionProgress === 6);
    if (!candidate) throw new Error("The Practice integration test needs one six-slot roadmap.");

    const store = new PersonalizedPlanningStore(prisma, {
      get: async () => {
        throw new Error("Profile reads are not used by getActivePlan.");
      }
    });
    const activePlan = await store.getActivePlan(candidate.ownerId);
    if (!activePlan) throw new Error("The six-slot roadmap owner has no READY interview plan.");
    const regenerated = regeneratedPlan(activePlan);

    try {
      await prisma.$transaction(
        async (tx) => {
          const before = await tx.userSessionProgress.findMany({
            where: { roadmap: { ownerId: candidate.ownerId, role: "fullstack" } },
            orderBy: { practiceSessionKey: "asc" },
            select: {
              id: true,
              practiceSessionKey: true,
              status: true,
              startedAt: true,
              completedAt: true,
              attemptedQuestions: true,
              completedQuestions: true,
              progressPercent: true
            }
          });
          const transactionBoundPrisma = {
            $transaction: async (work: (transaction: typeof tx) => unknown) => work(tx)
          } as unknown as PrismaService;
          const roadmaps = {
            home: async () => ({ roadmapId: "already-provisioned" })
          } as unknown as FrontendRoadmapService;
          const plans = {
            activePlan: async () => regenerated
          } as unknown as PersonalizedInterviewPlanningService;

          const result = await new PracticeRoadmapService(
            transactionBoundPrisma,
            roadmaps,
            plans
          ).home(candidate.ownerId);
          const after = await tx.userSessionProgress.findMany({
            where: { roadmap: { ownerId: candidate.ownerId, role: "fullstack" } },
            orderBy: { practiceSessionKey: "asc" },
            select: {
              id: true,
              practiceSessionKey: true,
              status: true,
              startedAt: true,
              completedAt: true,
              attemptedQuestions: true,
              completedQuestions: true,
              progressPercent: true,
              titleSnapshot: true,
              sourceBlueprintId: true
            }
          });
          const persistedRoadmap = await tx.userRoadmap.findUniqueOrThrow({
            where: { ownerId_role: { ownerId: candidate.ownerId, role: "fullstack" } },
            select: {
              sourceInterviewPlanId: true,
              sourceInterviewPlanRevision: true,
              sourceProfileVersionId: true,
              sourceProfileRevision: true
            }
          });

          expect(result?.sessions.map((session) => session.key)).toEqual(PRACTICE_SESSION_KEYS);
          expect(after.map(progressFields)).toEqual(before.map(progressFields));
          expect(
            after
              .filter((row) => row.sourceBlueprintId)
              .every((row) => row.titleSnapshot?.endsWith(" · refreshed"))
          ).toBe(true);
          expect(persistedRoadmap).toEqual({
            sourceInterviewPlanId: regenerated.id,
            sourceInterviewPlanRevision: regenerated.revision,
            sourceProfileVersionId: regenerated.sourceSnapshot.candidateProfile.id,
            sourceProfileRevision: regenerated.sourceSnapshot.candidateProfile.revision
          });

          throw ROLLBACK;
        },
        { maxWait: 20_000, timeout: 60_000 }
      );
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });

  it("converges concurrent first loads on one six-slot roadmap", async () => {
    const ownerId = `practice-integration-${randomUUID()}`;
    await deleteIntegrationCandidate(prisma, ownerId);

    try {
      await prisma.candidateProfile.create({
        data: {
          ownerId,
          targetRole: "frontend",
          level: "0-2",
          focusAreas: [],
          stories: [],
          onboardingCompletedAt: new Date()
        }
      });
      const roadmaps = new FrontendRoadmapService(prisma);
      const plans = {
        activePlan: async () => sourcePlan
      } as unknown as PersonalizedInterviewPlanningService;
      const service = new PracticeRoadmapService(prisma, roadmaps, plans);

      const results = await Promise.all(Array.from({ length: 5 }, () => service.home(ownerId)));
      const storedRoadmaps = await prisma.userRoadmap.findMany({
        where: { ownerId, role: "fullstack" },
        include: {
          sessionProgress: { orderBy: { order: "asc" } },
          practiceQuestionPlacements: {
            orderBy: [{ practiceSessionKey: "asc" }, { order: "asc" }]
          },
          _count: { select: { questionProgress: true } }
        }
      });

      expect(new Set(results.map((result) => result?.roadmapId)).size).toBe(1);
      expect(results.every((result) => result?.sessions.length === 6)).toBe(true);
      expect(storedRoadmaps).toHaveLength(1);
      expect(storedRoadmaps[0]?.sessionProgress).toHaveLength(6);
      expect(storedRoadmaps[0]?.sessionProgress.map((row) => row.practiceSessionKey)).toEqual(
        PRACTICE_SESSION_KEYS
      );
      expect(results[0]?.sessions.map((session) => session.totalQuestions)).toEqual([
        123, 12, 24, 12, 9, 12
      ]);
      expect(results[0]?.sessions.every((session) => session.availability === "available")).toBe(
        true
      );
      expect(storedRoadmaps[0]?._count.questionProgress).toBe(198);
      expect(storedRoadmaps[0]?.practiceQuestionPlacements).toHaveLength(69);
      const primaryQuestionIds = new Set(
        storedRoadmaps[0]?.practiceQuestionPlacements
          .filter((placement) => placement.practiceSessionKey !== "architecture-system-design")
          .map((placement) => placement.questionProgressId)
      );
      expect(
        storedRoadmaps[0]?.practiceQuestionPlacements
          .filter((placement) => placement.practiceSessionKey === "architecture-system-design")
          .every((placement) => primaryQuestionIds.has(placement.questionProgressId))
      ).toBe(true);

      // Simulate a candidate provisioned before Part 3. The version check must
      // lazily add PREP progress and rebuild placements without re-onboarding.
      await prisma.practiceQuestionPlacement.deleteMany({
        where: { roadmapId: storedRoadmaps[0]!.id }
      });
      await prisma.userQuestionProgress.deleteMany({
        where: { roadmapId: storedRoadmaps[0]!.id, sourceType: "PREP" }
      });
      await prisma.userRoadmap.update({
        where: { id: storedRoadmaps[0]!.id },
        data: { templateVersion: 1, totalQuestions: 123 }
      });

      const backfilled = await service.home(ownerId);

      expect(backfilled?.sessions.map((session) => session.totalQuestions)).toEqual([
        123, 12, 24, 12, 9, 12
      ]);
      expect(
        await prisma.userQuestionProgress.count({ where: { roadmapId: storedRoadmaps[0]!.id } })
      ).toBe(198);
      expect(
        await prisma.practiceQuestionPlacement.count({
          where: { roadmapId: storedRoadmaps[0]!.id }
        })
      ).toBe(69);

      const prepPractice = new PrepPracticeService(
        prisma,
        roadmaps,
        new PrepPracticeEvaluator({
          generateStructured: vi.fn().mockResolvedValue({
            score: 90,
            verdict: "strong",
            summary: "The answer meets the authored rubric.",
            strengths: ["Covers the central mechanism."],
            gaps: [],
            rubricRationale: "The submitted evidence matches the authored strong band."
          })
        })
      );
      const mcqPlacement = await prisma.practiceQuestionPlacement.findFirstOrThrow({
        where: {
          roadmapId: storedRoadmaps[0]!.id,
          practiceSessionKey: "applied-engineering",
          questionProgress: { prepQuestionTemplate: { format: "mcq" } }
        },
        include: { questionProgress: { include: { prepQuestionTemplate: true } } }
      });
      const mcq = mcqPlacement.questionProgress.prepQuestionTemplate!;
      const answerKey = mcq.answerKey as { correctOptionIndex: number };
      await prepPractice.saveState(ownerId, {
        sessionKey: "applied-engineering",
        questionId: mcq.id,
        draftAnswer: `option:${answerKey.correctOptionIndex}`,
        revealedHintCount: 1,
        note: "Remember the mechanism, not only the label."
      });
      const savedQuestion = await prepPractice.question(ownerId, "applied-engineering", mcq.id);
      expect(savedQuestion).toMatchObject({
        draftAnswer: `option:${answerKey.correctOptionIndex}`,
        revealedHintCount: 1,
        note: "Remember the mechanism, not only the label.",
        review: null
      });
      expect(JSON.stringify(savedQuestion)).not.toContain("correctOptionIndex");

      const concurrentHintCount = Math.min(2, mcq.hints.length);
      await Promise.all([
        prepPractice.saveState(ownerId, {
          sessionKey: "applied-engineering",
          questionId: mcq.id,
          revealedHintCount: concurrentHintCount
        }),
        prepPractice.saveState(ownerId, {
          sessionKey: "applied-engineering",
          questionId: mcq.id,
          revealedHintCount: 1
        })
      ]);
      const afterConcurrentHints = await prepPractice.question(
        ownerId,
        "applied-engineering",
        mcq.id
      );
      expect(afterConcurrentHints?.revealedHintCount).toBe(concurrentHintCount);

      const requestId = randomUUID();
      const submitted = await prepPractice.attempt(ownerId, {
        requestId,
        sessionKey: "applied-engineering",
        questionId: mcq.id,
        action: "submit",
        answer: `option:${answerKey.correctOptionIndex}`,
        selectedOptionIndex: answerKey.correctOptionIndex,
        durationMs: 12_000
      });
      const replayed = await prepPractice.attempt(ownerId, {
        requestId,
        sessionKey: "applied-engineering",
        questionId: mcq.id,
        action: "submit",
        answer: `option:${answerKey.correctOptionIndex}`,
        selectedOptionIndex: answerKey.correctOptionIndex,
        durationMs: 12_000
      });
      expect(submitted).toMatchObject({ recorded: true, replayed: false, status: "COMPLETED" });
      expect(submitted.review).toMatchObject({ score: 1, correctness: "correct" });
      expect(replayed).toMatchObject({ recorded: true, replayed: true });
      expect(await prisma.userQuestionAttempt.count({ where: { ownerId } })).toBe(1);
      expect(
        await prisma.userQuestionAttempt.findFirstOrThrow({
          where: { ownerId, idempotencyKey: requestId },
          select: {
            verificationStatus: true,
            evaluatorVersion: true,
            questionContentVersion: true
          }
        })
      ).toEqual({
        verificationStatus: "VERIFIED",
        evaluatorVersion: "prep-mcq-v1",
        questionContentVersion: mcq.contentVersion
      });

      const finalPlacement = await prisma.practiceQuestionPlacement.findFirstOrThrow({
        where: { roadmapId: storedRoadmaps[0]!.id, practiceSessionKey: "architecture-system-design" },
        include: { questionProgress: { include: { prepQuestionTemplate: true } } }
      });
      const finalQuestion = finalPlacement.questionProgress.prepQuestionTemplate!;
      const finalAnswerKey = finalQuestion.answerKey as {
        correctOptionIndex?: number;
      } | null;
      const finalSelectedOption =
        finalQuestion.format === "mcq" && Number.isInteger(finalAnswerKey?.correctOptionIndex)
          ? finalAnswerKey!.correctOptionIndex!
          : null;
      const finalAnswer =
        finalSelectedOption === null
          ? [...finalQuestion.goodAnswerSignals, ...finalQuestion.whatItTests]
              .join(" ")
              .padEnd(240, " concrete mechanism and trade-off")
          : `option:${finalSelectedOption}`;
      await prepPractice.attempt(ownerId, {
        requestId: randomUUID(),
        sessionKey: "architecture-system-design",
        questionId: finalPlacement.questionProgress.prepQuestionTemplateId!,
        action: "submit",
        answer: finalAnswer,
        selectedOptionIndex: finalSelectedOption,
        durationMs: 1_000
      });
      const sharedPlacements = await prisma.practiceQuestionPlacement.findMany({
        where: { questionProgressId: finalPlacement.questionProgressId },
        include: { sessionProgress: true, questionProgress: true }
      });
      expect(sharedPlacements).toHaveLength(2);
      expect(
        sharedPlacements.every((placement) => placement.questionProgress.status === "COMPLETED")
      ).toBe(true);
      expect(
        sharedPlacements.every((placement) => placement.sessionProgress.completedQuestions >= 1)
      ).toBe(true);
    } finally {
      await deleteIntegrationCandidate(prisma, ownerId);
      expect(await prisma.candidateProfile.count({ where: { ownerId } })).toBe(0);
      expect(await prisma.userRoadmap.count({ where: { ownerId } })).toBe(0);
    }
  });
});

async function deleteIntegrationCandidate(prisma: PrismaService, ownerId: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;
          await tx.candidateProfile.deleteMany({ where: { ownerId } });
        },
        { maxWait: 20_000, timeout: 120_000 }
      );
      return;
    } catch (error) {
      const deadlock = error instanceof Error && /deadlock detected|40P01/i.test(error.message);
      if (!deadlock || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
}

function regeneratedPlan(plan: PersonalizedInterviewPlan): PersonalizedInterviewPlan {
  return {
    ...plan,
    id: randomUUID(),
    revision: plan.revision + 1,
    generatedAt: plan.generatedAt + 1,
    sessions: plan.sessions.map((session) => ({
      ...session,
      id: randomUUID(),
      title: `${session.title} · refreshed`
    }))
  };
}

function progressFields(row: {
  id: string;
  practiceSessionKey: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  attemptedQuestions: number;
  completedQuestions: number;
  progressPercent: number;
}) {
  return {
    id: row.id,
    practiceSessionKey: row.practiceSessionKey,
    status: row.status,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    attemptedQuestions: row.attemptedQuestions,
    completedQuestions: row.completedQuestions,
    progressPercent: row.progressPercent
  };
}
