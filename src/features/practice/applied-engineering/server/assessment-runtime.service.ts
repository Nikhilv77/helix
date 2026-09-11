import { Prisma } from "@prisma/client";
import {
  APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION,
  appliedEngineeringAssessmentSnapshotSchema,
  appliedEngineeringAssessmentStartInputSchema,
  type AppliedEngineeringAssessmentSnapshot
} from "@/features/practice/applied-engineering/domain/assessment-contracts";
import type { InterviewService } from "@/features/interviews/server/interview.service";
import type {
  InterviewSetup,
  Level,
  PlannedQuestion,
  Role
} from "@/features/interviews/server/types";
import { StoryPracticeAssessmentRuntimeCoordinator } from "@/features/practice/shared/server/assessment-runtime";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AppliedEngineeringAssessmentService } from "./assessment.service";

type RuntimeRecord = {
  id: string;
  blockId: string;
  assessmentSnapshot?: Prisma.JsonValue;
  block: {
    incidentSnapshot: Prisma.JsonValue;
    owner: { targetRole: string | null; level: string | null; context: string | null };
  };
};

/** Applied adapter for the shared replay-safe story-practice voice runtime. */
export class AppliedEngineeringAssessmentRuntimeService {
  private readonly coordinator: StoryPracticeAssessmentRuntimeCoordinator<
    ReturnType<typeof appliedEngineeringAssessmentStartInputSchema.parse>,
    Awaited<ReturnType<AppliedEngineeringAssessmentService["start"]>>,
    AppliedEngineeringAssessmentSnapshot,
    RuntimeRecord
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: AppliedEngineeringAssessmentService,
    interviews: InterviewService
  ) {
    this.coordinator = new StoryPracticeAssessmentRuntimeCoordinator(interviews, {
      practice: "applied-engineering",
      parseInput: (rawInput) => appliedEngineeringAssessmentStartInputSchema.parse(rawInput),
      startAssessment: (ownerId, input, options) => this.assessments.start(ownerId, input, options),
      loadRecord: async (ownerId, assessmentId) => {
        const record = await this.prisma.appliedEngineeringAssessment.findFirst({
          where: { id: assessmentId, ownerId },
          select: {
            id: true,
            blockId: true,
            assessmentSnapshot: true,
            block: {
              select: {
                incidentSnapshot: true,
                owner: { select: { targetRole: true, level: true, context: true } }
              }
            }
          }
        });
        return record?.assessmentSnapshot ? record : null;
      },
      parseSnapshot: (record) =>
        appliedEngineeringAssessmentSnapshotSchema.parse(record.assessmentSnapshot),
      findSession: (sessionId) =>
        this.prisma.interviewSession.findUnique({
          where: { id: sessionId },
          select: { ownerId: true, state: true }
        }),
      buildSetup: buildAppliedEngineeringAssessmentSetup,
      buildPlan: buildAppliedEngineeringAssessmentPlan,
      notFound: () =>
        new NotFoundErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_NOT_FOUND",
          "Applied Engineering assessment not found."
        ),
      sessionConflict: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_SESSION_CONFLICT",
          "This assessment room reservation does not match the frozen assessment."
        )
    });
  }

  startOrResume(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    return this.coordinator.startOrResume(ownerId, rawInput, options);
  }
}

export function buildAppliedEngineeringAssessmentSetup(
  record: RuntimeRecord,
  snapshot: AppliedEngineeringAssessmentSnapshot
): InterviewSetup {
  const incidentTitle = readIncidentTitle(record.block.incidentSnapshot);
  return {
    role: asRole(record.block.owner.targetRole),
    level: asLevel(record.block.owner.level),
    roundType: "technical",
    intensity: "realistic",
    context: [
      `This is the frozen assessment for the Applied Engineering incident “${incidentTitle}”.`,
      "Use only the five prepared prompts and their server-only evaluation guides.",
      record.block.owner.context ?? ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1_200),
    templateId: "applied-engineering-incident-assessment",
    templateTitle: `${incidentTitle} assessment`,
    durationMinutes: 30,
    questionCount: 5,
    storyPracticeAssessment: {
      kind: "story-practice-assessment",
      practice: "applied-engineering",
      blockId: record.blockId,
      assessmentId: record.id,
      snapshotVersion: snapshot.schemaVersion,
      evaluatorVersion: APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION
    },
    storyPracticeAssessmentPresentation: {
      evidenceAnchorLabel: "Production evidence",
      stages: [
        { id: "rapid", label: "Diagnose", caption: "Signal and repair evidence" },
        { id: "explain", label: "Verify", caption: "Transfer and deterministic proof" },
        { id: "scenario", label: "Deliver", caption: "Rollout and rollback" }
      ]
    }
  };
}

export function buildAppliedEngineeringAssessmentPlan(
  snapshot: AppliedEngineeringAssessmentSnapshot
): PlannedQuestion[] {
  return [...snapshot.prompts]
    .sort((left, right) => left.order - right.order)
    .map((prompt) => ({
      text: prompt.prompt,
      evidenceAnchor: prompt.context ?? undefined,
      kind: "conversation" as const,
      stage: stageFor(prompt.order),
      answerFormat: "spoken" as const,
      competency: competencyFor(prompt.kind),
      rubricKeys: ["applied-engineering"],
      intent: `Assess ${competencyFor(prompt.kind).toLowerCase()} using the frozen incident evidence.`,
      mustHit: publicExpectationsFor(prompt.kind),
      probeIfMissing: probeFor(prompt.kind),
      maxFollowUps: 1,
      storyPracticeInterviewerGuide: {
        practice: "applied-engineering" as const,
        label: "Applied Engineering",
        expectedAnswer: prompt.privateEvaluation.expectedAnswer,
        rubric: prompt.privateEvaluation.rubric.map((item) => ({ ...item }))
      }
    }));
}

function stageFor(order: number): "rapid" | "explain" | "scenario" {
  if (order <= 2) return "rapid";
  if (order <= 4) return "explain";
  return "scenario";
}

function competencyFor(
  kind: AppliedEngineeringAssessmentSnapshot["prompts"][number]["kind"]
): string {
  switch (kind) {
    case "evidence-defence":
      return "Diagnosis";
    case "repair-defence":
      return "Implementation";
    case "unseen-diagnosis-transfer":
      return "Transfer";
    case "verification-transfer":
      return "Testing";
    case "rollout-defence":
      return "Safe delivery";
  }
}

function publicExpectationsFor(
  kind: AppliedEngineeringAssessmentSnapshot["prompts"][number]["kind"]
): string[] {
  switch (kind) {
    case "evidence-defence":
      return ["the strongest observable signal", "the causal chain", "the consequence"];
    case "repair-defence":
      return ["the restored invariant", "the dangerous edge case", "test evidence"];
    case "unseen-diagnosis-transfer":
      return ["the first inspection", "the likely cause", "one plausible alternative"];
    case "verification-transfer":
      return ["deterministic proof", "a race, retry, or load boundary", "failure evidence"];
    case "rollout-defence":
      return ["a success signal", "a rollback trigger", "bounded failure behavior"];
  }
}

function probeFor(kind: AppliedEngineeringAssessmentSnapshot["prompts"][number]["kind"]): string {
  switch (kind) {
    case "evidence-defence":
      return "Which observable signal best establishes that causal chain and its blast radius?";
    case "repair-defence":
      return "Which invariant does the repair restore, and what deterministic test proves the dangerous edge case?";
    case "unseen-diagnosis-transfer":
      return "Which first inspection would distinguish the likely cause from your plausible alternative?";
    case "verification-transfer":
      return "How would the test expose failure under the relevant race, retry, or load boundary?";
    case "rollout-defence":
      return "Which success signal and rollback threshold bound the production risk?";
  }
}

function readIncidentTitle(value: Prisma.JsonValue): string {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "title" in value &&
    typeof value.title === "string"
    ? value.title
    : "Applied Engineering incident";
}

function asRole(value: string | null): Role {
  return value === "backend" ||
    value === "frontend" ||
    value === "fullstack" ||
    value === "data" ||
    value === "ai-ml" ||
    value === "pm"
    ? value
    : "fullstack";
}

function asLevel(value: string | null): Level {
  return value === "fresher" || value === "0-2" || value === "3-5" || value === "5-plus"
    ? value
    : "0-2";
}
