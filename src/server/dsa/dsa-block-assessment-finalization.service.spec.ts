import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("@/lib/dsa/block-assessment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dsa/block-assessment")>();
  return { ...actual, parseDsaBlockAssessmentSnapshot: (value: unknown) => value };
});
import { scoreBlockAssessment } from "./dsa-block-assessment-finalization.service";
import { DsaBlockAssessmentFinalizationService } from "./dsa-block-assessment-finalization.service";
import type { DsaBlockAssessmentSnapshot } from "@/lib/dsa/block-assessment";
import type { InterviewState } from "@/server/interview/types";
import { codeFingerprint } from "@/server/interview/code-fingerprint";
import type { PrismaService } from "@/server/database/prisma.service";

const BLOCK = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";

function fixture(
  code = "function solve() {}",
  hash = true
): { snapshot: DsaBlockAssessmentSnapshot; state: InterviewState } {
  const reviews = [
    "pattern-recognition",
    "correctness-edge-cases",
    "efficiency",
    "code-quality",
    "communication"
  ].map((metric, index) => ({ id: `r${index}`, metric, sourceQuestionPattern: "arrays-hashing" }));
  const snapshot = {
    schemaVersion: 2,
    rubricVersion: 1,
    blockId: BLOCK,
    blockOrdinal: 1,
    blockRecommendationSnapshot: {},
    teacher: { id: null, source: "candidate-profile-at-preparation" },
    durationMinutes: 40,
    preparedAt: "2026-09-05T00:00:00.000Z",
    reviewItems: reviews,
    transferQuestions: [
      { slug: "transfer-a", primaryPattern: "arrays-hashing" },
      { slug: "transfer-b", primaryPattern: "trees" }
    ]
  } as unknown as DsaBlockAssessmentSnapshot;
  const plan = [...reviews, ...snapshot.transferQuestions].map((item, index) => ({
    text: "q",
    kind: index < 5 ? ("mcq" as const) : ("code" as const),
    mustHit: [],
    probeIfMissing: "",
    competency: "x"
  }));
  const answer = `\`\`\`javascript\n${code}\n\`\`\``;
  const digest = codeFingerprint(`\n${code}\n`);
  const state = {
    id: SESSION,
    phase: "done",
    startedAt: 1_000,
    questionIndex: 7,
    followUpCount: 0,
    setup: {
      role: "frontend",
      level: "0-2",
      roundType: "technical",
      intensity: "realistic",
      context: "",
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: BLOCK,
        assessmentId: ASSESSMENT,
        snapshotVersion: 2,
        rubricVersion: 1
      }
    },
    plan,
    turns: [
      ...reviews.map((_, index) => ({
        speaker: "agent" as const,
        text: "graded",
        startMs: 0,
        endMs: 0,
        gradedQuestionIndex: index,
        correct: true
      })),
      { speaker: "user" as const, text: answer, startMs: 0, endMs: 1, questionIndex: 5 },
      { speaker: "user" as const, text: answer, startMs: 0, endMs: 1, questionIndex: 6 }
    ],
    codeExecutions: {
      "5": {
        language: "JavaScript",
        status: "2/2",
        accepted: true,
        testsPassed: 2,
        testCount: 2,
        compileOutput: "",
        stderr: "",
        time: null,
        memory: null,
        recordedAt: 1_001,
        ...(hash ? { codeHash: digest } : {})
      },
      "6": {
        language: "JavaScript",
        status: "0/2",
        accepted: false,
        testsPassed: 0,
        testCount: 2,
        compileOutput: "",
        stderr: "",
        time: null,
        memory: null,
        recordedAt: 1_001,
        ...(hash ? { codeHash: digest } : {})
      }
    },
    questionEvaluations: {
      "5": {
        rubricScores: [
          { rubricKey: "efficiency", score: 80 },
          { rubricKey: "code-quality", score: 70 },
          { rubricKey: "communication", score: 90 },
          { rubricKey: "pattern-recognition", score: 80 }
        ]
      },
      "6": {
        rubricScores: [
          { rubricKey: "efficiency", score: 60 },
          { rubricKey: "code-quality", score: 50 },
          { rubricKey: "communication", score: 70 },
          { rubricKey: "pattern-recognition", score: 60 }
        ]
      }
    }
  } as unknown as InterviewState;
  return { snapshot, state };
}

describe("block assessment scoring", () => {
  it("canonicalizes leading/trailing whitespace identically for runs and fenced submissions", () => {
    expect(codeFingerprint("\nfunction solve() {}\n")).toBe(codeFingerprint("function solve() {}"));
  });
  it("uses weighted deterministic metrics and the correctness safety cap", () => {
    const { snapshot, state } = fixture();
    const report = scoreBlockAssessment({ snapshot, assessmentId: ASSESSMENT, state, now: 10_000 });
    expect(report.metrics["correctness-edge-cases"]).toBe(67);
    expect(report.overall).toBeGreaterThan(0);
    expect(report.completion.partial).toBe(false);
  });
  it("marks a run stale when submitted code differs and caps overall below 60", () => {
    const { snapshot, state } = fixture("function solve() { return 1; }");
    state.turns = state.turns.map((turn) =>
      turn.speaker === "user"
        ? { ...turn, text: "```javascript\nfunction changed() {}\n```" }
        : turn
    );
    const report = scoreBlockAssessment({ snapshot, assessmentId: ASSESSMENT, state, now: 10_000 });
    expect(report.metrics["correctness-edge-cases"]).toBe(33);
    expect(report.overall).toBeLessThan(60);
    expect(report.evidence.transfer.some((item) => item.status === "stale-execution")).toBe(true);
  });
  it("counts an explicit coding skip as terminal zero evidence, not an answer", () => {
    const { snapshot, state } = fixture();
    state.turns = state.turns.map((turn) =>
      turn.speaker === "user" && turn.questionIndex === 6
        ? { ...turn, text: "I can't solve this problem.", skipped: true }
        : turn
    );
    delete state.questionEvaluations?.["6"];
    delete state.codeExecutions?.["6"];

    const report = scoreBlockAssessment({ snapshot, assessmentId: ASSESSMENT, state, now: 10_000 });

    expect(report.completion).toEqual({ answered: 6, skipped: 1, total: 7, partial: true });
    expect(
      report.evidence.transfer
        .filter((item) => item.questionIndex === 6)
        .every((item) => item.status === "skipped" && item.score === 0)
    ).toBe(true);
  });
});

function prismaHarness(
  input: {
    ownerId?: string;
    phase?: "done" | "questioning";
    mismatch?: boolean;
    historical?: boolean;
    report?: unknown;
    failUpdateOnce?: boolean;
    pending?: boolean;
    incomplete?: boolean;
  } = {}
) {
  const ownerId = input.ownerId ?? "owner-a";
  const { snapshot, state } = fixture();
  state.phase = input.phase ?? "done";
  if (input.incomplete) {
    state.turns = state.turns.filter(
      (turn) => turn.questionIndex !== 6 && turn.gradedQuestionIndex !== 6
    );
  }
  if (input.mismatch)
    state.setup.dsaBlockAssessment!.assessmentId = "44444444-4444-4444-8444-444444444444";
  let report = input.report ?? null;
  let fail = input.failUpdateOnce ?? false;
  let inTransaction = false;
  const writes: Array<{ table: string; data: unknown; inTransaction: boolean }> = [];
  const assessment = {
    id: ASSESSMENT,
    ownerId,
    blockId: BLOCK,
    interviewSessionId: SESSION,
    assessmentSnapshot: snapshot,
    reportSnapshot: report as object | null,
    block: { isCurrent: !input.historical }
  };
  const dsaBlockAssessment = {
    findFirst: vi.fn().mockImplementation(async (args: { where: { ownerId?: string } }) => {
      if (args.where.ownerId && args.where.ownerId !== ownerId) return null;
      return assessment;
    }),
    update: vi.fn().mockImplementation(async ({ data }: { data: { reportSnapshot?: unknown } }) => {
      writes.push({ table: "assessment", data, inTransaction });
      if (fail) {
        fail = false;
        throw new Error("write failed");
      }
      report = data.reportSnapshot ?? report;
      assessment.reportSnapshot = report;
      return assessment;
    })
  };
  const interviewSession = {
    findFirst: vi
      .fn()
      .mockImplementation(async (args: { where: { ownerId?: string } }) =>
        args.where.ownerId && args.where.ownerId !== ownerId ? null : { state }
      )
  };
  const dsaPracticeBlock = {
    update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
      writes.push({ table: "block", data, inTransaction });
      return {};
    })
  };
  const tx = { dsaBlockAssessment, interviewSession, dsaPracticeBlock, $executeRaw: vi.fn() };
  const prisma = {
    dsaBlockAssessment,
    interviewSession,
    dsaPracticeBlock,
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => {
      inTransaction = true;
      try {
        return await callback(tx);
      } finally {
        inTransaction = false;
      }
    }
  } as unknown as PrismaService;
  return {
    service: new DsaBlockAssessmentFinalizationService(prisma),
    writes,
    dsaBlockAssessment,
    interviewSession,
    state,
    setReport: (value: unknown) => {
      assessment.reportSnapshot = value as object;
    }
  };
}

describe("DsaBlockAssessmentFinalizationService", () => {
  it("is owner scoped and rejects a different owner without writes", async () => {
    const test = prismaHarness();
    await expect(test.service.finalizeOwned("owner-b", SESSION)).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND"
    });
    expect(test.writes).toEqual([]);
  });
  it("rejects a nonterminal session without writes", async () => {
    const test = prismaHarness({ phase: "questioning" });
    await expect(test.service.finalizeOwned("owner-a", SESSION)).rejects.toMatchObject({
      code: "SESSION_NOT_TERMINAL"
    });
    expect(test.writes).toEqual([]);
  });
  it("rejects a terminal-looking session with an unanswered prompt", async () => {
    const test = prismaHarness({ incomplete: true });
    await expect(test.service.finalizeOwned("owner-a", SESSION)).rejects.toMatchObject({
      code: "SESSION_INCOMPLETE"
    });
    expect(test.writes).toEqual([]);
  });
  it("rejects a session whose explicit assessment identity differs", async () => {
    const test = prismaHarness({ mismatch: true });
    await expect(test.service.finalizeOwned("owner-a", SESSION)).rejects.toMatchObject({
      code: "SESSION_MISMATCH"
    });
    expect(test.writes).toEqual([]);
  });
  it("writes report then ASSESSED transition in the same transaction", async () => {
    const test = prismaHarness();
    const report = await test.service.finalizeOwned("owner-a", SESSION, 10_000);
    expect(report.assessmentId).toBe(ASSESSMENT);
    expect(test.writes.map((write) => write.table)).toEqual(["assessment", "block"]);
    expect(test.writes.every((write) => write.inTransaction)).toBe(true);
    expect(test.writes[0]?.data).toMatchObject({
      completedAt: expect.any(Date),
      reportSnapshot: expect.any(Object)
    });
    expect(test.writes[1]?.data).toMatchObject({
      status: "ASSESSED",
      assessedAt: expect.any(Date)
    });
  });
  it("returns a preexisting report even after advancement without session reads or writes", async () => {
    const { snapshot, state } = fixture();
    const report = scoreBlockAssessment({ snapshot, assessmentId: ASSESSMENT, state, now: 10_000 });
    const test = prismaHarness({ historical: true, report });
    await expect(test.service.finalizeOwned("owner-a", SESSION)).resolves.toEqual(report);
    expect(test.writes).toEqual([]);
    expect(test.interviewSession.findFirst).not.toHaveBeenCalled();
  });
  it("can retry after an update failure and then returns the persisted report idempotently", async () => {
    const test = prismaHarness({ failUpdateOnce: true });
    await expect(test.service.finalizeOwned("owner-a", SESSION)).rejects.toThrow("write failed");
    const report = await test.service.finalizeOwned("owner-a", SESSION, 10_000);
    await expect(test.service.finalizeOwned("owner-a", SESSION, 20_000)).resolves.toEqual(report);
    expect(test.writes.filter((write) => write.table === "block")).toHaveLength(1);
  });
  it("recovery ignores no pending/nonterminal work and finalizes a terminal pending session", async () => {
    const none = prismaHarness();
    none.dsaBlockAssessment.findFirst.mockResolvedValueOnce(null);
    await expect(none.service.recoverCurrent("owner-a")).resolves.toBeNull();
    const nonterminal = prismaHarness({ phase: "questioning" });
    await expect(nonterminal.service.recoverCurrent("owner-a")).resolves.toBeNull();
    const terminal = prismaHarness();
    await expect(terminal.service.recoverCurrent("owner-a", 10_000)).resolves.toMatchObject({
      assessmentId: ASSESSMENT
    });
    expect(terminal.writes.map((write) => write.table)).toEqual(["assessment", "block"]);
  });
});
