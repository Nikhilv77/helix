import {
  ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION,
  ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION,
  architectureDesignAssessmentSnapshotSchema,
  type ArchitectureDesignAssessmentSnapshot
} from "@/features/practice/architecture-design/domain/assessment-contracts";
import { architectureDesignScenarioSelectionSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignQuestionSchema } from "@/features/practice/architecture-design/domain/question-contracts";
import { architectureDesignKnowledgeCheck } from "@/features/practice/architecture-design/domain/knowledge-check";

type BlueprintQuestion = {
  id: string;
  order: number;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  contentFingerprint: string;
  privateSnapshot: unknown;
};

export function buildArchitectureDesignAssessmentSnapshot(input: {
  blockContentFingerprint: string;
  selectionSnapshot: unknown;
  questions: BlueprintQuestion[];
  preparedAt: Date;
}): ArchitectureDesignAssessmentSnapshot {
  const selection = architectureDesignScenarioSelectionSchema.parse(input.selectionSnapshot);
  const questions = input.questions
    .map((row) => ({ row, question: architectureDesignQuestionSchema.parse(row.privateSnapshot) }))
    .sort((left, right) => left.row.order - right.row.order);
  if (questions.length !== 4 || questions.some(({ row }) => row.status === "ACTIVE")) {
    throw new Error("An Architecture assessment requires four terminal questions");
  }
  const [requirements, contracts, architecture, quality] = questions;
  const requirementsCheck = architectureDesignKnowledgeCheck(requirements!.question);
  const contractCheck = architectureDesignKnowledgeCheck(contracts!.question);
  const architectureCheck = architectureDesignKnowledgeCheck(architecture!.question);
  const productionCheck = architectureDesignKnowledgeCheck(quality!.question);
  const prompts: ArchitectureDesignAssessmentSnapshot["prompts"] = [
    prompt(
      "requirements-scope-defence",
      1,
      "requirements-scope",
      requirementsCheck.prompt,
      requirements!,
      {
        responseMode: "mcq",
        options: requirementsCheck.choices,
        correctChoiceIndex: requirementsCheck.correctChoiceIndex,
        choiceExplanation: requirementsCheck.rationale
      }
    ),
    prompt("api-data-capacity-defence", 2, "api-data-capacity", contractCheck.prompt, contracts!, {
      responseMode: "mcq",
      options: contractCheck.choices,
      correctChoiceIndex: contractCheck.correctChoiceIndex,
      choiceExplanation: contractCheck.rationale
    }),
    prompt(
      "architecture-tradeoff-defence",
      3,
      "architecture-tradeoffs",
      "Build the design on the canvas, then explain one request end to end. Show ownership boundaries, data stores, synchronous and asynchronous edges, partitioning, backpressure, and the dominant failure-isolation boundary. Defend the two trade-offs that matter most.",
      architecture!,
      {
        responseMode: "composite",
        options: architectureCheck.choices,
        correctChoiceIndex: architectureCheck.correctChoiceIndex,
        choiceExplanation: architectureCheck.rationale
      }
    ),
    prompt(
      "reliability-security-operability-defence",
      4,
      "reliability-security-operability",
      "Pressure-test the design for overload, regional failure, abuse, and unsafe migration. Define the SLOs and observability signals, security and privacy boundaries, recovery authority, cost controls, and a reversible evolution path with explicit rollback criteria.",
      quality!,
      {
        responseMode: "composite",
        options: productionCheck.choices,
        correctChoiceIndex: productionCheck.correctChoiceIndex,
        choiceExplanation: productionCheck.rationale
      }
    )
  ];
  return architectureDesignAssessmentSnapshotSchema.parse({
    schemaVersion: ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION,
    blueprintVersion: ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION,
    deliveryMode: "shared-voice-room",
    preparedAt: input.preparedAt.toISOString(),
    blockContentFingerprint: input.blockContentFingerprint,
    sourceSelection: selection,
    prompts
  });
}

function prompt(
  id: string,
  order: number,
  kind: ArchitectureDesignAssessmentSnapshot["prompts"][number]["kind"],
  text: string,
  source: {
    row: BlueprintQuestion;
    question: ReturnType<typeof architectureDesignQuestionSchema.parse>;
  },
  config: {
    responseMode?: "spoken" | "mcq" | "composite";
    options?: [string, string, string, string];
    correctChoiceIndex?: number;
    choiceExplanation?: string;
  } = {}
) {
  return {
    id,
    order,
    kind,
    prompt: text,
    responseMode: config.responseMode ?? "spoken",
    ...(config.options ? { options: config.options } : {}),
    context: `${source.question.artifact.title}: ${source.question.artifact.content}`.slice(
      0,
      4_000
    ),
    privateEvaluation: {
      sourceQuestionId: source.row.id,
      sourceQuestionFingerprint: source.row.contentFingerprint,
      expectedAnswer:
        `${source.question.referenceAnswer.summary}\n${source.question.referenceAnswer.explanation}`.slice(
          0,
          6_000
        ),
      rubric: source.question.rubric,
      dimensionKeys: source.question.dimensionKeys,
      ...(config.correctChoiceIndex !== undefined
        ? { correctChoiceIndex: config.correctChoiceIndex }
        : {}),
      ...(config.choiceExplanation ? { choiceExplanation: config.choiceExplanation } : {})
    }
  };
}
