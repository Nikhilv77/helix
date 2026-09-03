import { ResumeRoastStatus } from "@prisma/client";
import {
  ResumeRoastResultSchema,
  ResumeRoastStreamEventSchema,
  type ResumeRoastResult
} from "@/lib/resume-roast/contracts";
import type { PrismaService } from "../database/prisma.service";
import { ResumeRoastStore, type CreateResumeRoastInput } from "./resume-roast.store";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const input: CreateResumeRoastInput = {
  ownerId: "user-a",
  resumeProfileVersionId: "11111111-1111-4111-8111-111111111111",
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior",
  promptVersion: "resume-roast-v1"
};

const validResult: ResumeRoastResult = {
  openingRoast: "This bullet has taken a scenic route around the outcome.",
  strength: {
    headline: "Real delivery evidence",
    explanation: "The resume names a concrete system and its scope.",
    evidenceAnchors: ["Built the payments API"]
  },
  problems: [],
  rewrite: null,
  verdict: {
    band: "has-potential",
    explanation: "The experience is useful but the evidence needs sharpening.",
    targetFitScore: 68
  },
  actionPlan: [
    {
      priority: 1,
      action: "Add an outcome to the payments bullet.",
      rationale: "It is the highest-value missing evidence."
    }
  ]
};

type Row = CreateResumeRoastInput & {
  id: string;
  status: ResumeRoastStatus;
  generationToken: string | null;
  result: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

type NotificationRow = {
  ownerId: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  subjectId: string;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    ...input,
    status: ResumeRoastStatus.READY,
    generationToken: null,
    result: validResult,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makePrisma(initialRows: Row[] = []) {
  const rows = [...initialRows];
  const notifications: NotificationRow[] = [];
  const targets = new Map<
    string,
    { ownerId: string; role: string; companyEnvironment: string; level: string }
  >();
  const create = vi.fn(
    async ({ data }: { data: Omit<Row, "id" | "createdAt" | "updatedAt" | "result"> }) => {
      const created = row({
        ...data,
        id: `${String(rows.length + 3).padStart(8, "0")}-3333-4333-8333-333333333333`,
        result: null,
        createdAt: new Date(NOW.getTime() + rows.length),
        updatedAt: NOW
      });
      rows.push(created);
      return created;
    }
  );
  const prisma = {
    resumeRoastTarget: {
      findUnique: vi.fn(
        async ({ where }: { where: { ownerId: string } }) => targets.get(where.ownerId) ?? null
      ),
      upsert: vi.fn(
        async ({
          create: value
        }: {
          create: { ownerId: string; role: string; companyEnvironment: string; level: string };
        }) => {
          targets.set(value.ownerId, value);
          return value;
        }
      )
    },
    resumeRoast: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          [...rows]
            .filter((candidate) => matches(candidate, where))
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...rows]
          .filter((candidate) => matches(candidate, where))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map((candidate) => ({
            ...candidate,
            resumeProfileVersion: { resumeFileName: "candidate.pdf" }
          }))
      ),
      create,
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
          const matched = rows.filter((candidate) => matches(candidate, where));
          for (const candidate of matched) Object.assign(candidate, data, { updatedAt: NOW });
          return { count: matched.length };
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const index = rows.findIndex((candidate) => matches(candidate, where));
        if (index < 0) return { count: 0 };
        rows.splice(index, 1);
        return { count: 1 };
      })
    },
    notification: {
      createMany: vi.fn(
        async ({
          data,
          skipDuplicates
        }: {
          data: NotificationRow | NotificationRow[];
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const item of Array.isArray(data) ? data : [data]) {
            const duplicate = notifications.some(
              (candidate) =>
                candidate.ownerId === item.ownerId &&
                candidate.kind === item.kind &&
                candidate.subjectId === item.subjectId
            );
            if (duplicate && skipDuplicates) continue;
            notifications.push(item);
            count += 1;
          }
          return { count };
        }
      )
    }
  };
  Object.assign(prisma, {
    $transaction: vi.fn(async (operation: (transaction: typeof prisma) => unknown) =>
      operation(prisma)
    )
  });
  return { prisma: prisma as unknown as PrismaService, rows, notifications, create };
}

function matches(candidate: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(
    ([field, expected]) => candidate[field as keyof Row] === expected
  );
}

describe("ResumeRoastStore", () => {
  it("persists targets by owner", async () => {
    const { prisma } = makePrisma();
    const store = new ResumeRoastStore(prisma);
    const target = {
      role: "backend-engineer",
      companyEnvironment: "product-company",
      level: "senior"
    } as const;

    await expect(store.getTarget("user-a")).resolves.toBeNull();
    await expect(store.saveTarget("user-a", target)).resolves.toEqual(target);
    await expect(store.getTarget("user-a")).resolves.toEqual(target);
    await expect(store.getTarget("user-b")).resolves.toBeNull();
  });

  it("returns only the owner's latest completed roast", async () => {
    const latest = row({
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date(NOW.getTime() + 2_000)
    });
    const { prisma } = makePrisma([
      row(),
      latest,
      row({
        id: "77777777-7777-4777-8777-777777777777",
        resumeProfileVersionId: "99999999-9999-4999-8999-999999999999",
        createdAt: new Date(NOW.getTime() + 4_000)
      }),
      row({ id: "44444444-4444-4444-8444-444444444444", ownerId: "user-b" }),
      row({
        id: "55555555-5555-4555-8555-555555555555",
        status: ResumeRoastStatus.FAILED,
        result: null,
        createdAt: new Date(NOW.getTime() + 3_000)
      })
    ]);
    const store = new ResumeRoastStore(prisma);

    await expect(
      store.getLatestReady("user-a", input.resumeProfileVersionId)
    ).resolves.toMatchObject({ id: latest.id });
    await expect(
      store.getLatestReady("missing-user", input.resumeProfileVersionId)
    ).resolves.toBeNull();
  });

  it("keeps completed roasts from every resume version in owner history", async () => {
    const oldVersionId = "99999999-9999-4999-8999-999999999999";
    const { prisma } = makePrisma([
      row(),
      row({
        id: "77777777-7777-4777-8777-777777777777",
        resumeProfileVersionId: oldVersionId,
        createdAt: new Date(NOW.getTime() + 1_000)
      }),
      row({ id: "88888888-8888-4888-8888-888888888888", ownerId: "user-b" })
    ]);
    const store = new ResumeRoastStore(prisma);

    await expect(store.getReadyHistory("user-a")).resolves.toEqual([
      expect.objectContaining({ resumeProfileVersionId: oldVersionId }),
      expect.objectContaining({ resumeProfileVersionId: input.resumeProfileVersionId })
    ]);
  });

  it("creates a new row for every analysis, including identical targets", async () => {
    const { prisma, rows, create } = makePrisma();
    const store = new ResumeRoastStore(prisma);

    const first = await store.createGeneration(input);
    const second = await store.createGeneration(input);

    expect(first.roastId).not.toBe(second.roastId);
    expect(first.generationToken).not.toBe(second.generationToken);
    expect(rows).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("validates generation metadata before inserting", async () => {
    const { prisma, create } = makePrisma();
    const store = new ResumeRoastStore(prisma);

    await expect(
      store.createGeneration({ ...input, resumeProfileVersionId: "not-a-uuid" })
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      store.createGeneration({ ...input, promptVersion: "resume roast v1" })
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(create).not.toHaveBeenCalled();
  });

  it("completes only the matching owner and generation token", async () => {
    const token = "66666666-6666-4666-8666-666666666666";
    const { prisma, rows, notifications } = makePrisma([
      row({ status: ResumeRoastStatus.GENERATING, generationToken: token, result: null })
    ]);
    const store = new ResumeRoastStore(prisma);

    await expect(store.complete("user-b", rows[0]!.id, token, validResult)).resolves.toBe(false);
    await expect(store.complete("user-a", rows[0]!.id, "wrong-token", validResult)).resolves.toBe(
      false
    );
    await expect(store.complete("user-a", rows[0]!.id, token, validResult)).resolves.toBe(true);
    expect(rows[0]!.status).toBe(ResumeRoastStatus.READY);
    expect(notifications).toEqual([
      {
        ownerId: "user-a",
        kind: "RESUME_ROAST_COMPLETED",
        title: "James has analysed your resume",
        body: "Your target-fit score is 68/100. Open the analysis to see James’s feedback.",
        href: "/resume-roast",
        subjectId: rows[0]!.id
      }
    ]);
  });

  it("owner-scopes deletion", async () => {
    const { prisma, rows } = makePrisma([row()]);
    const store = new ResumeRoastStore(prisma);

    await expect(store.delete("user-b", rows[0]!.id)).resolves.toBe(false);
    await expect(store.delete("user-a", rows[0]!.id)).resolves.toBe(true);
  });

  it("rejects malformed persisted and attempted results", async () => {
    const malformed = { ...validResult, actionPlan: [] };
    const { prisma } = makePrisma([row({ result: malformed })]);
    const store = new ResumeRoastStore(prisma);

    await expect(store.getLatestReady("user-a", input.resumeProfileVersionId)).resolves.toBeNull();
    await expect(
      store.complete("user-a", "22222222-2222-4222-8222-222222222222", "token", malformed)
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("requires bounded output and an explicit replay marker", () => {
    expect(
      ResumeRoastResultSchema.safeParse({ ...validResult, openingRoast: "x".repeat(601) }).success
    ).toBe(false);
    expect(
      ResumeRoastStreamEventSchema.safeParse({
        type: "session",
        roastId: "88888888-8888-4888-8888-888888888888",
        replayed: true,
        target: { role: "backend-engineer", companyEnvironment: "product-company", level: "senior" }
      }).success
    ).toBe(true);
  });
});
