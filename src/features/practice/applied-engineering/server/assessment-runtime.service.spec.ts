import { describe, expect, it, vi } from "vitest";
import {
  APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
  APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION,
  appliedEngineeringAssessmentSnapshotSchema
} from "@/features/practice/applied-engineering/domain/assessment-contracts";
import {
  AppliedEngineeringAssessmentRuntimeService,
  buildAppliedEngineeringAssessmentPlan,
  buildAppliedEngineeringAssessmentSetup
} from "./assessment-runtime.service";
import { AppliedEngineeringAssessmentService } from "./assessment.service";

const ASSESSMENT_ID = "11111111-1111-4111-8111-111111111111";
const BLOCK_ID = "22222222-2222-4222-8222-222222222222";

describe("AppliedEngineeringAssessmentRuntimeService", () => {
  it("starts the shared voice room from the frozen five-prompt assessment", async () => {
    const snapshot = assessmentSnapshot();
    const assessments = { start: vi.fn().mockResolvedValue({ id: ASSESSMENT_ID }) };
    const interviews = {
      start: vi.fn().mockResolvedValue({ state: { id: ASSESSMENT_ID }, created: true })
    };
    const prisma = {
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          blockId: BLOCK_ID,
          assessmentSnapshot: snapshot,
          block: {
            incidentSnapshot: { title: "Retry storm under partial failure" },
            owner: { targetRole: "backend", level: "3-5", context: "Node.js services" }
          }
        })
      },
      interviewSession: { findUnique: vi.fn().mockResolvedValue(null) }
    };
    const runtime = new AppliedEngineeringAssessmentRuntimeService(
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
        templateId: "applied-engineering-incident-assessment",
        storyPracticeAssessment: expect.objectContaining({
          practice: "applied-engineering",
          blockId: BLOCK_ID,
          assessmentId: ASSESSMENT_ID
        })
      }),
      "owner-one",
      expect.any(Number),
      expect.arrayContaining([
        expect.objectContaining({ competency: "Diagnosis", stage: "rapid" }),
        expect.objectContaining({ competency: "Testing", stage: "explain" }),
        expect.objectContaining({ competency: "Safe delivery", stage: "scenario" })
      ]),
      ASSESSMENT_ID
    );
  });

  it("keeps evaluation answers in the server plan while exposing neutral room presentation", () => {
    const snapshot = assessmentSnapshot();
    const plan = buildAppliedEngineeringAssessmentPlan(snapshot);
    const setup = buildAppliedEngineeringAssessmentSetup(
      {
        id: ASSESSMENT_ID,
        blockId: BLOCK_ID,
        block: {
          incidentSnapshot: { title: "Retry storm under partial failure" },
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
    expect(plan[0]?.storyPracticeInterviewerGuide).toMatchObject({
      practice: "applied-engineering",
      expectedAnswer: "Expected production answer 1"
    });
    expect(setup.storyPracticeAssessment).toMatchObject({
      practice: "applied-engineering",
      evaluatorVersion: APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION
    });
    expect(setup.storyPracticeAssessmentPresentation?.evidenceAnchorLabel).toBe(
      "Production evidence"
    );
  });

  it("maps a completed owned room transcript to the five frozen Applied response IDs", async () => {
    const snapshot = assessmentSnapshot();
    const turns = snapshot.prompts.flatMap((_, index) => [
      {
        speaker: "user" as const,
        text: `Initial evidence ${index + 1}`,
        startMs: index * 10,
        endMs: index * 10 + 2,
        questionIndex: index
      },
      ...(index === 0
        ? [
            {
              speaker: "user" as const,
              text: "Follow-up evidence",
              startMs: 3,
              endMs: 4,
              questionIndex: 0
            }
          ]
        : [])
    ]);
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({
          state: {
            id: ASSESSMENT_ID,
            phase: "done",
            setup: buildAppliedEngineeringAssessmentSetup(
              {
                id: ASSESSMENT_ID,
                blockId: BLOCK_ID,
                block: {
                  incidentSnapshot: { title: "Retry storm under partial failure" },
                  owner: { targetRole: "backend", level: "3-5", context: null }
                }
              },
              snapshot
            ),
            turns
          }
        })
      },
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          blockId: BLOCK_ID,
          assessmentSnapshot: snapshot
        })
      }
    };
    const service = new AppliedEngineeringAssessmentService(
      prisma as never,
      { evaluate: vi.fn() }
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
        answer:
          index === 0 ? "Initial evidence 1\n\nFollow-up evidence" : `Initial evidence ${index + 1}`
      }))
    });
  });

  it("replays a checkpointed FINALIZING submission during overview recovery", async () => {
    const snapshot = assessmentSnapshot();
    const responses = snapshot.prompts.map((prompt, index) => ({
      promptId: prompt.id,
      answer: `Saved response ${index + 1}`
    }));
    const checkpoint = appliedEngineeringAssessmentSnapshotSchema.parse({
      ...snapshot,
      submission: {
        requestId: ASSESSMENT_ID,
        responseFingerprint: `sha256:${"b".repeat(64)}`,
        responses,
        submittedAt: "2026-09-11T11:00:00.000Z"
      }
    });
    const prisma = {
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          status: "FINALIZING",
          assessmentSnapshot: checkpoint
        })
      }
    };
    const service = new AppliedEngineeringAssessmentService(
      prisma as never,
      { evaluate: vi.fn() }
    );
    const finalize = vi
      .spyOn(service, "finalize")
      .mockResolvedValue({ id: ASSESSMENT_ID } as never);

    await service.recoverCurrentInterview("owner-one");

    expect(finalize).toHaveBeenCalledWith("owner-one", {
      assessmentId: ASSESSMENT_ID,
      requestId: ASSESSMENT_ID,
      responses
    });
  });

  it("does not finalize a room whose frozen block identity does not match", async () => {
    const snapshot = assessmentSnapshot();
    const setup = buildAppliedEngineeringAssessmentSetup(
      {
        id: ASSESSMENT_ID,
        blockId: BLOCK_ID,
        block: {
          incidentSnapshot: { title: "Retry storm under partial failure" },
          owner: { targetRole: "backend", level: "3-5", context: null }
        }
      },
      snapshot
    );
    const prisma = {
      interviewSession: {
        findFirst: vi.fn().mockResolvedValue({
          state: { id: ASSESSMENT_ID, phase: "done", setup, turns: [] }
        })
      },
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          blockId: "different-block",
          assessmentSnapshot: snapshot
        })
      }
    };
    const service = new AppliedEngineeringAssessmentService(
      prisma as never,
      { evaluate: vi.fn() }
    );
    const finalize = vi.spyOn(service, "finalize");

    await expect(
      service.finalizeInterviewOwned("owner-one", ASSESSMENT_ID)
    ).resolves.toBeNull();
    expect(finalize).not.toHaveBeenCalled();
  });
});

function assessmentSnapshot() {
  const kinds = [
    "evidence-defence",
    "repair-defence",
    "unseen-diagnosis-transfer",
    "verification-transfer",
    "rollout-defence"
  ] as const;
  const selectedIncident = {
    incidentKey: "retry-storm",
    incidentVersion: 1,
    title: "Retry storm under partial failure",
    difficulty: "standard",
    emphasizedSignalKeys: ["retry-safety"],
    scores: {
      baselineGapTransfer: 20,
      targetRoleJob: 12,
      resumeProjectRelevance: 4,
      productionEvidenceCoverage: 10,
      plannedCoverage: 4,
      novelty: 5,
      total: 55
    }
  };
  return appliedEngineeringAssessmentSnapshotSchema.parse({
    schemaVersion: 1,
    blueprintVersion: APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
    preparedAt: "2026-09-11T10:00:00.000Z",
    blockContentFingerprint: `sha256:${"a".repeat(64)}`,
    sourceSelection: {
      policyVersion: 1,
      focusFingerprint: `sha256:${"f".repeat(64)}`,
      selectedIncident,
      rankings: [selectedIncident],
      reason: "This incident reinforces diagnosis, verification, and safe delivery."
    },
    prompts: kinds.map((kind, index) => ({
      id: `assessment-prompt-${index + 1}`,
      order: index + 1,
      kind,
      prompt: `Explain the production evidence and safe engineering decision for prompt ${index + 1}.`,
      context: `Frozen incident artifact ${index + 1}`,
      privateEvaluation: {
        sourceQuestionId: `${index + 1}0000000-0000-4000-8000-000000000000`,
        sourceQuestionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        expectedAnswer: `Expected production answer ${index + 1}`,
        rubric: [{ criterion: "Uses observable evidence and bounds production risk.", points: 10 }],
        deterministicEvidence: "practice-evidence"
      }
    }))
  });
}
