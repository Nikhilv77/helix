import { dsaStarterCode, supportedDsaCodeLanguages } from "@/lib/dsa/dsa-code-templates";
import type { DsaQuestion } from "@/lib/dsa/dsa";
import {
  PRACTICE_QUESTION_SCHEMA_VERSION,
  type NormalizedPracticeQuestion,
  type PracticeCodeLanguage
} from "./contracts";

export const DSA_PRACTICE_SESSION_KEY = "frontend-dsa";

/** Normalize one authored DSA item without exposing a database-shaped model. */
export function normalizeDsaQuestion(
  question: DsaQuestion & { contentVersion?: number },
  phaseKey: string
): NormalizedPracticeQuestion {
  const supportedLanguages: PracticeCodeLanguage[] = supportedDsaCodeLanguages(question.slug);

  return {
    schemaVersion: PRACTICE_QUESTION_SCHEMA_VERSION,
    identity: {
      canonicalId: canonicalDsaQuestionId(question.slug),
      source: "dsa",
      sourceKey: question.slug,
      contentVersion: positiveVersion(question.contentVersion)
    },
    classification: {
      bank: "dsa",
      sessionKey: DSA_PRACTICE_SESSION_KEY,
      chapterKey: phaseKey,
      topicKey: question.primaryPattern,
      skillKeys: unique(question.conceptsTested),
      prerequisiteIds: question.prerequisites.map(canonicalDsaQuestionId),
      relatedQuestionIds: (question.relatedQuestions ?? []).map(canonicalDsaQuestionId)
    },
    targeting: {
      roles: [],
      levels: [],
      difficulty: question.difficulty,
      format: "code",
      expectedMinutes: question.expectedTimeMinutes
    },
    content: {
      title: question.title,
      prompt: question.problemStatement ?? question.promptSummary,
      promptSummary: question.promptSummary,
      objective: question.keyInsight ?? question.highLevelApproach,
      constraints: question.constraints ?? [],
      examples: question.examples ?? []
    },
    coaching: {
      hints: question.hints ?? [],
      explanation: question.highLevelApproach,
      approaches: question.approaches ?? [],
      edgeCases: question.edgeCases ?? [],
      followUpPrompts: question.followUpPrompts
    },
    evaluation: {
      rubric: [
        { key: "correctness", label: "Correctness", weight: 50 },
        { key: "approach", label: "Approach", weight: 20 },
        { key: "complexity", label: "Complexity", weight: 15 },
        { key: "edge-cases", label: "Edge cases", weight: 15 }
      ],
      strongSignals: question.interviewSignals,
      weakSignals: question.commonMistakes,
      authoredTestCount: question.examples?.length ?? 0
    },
    code: {
      supportedLanguages: [...supportedLanguages],
      starterCode: Object.fromEntries(
        supportedLanguages.map((language) => [language, dsaStarterCode(question, language)])
      )
    }
  };
}

export function canonicalDsaQuestionId(slug: string): string {
  return `dsa:${slug}`;
}

function positiveVersion(version: number | undefined): number {
  return typeof version === "number" && Number.isInteger(version) && version > 0 ? version : 1;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
