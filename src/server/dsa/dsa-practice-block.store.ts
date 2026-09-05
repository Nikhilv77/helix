import {
  DsaPracticeBlockStatus,
  Prisma,
  RoadmapProgressStatus,
  RoadmapQuestionSourceType
} from "@prisma/client";
import type { DsaRecommendation } from "@/lib/practice/dsa-recommendation";
import type { PrismaService } from "@/server/database/prisma.service";

const FRONTEND_ROADMAP_ROLE = "fullstack";
const DSA_SESSION_KEY = "dsa";

const blockSelect = {
  id: true,
  ownerId: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  recommendationSnapshot: true,
  questionSlugs: true,
  assessmentReadyAt: true,
  assessedAt: true,
  createdAt: true,
  updatedAt: true,
  assessment: {
    select: {
      id: true,
      interviewSessionId: true,
      reportSnapshot: true,
      assessmentSnapshot: true,
      startedAt: true,
      completedAt: true
    }
  }
} satisfies Prisma.DsaPracticeBlockSelect;

export type DsaPracticeBlockRecord = Prisma.DsaPracticeBlockGetPayload<{
  select: typeof blockSelect;
}>;

type DsaPracticeBlockTransaction = Prisma.TransactionClient;

/**
 * Durable owner-scoped lifecycle for adaptive DSA cohorts.
 *
 * The prior JSON metadata remains readable only as a lazy migration source.
 * Once a durable record exists it is the sole authority for lifecycle and
 * history. Every mutation acquires the same per-owner advisory lock used by
 * roadmap progress writes, which makes duplicate page loads and retries safe.
 */
export class DsaPracticeBlockStore {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the active cohort, lazily importing the legacy JSON cohort once. */
  async current(ownerId: string): Promise<DsaPracticeBlockRecord | null> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const current = await tx.dsaPracticeBlock.findFirst({
          where: { ownerId, isCurrent: true },
          select: blockSelect
        });
        if (current) return current;

        const legacySlugs = await legacyBlockSlugs(tx, ownerId);
        if (!legacySlugs.length) return null;

        return createBlock(tx, {
          ownerId,
          ordinal: 1,
          questionSlugs: legacySlugs,
          recommendationSnapshot: {
            schemaVersion: 0,
            source: "legacy-user-session-progress",
            questionSlugs: legacySlugs
          }
        });
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /**
   * Promotes only the current practising cohort after every saved question has
   * a verified COMPLETED roadmap state. A ready state is never demoted: after
   * proof has been captured a later unrelated edit must not re-lock it.
   */
  async refreshReadiness(
    ownerId: string,
    options: { allowIncomplete?: boolean } = {}
  ): Promise<DsaPracticeBlockRecord | null> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await tx.dsaPracticeBlock.findFirst({
          where: { ownerId, isCurrent: true },
          select: blockSelect
        });
        if (!block || block.status !== DsaPracticeBlockStatus.PRACTISING) return block;

        const everyQuestionCompleted =
          options.allowIncomplete === true ||
          (await everyBlockQuestionCompleted(tx, ownerId, block.questionSlugs));
        if (!everyQuestionCompleted) return block;

        return tx.dsaPracticeBlock.update({
          where: { id: block.id },
          data: {
            status: DsaPracticeBlockStatus.ASSESSMENT_READY,
            assessmentReadyAt: new Date()
          },
          select: blockSelect
        });
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /**
   * Idempotently creates the first cohort or advances an assessed cohort. A
   * ready/in-progress cohort always wins over a newly calculated suggestion.
   */
  async createOrAdvance(
    ownerId: string,
    recommendation: DsaRecommendation
  ): Promise<DsaPracticeBlockRecord> {
    const questionSlugs = normalizedSlugs(
      recommendation.questions.map((question) => question.slug)
    );
    if (!questionSlugs.length) {
      throw new Error("Cannot create a DSA practice block without questions.");
    }

    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        let current = await tx.dsaPracticeBlock.findFirst({
          where: { ownerId, isCurrent: true },
          select: blockSelect
        });

        if (!current) {
          const legacySlugs = await legacyBlockSlugs(tx, ownerId);
          if (legacySlugs.length) {
            current = await createBlock(tx, {
              ownerId,
              ordinal: 1,
              questionSlugs: legacySlugs,
              recommendationSnapshot: {
                schemaVersion: 0,
                source: "legacy-user-session-progress",
                questionSlugs: legacySlugs
              }
            });
          }
        }

        // Concurrent renders may calculate different next cohorts. The first
        // writer wins; all following calls return that immutable current block.
        if (current && current.status !== DsaPracticeBlockStatus.ASSESSED) return current;

        const nextOrdinal = current ? current.ordinal + 1 : 1;
        if (current) {
          await tx.dsaPracticeBlock.update({
            where: { id: current.id },
            data: { isCurrent: false }
          });
        }

        return createBlock(tx, {
          ownerId,
          ordinal: nextOrdinal,
          questionSlugs,
          recommendationSnapshot: recommendationSnapshot(recommendation)
        });
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /** Starts a ready assessment exactly once; interview session creation comes in Step 3. */
  async markAssessmentInProgress(
    ownerId: string,
    blockId: string
  ): Promise<DsaPracticeBlockRecord> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await ownedCurrentBlock(tx, ownerId, blockId);
        if (block.status === DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS) return block;
        if (block.status !== DsaPracticeBlockStatus.ASSESSMENT_READY) {
          throw new Error("This DSA block assessment is not ready to start.");
        }

        const now = new Date();
        await tx.dsaBlockAssessment.update({
          where: { blockId: block.id },
          data: { startedAt: now }
        });
        return tx.dsaPracticeBlock.update({
          where: { id: block.id },
          data: { status: DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS },
          select: blockSelect
        });
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /**
   * Terminal lifecycle transition used by the later scoring finalizer. It does
   * not create the next block: the completed result remains selected until a
   * subsequent recommendation read explicitly advances it.
   */
  async markAssessmentAssessed(ownerId: string, blockId: string): Promise<DsaPracticeBlockRecord> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await ownedCurrentBlock(tx, ownerId, blockId);
        if (block.status === DsaPracticeBlockStatus.ASSESSED) return block;
        if (
          block.status !== DsaPracticeBlockStatus.ASSESSMENT_READY &&
          block.status !== DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS
        ) {
          throw new Error("A DSA block must be assessment-ready before it can be assessed.");
        }

        const now = new Date();
        await tx.dsaBlockAssessment.update({
          where: { blockId: block.id },
          data: { completedAt: now }
        });
        return tx.dsaPracticeBlock.update({
          where: { id: block.id },
          data: {
            status: DsaPracticeBlockStatus.ASSESSED,
            assessedAt: now
          },
          select: blockSelect
        });
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  async history(ownerId: string): Promise<DsaPracticeBlockRecord[]> {
    return this.prisma.dsaPracticeBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: blockSelect
    });
  }

  async findOwned(ownerId: string, blockId: string): Promise<DsaPracticeBlockRecord | null> {
    return this.prisma.dsaPracticeBlock.findFirst({
      where: { id: blockId, ownerId },
      select: blockSelect
    });
  }
}

async function ownedCurrentBlock(
  tx: DsaPracticeBlockTransaction,
  ownerId: string,
  blockId: string
): Promise<DsaPracticeBlockRecord> {
  const block = await tx.dsaPracticeBlock.findFirst({
    where: { id: blockId, ownerId, isCurrent: true },
    select: blockSelect
  });
  if (!block) throw new Error("DSA practice block was not found for this candidate.");
  return block;
}

async function createBlock(
  tx: DsaPracticeBlockTransaction,
  input: {
    ownerId: string;
    ordinal: number;
    questionSlugs: string[];
    recommendationSnapshot: unknown;
  }
): Promise<DsaPracticeBlockRecord> {
  return tx.dsaPracticeBlock.create({
    data: {
      ownerId: input.ownerId,
      ordinal: input.ordinal,
      recommendationSnapshot: toJson(input.recommendationSnapshot),
      questionSlugs: input.questionSlugs,
      assessment: { create: { ownerId: input.ownerId } }
    },
    select: blockSelect
  });
}

async function everyBlockQuestionCompleted(
  tx: DsaPracticeBlockTransaction,
  ownerId: string,
  questionSlugs: string[]
): Promise<boolean> {
  if (!questionSlugs.length) return false;
  const rows = await tx.userQuestionProgress.findMany({
    where: {
      roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
      sourceType: RoadmapQuestionSourceType.DSA,
      dsaQuestionSlug: { in: questionSlugs },
      status: RoadmapProgressStatus.COMPLETED
    },
    select: { dsaQuestionSlug: true }
  });
  const completed = new Set(
    rows.flatMap((row) => (row.dsaQuestionSlug ? [row.dsaQuestionSlug] : []))
  );
  return questionSlugs.every((slug) => completed.has(slug));
}

async function legacyBlockSlugs(
  tx: DsaPracticeBlockTransaction,
  ownerId: string
): Promise<string[]> {
  const session = await tx.userSessionProgress.findFirst({
    where: {
      roadmap: { ownerId, role: FRONTEND_ROADMAP_ROLE },
      practiceSessionKey: DSA_SESSION_KEY
    },
    select: { metadata: true }
  });
  return legacyMetadataSlugs(session?.metadata ?? null);
}

function recommendationSnapshot(recommendation: DsaRecommendation): Prisma.InputJsonValue {
  return toJson({ schemaVersion: 1, recommendation });
}

export function recommendationFromSnapshot(snapshot: Prisma.JsonValue): DsaRecommendation | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const recommendation = (snapshot as Prisma.JsonObject).recommendation;
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation))
    return null;
  const candidate = recommendation as unknown as DsaRecommendation;
  if (
    !Array.isArray(candidate.questions) ||
    !candidate.questions.every((question) => typeof question?.slug === "string")
  ) {
    return null;
  }
  return candidate;
}

function legacyMetadataSlugs(metadata: Prisma.JsonValue | null): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const block = (metadata as Prisma.JsonObject).dsaRecommendationBlock;
  if (!block || typeof block !== "object" || Array.isArray(block)) return [];
  const slugs = (block as Prisma.JsonObject).questionSlugs;
  return Array.isArray(slugs)
    ? normalizedSlugs(slugs.filter((slug): slug is string => typeof slug === "string"))
    : [];
}

function normalizedSlugs(slugs: string[]): string[] {
  return [...new Set(slugs.filter((slug) => slug.length > 0))].slice(0, 12);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockOwner(tx: DsaPracticeBlockTransaction, ownerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`frontend-roadmap:${ownerId}`}))`;
}
