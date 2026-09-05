import { DsaPracticeBlockStatus, RoadmapQuestionSourceType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { parseDsaBlockAssessmentSnapshot } from "@/lib/dsa/block-assessment";
import {
  DsaBlockAssessmentPreparationError,
  DsaBlockAssessmentPreparationService
} from "./dsa-block-assessment-preparation.service";

const BLOCK_ID = "10000000-0000-4000-8000-000000000001";
const ASSESSMENT_ID = "10000000-0000-4000-8000-000000000002";
const ATTEMPT_ONE = "10000000-0000-4000-8000-000000000011";
const ATTEMPT_TWO = "10000000-0000-4000-8000-000000000012";

function question(input: Partial<Record<string, unknown>> = {}) {
  return {
    slug: "two-sum",
    contentVersion: 3,
    phaseSlug: "arrays",
    title: "Two Sum",
    source: "LeetCode",
    externalUrl: "https://example.com/two-sum",
    primaryPattern: "arrays-hashing",
    subPatterns: ["hash-map"],
    difficulty: "easy",
    expectedTimeMinutes: 15,
    recommendedOrder: 1,
    prerequisites: [],
    conceptsTested: ["hash map"],
    commonMistakes: ["overwriting an earlier index"],
    interviewSignals: ["explains complement lookup"],
    followUpPrompts: ["Can you reduce the space?"],
    promptSummary: "Find two values that add to a target.",
    highLevelApproach: "Store seen values in a map.",
    complexity: { time: "O(n)", space: "O(n)" },
    problemStatement: "Return the two indices.",
    constraints: ["One answer exists."],
    examples: [{ input: "[2,7], 9", output: "[0,1]", explanation: "2 + 7 = 9" }],
    keyInsight: "Look up the complement.",
    hints: ["Store values as you scan."],
    approaches: [{ name: "Map", complexity: { time: "O(n)", space: "O(n)" } }],
    edgeCases: ["Duplicate values must use different indices."],
    relatedQuestions: ["3sum"],
    phase: { phaseNumber: 1 },
    ...input
  };
}

function verifiedAttempt(id: string, input: Partial<Record<string, unknown>> = {}) {
  const sourceQuestion = question(
    input.dsaQuestion as Partial<Record<string, unknown>> | undefined
  );
  return {
    id,
    dsaQuestionSlug: sourceQuestion.slug,
    answer:
      "function twoSum(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]; seen.set(nums[i], i); } }",
    score: 1,
    correctness: "accepted",
    language: "javascript",
    evaluatorVersion: "dsa-code-run-v1",
    feedback: {
      testsPassed: 3,
      testCount: 3,
      visibleTestEvidence: [
        {
          input: "nums = [2, 7], target = 9",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          error: null,
          passed: true
        },
        {
          input: "nums = [3, 2, 4], target = 6",
          expectedOutput: "[1, 2]",
          actualOutput: "[1, 2]",
          error: null,
          passed: true
        },
        {
          input: "nums = [3, 3], target = 6",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          error: null,
          passed: true
        }
      ]
    },
    createdAt: new Date("2026-09-05T00:00:00.000Z"),
    dsaQuestion: sourceQuestion,
    verificationStatus: "VERIFIED",
    sourceType: RoadmapQuestionSourceType.DSA,
    ...input
  };
}

function fixture(
  input: {
    status?: DsaPracticeBlockStatus;
    attempts?: ReturnType<typeof verifiedAttempt>[];
    authoredQuestions?: ReturnType<typeof question>[];
    completedSlugs?: string[];
    ownerId?: string;
  } = {}
) {
  const ownerId = input.ownerId ?? "owner-1";
  const assessment: { id: string; assessmentSnapshot: unknown } = {
    id: ASSESSMENT_ID,
    assessmentSnapshot: null
  };
  const block = {
    id: BLOCK_ID,
    ownerId,
    ordinal: 2,
    status: input.status ?? DsaPracticeBlockStatus.ASSESSMENT_READY,
    recommendationSnapshot: { schemaVersion: 1, recommendation: { tier: "building" } },
    questionSlugs: ["two-sum", "valid-anagram"],
    assessment
  };
  const attempts = input.attempts ?? [
    verifiedAttempt(ATTEMPT_ONE),
    verifiedAttempt(ATTEMPT_TWO, {
      dsaQuestion: question({
        slug: "valid-anagram",
        title: "Valid Anagram",
        primaryPattern: "arrays-hashing",
        edgeCases: ["Different string lengths cannot be anagrams."]
      })
    })
  ];
  const authoredQuestions = input.authoredQuestions ?? [
    question(),
    question({
      slug: "valid-anagram",
      title: "Valid Anagram",
      recommendedOrder: 2,
      edgeCases: ["Different string lengths cannot be anagrams."]
    }),
    question({ slug: "contains-duplicate", title: "Contains Duplicate", recommendedOrder: 3 }),
    question({
      slug: "longest-substring-without-repeating-characters",
      title: "Longest Substring",
      primaryPattern: "sliding-window",
      difficulty: "medium",
      recommendedOrder: 1,
      phase: { phaseNumber: 3 }
    }),
    question({
      slug: "lru-cache",
      title: "LRU Cache",
      primaryPattern: "design",
      difficulty: "medium",
      recommendedOrder: 5
    })
  ];
  const writes: unknown[] = [];
  const transaction = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    dsaPracticeBlock: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { ownerId: string } }) =>
          where.ownerId === ownerId ? block : null
        )
    },
    candidateProfile: { findUnique: vi.fn().mockResolvedValue({ teacherId: "maya" }) },
    userQuestionAttempt: {
      findMany: vi
        .fn()
        .mockImplementation(({ where }: { where: { verificationStatus: string } }) => {
          expect(where.verificationStatus).toBe("VERIFIED");
          return attempts.filter((attempt) => attempt.verificationStatus === "VERIFIED");
        })
    },
    dsaQuestion: { findMany: vi.fn().mockResolvedValue(authoredQuestions) },
    userQuestionProgress: {
      findMany: vi.fn().mockResolvedValue(
        (input.completedSlugs ?? ["two-sum", "valid-anagram"]).map((dsaQuestionSlug) => ({
          dsaQuestionSlug
        }))
      )
    },
    dsaBlockAssessment: {
      update: vi.fn().mockImplementation(({ data }: { data: { assessmentSnapshot: unknown } }) => {
        assessment.assessmentSnapshot = data.assessmentSnapshot;
        writes.push(data);
        return assessment;
      })
    }
  };
  const prisma = {
    ...transaction,
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>) => work(transaction)
  };
  return {
    service: new DsaBlockAssessmentPreparationService(prisma as never),
    transaction,
    assessment,
    writes
  };
}

describe("DsaBlockAssessmentPreparationService", () => {
  it("snapshots exact verified source code, grounded MCQs, and two authored unseen transfer problems", async () => {
    const unverified = verifiedAttempt("10000000-0000-4000-8000-000000000013", {
      answer: "throw new Error('do not use me')",
      verificationStatus: "UNVERIFIED"
    });
    const test = fixture({ attempts: [verifiedAttempt(ATTEMPT_ONE), unverified] });

    const snapshot = await test.service.prepareCurrent("owner-1");

    expect(snapshot.reviewItems.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.reviewItems.length).toBeLessThanOrEqual(6);
    expect(snapshot.reviewItems.every((item) => item.sourceAttemptId === ATTEMPT_ONE)).toBe(true);
    expect(snapshot.reviewItems[0]?.sourceCode).toContain("const seen = new Map()");
    expect(snapshot.reviewItems.every((item) => item.sourceCode.includes(item.codeSnippet))).toBe(
      true
    );
    expect(
      snapshot.reviewItems.filter(
        (item) =>
          item.grounding.kind === "saved-execution-evidence" ||
          item.grounding.kind === "deterministic-static-analysis"
      ).length
    ).toBeGreaterThanOrEqual(Math.ceil(snapshot.reviewItems.length / 2));
    expect(snapshot.reviewItems.map((item) => item.grounding.kind)).toEqual(
      expect.arrayContaining([
        "saved-execution-evidence",
        "authored-reference-metadata",
        "deterministic-static-analysis"
      ])
    );
    expect(snapshot.transferQuestions.map((item) => item.slug)).toEqual([
      "contains-duplicate",
      "longest-substring-without-repeating-characters"
    ]);
    expect(snapshot.transferQuestions.every((item) => item.slug !== "lru-cache")).toBe(true);
    expect(snapshot.transferQuestions.every((item) => item.problemStatement)).toBe(true);
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.transferQuestions.every((item) => item.runnerContract?.version === 1)).toBe(
      true
    );
    expect(snapshot.transferQuestions.every((item) => item.runnerContract?.testCases.length)).toBe(
      true
    );
    expect(
      snapshot.transferQuestions.every((item) => item.starterCode?.javascript.includes("function"))
    ).toBe(true);
    expect(test.writes).toHaveLength(1);
  });

  it("returns the identical durable snapshot on repeated preparation", async () => {
    const test = fixture();
    const first = await test.service.prepareCurrent("owner-1");
    const second = await test.service.prepareCurrent("owner-1");

    expect(second).toEqual(first);
    expect(test.writes).toHaveLength(1);
    expect(test.transaction.userQuestionAttempt.findMany).toHaveBeenCalledTimes(1);
  });

  it("spans multiple verified block submissions when that grounded evidence exists", async () => {
    const test = fixture();

    const snapshot = await test.service.prepareCurrent("owner-1");

    expect(new Set(snapshot.reviewItems.map((item) => item.sourceAttemptId))).toEqual(
      new Set([ATTEMPT_ONE, ATTEMPT_TWO])
    );
    expect(new Set(snapshot.reviewItems.map((item) => item.sourceQuestionSlug))).toEqual(
      new Set(["two-sum", "valid-anagram"])
    );
  });

  it("uses the accepted best/latest source attempt for each block question", async () => {
    const oldAttempt = verifiedAttempt("10000000-0000-4000-8000-000000000021", {
      answer: "function twoSum() { return ['old']; }",
      score: 0.4,
      correctness: "not-accepted",
      createdAt: new Date("2026-09-01T00:00:00.000Z")
    });
    const latestAccepted = verifiedAttempt(ATTEMPT_ONE, {
      answer: "function twoSum() { return ['latest accepted']; }",
      score: 1,
      correctness: "accepted",
      createdAt: new Date("2026-09-05T00:00:00.000Z")
    });
    const test = fixture({ attempts: [oldAttempt, latestAccepted] });

    const snapshot = await test.service.prepareCurrent("owner-1");

    expect(snapshot.reviewItems.every((item) => item.sourceAttemptId === ATTEMPT_ONE)).toBe(true);
    expect(snapshot.reviewItems.every((item) => item.sourceCode.includes("latest accepted"))).toBe(
      true
    );
  });

  it("builds a failed visible-case question from persisted execution facts", async () => {
    const failedAttempt = verifiedAttempt(ATTEMPT_ONE, {
      correctness: "not-accepted",
      score: 0,
      feedback: {
        testsPassed: 0,
        testCount: 1,
        visibleTestEvidence: [
          {
            input: "nums = [3, 3], target = 6",
            expectedOutput: "[0, 1]",
            actualOutput: "[]",
            error: null,
            passed: false
          },
          {
            input: "nums = [2, 7], target = 9",
            expectedOutput: "[0, 1]",
            actualOutput: "[]",
            error: null,
            passed: false
          },
          {
            input: "nums = [1, 2], target = 3",
            expectedOutput: "[0, 1]",
            actualOutput: "[]",
            error: null,
            passed: false
          }
        ]
      }
    });
    const test = fixture({ attempts: [failedAttempt] });

    const snapshot = await test.service.prepareCurrent("owner-1");
    const failedCase = snapshot.reviewItems.find(
      (item) => item.family === "execution-case" && item.grounding.evidence.passed === false
    );

    expect(failedCase?.options[failedCase.correctOption]).toBe("Output: []");
    expect(failedCase?.grounding.kind).toBe("saved-execution-evidence");
  });

  it("asks an optimization follow-up only for a provable sort versus lower authored target", async () => {
    const sortedAttempt = verifiedAttempt(ATTEMPT_ONE, {
      answer: "function twoSum(nums) { nums.sort((a, b) => a - b); return []; }"
    });
    const test = fixture({ attempts: [sortedAttempt] });

    const snapshot = await test.service.prepareCurrent("owner-1");
    const optimization = snapshot.reviewItems.find((item) => item.family === "optimization-review");

    expect(optimization?.codeSnippet).toContain(".sort(");
    expect(optimization?.grounding.kind).toBe("deterministic-static-analysis");
    expect(optimization?.options[optimization.correctOption]).toContain(
      "Check whether sorting is necessary"
    );
  });

  it("rejects decorative excerpts that do not anchor to saved source code", async () => {
    const test = fixture();
    const snapshot = await test.service.prepareCurrent("owner-1");
    const invalid = structuredClone(snapshot);
    invalid.reviewItems[0]!.codeSnippet = "function inventedSnippet() {}";

    expect(() => parseDsaBlockAssessmentSnapshot(invalid)).toThrow("codeSnippet");
  });

  it("rejects a snapshot whose scored review is mostly authored context instead of code evidence", async () => {
    const test = fixture();
    const snapshot = await test.service.prepareCurrent("owner-1");
    const invalid = structuredClone(snapshot);
    for (const item of invalid.reviewItems) {
      item.grounding.kind = "authored-reference-metadata";
    }

    expect(() => parseDsaBlockAssessmentSnapshot(invalid)).toThrow("majority");
  });

  it("uses a previously seen authored problem only as the explicit final fallback", async () => {
    const test = fixture({
      completedSlugs: [
        "two-sum",
        "valid-anagram",
        "contains-duplicate",
        "longest-substring-without-repeating-characters"
      ]
    });

    const snapshot = await test.service.prepareCurrent("owner-1");

    expect(snapshot.transferQuestions.map((question) => question.selectionReason)).toEqual([
      "previously-seen-fallback",
      "previously-seen-fallback"
    ]);
  });

  it("rejects non-ready current blocks and insufficient verified code evidence", async () => {
    const locked = fixture({ status: DsaPracticeBlockStatus.PRACTISING });
    await expect(locked.service.prepareCurrent("owner-1")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_READY"
    } satisfies Partial<DsaBlockAssessmentPreparationError>);

    const insufficient = fixture({ attempts: [] });
    await expect(insufficient.service.prepareCurrent("owner-1")).rejects.toMatchObject({
      code: "INSUFFICIENT_GROUNDED_CODE_EVIDENCE"
    } satisfies Partial<DsaBlockAssessmentPreparationError>);
  });

  it("creates isolated synthetic review evidence only when the development override is explicit", async () => {
    const test = fixture({ attempts: [] });

    const snapshot = await test.service.prepareCurrent("owner-1", {
      allowSyntheticEvidence: true
    });

    expect(snapshot.reviewItems).toHaveLength(6);
    expect(
      snapshot.reviewItems.every((item) => item.sourceCode.includes("developmentAssessmentFixture"))
    ).toBe(true);
    expect(
      snapshot.reviewItems.filter(
        (item) =>
          item.grounding.kind === "saved-execution-evidence" ||
          item.grounding.kind === "deterministic-static-analysis"
      ).length
    ).toBeGreaterThanOrEqual(Math.ceil(snapshot.reviewItems.length / 2));
  });

  it("does not reveal another candidate's current block", async () => {
    const test = fixture({ ownerId: "owner-2" });
    await expect(test.service.prepareCurrent("owner-1")).rejects.toMatchObject({
      code: "BLOCK_NOT_FOUND"
    } satisfies Partial<DsaBlockAssessmentPreparationError>);
  });
});
