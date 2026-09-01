import {
  PRACTICE_QUESTION_SCHEMA_VERSION,
  type NormalizedPracticeQuestion,
  type PracticeQuestionDifficulty,
  type PracticeQuestionFormat
} from "./contracts";

export interface PrepQuestionRecord {
  id: string;
  contentVersion: number;
  bank: string;
  sessionKey: string;
  chapterKey: string;
  category: string;
  title: string;
  roles: string[];
  levels: string[];
  difficulty: string;
  expectedMinutes: number;
  competency: string;
  format: string;
  prompt: string;
  objective: string;
  prerequisites: string[];
  tags: string[];
  hints: string[];
  explanation: string;
  whatItTests: string[];
  goodAnswerSignals: string[];
  weakAnswerSignals: string[];
  followUpPrompts: string[];
  answerStructure: unknown;
  answerKey: unknown;
}

/** Normalize one published prep template without returning its private key. */
export function normalizePrepQuestion(
  question: PrepQuestionRecord,
  placement?: { sessionKey?: string; chapterKey?: string }
): NormalizedPracticeQuestion {
  return {
    schemaVersion: PRACTICE_QUESTION_SCHEMA_VERSION,
    identity: {
      canonicalId: canonicalPrepQuestionId(question.id),
      source: "prep",
      sourceKey: question.id,
      contentVersion: positiveVersion(question.contentVersion)
    },
    classification: {
      bank: question.bank,
      sessionKey: placement?.sessionKey ?? question.sessionKey,
      chapterKey: placement?.chapterKey ?? question.chapterKey,
      topicKey: question.competency,
      skillKeys: unique([...question.tags, ...question.whatItTests]),
      prerequisiteIds: question.prerequisites.map(canonicalPrepQuestionId),
      relatedQuestionIds: []
    },
    targeting: {
      roles: question.roles,
      levels: question.levels,
      difficulty: practiceDifficulty(question.difficulty),
      format: practiceFormat(question.format),
      expectedMinutes: question.expectedMinutes
    },
    content: {
      title: question.title,
      prompt: question.prompt,
      promptSummary: question.prompt,
      objective: question.objective,
      constraints: [],
      examples: []
    },
    coaching: {
      hints: question.hints,
      explanation: question.explanation,
      approaches: question.answerStructure ? [question.answerStructure] : [],
      edgeCases: [],
      followUpPrompts: question.followUpPrompts
    },
    evaluation: {
      rubric: [
        { key: "correctness", label: "Technical correctness", weight: 45 },
        { key: "reasoning", label: "Reasoning and mechanism", weight: 35 },
        { key: "specificity", label: "Specificity", weight: 20 }
      ],
      strongSignals: question.goodAnswerSignals,
      weakSignals: question.weakAnswerSignals,
      authoredTestCount: hasMcqAnswer(question.answerKey) ? 1 : 0
    },
    code: null
  };
}

export function canonicalPrepQuestionId(id: string): string {
  return `prep:${id}`;
}

function practiceDifficulty(value: string): PracticeQuestionDifficulty {
  return value === "easy" || value === "hard" ? value : "medium";
}

function practiceFormat(value: string): PracticeQuestionFormat {
  return value === "mcq" || value === "spoken" || value === "diagram" || value === "predict-run" ||
    value === "find-the-flaw" ||
    value === "diagnose"
    ? value
    : "typed";
}

function hasMcqAnswer(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "correctOptionIndex" in value &&
      typeof value.correctOptionIndex === "number"
  );
}

function positiveVersion(version: number): number {
  return Number.isInteger(version) && version > 0 ? version : 1;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
