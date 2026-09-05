import { DsaPracticeBlockStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { DsaRecommendation } from "@/lib/practice/dsa-recommendation";
import { DsaPracticeBlockStore } from "./dsa-practice-block.store";

type Row = {
  id: string;
  ownerId: string;
  ordinal: number;
  isCurrent: boolean;
  status: DsaPracticeBlockStatus;
  recommendationSnapshot: unknown;
  questionSlugs: string[];
  assessmentReadyAt: Date | null;
  assessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assessment: {
    id: string;
    interviewSessionId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  };
};

function recommendation(slug: string): DsaRecommendation {
  return {
    tier: "building",
    source: "assessment",
    targetLabel: "Full Stack interview",
    focusChapterId: "arrays-hashing",
    focusLabel: "Arrays & Hashing",
    strengthLabel: null,
    blockTitle: "Arrays & Hashing",
    rationale: "Focus here first.",
    questions: [{ slug }],
    minutes: 15,
    mix: { easy: 0, medium: 1, hard: 0 },
    estimatedPathQuestions: 20,
    availableQuestions: 100
  } as DsaRecommendation;
}

/** Minimal in-memory Prisma boundary for lifecycle invariants, not SQL behavior. */
function memoryPrisma() {
  const rows: Row[] = [];
  const completedByOwner = new Map<string, Set<string>>();
  let sequence = 0;
  const transaction = {
    $executeRaw: async () => undefined,
    dsaPracticeBlock: {
      findFirst: async ({ where }: { where: Partial<Row> }) =>
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key as keyof Row] === value)
        ) ?? null,
      create: async ({
        data
      }: {
        data: {
          ownerId: string;
          ordinal: number;
          questionSlugs: string[];
          recommendationSnapshot: unknown;
        };
      }) => {
        const now = new Date();
        const row: Row = {
          id: `block-${++sequence}`,
          ownerId: data.ownerId,
          ordinal: data.ordinal,
          isCurrent: true,
          status: DsaPracticeBlockStatus.PRACTISING,
          recommendationSnapshot: data.recommendationSnapshot,
          questionSlugs: data.questionSlugs,
          assessmentReadyAt: null,
          assessedAt: null,
          createdAt: now,
          updatedAt: now,
          assessment: {
            id: `assessment-${sequence}`,
            interviewSessionId: null,
            startedAt: null,
            completedAt: null
          }
        };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((candidate) => candidate.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      findMany: async ({ where }: { where: { ownerId: string } }) =>
        rows
          .filter((row) => row.ownerId === where.ownerId)
          .sort((left, right) => right.ordinal - left.ordinal)
    },
    dsaBlockAssessment: {
      update: async ({
        where,
        data
      }: {
        where: { blockId: string };
        data: { startedAt?: Date; completedAt?: Date };
      }) => {
        const row = rows.find((candidate) => candidate.id === where.blockId)!;
        Object.assign(row.assessment, data);
        return row.assessment;
      }
    },
    userSessionProgress: { findFirst: async () => null },
    userQuestionProgress: {
      findMany: async ({
        where
      }: {
        where: { roadmap: { ownerId: string }; dsaQuestionSlug: { in: string[] } };
      }) => {
        const completed = completedByOwner.get(where.roadmap.ownerId) ?? new Set<string>();
        return where.dsaQuestionSlug.in
          .filter((slug) => completed.has(slug))
          .map((dsaQuestionSlug) => ({ dsaQuestionSlug }));
      }
    }
  };
  const prisma = {
    ...transaction,
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>) => work(transaction)
  };
  return {
    store: new DsaPracticeBlockStore(prisma as never),
    rows,
    complete(ownerId: string, ...slugs: string[]) {
      completedByOwner.set(ownerId, new Set(slugs));
    }
  };
}

describe("DsaPracticeBlockStore", () => {
  it("is idempotent under repeated creation and isolates each owner's current/history", async () => {
    const memory = memoryPrisma();
    const first = await memory.store.createOrAdvance("owner-a", recommendation("one"));
    const replay = await memory.store.createOrAdvance("owner-a", recommendation("different"));
    const otherOwner = await memory.store.createOrAdvance("owner-b", recommendation("other"));

    expect(replay.id).toBe(first.id);
    expect(replay.questionSlugs).toEqual(["one"]);
    expect(otherOwner.ownerId).toBe("owner-b");
    expect((await memory.store.history("owner-a")).map((block) => block.id)).toEqual([first.id]);
    expect(await memory.store.findOwned("owner-a", otherOwner.id)).toBeNull();
  });

  it("becomes ready only after every saved question is completed", async () => {
    const memory = memoryPrisma();
    const created = await memory.store.createOrAdvance("owner-a", {
      ...recommendation("one"),
      questions: [{ slug: "one" }, { slug: "two" }]
    } as DsaRecommendation);

    memory.complete("owner-a", "one");
    expect((await memory.store.refreshReadiness("owner-a"))?.status).toBe(
      DsaPracticeBlockStatus.PRACTISING
    );

    memory.complete("owner-a", "one", "two");
    const ready = await memory.store.refreshReadiness("owner-a");
    expect(ready?.status).toBe(DsaPracticeBlockStatus.ASSESSMENT_READY);
    expect(ready?.id).toBe(created.id);
  });

  it("supports an explicit incomplete-block override for local assessment testing", async () => {
    const memory = memoryPrisma();
    await memory.store.createOrAdvance("owner-a", recommendation("one"));

    const ready = await memory.store.refreshReadiness("owner-a", { allowIncomplete: true });

    expect(ready?.status).toBe(DsaPracticeBlockStatus.ASSESSMENT_READY);
  });

  it("keeps the assessed result current until a later recommendation explicitly advances it", async () => {
    const memory = memoryPrisma();
    const first = await memory.store.createOrAdvance("owner-a", recommendation("one"));
    memory.complete("owner-a", "one");
    await memory.store.refreshReadiness("owner-a");
    expect((await memory.store.markAssessmentInProgress("owner-a", first.id)).status).toBe(
      DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS
    );
    await memory.store.markAssessmentAssessed("owner-a", first.id);

    const stillCurrent = await memory.store.current("owner-a");
    expect(stillCurrent?.id).toBe(first.id);
    expect(stillCurrent?.status).toBe(DsaPracticeBlockStatus.ASSESSED);

    const second = await memory.store.createOrAdvance("owner-a", recommendation("two"));
    expect(second.ordinal).toBe(2);
    expect(
      (await memory.store.history("owner-a")).map((block) => [block.ordinal, block.isCurrent])
    ).toEqual([
      [2, true],
      [1, false]
    ]);
  });
});
