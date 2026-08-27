export const PRACTICE_QUESTION_SCHEMA_VERSION = 1 as const;

export type PracticeQuestionSource = "dsa" | "prep";
export type PracticeQuestionDifficulty = "easy" | "medium" | "hard";
export type PracticeQuestionFormat = "code" | "mcq" | "typed" | "spoken" | "diagram";
export type PracticeCodeLanguage = "python" | "javascript" | "cpp" | "java";

export interface PracticeRubricDimension {
  key: string;
  label: string;
  weight: number;
}

/**
 * Server-owned representation shared by the practice selectors and workspaces.
 * Private evaluation material must be stripped before returning a question to
 * a learner-facing route.
 */
export interface NormalizedPracticeQuestion {
  schemaVersion: typeof PRACTICE_QUESTION_SCHEMA_VERSION;
  identity: {
    canonicalId: string;
    source: PracticeQuestionSource;
    sourceKey: string;
    contentVersion: number;
  };
  classification: {
    bank: string;
    sessionKey: string;
    chapterKey: string;
    topicKey: string;
    skillKeys: string[];
    prerequisiteIds: string[];
    relatedQuestionIds: string[];
  };
  targeting: {
    roles: string[];
    levels: string[];
    difficulty: PracticeQuestionDifficulty;
    format: PracticeQuestionFormat;
    expectedMinutes: number;
  };
  content: {
    title: string;
    prompt: string;
    promptSummary: string;
    objective: string;
    constraints: string[];
    examples: Array<{ input: string; output: string; explanation: string }>;
  };
  coaching: {
    hints: string[];
    explanation: string;
    approaches: unknown[];
    edgeCases: string[];
    followUpPrompts: string[];
  };
  evaluation: {
    rubric: PracticeRubricDimension[];
    strongSignals: string[];
    weakSignals: string[];
    authoredTestCount: number;
  };
  code: {
    supportedLanguages: PracticeCodeLanguage[];
    starterCode: Partial<Record<PracticeCodeLanguage, string>>;
  } | null;
}
