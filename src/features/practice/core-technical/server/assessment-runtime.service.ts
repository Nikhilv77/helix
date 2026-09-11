import { Prisma } from "@prisma/client";
import {
  CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
  coreTechnicalAssessmentSnapshotSchema,
  coreTechnicalAssessmentStartInputSchema,
  type CoreTechnicalAssessmentSnapshot
} from "@/features/practice/core-technical/domain/assessment-contracts";
import type { InterviewService } from "@/features/interviews/server/interview.service";
import type {
  InterviewSetup,
  Level,
  PlannedQuestion,
  Role
} from "@/features/interviews/server/types";
import type { PrismaService } from "@/server/database/prisma.service";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { StoryPracticeAssessmentRuntimeCoordinator } from "@/features/practice/shared/server/assessment-runtime";
import type { CoreTechnicalAssessmentService } from "./assessment.service";

/** Launches a frozen Core assessment in the shared DSA-quality voice room. */
export class CoreTechnicalAssessmentRuntimeService {
  private readonly coordinator: StoryPracticeAssessmentRuntimeCoordinator<
    ReturnType<typeof coreTechnicalAssessmentStartInputSchema.parse>,
    Awaited<ReturnType<CoreTechnicalAssessmentService["start"]>>,
    CoreTechnicalAssessmentSnapshot,
    RuntimeRecord
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: CoreTechnicalAssessmentService,
    interviews: InterviewService
  ) {
    this.coordinator = new StoryPracticeAssessmentRuntimeCoordinator(interviews, {
      practice: "core-technical",
      parseInput: (rawInput) => coreTechnicalAssessmentStartInputSchema.parse(rawInput),
      startAssessment: (ownerId, input, options) => this.assessments.start(ownerId, input, options),
      loadRecord: async (ownerId, assessmentId) => {
        const record = await this.prisma.coreTechnicalAssessment.findFirst({
          where: { id: assessmentId, ownerId },
          select: {
            id: true,
            blockId: true,
            assessmentSnapshot: true,
            block: {
              select: {
                storySnapshot: true,
                owner: { select: { targetRole: true, level: true, context: true } }
              }
            }
          }
        });
        return record?.assessmentSnapshot ? record : null;
      },
      parseSnapshot: (record) =>
        coreTechnicalAssessmentSnapshotSchema.parse(record.assessmentSnapshot),
      findSession: (sessionId) =>
        this.prisma.interviewSession.findUnique({
          where: { id: sessionId },
          select: { ownerId: true, state: true }
        }),
      buildSetup: buildCoreTechnicalAssessmentSetup,
      buildPlan: buildCoreTechnicalAssessmentPlan,
      notFound: () =>
        new NotFoundErrorException(
          "CORE_TECHNICAL_ASSESSMENT_NOT_FOUND",
          "Core Technical assessment not found."
        ),
      sessionConflict: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_ASSESSMENT_SESSION_CONFLICT",
          "This assessment room reservation does not match the frozen assessment."
        )
    });
  }

  async startOrResume(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    return this.coordinator.startOrResume(ownerId, rawInput, options);
  }
}

type RuntimeRecord = {
  id: string;
  blockId: string;
  assessmentSnapshot?: Prisma.JsonValue;
  block: {
    storySnapshot: Prisma.JsonValue;
    owner: { targetRole: string | null; level: string | null; context: string | null };
  };
};

export function buildCoreTechnicalAssessmentSetup(
  record: RuntimeRecord,
  snapshot: CoreTechnicalAssessmentSnapshot
): InterviewSetup {
  const storyTitle = readStoryTitle(record.block.storySnapshot);
  return {
    role: asRole(record.block.owner.targetRole),
    level: asLevel(record.block.owner.level),
    roundType: "technical",
    intensity: "realistic",
    context: [
      `This is the frozen assessment for the Core Technical practice path “${storyTitle}”.`,
      "Use only the five prepared prompts and their server-only evaluation guides.",
      record.block.owner.context ?? ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1_200),
    templateId: "core-technical-block-assessment",
    templateTitle: `${storyTitle} assessment`,
    durationMinutes: 30,
    questionCount: 5,
    storyPracticeAssessment: {
      kind: "story-practice-assessment",
      practice: "core-technical",
      blockId: record.blockId,
      assessmentId: record.id,
      snapshotVersion: snapshot.schemaVersion,
      evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION
    },
    storyPracticeAssessmentPresentation: {
      evidenceAnchorLabel: "Practice evidence",
      stages: [
        { id: "rapid", label: "Review", caption: "Your saved path evidence" },
        { id: "explain", label: "Diagnose & repair", caption: "Mechanism transfer" },
        { id: "scenario", label: "Production", caption: "Prove and ship" }
      ]
    },
    coreTechnicalAssessment: {
      kind: "core-technical-assessment",
      blockId: record.blockId,
      assessmentId: record.id,
      snapshotVersion: snapshot.schemaVersion,
      evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION
    }
  };
}

export function buildCoreTechnicalAssessmentPlan(
  snapshot: CoreTechnicalAssessmentSnapshot
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
      rubricKeys: ["core-technical"],
      intent: intentFor(prompt.kind),
      mustHit: publicExpectationsFor(prompt.kind),
      probeIfMissing: probeFor(prompt.kind),
      maxFollowUps: 1,
      coreTechnicalInterviewerGuide: {
        expectedAnswer: prompt.privateEvaluation.expectedAnswer,
        rubric: prompt.privateEvaluation.rubric.map((item) => ({ ...item }))
      },
      storyPracticeInterviewerGuide: {
        practice: "core-technical" as const,
        label: "Core Technical",
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

function competencyFor(kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"]): string {
  switch (kind) {
    case "weak-response-review":
      return "Mechanism review";
    case "code-evidence-defence":
      return "Evidence defence";
    case "unseen-diagnosis-transfer":
      return "Diagnosis transfer";
    case "repair-implementation-transfer":
      return "Repair reasoning";
    case "production-verification-defence":
      return "Production judgement";
  }
}

function intentFor(kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"]): string {
  return `Assess ${competencyFor(kind).toLowerCase()} using the frozen path evidence.`;
}

function probeFor(kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"]): string {
  switch (kind) {
    case "weak-response-review":
      return "Which runtime mechanism creates that behavior, and what production consequence follows?";
    case "code-evidence-defence":
      return "What does the saved test evidence prove, and which dangerous case remains unproven?";
    case "unseen-diagnosis-transfer":
      return "Which observation would distinguish your diagnosis from the plausible alternative?";
    case "repair-implementation-transfer":
      return "What cleanup or error path makes the repair safe, and how would one deterministic test prove it?";
    case "production-verification-defence":
      return "Which production signal and rollback threshold would make this release decision defensible?";
  }
}

function publicExpectationsFor(
  kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"]
): string[] {
  switch (kind) {
    case "weak-response-review":
      return ["the governing mechanism", "the causal chain", "the production consequence"];
    case "code-evidence-defence":
      return ["why the repair works", "the dangerous edge case", "limits of the saved evidence"];
    case "unseen-diagnosis-transfer":
      return ["the first evidence to inspect", "the likely cause", "one plausible alternative"];
    case "repair-implementation-transfer":
      return ["the essential repair", "cleanup or error handling", "one deterministic test"];
    case "production-verification-defence":
      return ["tests", "a production signal", "a rollback trigger"];
  }
}

function readStoryTitle(value: Prisma.JsonValue): string {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "title" in value &&
    typeof value.title === "string"
    ? value.title
    : "Core Technical path";
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
