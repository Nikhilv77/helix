import { PracticeSessionAvailability, Prisma, RoadmapProgressStatus } from "@prisma/client";
import type { PersonalizedInterviewPlan } from "@/features/interviews/domain/personalized-plan";
import type { CandidatePracticeEvidence } from "@/features/practice/shared/domain/practice-evidence";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  PRACTICE_KEY_BY_TEMPLATE_SLUG,
  PRACTICE_ROADMAP_GENERATION_VERSION,
  type PracticeRoadmapHome,
  type PracticeRoadmapSession,
  type PracticeSessionKey,
  projectPracticeSessions
} from "@/features/practice/shared/domain/practice-roadmap";
import type { PrismaService } from "@/server/database/prisma.service";
import type { PersonalizedInterviewPlanningService } from "@/features/interviews/server/personalized-interview-planning.service";
import type { FrontendRoadmapService } from "@/server/roadmap/frontend-roadmap.service";

const PRACTICE_ROADMAP_ROLE = "fullstack";
const DAY_MS = 86_400_000;
const DEFAULT_ACTIVITY_DAYS = 7;

type RoadmapProvisioner = Pick<FrontendRoadmapService, "ensureAvailable">;
type PlanReader = Pick<PersonalizedInterviewPlanningService, "activePlan">;

export type PracticeRoadmapCache = (
  stamp: { updatedAt: Date; templateVersion: number | null },
  plan: PersonalizedInterviewPlan,
  load: () => Promise<PracticeRoadmapHome>
) => Promise<PracticeRoadmapHome>;

const practiceProgressSelect = {
  id: true,
  sessionTemplateId: true,
  practiceSessionKey: true,
  order: true,
  status: true,
  availability: true,
  titleSnapshot: true,
  purposeSnapshot: true,
  coversSnapshot: true,
  difficultySnapshot: true,
  durationMinutesSnapshot: true,
  sourceBlueprintId: true,
  sourceBlueprintKind: true,
  personalizedAt: true,
  totalQuestions: true,
  attemptedQuestions: true,
  completedQuestions: true,
  progressPercent: true
} satisfies Prisma.UserSessionProgressSelect;

type PersistedPracticeProgress = Prisma.UserSessionProgressGetPayload<{
  select: typeof practiceProgressSelect;
}>;

/**
 * Persists the DSA Practice slot derived from the active immutable interview
 * plan. Reconciliation only updates identity and display
 * snapshots; attempt counters and completion history are never reset.
 */
export class PracticeRoadmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roadmaps: RoadmapProvisioner,
    private readonly plans: PlanReader
  ) {}

  async home(
    ownerId: string,
    practiceEvidence?: Promise<CandidatePracticeEvidence | null>,
    profile?: CandidateProfile,
    planPromise?: Promise<PersonalizedInterviewPlan>,
    cache?: PracticeRoadmapCache
  ): Promise<PracticeRoadmapHome | null> {
    const [plan, provisioned] = await Promise.all([
      planPromise ??
        (practiceEvidence || profile
          ? this.plans.activePlan(ownerId, Date.now(), { practiceEvidence, profile })
          : this.plans.activePlan(ownerId)),
      this.roadmaps.ensureAvailable(ownerId)
    ]);
    if (!provisioned) return null;
    const load = async () =>
      (await this.readCurrent(ownerId, plan)) ?? this.reconcile(ownerId, plan);
    const stamp = cache
      ? await this.prisma.userRoadmap.findUnique({
          where: { ownerId_role: { ownerId, role: PRACTICE_ROADMAP_ROLE } },
          select: { updatedAt: true, templateVersion: true }
        })
      : null;
    return stamp && cache ? cache(stamp, plan, load) : load();
  }

  /** Stable plans need only one read and no per-owner write lock. */
  private async readCurrent(
    ownerId: string,
    plan: PersonalizedInterviewPlan
  ): Promise<PracticeRoadmapHome | null> {
    const projected = projectPracticeSessions(plan);
    const keys = projected.map((session) => session.key);
    const templateSlugs = Object.entries(PRACTICE_KEY_BY_TEMPLATE_SLUG)
      .filter(([, key]) => keys.includes(key))
      .map(([slug]) => slug);
    const roadmap = await this.prisma.userRoadmap.findUnique({
      where: { ownerId_role: { ownerId, role: PRACTICE_ROADMAP_ROLE } },
      select: {
        id: true,
        title: true,
        generatedAt: true,
        sourceInterviewPlanId: true,
        sourceInterviewPlanRevision: true,
        sourceProfileVersionId: true,
        sourceProfileRevision: true,
        practiceGenerationVersion: true,
        sessionProgress: {
          where: { practiceSessionKey: { in: keys } },
          select: practiceProgressSelect
        },
        template: {
          select: {
            sessions: {
              where: { slug: { in: templateSlugs } },
              select: { id: true, slug: true, _count: { select: { questions: true } } }
            }
          }
        }
      }
    });
    const sourceProfile = plan.sourceSnapshot.candidateProfile;
    if (
      !roadmap?.template ||
      roadmap.sourceInterviewPlanId !== plan.id ||
      roadmap.sourceInterviewPlanRevision !== plan.revision ||
      roadmap.sourceProfileVersionId !== sourceProfile.id ||
      roadmap.sourceProfileRevision !== sourceProfile.revision ||
      roadmap.practiceGenerationVersion !== PRACTICE_ROADMAP_GENERATION_VERSION
    )
      return null;

    const templates = new Map(
      roadmap.template.sessions.map((template) => [
        PRACTICE_KEY_BY_TEMPLATE_SLUG[template.slug],
        template
      ])
    );
    const progress = new Map(roadmap.sessionProgress.map((row) => [row.sessionTemplateId, row]));
    const sessions: PracticeRoadmapSession[] = [];
    for (const session of projected) {
      const template = templates.get(session.key);
      const row = template && progress.get(template.id);
      if (!template || !row) return null;
      const questionCount = session.key === "dsa" ? template._count.questions : row.totalQuestions;
      const availability =
        questionCount > 0
          ? PracticeSessionAvailability.AVAILABLE
          : PracticeSessionAvailability.UNAVAILABLE;
      if (
        row.practiceSessionKey !== session.key ||
        row.order !== session.order ||
        row.totalQuestions !== questionCount ||
        row.availability !== availability ||
        row.titleSnapshot !== session.title ||
        row.purposeSnapshot !== session.purpose ||
        !sameStrings(row.coversSnapshot, session.covers) ||
        row.difficultySnapshot !== session.difficulty ||
        row.durationMinutesSnapshot !== session.durationMinutes ||
        row.sourceBlueprintId !== session.sourceBlueprintId ||
        row.sourceBlueprintKind !== session.sourceBlueprintKind
      )
        return null;
      sessions.push({
        ...session,
        availability:
          availability === PracticeSessionAvailability.AVAILABLE ? "available" : "unavailable",
        status: row.status,
        totalQuestions: row.totalQuestions,
        attemptedQuestions: row.attemptedQuestions,
        completedQuestions: row.completedQuestions,
        progressPercent: row.progressPercent,
        href: availability === PracticeSessionAvailability.AVAILABLE ? "/practice/dsa" : null
      });
    }
    return {
      roadmapId: roadmap.id,
      title: roadmap.title,
      generationVersion: PRACTICE_ROADMAP_GENERATION_VERSION,
      generatedAt: roadmap.generatedAt.getTime(),
      sourcePlan: {
        id: plan.id,
        revision: plan.revision,
        profileVersionId: sourceProfile.id,
        profileRevision: sourceProfile.revision
      },
      sessions: sessions.sort((left, right) => left.order - right.order)
    };
  }

  /** Completed Practice questions, bucketed by UTC day for the entry-page chart. */
  async activity(
    ownerId: string,
    days = DEFAULT_ACTIVITY_DAYS,
    now: Date = new Date()
  ): Promise<Array<{ date: string; solved: number }>> {
    const dayCount = Math.max(1, Math.min(days, 126));
    const today = startOfUtcDay(now);
    const windowStart = new Date(today.getTime() - (dayCount - 1) * DAY_MS);
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { createdAt: true }
    });
    const accountStart = profile ? startOfUtcDay(profile.createdAt) : windowStart;
    const start = accountStart > windowStart ? accountStart : windowStart;
    const completed = await this.prisma.userQuestionProgress.findMany({
      where: {
        roadmap: { ownerId, role: PRACTICE_ROADMAP_ROLE },
        status: RoadmapProgressStatus.COMPLETED,
        completedAt: { gte: start }
      },
      select: { completedAt: true }
    });
    const solvedByDay = new Map<string, number>();
    for (const question of completed) {
      if (!question.completedAt) continue;
      const date = dayKey(question.completedAt);
      solvedByDay.set(date, (solvedByDay.get(date) ?? 0) + 1);
    }

    return Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start.getTime() + index * DAY_MS);
      const key = dayKey(date);
      return { date: key, solved: solvedByDay.get(key) ?? 0 };
    });
  }

  private async reconcile(
    ownerId: string,
    plan: PersonalizedInterviewPlan
  ): Promise<PracticeRoadmapHome> {
    const projected = projectPracticeSessions(plan);
    const personalizedAt = new Date();

    return this.prisma.$transaction(
      async (tx) => {
        // Use the provisioning/attempt lock namespace as well. Concurrent first
        // loads otherwise pipeline one transaction through provisioning while
        // another updates the same rows here, which can deadlock in Postgres.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;

        const roadmap = await tx.userRoadmap.findUniqueOrThrow({
          where: { ownerId_role: { ownerId, role: PRACTICE_ROADMAP_ROLE } },
          select: {
            id: true,
            title: true,
            templateId: true,
            personalization: true,
            generatedAt: true,
            sourceInterviewPlanId: true,
            sourceInterviewPlanRevision: true,
            sourceProfileVersionId: true,
            sourceProfileRevision: true,
            practiceGenerationVersion: true
          }
        });
        if (!roadmap.templateId) {
          throw new Error(`Practice roadmap is missing its source template: ${roadmap.id}`);
        }

        const templates = await tx.roadmapSessionTemplate.findMany({
          where: { templateId: roadmap.templateId },
          select: {
            id: true,
            slug: true,
            _count: { select: { questions: true } }
          }
        });
        const templateByKey = new Map<PracticeSessionKey, (typeof templates)[number]>();
        for (const template of templates) {
          const key = PRACTICE_KEY_BY_TEMPLATE_SLUG[template.slug];
          if (key) templateByKey.set(key, template);
        }
        const existingProgress = await tx.userSessionProgress.findMany({
          where: { roadmapId: roadmap.id },
          select: practiceProgressSelect
        });
        const progressByTemplateId = new Map(
          existingProgress.map((progress) => [progress.sessionTemplateId, progress])
        );

        const progressRows: PersistedPracticeProgress[] = [];
        for (const session of projected) {
          const template = templateByKey.get(session.key);
          if (!template) {
            throw new Error(`Practice template is missing stable slot: ${session.key}`);
          }
          const existing = progressByTemplateId.get(template.id);
          const questionCount =
            session.key === "dsa"
              ? template._count.questions
              : (existing?.totalQuestions ?? template._count.questions);
          const availability =
            questionCount > 0
              ? PracticeSessionAvailability.AVAILABLE
              : PracticeSessionAvailability.UNAVAILABLE;
          const personalizationChanged =
            !existing ||
            existing.titleSnapshot !== session.title ||
            existing.purposeSnapshot !== session.purpose ||
            !sameStrings(existing.coversSnapshot, session.covers) ||
            existing.difficultySnapshot !== session.difficulty ||
            existing.durationMinutesSnapshot !== session.durationMinutes ||
            existing.sourceBlueprintId !== session.sourceBlueprintId ||
            existing.sourceBlueprintKind !== session.sourceBlueprintKind;
          const sessionChanged =
            personalizationChanged ||
            !existing ||
            existing.practiceSessionKey !== session.key ||
            existing.order !== session.order ||
            existing.totalQuestions !== questionCount ||
            existing.availability !== availability;
          const persistence = {
            practiceSessionKey: session.key,
            order: session.order,
            totalQuestions: questionCount,
            availability,
            titleSnapshot: session.title,
            purposeSnapshot: session.purpose,
            coversSnapshot: session.covers,
            difficultySnapshot: session.difficulty,
            durationMinutesSnapshot: session.durationMinutes,
            sourceBlueprintId: session.sourceBlueprintId,
            sourceBlueprintKind: session.sourceBlueprintKind,
            personalizedAt: personalizationChanged ? personalizedAt : undefined
          };

          let progress = existing;
          if (!existing) {
            progress = await tx.userSessionProgress.create({
              data: {
                roadmapId: roadmap.id,
                sessionTemplateId: template.id,
                ...persistence,
                status:
                  availability === PracticeSessionAvailability.AVAILABLE
                    ? RoadmapProgressStatus.ACTIVE
                    : RoadmapProgressStatus.LOCKED,
                startedAt:
                  availability === PracticeSessionAvailability.AVAILABLE ? personalizedAt : null
              },
              select: practiceProgressSelect
            });
          } else if (sessionChanged) {
            progress = await tx.userSessionProgress.update({
              where: { id: existing.id },
              data: persistence,
              select: practiceProgressSelect
            });
          }
          if (!progress) throw new Error(`Practice progress was not persisted: ${session.key}`);
          progressRows.push(progress);
        }

        const sourceProfile = plan.sourceSnapshot.candidateProfile;
        const sourceChanged =
          roadmap.sourceInterviewPlanId !== plan.id ||
          roadmap.sourceInterviewPlanRevision !== plan.revision ||
          roadmap.sourceProfileVersionId !== sourceProfile.id ||
          roadmap.sourceProfileRevision !== sourceProfile.revision;
        const generationChanged =
          roadmap.practiceGenerationVersion !== PRACTICE_ROADMAP_GENERATION_VERSION;
        let generatedAt = roadmap.generatedAt;
        if (sourceChanged || generationChanged) {
          generatedAt = sourceChanged ? personalizedAt : roadmap.generatedAt;
          const updatedRoadmap = await tx.userRoadmap.update({
            where: { id: roadmap.id },
            data: {
              sourceInterviewPlanId: plan.id,
              sourceInterviewPlanRevision: plan.revision,
              sourceProfileVersionId: sourceProfile.id,
              sourceProfileRevision: sourceProfile.revision,
              practiceGenerationVersion: PRACTICE_ROADMAP_GENERATION_VERSION,
              generatedAt,
              personalization: mergePracticePersonalization(roadmap.personalization, plan)
            },
            select: { generatedAt: true }
          });
          generatedAt = updatedRoadmap.generatedAt;
        }

        const projectionByKey = new Map(projected.map((session) => [session.key, session]));
        const sessions: PracticeRoadmapSession[] = progressRows
          .map((progress): PracticeRoadmapSession => {
            const key = progress.practiceSessionKey as PracticeSessionKey;
            const fallback = projectionByKey.get(key);
            if (!fallback) throw new Error(`Unknown persisted Practice slot: ${key}`);

            return {
              ...fallback,
              title: progress.titleSnapshot ?? fallback.title,
              purpose: progress.purposeSnapshot ?? fallback.purpose,
              covers: progress.coversSnapshot,
              difficulty: progress.difficultySnapshot,
              durationMinutes: progress.durationMinutesSnapshot,
              sourceBlueprintId: progress.sourceBlueprintId,
              sourceBlueprintKind:
                (progress.sourceBlueprintKind as PracticeRoadmapSession["sourceBlueprintKind"]) ??
                null,
              availability:
                progress.availability === PracticeSessionAvailability.AVAILABLE
                  ? "available"
                  : "unavailable",
              status: progress.status,
              totalQuestions: progress.totalQuestions,
              attemptedQuestions: progress.attemptedQuestions,
              completedQuestions: progress.completedQuestions,
              progressPercent: progress.progressPercent,
              href:
                progress.availability === PracticeSessionAvailability.AVAILABLE
                  ? "/practice/dsa"
                  : null
            };
          })
          .sort((left, right) => left.order - right.order);

        return {
          roadmapId: roadmap.id,
          title: roadmap.title,
          generationVersion: PRACTICE_ROADMAP_GENERATION_VERSION,
          generatedAt: generatedAt.getTime(),
          sourcePlan: {
            id: plan.id,
            revision: plan.revision,
            profileVersionId: sourceProfile.id,
            profileRevision: sourceProfile.revision
          },
          sessions
        };
      },
      // First-load reconciliation can sit behind provisioning on the same
      // owner lock. Allow the bounded queue to drain without expiring a valid
      // transaction.
      { maxWait: 20_000, timeout: 120_000 }
    );
  }
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mergePracticePersonalization(
  existing: Prisma.JsonValue | null,
  plan: PersonalizedInterviewPlan
): Prisma.InputJsonValue {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};

  return {
    ...base,
    practice: {
      generationVersion: PRACTICE_ROADMAP_GENERATION_VERSION,
      sourcePlanId: plan.id,
      sourcePlanRevision: plan.revision,
      sourceProfileVersionId: plan.sourceSnapshot.candidateProfile.id,
      sourceProfileRevision: plan.sourceSnapshot.candidateProfile.revision
    }
  } as Prisma.InputJsonValue;
}
