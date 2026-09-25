import {
  AiMlPracticeQuestionStatus,
  AiMlPracticeSessionStatus,
  AiMlPracticeTrack,
  type Prisma
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { aiMlPracticeQuestionCount } from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import { aiMlStarterPractice } from "@/features/practice/ai-ml/domain/resume-practice-path";
import type { CandidateProfile } from "@/lib/shared/types";
import type { PrismaService } from "@/server/database/prisma.service";
import { AiMlPracticeService } from "./ai-ml-practice.service";

const ownerId = "user:test";
const requestId = "4ea62f72-9ccc-4f0a-a1d9-ebd6f867b809";
const questionId = "5b6b965a-cc94-491f-9655-8bcc096942bc";

describe("AiMlPracticeService", () => {
  it("freezes authored content and never exposes the private answer before an attempt", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockImplementation(async ({ data }) => {
      const question = data.questions.create[0];
      return sessionRecord({
        contentFingerprint: data.contentFingerprint,
        publicSnapshot: question.publicSnapshot,
        privateSnapshot: question.privateSnapshot
      });
    });
    const service = new AiMlPracticeService(
      prisma({ aiMlPracticeSession: { findUnique, create } })
    );

    const result = await service.session(ownerId, "core-technical");

    expect(result.questions[0]).toMatchObject({
      databaseId: questionId,
      selectedOptionId: null,
      correct: null,
      explanation: null
    });
    expect(result.questions[0]).not.toHaveProperty("correctOptionId");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId,
          track: AiMlPracticeTrack.CORE_TECHNICAL,
          contentFingerprint: expect.stringMatching(/^sha256:/)
        })
      })
    );
    expect(create.mock.calls[0]?.[0].data.questions.create[0]).not.toHaveProperty("ownerId");
  });

  it("stores one immutable deterministic attempt and completes the session", async () => {
    const initial = sessionRecord();
    const completed = sessionRecord({
      status: AiMlPracticeSessionStatus.COMPLETED,
      questionStatus: AiMlPracticeQuestionStatus.COMPLETED,
      attempt: {
        id: "attempt-1",
        ownerId,
        questionId,
        requestId,
        contentFingerprint: "sha256:question",
        selectedOptionId: "a",
        correct: true,
        answerSnapshot: { selectedOptionId: "a" },
        evaluationSnapshot: { evaluatorVersion: "ai-ml-deterministic-mcq-v1" },
        createdAt: new Date("2026-09-21T12:00:00Z")
      }
    });
    const findUnique = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(completed);
    const attemptCreate = vi.fn().mockResolvedValue({});
    const questionUpdate = vi.fn().mockResolvedValue({});
    const sessionUpdate = vi.fn().mockResolvedValue({});
    const transaction = vi.fn(async (operation) =>
      operation({
        aiMlPracticeQuestion: {
          findFirst: vi.fn().mockResolvedValue(initial.questions[0]),
          update: questionUpdate,
          count: vi.fn().mockResolvedValue(0)
        },
        aiMlPracticeAttempt: { create: attemptCreate },
        aiMlPracticeSession: { update: sessionUpdate }
      })
    );
    const service = new AiMlPracticeService(
      prisma({ aiMlPracticeSession: { findUnique }, $transaction: transaction })
    );

    const result = await service.answer(ownerId, {
      requestId,
      track: "core-technical",
      questionId,
      optionId: "a"
    });

    expect(attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        questionId,
        requestId,
        selectedOptionId: "a",
        correct: true
      })
    });
    expect(questionUpdate).toHaveBeenCalledWith({
      where: { id: questionId },
      data: expect.objectContaining({ status: AiMlPracticeQuestionStatus.COMPLETED })
    });
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: initial.id },
      data: expect.objectContaining({ status: AiMlPracticeSessionStatus.COMPLETED })
    });
    expect(result).toMatchObject({
      status: "COMPLETED",
      completedQuestions: 1,
      progressPercent: 100,
      questions: [
        expect.objectContaining({
          selectedOptionId: "a",
          correctOptionId: "a",
          correct: true,
          explanation: expect.any(String)
        })
      ]
    });
  });

  it("returns the saved answer on retry without creating another attempt", async () => {
    const saved = sessionRecord({
      questionStatus: AiMlPracticeQuestionStatus.COMPLETED,
      attempt: {
        id: "attempt-1",
        ownerId,
        questionId,
        requestId,
        contentFingerprint: "sha256:question",
        selectedOptionId: "a",
        correct: true,
        answerSnapshot: { selectedOptionId: "a" },
        evaluationSnapshot: { evaluatorVersion: "ai-ml-deterministic-mcq-v1" },
        createdAt: new Date()
      }
    });
    const attemptCreate = vi.fn();
    const service = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: { findUnique: vi.fn().mockResolvedValue(saved) },
        $transaction: vi.fn(async (operation) =>
          operation({
            aiMlPracticeQuestion: { findFirst: vi.fn().mockResolvedValue(saved.questions[0]) },
            aiMlPracticeAttempt: { create: attemptCreate }
          })
        )
      })
    );

    await expect(
      service.answer(ownerId, { requestId, track: "core-technical", questionId, optionId: "a" })
    ).resolves.toMatchObject({ completedQuestions: 1 });
    expect(attemptCreate).not.toHaveBeenCalled();
    await expect(
      service.answer(ownerId, { requestId, track: "core-technical", questionId, optionId: "b" })
    ).rejects.toThrow("already has a saved answer");
    expect(attemptCreate).not.toHaveBeenCalled();
  });

  it("rejects an option outside the frozen question without saving an attempt", async () => {
    const current = sessionRecord();
    const attemptCreate = vi.fn();
    const service = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: { findUnique: vi.fn().mockResolvedValue(current) },
        $transaction: vi.fn(async (operation) =>
          operation({
            aiMlPracticeQuestion: { findFirst: vi.fn().mockResolvedValue(current.questions[0]) },
            aiMlPracticeAttempt: { create: attemptCreate }
          })
        )
      })
    );

    await expect(
      service.answer(ownerId, { requestId, track: "core-technical", questionId, optionId: "x" })
    ).rejects.toThrow("does not belong to this question");
    expect(attemptCreate).not.toHaveBeenCalled();
  });

  it("does not let the retired MCQ endpoint answer a revised written case", async () => {
    const current = sessionRecord({
      publicSnapshot: {
        id: "ai-ml-core-1",
        title: "Investigate the evidence",
        prompt: "Explain the decision using the evidence.",
        format: "written",
        options: [
          { id: "a", label: "Old choice A" },
          { id: "b", label: "Old choice B" }
        ]
      }
    });
    const attemptCreate = vi.fn();
    const service = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: { findUnique: vi.fn().mockResolvedValue(current) },
        $transaction: vi.fn(async (operation) =>
          operation({
            aiMlPracticeQuestion: { findFirst: vi.fn().mockResolvedValue(current.questions[0]) },
            aiMlPracticeAttempt: { create: attemptCreate }
          })
        )
      })
    );

    await expect(
      service.answer(ownerId, {
        requestId,
        track: "core-technical",
        questionId,
        optionId: "a"
      })
    ).rejects.toThrow("evidence-based written answer");
    expect(attemptCreate).not.toHaveBeenCalled();
  });

  it("returns server progress summaries for the Practice dashboard", async () => {
    const service = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              track: AiMlPracticeTrack.APPLIED_ENGINEERING,
              questions: [
                { status: AiMlPracticeQuestionStatus.COMPLETED },
                { status: AiMlPracticeQuestionStatus.LEARNED },
                { status: AiMlPracticeQuestionStatus.ACTIVE }
              ]
            }
          ])
        }
      })
    );

    await expect(service.summaries(ownerId)).resolves.toEqual([
      {
        track: "applied-engineering",
        totalQuestions: 33,
        completedQuestions: 2,
        progressPercent: 6
      }
    ]);
  });
  it("projects AI/ML practice into the Overview counters and next question", async () => {
    const now = new Date("2026-09-24T12:00:00.000Z"); // Thursday
    const service = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              track: AiMlPracticeTrack.CORE_TECHNICAL,
              questions: [
                dashboardQuestion(
                  "q1",
                  AiMlPracticeQuestionStatus.COMPLETED,
                  "2026-09-23T10:00:00Z"
                ),
                dashboardQuestion("q2", AiMlPracticeQuestionStatus.LEARNED, "2026-09-24T09:00:00Z"),
                dashboardQuestion(
                  "q3",
                  AiMlPracticeQuestionStatus.ACTIVE,
                  null,
                  "Pick the threshold"
                )
              ]
            }
          ])
        }
      })
    );
    const profile = { resume: null, level: "0-2" } as unknown as CandidateProfile;

    const result = await service.dashboardPractice(ownerId, profile, 7, now);

    expect(result).toMatchObject({
      totalQuestions:
        aiMlPracticeQuestionCount("core-technical") +
        aiMlPracticeQuestionCount("applied-engineering"),
      completedQuestions: 2,
      totalAttempts: 2,
      solvedThisWeek: 2,
      currentStreakDays: 2,
      lastActiveAt: Date.parse("2026-09-24T09:00:00Z"),
      nextUp: {
        title: "Pick the threshold",
        href: "/practice/ai-ml/core-technical/questions/q3",
        chapterTitle: "Core Technical · AI/ML"
      }
    });
    expect(result.activity.slice(-2)).toEqual([
      { date: "2026-09-23", solved: 1, attempts: 1 },
      { date: "2026-09-24", solved: 1, attempts: 1 }
    ]);
  });

  it("points a new AI/ML candidate at the first track before any cohort exists", async () => {
    const service = new AiMlPracticeService(
      prisma({ aiMlPracticeSession: { findMany: vi.fn().mockResolvedValue([]) } })
    );
    const profile = { resume: null, level: "0-2" } as unknown as CandidateProfile;

    const result = await service.dashboardPractice(ownerId, profile);

    expect(result.completedQuestions).toBe(0);
    expect(result.totalQuestions).toBeGreaterThan(0);
    expect(result.nextUp).toMatchObject({ href: "/practice/ai-ml/core-technical" });
  });

  it("suggests AI/ML starter paths instead of DSA questions", () => {
    const profile = { resume: null, level: "0-2" } as unknown as CandidateProfile;

    const starters = aiMlStarterPractice(profile);

    expect(starters).toHaveLength(3);
    expect(starters.every((starter) => starter.href.startsWith("/practice/ai-ml/"))).toBe(true);
    expect(starters.every((starter) => starter.difficulty === null)).toBe(true);
  });

  it("does not submit a legacy choice after the question was learned", async () => {
    const learned = sessionRecord({ questionStatus: AiMlPracticeQuestionStatus.LEARNED });
    const create = vi.fn();
    const subject = new AiMlPracticeService(
      prisma({
        aiMlPracticeSession: { findUnique: vi.fn().mockResolvedValue(learned) },
        $transaction: vi.fn(async (work) =>
          work({
            aiMlPracticeQuestion: { findFirst: vi.fn().mockResolvedValue(learned.questions[0]) },
            aiMlPracticeAttempt: { create }
          })
        )
      })
    );
    await expect(
      subject.answer(ownerId, { requestId, track: "core-technical", questionId, optionId: "a" })
    ).rejects.toThrow("completed or learned");
    expect(create).not.toHaveBeenCalled();
  });
});

function sessionRecord(
  overrides: {
    contentFingerprint?: string;
    publicSnapshot?: Prisma.JsonValue;
    privateSnapshot?: Prisma.JsonValue;
    status?: AiMlPracticeSessionStatus;
    questionStatus?: AiMlPracticeQuestionStatus;
    attempt?: Record<string, unknown> | null;
  } = {}
) {
  return {
    id: "session-1",
    ownerId,
    track: AiMlPracticeTrack.CORE_TECHNICAL,
    status: overrides.status ?? AiMlPracticeSessionStatus.ACTIVE,
    schemaVersion: 1,
    contentVersion: 1,
    contentFingerprint: overrides.contentFingerprint ?? "sha256:session",
    titleSnapshot: "AI/ML Core Technical",
    descriptionSnapshot: "A persisted AI/ML practice session.",
    startedAt: new Date("2026-09-21T12:00:00Z"),
    completedAt: overrides.status === AiMlPracticeSessionStatus.COMPLETED ? new Date() : null,
    createdAt: new Date("2026-09-21T12:00:00Z"),
    updatedAt: new Date("2026-09-21T12:00:00Z"),
    questions: [
      {
        id: questionId,
        sessionId: "session-1",
        ownerId,
        questionKey: "ai-ml-core-1",
        order: 1,
        contentVersion: 1,
        contentFingerprint: "sha256:question",
        status: overrides.questionStatus ?? AiMlPracticeQuestionStatus.ACTIVE,
        publicSnapshot: overrides.publicSnapshot ?? {
          id: "ai-ml-core-1",
          title: "How should this model be evaluated?",
          prompt: "Which evaluation boundary best fits this production model?",
          options: [
            { id: "a", label: "Measure the production-aligned outcome." },
            { id: "b", label: "Use training loss alone." }
          ]
        },
        privateSnapshot: overrides.privateSnapshot ?? {
          correctOptionId: "a",
          explanation: "Production-aligned evaluation tests the outcome that users experience."
        },
        completedAt:
          overrides.questionStatus === AiMlPracticeQuestionStatus.COMPLETED ? new Date() : null,
        createdAt: new Date("2026-09-21T12:00:00Z"),
        updatedAt: new Date("2026-09-21T12:00:00Z"),
        attempt: overrides.attempt ?? null
      }
    ]
  };
}

function prisma(value: Record<string, unknown>): PrismaService {
  const transaction = value.$transaction;
  if (typeof transaction === "function") {
    value.$transaction = async (work: (client: unknown) => Promise<unknown>) =>
      (
        transaction as (
          callback: (client: Record<string, unknown>) => Promise<unknown>
        ) => Promise<unknown>
      )((client) => work({ $executeRaw: vi.fn(), ...client }));
  }
  return value as unknown as PrismaService;
}

function dashboardQuestion(
  id: string,
  status: AiMlPracticeQuestionStatus,
  finishedAt: string | null,
  title = `Title ${id}`
) {
  const at = finishedAt ? new Date(finishedAt) : null;
  return {
    id,
    status,
    publicSnapshot: { title, prompt: `Prompt ${id}` },
    completedAt: status === AiMlPracticeQuestionStatus.COMPLETED ? at : null,
    learnedAt: status === AiMlPracticeQuestionStatus.LEARNED ? at : null,
    attempt: at ? { createdAt: at } : null
  };
}
