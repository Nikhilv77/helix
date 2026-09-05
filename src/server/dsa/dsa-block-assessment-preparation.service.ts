import {
  DsaPracticeBlockStatus,
  Prisma,
  RoadmapProgressStatus,
  RoadmapQuestionSourceType
} from "@prisma/client";
import {
  DSA_BLOCK_ASSESSMENT_DURATION_MINUTES,
  DSA_BLOCK_ASSESSMENT_RUBRIC_VERSION,
  DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION,
  parseDsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentReviewItem,
  type DsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentTransferQuestion
} from "@/lib/dsa/block-assessment";
import { OPERATION_DSA_SLUGS, dsaFunctionName, dsaStarterCode } from "@/lib/dsa/dsa-code-templates";
import type { DsaExample } from "@/lib/dsa/dsa";
import { buildTestCases } from "./code-test-harness";
import type { PrismaService } from "@/server/database/prisma.service";

const FRONTEND_ROADMAP_ROLE = "fullstack";
const MIN_REVIEW_ITEMS = 5;
const MAX_REVIEW_ITEMS = 6;

const blockSelect = {
  id: true,
  ownerId: true,
  ordinal: true,
  status: true,
  recommendationSnapshot: true,
  questionSlugs: true,
  assessment: { select: { id: true, assessmentSnapshot: true } }
} satisfies Prisma.DsaPracticeBlockSelect;

const reviewAttemptSelect = {
  id: true,
  dsaQuestionSlug: true,
  answer: true,
  score: true,
  correctness: true,
  language: true,
  evaluatorVersion: true,
  feedback: true,
  createdAt: true,
  dsaQuestion: {
    select: {
      slug: true,
      title: true,
      primaryPattern: true,
      complexity: true,
      edgeCases: true
    }
  }
} satisfies Prisma.UserQuestionAttemptSelect;

const authoredQuestionSelect = {
  slug: true,
  contentVersion: true,
  phaseSlug: true,
  title: true,
  source: true,
  externalUrl: true,
  primaryPattern: true,
  subPatterns: true,
  difficulty: true,
  expectedTimeMinutes: true,
  recommendedOrder: true,
  prerequisites: true,
  conceptsTested: true,
  commonMistakes: true,
  interviewSignals: true,
  followUpPrompts: true,
  promptSummary: true,
  highLevelApproach: true,
  complexity: true,
  problemStatement: true,
  constraints: true,
  examples: true,
  keyInsight: true,
  hints: true,
  approaches: true,
  edgeCases: true,
  relatedQuestions: true,
  phase: { select: { phaseNumber: true } }
} satisfies Prisma.DsaQuestionSelect;

type BlockRecord = Prisma.DsaPracticeBlockGetPayload<{ select: typeof blockSelect }>;
type ReviewAttempt = Prisma.UserQuestionAttemptGetPayload<{ select: typeof reviewAttemptSelect }>;
type AuthoredQuestion = Prisma.DsaQuestionGetPayload<{ select: typeof authoredQuestionSelect }>;
type Transaction = Prisma.TransactionClient;

export class DsaBlockAssessmentPreparationError extends Error {
  constructor(
    readonly code:
      | "BLOCK_NOT_FOUND"
      | "ASSESSMENT_NOT_READY"
      | "ASSESSMENT_RECORD_MISSING"
      | "ASSESSMENT_SNAPSHOT_INVALID"
      | "INSUFFICIENT_GROUNDED_CODE_EVIDENCE"
      | "TRANSFER_QUESTIONS_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "DsaBlockAssessmentPreparationError";
  }
}

/**
 * Prepares the immutable assessment contract before any interview session is
 * created. This is intentionally deterministic and AI-free: every scored
 * review answer is tied to persisted execution, authored metadata, or a
 * simple static source-code observation.
 */
export class DsaBlockAssessmentPreparationService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareCurrent(
    ownerId: string,
    options: { allowSyntheticEvidence?: boolean } = {}
  ): Promise<DsaBlockAssessmentSnapshot> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await tx.dsaPracticeBlock.findFirst({
          where: { ownerId, isCurrent: true },
          select: blockSelect
        });
        assertReadyBlock(block);

        const assessment = block.assessment;
        if (!assessment) {
          throw new DsaBlockAssessmentPreparationError(
            "ASSESSMENT_RECORD_MISSING",
            "This DSA block is missing its durable assessment record."
          );
        }
        if (assessment.assessmentSnapshot) {
          try {
            return parseDsaBlockAssessmentSnapshot(assessment.assessmentSnapshot);
          } catch {
            throw new DsaBlockAssessmentPreparationError(
              "ASSESSMENT_SNAPSHOT_INVALID",
              "This DSA block has an invalid saved assessment snapshot."
            );
          }
        }

        const [profile, verifiedAttempts, authoredQuestions, completedRows] = await Promise.all([
          tx.candidateProfile.findUnique({ where: { ownerId }, select: { teacherId: true } }),
          tx.userQuestionAttempt.findMany({
            where: {
              ownerId,
              sourceType: RoadmapQuestionSourceType.DSA,
              verificationStatus: "VERIFIED",
              dsaQuestionSlug: { in: block.questionSlugs },
              answer: { not: null }
            },
            select: reviewAttemptSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }]
          }),
          tx.dsaQuestion.findMany({ select: authoredQuestionSelect }),
          tx.userQuestionProgress.findMany({
            where: {
              roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
              sourceType: RoadmapQuestionSourceType.DSA,
              status: RoadmapProgressStatus.COMPLETED,
              dsaQuestionSlug: { not: null }
            },
            select: { dsaQuestionSlug: true }
          })
        ]);

        // One best attempt per block question: accepted beats non-accepted,
        // then higher score, then the most recent attempt, then id. This keeps
        // a retry from surfacing stale code while making ties deterministic.
        let sourceAttempts = latestBestAttempts(verifiedAttempts, block.questionSlugs);
        let reviewItems = selectReviewItems(sourceAttempts, block.questionSlugs);
        if (
          options.allowSyntheticEvidence === true &&
          (reviewItems.length < MIN_REVIEW_ITEMS || !hasCodeDependentMajority(reviewItems))
        ) {
          const synthetic = developmentReviewAttempt(
            authoredQuestions,
            block.questionSlugs,
            sourceAttempts
          );
          if (synthetic) {
            sourceAttempts = [...sourceAttempts, synthetic];
            reviewItems = selectReviewItems(sourceAttempts, block.questionSlugs);
          }
        }
        if (reviewItems.length < MIN_REVIEW_ITEMS || !hasCodeDependentMajority(reviewItems)) {
          throw new DsaBlockAssessmentPreparationError(
            "INSUFFICIENT_GROUNDED_CODE_EVIDENCE",
            "Run verified code for more problems in this block before preparing the code-review round."
          );
        }

        const completedSlugs = new Set(
          completedRows.flatMap((row) => (row.dsaQuestionSlug ? [row.dsaQuestionSlug] : []))
        );
        const selectedTransferQuestions = selectTransferQuestions({
          authoredQuestions,
          blockQuestionSlugs: block.questionSlugs,
          completedSlugs,
          recommendationSnapshot: block.recommendationSnapshot,
          reviewItems,
          weakestPattern: weakestVerifiedPattern(sourceAttempts, block.questionSlugs)
        });
        if (selectedTransferQuestions.length !== 2) {
          throw new DsaBlockAssessmentPreparationError(
            "TRANSFER_QUESTIONS_UNAVAILABLE",
            "Two suitable authored transfer questions are not available for this block."
          );
        }
        const transferQuestions = freezeTransferRunnerContracts(selectedTransferQuestions);

        const snapshot = parseDsaBlockAssessmentSnapshot({
          schemaVersion: DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION,
          rubricVersion: DSA_BLOCK_ASSESSMENT_RUBRIC_VERSION,
          blockId: block.id,
          blockOrdinal: block.ordinal,
          blockRecommendationSnapshot: block.recommendationSnapshot,
          teacher: { id: profile?.teacherId ?? null, source: "candidate-profile-at-preparation" },
          durationMinutes: DSA_BLOCK_ASSESSMENT_DURATION_MINUTES,
          preparedAt: new Date().toISOString(),
          reviewItems,
          transferQuestions
        });

        await tx.dsaBlockAssessment.update({
          where: { id: assessment.id },
          data: { assessmentSnapshot: toJson(snapshot) }
        });
        return snapshot;
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }
}

/** Development-only fixture used by the explicitly guarded early-start path. */
function developmentReviewAttempt(
  authoredQuestions: AuthoredQuestion[],
  blockQuestionSlugs: string[],
  existingAttempts: ReviewAttempt[]
): ReviewAttempt | null {
  const attempted = new Set(existingAttempts.flatMap((attempt) => attempt.dsaQuestionSlug ?? []));
  const question =
    authoredQuestions.find(
      (candidate) => blockQuestionSlugs.includes(candidate.slug) && !attempted.has(candidate.slug)
    ) ?? authoredQuestions.find((candidate) => blockQuestionSlugs.includes(candidate.slug));
  if (!question) return null;

  const examples = Array.isArray(question.examples) ? question.examples : [];
  const visibleTestEvidence = examples.slice(0, 3).flatMap((value) => {
    const example = jsonRecord(value as Prisma.JsonValue);
    const input = boundedText(example?.input);
    const output = boundedText(example?.output);
    return input && output
      ? [{ input, expectedOutput: output, actualOutput: output, error: null, passed: true }]
      : [];
  });
  if (!visibleTestEvidence.length) {
    visibleTestEvidence.push({
      input: "development fixture input",
      expectedOutput: "development fixture output",
      actualOutput: "development fixture output",
      error: null,
      passed: true
    });
  }

  return {
    id: "00000000-0000-4000-8000-000000000001",
    dsaQuestionSlug: question.slug,
    answer: [
      "function developmentAssessmentFixture(values) {",
      "  const seen = new Map();",
      "  for (const value of values) seen.set(value, true);",
      "  return values;",
      "}"
    ].join("\n"),
    score: 1,
    correctness: "accepted",
    language: "javascript",
    evaluatorVersion: "dsa-assessment-development-bypass-v1",
    feedback: {
      source: "development-assessment-bypass",
      testsPassed: visibleTestEvidence.length,
      testCount: visibleTestEvidence.length,
      visibleTestEvidence
    },
    createdAt: new Date(0),
    dsaQuestion: {
      slug: question.slug,
      title: question.title,
      primaryPattern: question.primaryPattern,
      complexity: question.complexity,
      edgeCases: question.edgeCases
    }
  };
}

function assertReadyBlock(block: BlockRecord | null): asserts block is BlockRecord {
  if (!block) {
    throw new DsaBlockAssessmentPreparationError(
      "BLOCK_NOT_FOUND",
      "No current DSA practice block was found for this candidate."
    );
  }
  if (block.status !== DsaPracticeBlockStatus.ASSESSMENT_READY) {
    throw new DsaBlockAssessmentPreparationError(
      "ASSESSMENT_NOT_READY",
      "Complete the recommended DSA block before preparing its assessment."
    );
  }
}

function selectReviewItems(
  attempts: ReviewAttempt[],
  blockQuestionSlugs: string[]
): DsaBlockAssessmentReviewItem[] {
  const order = new Map(blockQuestionSlugs.map((slug, index) => [slug, index]));
  const candidates = attempts
    .flatMap((attempt) => buildGroundedReviewItems(attempt))
    .sort(
      (left, right) =>
        (order.get(left.sourceQuestionSlug) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(right.sourceQuestionSlug) ?? Number.MAX_SAFE_INTEGER) ||
        left.sourceAttemptId.localeCompare(right.sourceAttemptId) ||
        left.family.localeCompare(right.family)
    );
  const selected: DsaBlockAssessmentReviewItem[] = [];
  const sourceQuestions = new Set<string>();
  const sourcePatterns = new Set<string>();
  const families = [
    "execution-case",
    "execution-evidence",
    "optimization-review",
    "static-code-cue",
    "pattern-choice",
    "complexity-target",
    "edge-case"
  ] as const;

  for (const family of families) {
    const candidate = chooseReviewCandidate(
      candidates.filter((item) => item.family === family),
      sourceQuestions,
      sourcePatterns
    );
    if (!candidate) continue;
    selected.push(candidate);
    sourceQuestions.add(candidate.sourceQuestionSlug);
    sourcePatterns.add(candidate.sourceQuestionPattern);
  }

  while (selected.length < MIN_REVIEW_ITEMS) {
    const candidate = chooseReviewCandidate(
      candidates.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id)),
      sourceQuestions,
      sourcePatterns
    );
    if (!candidate) break;
    selected.push(candidate);
    sourceQuestions.add(candidate.sourceQuestionSlug);
    sourcePatterns.add(candidate.sourceQuestionPattern);
  }

  // A sixth item adds useful variation only when there is independently
  // grounded material; it never duplicates a question ID or exceeds the
  // promised six rapid prompts.
  if (selected.length >= MIN_REVIEW_ITEMS) {
    const sixth = chooseReviewCandidate(
      candidates.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id)),
      sourceQuestions,
      sourcePatterns
    );
    if (sixth) selected.push(sixth);
  }

  return selected.slice(0, MAX_REVIEW_ITEMS);
}

function hasCodeDependentMajority(items: DsaBlockAssessmentReviewItem[]): boolean {
  const codeDependent = items.filter(
    (item) =>
      item.grounding.kind === "saved-execution-evidence" ||
      item.grounding.kind === "deterministic-static-analysis"
  ).length;
  return codeDependent >= Math.ceil(items.length / 2);
}

function latestBestAttempts(
  attempts: ReviewAttempt[],
  blockQuestionSlugs: string[]
): ReviewAttempt[] {
  const allowed = new Set(blockQuestionSlugs);
  const bestByQuestion = new Map<string, ReviewAttempt>();
  for (const attempt of attempts) {
    if (!attempt.dsaQuestionSlug || !allowed.has(attempt.dsaQuestionSlug)) continue;
    const existing = bestByQuestion.get(attempt.dsaQuestionSlug);
    if (!existing || compareAttemptQuality(attempt, existing) < 0) {
      bestByQuestion.set(attempt.dsaQuestionSlug, attempt);
    }
  }
  const order = new Map(blockQuestionSlugs.map((slug, index) => [slug, index]));
  return [...bestByQuestion.values()].sort(
    (left, right) =>
      (order.get(left.dsaQuestionSlug ?? "") ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.dsaQuestionSlug ?? "") ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id)
  );
}

/** Negative means `left` is the preferred review source. */
function compareAttemptQuality(left: ReviewAttempt, right: ReviewAttempt): number {
  const accepted = (attempt: ReviewAttempt) => (attempt.correctness === "accepted" ? 1 : 0);
  return (
    accepted(right) - accepted(left) ||
    (right.score ?? Number.NEGATIVE_INFINITY) - (left.score ?? Number.NEGATIVE_INFINITY) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    right.id.localeCompare(left.id)
  );
}

function chooseReviewCandidate(
  candidates: DsaBlockAssessmentReviewItem[],
  sourceQuestions: Set<string>,
  sourcePatterns: Set<string>
): DsaBlockAssessmentReviewItem | null {
  return (
    candidates
      .map((candidate) => ({
        candidate,
        diversity:
          (sourceQuestions.has(candidate.sourceQuestionSlug) ? 0 : 2) +
          (sourcePatterns.has(candidate.sourceQuestionPattern) ? 0 : 1)
      }))
      .sort(
        (left, right) =>
          right.diversity - left.diversity || left.candidate.id.localeCompare(right.candidate.id)
      )[0]?.candidate ?? null
  );
}

function buildGroundedReviewItems(attempt: ReviewAttempt): DsaBlockAssessmentReviewItem[] {
  if (!attempt.dsaQuestion || !attempt.dsaQuestionSlug || !usableCode(attempt.answer)) return [];
  const question = attempt.dsaQuestion;
  const sourceCode = attempt.answer;
  const base = {
    sourceAttemptId: attempt.id,
    sourceQuestionSlug: question.slug,
    sourceQuestionTitle: question.title,
    sourceQuestionPattern: question.primaryPattern,
    sourceCode,
    codeSnippet: focusedCodeSnippet(sourceCode)
  };
  const items: DsaBlockAssessmentReviewItem[] = [];

  for (const test of visibleExecutionFacts(attempt)) {
    items.push(
      reviewItem({
        ...base,
        family: "execution-case",
        idSuffix: String(test.index),
        prompt: `For the recorded visible input ${test.input}, what did this exact saved code produce?`,
        correct: test.outcome,
        distractors: executionCaseDistractors(test.outcome),
        rationale: test.rationale,
        metric: "correctness-edge-cases",
        grounding: {
          kind: "saved-execution-evidence",
          source: `UserQuestionAttempt:${attempt.id}`,
          detail: "Visible test fact persisted with the verified standalone code run.",
          evidence: test.evidence
        }
      })
    );
  }

  const optimization = optimizationCue(sourceCode, complexityTime(question.complexity));
  if (optimization) {
    items.push(
      reviewItem({
        ...base,
        codeSnippet: optimization.codeSnippet,
        family: "optimization-review",
        prompt: optimization.prompt,
        correct: optimization.correct,
        distractors: optimization.distractors,
        rationale: optimization.rationale,
        metric: "efficiency",
        grounding: {
          kind: "deterministic-static-analysis",
          source: `UserQuestionAttempt:${attempt.id}`,
          detail: optimization.detail,
          evidence: optimization.evidence
        }
      })
    );
  }

  const staticCue = staticCodeCue(sourceCode);
  if (staticCue) {
    items.push(
      reviewItem({
        ...base,
        codeSnippet: staticCue.codeSnippet,
        family: "static-code-cue",
        prompt: `What does this exact code excerpt contain?`,
        correct: staticCue.label,
        distractors: staticCue.distractors,
        rationale: `The saved source contains ${staticCue.explanation}.`,
        metric: staticCue.metric,
        grounding: {
          kind: "deterministic-static-analysis",
          source: `UserQuestionAttempt:${attempt.id}`,
          detail: staticCue.explanation,
          evidence: { matcher: staticCue.matcher }
        }
      })
    );
  }

  items.push(
    reviewItem({
      ...base,
      family: "pattern-choice",
      prompt: `Which primary pattern is authored for the problem this saved code solves?`,
      correct: question.primaryPattern,
      distractors: alternativePatterns(question.primaryPattern),
      rationale: `The authored metadata for ${question.title} identifies ${question.primaryPattern} as its primary pattern.`,
      metric: "pattern-recognition",
      grounding: {
        kind: "authored-reference-metadata",
        source: `DsaQuestion:${question.slug}`,
        detail: "Primary pattern from immutable authored question metadata.",
        evidence: { primaryPattern: question.primaryPattern }
      }
    })
  );

  const timeComplexity = complexityTime(question.complexity);
  if (timeComplexity) {
    items.push(
      reviewItem({
        ...base,
        family: "complexity-target",
        prompt: `For the authored ${question.title} solution, which target time complexity should you be able to justify while reviewing this saved code?`,
        correct: timeComplexity,
        distractors: complexityDistractors(timeComplexity),
        rationale: `The authored reference metadata documents ${timeComplexity} time for this problem's intended approach.`,
        metric: "efficiency",
        grounding: {
          kind: "authored-reference-metadata",
          source: `DsaQuestion:${question.slug}`,
          detail:
            "Target time complexity from immutable authored question metadata; it does not claim the candidate code has that complexity.",
          evidence: { time: timeComplexity }
        }
      })
    );
  }

  const edgeCase = question.edgeCases.find((value) => value.trim().length > 0);
  if (edgeCase) {
    items.push(
      reviewItem({
        ...base,
        family: "edge-case",
        prompt: `Which edge case is explicitly documented for ${question.title} and should be checked against this exact saved solution?`,
        correct: edgeCase,
        distractors: ["A successful network retry", "A browser refresh", "A missing CSS class"],
        rationale: `This edge case is preserved in the authored metadata for ${question.title}.`,
        metric: "correctness-edge-cases",
        grounding: {
          kind: "authored-reference-metadata",
          source: `DsaQuestion:${question.slug}`,
          detail: "Documented edge case from immutable authored question metadata.",
          evidence: { edgeCase }
        }
      })
    );
  }

  const execution = executionEvidence(attempt);
  if (execution) {
    items.push(
      reviewItem({
        ...base,
        family: "execution-evidence",
        prompt: `What did the saved verified run for this exact submission record?`,
        correct: execution.fact,
        distractors: executionDistractors(execution.fact),
        rationale: execution.rationale,
        metric: "correctness-edge-cases",
        grounding: {
          kind: "saved-execution-evidence",
          source: `UserQuestionAttempt:${attempt.id}`,
          detail: "Test-run result persisted with the verified submission.",
          evidence: execution.evidence
        }
      })
    );
  }

  return items;
}

function reviewItem(
  input: Omit<DsaBlockAssessmentReviewItem, "id" | "options" | "correctOption"> & {
    correct: string;
    distractors: string[];
    idSuffix?: string;
  }
): DsaBlockAssessmentReviewItem {
  const { idSuffix, ...item } = input;
  const options = deterministicOptions(
    item.correct,
    item.distractors,
    item.sourceAttemptId + item.family + (idSuffix ?? "")
  );
  return {
    ...item,
    id: `${item.sourceAttemptId}:${item.family}${idSuffix ? `:${idSuffix}` : ""}`,
    options,
    correctOption: options.indexOf(item.correct)
  };
}

function selectTransferQuestions(input: {
  authoredQuestions: AuthoredQuestion[];
  blockQuestionSlugs: string[];
  completedSlugs: Set<string>;
  recommendationSnapshot: Prisma.JsonValue;
  reviewItems: DsaBlockAssessmentReviewItem[];
  weakestPattern: string | null;
}): DsaBlockAssessmentTransferQuestion[] {
  const blockSet = new Set(input.blockQuestionSlugs);
  const primaryPattern =
    input.weakestPattern ??
    input.reviewItems[0]?.sourceQuestionPattern ??
    input.authoredQuestions.find((question) => blockSet.has(question.slug))?.primaryPattern ??
    null;
  const secondaryPattern =
    input.reviewItems.find((item) => item.sourceQuestionPattern !== primaryPattern)
      ?.sourceQuestionPattern ??
    input.authoredQuestions.find(
      (question) => blockSet.has(question.slug) && question.primaryPattern !== primaryPattern
    )?.primaryPattern ??
    null;
  const targetDifficulty = targetDifficultyForTier(
    recommendationTier(input.recommendationSnapshot)
  );
  const available = input.authoredQuestions
    .filter((question) => !OPERATION_DSA_SLUGS.has(question.slug))
    .filter((question) => !blockSet.has(question.slug))
    .sort(
      (left, right) =>
        difficultyDistance(left.difficulty, targetDifficulty) -
          difficultyDistance(right.difficulty, targetDifficulty) ||
        left.phase.phaseNumber - right.phase.phaseNumber ||
        left.recommendedOrder - right.recommendedOrder ||
        left.slug.localeCompare(right.slug)
    );
  const selected: DsaBlockAssessmentTransferQuestion[] = [];

  const choose = (
    pattern: string | null,
    reasons: DsaBlockAssessmentTransferQuestion["selectionReason"][]
  ) => {
    const matching = available.filter(
      (question) =>
        !selected.some((selectedQuestion) => selectedQuestion.slug === question.slug) &&
        (pattern === null || question.primaryPattern === pattern)
    );
    const candidate =
      matching.find((question) => !input.completedSlugs.has(question.slug)) ??
      (reasons.includes("previously-seen-fallback")
        ? matching.find((question) => input.completedSlugs.has(question.slug))
        : undefined);
    if (!candidate) return;
    const reason = input.completedSlugs.has(candidate.slug)
      ? "previously-seen-fallback"
      : reasons[0]!;
    selected.push(snapshotTransferQuestion(candidate, reason));
  };

  choose(primaryPattern, ["primary-pattern-unseen", "previously-seen-fallback"]);
  choose(secondaryPattern, ["secondary-pattern-unseen", "previously-seen-fallback"]);
  while (selected.length < 2) {
    const selectedCount = selected.length;
    choose(null, ["calibrated-unseen-fallback", "previously-seen-fallback"]);
    if (selected.length === selectedCount) break;
  }
  return selected;
}

function weakestVerifiedPattern(
  attempts: ReviewAttempt[],
  blockQuestionSlugs: string[]
): string | null {
  const blockOrder = new Map(blockQuestionSlugs.map((slug, index) => [slug, index]));
  const aggregate = new Map<string, { total: number; count: number; firstOrder: number }>();
  for (const attempt of attempts) {
    if (!attempt.dsaQuestion || !attempt.dsaQuestionSlug || attempt.score === null) continue;
    const pattern = attempt.dsaQuestion.primaryPattern;
    const existing = aggregate.get(pattern) ?? {
      total: 0,
      count: 0,
      firstOrder: blockOrder.get(attempt.dsaQuestionSlug) ?? Number.MAX_SAFE_INTEGER
    };
    existing.total += attempt.score;
    existing.count += 1;
    existing.firstOrder = Math.min(
      existing.firstOrder,
      blockOrder.get(attempt.dsaQuestionSlug) ?? Number.MAX_SAFE_INTEGER
    );
    aggregate.set(pattern, existing);
  }
  return (
    [...aggregate.entries()].sort(
      ([leftPattern, left], [rightPattern, right]) =>
        left.total / left.count - right.total / right.count ||
        left.firstOrder - right.firstOrder ||
        leftPattern.localeCompare(rightPattern)
    )[0]?.[0] ?? null
  );
}

function snapshotTransferQuestion(
  question: AuthoredQuestion,
  selectionReason: DsaBlockAssessmentTransferQuestion["selectionReason"]
): DsaBlockAssessmentTransferQuestion {
  return {
    slug: question.slug,
    contentVersion: question.contentVersion,
    phaseSlug: question.phaseSlug,
    title: question.title,
    source: question.source,
    externalUrl: question.externalUrl,
    primaryPattern: question.primaryPattern,
    subPatterns: question.subPatterns,
    difficulty: question.difficulty,
    expectedTimeMinutes: question.expectedTimeMinutes,
    recommendedOrder: question.recommendedOrder,
    prerequisites: question.prerequisites,
    conceptsTested: question.conceptsTested,
    commonMistakes: question.commonMistakes,
    interviewSignals: question.interviewSignals,
    followUpPrompts: question.followUpPrompts,
    promptSummary: question.promptSummary,
    highLevelApproach: question.highLevelApproach,
    complexity: question.complexity,
    problemStatement: question.problemStatement,
    constraints: question.constraints,
    examples: question.examples,
    keyInsight: question.keyInsight,
    hints: question.hints,
    approaches: question.approaches,
    edgeCases: question.edgeCases,
    relatedQuestions: question.relatedQuestions,
    phaseNumber: question.phase.phaseNumber,
    selectionReason
  };
}

/**
 * Freezes the test contract while the authored question is still in hand. The
 * contract includes hidden cases, but it remains only in assessmentSnapshot;
 * runtime plans and API serializers receive neither it nor solution metadata.
 */
function freezeTransferRunnerContracts(
  questions: DsaBlockAssessmentTransferQuestion[]
): DsaBlockAssessmentTransferQuestion[] {
  return questions.map((question) => {
    const examples = Array.isArray(question.examples) ? (question.examples as DsaExample[]) : [];
    const testCases = buildTestCases(examples, question.slug);
    if (!testCases.length) {
      throw new DsaBlockAssessmentPreparationError(
        "TRANSFER_QUESTIONS_UNAVAILABLE",
        `The transfer question ${question.slug} has no frozen runnable cases.`
      );
    }
    const starterQuestion = { slug: question.slug, examples };
    return {
      ...question,
      runnerContract: {
        version: 1,
        functionName: dsaFunctionName(question.slug),
        // CodeTestCase is JSON-safe by construction. Copy it so a later
        // authored bank mutation cannot alter the prepared assessment.
        testCases: JSON.parse(JSON.stringify(testCases)) as unknown[]
      },
      starterCode: {
        javascript: dsaStarterCode(starterQuestion, "javascript"),
        python: dsaStarterCode(starterQuestion, "python"),
        cpp: dsaStarterCode(starterQuestion, "cpp"),
        java: dsaStarterCode(starterQuestion, "java")
      }
    };
  });
}

function recommendationTier(snapshot: Prisma.JsonValue): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const recommendation = (snapshot as Prisma.JsonObject).recommendation;
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation))
    return null;
  const tier = (recommendation as Prisma.JsonObject).tier;
  return typeof tier === "string" ? tier : null;
}

function targetDifficultyForTier(tier: string | null): string {
  if (tier === "foundations" || tier === "diagnostic") return "easy";
  if (tier === "advanced") return "hard";
  return "medium";
}

function difficultyDistance(difficulty: string, target: string): number {
  const rank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  return Math.abs((rank[difficulty] ?? 1) - (rank[target] ?? 1));
}

function complexityTime(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const time = (value as Prisma.JsonObject).time;
  return typeof time === "string" && time.trim() ? time : null;
}

function executionEvidence(attempt: ReviewAttempt): {
  fact: string;
  rationale: string;
  evidence: Record<string, unknown>;
} | null {
  const feedback = jsonRecord(attempt.feedback);
  const testsPassed = nonNegativeInteger(feedback?.testsPassed);
  const testCount = nonNegativeInteger(feedback?.testCount);
  if (testsPassed === null || testCount === null || testCount <= 0) return null;
  const fact = `${testsPassed} of ${testCount} recorded tests passed`;
  return {
    fact,
    rationale: `The saved verified execution recorded ${fact}.`,
    evidence: {
      testsPassed,
      testCount,
      accepted: attempt.correctness === "accepted",
      score: attempt.score,
      evaluatorVersion: attempt.evaluatorVersion,
      language: attempt.language
    }
  };
}

function visibleExecutionFacts(attempt: ReviewAttempt): Array<{
  index: number;
  input: string;
  outcome: string;
  rationale: string;
  evidence: Record<string, unknown>;
}> {
  const feedback = jsonRecord(attempt.feedback);
  const raw = feedback?.visibleTestEvidence;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).flatMap((value, index) => {
    const test = jsonRecord(value as Prisma.JsonValue);
    const input = boundedText(test?.input);
    const expectedOutput = boundedText(test?.expectedOutput);
    const actualOutput = boundedText(test?.actualOutput);
    const error = boundedText(test?.error);
    const passed = test?.passed;
    if (!input || !expectedOutput || typeof passed !== "boolean") return [];
    const outcome = error
      ? `Runtime error: ${error}`
      : `Output: ${actualOutput || "(empty output)"}`;
    return [
      {
        index,
        input,
        outcome,
        rationale: passed
          ? `The persisted visible run returned ${outcome.slice("Output: ".length)} for this input, matching the saved expected output.`
          : `The persisted visible run recorded ${outcome} for this input; it did not match the saved expected output.`,
        evidence: { input, expectedOutput, actualOutput, error: error || null, passed }
      }
    ];
  });
}

function focusedCodeSnippet(sourceCode: string): string {
  const firstLineBreak = sourceCode.indexOf("\n");
  const focused = firstLineBreak === -1 ? sourceCode : sourceCode.slice(0, firstLineBreak + 1);
  return focused.slice(0, 1_600);
}

function snippetAroundMatch(sourceCode: string, match: RegExpMatchArray): string {
  const start = Math.max(0, (match.index ?? 0) - 120);
  return sourceCode.slice(start, start + 1_600);
}

function optimizationCue(
  sourceCode: string,
  authoredTimeTarget: string | null
): {
  codeSnippet: string;
  prompt: string;
  correct: string;
  distractors: string[];
  rationale: string;
  detail: string;
  evidence: Record<string, unknown>;
} | null {
  const sort = sourceCode.match(/\.sort\s*\(/);
  if (!sort || !authoredTimeTarget || !/^O\(n\)$/i.test(authoredTimeTarget.trim())) return null;
  return {
    codeSnippet: snippetAroundMatch(sourceCode, sort),
    prompt: `This excerpt calls .sort(...), while the authored reference target is ${authoredTimeTarget}. What is the most defensible optimization follow-up?`,
    correct: "Check whether sorting is necessary before adopting the documented one-pass target.",
    distractors: [
      "Assume sorting is already O(n) for every input.",
      "Remove the return statement without reviewing the algorithm.",
      "Add network retries around the loop."
    ],
    rationale:
      "The saved code contains a sort call and the authored reference documents an O(n) target. This asks for investigation, not a claim that removing sort is always correct.",
    detail:
      "A `.sort(...)` call is present in the exact code excerpt while authored metadata records an O(n) target.",
    evidence: { matcher: "sort-call-v1", authoredTimeTarget }
  };
}

function staticCodeCue(sourceCode: string): {
  label: string;
  distractors: string[];
  explanation: string;
  matcher: string;
  codeSnippet: string;
  metric: DsaBlockAssessmentReviewItem["metric"];
} | null {
  const map = sourceCode.match(/\bnew\s+Map\s*\(|\bHashMap\s*<|\bunordered_map\s*</);
  if (map) {
    return {
      label: "A map/hash-map allocation",
      distractors: [
        "A breadth-first queue allocation",
        "A recursive call",
        "A binary search midpoint"
      ],
      explanation: "a map/hash-map allocation matched by a deterministic source-code pattern",
      matcher: "map-allocation-v1",
      codeSnippet: snippetAroundMatch(sourceCode, map),
      metric: "pattern-recognition"
    };
  }
  const set = sourceCode.match(/\bnew\s+Set\s*\(|\bHashSet\s*<|\bunordered_set\s*</);
  if (set) {
    return {
      label: "A set allocation",
      distractors: [
        "A linked-list node allocation",
        "A priority-queue allocation",
        "A recursive call"
      ],
      explanation: "a set allocation matched by a deterministic source-code pattern",
      matcher: "set-allocation-v1",
      codeSnippet: snippetAroundMatch(sourceCode, set),
      metric: "pattern-recognition"
    };
  }
  const sort = sourceCode.match(/\.sort\s*\(/);
  if (sort) {
    return {
      label: "A sort call",
      distractors: ["A map allocation", "A queue dequeue", "A binary-search midpoint"],
      explanation: "a `.sort(...)` call matched by a deterministic source-code pattern",
      matcher: "sort-call-v1",
      codeSnippet: snippetAroundMatch(sourceCode, sort),
      metric: "efficiency"
    };
  }
  const loop = sourceCode.match(/\b(for|while)\s*\(/);
  if (loop) {
    return {
      label: "An explicit loop",
      distractors: ["A sort call", "A map allocation", "A recursive call"],
      explanation: "an explicit for/while loop matched by a deterministic source-code pattern",
      matcher: "explicit-loop-v1",
      codeSnippet: snippetAroundMatch(sourceCode, loop),
      metric: "code-quality"
    };
  }
  const returned = sourceCode.match(/\breturn\b/);
  if (returned) {
    return {
      label: "A return statement",
      distractors: ["A sort call", "A map allocation", "A recursive call"],
      explanation: "a return statement matched by a deterministic source-code pattern",
      matcher: "return-statement-v1",
      codeSnippet: snippetAroundMatch(sourceCode, returned),
      metric: "code-quality"
    };
  }
  return null;
}

function deterministicOptions(correct: string, distractors: string[], seed: string): string[] {
  const unique = [correct, ...distractors].filter(
    (value, index, values) => value.trim() && values.indexOf(value) === index
  );
  const minimum = ["None of the above", "An unrelated browser event", "A database migration"];
  for (const option of minimum) {
    if (unique.length >= 4) break;
    if (!unique.includes(option) && option !== correct) unique.push(option);
  }
  const offset =
    [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % unique.length;
  return [...unique.slice(offset), ...unique.slice(0, offset)];
}

function alternativePatterns(correct: string): string[] {
  return ["two-pointers", "sliding-window", "binary-search", "dynamic-programming"].filter(
    (pattern) => pattern !== correct
  );
}

function complexityDistractors(correct: string): string[] {
  return ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"].filter(
    (complexity) => complexity !== correct
  );
}

function executionDistractors(correct: string): string[] {
  return [
    "No tests were recorded",
    "All recorded tests failed",
    "The code was never executed"
  ].filter((option) => option !== correct);
}

function executionCaseDistractors(correct: string): string[] {
  return [
    "Output: (a different recorded value)",
    "Runtime error: no output was recorded",
    "The input was not part of the saved visible run"
  ].filter((option) => option !== correct);
}

function usableCode(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function jsonRecord(value: Prisma.JsonValue | null): Prisma.JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : null;
}

function nonNegativeInteger(value: Prisma.JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function boundedText(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 500 ? value : null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockOwner(tx: Transaction, ownerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;
}
