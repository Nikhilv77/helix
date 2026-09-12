import {
  ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION,
  ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION,
  architectureDesignAssessmentSnapshotSchema,
  type ArchitectureDesignAssessmentSnapshot
} from "@/features/practice/architecture-design/domain/assessment-contracts";
import { architectureDesignScenarioSelectionSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignQuestionSchema } from "@/features/practice/architecture-design/domain/question-contracts";

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
  const prompts: ArchitectureDesignAssessmentSnapshot["prompts"] = [
    prompt(
      "requirements-scope-defence",
      1,
      "requirements-scope",
      `Revisit ${selection.selectedScenario.title}. State the users, functional boundary, non-goals, and the two scale assumptions that most strongly shape your design.`,
      requirements!
    ),
    prompt(
      "api-data-capacity-defence",
      2,
      "api-data-capacity",
      "Define the critical API or event contract, core data model, access path, and capacity consequence. Defend the required consistency boundary.",
      contracts!
    ),
    prompt(
      "architecture-tradeoff-defence",
      3,
      "architecture-tradeoffs",
      "Walk through the end-to-end architecture and defend its partitioning, asynchronous work, caching, backpressure, and failure-isolation trade-offs.",
      architecture!
    ),
    prompt(
      "reliability-security-operability-defence",
      4,
      "reliability-security-operability",
      "Describe the SLOs, observability, security and privacy boundaries, overload controls, and cost signals required to operate this design safely.",
      quality!
    ),
    prompt(
      "communication-evolution-defence",
      5,
      "communication-evolution",
      "Name the strongest rejected alternative, the evidence that would reverse your decision, and a safe migration path for the next order of magnitude.",
      quality!
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
  }
) {
  return {
    id,
    order,
    kind,
    prompt: text,
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
      dimensionKeys: source.question.dimensionKeys
    }
  };
}
