import { DsaPracticeBlockStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { DsaBlockAssessmentSnapshot } from "@/lib/dsa/block-assessment";
import type { PrismaService } from "@/server/database/prisma.service";
import { DsaBlockHistoryError, DsaBlockHistoryService } from "./dsa-block-history.service";

const OLD_BLOCK = "11111111-1111-4111-8111-111111111111";
const CURRENT_BLOCK = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";

function recommendation(slugs: string[], label: string) {
  return {
    schemaVersion: 1,
    recommendation: {
      tier: "building",
      source: "performance",
      targetLabel: "Frontend mid-level",
      focusChapterId: "arrays-hashing",
      focusLabel: label,
      strengthLabel: null,
      blockTitle: label,
      rationale: `Frozen rationale for ${label}`,
      questions: slugs.map((slug, index) => ({
        slug,
        title: `Saved ${label} question ${index + 1}`,
        difficulty: "medium",
        primaryPattern: "hash-map",
        expectedTimeMinutes: 10,
        phaseSlug: "arrays",
        phaseNumber: 1,
        recommendedOrder: index + 1
      })),
      minutes: slugs.length * 10,
      mix: { easy: 0, medium: slugs.length, hard: 0 },
      estimatedPathQuestions: 60,
      availableQuestions: 200
    }
  };
}

function assessmentSnapshot(): DsaBlockAssessmentSnapshot {
  const reviewItems = Array.from({ length: 5 }, (_, index) => ({
    id: `review-${index}`,
    family: "static-code-cue" as const,
    sourceAttemptId: ATTEMPT,
    sourceQuestionSlug: `old-${index}`,
    sourceQuestionTitle: `Saved source ${index}`,
    sourceQuestionPattern: "hash-map",
    sourceCode: "const seen = new Map(); return seen;",
    codeSnippet: "const seen = new Map();",
    prompt: `Saved public prompt ${index}`,
    options: ["Public A", "Public B"],
    correctOption: 1,
    rationale: "SECRET_RATIONALE",
    metric: "pattern-recognition" as const,
    grounding: {
      kind: "deterministic-static-analysis" as const,
      source: "saved code",
      detail: "SECRET_GROUNDING",
      evidence: { answerKey: "SECRET_ANSWER" }
    }
  }));
  const transfer = (slug: string) => ({
    slug,
    contentVersion: 1,
    phaseSlug: "arrays",
    title: `Saved ${slug}`,
    source: "authored",
    externalUrl: "",
    primaryPattern: "hash-map",
    subPatterns: [],
    difficulty: "medium",
    expectedTimeMinutes: 15,
    recommendedOrder: 1,
    prerequisites: [],
    conceptsTested: [],
    commonMistakes: [],
    interviewSignals: [],
    followUpPrompts: [],
    promptSummary: "Public summary",
    highLevelApproach: "SECRET_REFERENCE_SOLUTION",
    complexity: {},
    problemStatement: "Public problem",
    constraints: [],
    examples: [],
    keyInsight: "SECRET_KEY_INSIGHT",
    hints: [],
    approaches: {},
    edgeCases: [],
    relatedQuestions: [],
    phaseNumber: 1,
    runnerContract: {
      version: 1 as const,
      functionName: "solve",
      testCases: [{ arguments: [1], expectedValue: 2 }]
    },
    starterCode: { javascript: "", python: "", cpp: "", java: "" },
    selectionReason: "primary-pattern-unseen" as const
  });
  return {
    schemaVersion: 2,
    rubricVersion: 1,
    blockId: OLD_BLOCK,
    blockOrdinal: 1,
    blockRecommendationSnapshot: recommendation(["old-a", "old-b"], "Old"),
    teacher: { id: "sophia", source: "candidate-profile-at-preparation" },
    durationMinutes: 40,
    preparedAt: "2026-09-01T00:00:00.000Z",
    reviewItems,
    transferQuestions: [transfer("transfer-one"), transfer("transfer-two")]
  };
}

function oldBlock() {
  return {
    id: OLD_BLOCK,
    ownerId: "owner-a",
    ordinal: 1,
    isCurrent: false,
    status: DsaPracticeBlockStatus.ASSESSED,
    recommendationSnapshot: recommendation(["old-a", "old-b"], "Old"),
    questionSlugs: ["old-a", "old-b"],
    assessmentReadyAt: new Date("2026-09-01T00:00:00.000Z"),
    assessedAt: new Date("2026-09-02T00:00:00.000Z"),
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    assessment: {
      id: "55555555-5555-4555-8555-555555555555",
      interviewSessionId: SESSION,
      reportSnapshot: null,
      assessmentSnapshot: assessmentSnapshot(),
      startedAt: new Date("2026-09-01T00:05:00.000Z"),
      completedAt: new Date("2026-09-02T00:00:00.000Z")
    }
  };
}

function currentBlock() {
  return {
    ...oldBlock(),
    id: CURRENT_BLOCK,
    ordinal: 2,
    isCurrent: true,
    status: DsaPracticeBlockStatus.PRACTISING,
    recommendationSnapshot: recommendation(["current-a", "current-b"], "Current"),
    questionSlugs: ["current-a", "current-b"],
    assessmentReadyAt: null,
    assessedAt: null,
    assessment: {
      ...oldBlock().assessment,
      id: "66666666-6666-4666-8666-666666666666",
      interviewSessionId: null,
      assessmentSnapshot: null,
      startedAt: null,
      completedAt: null
    }
  };
}

function service(blocks = [currentBlock(), oldBlock()]) {
  const history = vi.fn().mockResolvedValue(blocks);
  const findMany = vi.fn().mockResolvedValue([
    {
      id: SESSION,
      state: {
        turns: [
          {
            speaker: "agent",
            text: " Welcome back. ",
            startMs: 1000,
            endMs: 2000,
            correct: true,
            rationale: "SECRET"
          },
          {
            speaker: "user",
            text: "My answer",
            startMs: 2500,
            endMs: 3000,
            hiddenTests: ["SECRET"]
          },
          { speaker: "system", text: "Do not serialize me", startMs: 0, endMs: 0 }
        ],
        plan: [{ correctOption: 1, runnerContract: { testCases: ["SECRET"] } }]
      }
    }
  ]);
  return {
    history,
    findMany,
    reader: new DsaBlockHistoryService(
      { history } as never,
      { interviewSession: { findMany } } as unknown as PrismaService
    )
  };
}

describe("DsaBlockHistoryService", () => {
  it("uses immutable lifecycle and recommendation facts for historical completion", async () => {
    const { reader } = service();
    const result = await reader.read("owner-a", OLD_BLOCK, {
      "old-a": "NOT_STARTED",
      "old-b": "SKIPPED",
      "current-a": "COMPLETED"
    });

    expect(result?.selected.recommendation.focusLabel).toBe("Old");
    expect(result?.selected.recommendation.questions.map((question) => question.title)).toEqual([
      "Saved Old question 1",
      "Saved Old question 2"
    ]);
    expect(result?.selected.completedQuestions).toBe(2);
    expect(
      result?.selected.recommendation.questions.every((question) => question.status === "COMPLETED")
    ).toBe(true);
    expect(result?.previousBlockId).toBeNull();
    expect(result?.nextBlockId).toBe(CURRENT_BLOCK);
  });

  it("defaults to current, owner-scopes selection, and rejects an unknown block", async () => {
    const { reader, history } = service();
    await expect(reader.read("owner-a", null, {})).resolves.toMatchObject({
      selected: { id: CURRENT_BLOCK }
    });
    await expect(
      reader.read("owner-a", "77777777-7777-4777-8777-777777777777", {})
    ).rejects.toEqual(
      expect.objectContaining<Partial<DsaBlockHistoryError>>({ code: "BLOCK_NOT_FOUND" })
    );
    expect(history).toHaveBeenCalledWith("owner-a");
  });

  it("fails closed for a malformed modern recommendation snapshot", async () => {
    const malformed = oldBlock();
    malformed.recommendationSnapshot = {
      schemaVersion: 1,
      recommendation: { questions: [] }
    } as never;
    const { reader } = service([malformed]);
    await expect(reader.read("owner-a", OLD_BLOCK, {})).rejects.toMatchObject({
      code: "SNAPSHOT_INVALID"
    });
  });

  it("fails closed for a malformed modern assessment snapshot", async () => {
    const malformed = oldBlock();
    malformed.assessment = {
      ...malformed.assessment,
      assessmentSnapshot: {
        ...assessmentSnapshot(),
        transferQuestions: [{ title: "missing frozen runner" }]
      } as never
    };
    const { reader } = service([malformed]);
    await expect(reader.read("owner-a", OLD_BLOCK, {})).rejects.toMatchObject({
      code: "SNAPSHOT_INVALID"
    });
  });

  it("degrades a legacy cohort without consulting a current question bank", async () => {
    const legacy = oldBlock();
    legacy.recommendationSnapshot = {
      schemaVersion: 0,
      source: "legacy-user-session-progress",
      questionSlugs: ["legacy-two-sum"]
    } as never;
    legacy.questionSlugs = ["legacy-two-sum"];
    legacy.assessment = { ...legacy.assessment, assessmentSnapshot: null as never };
    const { reader } = service([legacy]);
    const result = await reader.read("owner-a", OLD_BLOCK, {});
    expect(result?.selected.recommendation).toMatchObject({
      legacy: true,
      focusLabel: "Saved practice block",
      questions: [{ slug: "legacy-two-sum", title: "Legacy Two Sum" }]
    });
  });

  it("batches transcript reads and serializes only public prompts and safe turns", async () => {
    const { reader, findMany } = service();
    const result = await reader.read("owner-a", OLD_BLOCK, {});
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-a", id: { in: [SESSION] } },
      select: { id: true, state: true }
    });
    expect(result?.selected.transcript).toEqual([
      { speaker: "agent", text: "Welcome back.", startMs: 1000, endMs: 2000 },
      { speaker: "user", text: "My answer", startMs: 2500, endMs: 3000 }
    ]);
    expect(result?.selected.assessment?.prompts[0]).toEqual({
      kind: "code-review",
      title: "Saved public prompt 0",
      sourceQuestionTitle: "Saved source 0",
      codeSnippet: "const seen = new Map();",
      options: ["Public A", "Public B"]
    });
    const serialized = JSON.stringify(result);
    for (const secret of [
      "correctOption",
      "runnerContract",
      "testCases",
      "expectedValue",
      "highLevelApproach",
      "keyInsight",
      "SECRET_RATIONALE",
      "SECRET_REFERENCE_SOLUTION"
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
