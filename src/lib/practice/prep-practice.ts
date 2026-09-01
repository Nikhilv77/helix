import type { PracticeProgressStatus, PracticeSessionKey } from "./practice-roadmap";
export type PrepPracticeFormat =
  | "mcq"
  | "typed"
  | "spoken"
  | "diagram"
  | "predict-run"
  | "find-the-flaw"
  | "diagnose";

export const NON_DSA_PRACTICE_SESSION_KEYS = [
  "core-technical",
  "applied-engineering",
  "architecture-system-design"
] as const;

export type NonDsaPracticeSessionKey = (typeof NON_DSA_PRACTICE_SESSION_KEYS)[number];

export interface PrepPracticeQuestionSummary {
  id: string;
  progressId: string;
  order: number;
  title: string;
  objective: string;
  chapterKey: string;
  difficulty: "easy" | "medium" | "hard";
  format: PrepPracticeFormat;
  expectedMinutes: number;
  status: PracticeProgressStatus;
  attemptCount: number;
  bestScore: number | null;
  href: string;
  recommendationReason: string;
}

export interface PrepPracticeChapter {
  key: string;
  title: string;
  purpose: string;
  totalQuestions: number;
  attemptedQuestions: number;
  completedQuestions: number;
  progressPercent: number;
  questions: PrepPracticeQuestionSummary[];
}

export interface PrepPracticeSession {
  key: NonDsaPracticeSessionKey;
  title: string;
  purpose: string;
  covers: string[];
  totalQuestions: number;
  attemptedQuestions: number;
  completedQuestions: number;
  progressPercent: number;
  chapters: PrepPracticeChapter[];
  recommendedQuestion: PrepPracticeQuestionSummary | null;
}

export interface PrepPracticeReview {
  score: number | null;
  correctness: "correct" | "incorrect" | "developing" | "strong" | "skipped" | "unverified";
  summary: string;
  strengths: string[];
  missing: string[];
  explanation: string;
  correctOptionIndex: number | null;
  /**
   * Format A only, and only once an attempt has been submitted. Mirrors
   * `correctOptionIndex`: the answer is withheld until the candidate has
   * committed to a prediction.
   */
  expectedOutput: string | null;
  /**
   * Format C only, revealed with the review: the planted defect, the line it is
   * on, and what it costs in production.
   */
  flaw: { summary: string; line: number; consequence: string } | null;
  /** Format D only, revealed with the review. */
  diagnosis: { rootCause: string; fixes: string[] } | null;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "NOT_APPLICABLE";
  evaluatorVersion: string;
  questionContentVersion: number;
  rubricBand: "strong" | "developing" | "weak" | null;
  rubricRationale: string | null;
}

export interface PrepPracticeQuestion {
  sessionKey: NonDsaPracticeSessionKey;
  sessionTitle: string;
  id: string;
  progressId: string;
  order: number;
  totalInSession: number;
  chapterKey: string;
  chapterTitle: string;
  title: string;
  prompt: string;
  objective: string;
  difficulty: "easy" | "medium" | "hard";
  format: PrepPracticeFormat;
  expectedMinutes: number;
  options: string[];
  /**
   * Formats A and C. The code under examination — predicted in A, inspected in
   * C. Carried
   * separately from `prompt` because it renders read-only in an editor, and
   * separately from `answerKey` because the expected output must never reach
   * the browser before submission.
   */
  snippet: { code: string; language: string } | null;
  /**
   * Format D only. The evidence handed to the candidate and the symptom that
   * was reported. The cause is withheld until an attempt is submitted.
   */
  artifact: { body: string; kind: string; symptom: string } | null;
  hints: string[];
  revealedHintCount: number;
  draftAnswer: string;
  note: string;
  status: PracticeProgressStatus;
  attemptCount: number;
  bestScore: number | null;
  previousHref: string | null;
  nextHref: string | null;
  sessionHref: string;
  review: PrepPracticeReview | null;
}

export function isNonDsaPracticeSessionKey(value: string): value is NonDsaPracticeSessionKey {
  return (NON_DSA_PRACTICE_SESSION_KEYS as readonly string[]).includes(value);
}

export function practiceQuestionHref(sessionKey: PracticeSessionKey, questionId: string): string {
  return `/practice/${encodeURIComponent(sessionKey)}/${encodeURIComponent(questionId)}`;
}
