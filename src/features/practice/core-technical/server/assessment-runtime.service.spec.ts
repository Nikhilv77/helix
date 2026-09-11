import { describe, expect, it, vi } from "vitest";
import {
  CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION,
  CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
  coreTechnicalAssessmentSnapshotSchema
} from "@/features/practice/core-technical/domain/assessment-contracts";
import {
  CoreTechnicalAssessmentRuntimeService,
  buildCoreTechnicalAssessmentPlan,
  buildCoreTechnicalAssessmentSetup
} from "./assessment-runtime.service";
import {
  CoreTechnicalAssessmentService,
  coreTechnicalInterviewResponses
} from "./assessment.service";

const ASSESSMENT_ID = "11111111-1111-4111-8111-111111111111";
const BLOCK_ID = "22222222-2222-4222-8222-222222222222";

describe("CoreTechnicalAssessmentRuntimeService", () => {
  it("starts the shared room from a prebuilt frozen plan without question generation", async () => {
    const snapshot = assessmentSnapshot();
    const assessments = { start: vi.fn().mockResolvedValue({ id: ASSESSMENT_ID }) };
    const interviews = {
      start: vi.fn().mockResolvedValue({
        state: { id: ASSESSMENT_ID },
        created: true
      })
    };
    const prisma = {
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          blockId: BLOCK_ID,
          assessmentSnapshot: snapshot,
          block: {
            storySnapshot: { title: "Trace retained state" },
            owner: { targetRole: "backend", level: "3-5", context: "Node.js services" }
          }
        })
      },
      interviewSession: { findUnique: vi.fn().mockResolvedValue(null) }
    };
    const runtime = new CoreTechnicalAssessmentRuntimeService(
      prisma as never,
      assessments as never,
      interviews as never
    );

    const result = await runtime.startOrResume("owner-one", {
      assessmentId: ASSESSMENT_ID,
      requestId: "33333333-3333-4333-8333-333333333333"
    });

    expect(result).toMatchObject({ sessionId: ASSESSMENT_ID, created: true });
    expect(interviews.start).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "core-technical-block-assessment",
        coreTechnicalAssessment: expect.objectContaining({
          blockId: BLOCK_ID,
          assessmentId: ASSESSMENT_ID
        })
      }),
      "owner-one",
      expect.any(Number),
      expect.arrayContaining([
        expect.objectContaining({ answerFormat: "spoken", stage: "rapid" }),
        expect.objectContaining({ stage: "explain" }),
        expect.objectContaining({ stage: "scenario" })
      ]),
      ASSESSMENT_ID
    );
  });

  it("resumes a Core room saved with only the legacy assessment identity", async () => {
    const snapshot = assessmentSnapshot();
    const assessments = { start: vi.fn().mockResolvedValue({ id: ASSESSMENT_ID }) };
    const interviews = {
      start: vi.fn().mockResolvedValue({ state: { id: ASSESSMENT_ID }, created: false })
    };
    const prisma = {
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          blockId: BLOCK_ID,
          assessmentSnapshot: snapshot,
          block: {
            storySnapshot: { title: "Trace retained state" },
            owner: { targetRole: "backend", level: "3-5", context: null }
          }
        })
      },
      interviewSession: {
        findUnique: vi.fn().mockResolvedValue({
          ownerId: "owner-one",
          state: {
            setup: {
              coreTechnicalAssessment: {
                kind: "core-technical-assessment",
                blockId: BLOCK_ID,
                assessmentId: ASSESSMENT_ID
              }
            }
          }
        })
      }
    };
    const runtime = new CoreTechnicalAssessmentRuntimeService(
      prisma as never,
      assessments as never,
      interviews as never
    );

    await expect(
      runtime.startOrResume("owner-one", {
        assessmentId: ASSESSMENT_ID,
        requestId: "33333333-3333-4333-8333-333333333333"
      })
    ).resolves.toMatchObject({ sessionId: ASSESSMENT_ID, created: false });

    expect(interviews.start).toHaveBeenCalledWith(
      expect.objectContaining({
        storyPracticeAssessment: expect.objectContaining({ practice: "core-technical" })
      }),
      "owner-one",
      expect.any(Number),
      expect.any(Array),
      ASSESSMENT_ID
    );
  });

  it("keeps private evaluation material server-only in the plan guide", () => {
    const snapshot = assessmentSnapshot();
    const plan = buildCoreTechnicalAssessmentPlan(snapshot);
    const setup = buildCoreTechnicalAssessmentSetup(
      {
        id: ASSESSMENT_ID,
        blockId: BLOCK_ID,
        block: {
          storySnapshot: { title: "Trace retained state" },
          owner: { targetRole: "backend", level: "3-5", context: null }
        }
      },
      snapshot
    );

    expect(plan).toHaveLength(5);
    expect(plan.map((question) => question.stage)).toEqual([
      "rapid",
      "rapid",
      "explain",
      "explain",
      "scenario"
    ]);
    expect(plan[0]?.coreTechnicalInterviewerGuide).toMatchObject({
      expectedAnswer: "Expected mechanism 1"
    });
    expect(setup.questionCount).toBe(5);
    expect(setup.durationMinutes).toBe(30);
    expect(setup.coreTechnicalAssessment?.evaluatorVersion).toBe(
      CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION
    );
  });

  it("groups spoken answers and follow-ups by frozen prompt for final scoring", () => {
    const responses = coreTechnicalInterviewResponses(assessmentSnapshot(), {
      turns: [
        { speaker: "user", text: "Initial mechanism", startMs: 1, endMs: 2, questionIndex: 0 },
        { speaker: "agent", text: "Which reference?", startMs: 2, endMs: 3, questionIndex: 0 },
        {
          speaker: "user",
          text: "The closure retains the lexical environment.",
          startMs: 3,
          endMs: 4,
          questionIndex: 0
        },
        ...Array.from({ length: 4 }, (_, index) => ({
          speaker: "user" as const,
          text: `Answer ${index + 2}`,
          startMs: index + 5,
          endMs: index + 6,
          questionIndex: index + 1
        }))
      ]
    });

    expect(responses).toHaveLength(5);
    expect(responses[0]?.answer).toBe(
      "Initial mechanism\n\nThe closure retains the lexical environment."
    );
    expect(responses.map((response) => response.promptId)).toEqual(
      assessmentSnapshot().prompts.map((prompt) => prompt.id)
    );
  });

  it("finalizes a terminal voice room through the existing five-score assessment evaluator", async () => {
    const snapshot = assessmentSnapshot();
    const turns = snapshot.prompts.map((_, index) => ({
      speaker: "user" as const,
      text: `Spoken evidence for prompt ${index + 1}`,
      startMs: index * 10,
      endMs: index * 10 + 5,
      questionIndex: index
    }));
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({
          state: {
            id: ASSESSMENT_ID,
            phase: "done",
            setup: {
              coreTechnicalAssessment: {
                kind: "core-technical-assessment",
                assessmentId: ASSESSMENT_ID,
                blockId: BLOCK_ID
              }
            },
            turns
          }
        })
      },
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          blockId: BLOCK_ID,
          assessmentSnapshot: snapshot
        })
      }
    };
    const service = new CoreTechnicalAssessmentService(
      prisma as never,
      { evaluate: vi.fn() },
      () => new Date("2026-09-11T12:00:00.000Z")
    );
    const finalize = vi
      .spyOn(service, "finalize")
      .mockResolvedValue({ id: ASSESSMENT_ID } as never);

    await service.finalizeInterviewOwned("owner-one", ASSESSMENT_ID);

    expect(finalize).toHaveBeenCalledWith("owner-one", {
      assessmentId: ASSESSMENT_ID,
      requestId: ASSESSMENT_ID,
      responses: snapshot.prompts.map((prompt, index) => ({
        promptId: prompt.id,
        answer: `Spoken evidence for prompt ${index + 1}`
      }))
    });
  });
});

function assessmentSnapshot() {
  const kinds = [
    "weak-response-review",
    "code-evidence-defence",
    "unseen-diagnosis-transfer",
    "repair-implementation-transfer",
    "production-verification-defence"
  ] as const;
  return coreTechnicalAssessmentSnapshotSchema.parse({
    schemaVersion: 1,
    blueprintVersion: CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION,
    preparedAt: "2026-09-11T10:00:00.000Z",
    blockContentFingerprint: `sha256:${"a".repeat(64)}`,
    prompts: kinds.map((kind, index) => ({
      id: `assessment-prompt-${index + 1}`,
      order: index + 1,
      kind,
      prompt: `Explain the mechanism and production evidence for frozen prompt ${index + 1}.`,
      context: `Saved practice artifact ${index + 1}`,
      privateEvaluation: {
        sourceQuestionId: `${index + 1}0000000-0000-4000-8000-000000000000`,
        sourceQuestionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        expectedAnswer: `Expected mechanism ${index + 1}`,
        rubric: [{ criterion: "Explains the governing mechanism accurately.", points: 10 }],
        deterministicEvidence: "practice-evidence"
      }
    }))
  });
}
