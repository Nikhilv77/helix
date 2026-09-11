import { describe, expect, it, vi } from "vitest";
import {
  assertStoryPracticeAssessmentResponses,
  storyPracticeAssessmentStartDisposition
} from "./assessment-orchestrator";
import {
  assertStoryPracticeHintOrder,
  assertStoryPracticeWorkMatchesQuestion,
  storyPracticeFingerprint
} from "./practice-orchestrator";
import { resolveStoryPracticePreparationReplay } from "./preparation-orchestrator";
import {
  isStoryPracticeAssessmentIdentity,
  storyPracticeAssessmentIdentityFromSetup
} from "./contracts";
import { storyPracticeInterviewResponses } from "./assessment-transcript";
import { terminalStoryPracticeContinuation } from "./continuation-orchestrator";

describe("story-practice orchestration invariants", () => {
  it("fingerprints equivalent snapshots deterministically", () => {
    expect(storyPracticeFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      storyPracticeFingerprint({ a: { c: 3, d: 4 }, b: 2 })
    );
  });

  it("enforces work, hint, and assessment rules without domain types", () => {
    const errors = {
      format: () => new Error("format"),
      choice: () => new Error("choice")
    };
    expect(() =>
      assertStoryPracticeWorkMatchesQuestion(
        { format: "written" },
        { kind: "code", code: "design" },
        errors,
        new Set()
      )
    ).toThrow("format");
    expect(() => assertStoryPracticeHintOrder(1, 3, () => new Error("order"))).toThrow("order");
    expect(() =>
      assertStoryPracticeAssessmentResponses(
        ["one", "two"],
        [{ promptId: "one" }, { promptId: "one" }],
        () => new Error("responses")
      )
    ).toThrow("responses");
    expect(
      storyPracticeAssessmentStartDisposition({
        status: "LOCKED",
        isCurrent: true,
        allowLocked: true,
        historical: () => new Error("historical"),
        locked: () => new Error("locked")
      })
    ).toBe("start-early");
  });

  it("replays a successful preparation without publishing again", async () => {
    const current = vi.fn().mockResolvedValue({ id: "block-1" });
    await expect(
      resolveStoryPracticePreparationReplay({
        existing: {
          status: "SUCCEEDED",
          focusRevisionId: "focus-1",
          blockId: "block-1"
        },
        focusRevisionId: "focus-1",
        succeededStatus: "SUCCEEDED",
        inProgressStatus: "IN_PROGRESS",
        current,
        requestConflict: () => new Error("conflict"),
        inProgress: () => new Error("progress")
      })
    ).resolves.toEqual({ replayed: true, block: { id: "block-1" } });
    expect(current).toHaveBeenCalledOnce();
  });

  it("recognizes only complete neutral assessment-room identities", () => {
    expect(
      isStoryPracticeAssessmentIdentity({
        kind: "story-practice-assessment",
        practice: "applied-engineering",
        blockId: "block-1",
        assessmentId: "assessment-1",
        snapshotVersion: 1,
        evaluatorVersion: "applied-engineering-assessment-evaluator-v1"
      })
    ).toBe(true);
    expect(
      isStoryPracticeAssessmentIdentity({
        kind: "story-practice-assessment",
        practice: "unknown",
        blockId: "block-1",
        assessmentId: "assessment-1",
        snapshotVersion: 1,
        evaluatorVersion: "v1"
      })
    ).toBe(false);
  });

  it("resolves Core sessions saved before neutral identity version fields existed", () => {
    expect(
      storyPracticeAssessmentIdentityFromSetup({
        coreTechnicalAssessment: {
          kind: "core-technical-assessment",
          blockId: "block-1",
          assessmentId: "assessment-1"
        }
      })
    ).toEqual({
      kind: "story-practice-assessment",
      practice: "core-technical",
      blockId: "block-1",
      assessmentId: "assessment-1",
      snapshotVersion: 1,
      evaluatorVersion: "legacy-core-technical"
    });
  });

  it("groups transcript turns by frozen prompt and bounds each answer", () => {
    expect(
      storyPracticeInterviewResponses(
        [{ id: "prompt-1" }, { id: "prompt-2" }],
        [
          { speaker: "user", text: "first answer", questionIndex: 0 },
          { speaker: "agent", text: "follow-up", questionIndex: 0 },
          { speaker: "user", text: "with more detail", questionIndex: 0 },
          { speaker: "user", text: "second", questionIndex: 1 }
        ],
        20
      )
    ).toEqual([
      { promptId: "prompt-1", answer: "er\n\nwith more detail" },
      { promptId: "prompt-2", answer: "second" }
    ]);
  });

  it("distinguishes readiness from curriculum completion when no next item exists", () => {
    expect(
      terminalStoryPracticeContinuation({
        masteredKeys: ["queues", "retries", "queues"],
        assessmentScores: { diagnosis: 80, delivery: 75 },
        learnedCount: 0,
        meanVerifiedScore: 8,
        weakKeys: [],
        readySummary: "The available outcomes have been demonstrated with verified evidence.",
        completeSummary: "The available curriculum is complete with feedback still to review."
      })
    ).toEqual({
      kind: "ready",
      masteredKeys: ["queues", "retries"],
      summary: "The available outcomes have been demonstrated with verified evidence."
    });
    expect(
      terminalStoryPracticeContinuation({
        masteredKeys: [],
        assessmentScores: { diagnosis: 55, delivery: 65 },
        learnedCount: 1,
        meanVerifiedScore: 6,
        weakKeys: ["rollback"],
        readySummary: "The available outcomes have been demonstrated with verified evidence.",
        completeSummary: "The available curriculum is complete with feedback still to review."
      })
    ).toMatchObject({ kind: "complete" });
  });
});
