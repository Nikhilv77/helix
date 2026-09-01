import { Prisma } from "@prisma/client";
import { candidatePerformanceProfileSchema } from "@/lib/interviews/performance-profile";
import type { CandidateResume } from "@/lib/shared/types";
import type {
  NonDsaPracticeSessionKey,
  PrepPracticeChapter,
  PrepPracticeFormat,
  PrepPracticeQuestion,
  PrepPracticeQuestionSummary,
  PrepPracticeReview,
  PrepPracticeSession
} from "@/lib/practice/prep-practice";
import { practiceQuestionHref } from "@/lib/practice/prep-practice";
import { diagnoseArtifact } from "@/lib/practice/diagnose";
import { findTheFlawSnippet } from "@/lib/practice/find-the-flaw";
import { renderPrompt } from "@/lib/practice/prompt-personalization";
import { predictRunSnippet } from "@/lib/practice/predict-run";
import type { PrismaService } from "../database/prisma.service";
import type { FrontendRoadmapService } from "../roadmap/frontend-roadmap.service";
import { ApiRouteError } from "../http/api-error";
import { mcqOptions, type PrepPracticeEvaluator, skipReview } from "./prep-practice-evaluator";
import { normalizePrepQuestion } from "./questions/prep-question-adapter";
import {
  rankPrepRecommendations,
  type PrepInterviewSkillEvidence,
  type PrepRecommendationCandidate
} from "./prep-practice-recommendation";

type PrepAttemptAction = "submit" | "skip";

const placementInclude = {
  sessionProgress: { include: { sessionTemplate: true } },
  questionProgress: {
    include: {
      prepQuestionTemplate: true,
      chapterProgress: { include: { chapterTemplate: true } }
    }
  }
} as const;

type PrepPlacementRow = Prisma.PracticeQuestionPlacementGetPayload<{
  include: typeof placementInclude;
}>;

export class PrepPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roadmaps: Pick<FrontendRoadmapService, "recordPrepQuestionAttempt">,
    private readonly evaluator: Pick<PrepPracticeEvaluator, "evaluate">
  ) {}

  async session(
    ownerId: string,
    sessionKey: NonDsaPracticeSessionKey,
    now = Date.now()
  ): Promise<PrepPracticeSession | null> {
    const placements = await this.prisma.practiceQuestionPlacement.findMany({
      where: {
        practiceSessionKey: sessionKey,
        roadmap: { ownerId, role: "fullstack" }
      },
      include: placementInclude,
      orderBy: { order: "asc" }
    });
    if (!placements.length) return null;

    const [verifiedAttempts, storedPerformance] = await Promise.all([
      this.prisma.userQuestionAttempt.findMany({
        where: {
          ownerId,
          sourceType: "PREP",
          verificationStatus: "VERIFIED",
          prepQuestionTemplateId: { not: null },
          questionProgress: { roadmap: { ownerId, role: "fullstack" } }
        },
        select: {
          id: true,
          prepQuestionTemplateId: true,
          score: true,
          createdAt: true
        }
      }),
      this.prisma.candidatePerformanceProfileVersion.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { profile: true }
      })
    ]);
    const verifiedEvidence = aggregateVerifiedAttemptEvidence(verifiedAttempts);
    const masteredQuestionIds = new Set(
      [...verifiedEvidence]
        .filter(([, evidence]) => evidence.bestScore >= 0.72)
        .map(([questionId]) => questionId)
    );
    const interviewSkills = interviewSkillEvidence(storedPerformance?.profile);

    const sessionProgress = placements[0]!.sessionProgress;
    const chapterMap = new Map<string, PrepPracticeChapter>();
    const recommendationCandidates: PrepRecommendationCandidate[] = [];
    const summaries = placements.flatMap((placement): PrepPracticeQuestionSummary[] => {
      const question = placement.questionProgress.prepQuestionTemplate;
      if (!question) return [];
      const normalized = normalizePrepQuestion(question, {
        sessionKey,
        chapterKey: question.chapterKey
      });
      const chapterKey = normalized.classification.chapterKey;
      const chapterCopy = {
              title:
                placement.questionProgress.chapterProgress?.chapterTemplate.title ??
                titleCase(chapterKey),
              purpose:
                placement.questionProgress.chapterProgress?.chapterTemplate.purpose ??
                normalized.content.objective
            };
      const summary = questionSummary(sessionKey, placement, normalized.content.objective);
      const evidence = verifiedEvidence.get(question.id);
      recommendationCandidates.push({
        question: summary,
        prerequisites: question.prerequisites,
        selectionReason: placement.selectionReason,
        skillEvidenceText: [
          question.title,
          normalized.content.objective,
          question.competency,
          ...question.tags,
          ...question.whatItTests
        ].join(" "),
        bestVerifiedScore: evidence?.bestScore ?? null,
        latestVerifiedScore: evidence?.latestScore ?? null,
        lastVerifiedAt: evidence?.lastVerifiedAt ?? null,
        lastAttemptedAt: placement.questionProgress.lastAttemptedAt?.getTime() ?? null,
        completedAt: placement.questionProgress.completedAt?.getTime() ?? null,
        revealedHintCount: placement.questionProgress.revealedHintCount
      });
      const chapter = chapterMap.get(chapterKey) ?? {
        key: chapterKey,
        title: chapterCopy.title,
        purpose: chapterCopy.purpose,
        totalQuestions: 0,
        attemptedQuestions: 0,
        completedQuestions: 0,
        progressPercent: 0,
        questions: []
      };
      chapter.questions.push(summary);
      chapter.totalQuestions += 1;
      if (isAttempted(summary)) chapter.attemptedQuestions += 1;
      if (summary.status === "COMPLETED") chapter.completedQuestions += 1;
      chapter.progressPercent = percent(chapter.completedQuestions, chapter.totalQuestions);
      chapterMap.set(chapterKey, chapter);
      return [summary];
    });
    const recommendations = rankPrepRecommendations(recommendationCandidates, {
      now,
      masteredQuestionIds,
      interviewSkills
    });
    const recommendationById = new Map(
      recommendations.map((recommendation) => [recommendation.questionId, recommendation])
    );
    for (const summary of summaries) {
      summary.recommendationReason =
        recommendationById.get(summary.id)?.reason ?? "Review is not due yet";
    }
    const recommendedQuestionId = recommendations[0]?.questionId;

    return {
      key: sessionKey,
      title: sessionProgress.titleSnapshot ?? sessionProgress.sessionTemplate.title,
      purpose: sessionProgress.purposeSnapshot ?? sessionProgress.sessionTemplate.purpose,
      covers: sessionProgress.coversSnapshot,
      totalQuestions: summaries.length,
      attemptedQuestions: summaries.filter(isAttempted).length,
      completedQuestions: summaries.filter((question) => question.status === "COMPLETED").length,
      progressPercent: percent(
        summaries.filter((question) => question.status === "COMPLETED").length,
        summaries.length
      ),
      chapters: [...chapterMap.values()],
      recommendedQuestion:
        summaries.find((question) => question.id === recommendedQuestionId) ?? null
    };
  }

  async question(
    ownerId: string,
    sessionKey: NonDsaPracticeSessionKey,
    questionId: string
  ): Promise<PrepPracticeQuestion | null> {
    const placement = await this.prisma.practiceQuestionPlacement.findFirst({
      where: {
        practiceSessionKey: sessionKey,
        questionProgress: { prepQuestionTemplateId: questionId },
        roadmap: { ownerId, role: "fullstack" }
      },
      include: placementInclude
    });
    if (!placement?.questionProgress.prepQuestionTemplate) return null;

    const [ordered, note, latestAttempt] = await Promise.all([
      this.prisma.practiceQuestionPlacement.findMany({
        where: { sessionProgressId: placement.sessionProgressId },
        orderBy: { order: "asc" },
        select: {
          order: true,
          questionProgress: { select: { prepQuestionTemplateId: true } }
        }
      }),
      this.prisma.userPrepQuestionNote.findUnique({
        where: {
          ownerId_prepQuestionTemplateId: { ownerId, prepQuestionTemplateId: questionId }
        },
        select: { content: true }
      }),
      this.prisma.userQuestionAttempt.findFirst({
        where: {
          ownerId,
          questionProgressId: placement.questionProgressId,
          status: { in: ["SUBMITTED", "COMPLETED", "SKIPPED"] }
        },
        orderBy: { createdAt: "desc" },
        select: { feedback: true }
      })
    ]);
    // Tier 3 personalization needs the resume; one extra read on a page that
    // already makes several, and a failure here must not block the question.
    const profile = await this.prisma.candidateProfile
      .findUnique({
        where: { ownerId },
        select: {
          resumeAnalysis: true,
          resumeConfidence: true,
          targetCompany: true,
          level: true,
          dsaEditorLanguage: true
        }
      })
      .catch(() => null);

    const question = placement.questionProgress.prepQuestionTemplate;
    const normalized = normalizePrepQuestion(question, {
      sessionKey,
      chapterKey: question.chapterKey
    });
    const index = ordered.findIndex(
      (entry) => entry.questionProgress.prepQuestionTemplateId === questionId
    );
    const previous = index > 0 ? ordered[index - 1]?.questionProgress.prepQuestionTemplateId : null;
    const next = index >= 0 ? ordered[index + 1]?.questionProgress.prepQuestionTemplateId : null;

    return {
      sessionKey,
      sessionTitle:
        placement.sessionProgress.titleSnapshot ?? placement.sessionProgress.sessionTemplate.title,
      id: question.id,
      progressId: placement.questionProgressId,
      order: placement.order,
      totalInSession: ordered.length,
      chapterKey: normalized.classification.chapterKey,
      chapterTitle:
        placement.questionProgress.chapterProgress?.chapterTemplate.title ??
        titleCase(question.chapterKey),
      title: normalized.content.title,
      prompt: renderPrompt(
        { prompt: normalized.content.prompt, promptTemplate: question.promptTemplate },
        {
          resume: (profile?.resumeAnalysis as CandidateResume | null) ?? null,
          resumeConfidence: profile?.resumeConfidence ?? null,
          targetCompany: profile?.targetCompany ?? null,
          level: profile?.level ?? null,
          editorLanguage: profile?.dsaEditorLanguage ?? null
        }
      ),
      objective: normalized.content.objective,
      difficulty: normalized.targeting.difficulty,
      format: normalized.targeting.format === "code" ? "typed" : normalized.targeting.format,
      expectedMinutes: normalized.targeting.expectedMinutes,
      options: normalized.targeting.format === "mcq" ? mcqOptions(question.answerKey) : [],
      // Code and language only. `predictRunSnippet` deliberately drops
      // `expectedStdout` so the answer cannot reach the browser ahead of the
      // candidate's prediction.
      snippet:
        normalized.targeting.format === "predict-run"
          ? predictRunSnippet(question.answerKey)
          : normalized.targeting.format === "find-the-flaw"
            ? findTheFlawSnippet(question.answerKey)
            : null,
      // Evidence and symptom only — `diagnoseArtifact` drops the root cause and
      // the accepted fixes so they cannot be read ahead of the diagnosis.
      artifact:
        normalized.targeting.format === "diagnose"
          ? diagnoseArtifact(question.answerKey)
          : null,
      hints: normalized.coaching.hints,
      revealedHintCount: Math.min(
        placement.questionProgress.revealedHintCount,
        normalized.coaching.hints.length
      ),
      draftAnswer: placement.questionProgress.draftAnswer ?? "",
      note: note?.content ?? "",
      status: placement.questionProgress.status,
      attemptCount: placement.questionProgress.attemptCount,
      bestScore: placement.questionProgress.bestScore,
      previousHref: previous ? practiceQuestionHref(sessionKey, previous) : null,
      nextHref: next ? practiceQuestionHref(sessionKey, next) : null,
      sessionHref: `/practice/${sessionKey}`,
      review: reviewFromJson(latestAttempt?.feedback)
    };
  }

  async saveState(
    ownerId: string,
    input: {
      sessionKey: NonDsaPracticeSessionKey;
      questionId: string;
      draftAnswer?: string;
      revealedHintCount?: number;
      note?: string;
    }
  ): Promise<{ savedAt: number; revealedHintCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      // State writes and attempts share the same per-candidate lock. Combined
      // with the browser's serial save queue, an older autosave cannot commit
      // after a newer one, and hint progress remains monotonic across tabs.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;
      const progress = await tx.userQuestionProgress.findFirst({
        where: {
          prepQuestionTemplateId: input.questionId,
          roadmap: { ownerId, role: "fullstack" },
          practicePlacements: { some: { practiceSessionKey: input.sessionKey } }
        },
        include: { prepQuestionTemplate: true }
      });
      if (!progress) {
        throw new ApiRouteError(404, "PRACTICE_QUESTION_NOT_FOUND", "Practice question not found");
      }
      const hintCount = Math.min(
        Math.max(input.revealedHintCount ?? progress.revealedHintCount, progress.revealedHintCount),
        progress.prepQuestionTemplate?.hints.length ?? 0
      );
      const now = new Date();
      if (input.draftAnswer !== undefined || input.revealedHintCount !== undefined) {
        await tx.userQuestionProgress.update({
          where: { id: progress.id },
          data: {
            draftAnswer: input.draftAnswer,
            draftUpdatedAt: input.draftAnswer !== undefined ? now : undefined,
            revealedHintCount: hintCount
          }
        });
      }
      if (input.note !== undefined) {
        await tx.userPrepQuestionNote.upsert({
          where: {
            ownerId_prepQuestionTemplateId: {
              ownerId,
              prepQuestionTemplateId: input.questionId
            }
          },
          create: { ownerId, prepQuestionTemplateId: input.questionId, content: input.note },
          update: { content: input.note }
        });
      }
      return { savedAt: now.getTime(), revealedHintCount: hintCount };
    });
  }

  async attempt(
    ownerId: string,
    input: {
      requestId: string;
      sessionKey: NonDsaPracticeSessionKey;
      questionId: string;
      action: PrepAttemptAction;
      answer: string;
      selectedOptionIndex: number | null;
      durationMs: number | null;
    }
  ) {
    const progress = await this.authorizedProgress(ownerId, input.sessionKey, input.questionId);
    if (input.action === "submit") {
      const question = progress.prepQuestionTemplate;
      if (question?.format === "mcq") {
        const options = mcqOptions(question.answerKey);
        if (
          input.selectedOptionIndex === null ||
          input.selectedOptionIndex < 0 ||
          input.selectedOptionIndex >= options.length
        ) {
          throw new ApiRouteError(400, "PRACTICE_ANSWER_REQUIRED", "Choose an answer first.");
        }
      } else if (input.answer.trim().length < 12) {
        throw new ApiRouteError(
          400,
          "PRACTICE_ANSWER_REQUIRED",
          "Write a little more before submitting your answer."
        );
      }
    }
    const question = progress.prepQuestionTemplate;
    if (!question) {
      throw new ApiRouteError(404, "PRACTICE_QUESTION_NOT_FOUND", "Practice question not found");
    }
    const review =
      input.action === "submit"
        ? await this.evaluator.evaluate(question, {
            answer: input.answer,
            selectedOptionIndex: input.selectedOptionIndex
          })
        : skipReview(question);
    return this.roadmaps.recordPrepQuestionAttempt(ownerId, {
      idempotencyKey: input.requestId,
      sessionKey: input.sessionKey,
      prepQuestionTemplateId: input.questionId,
      action: input.action,
      answer: input.answer,
      selectedOptionIndex: input.selectedOptionIndex,
      durationMs: input.durationMs,
      review
    });
  }

  private async authorizedProgress(
    ownerId: string,
    sessionKey: NonDsaPracticeSessionKey,
    questionId: string
  ) {
    const progress = await this.prisma.userQuestionProgress.findFirst({
      where: {
        prepQuestionTemplateId: questionId,
        roadmap: { ownerId, role: "fullstack" },
        practicePlacements: { some: { practiceSessionKey: sessionKey } }
      },
      include: { prepQuestionTemplate: true }
    });
    if (!progress) {
      throw new ApiRouteError(404, "PRACTICE_QUESTION_NOT_FOUND", "Practice question not found");
    }
    return progress;
  }
}

function questionSummary(
  sessionKey: NonDsaPracticeSessionKey,
  placement: PrepPlacementRow,
  objective: string
): PrepPracticeQuestionSummary {
  const question = placement.questionProgress.prepQuestionTemplate;
  if (!question) throw new Error("PREP placement is missing its canonical question");
  return {
    id: question.id,
    progressId: placement.questionProgressId,
    order: placement.order,
    title: question.title,
    objective,
    chapterKey: question.chapterKey,
    difficulty: normalizeDifficulty(question.difficulty),
    format: normalizeFormat(question.format),
    expectedMinutes: question.expectedMinutes,
    status: placement.questionProgress.status,
    attemptCount: placement.questionProgress.attemptCount,
    bestScore: placement.questionProgress.bestScore,
    href: practiceQuestionHref(sessionKey, question.id),
    recommendationReason: "Next roadmap question"
  };
}

function aggregateVerifiedAttemptEvidence(
  attempts: Array<{
    id: string;
    prepQuestionTemplateId: string | null;
    score: number | null;
    createdAt: Date;
  }>
): Map<
  string,
  { bestScore: number; latestScore: number; lastVerifiedAt: number; lastAttemptId: string }
> {
  const evidence = new Map<
    string,
    { bestScore: number; latestScore: number; lastVerifiedAt: number; lastAttemptId: string }
  >();
  for (const attempt of attempts) {
    if (!attempt.prepQuestionTemplateId || attempt.score === null) continue;
    const existing = evidence.get(attempt.prepQuestionTemplateId);
    const attemptedAt = attempt.createdAt.getTime();
    const isLatest =
      !existing ||
      attemptedAt > existing.lastVerifiedAt ||
      (attemptedAt === existing.lastVerifiedAt &&
        attempt.id.localeCompare(existing.lastAttemptId) > 0);
    evidence.set(attempt.prepQuestionTemplateId, {
      bestScore: Math.max(existing?.bestScore ?? Number.NEGATIVE_INFINITY, attempt.score),
      latestScore: isLatest ? attempt.score : existing.latestScore,
      lastVerifiedAt: isLatest ? attemptedAt : existing.lastVerifiedAt,
      lastAttemptId: isLatest ? attempt.id : existing.lastAttemptId
    });
  }
  return evidence;
}

function interviewSkillEvidence(value: unknown): PrepInterviewSkillEvidence[] {
  const parsed = candidatePerformanceProfileSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.skills.map((skill) => ({
    skillKey: skill.skillKey,
    score: skill.score,
    confidence: skill.confidence,
    sampleSize: skill.sampleSize,
    lastObservedAt: skill.lastObservedAt,
    topicKeys: skill.topicKeys
  }));
}

function reviewFromJson(value: unknown): PrepPracticeReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const feedback = value as { review?: unknown };
  if (!feedback.review || typeof feedback.review !== "object" || Array.isArray(feedback.review))
    return null;
  return feedback.review as PrepPracticeReview;
}

function isAttempted(question: PrepPracticeQuestionSummary): boolean {
  return (
    question.attemptCount > 0 ||
    question.status === "IN_PROGRESS" ||
    question.status === "COMPLETED"
  );
}

function percent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeDifficulty(value: string): "easy" | "medium" | "hard" {
  return value === "easy" || value === "hard" ? value : "medium";
}

/**
 * Collapses an unknown format to `typed` so the list still renders. It has to
 * name every format explicitly: when it did not, `find-the-flaw` and `diagnose`
 * questions were listed as "Typed" on the session page while the workspace
 * rendered them correctly, because only this summary path was narrowing.
 */
function normalizeFormat(value: string): PrepPracticeFormat {
  const known: PrepPracticeFormat[] = [
    "mcq",
    "typed",
    "spoken",
    "diagram",
    "predict-run",
    "find-the-flaw",
    "diagnose"
  ];
  return known.includes(value as PrepPracticeFormat) ? (value as PrepPracticeFormat) : "typed";
}
