import { describe, expect, it, vi } from "vitest";
import {
  buildAssessmentPlan,
  buildAssessmentSetup,
  DsaBlockAssessmentRuntimeService
} from "./dsa-block-assessment-runtime.service";
import type { DsaBlockAssessmentSnapshot } from "@/lib/dsa/block-assessment";
import type { PrismaService } from "@/server/database/prisma.service";

const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";

function snapshot(): DsaBlockAssessmentSnapshot {
  const reviewItems = Array.from({ length: 5 }, (_, index) => ({
    id: `review-${index}`,
    family: "static-code-cue" as const,
    sourceAttemptId: ATTEMPT_ID,
    sourceQuestionSlug: `question-${index}`,
    sourceQuestionTitle: `Question ${index}`,
    sourceQuestionPattern: "hash-map",
    sourceCode: "const seen = new Map(); return seen;",
    codeSnippet: "const seen = new Map();",
    prompt: `What does review ${index} show?`,
    options: ["A", "B"],
    correctOption: 1,
    rationale: "The saved code creates a Map.",
    metric: "pattern-recognition" as const,
    grounding: {
      kind: "deterministic-static-analysis" as const,
      source: "saved code",
      detail: "Map detected",
      evidence: {}
    }
  }));
  const transfer = (slug: string) => ({
    slug,
    contentVersion: 1,
    phaseSlug: "arrays",
    title: `Transfer ${slug}`,
    source: "authored",
    externalUrl: "",
    primaryPattern: "hash-map",
    subPatterns: [],
    difficulty: "easy",
    expectedTimeMinutes: 15,
    recommendedOrder: 1,
    prerequisites: [],
    conceptsTested: [],
    commonMistakes: ["none"],
    interviewSignals: [],
    followUpPrompts: [],
    promptSummary: "Solve the problem.",
    highLevelApproach: "SECRET APPROACH",
    complexity: {},
    problemStatement: "Return the answer.",
    constraints: ["n > 0"],
    examples: [{ input: "[1]", output: "1", explanation: "one" }],
    keyInsight: "SECRET INSIGHT",
    hints: ["SECRET HINT"],
    approaches: {},
    edgeCases: [],
    relatedQuestions: [],
    phaseNumber: 1,
    runnerContract: {
      version: 1 as const,
      functionName: "transfer",
      testCases: [
        {
          input: "x = 1",
          expectedOutput: "1",
          visible: true,
          arguments: [1],
          expectedValue: 1
        }
      ]
    },
    starterCode: {
      javascript: "function transfer(x) {\n  \n}\n",
      python: "def transfer(x):\n    pass\n",
      cpp: "int transfer(int x) {\n}\n",
      java: "class Solution {}\n"
    },
    selectionReason: "primary-pattern-unseen" as const
  });
  return {
    schemaVersion: 2,
    rubricVersion: 1,
    blockId: BLOCK_ID,
    blockOrdinal: 1,
    blockRecommendationSnapshot: {},
    teacher: { id: null, source: "candidate-profile-at-preparation" },
    durationMinutes: 40,
    preparedAt: "2026-09-05T00:00:00.000Z",
    reviewItems,
    transferQuestions: [transfer("transfer-one"), transfer("transfer-two")]
  };
}

describe("frozen DSA block assessment runtime plan", () => {
  it("orders review MCQs before the two frozen transfer problems without copying answer keys", () => {
    const plan = buildAssessmentPlan(snapshot());
    expect(plan).toHaveLength(7);
    expect(plan.slice(0, 5).every((question) => question.kind === "mcq")).toBe(true);
    expect(plan.slice(5).every((question) => question.kind === "code")).toBe(true);
    expect(JSON.stringify(plan)).not.toContain("SECRET APPROACH");
    expect(JSON.stringify(plan)).not.toContain("SECRET INSIGHT");
    expect(JSON.stringify(plan)).not.toContain("SECRET HINT");
    expect(JSON.stringify(plan)).not.toContain("correctOption");
    expect(JSON.stringify(plan)).not.toContain("rationale");
    expect(JSON.stringify(plan)).not.toContain("runnerContract");
    expect(JSON.stringify(plan)).not.toContain("expectedValue");
    expect(plan[0]?.codeSnippet).toBe("const seen = new Map();");
    expect(plan[5]?.dsaTransferQuestion?.slug).toBe("transfer-one");
    expect(plan[5]?.dsaTransferQuestion?.starterCode.javascript).toContain("function transfer");
  });

  it("marks the session by durable assessment identity, never a display title", () => {
    const setup = buildAssessmentSetup(BLOCK_ID, ASSESSMENT_ID, snapshot(), {
      targetRole: "frontend",
      level: "0-2",
      context: null
    });
    expect(setup.dsaBlockAssessment).toEqual({
      kind: "dsa-block-assessment",
      blockId: BLOCK_ID,
      assessmentId: ASSESSMENT_ID,
      snapshotVersion: 2,
      rubricVersion: 1
    });
    expect(setup.durationMinutes).toBe(40);
  });

  it("resolves a transfer run through the owned active frozen session, not a client slug", async () => {
    const dsaBlockAssessment = {
      findFirst: vi.fn().mockResolvedValue({ blockId: BLOCK_ID, assessmentSnapshot: snapshot() })
    };
    const interviewSession = {
      findFirst: vi.fn().mockResolvedValue({
        state: {
          questionIndex: 5,
          setup: { dsaBlockAssessment: { kind: "dsa-block-assessment", blockId: BLOCK_ID } }
        }
      })
    };
    const runtime = new DsaBlockAssessmentRuntimeService(
      { dsaBlockAssessment, interviewSession } as unknown as PrismaService,
      {} as never,
      {} as never
    );

    await expect(runtime.frozenTransferForRun("user-a", ASSESSMENT_ID, 5)).resolves.toMatchObject({
      slug: "transfer-one",
      highLevelApproach: "SECRET APPROACH"
    });
    expect(dsaBlockAssessment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-a", interviewSessionId: ASSESSMENT_ID } })
    );
  });

  it("refuses a transfer run when the requested index is not the active frozen question", async () => {
    const runtime = new DsaBlockAssessmentRuntimeService(
      {
        dsaBlockAssessment: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ blockId: BLOCK_ID, assessmentSnapshot: snapshot() })
        },
        interviewSession: {
          findFirst: vi.fn().mockResolvedValue({
            state: {
              questionIndex: 0,
              setup: { dsaBlockAssessment: { kind: "dsa-block-assessment", blockId: BLOCK_ID } }
            }
          })
        }
      } as unknown as PrismaService,
      {} as never,
      {} as never
    );
    await expect(runtime.frozenTransferForRun("user-a", ASSESSMENT_ID, 5)).rejects.toMatchObject({
      code: "ASSESSMENT_QUESTION_MISMATCH"
    });
  });

  it("keeps one reserved UUID across retries, including a failure after session creation", async () => {
    let reservedId: string | null = null;
    let status = "ASSESSMENT_READY";
    let failFinalise = true;
    const block = () => ({
      id: BLOCK_ID,
      ownerId: "user-a",
      status,
      owner: { targetRole: "frontend", level: "0-2", context: null },
      assessment: {
        id: ASSESSMENT_ID,
        assessmentSnapshot: snapshot(),
        interviewSessionId: reservedId,
        startedAt: null
      }
    });
    const dsaPracticeBlock = {
      findFirst: vi.fn().mockImplementation(async () => block()),
      update: vi.fn().mockImplementation(async ({ data }: { data: { status?: string } }) => {
        if (data.status) status = data.status;
        return block();
      })
    };
    const dsaBlockAssessment = {
      update: vi
        .fn()
        .mockImplementation(async ({ data }: { data: { interviewSessionId?: string } }) => {
          if (data.interviewSessionId) reservedId = data.interviewSessionId;
          return {};
        })
    };
    const interviewSession = {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ select }: { select: { ownerId?: boolean } }) =>
          select.ownerId
            ? failFinalise
              ? null
              : { ownerId: "user-a" }
            : failFinalise
              ? null
              : { id: reservedId }
        )
    };
    const prisma = {
      dsaPracticeBlock,
      dsaBlockAssessment,
      interviewSession,
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          dsaPracticeBlock,
          dsaBlockAssessment,
          interviewSession,
          $executeRaw: vi.fn()
        })
    } as unknown as PrismaService;
    const interviewStart = vi.fn().mockImplementation(async (_setup, _owner, _now, _plan, id) => ({
      state: { id },
      utterance: "intro",
      created: true
    }));
    const runtime = new DsaBlockAssessmentRuntimeService(
      prisma,
      { prepareCurrent: vi.fn().mockResolvedValue(snapshot()) } as never,
      { start: interviewStart } as never
    );

    await expect(runtime.startOrResume("user-a")).rejects.toMatchObject({
      code: "ASSESSMENT_SESSION_NOT_FOUND"
    });
    const firstReservation = reservedId;
    failFinalise = false;
    await expect(runtime.startOrResume("user-a")).resolves.toMatchObject({
      sessionId: firstReservation
    });
    expect(reservedId).toBe(firstReservation);
    expect(interviewStart.mock.calls.map((call) => call[4])).toEqual([
      firstReservation,
      firstReservation
    ]);
  });

  it("fails closed when a reserved session ID belongs to another owner", async () => {
    const reserved = "44444444-4444-4444-8444-444444444444";
    const block = {
      id: BLOCK_ID,
      ownerId: "user-a",
      status: "ASSESSMENT_READY",
      owner: { targetRole: "frontend", level: "0-2", context: null },
      assessment: {
        id: ASSESSMENT_ID,
        assessmentSnapshot: snapshot(),
        interviewSessionId: reserved,
        startedAt: null
      }
    };
    const dsaPracticeBlock = { findFirst: vi.fn().mockResolvedValue(block), update: vi.fn() };
    const interviewSession = { findFirst: vi.fn().mockResolvedValue({ ownerId: "user-b" }) };
    const prisma = {
      dsaPracticeBlock,
      dsaBlockAssessment: { update: vi.fn() },
      interviewSession,
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          dsaPracticeBlock,
          dsaBlockAssessment: { update: vi.fn() },
          interviewSession,
          $executeRaw: vi.fn()
        })
    } as unknown as PrismaService;
    const start = vi.fn();
    const runtime = new DsaBlockAssessmentRuntimeService(
      prisma,
      { prepareCurrent: vi.fn().mockResolvedValue(snapshot()) } as never,
      { start } as never
    );

    await expect(runtime.startOrResume("user-a")).rejects.toMatchObject({
      code: "ASSESSMENT_SESSION_NOT_FOUND"
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("does not start a requested block outside the owner's current block", async () => {
    const preparation = { prepareCurrent: vi.fn() };
    const start = vi.fn();
    const runtime = new DsaBlockAssessmentRuntimeService(
      {
        dsaPracticeBlock: { findFirst: vi.fn().mockResolvedValue(null) }
      } as unknown as PrismaService,
      preparation as never,
      { start } as never
    );

    await expect(
      runtime.startOrResume("user-a", "55555555-5555-4555-8555-555555555555")
    ).rejects.toMatchObject({ code: "BLOCK_NOT_FOUND" });
    expect(preparation.prepareCurrent).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
