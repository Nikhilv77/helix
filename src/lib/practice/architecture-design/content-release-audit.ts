import type { ZodIssue } from "zod";
import {
  architectureDesignReviewArtifactSchema,
  type ArchitectureDesignReviewArtifact
} from "./review-artifact-contracts";
import { toPublicArchitectureDesignQuestion } from "./question-contracts";

const PRIVATE_PUBLIC_KEYS = [
  "hints",
  "referenceAnswer",
  "correctChoiceIndex",
  "rubric",
  "commonMistakes",
  "interviewerFollowUps"
] as const;

export type ArchitectureDesignContentAuditReport = {
  automatedValid: boolean;
  releaseEligible: boolean;
  reviewStatus: ArchitectureDesignReviewArtifact["humanReview"]["status"] | "invalid";
  schemaIssues: string[];
  identityIssues: string[];
  coherenceIssues: string[];
  coverageIssues: string[];
  publicSafetyIssues: string[];
};

export function auditArchitectureDesignContent(raw: unknown): ArchitectureDesignContentAuditReport {
  const parsed = architectureDesignReviewArtifactSchema.safeParse(raw);
  if (!parsed.success) return invalidSchemaReport(parsed.error.issues);

  const artifact = parsed.data;
  const identityIssues: string[] = [];
  const coherenceIssues: string[] = [];
  const coverageIssues: string[] = [];
  const publicSafetyIssues: string[] = [];

  if (artifact.caseKey !== artifact.scenario.key) {
    identityIssues.push("caseKey must match scenario.key");
  }
  if (artifact.questionBlock.scenarioKey !== artifact.scenario.key) {
    identityIssues.push("questionBlock.scenarioKey must match scenario.key");
  }

  const coveredDimensions = new Set<string>();
  const scenarioTopics = new Set([
    artifact.scenario.primaryTopicKey,
    ...artifact.scenario.secondaryTopicKeys
  ]);
  const artifactKeys = new Set<string>();
  for (const question of artifact.questionBlock.questions) {
    const stage = artifact.scenario.stages[question.order - 1];
    if (!stage) {
      coherenceIssues.push(`question ${question.order} has no scenario stage`);
      continue;
    }
    if (stage.key !== question.stageKey) {
      coherenceIssues.push(`question ${question.order} does not match its stage key`);
    }
    if (stage.format !== question.format) {
      coherenceIssues.push(`question ${question.order} does not match its stage format`);
    }
    if (stage.artifactKey !== question.artifact.key) {
      coherenceIssues.push(`question ${question.order} does not use its declared artifact`);
    }
    if (!question.topicKeys.some((key) => scenarioTopics.has(key))) {
      coherenceIssues.push(`question ${question.order} is disconnected from the scenario topics`);
    }
    if (new Set(question.hints).size !== question.hints.length) {
      coherenceIssues.push(`question ${question.order} contains duplicate hints`);
    }
    artifactKeys.add(question.artifact.key);
    question.rubric.forEach((item) =>
      item.dimensionKeys.forEach((key) => coveredDimensions.add(key))
    );
    auditPublicQuestion(question, publicSafetyIssues);
  }

  if (artifactKeys.size !== artifact.questionBlock.questions.length) {
    coherenceIssues.push("every MVP question must use a distinct reviewed artifact");
  }
  for (const dimension of artifact.scenario.dimensionKeys) {
    if (!coveredDimensions.has(dimension)) {
      coverageIssues.push(`uncovered Architecture dimension: ${dimension}`);
    }
  }

  const automatedValid = [
    identityIssues,
    coherenceIssues,
    coverageIssues,
    publicSafetyIssues
  ].every((issues) => issues.length === 0);
  return {
    automatedValid,
    releaseEligible: automatedValid && artifact.humanReview.status === "approved",
    reviewStatus: artifact.humanReview.status,
    schemaIssues: [],
    identityIssues,
    coherenceIssues,
    coverageIssues,
    publicSafetyIssues
  };
}

function auditPublicQuestion(
  question: ArchitectureDesignReviewArtifact["questionBlock"]["questions"][number],
  issues: string[]
) {
  const beforeAttempt = toPublicArchitectureDesignQuestion(question, false) as Record<
    string,
    unknown
  >;
  const afterAttempt = toPublicArchitectureDesignQuestion(question, true) as Record<
    string,
    unknown
  >;
  for (const key of PRIVATE_PUBLIC_KEYS) {
    if (key in beforeAttempt || key in afterAttempt) {
      issues.push(`question ${question.order} exposes private field ${key}`);
    }
  }
  if ("transferConnection" in beforeAttempt) {
    issues.push(`question ${question.order} exposes transferConnection before an attempt`);
  }
}

function invalidSchemaReport(issues: ZodIssue[]): ArchitectureDesignContentAuditReport {
  return {
    automatedValid: false,
    releaseEligible: false,
    reviewStatus: "invalid",
    schemaIssues: issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    identityIssues: [],
    coherenceIssues: [],
    coverageIssues: [],
    publicSafetyIssues: []
  };
}
