import { AiMlPracticeQuestionStatus, AiMlPracticeTrack } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AiService } from "@/server/ai/ai.service";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AiMlPracticeService } from "./ai-ml-practice.service";
import { aiMlStoryPaths } from "../domain/ai-ml-story-catalog";
import { appliedEngineeringLab } from "../domain/applied-engineering-lab";
import { aiMlQuickCheckPath } from "../domain/ai-ml-quick-check-catalog";
import { frontendStoryPaths } from "@/features/practice/story-tracks/domain/frontend-story-catalog";
import { AiMlStoryPracticeService } from "./ai-ml-story-practice.service";

const ownerId = "user:ai-ml-test";
const questionId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const authored = aiMlStoryPaths("core-technical")[0]!.questions[0]!;
const publicSnapshot = {
  id: authored.id,
  title: authored.title,
  prompt: authored.prompt,
  options: [],
  pathKey: authored.pathKey,
  format: authored.format,
  artifact: authored.artifact,
  topicKeys: authored.topicKeys,
  interviewConnection: authored.interviewConnection
};
const privateSnapshot = {
  answer: authored.answer,
  hints: authored.hints,
  rubric: authored.rubric,
  commonMistakes: authored.commonMistakes,
  interviewerFollowUps: authored.interviewerFollowUps
};
const feedback = {
  schemaVersion: 1,
  score: 8,
  result: "You identified the main failure boundary.",
  didWell: "You identified leakage.",
  mechanism: "Future information entered the evaluation set.",
  missingOrIncorrect: "The split also needs to be customer-disjoint.",
  productionConsequence: "The offline score will overstate production performance.",
  transferExample: "Use an as-of-time feature check for a fraud model too.",
  interviewerFollowUp: "How would you check other fields for leakage?",
  missedEdgeCases: []
} as const;

function questionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: questionId,
    sessionId: "session-1",
    ownerId,
    questionKey: authored.id,
    order: 9,
    contentVersion: 3,
    contentFingerprint: "sha256:question",
    status: AiMlPracticeQuestionStatus.ACTIVE,
    publicSnapshot,
    privateSnapshot,
    draft: null,
    revealedHintCount: 0,
    attempt: null,
    session: {
      track: AiMlPracticeTrack.CORE_TECHNICAL,
      // question() reads path peers from the row's session in the same query.
      questions: [{ id: questionId, publicSnapshot }]
    },
    ...overrides
  };
}

function service(database: Record<string, unknown>, ai = vi.fn()) {
  return new AiMlStoryPracticeService(
    {
      $executeRaw: vi.fn(),
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({ $executeRaw: vi.fn(), ...database }),
      ...database
    } as unknown as PrismaService,
    { session: vi.fn() } as unknown as AiMlPracticeService,
    { generateStructured: ai } as unknown as Pick<AiService, "generateStructured">
  );
}

describe("AiMlStoryPracticeService", () => {
  it("adds only missing authored paths and keeps the original cohort in the first path", async () => {
    const legacyRows = Array.from({ length: 8 }, (_, index) => ({
      ...questionRow({
        id: `legacy-${index + 1}`,
        questionKey: `ai-ml-core-${index + 1}`,
        order: index + 1,
        contentVersion: 4,
        publicSnapshot: {
          id: `ai-ml-core-${index + 1}`,
          title: `Question ${index + 1}`,
          prompt: `Question ${index + 1}`,
          options: [{ id: "a", label: "Check the evidence" }]
        },
        privateSnapshot: { correctOptionId: "a", explanation: "Use the evidence." }
      })
    }));
    const createdRows = aiMlStoryPaths("core-technical").flatMap((path) =>
      path.questions.map((question, index) =>
        questionRow({
          id: `story-${question.id}`,
          questionKey: question.id,
          order: 9 + index,
          publicSnapshot: {
            ...publicSnapshot,
            id: question.id,
            pathKey: question.pathKey,
            title: question.title,
            prompt: question.prompt,
            format: question.format,
            options: (question.choices ?? []).map((label, choiceIndex) => ({
              id: String(choiceIndex),
              label
            })),
            artifact: question.artifact
          },
          privateSnapshot: {
            ...privateSnapshot,
            answer: question.answer,
            hints: question.hints,
            rubric: question.rubric,
            correctChoiceIndex: question.correctChoiceIndex
          }
        })
      )
    );
    const findUnique = vi
      .fn()
      // The lock-free published check reads the unpublished session first.
      .mockResolvedValueOnce({ id: "session-1", questions: legacyRows })
      .mockResolvedValueOnce({ id: "session-1", questions: legacyRows })
      .mockResolvedValueOnce({ id: "session-1", questions: [...legacyRows, ...createdRows] });
    const createMany = vi.fn().mockResolvedValue({ count: 19 });
    const update = vi.fn().mockResolvedValue({});
    const subject = service({
      aiMlPracticeSession: { findUnique, update },
      aiMlPracticeQuestion: { createMany }
    });

    const result = await subject.session(ownerId, "core-technical");

    expect(createMany).toHaveBeenCalledOnce();
    expect(createMany.mock.calls[0]![0].data).toHaveLength(19);
    expect(update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { status: "ACTIVE", completedAt: null }
    });
    expect(result.blocks).toHaveLength(4);
    expect(result.blocks.map((block) => block.questions.length)).toEqual([7, 6, 6, 8]);
    expect(result.totalQuestions).toBe(27);
    expect(result.blocks[0]!.questions[0]!.authorizedAnswer).toBeNull();
    expect(result.blocks[3]!.questions[0]!.id).toBe("legacy-1");
  });

  it("serves an already-published session without a transaction or owner lock", async () => {
    const required = [
      ...aiMlStoryPaths("core-technical").flatMap((path) => path.questions),
      ...aiMlQuickCheckPath("core-technical").questions
    ];
    const rows = required.map((question, index) =>
      questionRow({
        id: `row-${question.id}`,
        questionKey: question.id,
        order: index + 1,
        contentVersion: 99,
        publicSnapshot: {
          ...publicSnapshot,
          id: question.id,
          pathKey: question.pathKey,
          title: question.title,
          prompt: question.prompt,
          format: question.format,
          artifact: question.artifact,
          options: (question.choices ?? []).map((label, choice) => ({ id: String(choice), label }))
        }
      })
    );
    const findUnique = vi.fn().mockResolvedValue({ id: "session-1", questions: rows });
    const transaction = vi.fn();
    const legacySession = vi.fn();
    const subject = new AiMlStoryPracticeService(
      {
        $transaction: transaction,
        aiMlPracticeSession: { findUnique }
      } as unknown as PrismaService,
      { session: legacySession } as unknown as AiMlPracticeService,
      { generateStructured: vi.fn() } as unknown as Pick<AiService, "generateStructured">
    );

    const result = await subject.session(ownerId, "core-technical");

    expect(findUnique).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
    expect(legacySession).not.toHaveBeenCalled();
    expect(result.totalQuestions).toBe(required.length);
  });

  it("creates a frontend cohort from its own catalog without the AI/ML legacy questions", async () => {
    const authored = frontendStoryPaths("core-technical").flatMap((path) => path.questions);
    const rows = authored.map((question, index) =>
      questionRow({
        id: `row-${question.id}`,
        questionKey: question.id,
        order: index + 1,
        publicSnapshot: {
          ...publicSnapshot,
          id: question.id,
          pathKey: question.pathKey,
          title: question.title,
          prompt: question.prompt,
          format: question.format,
          artifact: question.artifact,
          options: (question.choices ?? []).map((label, choice) => ({ id: String(choice), label }))
        }
      })
    );
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null) // lock-free published check
      .mockResolvedValueOnce(null) // inside the transaction
      .mockResolvedValueOnce({ id: "session-f", questions: [] }) // after create
      .mockResolvedValueOnce({ id: "session-f", questions: rows }); // after createMany
    const create = vi.fn().mockResolvedValue({});
    const createMany = vi.fn().mockResolvedValue({ count: authored.length });
    const legacySession = vi.fn();
    const database = {
      aiMlPracticeSession: { findUnique, create, update: vi.fn() },
      aiMlPracticeQuestion: { createMany }
    };
    const subject = new AiMlStoryPracticeService(
      {
        $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
          work({ $executeRaw: vi.fn(), ...database }),
        ...database
      } as unknown as PrismaService,
      { session: legacySession } as unknown as AiMlPracticeService,
      { generateStructured: vi.fn() } as unknown as Pick<AiService, "generateStructured">
    );

    const result = await subject.session(ownerId, "core-technical", undefined, "frontend");

    expect(legacySession).not.toHaveBeenCalled();
    expect(create.mock.calls[0]![0].data).toMatchObject({
      ownerId,
      discipline: "frontend",
      track: AiMlPracticeTrack.CORE_TECHNICAL
    });
    expect(findUnique.mock.calls[0]![0].where).toEqual({
      ownerId_discipline_track: {
        ownerId,
        discipline: "frontend",
        track: AiMlPracticeTrack.CORE_TECHNICAL
      }
    });
    const created = createMany.mock.calls[0]![0].data as Array<{
      questionKey: string;
      order: number;
    }>;
    expect(created.map((item) => item.questionKey)).toEqual(
      authored.map((question) => question.id)
    );
    // No reserved legacy slots: frontend questions start at order 1.
    expect(created[0]!.order).toBe(1);
    expect(result.discipline).toBe("frontend");
    expect(result.totalQuestions).toBe(authored.length);
    expect(result.blocks[0]!.story.candidateRole).toBe("frontend engineer");
  });

  it("appends new first-path questions after occupied order slots in an existing session", async () => {
    const all = aiMlStoryPaths("core-technical").flatMap((path) => path.questions);
    const legacy = Array.from({ length: 8 }, (_, index) =>
      questionRow({
        id: `legacy-${index + 1}`,
        questionKey: `ai-ml-core-${index + 1}`,
        order: index + 1,
        contentVersion: 4,
        publicSnapshot: {
          id: `ai-ml-core-${index + 1}`,
          title: `Old question ${index + 1}`,
          prompt: `Old question ${index + 1}`,
          options: [{ id: "a", label: "Old answer" }]
        }
      })
    );
    const authoredRow = (question: (typeof all)[number], order: number) =>
      questionRow({
        id: `story-${question.id}`,
        questionKey: question.id,
        order,
        publicSnapshot: {
          ...publicSnapshot,
          id: question.id,
          title: question.title,
          prompt: question.prompt,
          format: question.format,
          pathKey: question.pathKey,
          artifact: question.artifact,
          options: (question.choices ?? []).map((label, index) => ({ id: String(index), label }))
        },
        privateSnapshot: { ...privateSnapshot, answer: question.answer, rubric: question.rubric }
      });
    const oldAuthored = all
      .filter(
        (question) =>
          ![
            "ai-ml-core-11",
            "ai-ml-core-12",
            "ai-ml-core-13",
            "ai-ml-core-14",
            "ai-ml-core-15"
          ].includes(question.id)
      )
      .map((question, index) => authoredRow(question, 9 + index));
    const newAuthored = all
      .filter((question) =>
        [
          "ai-ml-core-11",
          "ai-ml-core-12",
          "ai-ml-core-13",
          "ai-ml-core-14",
          "ai-ml-core-15"
        ].includes(question.id)
      )
      .map((question, index) => authoredRow(question, 23 + index));
    const findUnique = vi
      .fn()
      // The lock-free published check reads the unpublished session first.
      .mockResolvedValueOnce({ id: "session-1", questions: [...legacy, ...oldAuthored] })
      .mockResolvedValueOnce({ id: "session-1", questions: [...legacy, ...oldAuthored] })
      .mockResolvedValueOnce({
        id: "session-1",
        questions: [...legacy, ...oldAuthored, ...newAuthored]
      });
    const createMany = vi.fn().mockResolvedValue({ count: 4 });
    const subject = service({
      aiMlPracticeSession: { findUnique, update: vi.fn() },
      aiMlPracticeQuestion: { createMany }
    });

    const result = await subject.session(ownerId, "core-technical");

    expect(createMany.mock.calls[0]![0].data.map((item: { order: number }) => item.order)).toEqual([
      23, 24, 25, 26, 27
    ]);
    expect(result.blocks[0]!.questions).toHaveLength(7);
    expect(result.totalQuestions).toBe(27);
  });

  it("upgrades active quick checks, archives unsubmitted drafts, and keeps completed answers frozen", async () => {
    const quick = aiMlQuickCheckPath("core-technical").questions;
    const legacyPublic = (index: number) => ({
      id: quick[index]!.id,
      title: quick[index]!.prompt,
      prompt: quick[index]!.prompt,
      options: [
        { id: "correct", label: "Old answer" },
        { id: "wrong", label: "Old distractor" }
      ]
    });
    const legacyPrivate = { correctOptionId: "correct", explanation: "Old explanation." };
    const untouched = questionRow({
      id: "legacy-1",
      questionKey: quick[0]!.id,
      order: 1,
      contentVersion: 2,
      publicSnapshot: legacyPublic(0),
      privateSnapshot: legacyPrivate
    });
    const drafted = questionRow({
      id: "legacy-2",
      questionKey: quick[1]!.id,
      order: 2,
      contentVersion: 2,
      publicSnapshot: legacyPublic(1),
      privateSnapshot: legacyPrivate,
      draft: { kind: "choice", selectedChoiceIndex: 1 }
    });
    const completed = questionRow({
      id: "legacy-3",
      questionKey: quick[2]!.id,
      order: 3,
      contentVersion: 2,
      publicSnapshot: legacyPublic(2),
      privateSnapshot: legacyPrivate,
      status: AiMlPracticeQuestionStatus.COMPLETED,
      attempt: {
        id: "saved-answer",
        selectedOptionId: "correct",
        answerSnapshot: { kind: "choice", selectedChoiceIndex: 0 },
        evaluationSnapshot: {},
        createdAt: new Date("2026-01-01T00:00:00Z")
      }
    });
    const otherQuick = quick.slice(3).map((question, index) =>
      questionRow({
        id: `legacy-${index + 4}`,
        questionKey: question.id,
        order: index + 4,
        contentVersion: 4,
        publicSnapshot: legacyPublic(index + 3),
        privateSnapshot: legacyPrivate
      })
    );
    const authoredRows = aiMlStoryPaths("core-technical").flatMap((path) =>
      path.questions.map((question, index) =>
        questionRow({
          id: `story-${question.id}`,
          questionKey: question.id,
          order: 9 + index,
          publicSnapshot: {
            ...publicSnapshot,
            id: question.id,
            title: question.title,
            prompt: question.prompt,
            pathKey: path.key,
            format: question.format,
            artifact: question.artifact
          },
          privateSnapshot: { ...privateSnapshot, answer: question.answer, rubric: question.rubric }
        })
      )
    );
    const initial = [untouched, drafted, completed, ...otherQuick, ...authoredRows];
    const upgraded = {
      ...untouched,
      contentVersion: 4,
      publicSnapshot: {
        ...legacyPublic(0),
        title: quick[0]!.title,
        prompt: quick[0]!.prompt,
        pathKey: "quick-check",
        format: quick[0]!.format,
        artifact: quick[0]!.artifact
      }
    };
    const upgradedDrafted = {
      ...drafted,
      contentVersion: 4,
      draft: null,
      publicSnapshot: {
        ...legacyPublic(1),
        title: quick[1]!.title,
        prompt: quick[1]!.prompt,
        pathKey: "quick-check",
        format: quick[1]!.format,
        artifact: quick[1]!.artifact,
        revisionNote: "This case was updated. Your unsubmitted choice is preserved."
      }
    };
    const findUnique = vi
      .fn()
      // The lock-free published check reads the unpublished session first.
      .mockResolvedValueOnce({ id: "session-1", questions: initial })
      .mockResolvedValueOnce({ id: "session-1", questions: initial })
      .mockResolvedValueOnce({
        id: "session-1",
        questions: [upgraded, upgradedDrafted, ...initial.slice(2)]
      });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const subject = service({
      aiMlPracticeSession: { findUnique },
      aiMlPracticeQuestion: { updateMany }
    });

    const result = await subject.session(ownerId, "core-technical");

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "legacy-1", ownerId, attempt: { is: null } }),
        data: expect.objectContaining({
          contentVersion: 4,
          publicSnapshot: expect.objectContaining({
            format: "mcq",
            artifact: expect.objectContaining({ kind: "metrics" })
          })
        })
      })
    );
    expect(result.blocks[3]!.questions).toHaveLength(8);
    expect(result.blocks[3]!.questions[0]!.question.artifact.kind).toBe("metrics");
    expect(result.blocks[3]!.questions[1]!.draft).toBeNull();
    expect(result.blocks[3]!.questions[1]!.question.revisionNote).toContain("preserved");
    const draftUpdate = updateMany.mock.calls.find((call) => call[0].where.id === "legacy-2");
    expect(draftUpdate?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          draft: { equals: { kind: "choice", selectedChoiceIndex: 1 } }
        }),
        data: expect.objectContaining({
          privateSnapshot: expect.objectContaining({
            previousVersion: expect.objectContaining({
              draft: { kind: "choice", selectedChoiceIndex: 1 }
            })
          })
        })
      })
    );
    expect(updateMany.mock.calls.some((call) => call[0].where.id === "legacy-3")).toBe(false);
    expect(result.blocks[3]!.questions[2]!.latestAttempt?.id).toBe("saved-answer");
  });

  it("reveals only the requested hint and never exposes the answer before completion", async () => {
    const findFirst = vi.fn().mockResolvedValue(questionRow());
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const subject = service({
      aiMlPracticeQuestion: {
        findFirst,
        findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot }]),
        updateMany
      }
    });

    const before = await subject.question(ownerId, questionId);
    expect(before.revealedHints).toEqual([]);
    expect(before.authorizedAnswer).toBeNull();
    await subject.revealHint(ownerId, { questionId, hintNumber: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId, revealedHintCount: 0 }),
        data: { revealedHintCount: 1 }
      })
    );
  });

  it("keeps evidence aligned with a frozen legacy answer after a catalog rewrite", async () => {
    const old = {
      id: "ai-ml-core-7",
      title: "What prevents training-serving skew?",
      prompt: "What prevents training-serving skew?",
      options: [
        { id: "correct", label: "Use one versioned feature definition." },
        { id: "wrong", label: "Ignore the drift." }
      ]
    };
    const subject = service({
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(
          questionRow({
            questionKey: old.id,
            publicSnapshot: old,
            privateSnapshot: {
              correctOptionId: "correct",
              explanation: "Keep training and serving transformations in parity."
            },
            status: AiMlPracticeQuestionStatus.LEARNED
          })
        ),
        findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot: old }])
      }
    });

    const result = await subject.question(ownerId, questionId);

    expect(result.question.prompt).toBe(old.prompt);
    expect(result.question.artifact.title).toBe("feature_parity.py");
    expect(result.question.artifact.content).not.toContain("predict_proba");
    expect(result.question.interviewConnection).toContain("Training and serving");
  });

  it("saves a written draft without committing an evaluated answer", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const subject = service({
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(questionRow()),
        findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot }]),
        updateMany
      }
    });

    await subject.saveDraft(ownerId, {
      questionId,
      draft: { kind: "text", text: "The future timestamp leaks." }
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: questionId, ownerId, status: AiMlPracticeQuestionStatus.ACTIVE },
      data: { draft: { kind: "text", text: "The future timestamp leaks." } }
    });
  });

  it("grades a choice deterministically without calling the text evaluator", async () => {
    const choice = aiMlStoryPaths("core-technical")[1]!.questions[0]!;
    const selected = choice.correctChoiceIndex!;
    const source = {
      ...publicSnapshot,
      format: "mcq",
      options: choice.choices!.map((label, index) => ({ id: String(index), label }))
    };
    const hidden = {
      ...privateSnapshot,
      answer: choice.answer,
      correctChoiceIndex: selected
    };
    const attemptCreate = vi.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: vi.fn(),
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          status: AiMlPracticeQuestionStatus.ACTIVE,
          contentFingerprint: "sha256:question",
          attempt: null
        }),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1)
      },
      aiMlPracticeAttempt: { create: attemptCreate },
      aiMlPracticeSession: { update: vi.fn() }
    };
    const generateStructured = vi.fn();
    const subject = service(
      {
        aiMlPracticeQuestion: {
          findFirst: vi
            .fn()
            .mockResolvedValue(questionRow({ publicSnapshot: source, privateSnapshot: hidden })),
          findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot: source }])
        },
        $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx))
      },
      generateStructured
    );

    await subject.submitAttempt(ownerId, {
      questionId,
      requestId,
      work: { kind: "choice", selectedChoiceIndex: selected }
    });

    expect(generateStructured).not.toHaveBeenCalled();
    expect(attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        selectedOptionId: String(selected),
        correct: true,
        evaluationSnapshot: expect.objectContaining({
          feedback: expect.objectContaining({ score: 10 })
        })
      })
    });
  });

  it("grades a data-discipline answer as a data engineer would", async () => {
    const generateStructured = vi.fn().mockResolvedValue(feedback);
    const tx = {
      $executeRaw: vi.fn(),
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          status: AiMlPracticeQuestionStatus.ACTIVE,
          contentFingerprint: "sha256:question",
          attempt: null
        }),
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(1)
      },
      aiMlPracticeAttempt: { create: vi.fn().mockResolvedValue({}) },
      aiMlPracticeSession: { update: vi.fn() }
    };
    const row = questionRow();
    const subject = service(
      {
        aiMlPracticeQuestion: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...row, session: { ...row.session, discipline: "data" } })
        },
        $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx))
      },
      generateStructured
    );

    await subject.submitAttempt(ownerId, {
      questionId,
      requestId,
      work: { kind: "text", text: "Aggregate at the order grain before joining line items." }
    });

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "data.practice.attempt",
        systemInstruction: expect.stringContaining("experienced senior data engineer")
      })
    );
  });

  it("grades written evidence with the frozen rubric and persists the reviewed attempt", async () => {
    const generateStructured = vi.fn().mockResolvedValue(feedback);
    const attemptCreate = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: vi.fn(),
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          status: AiMlPracticeQuestionStatus.ACTIVE,
          contentFingerprint: "sha256:question",
          attempt: null
        }),
        update,
        count: vi.fn().mockResolvedValue(1)
      },
      aiMlPracticeAttempt: { create: attemptCreate },
      aiMlPracticeSession: { update: vi.fn() }
    };
    const subject = service(
      {
        aiMlPracticeQuestion: {
          findFirst: vi.fn().mockResolvedValue(questionRow()),
          findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot }])
        },
        $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx))
      },
      generateStructured
    );
    const response =
      "The cancellation timestamp leaks future information, and customers overlap across the random row split. I would use an as-of-time feature set and customer-disjoint chronological validation.";

    await subject.submitAttempt(ownerId, {
      questionId,
      requestId,
      work: { kind: "text", text: response }
    });

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ai-ml.practice.attempt",
        prompt: expect.stringContaining("customer-disjoint")
      })
    );
    expect(attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        questionId,
        requestId,
        selectedOptionId: null,
        answerSnapshot: { kind: "text", text: response },
        evaluationSnapshot: { evaluatorVersion: "ai-ml-story-v1", feedback }
      })
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: questionId },
      data: expect.objectContaining({ status: AiMlPracticeQuestionStatus.COMPLETED })
    });
  });
  it("keeps interaction scoring rules private and scores saved structured work without an AI call", async () => {
    const question = appliedEngineeringLab.questions[2]!;
    const source = {
      ...publicSnapshot,
      format: question.format,
      interaction: question.interaction
    };
    const hidden = {
      ...privateSnapshot,
      answer: question.answer,
      interactionRubric: question.interactionRubric
    };
    const row = questionRow({ publicSnapshot: source, privateSnapshot: hidden });
    const create = vi.fn().mockResolvedValue({});
    const lock = vi.fn();
    const tx = {
      $executeRaw: lock,
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(row),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      },
      aiMlPracticeAttempt: { create },
      aiMlPracticeSession: { update: vi.fn() }
    };
    const generateStructured = vi.fn();
    const subject = service(
      {
        aiMlPracticeQuestion: {
          findFirst: vi.fn().mockResolvedValue(row),
          findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot: source }])
        },
        $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx)
        )
      },
      generateStructured
    );
    const view = await subject.question(ownerId, questionId);
    expect(view.question.interaction).toEqual(question.interaction);
    expect(view.authorizedAnswer).toBeNull();
    expect(JSON.stringify(view)).not.toContain("interactionRubric");
    const work = {
      kind: "interactive",
      response: {
        type: "configuration",
        values: { threshold: 0.4, reviews: 150, recall: 90, precision: 60 }
      }
    };
    await subject.submitAttempt(ownerId, { questionId, requestId, work });
    expect(generateStructured).not.toHaveBeenCalled();
    expect(lock).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        answerSnapshot: work,
        selectedOptionId: null,
        evaluationSnapshot: {
          evaluatorVersion: "interactive-rubric-v1",
          feedback: expect.objectContaining({ score: 10 })
        }
      })
    });
    expect(tx.aiMlPracticeSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ status: "COMPLETED" })
    });
  });

  it("rejects incomplete interactions and text submissions to interactive questions", async () => {
    const source = {
      ...publicSnapshot,
      interaction: appliedEngineeringLab.questions[0]!.interaction
    };
    const transaction = vi.fn();
    const subject = service({
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(questionRow({ publicSnapshot: source }))
      },
      $transaction: transaction
    });
    await expect(
      subject.submitAttempt(ownerId, {
        questionId,
        requestId,
        work: { kind: "interactive", response: { type: "sequence", order: ["contain"] } }
      })
    ).rejects.toThrow("every step");
    await expect(
      subject.submitAttempt(ownerId, {
        questionId,
        requestId,
        work: { kind: "text", text: "Just deploy everything" }
      })
    ).rejects.toThrow("answer controls");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a draft whose response kind does not match the question", async () => {
    const updateMany = vi.fn();
    const subject = service({
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(questionRow()),
        findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot }]),
        updateMany
      }
    });
    await expect(
      subject.saveDraft(ownerId, { questionId, draft: { kind: "choice", selectedChoiceIndex: 0 } })
    ).rejects.toThrow("answer controls");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses to commit feedback after the frozen content changes during evaluation", async () => {
    const create = vi.fn();
    const tx = {
      $executeRaw: vi.fn(),
      aiMlPracticeQuestion: {
        findFirst: vi.fn().mockResolvedValue(questionRow({ contentFingerprint: "sha256:new" }))
      },
      aiMlPracticeAttempt: { create }
    };
    const subject = service(
      {
        aiMlPracticeQuestion: { findFirst: vi.fn().mockResolvedValue(questionRow()) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx)
        )
      },
      vi.fn().mockResolvedValue(feedback)
    );
    await expect(
      subject.submitAttempt(ownerId, {
        questionId,
        requestId,
        work: { kind: "text", text: "Remove the future feature" }
      })
    ).rejects.toThrow("changed while");
    expect(create).not.toHaveBeenCalled();
  });

  it("replays an identical attempt committed while evaluation was running", async () => {
    const work = { kind: "text", text: "Remove the future feature" };
    const create = vi.fn();
    const tx = {
      $executeRaw: vi.fn(),
      aiMlPracticeQuestion: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            questionRow({ status: "COMPLETED", attempt: { requestId, answerSnapshot: work } })
          )
      },
      aiMlPracticeAttempt: { create }
    };
    const subject = service(
      {
        aiMlPracticeQuestion: {
          findFirst: vi.fn().mockResolvedValue(questionRow()),
          findMany: vi.fn().mockResolvedValue([{ id: questionId, publicSnapshot }])
        },
        $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx)
        )
      },
      vi.fn().mockResolvedValue(feedback)
    );
    await expect(
      subject.submitAttempt(ownerId, { questionId, requestId, work })
    ).resolves.toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });
  it("reports completed paths without inventing an assessment or a current unfinished path", async () => {
    const questions = [
      ...aiMlStoryPaths("core-technical"),
      aiMlQuickCheckPath("core-technical")
    ].flatMap((path) =>
      path.questions.map((question, index) =>
        questionRow({
          id: question.id,
          questionKey: question.id,
          order: index + 1,
          status: "COMPLETED",
          contentVersion: 4,
          publicSnapshot: {
            id: question.id,
            title: question.title,
            prompt: question.prompt,
            pathKey: path.key,
            format: question.format,
            artifact: question.artifact,
            options: []
          },
          privateSnapshot: {
            answer: question.answer,
            hints: question.hints,
            rubric: question.rubric
          }
        })
      )
    );
    const subject = service({
      aiMlPracticeSession: { findUnique: vi.fn().mockResolvedValue({ id: "session-1", questions }) }
    });
    const session = await subject.session(ownerId, "core-technical");
    expect(session.blocks.every((block) => block.status === "COMPLETED")).toBe(true);
    expect(session.blocks.every((block) => block.assessment === null && !block.isCurrent)).toBe(
      true
    );
    expect(session.terminalQuestions).toBe(session.totalQuestions);
  });
});
