import { Prisma } from "@prisma/client";
import {
  ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
  architectureDesignAssessmentSnapshotSchema,
  architectureDesignAssessmentStartInputSchema,
  type ArchitectureDesignAssessmentSnapshot
} from "@/features/practice/architecture-design/domain/assessment-contracts";
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
import type { ArchitectureDesignAssessmentService } from "./assessment.service";

type RuntimeRecord = {
  id: string;
  blockId: string;
  assessmentSnapshot?: Prisma.JsonValue;
  block: {
    scenarioSnapshot: Prisma.JsonValue;
    owner: { targetRole: string | null; level: string | null; context: string | null };
  };
};

/** Architecture adapter for the shared replay-safe story-practice voice runtime. */
export class ArchitectureDesignAssessmentRuntimeService {
  private readonly coordinator: StoryPracticeAssessmentRuntimeCoordinator<
    ReturnType<typeof architectureDesignAssessmentStartInputSchema.parse>,
    Awaited<ReturnType<ArchitectureDesignAssessmentService["start"]>>,
    ArchitectureDesignAssessmentSnapshot,
    RuntimeRecord
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: ArchitectureDesignAssessmentService,
    interviews: InterviewService
  ) {
    this.coordinator = new StoryPracticeAssessmentRuntimeCoordinator(interviews, {
      practice: "architecture-design",
      parseInput: (rawInput) => architectureDesignAssessmentStartInputSchema.parse(rawInput),
      startAssessment: (ownerId, input, options) => this.assessments.start(ownerId, input, options),
      loadRecord: async (ownerId, assessmentId) => {
        const record = await this.prisma.architectureAssessment.findFirst({
          where: { id: assessmentId, ownerId },
          select: {
            id: true,
            blockId: true,
            assessmentSnapshot: true,
            block: {
              select: {
                scenarioSnapshot: true,
                owner: { select: { targetRole: true, level: true, context: true } }
              }
            }
          }
        });
        return record?.assessmentSnapshot ? record : null;
      },
      parseSnapshot: (record) =>
        architectureDesignAssessmentSnapshotSchema.parse(record.assessmentSnapshot),
      findSession: (sessionId) =>
        this.prisma.interviewSession.findUnique({
          where: { id: sessionId },
          select: { ownerId: true, state: true }
        }),
      buildSetup: buildArchitectureDesignAssessmentSetup,
      buildPlan: buildArchitectureDesignAssessmentPlan,
      notFound: () =>
        new NotFoundErrorException(
          "ARCHITECTURE_DESIGN_ASSESSMENT_NOT_FOUND",
          "Architecture & Design assessment not found."
        ),
      sessionConflict: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_ASSESSMENT_SESSION_CONFLICT",
          "This assessment room reservation does not match the frozen assessment."
        )
    });
  }

  startOrResume(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    return this.coordinator.startOrResume(ownerId, rawInput, options);
  }
}

export function buildArchitectureDesignAssessmentSetup(
  record: RuntimeRecord,
  snapshot: ArchitectureDesignAssessmentSnapshot
): InterviewSetup {
  const scenarioTitle = readScenarioTitle(record.block.scenarioSnapshot);
  return {
    role: asRole(record.block.owner.targetRole),
    level: asLevel(record.block.owner.level),
    roundType: "technical",
    intensity: "realistic",
    context: [
      `This is the frozen assessment for the Architecture & Design scenario “${scenarioTitle}”.`,
      "Use only the five prepared prompts and their server-only evaluation guides.",
      record.block.owner.context ?? ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1_200),
    templateId: "architecture-design-scenario-assessment",
    templateTitle: `${scenarioTitle} assessment`,
    durationMinutes: 30,
    questionCount: 5,
    storyPracticeAssessment: {
      kind: "story-practice-assessment",
      practice: "architecture-design",
      blockId: record.blockId,
      assessmentId: record.id,
      snapshotVersion: snapshot.schemaVersion,
      evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION
    },
    storyPracticeAssessmentPresentation: {
      evidenceAnchorLabel: "Design evidence",
      stages: [
        { id: "rapid", label: "Frame", caption: "Requirements and scale" },
        { id: "explain", label: "Design", caption: "Contracts and architecture" },
        { id: "scenario", label: "Defend", caption: "Operations and evolution" }
      ]
    }
  };
}

export function buildArchitectureDesignAssessmentPlan(
  snapshot: ArchitectureDesignAssessmentSnapshot
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
      rubricKeys: [...prompt.privateEvaluation.dimensionKeys],
      intent: `Assess ${competencyFor(prompt.kind).toLowerCase()} using the frozen design evidence.`,
      mustHit: publicExpectationsFor(prompt.kind),
      probeIfMissing: probeFor(prompt.kind),
      maxFollowUps: 1,
      storyPracticeInterviewerGuide: {
        practice: "architecture-design" as const,
        label: "Architecture & Design",
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
  kind: ArchitectureDesignAssessmentSnapshot["prompts"][number]["kind"]
): string {
  switch (kind) {
    case "requirements-scope":
      return "Requirements and scope";
    case "api-data-capacity":
      return "APIs, data, and capacity";
    case "architecture-tradeoffs":
      return "Architecture and trade-offs";
    case "reliability-security-operability":
      return "Reliability, security, and operability";
    case "communication-evolution":
      return "Communication and evolution";
  }
}

function publicExpectationsFor(
  kind: ArchitectureDesignAssessmentSnapshot["prompts"][number]["kind"]
): string[] {
  switch (kind) {
    case "requirements-scope":
      return ["explicit scope", "quantified scale", "measurable guarantees"];
    case "api-data-capacity":
      return ["stable identities", "access paths", "consistency boundaries"];
    case "architecture-tradeoffs":
      return ["end-to-end flow", "failure boundaries", "defended trade-offs"];
    case "reliability-security-operability":
      return ["failure recovery", "security boundaries", "operational signals"];
    case "communication-evolution":
      return ["assumptions", "reversible migration", "rollback criteria"];
  }
}

function probeFor(kind: ArchitectureDesignAssessmentSnapshot["prompts"][number]["kind"]): string {
  switch (kind) {
    case "requirements-scope":
      return "Which quantified constraint most changes this design, and what guarantee follows from it?";
    case "api-data-capacity":
      return "Which identity and consistency boundary protects the most important write path?";
    case "architecture-tradeoffs":
      return "Trace one request through the system and name the failure boundary your trade-off creates.";
    case "reliability-security-operability":
      return "Which signal detects this failure, and how does the system recover without widening the blast radius?";
    case "communication-evolution":
      return "How would you roll this out reversibly, and which threshold triggers rollback?";
  }
}

function readScenarioTitle(value: Prisma.JsonValue): string {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "title" in value &&
    typeof value.title === "string"
    ? value.title
    : "Architecture & Design scenario";
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
