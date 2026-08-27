import type { PrepQuestionRecord } from "./prep-question-adapter";

export const PREP_BANK_MINIMUMS = {
  "core-technical": { questions: 12, chapters: 3 },
  "applied-engineering": { questions: 40, chapters: 4 },
  "architecture-system-design": { questions: 12, chapters: 3 },
  "resume-behavioral-defense": { questions: 8, chapters: 2 }
} as const;

export type PublishedPrepSessionKey = keyof typeof PREP_BANK_MINIMUMS;

export interface AuditablePrepQuestion extends PrepQuestionRecord {
  publicationStatus: string;
}

export interface PrepBankAuditResult {
  publishedQuestions: number;
  sessionCounts: Record<PublishedPrepSessionKey, number>;
  chapterCounts: Record<PublishedPrepSessionKey, number>;
  errors: string[];
}

/**
 * Publication is an engineering gate, not a UI hint. A published question must
 * be independently usable and every candidate-facing session must have enough
 * breadth to form a durable bank.
 */
export function auditPrepQuestionBank(
  questions: AuditablePrepQuestion[]
): PrepBankAuditResult {
  const errors: string[] = [];
  const allIds = new Set<string>();
  for (const question of questions) {
    if (allIds.has(question.id)) errors.push(`${question.id}: duplicate id`);
    allIds.add(question.id);
  }

  const published = questions.filter((question) => question.publicationStatus === "PUBLISHED");
  for (const question of questions) {
    if (question.publicationStatus === "DRAFT" && isPublishedSessionKey(question.sessionKey)) {
      errors.push(`${question.id}: active-session question is still DRAFT`);
    }
  }
  const publishedIds = new Set(published.map((question) => question.id));
  const sessionCounts = emptySessionCounts();
  const chapterSets = emptyChapterSets();

  for (const question of published) {
    if (isPublishedSessionKey(question.sessionKey)) {
      sessionCounts[question.sessionKey] += 1;
      chapterSets[question.sessionKey].add(question.chapterKey);
    } else {
      errors.push(`${question.id}: unsupported published session ${question.sessionKey}`);
    }
    validateQuestion(question, publishedIds, errors);
  }

  const chapterCounts = Object.fromEntries(
    Object.entries(chapterSets).map(([key, chapters]) => [key, chapters.size])
  ) as Record<PublishedPrepSessionKey, number>;

  for (const [sessionKey, minimum] of Object.entries(PREP_BANK_MINIMUMS) as Array<
    [PublishedPrepSessionKey, (typeof PREP_BANK_MINIMUMS)[PublishedPrepSessionKey]]
  >) {
    if (sessionCounts[sessionKey] < minimum.questions) {
      errors.push(
        `${sessionKey}: ${sessionCounts[sessionKey]} published questions; requires ${minimum.questions}`
      );
    }
    if (chapterCounts[sessionKey] < minimum.chapters) {
      errors.push(
        `${sessionKey}: ${chapterCounts[sessionKey]} published chapters; requires ${minimum.chapters}`
      );
    }
  }

  return { publishedQuestions: published.length, sessionCounts, chapterCounts, errors };
}

export function assertPrepQuestionBankPublishable(questions: AuditablePrepQuestion[]): void {
  const result = auditPrepQuestionBank(questions);
  if (result.errors.length) {
    throw new Error(`Prep question bank publication failed:\n- ${result.errors.join("\n- ")}`);
  }
}

function validateQuestion(
  question: AuditablePrepQuestion,
  publishedIds: Set<string>,
  errors: string[]
): void {
  const fail = (message: string) => errors.push(`${question.id}: ${message}`);
  if (!Number.isInteger(question.contentVersion) || question.contentVersion < 1) fail("invalid version");
  if (question.prompt.trim().length < (question.format === "mcq" ? 20 : 30)) {
    fail("prompt is too short");
  }
  if (question.objective.trim().length < 20) fail("objective is too short");
  if (question.explanation.trim().length < 40) fail("explanation is too short");
  if (question.hints.length < 2 || question.hints.some((hint) => hint.trim().length < 12)) {
    fail("requires at least two useful hints");
  }
  if (question.goodAnswerSignals.length < 2) fail("requires at least two strong signals");
  if (question.weakAnswerSignals.length < 2) fail("requires at least two weak signals");
  if (!question.roles.length || !question.levels.length) fail("missing targeting");
  if (!question.chapterKey.trim() || !question.competency.trim()) fail("missing classification");
  if (!Number.isInteger(question.expectedMinutes) || question.expectedMinutes < 2) {
    fail("invalid expected minutes");
  }
  if (!["easy", "medium", "hard"].includes(question.difficulty)) fail("invalid difficulty");
  if (!["mcq", "typed", "spoken", "diagram"].includes(question.format)) fail("invalid format");
  if (containsPlaceholder(question)) fail("contains placeholder copy");

  for (const prerequisite of question.prerequisites) {
    if (!publishedIds.has(prerequisite)) fail(`unpublished prerequisite ${prerequisite}`);
  }

  if (question.format === "mcq" && !validMcqAnswer(question.answerKey)) {
    fail("invalid private MCQ answer key");
  }
}

function validMcqAnswer(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answer = value as { correctOptionIndex?: unknown; options?: unknown };
  return (
    Number.isInteger(answer.correctOptionIndex) &&
    Array.isArray(answer.options) &&
    answer.options.length >= 2 &&
    (answer.correctOptionIndex as number) >= 0 &&
    (answer.correctOptionIndex as number) < answer.options.length
  );
}

function containsPlaceholder(question: AuditablePrepQuestion): boolean {
  const text = [question.title, question.prompt, question.objective, question.explanation].join(" ");
  return /\b(?:todo|tbd|lorem ipsum|coming soon|placeholder)\b/i.test(text);
}

function isPublishedSessionKey(value: string): value is PublishedPrepSessionKey {
  return value in PREP_BANK_MINIMUMS;
}

function emptySessionCounts(): Record<PublishedPrepSessionKey, number> {
  return {
    "core-technical": 0,
    "applied-engineering": 0,
    "architecture-system-design": 0,
    "resume-behavioral-defense": 0
  };
}

function emptyChapterSets(): Record<PublishedPrepSessionKey, Set<string>> {
  return {
    "core-technical": new Set(),
    "applied-engineering": new Set(),
    "architecture-system-design": new Set(),
    "resume-behavioral-defense": new Set()
  };
}
