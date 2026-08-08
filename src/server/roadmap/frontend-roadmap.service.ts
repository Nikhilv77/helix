import {
  MayaInsightKind,
  Prisma,
  RoadmapProgressStatus,
  RoadmapQuestionAttemptStatus,
  RoadmapQuestionSourceType,
  RoadmapTemplateStatus,
  UserRoadmapStatus
} from "@prisma/client";
import type {
  FrontendRoadmapChapter,
  FrontendRoadmapChapterDetail,
  FrontendRoadmapHome,
  FrontendRoadmapSession
} from "@/lib/roadmap";
import type { PrismaService } from "../database/prisma.service";

const FRONTEND_ROADMAP_ROLE = "frontend";
const FRONTEND_ROADMAP_SLUG = "frontend-roadmap";

type RoadmapTransaction = Prisma.TransactionClient;
export type RoadmapQuestionAttemptAction = "open" | "submit" | "complete" | "skip";

export interface EnsureFrontendRoadmapResult {
  roadmapId: string;
  created: boolean;
  totalSessions: number;
  totalQuestions: number;
  completedQuestions: number;
  attemptedQuestions: number;
  currentSessionTemplateSlug: string | null;
  currentChapterTemplateSlug: string | null;
  nextQuestionKey: string | null;
  overallProgressPercent: number;
}

export class FrontendRoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  async recordQuestionAttempt(
    ownerId: string,
    input: {
      action: RoadmapQuestionAttemptAction;
      dsaQuestionSlug: string;
      answer?: string | null;
      score?: number | null;
      durationMs?: number | null;
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
      // Not a frontend user: nothing to record against.
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

        const roadmap = await tx.userRoadmap.findUniqueOrThrow({
          where: {
            ownerId_role: {
              ownerId,
              role: FRONTEND_ROADMAP_ROLE
            }
          },
          select: { id: true }
        });
        const progress = await tx.userQuestionProgress.findFirst({
          where: {
            roadmapId: roadmap.id,
            sourceType: RoadmapQuestionSourceType.DSA,
            dsaQuestionSlug: input.dsaQuestionSlug
          },
          select: {
            id: true,
            sourceType: true,
            dsaQuestionSlug: true,
            prepQuestionTemplateId: true,
            status: true,
            bestScore: true
          }
        });

        if (!progress) {
          throw new Error(`Question is not in the frontend roadmap: ${input.dsaQuestionSlug}`);
        }

        const now = new Date();
        const score = normalizedScore(input.score, input.action);
        const nextStatus = questionStatusAfterAction(progress.status, input.action);

        await tx.userQuestionAttempt.create({
          data: {
            ownerId,
            questionProgressId: progress.id,
            sourceType: progress.sourceType,
            dsaQuestionSlug: progress.dsaQuestionSlug,
            prepQuestionTemplateId: progress.prepQuestionTemplateId,
            status: attemptStatus(input.action),
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
   * URL directly cannot seed one for a non-frontend user.
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
      select: { id: true }
    });

    if (!existing) {
      const created = await this.ensureFrontendRoadmap(ownerId);
      if (!created) return null;
    }

    return readFrontendRoadmapHome(this.prisma, ownerId);
  }

  async ensureFrontendRoadmap(ownerId: string): Promise<EnsureFrontendRoadmapResult | null> {
    return this.prisma.$transaction(
      async (tx) => {
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
          throw new Error(`Cannot create frontend roadmap without a candidate profile: ${ownerId}`);
        }

        if (profile.targetRole !== FRONTEND_ROADMAP_ROLE) {
          return null;
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
          throw new Error("Active frontend roadmap template is missing. Run `pnpm prisma:seed`.");
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
              metadata: toJson({
                slug: session.slug,
                title: session.title,
                covers: session.covers,
                purpose: session.purpose
              })
            }
          });
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
      { maxWait: 10_000, timeout: 30_000 }
    );
  }
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
    (question) => question.roadmapQuestionTemplate?.chapterTemplateId ?? null
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
    const questions = questionsByChapterTemplateId.get(progress.chapterTemplateId) ?? [];
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
  if (slug === "frontend-dsa") return "/practice";

  const params = new URLSearchParams({ focus: title });
  return `/interview?${params.toString()}`;
}

function attemptStatus(action: RoadmapQuestionAttemptAction): RoadmapQuestionAttemptStatus {
  if (action === "complete") return RoadmapQuestionAttemptStatus.COMPLETED;
  if (action === "skip") return RoadmapQuestionAttemptStatus.SKIPPED;
  if (action === "submit") return RoadmapQuestionAttemptStatus.SUBMITTED;
  return RoadmapQuestionAttemptStatus.STARTED;
}

function questionStatusAfterAction(
  current: RoadmapProgressStatus,
  action: RoadmapQuestionAttemptAction
): RoadmapProgressStatus {
  if (action === "complete") return RoadmapProgressStatus.COMPLETED;
  if (action === "skip") return RoadmapProgressStatus.SKIPPED;
  if (current === RoadmapProgressStatus.COMPLETED) return RoadmapProgressStatus.COMPLETED;
  return RoadmapProgressStatus.IN_PROGRESS;
}

function normalizedScore(
  score: number | null | undefined,
  action: RoadmapQuestionAttemptAction
): number | null {
  if (typeof score === "number" && Number.isFinite(score)) {
    return Math.max(0, Math.min(1, score));
  }
  return action === "complete" ? 1 : null;
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
  const [roadmap, sessionProgress, chapterProgress, questionProgress] = await Promise.all([
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
        chapterProgress: { include: { chapterTemplate: { select: { slug: true, title: true } } } },
        dsaQuestion: {
          select: {
            title: true,
            commonMistakes: true,
            interviewSignals: true,
            primaryPattern: true,
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
  // Frontend DSA has seeded questions, so once it is finished nothing owns a
  // next question and every remaining session stayed LOCKED forever — the
  // roadmap dead-ended instead of moving to JavaScript and React Core.
  //
  // When no session is live, open the earliest unfinished one by order. A
  // session with no content yet becomes ACTIVE rather than staying locked,
  // which is what "the active session should move to the next one" means.
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
      if (!row || row.status === RoadmapProgressStatus.COMPLETED) continue;

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
  }>
) {
  return questions.reduce(
    (counts, question) => {
      const difficulty = question.roadmapQuestionTemplate?.difficulty;
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
  const chapterTitle = input.nextQuestion?.chapterProgress?.chapterTemplate.title ?? "Frontend DSA";
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
  // With nothing queued, the old copy still read "Frontend DSA: your next
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
        evidenceLabel:
          weakPatternLabel ?? input.nextQuestion?.dsaQuestion?.primaryPattern ?? "frontend-dsa",
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
            ? "Review your completed frontend roadmap and run the final mock."
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

type InsightAttempt = Prisma.UserQuestionAttemptGetPayload<{
  include: {
    questionProgress: {
      include: {
        dsaQuestion: {
          select: {
            title: true;
            commonMistakes: true;
            interviewSignals: true;
            primaryPattern: true;
          };
        };
        roadmapQuestionTemplate: {
          select: {
            titleSnapshot: true;
            difficulty: true;
          };
        };
      };
    };
  };
}>;

interface AttemptPatternSignal {
  pattern: string;
  weakAttempts: number;
  totalAttempts: number;
  lastQuestionTitle: string | null;
}

interface AttemptHistoryAnalysis {
  weakestPattern: AttemptPatternSignal | null;
  lastCompletedTitle: string | null;
  lastCompletedPattern: string | null;
  completionStreakDays: number;
  activeAttemptDays: number;
}

function analyzeAttemptHistory(attempts: InsightAttempt[]): AttemptHistoryAnalysis {
  const patternSignals = new Map<string, AttemptPatternSignal>();
  const completedDayKeys = new Set<string>();
  const activeDayKeys = new Set<string>();
  let lastCompletedTitle: string | null = null;
  let lastCompletedPattern: string | null = null;

  for (const attempt of attempts) {
    activeDayKeys.add(dayKey(attempt.createdAt));

    const question = attempt.questionProgress;
    const pattern = question.dsaQuestion?.primaryPattern ?? "frontend-dsa";
    const title =
      question.dsaQuestion?.title ?? question.roadmapQuestionTemplate?.titleSnapshot ?? null;
    const signal = patternSignals.get(pattern) ?? {
      pattern,
      weakAttempts: 0,
      totalAttempts: 0,
      lastQuestionTitle: null
    };

    signal.totalAttempts += 1;
    if (isWeakAttempt(attempt)) {
      signal.weakAttempts += 1;
      signal.lastQuestionTitle ??= title;
    }
    patternSignals.set(pattern, signal);

    if (attempt.status === RoadmapQuestionAttemptStatus.COMPLETED) {
      completedDayKeys.add(dayKey(attempt.createdAt));
      lastCompletedTitle ??= title;
      lastCompletedPattern ??= pattern;
    }
  }

  const weakestPattern =
    [...patternSignals.values()]
      .filter((signal) => signal.weakAttempts >= 2)
      .sort(
        (a, b) =>
          b.weakAttempts - a.weakAttempts ||
          b.weakAttempts / b.totalAttempts - a.weakAttempts / a.totalAttempts
      )[0] ?? null;

  return {
    weakestPattern,
    lastCompletedTitle,
    lastCompletedPattern,
    completionStreakDays: consecutiveDayCount(completedDayKeys),
    activeAttemptDays: activeDayKeys.size
  };
}

function isWeakAttempt(attempt: InsightAttempt): boolean {
  if (attempt.status === RoadmapQuestionAttemptStatus.SKIPPED) return true;
  if (typeof attempt.score === "number" && attempt.score < 0.55) return true;

  const correctness = attempt.correctness?.toLowerCase() ?? "";
  return ["incorrect", "miss", "weak", "failed", "skipped"].some((token) =>
    correctness.includes(token)
  );
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function consecutiveDayCount(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0;

  const sortedKeys = [...dayKeys].sort((a, b) => b.localeCompare(a));
  const current = new Date(`${sortedKeys[0]}T00:00:00.000Z`);
  let streak = 0;

  for (const key of sortedKeys) {
    if (key !== dayKey(current)) break;
    streak += 1;
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return streak;
}

function displayPattern(pattern: string): string {
  return pattern
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function streakInsightBody(streakDays: number, completedQuestions: number): string {
  if (completedQuestions === 0) return "Not started. Your first solved question begins the streak.";
  if (streakDays <= 1) {
    return `${completedQuestions} question${completedQuestions === 1 ? "" : "s"} completed. Solve one more today to make the streak visible.`;
  }
  return `${streakDays}-day solve streak. Keep one focused question in the loop before switching topics.`;
}

function nextQuestionHref(
  question:
    | {
        dsaQuestionSlug: string | null;
        prepQuestionTemplateId: string | null;
        roadmapQuestionTemplateId: string | null;
      }
    | undefined
): string | null {
  // No question left. Returning "/" here made the declared `?? "/practice"`
  // fallbacks unreachable, because "/" is truthy — so callers silently sent a
  // finished user to Home instead of back to their session.
  if (!question) return null;
  if (question.dsaQuestionSlug) return `/dsa-questions/${question.dsaQuestionSlug}`;
  if (question.prepQuestionTemplateId)
    return `/practice?question=${question.prepQuestionTemplateId}`;
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

function buildPersonalization(profile: {
  level: string | null;
  focusAreas: Prisma.JsonValue;
  stories: Prisma.JsonValue;
  resumeAnalysis: Prisma.JsonValue | null;
  resumeFileName: string | null;
  resumeConfidence: number | null;
}) {
  const focusAreas = stringArray(profile.focusAreas, 8);
  const resumeTerms = collectResumeTerms(profile.resumeAnalysis);
  const matchedFrontendEvidence = matchFrontendEvidence([...focusAreas, ...resumeTerms]);

  return {
    targetRole: FRONTEND_ROADMAP_ROLE,
    level: profile.level,
    levelStrategy: levelStrategy(profile.level),
    resumeSignal:
      matchedFrontendEvidence.length > 0 ? "frontend-evidence-found" : "evidence-building-needed",
    matchedFrontendEvidence,
    focusAreas,
    storyCount: Array.isArray(profile.stories) ? profile.stories.length : 0,
    resume: {
      fileName: profile.resumeFileName,
      confidence: profile.resumeConfidence
    }
  };
}

function levelStrategy(level: string | null): string {
  if (level === "fresher" || level === "0-2") {
    return "fundamentals-first-with-guided-warmups";
  }
  if (level === "3-5") {
    return "production-tradeoffs-debugging-and-feature-ownership";
  }
  if (level === "5-plus") {
    return "ambiguity-architecture-quality-strategy-and-leadership";
  }
  return "balanced-frontend-interview-readiness";
}

function collectResumeTerms(value: Prisma.JsonValue | null): string[] {
  const terms: string[] = [];
  walkJson(value, terms);
  return terms;
}

function walkJson(value: Prisma.JsonValue | null | undefined, terms: string[]): void {
  if (typeof value === "string") {
    terms.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, terms);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) walkJson(nested, terms);
  }
}

function matchFrontendEvidence(values: string[]): string[] {
  const keywords = [
    "react",
    "next",
    "typescript",
    "javascript",
    "frontend",
    "front-end",
    "ui",
    "dashboard",
    "forms",
    "form",
    "design system",
    "accessibility",
    "performance",
    "web vitals",
    "responsive",
    "css",
    "tailwind"
  ];
  const text = values.join(" ").toLowerCase();
  return keywords.filter((keyword) => text.includes(keyword)).slice(0, 8);
}

function stringArray(value: Prisma.JsonValue, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, limit);
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

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
