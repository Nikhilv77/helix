import type { ZodIssue } from "zod";
import {
  appliedEngineeringReviewArtifactSchema,
  type AppliedEngineeringReviewArtifact
} from "./review-artifact-contracts";
import { toPublicAppliedEngineeringQuestion } from "./question-contracts";

const EXECUTABLE_FORMATS = new Set(["debug-repair", "micro-implementation"]);
const FORBIDDEN_EXECUTABLE_CODE = [
  /node:fs/,
  /node:http/,
  /node:https/,
  /node:net/,
  /node:child_process/,
  /\bfetch\s*\(/,
  /\bDate\.now\s*\(/,
  /\bMath\.random\s*\(/
];
const PRIVATE_PUBLIC_KEYS = [
  "answer",
  "hints",
  "rubric",
  "commonMistakes",
  "interviewerFollowUps",
  "referenceSolution",
  "hiddenTests",
  "wrongSolutions"
] as const;

export type AppliedEngineeringContentAuditReport = {
  automatedValid: boolean;
  releaseEligible: boolean;
  reviewStatus: AppliedEngineeringReviewArtifact["humanReview"]["status"] | "invalid";
  schemaIssues: string[];
  identityIssues: string[];
  coherenceIssues: string[];
  coverageIssues: string[];
  executableIssues: string[];
  publicSafetyIssues: string[];
};

export function auditAppliedEngineeringContent(raw: unknown): AppliedEngineeringContentAuditReport {
  const parsed = appliedEngineeringReviewArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidSchemaReport(parsed.error.issues);
  }

  const artifact = parsed.data;
  const identityIssues: string[] = [];
  const coherenceIssues: string[] = [];
  const coverageIssues: string[] = [];
  const executableIssues: string[] = [];
  const publicSafetyIssues: string[] = [];

  if (artifact.caseKey !== artifact.incident.key) {
    identityIssues.push("caseKey must match incident.key");
  }
  if (artifact.questionBlock.incidentKey !== artifact.incident.key) {
    identityIssues.push("questionBlock.incidentKey must match incident.key");
  }

  const stagesByOrder = new Map(artifact.incident.stages.map((stage) => [stage.order, stage]));
  const artifactKeys = new Set<string>();
  const coveredSignals = new Set<string>();
  const executableQuestions = artifact.questionBlock.questions.filter((question) =>
    EXECUTABLE_FORMATS.has(question.format)
  );

  for (const question of artifact.questionBlock.questions) {
    const stage = stagesByOrder.get(question.order);
    if (!stage) {
      coherenceIssues.push(`question ${question.order} has no incident stage`);
      continue;
    }
    if (stage.key !== question.stageKey) {
      coherenceIssues.push(`question ${question.order} does not match its stage key`);
    }
    if (stage.format !== question.format) {
      coherenceIssues.push(`question ${question.order} does not match its stage format`);
    }
    if (stage.patternKey !== question.patternKey) {
      coherenceIssues.push(`question ${question.order} does not match its stage pattern`);
    }
    if (stage.artifactKey !== question.artifact.key) {
      coherenceIssues.push(`question ${question.order} does not use its declared artifact`);
    }
    if (
      !stage.productionSignalKeys.some((signal) => question.productionSignalKeys.includes(signal))
    ) {
      coherenceIssues.push(`question ${question.order} does not cover its stage signal`);
    }

    artifactKeys.add(question.artifact.key);
    question.productionSignalKeys.forEach((signal) => coveredSignals.add(signal));
    auditPublicQuestion(question, publicSafetyIssues);
  }

  if (artifactKeys.size < 6) {
    coherenceIssues.push("an incident must use at least six distinct reviewed artifacts");
  }
  for (const signal of artifact.incident.productionSignalKeys) {
    if (!coveredSignals.has(signal)) coverageIssues.push(`uncovered production signal: ${signal}`);
  }
  if (executableQuestions.length !== 2) {
    executableIssues.push("an incident must contain exactly two executable questions");
  }
  for (const question of executableQuestions) {
    if (question.starterCode === question.referenceSolution) {
      executableIssues.push(`question ${question.order} exposes no meaningful repair gap`);
    }
    const executableText = [
      question.artifact.content,
      question.starterCode,
      question.referenceSolution,
      ...(question.publicTests ?? []).map((test) => test.testCode),
      ...(question.hiddenTests ?? []).map((test) => test.testCode),
      ...(question.wrongSolutions ?? []).map((solution) => solution.code)
    ].join("\n");
    for (const forbidden of FORBIDDEN_EXECUTABLE_CODE) {
      if (forbidden.test(executableText)) {
        executableIssues.push(
          `question ${question.order} contains forbidden executable capability ${forbidden.source}`
        );
      }
    }
  }

  const automatedValid = [
    identityIssues,
    coherenceIssues,
    coverageIssues,
    executableIssues,
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
    executableIssues,
    publicSafetyIssues
  };
}

function auditPublicQuestion(
  question: AppliedEngineeringReviewArtifact["questionBlock"]["questions"][number],
  issues: string[]
) {
  const beforeAttempt = toPublicAppliedEngineeringQuestion(question, false) as Record<
    string,
    unknown
  >;
  const afterAttempt = toPublicAppliedEngineeringQuestion(question, true) as Record<
    string,
    unknown
  >;
  for (const key of PRIVATE_PUBLIC_KEYS) {
    if (key in beforeAttempt || key in afterAttempt) {
      issues.push(`question ${question.order} exposes private field ${key}`);
    }
  }
  if ("interviewConnection" in beforeAttempt) {
    issues.push(`question ${question.order} exposes interviewConnection before an attempt`);
  }
}

function invalidSchemaReport(issues: ZodIssue[]): AppliedEngineeringContentAuditReport {
  return {
    automatedValid: false,
    releaseEligible: false,
    reviewStatus: "invalid",
    schemaIssues: issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    identityIssues: [],
    coherenceIssues: [],
    coverageIssues: [],
    executableIssues: [],
    publicSafetyIssues: []
  };
}
