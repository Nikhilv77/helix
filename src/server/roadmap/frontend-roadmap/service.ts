import {
  MayaInsightKind,
  Prisma,
  RoadmapProgressStatus,
  RoadmapQuestionAttemptStatus,
  RoadmapQuestionSourceType,
  RoadmapTemplateStatus,
  PracticeSessionAvailability,
  UserRoadmapStatus
} from "@prisma/client";
import { PRACTICE_KEY_BY_TEMPLATE_SLUG } from "@/lib/practice/practice-roadmap";
import type {
  FrontendRoadmapChapter,
  FrontendRoadmapChapterDetail,
  FrontendRoadmapHome,
  FrontendRoadmapSession
} from "@/lib/roadmap/roadmap";
import type { PrismaService } from "../../database/prisma.service";
import type { CodeRunnerLanguage } from "../../dsa/code-test-harness";
import { Logger } from "../../common/logger";
import type { PrepPracticeReview } from "@/lib/practice/prep-practice";
import { dsaChapterIdForPattern } from "@/lib/roadmap/frontend-plan";
import { attemptStatus, normalizedScore, questionStatusAfterAction } from "./question-actions";
import { buildPersonalization } from "./personalization";
import { analyzeAttemptHistory, displayPattern, streakInsightBody } from "./insight-analysis";
import type { EnsureFrontendRoadmapResult, RoadmapQuestionAttemptAction } from "./types";

const FRONTEND_ROADMAP_ROLE = "fullstack";
const FRONTEND_ROADMAP_SLUG = "frontend-roadmap";
const practiceLogger = new Logger("PrepPractice");

type RoadmapTransaction = Prisma.TransactionClient;

const dsaAttemptProgressSelect = {
  id: true,
  sourceType: true,
  dsaQuestionSlug: true,
  prepQuestionTemplateId: true,
  status: true,
  bestScore: true,
  dsaQuestion: { select: { contentVersion: true } }
} satisfies Prisma.UserQuestionProgressSelect;

type DsaAttemptProgress = Prisma.UserQuestionProgressGetPayload<{
  select: typeof dsaAttemptProgressSelect;
}>;

export class FrontendRoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  async recordQuestionAttempt(
    ownerId: string,
    input: {
      idempotencyKey: string;
      action: RoadmapQuestionAttemptAction;
      dsaQuestionSlug: string;
      answer?: string | null;
      score?: number | null;
      durationMs?: number | null;
      language?: CodeRunnerLanguage | null;
    },
    /**
     * Re-reading the whole roadmap costs about a third of this call. The UI
     * calls `router.refresh()` afterwards and re-reads it server-side anyway,
     * so it opts out; callers that genuinely need the new state can ask.
     */
    options: { includeHome?: boolean } = {}
  ): Promise<{ recorded: boolean; home: FrontendRoadmapHome | null }> {
    // Only build the roadmap when it is genuinely missing. Re-running the full
    // ensure on every attempt rewrote 141 template rows per click, which is
    // both the latency here and half the lock footprint that deadlocked.
    const existing = await this.prisma.userRoadmap.findUnique({
      where: { ownerId_role: { ownerId, role: FRONTEND_ROADMAP_ROLE } },
      select: { id: true }
    });

    if (!existing) {
      const ensured = await this.ensureFrontendRoadmap(ownerId);
      // Not a full-stack roadmap user: nothing to record against.
      if (!ensured) return { recorded: false, home: null };
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Two attempts from the same user recalculate the same session,
        // chapter and roadmap rows. Postgres detected that as a deadlock and
        // failed one of them, losing the attempt. This serialises writes per
        // user — held for the transaction and released with it — so the second
        // click queues behind the first instead of racing it. Different users
        // hash to different keys and never wait on each other.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;

        const replay = await tx.userQuestionAttempt.findUnique({
          where: {
            ownerId_idempotencyKey: {
              ownerId,
              idempotencyKey: input.idempotencyKey
            }
          },
          select: { id: true }
        });
        if (replay) return;

        const roadmap = await tx.userRoadmap.findUniqueOrThrow({
          where: {
            ownerId_role: {
              ownerId,
              role: FRONTEND_ROADMAP_ROLE
            }
          },
          select: { id: true }
        });
        let progress = await tx.userQuestionProgress.findFirst({
          where: {
            roadmapId: roadmap.id,
            sourceType: RoadmapQuestionSourceType.DSA,
            dsaQuestionSlug: input.dsaQuestionSlug
          },
          select: dsaAttemptProgressSelect
        });
        progress ??= await enrollDsaQuestion(tx, roadmap.id, input.dsaQuestionSlug);

        const now = new Date();
        const score = normalizedScore(input.score, input.action);
        const nextStatus = questionStatusAfterAction(progress.status, input.action);

        await tx.userQuestionAttempt.create({
          data: {
            ownerId,
            idempotencyKey: input.idempotencyKey,
            questionProgressId: progress.id,
            sourceType: progress.sourceType,
            dsaQuestionSlug: progress.dsaQuestionSlug,
            prepQuestionTemplateId: progress.prepQuestionTemplateId,
            status: attemptStatus(input.action),
            language: input.language ?? null,
            answer: input.answer ?? null,
            score,
            correctness:
              input.action === "complete" ? "complete" : input.action === "skip" ? "skipped" : null,
            durationMs: input.durationMs ?? null,
            feedback: toJson({
              action: input.action,
              source: "frontend-roadmap"
            })
          }
        });

        await tx.userQuestionProgress.update({
          where: { id: progress.id },
          data: {
            status: nextStatus,
            attemptCount: { increment: 1 },
            bestScore:
              score === null
                ? undefined
                : Math.max(progress.bestScore ?? Number.NEGATIVE_INFINITY, score),
            lastAttemptedAt: now,
            completedAt: nextStatus === RoadmapProgressStatus.COMPLETED ? now : null
          }
        });

        await recalculateRoadmap(tx, roadmap.id, ownerId, false, now);
      },
      // Writes are serialised per user by the advisory lock above, so a burst
      // of clicks queues rather than racing. The ceiling is generous enough
      // that a queued write waits instead of being thrown away.
      { maxWait: 20_000, timeout: 120_000 }
    );

    const home =
      options.includeHome === false ? null : await readFrontendRoadmapHome(this.prisma, ownerId);
    return { recorded: true, home };
  }

  async recordPrepQuestionAttempt(
    ownerId: string,
    input: {
      idempotencyKey: string;
      sessionKey: string;
      prepQuestionTemplateId: string;
      action: "submit" | "skip";
      answer: string;
      selectedOptionIndex: number | null;
      durationMs: number | null;
      review: PrepPracticeReview;
    }
  ): Promise<{
    recorded: boolean;
    replayed: boolean;
    status: RoadmapProgressStatus;
    review: PrepPracticeReview;
  }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;

        const replay = await tx.userQuestionAttempt.findUnique({
          where: {
            ownerId_idempotencyKey: { ownerId, idempotencyKey: input.idempotencyKey }
          },
          select: {
            feedback: true,
            questionProgress: { select: { status: true } }
          }
        });
        const replayReview = prepReviewFromFeedback(replay?.feedback);
        if (replay && replayReview) {
          return {
            recorded: true,
            replayed: true,
            status: replay.questionProgress.status,
            review: replayReview
          };
        }

        const progress = await tx.userQuestionProgress.findFirst({
          where: {
            prepQuestionTemplateId: input.prepQuestionTemplateId,
            sourceType: RoadmapQuestionSourceType.PREP,
            roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
            practicePlacements: { some: { practiceSessionKey: input.sessionKey } }
          },
          include: { prepQuestionTemplate: true }
        });
        if (!progress?.prepQuestionTemplate) {
          throw new Error("Practice question is not placed for this candidate");
        }

        const question = progress.prepQuestionTemplate;
        const review = input.review;
        if (review.questionContentVersion !== question.contentVersion) {
          throw new Error("Practice evaluation content version does not match the placed question");
        }
        const verifiedScore = verifiedPrepScore(review);
        const nextStatus = prepStatusAfterAttempt(progress.status, input.action, review);
        const now = new Date();
        const attemptStatusValue =
          input.action === "skip"
            ? RoadmapQuestionAttemptStatus.SKIPPED
            : RoadmapQuestionAttemptStatus.SUBMITTED;

        await tx.userQuestionAttempt.create({
          data: {
            ownerId,
            idempotencyKey: input.idempotencyKey,
            questionProgressId: progress.id,
            sourceType: RoadmapQuestionSourceType.PREP,
            prepQuestionTemplateId: question.id,
            status: attemptStatusValue,
            answer: input.answer || null,
            score: verifiedScore,
            correctness: review.correctness,
            questionContentVersion: review.questionContentVersion,
            evaluatorVersion: review.evaluatorVersion,
            verificationStatus: review.verificationStatus,
            durationMs: input.durationMs,
            feedback: toJson({
              source: "prep-practice",
              action: input.action,
              sessionKey: input.sessionKey,
              hintsUsed: progress.revealedHintCount,
              review
            })
          }
        });
        await tx.userQuestionProgress.update({
          where: { id: progress.id },
          data: {
            status: nextStatus,
            attemptCount: { increment: 1 },
            bestScore:
              verifiedScore === null
                ? undefined
                : Math.max(progress.bestScore ?? Number.NEGATIVE_INFINITY, verifiedScore),
            lastAttemptedAt: now,
            completedAt: nextStatus === RoadmapProgressStatus.COMPLETED ? now : null,
            draftAnswer: input.answer || progress.draftAnswer,
            draftUpdatedAt: input.answer ? now : progress.draftUpdatedAt
          }
        });
        await recalculateRoadmap(tx, progress.roadmapId, ownerId, false, now);
        practiceLogger.log({
          event: "practice.prep_attempt_recorded",
          ownerId,
          questionId: question.id,
          sessionKey: input.sessionKey,
          action: input.action,
          score: verifiedScore,
          verificationStatus: review.verificationStatus,
          attemptMetricDelta: 1,
          unverifiedAttemptDelta: review.verificationStatus === "UNVERIFIED" ? 1 : 0,
          status: nextStatus,
          hintsUsed: progress.revealedHintCount
        });

        return { recorded: true, replayed: false, status: nextStatus, review };
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /**
   * Store lightweight, test-backed evidence from the DSA code runner.
   *
   * This deliberately skips the expensive roadmap-wide recalculation performed
   * by a completion action. A code run changes attempt evidence and the current
   * question's best score; it does not complete chapters or sessions.
   */
  async recordCodeRunEvidence(
    ownerId: string,
    input: {
      idempotencyKey: string;
      dsaQuestionSlug: string;
      language: CodeRunnerLanguage;
      /** Exact candidate editor source, retained with verified run evidence for later code review. */
      sourceCode?: string;
      score: number;
      accepted: boolean;
      testsPassed: number;
      testCount: number;
      /** Bounded details for visible cases only; never carries hidden test inputs or outputs. */
      visibleTestEvidence?: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        error: string | null;
        passed: boolean;
      }>;
    }
  ): Promise<boolean> {
    const roadmap = await this.prisma.userRoadmap.findUnique({
      where: { ownerId_role: { ownerId, role: FRONTEND_ROADMAP_ROLE } },
      select: { id: true }
    });
    if (!roadmap) return false;

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;

        const replay = await tx.userQuestionAttempt.findUnique({
          where: {
            ownerId_idempotencyKey: {
              ownerId,
              idempotencyKey: input.idempotencyKey
            }
          },
          select: { id: true }
        });
        if (replay) return true;

        let progress = await tx.userQuestionProgress.findFirst({
          where: {
            roadmapId: roadmap.id,
            sourceType: RoadmapQuestionSourceType.DSA,
            dsaQuestionSlug: input.dsaQuestionSlug
          },
          select: dsaAttemptProgressSelect
        });
        progress ??= await enrollDsaQuestion(tx, roadmap.id, input.dsaQuestionSlug);
        if (!progress.dsaQuestion) return false;

        const now = new Date();
        const score = Math.max(0, Math.min(1, input.score));
        await tx.userQuestionAttempt.create({
          data: {
            ownerId,
            idempotencyKey: input.idempotencyKey,
            questionProgressId: progress.id,
            sourceType: progress.sourceType,
            dsaQuestionSlug: progress.dsaQuestionSlug,
            prepQuestionTemplateId: progress.prepQuestionTemplateId,
            status: RoadmapQuestionAttemptStatus.SUBMITTED,
            language: input.language,
            answer: input.sourceCode ?? null,
            score,
            correctness: input.accepted ? "accepted" : "not-accepted",
            questionContentVersion: progress.dsaQuestion.contentVersion,
            evaluatorVersion: "dsa-code-run-v1",
            verificationStatus: "VERIFIED",
            feedback: toJson({
              action: "submit",
              source: "code-run",
              testsPassed: input.testsPassed,
              testCount: input.testCount,
              visibleTestEvidence: sanitizeVisibleTestEvidence(input.visibleTestEvidence)
            })
          }
        });

        await tx.userQuestionProgress.update({
          where: { id: progress.id },
          data: {
            status: questionStatusAfterAction(progress.status, "submit"),
            attemptCount: { increment: 1 },
            bestScore: Math.max(progress.bestScore ?? Number.NEGATIVE_INFINITY, score),
            lastAttemptedAt: now
          }
        });

        return true;
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /**
   * Status for every DSA question in this user's roadmap, keyed by slug.
   * One flat query so Practice can mark 123 rows without a lookup each.
   */
  async questionStatuses(ownerId: string): Promise<Record<string, RoadmapProgressStatus>> {
    const rows = await this.prisma.userQuestionProgress.findMany({
      where: {
        roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
        sourceType: RoadmapQuestionSourceType.DSA,
        dsaQuestionSlug: { not: null }
      },
      select: { dsaQuestionSlug: true, status: true }
    });

    const statuses: Record<string, RoadmapProgressStatus> = {};
    for (const row of rows) {
      if (row.dsaQuestionSlug) statuses[row.dsaQuestionSlug] = row.status;
    }
    return statuses;
  }

  /** The active adaptive DSA block stays fixed until every question is solved. */
  async dsaRecommendationBlock(ownerId: string): Promise<string[]> {
    const session = await this.prisma.userSessionProgress.findFirst({
      where: {
        roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
        practiceSessionKey: "dsa"
      },
      select: { metadata: true }
    });

    return dsaBlockSlugs(session?.metadata ?? null);
  }

  /** Saves only the question identities; status continues to live in roadmap progress. */
  async saveDsaRecommendationBlock(ownerId: string, questionSlugs: string[]): Promise<void> {
    const slugs = [...new Set(questionSlugs.filter(Boolean))].slice(0, 12);
    if (!slugs.length) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;
      const session = await tx.userSessionProgress.findFirst({
        where: {
          roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
          practiceSessionKey: "dsa"
        },
        select: { id: true, metadata: true }
      });
      if (!session) return;

      const metadata = jsonRecord(session.metadata);
      await tx.userSessionProgress.update({
        where: { id: session.id },
        data: {
          metadata: toJson({
            ...metadata,
            dsaRecommendationBlock: {
              questionSlugs: slugs,
              createdAt: new Date().toISOString()
            }
          })
        }
      });
    });
  }

  /** Solved DSA questions are the eligibility signal for a DSA interview. */
  async completedDsaQuestions(ownerId: string): Promise<
    Array<{
      slug: string;
      title: string;
      difficulty: string;
      primaryPattern: string;
    }>
  > {
    const rows = await this.prisma.userQuestionProgress.findMany({
      where: {
        roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
        sourceType: RoadmapQuestionSourceType.DSA,
        status: RoadmapProgressStatus.COMPLETED,
        dsaQuestionSlug: { not: null }
      },
      select: {
        dsaQuestion: {
          select: { slug: true, title: true, difficulty: true, primaryPattern: true }
        }
      },
      orderBy: { completedAt: "desc" }
    });

    return rows.flatMap((row) => (row.dsaQuestion ? [row.dsaQuestion] : []));
  }

  /**
   * This user's state for a single question, for the solve page. Returns null
   * when the question is not in their roadmap, so the page can still render
   * read-only rather than 404.
   */
  async questionState(
    ownerId: string,
    dsaQuestionSlug: string
  ): Promise<{ status: RoadmapProgressStatus; attemptCount: number } | null> {
    const progress = await this.prisma.userQuestionProgress.findFirst({
      where: {
        roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
        sourceType: RoadmapQuestionSourceType.DSA,
        dsaQuestionSlug
      },
      select: { status: true, attemptCount: true }
    });

    return progress ?? null;
  }

  /**
   * One chapter with this user's per-question state, for the session page.
   * Read-only: unlike `home`, it never creates a roadmap, so opening a chapter
   * URL directly cannot seed one for a user outside this roadmap track.
   */
  async chapterDetail(
    ownerId: string,
    chapterSlug: string
  ): Promise<FrontendRoadmapChapterDetail | null> {
    const chapter = await this.prisma.userChapterProgress.findFirst({
      where: {
        roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
        chapterTemplate: { slug: chapterSlug }
      },
      include: {
        chapterTemplate: { select: { slug: true, title: true } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            dsaQuestion: {
              select: { slug: true, title: true, difficulty: true, expectedTimeMinutes: true }
            }
          }
        }
      }
    });

    if (!chapter) return null;

    const questions = chapter.questions
      .filter((question) => question.dsaQuestion)
      .map((question) => ({
        slug: question.dsaQuestion?.slug ?? "",
        title: question.dsaQuestion?.title ?? "",
        order: question.order,
        difficulty: question.dsaQuestion?.difficulty ?? "medium",
        minutes: question.dsaQuestion?.expectedTimeMinutes ?? 0,
        status: question.status,
        attemptCount: question.attemptCount,
        completedAt: question.completedAt
      }));

    const nextQuestion = questions.find(
      (question) =>
        question.status !== RoadmapProgressStatus.COMPLETED &&
        question.status !== RoadmapProgressStatus.SKIPPED
    );

    return {
      slug: chapter.chapterTemplate.slug,
      title: chapter.chapterTemplate.title,
      order: chapter.order,
      status: chapter.status,
      totalQuestions: chapter.totalQuestions,
      completedQuestions: chapter.completedQuestions,
      attemptedQuestions: chapter.attemptedQuestions,
      progressPercent: chapter.progressPercent,
      questions,
      nextQuestionSlug: nextQuestion?.slug ?? null
    };
  }

  async home(ownerId: string): Promise<FrontendRoadmapHome | null> {
    const existing = await this.prisma.userRoadmap.findUnique({
      where: {
        ownerId_role: {
          ownerId,
          role: FRONTEND_ROADMAP_ROLE
        }
      },
      select: {
        id: true,
        templateVersion: true,
        _count: { select: { sessionProgress: true } }
      }
    });

    if (!existing) {
      const created = await this.ensureFrontendRoadmap(ownerId);
      if (!created) return null;
    } else if (
      await this.templateOutOfDate(existing._count.sessionProgress, existing.templateVersion)
    ) {
      // Template versions cover question/chapter publication as well as session
      // count. Existing candidates therefore receive a new bank lazily without
      // re-onboarding, while the stable-version happy path remains read-only.
      await this.ensureFrontendRoadmap(ownerId);
    }

    return readFrontendRoadmapHome(this.prisma, ownerId);
  }

  /** One small template read against the active template on the happy path. */
  private async templateOutOfDate(
    sessionCount: number,
    storedVersion: number | null
  ): Promise<boolean> {
    const template = await this.prisma.roadmapTemplate.findFirst({
      where: {
        slug: FRONTEND_ROADMAP_SLUG,
        status: RoadmapTemplateStatus.ACTIVE
      },
      select: { version: true, _count: { select: { sessions: true } } }
    });

    return Boolean(
      template && (template.version !== storedVersion || template._count.sessions !== sessionCount)
    );
  }

  async ensureFrontendRoadmap(ownerId: string): Promise<EnsureFrontendRoadmapResult | null> {
    return this.prisma.$transaction(
      async (tx) => {
        // Concurrent first visits must converge on one provisioned roadmap.
        // This is the same per-owner lock used by attempt writes, so seeding
        // cannot race a completion/recalculation for the same candidate.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;

        const profile = await tx.candidateProfile.findUnique({
          where: { ownerId },
          select: {
            ownerId: true,
            targetRole: true,
            level: true,
            focusAreas: true,
            stories: true,
            resumeAnalysis: true,
            resumeFileName: true,
            resumeConfidence: true
          }
        });

        if (!profile) {
          throw new Error(
            `Cannot create full-stack roadmap without a candidate profile: ${ownerId}`
          );
        }

        const template = await tx.roadmapTemplate.findFirst({
          where: {
            slug: FRONTEND_ROADMAP_SLUG,
            status: RoadmapTemplateStatus.ACTIVE
          },
          include: {
            sessions: {
              orderBy: { order: "asc" },
              include: {
                chapters: { orderBy: { order: "asc" } },
                questions: {
                  orderBy: { order: "asc" },
                  include: {
                    dsaQuestion: {
                      select: {
                        commonMistakes: true,
                        interviewSignals: true,
                        primaryPattern: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (!template) {
          throw new Error("Active roadmap template is missing. Run `pnpm prisma:seed`.");
        }

        const existingRoadmap = await tx.userRoadmap.findUnique({
          where: {
            ownerId_role: {
              ownerId,
              role: FRONTEND_ROADMAP_ROLE
            }
          },
          select: { id: true }
        });
        const created = !existingRoadmap;
        const now = new Date();
        const totalQuestions = template.sessions.reduce(
          (total, session) => total + session.questions.length,
          0
        );
        const personalization = buildPersonalization(profile);

        const roadmap = await tx.userRoadmap.upsert({
          where: {
            ownerId_role: {
              ownerId,
              role: FRONTEND_ROADMAP_ROLE
            }
          },
          create: {
            ownerId,
            templateId: template.id,
            role: FRONTEND_ROADMAP_ROLE,
            status: UserRoadmapStatus.ACTIVE,
            title: template.title,
            templateVersion: template.version,
            totalSessions: template.sessions.length,
            totalQuestions,
            attemptedQuestions: 0,
            completedQuestions: 0,
            completedSessions: 0,
            estimatedMinutesRemaining: estimateRemainingMinutes(template.sessions),
            overallProgressPercent: 0,
            personalization: toJson(personalization),
            stats: toJson({
              createdFromTemplateSlug: template.slug,
              seededSessionCount: template.sessions.length,
              seededQuestionCount: totalQuestions
            }),
            generatedAt: now,
            recalculatedAt: now
          },
          update: {
            templateId: template.id,
            title: template.title,
            templateVersion: template.version,
            totalSessions: template.sessions.length,
            totalQuestions,
            personalization: toJson(personalization)
          }
        });

        await tx.userSessionProgress.createMany({
          data: template.sessions.map((session) => {
            const isFirstSession = session.order === 1;
            return {
              roadmapId: roadmap.id,
              sessionTemplateId: session.id,
              practiceSessionKey: PRACTICE_KEY_BY_TEMPLATE_SLUG[session.slug] ?? session.slug,
              availability:
                session.questions.length > 0
                  ? PracticeSessionAvailability.AVAILABLE
                  : PracticeSessionAvailability.UNAVAILABLE,
              titleSnapshot: session.title,
              purposeSnapshot: session.purpose,
              coversSnapshot: session.covers,
              personalizedAt: now,
              status: isFirstSession ? RoadmapProgressStatus.ACTIVE : RoadmapProgressStatus.LOCKED,
              order: session.order,
              startedAt: isFirstSession ? now : null,
              totalQuestions: session.questions.length,
              metadata: toJson({
                slug: session.slug,
                title: session.title,
                covers: session.covers,
                purpose: session.purpose
              })
            };
          }),
          skipDuplicates: true
        });

        const sessionProgress = await tx.userSessionProgress.findMany({
          where: {
            roadmapId: roadmap.id,
            sessionTemplateId: { in: template.sessions.map((session) => session.id) }
          },
          select: { id: true, sessionTemplateId: true, order: true }
        });
        const sessionProgressByTemplateId = new Map(
          sessionProgress.map((progress) => [progress.sessionTemplateId, progress])
        );

        // The createMany call above already writes these values when a roadmap
        // is first seeded. Repeating one update per session kept the
        // interactive transaction open long enough to expire during onboarding.
        if (!created) {
          for (const session of template.sessions) {
            const progress = sessionProgressByTemplateId.get(session.id);
            if (!progress) continue;

            await tx.userSessionProgress.update({
              where: {
                roadmapId_sessionTemplateId: {
                  roadmapId: roadmap.id,
                  sessionTemplateId: session.id
                }
              },
              data: {
                order: session.order,
                totalQuestions: session.questions.length,
                practiceSessionKey: PRACTICE_KEY_BY_TEMPLATE_SLUG[session.slug] ?? session.slug,
                availability:
                  session.questions.length > 0
                    ? PracticeSessionAvailability.AVAILABLE
                    : PracticeSessionAvailability.UNAVAILABLE,
                metadata: toJson({
                  slug: session.slug,
                  title: session.title,
                  covers: session.covers,
                  purpose: session.purpose
                })
              }
            });
          }
        }

        await tx.userChapterProgress.createMany({
          data: template.sessions.flatMap((session) => {
            const sessionProgress = sessionProgressByTemplateId.get(session.id);
            if (!sessionProgress) return [];

            return session.chapters.map((chapter) => {
              const isFirstChapter = session.order === 1 && chapter.order === 1;
              const totalChapterQuestions = session.questions.filter(
                (question) => question.chapterTemplateId === chapter.id
              ).length;
              return {
                roadmapId: roadmap.id,
                sessionProgressId: sessionProgress.id,
                chapterTemplateId: chapter.id,
                status: isFirstChapter
                  ? RoadmapProgressStatus.ACTIVE
                  : RoadmapProgressStatus.LOCKED,
                order: chapter.order,
                startedAt: isFirstChapter ? now : null,
                totalQuestions: totalChapterQuestions,
                metadata: toJson({
                  slug: chapter.slug,
                  title: chapter.title,
                  purpose: chapter.purpose,
                  templateMetadata: chapter.metadata
                })
              };
            });
          }),
          skipDuplicates: true
        });

        const chapterProgress = await tx.userChapterProgress.findMany({
          where: {
            roadmapId: roadmap.id,
            chapterTemplateId: {
              in: template.sessions.flatMap((session) =>
                session.chapters.map((chapter) => chapter.id)
              )
            }
          },
          select: { id: true, chapterTemplateId: true, order: true }
        });
        const chapterProgressByTemplateId = new Map(
          chapterProgress.map((progress) => [progress.chapterTemplateId, progress])
        );

        // As with sessions, the create rows are complete on first seed. Keep
        // the per-row synchronization only for an existing roadmap, where a
        // template revision may have changed chapter metadata or ordering.
        if (!created) {
          for (const session of template.sessions) {
            const sessionProgress = sessionProgressByTemplateId.get(session.id);
            if (!sessionProgress) continue;

            for (const chapter of session.chapters) {
              const totalChapterQuestions = session.questions.filter(
                (question) => question.chapterTemplateId === chapter.id
              ).length;
              await tx.userChapterProgress.update({
                where: {
                  roadmapId_chapterTemplateId: {
                    roadmapId: roadmap.id,
                    chapterTemplateId: chapter.id
                  }
                },
                data: {
                  sessionProgressId: sessionProgress.id,
                  order: chapter.order,
                  totalQuestions: totalChapterQuestions,
                  metadata: toJson({
                    slug: chapter.slug,
                    title: chapter.title,
                    purpose: chapter.purpose,
                    templateMetadata: chapter.metadata
                  })
                }
              });
            }
          }
        }

        const questionProgressCreateRows: Prisma.UserQuestionProgressCreateManyInput[] = [];
        let globalQuestionOrder = 1;
        for (const session of template.sessions) {
          const sessionProgress = sessionProgressByTemplateId.get(session.id);
          if (!sessionProgress) continue;

          for (const question of session.questions) {
            const chapterProgressId = question.chapterTemplateId
              ? (chapterProgressByTemplateId.get(question.chapterTemplateId)?.id ?? null)
              : null;
            const isFirstQuestion = globalQuestionOrder === 1;

            questionProgressCreateRows.push({
              roadmapId: roadmap.id,
              sessionProgressId: sessionProgress.id,
              chapterProgressId,
              roadmapQuestionTemplateId: question.id,
              sourceType: question.sourceType,
              dsaQuestionSlug: question.dsaQuestionSlug,
              prepQuestionTemplateId: question.prepQuestionTemplateId,
              status: isFirstQuestion ? RoadmapProgressStatus.ACTIVE : RoadmapProgressStatus.LOCKED,
              order: globalQuestionOrder,
              metadata: toJson({
                title: question.titleSnapshot,
                difficulty: question.difficulty,
                expectedMinutes: question.expectedMinutes,
                templateMetadata: question.metadata,
                primaryPattern: question.dsaQuestion?.primaryPattern ?? null
              })
            });

            globalQuestionOrder += 1;
          }
        }

        if (questionProgressCreateRows.length > 0) {
          await tx.userQuestionProgress.createMany({
            data: questionProgressCreateRows,
            skipDuplicates: true
          });
        }

        return recalculateRoadmap(tx, roadmap.id, ownerId, created, now);
      },
      // Concurrent first loads intentionally queue on the per-owner advisory
      // lock. The timeout must include that queue, not only this transaction's
      // own work.
      { maxWait: 20_000, timeout: 120_000 }
    );
  }
}

function sanitizeVisibleTestEvidence(
  evidence:
    | Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        error: string | null;
        passed: boolean;
      }>
    | undefined
): Array<{
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error: string | null;
  passed: boolean;
}> {
  return (evidence ?? []).slice(0, 3).map((test) => ({
    input: boundedEvidenceText(test.input),
    expectedOutput: boundedEvidenceText(test.expectedOutput),
    actualOutput: boundedEvidenceText(test.actualOutput),
    error: test.error ? boundedEvidenceText(test.error) : null,
    passed: Boolean(test.passed)
  }));
}

function boundedEvidenceText(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join("")
    .slice(0, 500);
}

/**
 * Explore-all questions are enrolled only when a candidate opens or runs one.
 * This keeps the canonical 200-question bank available without turning every
 * account into a mandatory 200-row assignment up front.
 */
async function enrollDsaQuestion(
  tx: RoadmapTransaction,
  roadmapId: string,
  slug: string
): Promise<DsaAttemptProgress> {
  const existing = await tx.userQuestionProgress.findFirst({
    where: {
      roadmapId,
      sourceType: RoadmapQuestionSourceType.DSA,
      dsaQuestionSlug: slug
    },
    select: dsaAttemptProgressSelect
  });
  if (existing) return existing;

  const [question, dsaSession, order] = await Promise.all([
    tx.dsaQuestion.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        difficulty: true,
        expectedTimeMinutes: true,
        primaryPattern: true
      }
    }),
    tx.userSessionProgress.findFirst({
      where: { roadmapId, practiceSessionKey: "dsa" },
      select: { id: true }
    }),
    tx.userQuestionProgress.aggregate({ where: { roadmapId }, _max: { order: true } })
  ]);
  if (!question) throw new Error(`Unknown DSA question: ${slug}`);
  if (!dsaSession) throw new Error(`DSA Practice session is missing for roadmap: ${roadmapId}`);

  const chapterId = dsaChapterIdForPattern(question.primaryPattern);
  const chapter = chapterId
    ? await tx.userChapterProgress.findFirst({
        where: {
          roadmapId,
          sessionProgressId: dsaSession.id,
          chapterTemplate: { slug: chapterId }
        },
        select: { id: true }
      })
    : null;

  return tx.userQuestionProgress.create({
    data: {
      roadmapId,
      sessionProgressId: dsaSession.id,
      chapterProgressId: chapter?.id ?? null,
      roadmapQuestionTemplateId: null,
      sourceType: RoadmapQuestionSourceType.DSA,
      dsaQuestionSlug: question.slug,
      prepQuestionTemplateId: null,
      status: RoadmapProgressStatus.ACTIVE,
      order: (order._max.order ?? 0) + 1,
      metadata: toJson({
        title: question.title,
        difficulty: question.difficulty,
        expectedMinutes: question.expectedTimeMinutes,
        primaryPattern: question.primaryPattern,
        selectionReason: "explore-all-on-demand"
      })
    },
    select: dsaAttemptProgressSelect
  });
}

async function readFrontendRoadmapHome(
  prisma: PrismaService,
  ownerId: string
): Promise<FrontendRoadmapHome | null> {
  const roadmap = await prisma.userRoadmap.findUnique({
    where: {
      ownerId_role: {
        ownerId,
        role: FRONTEND_ROADMAP_ROLE
      }
    },
    include: {
      sessionProgress: {
        include: { sessionTemplate: true },
        orderBy: { order: "asc" }
      },
      chapterProgress: {
        include: { chapterTemplate: true },
        orderBy: { order: "asc" }
      },
      questionProgress: {
        include: {
          roadmapQuestionTemplate: true,
          sessionProgress: { select: { practiceSessionKey: true } },
          dsaQuestion: {
            select: {
              slug: true,
              title: true,
              difficulty: true,
              expectedTimeMinutes: true,
              primaryPattern: true
            }
          }
        },
        orderBy: { order: "asc" }
      },
      insights: {
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!roadmap) return null;

  const questionsByChapterTemplateId = groupQuestionsBy(
    roadmap.questionProgress,
    (question) => question.chapterProgressId
  );
  // A null key means there is no next question — the roadmap is finished, or
  // everything left is skipped. Without this guard the comparisons below match
  // the first row whose own id is also null (every DSA row has a null
  // prepQuestionTemplateId), which sent finished users back to question one.
  const nextQuestion = roadmap.nextQuestionKey
    ? roadmap.questionProgress.find(
        (question) =>
          question.dsaQuestionSlug === roadmap.nextQuestionKey ||
          question.prepQuestionTemplateId === roadmap.nextQuestionKey ||
          question.roadmapQuestionTemplateId === roadmap.nextQuestionKey
      )
    : undefined;

  const sessions: FrontendRoadmapSession[] = roadmap.sessionProgress.map((progress) => ({
    id: progress.sessionTemplate.slug,
    order: progress.order,
    title: progress.sessionTemplate.title,
    purpose: progress.sessionTemplate.purpose,
    covers: progress.sessionTemplate.covers,
    status: progress.status,
    totalQuestions: progress.totalQuestions,
    completedQuestions: progress.completedQuestions,
    progressPercent: progress.progressPercent,
    href: sessionHref(progress.sessionTemplate.slug, progress.sessionTemplate.title)
  }));

  const chapters: FrontendRoadmapChapter[] = roadmap.chapterProgress.map((progress) => {
    const questions = questionsByChapterTemplateId.get(progress.id) ?? [];
    return {
      id: progress.chapterTemplate.slug,
      order: progress.order,
      title: progress.chapterTemplate.title,
      whyItMatters: progress.chapterTemplate.purpose ?? "",
      questions: progress.totalQuestions,
      completedQuestions: progress.completedQuestions,
      minutes: questions.reduce(
        (total, question) =>
          total +
          (question.roadmapQuestionTemplate?.expectedMinutes ??
            question.dsaQuestion?.expectedTimeMinutes ??
            0),
        0
      ),
      counts: difficultyCounts(
        questions.map((question) => ({
          roadmapQuestionTemplate: {
            difficulty:
              question.roadmapQuestionTemplate?.difficulty ??
              question.dsaQuestion?.difficulty ??
              null
          }
        }))
      ),
      status: progress.status,
      progressPercent: progress.progressPercent,
      firstQuestionSlug: questions[0]?.dsaQuestionSlug ?? null
    };
  });

  const totalMinutes = roadmap.questionProgress.reduce(
    (total, question) =>
      total +
      (question.roadmapQuestionTemplate?.expectedMinutes ??
        question.dsaQuestion?.expectedTimeMinutes ??
        0),
    0
  );
  const questionMix = difficultyCounts(
    roadmap.questionProgress.map((question) => ({
      roadmapQuestionTemplate: {
        difficulty:
          question.roadmapQuestionTemplate?.difficulty ?? question.dsaQuestion?.difficulty ?? null
      }
    }))
  );
  const totalChapters = roadmap.chapterProgress.length;

  return {
    roadmapId: roadmap.id,
    title: roadmap.title,
    role: FRONTEND_ROADMAP_ROLE,
    currentSessionTemplateSlug: roadmap.currentSessionTemplateSlug,
    currentChapterTemplateSlug: roadmap.currentChapterTemplateSlug,
    nextQuestionKey: roadmap.nextQuestionKey,
    nextQuestionHref: nextQuestionHref(nextQuestion) ?? "/practice",
    totalSessions: roadmap.totalSessions,
    completedSessions: roadmap.completedSessions,
    totalChapters,
    totalQuestions: roadmap.totalQuestions,
    attemptedQuestions: roadmap.attemptedQuestions,
    completedQuestions: roadmap.completedQuestions,
    estimatedMinutesRemaining: roadmap.estimatedMinutesRemaining ?? 0,
    totalMinutes,
    overallProgressPercent: roadmap.overallProgressPercent,
    questionMix,
    sessions,
    chapters,
    insights: roadmap.insights.map((insight) => ({
      id: insight.id,
      kind: insight.kind,
      title: insight.title,
      body: insight.body,
      evidenceLabel: insight.evidenceLabel,
      ctaLabel: insight.ctaLabel,
      ctaHref: insight.ctaHref,
      priority: insight.priority
    }))
  };
}

function groupQuestionsBy<Row>(rows: Row[], key: (row: Row) => string | null): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();

  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const next = groups.get(id) ?? [];
    next.push(row);
    groups.set(id, next);
  }

  return groups;
}

function sessionHref(slug: string, title: string): string {
  if (slug === "dsa") return "/practice/dsa";

  const params = new URLSearchParams({ focus: title });
  return `/interview?${params.toString()}`;
}

interface ProgressRowUpdate {
  id: string;
  status: RoadmapProgressStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  totalQuestions: number;
  attemptedQuestions: number;
  completedQuestions: number;
  progressPercent: number;
}

/**
 * Writes a whole set of progress rows in one statement.
 *
 * `UserSessionProgress` and `UserChapterProgress` carry the same progress
 * columns, so one helper covers both. The table name is not interpolated from
 * user input — it is one of two literals chosen at the call site — and every
 * value goes through a parameter placeholder.
 */
async function bulkUpdateProgressRows(
  tx: RoadmapTransaction,
  table: "UserSessionProgress" | "UserChapterProgress",
  rows: ProgressRowUpdate[]
): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const base = values.length;
    values.push(
      row.id,
      row.status,
      row.startedAt,
      row.completedAt,
      row.totalQuestions,
      row.attemptedQuestions,
      row.completedQuestions,
      row.progressPercent
    );
    return `($${base + 1}::uuid, $${base + 2}::"RoadmapProgressStatus", $${base + 3}::timestamptz, $${base + 4}::timestamptz, $${base + 5}::int, $${base + 6}::int, $${base + 7}::int, $${base + 8}::double precision)`;
  });

  const sql = `
    UPDATE "${table}" AS target SET
      status = source.status,
      "startedAt" = source."startedAt",
      "completedAt" = source."completedAt",
      "totalQuestions" = source."totalQuestions",
      "attemptedQuestions" = source."attemptedQuestions",
      "completedQuestions" = source."completedQuestions",
      "progressPercent" = source."progressPercent",
      "updatedAt" = NOW()
    FROM (VALUES ${tuples.join(", ")}) AS source(
      id, status, "startedAt", "completedAt",
      "totalQuestions", "attemptedQuestions", "completedQuestions", "progressPercent"
    )
    WHERE target.id = source.id
  `;

  await tx.$executeRawUnsafe(sql, ...values);
}

async function recalculateRoadmap(
  tx: RoadmapTransaction,
  roadmapId: string,
  ownerId: string,
  created: boolean,
  now: Date
): Promise<EnsureFrontendRoadmapResult> {
  const [roadmap, sessionProgress, chapterProgress, questionProgress, practicePlacements] =
    await Promise.all([
      tx.userRoadmap.findUniqueOrThrow({
        where: { id: roadmapId },
        select: { id: true, totalSessions: true }
      }),
      tx.userSessionProgress.findMany({
        where: { roadmapId },
        include: { sessionTemplate: { select: { slug: true, order: true } } },
        orderBy: { order: "asc" }
      }),
      tx.userChapterProgress.findMany({
        where: { roadmapId },
        include: { chapterTemplate: { select: { slug: true, order: true } } },
        orderBy: { order: "asc" }
      }),
      tx.userQuestionProgress.findMany({
        where: { roadmapId },
        include: {
          sessionProgress: { include: { sessionTemplate: { select: { slug: true } } } },
          chapterProgress: {
            include: { chapterTemplate: { select: { slug: true, title: true } } }
          },
          dsaQuestion: {
            select: {
              title: true,
              commonMistakes: true,
              interviewSignals: true,
              primaryPattern: true,
              difficulty: true,
              expectedTimeMinutes: true
            }
          },
          roadmapQuestionTemplate: {
            select: {
              titleSnapshot: true,
              expectedMinutes: true,
              difficulty: true,
              metadata: true
            }
          }
        },
        orderBy: { order: "asc" }
      }),
      tx.practiceQuestionPlacement.findMany({
        where: { roadmapId },
        select: {
          sessionProgressId: true,
          questionProgress: { select: { status: true, attemptCount: true } }
        }
      })
    ]);

  const nextQuestion = questionProgress.find(
    (question) =>
      question.status !== RoadmapProgressStatus.COMPLETED &&
      question.status !== RoadmapProgressStatus.SKIPPED
  );

  if (nextQuestion?.status === RoadmapProgressStatus.LOCKED) {
    await tx.userQuestionProgress.update({
      where: { id: nextQuestion.id },
      data: { status: RoadmapProgressStatus.ACTIVE }
    });
    nextQuestion.status = RoadmapProgressStatus.ACTIVE;
  }

  const totalsBySessionProgressId = countQuestionsBy(questionProgress, "sessionProgressId");
  const totalsByChapterProgressId = countQuestionsBy(questionProgress, "chapterProgressId");
  // Candidate-facing PREP sessions are subsets of the canonical bank, while
  // Final Mock reuses canonical progress owned by earlier sessions. Whenever a
  // session has placements, its counters must follow those shared records.
  const placementTotalsBySessionProgressId = new Map<string, QuestionCounts>();
  for (const placement of practicePlacements) {
    const totals =
      placementTotalsBySessionProgressId.get(placement.sessionProgressId) ?? emptyCounts();
    totals.total += 1;
    if (
      placement.questionProgress.attemptCount > 0 ||
      placement.questionProgress.status === RoadmapProgressStatus.IN_PROGRESS ||
      placement.questionProgress.status === RoadmapProgressStatus.COMPLETED
    ) {
      totals.attempted += 1;
    }
    if (placement.questionProgress.status === RoadmapProgressStatus.COMPLETED) {
      totals.completed += 1;
    }
    placementTotalsBySessionProgressId.set(placement.sessionProgressId, totals);
  }
  for (const [sessionProgressId, totals] of placementTotalsBySessionProgressId) {
    totalsBySessionProgressId.set(sessionProgressId, totals);
  }

  // Every session and chapter row is rewritten on each attempt. Doing that one
  // update at a time cost 18 sequential round trips to a remote database —
  // most of the ~4.5s a "mark complete" click used to take. The rows are now
  // computed in memory and written with one statement each; the values are
  // identical, only the number of trips changed.
  let completedSessions = 0;
  const sessionRows: ProgressRowUpdate[] = sessionProgress.map((session) => {
    const totals = totalsBySessionProgressId.get(session.id) ?? emptyCounts();
    const isCurrent = session.id === nextQuestion?.sessionProgressId;
    const nextStatus = progressStatusFromCounts(totals, isCurrent);
    if (nextStatus === RoadmapProgressStatus.COMPLETED) completedSessions += 1;

    return {
      id: session.id,
      status: nextStatus,
      // `undefined` in Prisma meant "leave it alone"; a bulk statement has to
      // say so explicitly, so keep the existing value instead.
      startedAt:
        nextStatus !== RoadmapProgressStatus.LOCKED && !session.startedAt ? now : session.startedAt,
      completedAt:
        nextStatus === RoadmapProgressStatus.COMPLETED ? (session.completedAt ?? now) : null,
      totalQuestions: totals.total,
      attemptedQuestions: totals.attempted,
      completedQuestions: totals.completed,
      progressPercent: percent(totals.completed, totals.total)
    };
  });

  const chapterRows: ProgressRowUpdate[] = chapterProgress.map((chapter) => {
    const totals = totalsByChapterProgressId.get(chapter.id) ?? emptyCounts();
    const isCurrent = chapter.id === nextQuestion?.chapterProgressId;
    const nextStatus = progressStatusFromCounts(totals, isCurrent);

    return {
      id: chapter.id,
      status: nextStatus,
      startedAt:
        nextStatus !== RoadmapProgressStatus.LOCKED && !chapter.startedAt ? now : chapter.startedAt,
      completedAt:
        nextStatus === RoadmapProgressStatus.COMPLETED ? (chapter.completedAt ?? now) : null,
      totalQuestions: totals.total,
      attemptedQuestions: totals.attempted,
      completedQuestions: totals.completed,
      progressPercent: percent(totals.completed, totals.total)
    };
  });

  // Session status is derived from owning the next unanswered question. Only
  // DSA has seeded questions, so once it is finished nothing owns a
  // next question and every remaining session stayed LOCKED forever — the
  // roadmap dead-ended instead of moving to JavaScript and React Core.
  //
  // When no session is live, open the earliest unfinished session that has a
  // question bank. Empty Part 2 slots remain explicitly unavailable instead
  // of appearing active before their content has been generated.
  const hasLiveSession = sessionRows.some(
    (row) =>
      row.status === RoadmapProgressStatus.ACTIVE ||
      row.status === RoadmapProgressStatus.IN_PROGRESS
  );

  let promotedSessionSlug: string | null = null;
  if (!hasLiveSession) {
    const ordered = [...sessionProgress].sort((a, b) => a.order - b.order);
    for (const session of ordered) {
      const row = sessionRows.find((candidate) => candidate.id === session.id);
      if (!row || row.status === RoadmapProgressStatus.COMPLETED || row.totalQuestions === 0) {
        continue;
      }

      row.status = RoadmapProgressStatus.ACTIVE;
      row.startedAt = row.startedAt ?? now;
      promotedSessionSlug = session.sessionTemplate.slug;
      break;
    }
  }

  await bulkUpdateProgressRows(tx, "UserSessionProgress", sessionRows);
  await bulkUpdateProgressRows(tx, "UserChapterProgress", chapterRows);

  const attemptedQuestions = questionProgress.filter(
    (question) =>
      question.attemptCount > 0 ||
      question.status === RoadmapProgressStatus.IN_PROGRESS ||
      question.status === RoadmapProgressStatus.COMPLETED
  ).length;
  const completedQuestions = questionProgress.filter(
    (question) => question.status === RoadmapProgressStatus.COMPLETED
  ).length;
  const totalQuestions = questionProgress.length;
  const estimatedMinutesRemaining = questionProgress
    .filter((question) => question.status !== RoadmapProgressStatus.COMPLETED)
    .reduce(
      (total, question) =>
        total +
        (question.roadmapQuestionTemplate?.expectedMinutes ??
          question.dsaQuestion?.expectedTimeMinutes ??
          0),
      0
    );

  const currentSessionTemplateSlug =
    nextQuestion?.sessionProgress.sessionTemplate.slug ?? promotedSessionSlug;
  const currentChapterTemplateSlug = nextQuestion?.chapterProgress?.chapterTemplate.slug ?? null;
  const nextQuestionKey =
    nextQuestion?.dsaQuestionSlug ??
    nextQuestion?.prepQuestionTemplateId ??
    nextQuestion?.roadmapQuestionTemplateId ??
    null;
  const overallProgressPercent = percent(completedQuestions, totalQuestions);

  await tx.userRoadmap.update({
    where: { id: roadmap.id },
    data: {
      status:
        totalQuestions > 0 && completedQuestions === totalQuestions
          ? UserRoadmapStatus.COMPLETED
          : UserRoadmapStatus.ACTIVE,
      currentSessionTemplateSlug,
      currentChapterTemplateSlug,
      nextQuestionKey,
      totalSessions: roadmap.totalSessions,
      completedSessions,
      totalQuestions,
      attemptedQuestions,
      completedQuestions,
      estimatedMinutesRemaining,
      overallProgressPercent,
      stats: toJson({
        easyMediumHard: difficultyCounts(questionProgress),
        currentQuestionTitle:
          nextQuestion?.dsaQuestion?.title ??
          nextQuestion?.roadmapQuestionTemplate?.titleSnapshot ??
          null
      }),
      recalculatedAt: now
    }
  });

  await replaceActiveMayaInsights(tx, {
    roadmapId: roadmap.id,
    ownerId,
    nextQuestion,
    completedQuestions,
    totalQuestions,
    estimatedMinutesRemaining
  });

  return {
    roadmapId: roadmap.id,
    created,
    totalSessions: roadmap.totalSessions,
    totalQuestions,
    completedQuestions,
    attemptedQuestions,
    currentSessionTemplateSlug,
    currentChapterTemplateSlug,
    nextQuestionKey,
    overallProgressPercent
  };
}

function progressStatusFromCounts(
  counts: QuestionCounts,
  isCurrent: boolean
): RoadmapProgressStatus {
  if (counts.total === 0) return RoadmapProgressStatus.LOCKED;
  if (counts.completed === counts.total) return RoadmapProgressStatus.COMPLETED;
  if (isCurrent) {
    return counts.attempted > 0 ? RoadmapProgressStatus.IN_PROGRESS : RoadmapProgressStatus.ACTIVE;
  }
  return counts.attempted > 0 || counts.completed > 0
    ? RoadmapProgressStatus.IN_PROGRESS
    : RoadmapProgressStatus.LOCKED;
}

interface QuestionCounts {
  total: number;
  attempted: number;
  completed: number;
}

function emptyCounts(): QuestionCounts {
  return { total: 0, attempted: 0, completed: 0 };
}

function countQuestionsBy<
  T extends "sessionProgressId" | "chapterProgressId",
  Row extends {
    [K in T]: string | null;
  } & { status: RoadmapProgressStatus; attemptCount: number }
>(rows: Row[], key: T): Map<string, QuestionCounts> {
  const counts = new Map<string, QuestionCounts>();

  for (const row of rows) {
    const groupId = row[key];
    if (!groupId) continue;

    const next = counts.get(groupId) ?? emptyCounts();
    next.total += 1;
    if (
      row.attemptCount > 0 ||
      row.status === RoadmapProgressStatus.IN_PROGRESS ||
      row.status === RoadmapProgressStatus.COMPLETED
    ) {
      next.attempted += 1;
    }
    if (row.status === RoadmapProgressStatus.COMPLETED) {
      next.completed += 1;
    }
    counts.set(groupId, next);
  }

  return counts;
}

function difficultyCounts(
  questions: Array<{
    roadmapQuestionTemplate: { difficulty: string | null } | null;
    dsaQuestion?: { difficulty: string | null } | null;
  }>
) {
  return questions.reduce(
    (counts, question) => {
      const difficulty =
        question.roadmapQuestionTemplate?.difficulty ?? question.dsaQuestion?.difficulty;
      if (difficulty === "easy") counts.easy += 1;
      else if (difficulty === "hard") counts.hard += 1;
      else counts.medium += 1;
      return counts;
    },
    { easy: 0, medium: 0, hard: 0 }
  );
}

async function replaceActiveMayaInsights(
  tx: RoadmapTransaction,
  input: {
    roadmapId: string;
    ownerId: string;
    nextQuestion:
      | Prisma.UserQuestionProgressGetPayload<{
          include: {
            sessionProgress: { include: { sessionTemplate: { select: { slug: true } } } };
            chapterProgress: {
              include: { chapterTemplate: { select: { slug: true; title: true } } };
            };
            dsaQuestion: {
              select: {
                title: true;
                commonMistakes: true;
                interviewSignals: true;
                primaryPattern: true;
                difficulty: true;
                expectedTimeMinutes: true;
              };
            };
            roadmapQuestionTemplate: {
              select: {
                titleSnapshot: true;
                expectedMinutes: true;
                difficulty: true;
                metadata: true;
              };
            };
          };
        }>
      | undefined;
    completedQuestions: number;
    totalQuestions: number;
    estimatedMinutesRemaining: number;
  }
): Promise<void> {
  await tx.userMayaInsight.updateMany({
    where: { roadmapId: input.roadmapId, isActive: true },
    data: { isActive: false }
  });

  const recentAttempts = await tx.userQuestionAttempt.findMany({
    where: {
      ownerId: input.ownerId,
      questionProgress: { roadmapId: input.roadmapId }
    },
    include: {
      questionProgress: {
        include: {
          dsaQuestion: {
            select: {
              title: true,
              commonMistakes: true,
              interviewSignals: true,
              primaryPattern: true
            }
          },
          roadmapQuestionTemplate: {
            select: {
              titleSnapshot: true,
              difficulty: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 80
  });
  const attemptAnalysis = analyzeAttemptHistory(recentAttempts);
  const questionTitle =
    input.nextQuestion?.dsaQuestion?.title ??
    input.nextQuestion?.roadmapQuestionTemplate?.titleSnapshot ??
    "your next question";
  const chapterTitle = input.nextQuestion?.chapterProgress?.chapterTemplate.title ?? "DSA";
  const commonTrap =
    input.nextQuestion?.dsaQuestion?.commonMistakes[0] ??
    "Jumping into code before naming the pattern and edge cases.";
  const strongSignal =
    input.nextQuestion?.dsaQuestion?.interviewSignals[0] ??
    "Explains the tradeoff first, then codes the simplest correct version.";
  const progress = percent(input.completedQuestions, input.totalQuestions);
  const weakPattern = attemptAnalysis.weakestPattern;
  const weakPatternLabel = weakPattern ? displayPattern(weakPattern.pattern) : null;
  const recentWin = attemptAnalysis.lastCompletedTitle;
  const nextHref = nextQuestionHref(input.nextQuestion);
  // With nothing queued, the old copy still read "DSA: your next
  // question" — Maya promising a question that does not exist.
  const finished = input.totalQuestions > 0 && input.completedQuestions >= input.totalQuestions;
  const nothingQueued = !input.nextQuestion;

  await tx.userMayaInsight.createMany({
    data: [
      {
        roadmapId: input.roadmapId,
        ownerId: input.ownerId,
        kind: MayaInsightKind.NEXT_PRIORITY,
        title: "Next priority",
        body: weakPattern
          ? `Repair ${weakPatternLabel} before adding speed. I found ${weakPattern.weakAttempts} weak or skipped attempt${weakPattern.weakAttempts === 1 ? "" : "s"} there.`
          : finished
            ? `You have finished all ${input.totalQuestions} questions in this session. Revisit anything that felt shaky, then move on.`
            : nothingQueued
              ? "Everything left here is skipped. Reopen one of them to keep the path moving."
              : `${chapterTitle}: ${questionTitle}`,
        evidenceLabel: weakPatternLabel ?? input.nextQuestion?.dsaQuestion?.primaryPattern ?? "dsa",
        ctaLabel: nothingQueued ? "Review your session" : "Start practice",
        ctaHref: nextHref ?? "/practice",
        priority: 10,
        source: toJson({
          progress,
          completedQuestions: input.completedQuestions,
          weakPattern
        })
      },
      {
        roadmapId: input.roadmapId,
        ownerId: input.ownerId,
        kind: MayaInsightKind.COMMON_TRAP,
        title: "Common trap",
        body: weakPattern
          ? `${weakPatternLabel} is where the misses are clustering. Slow down on state shape, edge cases, and the reason the pattern fits before coding.`
          : commonTrap,
        evidenceLabel:
          weakPattern?.lastQuestionTitle ??
          input.nextQuestion?.roadmapQuestionTemplate?.difficulty ??
          null,
        priority: 20,
        source: toJson({ nextQuestionKey: nextQuestionKey(input.nextQuestion), weakPattern })
      },
      {
        roadmapId: input.roadmapId,
        ownerId: input.ownerId,
        kind: MayaInsightKind.STRONG_SIGNAL,
        title: "Strong answer signal",
        body: recentWin
          ? `You finished ${recentWin}. Keep that same explanation-first rhythm on ${questionTitle}.`
          : strongSignal,
        evidenceLabel:
          attemptAnalysis.lastCompletedPattern ??
          input.nextQuestion?.dsaQuestion?.primaryPattern ??
          null,
        priority: 30,
        source: toJson({
          nextQuestionKey: nextQuestionKey(input.nextQuestion),
          lastCompletedQuestion: recentWin
        })
      },
      {
        roadmapId: input.roadmapId,
        ownerId: input.ownerId,
        kind: MayaInsightKind.STREAK,
        title: "Streak",
        body: streakInsightBody(attemptAnalysis.completionStreakDays, input.completedQuestions),
        evidenceLabel: `${Math.round(input.estimatedMinutesRemaining / 60)}h remaining`,
        priority: 40,
        source: toJson({
          estimatedMinutesRemaining: input.estimatedMinutesRemaining,
          completionStreakDays: attemptAnalysis.completionStreakDays,
          activeAttemptDays: attemptAnalysis.activeAttemptDays
        })
      },
      {
        roadmapId: input.roadmapId,
        ownerId: input.ownerId,
        kind: MayaInsightKind.RECOMMENDED_ACTION,
        title: "Recommended action",
        body:
          input.nextQuestion === undefined
            ? "Review your completed full-stack roadmap and run the final mock."
            : weakPattern
              ? `Open ${questionTitle}, write the brute-force idea first, then state the pattern upgrade clearly.`
              : `Open ${questionTitle} and explain the pattern before writing code.`,
        ctaLabel: input.nextQuestion === undefined ? "Review roadmap" : "Open question",
        ctaHref: nextHref,
        priority: 50,
        source: toJson({ progress, weakPattern })
      }
    ]
  });
}

function nextQuestionHref(
  question:
    | {
        dsaQuestionSlug: string | null;
        prepQuestionTemplateId: string | null;
        roadmapQuestionTemplateId: string | null;
        sessionProgress?: { practiceSessionKey: string };
      }
    | undefined
): string | null {
  // No question left. Returning "/" here made the declared `?? "/practice"`
  // fallbacks unreachable, because "/" is truthy — so callers silently sent a
  // finished user to Home instead of back to their session.
  if (!question) return null;
  if (question.dsaQuestionSlug) return `/dsa-questions/${question.dsaQuestionSlug}`;
  if (question.prepQuestionTemplateId) {
    const sessionKey = question.sessionProgress?.practiceSessionKey;
    return sessionKey ? `/practice/${sessionKey}/${question.prepQuestionTemplateId}` : "/practice";
  }
  return question.roadmapQuestionTemplateId
    ? `/practice?roadmapQuestion=${question.roadmapQuestionTemplateId}`
    : "/";
}

function nextQuestionKey(
  question:
    | {
        dsaQuestionSlug: string | null;
        prepQuestionTemplateId: string | null;
        roadmapQuestionTemplateId: string | null;
      }
    | undefined
): string | null {
  if (!question) return null;
  return (
    question.dsaQuestionSlug ??
    question.prepQuestionTemplateId ??
    question.roadmapQuestionTemplateId
  );
}

function estimateRemainingMinutes(
  sessions: Array<{ questions: Array<{ expectedMinutes: number | null }> }>
): number {
  return sessions.reduce(
    (total, session) =>
      total +
      session.questions.reduce(
        (sessionTotal, question) => sessionTotal + (question.expectedMinutes ?? 0),
        0
      ),
    0
  );
}

function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 1000) / 10;
}

function prepReviewFromFeedback(
  value: Prisma.JsonValue | null | undefined
): PrepPracticeReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const review = (value as Prisma.JsonObject).review;
  if (!review || typeof review !== "object" || Array.isArray(review)) return null;
  return review as unknown as PrepPracticeReview;
}

export function verifiedPrepScore(review: PrepPracticeReview): number | null {
  return review.verificationStatus === "VERIFIED" ? review.score : null;
}

export function prepStatusAfterAttempt(
  current: RoadmapProgressStatus,
  action: "submit" | "skip",
  review: PrepPracticeReview
): RoadmapProgressStatus {
  if (current === RoadmapProgressStatus.COMPLETED) return RoadmapProgressStatus.COMPLETED;
  if (action === "skip") return RoadmapProgressStatus.SKIPPED;
  const score = verifiedPrepScore(review);
  return score !== null && score >= 0.72
    ? RoadmapProgressStatus.COMPLETED
    : RoadmapProgressStatus.IN_PROGRESS;
}

function dsaBlockSlugs(metadata: Prisma.JsonValue | null): string[] {
  const block = jsonRecord(metadata).dsaRecommendationBlock;
  if (!block || typeof block !== "object" || Array.isArray(block)) return [];
  const slugs = (block as Prisma.JsonObject).questionSlugs;
  if (!Array.isArray(slugs)) return [];
  return slugs.filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

function jsonRecord(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
