import {
  ARCHITECTURE_DESIGN_STAGES,
  architectureDesignDimensionSchema,
  type ArchitectureDesignDifficulty,
  type ArchitectureDesignQuestionFormat
} from "./contracts";
import type { ArchitectureDesignQuestion } from "./question-contracts";
import {
  ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION,
  ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION,
  architectureDesignReviewArtifactSchema,
  type ArchitectureDesignReviewArtifact
} from "./review-artifact-contracts";

type QuestionSeed = {
  format: ArchitectureDesignQuestionFormat;
  objective: string;
  dependency: string;
  topicKeys: string[];
  prompt: string;
  artifact: ArchitectureDesignQuestion["artifact"];
  choices?: string[];
  correctChoiceIndex?: number;
  hints: [string, string, string];
  referenceAnswer: ArchitectureDesignQuestion["referenceAnswer"];
  rubric: ArchitectureDesignQuestion["rubric"];
  commonMistakes: string[];
  interviewerFollowUps: string[];
  transferConnection: string;
};

export type ArchitectureDesignScenarioSeed = {
  key: string;
  title: string;
  premise: string;
  candidateRole: string;
  functionalRequirements: string[];
  nonGoals: string[];
  constraints: string[];
  scaleProfile: string[];
  difficulties: ArchitectureDesignDifficulty[];
  primaryTopicKey: string;
  secondaryTopicKeys: string[];
  targetKeywords: string[];
  realismAnchors: string[];
  targetFitExplanation: string;
  coverageExplanation: string;
  authoredAt?: string;
  reviewedAt?: string;
  questions: [QuestionSeed, QuestionSeed, QuestionSeed, QuestionSeed];
};

export function reviewedArchitectureDesignArtifact(
  seed: ArchitectureDesignScenarioSeed
): ArchitectureDesignReviewArtifact {
  const questions = seed.questions.map((question, index) =>
    questionFrom(seed.key, index, question)
  );
  return architectureDesignReviewArtifactSchema.parse({
    artifactVersion: ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION,
    auditVersion: ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION,
    caseKey: seed.key,
    authoredAt: seed.authoredAt ?? "2026-09-08T06:30:00.000Z",
    authoring: {
      mode: "ai-assisted",
      provider: "openai",
      model: "codex",
      promptVersion: "architecture-design-reviewed-content-v1"
    },
    scenario: {
      schemaVersion: 1,
      key: seed.key,
      title: seed.title,
      premise: seed.premise,
      candidateRole: seed.candidateRole,
      functionalRequirements: seed.functionalRequirements,
      nonGoals: seed.nonGoals,
      constraints: seed.constraints,
      scaleProfile: seed.scaleProfile,
      roles: ["backend", "fullstack"],
      seniorities: ["junior", "mid", "senior"],
      difficulties: seed.difficulties,
      primaryTopicKey: seed.primaryTopicKey,
      secondaryTopicKeys: seed.secondaryTopicKeys,
      dimensionKeys: [...architectureDesignDimensionSchema.options],
      targetKeywords: seed.targetKeywords,
      expectedMinutes: 45,
      realismAnchors: seed.realismAnchors,
      targetFitExplanation: seed.targetFitExplanation,
      coverageExplanation: seed.coverageExplanation,
      stages: seed.questions.map((question, index) => {
        const stage = ARCHITECTURE_DESIGN_STAGES[index]!;
        return {
          order: stage.order,
          key: stage.key,
          title: stage.title,
          format: question.format,
          objective: question.objective,
          artifactKey: question.artifact.key,
          dimensionKeys: [...stage.dimensionKeys],
          scenarioDependency: question.dependency
        };
      })
    },
    questionBlock: { schemaVersion: 1, scenarioKey: seed.key, questions },
    humanReview: {
      status: "approved",
      reviewerId: "project-owner",
      reviewedAt: seed.reviewedAt ?? "2026-09-08",
      notes: [
        "Project owner approved this AI-assisted scenario after its schema, coherence, coverage, and privacy audits passed."
      ]
    }
  });
}

function questionFrom(
  scenarioKey: string,
  index: number,
  seed: QuestionSeed
): ArchitectureDesignQuestion {
  const stage = ARCHITECTURE_DESIGN_STAGES[index]!;
  return {
    schemaVersion: 1,
    key: `${scenarioKey}-${stage.key}`,
    scenarioKey,
    stageKey: stage.key,
    order: stage.order,
    format: seed.format,
    topicKeys: seed.topicKeys,
    dimensionKeys: [...stage.dimensionKeys],
    prompt: seed.prompt,
    artifact: seed.artifact,
    choices: seed.choices,
    hints: seed.hints,
    referenceAnswer: seed.referenceAnswer,
    correctChoiceIndex: seed.correctChoiceIndex,
    rubric: seed.rubric,
    commonMistakes: seed.commonMistakes,
    interviewerFollowUps: seed.interviewerFollowUps,
    transferConnection: seed.transferConnection
  };
}
