import { Prisma } from "@prisma/client";

import { HelpRequestService } from "./help-request.service";
import {
  CODE_LIMIT,
  DEFAULT_TTL_MS,
  HelpRequestError,
  HelpRequestStatus,
  clampContext,
  canTransition,
  isTerminal,
  type HelpRequestContext
} from "./help-request.types";
import type { PrismaService } from "../database/prisma.service";

interface Row {
  id: string;
  learnerId: string;
  questionSlug: string;
  language: string;
  status: HelpRequestStatus;
  context: unknown;
  summary: string | null;
  helperId: string | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionRow {
  id: string;
  requestId: string;
  endedAt: Date | null;
  endedReason: string | null;
}

const LIVE: HelpRequestStatus[] = [HelpRequestStatus.OPEN, HelpRequestStatus.CLAIMED];

/**
 * Enough of Postgres to test the lifecycle honestly.
 *
 * `updateMany` filters before it writes, exactly as a conditional UPDATE does,
 * so a guarded transition that loses a race here matches zero rows for the same
 * reason it would in the database. `create` enforces the partial unique index
 * that keeps one live request per learner per question.
 */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function fakePrisma(
  attempts: Record<string, string[]> = {},
  blockedPairs: ReadonlySet<string> = new Set(),
  verifiedAttempts: Record<string, string[]> = attempts,
  profileQualified: ReadonlySet<string> = new Set()
) {
  const rows: Row[] = [];
  const sessions: SessionRow[] = [];
  const declines: Array<{ requestId: string; helperId: string }> = [];
  let nextId = 1;

  function matches(row: Row, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([field, condition]) => {
      const value = row[field as keyof Row];
      if (condition && typeof condition === "object" && !(condition instanceof Date)) {
        const clause = condition as { in?: unknown[]; lte?: Date; gt?: Date };
        if (clause.in) return clause.in.includes(value);
        if (clause.lte) return value instanceof Date && value <= clause.lte;
        if (clause.gt) return value instanceof Date && value > clause.gt;
      }
      return value === condition;
    });
  }

  const helpRequest = {
    async create({
      data
    }: {
      data: Omit<
        Row,
        | "id"
        | "status"
        | "summary"
        | "helperId"
        | "claimedAt"
        | "resolvedAt"
        | "closedAt"
        | "createdAt"
        | "updatedAt"
      >;
    }) {
      const live = rows.find(
        (row) =>
          row.learnerId === data.learnerId &&
          row.questionSlug === data.questionSlug &&
          LIVE.includes(row.status)
      );

      if (live) {
        throw new Prisma.PrismaClientKnownRequestError("unique violation", {
          code: "P2002",
          clientVersion: "test"
        });
      }

      const now = new Date();
      const row: Row = {
        id: `req-${nextId++}`,
        status: HelpRequestStatus.OPEN,
        summary: null,
        helperId: null,
        claimedAt: null,
        resolvedAt: null,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
        ...data
      };
      rows.push(row);
      return { ...row };
    },

    async updateMany({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) {
      const hits = rows.filter((row) => matches(row, where));
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    },

    async update({ where, data }: { where: { id: string }; data: Partial<Row> }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("missing request");
      Object.assign(row, data);
      return { ...row };
    },

    async findUnique({ where }: { where: { id: string } }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      return row ? { ...row } : null;
    },

    async findFirst({ where }: { where: Record<string, unknown> }) {
      const row = rows.find((candidate) => {
        const { OR, ...required } = where;
        if (!matches(candidate, required)) return false;
        if (!Array.isArray(OR)) return true;
        return OR.some((clause) => matches(candidate, clause as Record<string, unknown>));
      });
      return row ? { ...row } : null;
    },

    async findMany({ where, take }: { where: Record<string, unknown>; take?: number }) {
      const hits = rows.filter((row) => {
        return Object.entries(where).every(([field, condition]) => {
          if (field === "declines") {
            const helperId = (condition as { none: { helperId: string } }).none.helperId;
            return !declines.some(
              (decline) => decline.requestId === row.id && decline.helperId === helperId
            );
          }
          const value = row[field as keyof Row];
          if (condition && typeof condition === "object" && !(condition instanceof Date)) {
            const clause = condition as {
              in?: unknown[];
              not?: unknown;
              notIn?: unknown[];
              lte?: Date;
              gt?: Date;
            };
            if (clause.in) return clause.in.includes(value);
            if (clause.notIn) return !clause.notIn.includes(value);
            if ("not" in clause) return value !== clause.not;
            if (clause.lte) return value instanceof Date && value <= clause.lte;
            if (clause.gt) return value instanceof Date && value > clause.gt;
          }
          return value === condition;
        });
      });
      const limited = take === undefined ? hits : hits.slice(0, take);
      return limited.map((row) => ({ ...row }));
    }
  };

  const helpSession = {
    async findUnique({ where }: { where: { requestId: string } }) {
      const row = sessions.find((candidate) => candidate.requestId === where.requestId);
      return row ? { ...row } : null;
    },
    async updateMany({
      where,
      data
    }: {
      where: { requestId: string; endedAt?: null };
      data: Partial<SessionRow>;
    }) {
      const hits = sessions.filter(
        (row) =>
          row.requestId === where.requestId &&
          (!("endedAt" in where) || row.endedAt === where.endedAt)
      );
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    }
  };

  const userQuestionAttempt = {
    async findFirst({
      where
    }: {
      where: { ownerId: string; dsaQuestionSlug: string; status: string };
    }) {
      const source = where.status === "SUBMITTED" ? verifiedAttempts : attempts;
      return (source[where.ownerId] ?? []).includes(where.dsaQuestionSlug)
        ? { id: `attempt-${where.ownerId}-${where.dsaQuestionSlug}` }
        : null;
    },
    async findMany({ where }: { where: { ownerId: string; status: string } }) {
      const source = where.status === "SUBMITTED" ? verifiedAttempts : attempts;
      return (source[where.ownerId] ?? []).map((slug) => ({
        dsaQuestionSlug: slug,
        language: where.status === "SUBMITTED" ? "java" : null,
        score: where.status === "SUBMITTED" ? 1 : null
      }));
    }
  };

  const helpRequestDecline = {
    async upsert({
      where
    }: {
      where: { requestId_helperId: { requestId: string; helperId: string } };
    }) {
      const value = where.requestId_helperId;
      const existing = declines.find(
        (decline) => decline.requestId === value.requestId && decline.helperId === value.helperId
      );
      if (!existing) declines.push({ ...value });
      return existing ?? value;
    }
  };

  async function $executeRaw(_query: TemplateStringsArray, ...values: unknown[]) {
    const helperId = values[0] as string;
    const requestId = values[1] as string;
    const row = rows.find((candidate) => candidate.id === requestId);

    if (
      !row ||
      row.status !== HelpRequestStatus.OPEN ||
      row.expiresAt <= new Date() ||
      row.learnerId === helperId ||
      (!(attempts[helperId] ?? []).includes(row.questionSlug) &&
        !profileQualified.has(helperId)) ||
      rows.some(
        (candidate) =>
          candidate.id !== row.id &&
          ((candidate.helperId === helperId && candidate.status === HelpRequestStatus.CLAIMED) ||
            (candidate.learnerId === helperId && LIVE.includes(candidate.status)))
      ) ||
      blockedPairs.has(pairKey(row.learnerId, helperId))
    ) {
      return 0;
    }

    row.status = HelpRequestStatus.CLAIMED;
    row.helperId = helperId;
    row.claimedAt = new Date();
    return 1;
  }

  async function $queryRaw(query: TemplateStringsArray, ...values: unknown[]) {
    if (query.join("").includes("FOR UPDATE")) {
      const requestId = values[0] as string;
      const row = rows.find((candidate) => candidate.id === requestId);
      return row ? [{ ...row }] : [];
    }

    const now = values[0] as Date;
    const expired = rows.filter(
      (row) => row.status === HelpRequestStatus.OPEN && row.expiresAt <= now
    );

    for (const row of expired) {
      row.status = HelpRequestStatus.EXPIRED;
      row.closedAt = now;
    }

    return expired.map(({ id, learnerId, questionSlug }) => ({ id, learnerId, questionSlug }));
  }

  const transactionClient = {
    helpRequest,
    helpRequestDecline,
    helpSession,
    userQuestionAttempt,
    $executeRaw,
    $queryRaw
  };

  async function $transaction<T>(operation: (transaction: typeof transactionClient) => Promise<T>) {
    return operation(transactionClient);
  }

  return {
    prisma: {
      ...transactionClient,
      $transaction
    } as unknown as PrismaService,
    rows,
    sessions,
    attempts,
    declines
  };
}

const context: HelpRequestContext = {
  code: "function lruGet(key) {}",
  testOutput: "2 of 5 failing",
  failingTests: 2,
  hintsUsed: 3,
  timeSpentMs: 18 * 60 * 1000
};

const DEFAULT_ATTEMPTS = {
  "helper-1": ["lru-cache", "two-sum"],
  "helper-2": ["lru-cache", "two-sum"]
};

function serviceUnderTest(
  attempts: Record<string, string[]> = DEFAULT_ATTEMPTS,
  blockedPairs: Array<[string, string]> = [],
  verifiedAttempts: Record<string, string[]> = attempts,
  profileQualifiedIds: string[] = []
) {
  const blocked = new Set(blockedPairs.map(([a, b]) => pairKey(a, b)));
  const profileQualified = new Set(profileQualifiedIds);
  const { prisma, rows, sessions, declines } = fakePrisma(
    attempts,
    blocked,
    verifiedAttempts,
    profileQualified
  );

  const evidenceScore = (helperId: string, slug: string, language: string): number => {
    const exact = (attempts[helperId] ?? []).includes(slug);
    if (exact) return language === "java" ? 1 : 0.95;
    return profileQualified.has(helperId) ? 0.7 : 0;
  };

  return {
    service: new HelpRequestService(
      prisma,
      {
        isBlocked: async (a, b) => blocked.has(pairKey(a, b))
      },
      {
        score: async (helperId, slug, language) => evidenceScore(helperId, slug, language),
        scoresForRequests: async (helperId, requests) =>
          new Map(
            requests.map((request) => [
              request.id,
              evidenceScore(helperId, request.questionSlug, request.language)
            ])
          )
      }
    ),
    rows,
    sessions,
    declines
  };
}

async function openRequest(service: HelpRequestService, learnerId = "learner-1") {
  return service.open({ learnerId, questionSlug: "lru-cache", language: "java", context });
}

describe("help request lifecycle", () => {
  it("opens a request in the OPEN state with an expiry", async () => {
    const { service } = serviceUnderTest();
    const openedAt = Date.now();
    const request = await openRequest(service);

    expect(request.status).toBe(HelpRequestStatus.OPEN);
    expect(request.helperId).toBeNull();
    expect(request.expiresAt.getTime()).toBeGreaterThanOrEqual(openedAt + DEFAULT_TTL_MS);
    expect(request.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + DEFAULT_TTL_MS);
  });

  it("refuses a second live request for the same learner and question", async () => {
    const { service } = serviceUnderTest();
    await openRequest(service);

    await expect(openRequest(service)).rejects.toMatchObject({ reason: "ENGAGEMENT_ACTIVE" });
  });

  it("refuses another question while the learner is already waiting", async () => {
    const { service } = serviceUnderTest();
    await openRequest(service);

    await expect(
      service.open({
        learnerId: "learner-1",
        questionSlug: "two-sum",
        language: "java",
        context
      })
    ).rejects.toMatchObject({ reason: "ENGAGEMENT_ACTIVE" });
  });

  it("refuses an own request while the person is already helping", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service, "learner-1");
    await service.claim(request.id, "helper-1");

    await expect(
      service.open({
        learnerId: "helper-1",
        questionSlug: "two-sum",
        language: "java",
        context
      })
    ).rejects.toMatchObject({ reason: "ENGAGEMENT_ACTIVE" });
  });

  it("lets the learner ask again once the previous request is resolved", async () => {
    const { service } = serviceUnderTest();
    const first = await openRequest(service);
    await service.claim(first.id, "helper-1");
    await service.resolve(first.id, "helper-1");

    await expect(openRequest(service)).resolves.toMatchObject({
      status: HelpRequestStatus.OPEN
    });
  });

  it("lets the learner ask again when the previous ten-minute window elapsed", async () => {
    const { service, rows } = serviceUnderTest();
    const first = await openRequest(service);
    rows[0]!.expiresAt = new Date(Date.now() - 1);

    await expect(openRequest(service)).resolves.toMatchObject({ status: HelpRequestStatus.OPEN });
    await expect(service.byId(first.id)).resolves.toMatchObject({
      status: HelpRequestStatus.EXPIRED
    });
  });

  it("gives the request to exactly one of two simultaneous helpers", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);

    const results = await Promise.allSettled([
      service.claim(request.id, "helper-1"),
      service.claim(request.id, "helper-2")
    ]);

    const claimed = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(claimed).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(HelpRequestError);
    expect((rejected[0] as PromiseRejectedResult).reason.reason).toBe("ALREADY_CLAIMED");

    // And the winner is the one recorded, not whoever wrote last.
    const stored = await service.byId(request.id);
    expect(["helper-1", "helper-2"]).toContain(stored.helperId);
    expect(stored.status).toBe(HelpRequestStatus.CLAIMED);
  });

  it("refuses to let a learner claim their own request", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);

    await expect(service.claim(request.id, "learner-1")).rejects.toMatchObject({
      reason: "SELF_HELP"
    });
  });

  it("refuses somebody with neither question evidence nor a strong profile", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["two-sum"] });
    const request = await openRequest(service);

    await expect(service.claim(request.id, "helper-1")).rejects.toMatchObject({
      reason: "NOT_QUALIFIED"
    });
  });

  it("allows a strong relevant profile without an exact Trailgrad completion", async () => {
    const { service } = serviceUnderTest({}, [], {}, ["helper-1"]);
    const request = await openRequest(service);

    await expect(service.claim(request.id, "helper-1")).resolves.toMatchObject({
      status: HelpRequestStatus.CLAIMED,
      helperId: "helper-1"
    });
  });

  it("allows an exact completion without a separate eligibility score", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"] }, [], {});
    const request = await openRequest(service);

    await expect(service.claim(request.id, "helper-1")).resolves.toMatchObject({
      status: HelpRequestStatus.CLAIMED,
      helperId: "helper-1"
    });
  });

  it("lets one helper carry only one claimed request at a time", async () => {
    const { service } = serviceUnderTest();
    const first = await openRequest(service, "learner-1");
    const second = await openRequest(service, "learner-2");

    await service.claim(first.id, "helper-1");
    await expect(service.claim(second.id, "helper-1")).rejects.toMatchObject({
      reason: "HELPER_UNAVAILABLE"
    });
  });

  it("does not let someone take a request while waiting for help themselves", async () => {
    const { service } = serviceUnderTest();
    await openRequest(service, "helper-1");
    const learnerRequest = await service.open({
      learnerId: "learner-1",
      questionSlug: "two-sum",
      language: "java",
      context
    });

    await expect(service.claim(learnerRequest.id, "helper-1")).rejects.toMatchObject({
      reason: "HELPER_UNAVAILABLE"
    });
  });

  it("refuses a claim when either party blocked the other", async () => {
    const { service } = serviceUnderTest(DEFAULT_ATTEMPTS, [["helper-1", "learner-1"]]);
    const request = await openRequest(service);

    await expect(service.claim(request.id, "helper-1")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
    await expect(service.byId(request.id)).resolves.toMatchObject({
      status: HelpRequestStatus.OPEN,
      helperId: null
    });
  });

  it("expires an overdue request instead of allowing it to be claimed", async () => {
    const { service, rows } = serviceUnderTest();
    const request = await openRequest(service);
    rows[0]!.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.claim(request.id, "helper-1")).rejects.toMatchObject({
      reason: "REQUEST_EXPIRED"
    });
    await expect(service.byId(request.id)).resolves.toMatchObject({
      status: HelpRequestStatus.EXPIRED
    });
  });

  it("returns a released request to the pool for another helper", async () => {
    const { service, declines } = serviceUnderTest();
    const request = await openRequest(service);
    await service.claim(request.id, "helper-1");

    const released = await service.release(request.id, "helper-1");
    expect(released.status).toBe(HelpRequestStatus.OPEN);
    expect(released.helperId).toBeNull();
    expect(declines).toEqual([{ requestId: request.id, helperId: "helper-1" }]);
    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);

    await expect(service.claim(request.id, "helper-2")).resolves.toMatchObject({
      helperId: "helper-2"
    });
  });

  it("refuses to hand back a request after its room has been created", async () => {
    const { service, sessions } = serviceUnderTest();
    const request = await openRequest(service);
    await service.claim(request.id, "helper-1");
    sessions.push({
      id: "session-1",
      requestId: request.id,
      endedAt: null,
      endedReason: null
    });

    await expect(service.release(request.id, "helper-1")).rejects.toMatchObject({
      reason: "SESSION_ALREADY_STARTED"
    });
    await expect(service.byId(request.id)).resolves.toMatchObject({
      status: HelpRequestStatus.CLAIMED,
      helperId: "helper-1"
    });
  });

  it("resolves the request and active room in the same lifecycle action", async () => {
    const { service, sessions } = serviceUnderTest();
    const request = await openRequest(service);
    await service.claim(request.id, "helper-1");
    sessions.push({
      id: "session-1",
      requestId: request.id,
      endedAt: null,
      endedReason: null
    });

    await expect(service.resolve(request.id, "helper-1")).resolves.toMatchObject({
      status: HelpRequestStatus.RESOLVED
    });
    expect(sessions[0]!.endedAt).not.toBeNull();
    expect(sessions[0]!.endedReason).toBe("resolved");
  });

  it("cancels the request and active room together", async () => {
    const { service, sessions } = serviceUnderTest();
    const request = await openRequest(service);
    await service.claim(request.id, "helper-1");
    sessions.push({
      id: "session-1",
      requestId: request.id,
      endedAt: null,
      endedReason: null
    });

    await expect(service.cancel(request.id, "learner-1")).resolves.toMatchObject({
      status: HelpRequestStatus.CANCELLED
    });
    expect(sessions[0]!.endedAt).not.toBeNull();
    expect(sessions[0]!.endedReason).toBe("cancelled");
  });

  it("only lets the claiming helper release or resolve", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);
    await service.claim(request.id, "helper-1");

    await expect(service.resolve(request.id, "helper-2")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
    await expect(service.release(request.id, "helper-2")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
  });

  it("only lets the learner cancel", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);

    await expect(service.cancel(request.id, "helper-1")).rejects.toMatchObject({
      reason: "NOT_THE_LEARNER"
    });
    await expect(service.cancel(request.id, "learner-1")).resolves.toMatchObject({
      status: HelpRequestStatus.CANCELLED
    });
  });

  it("cannot resolve a request that was never claimed", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);

    await expect(service.resolve(request.id, "helper-1")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
  });

  it("expires unclaimed requests but leaves claimed ones running", async () => {
    const { service, rows } = serviceUnderTest();
    const stale = await openRequest(service, "learner-1");
    const claimed = await openRequest(service, "learner-2");
    await service.claim(claimed.id, "helper-1");

    // Both are past their window; only the unclaimed one should be retired.
    const past = new Date(Date.now() - 1000);
    for (const row of rows) row.expiresAt = past;

    await expect(service.expireStale()).resolves.toBe(1);
    await expect(service.byId(stale.id)).resolves.toMatchObject({
      status: HelpRequestStatus.EXPIRED
    });
    await expect(service.byId(claimed.id)).resolves.toMatchObject({
      status: HelpRequestStatus.CLAIMED
    });
  });

  it("refuses to move a request that already reached a terminal state", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);
    await service.cancel(request.id, "learner-1");

    await expect(service.claim(request.id, "helper-1")).rejects.toMatchObject({
      reason: "ALREADY_CLAIMED"
    });
    await expect(service.attachSummary(request.id, "late summary")).rejects.toMatchObject({
      reason: "ILLEGAL_TRANSITION"
    });
  });

  it("attaches a summary to a live request without changing its status", async () => {
    const { service } = serviceUnderTest();
    const request = await openRequest(service);

    const summarised = await service.attachSummary(request.id, "Stuck moving a node to MRU.");
    expect(summarised.summary).toBe("Stuck moving a node to MRU.");
    expect(summarised.status).toBe(HelpRequestStatus.OPEN);
  });

  it("finds a learner's live request and stops finding it once closed", async () => {
    const { service } = serviceUnderTest();
    await openRequest(service);

    await expect(service.liveForLearner("learner-1", "lru-cache")).resolves.not.toBeNull();

    const live = await service.liveForLearner("learner-1", "lru-cache");
    await service.cancel(live!.id, "learner-1");

    await expect(service.liveForLearner("learner-1", "lru-cache")).resolves.toBeNull();
  });

  it("retires an overdue learner request during the status check", async () => {
    const { service, rows } = serviceUnderTest();
    const request = await openRequest(service);
    rows[0]!.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.liveForLearner("learner-1", "lru-cache")).resolves.toBeNull();
    await expect(service.byId(request.id)).resolves.toMatchObject({
      status: HelpRequestStatus.EXPIRED
    });
  });

  it("reports NOT_FOUND for an unknown request", async () => {
    const { service } = serviceUnderTest();
    await expect(service.claim("missing", "helper-1")).rejects.toMatchObject({
      reason: "NOT_FOUND"
    });
  });
});

describe("helper inbox", () => {
  it("counts unique people the helper has helped", async () => {
    const { service } = serviceUnderTest();

    const first = await openRequest(service, "learner-1");
    await service.claim(first.id, "helper-1");
    await service.resolve(first.id, "helper-1");

    const samePersonAgain = await openRequest(service, "learner-1");
    await service.claim(samePersonAgain.id, "helper-1");
    await service.resolve(samePersonAgain.id, "helper-1");

    const secondPerson = await openRequest(service, "learner-2");
    await service.claim(secondPerson.id, "helper-1");
    await service.resolve(secondPerson.id, "helper-1");

    await expect(service.helpedPeopleCount("helper-1")).resolves.toBe(2);
  });

  it("offers only requests supported by the helper's evidence", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"] });
    await openRequest(service, "learner-1");
    await service.open({
      learnerId: "learner-2",
      questionSlug: "two-sum",
      language: "java",
      context
    });

    const inbox = await service.openRequestsForHelper("helper-1");
    expect(inbox.map((request) => request.questionSlug)).toEqual(["lru-cache"]);
  });

  it("never offers a helper their own request", async () => {
    const { service } = serviceUnderTest({ "learner-1": ["lru-cache"] });
    await openRequest(service, "learner-1");

    await expect(service.openRequestsForHelper("learner-1")).resolves.toEqual([]);
  });

  it("returns nothing for a helper who has completed nothing", async () => {
    const { service } = serviceUnderTest({});
    await openRequest(service, "learner-1");

    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
  });

  it("offers requests to a strong profile without an exact Trailgrad solve", async () => {
    const { service } = serviceUnderTest({}, [], {}, ["helper-1"]);
    await openRequest(service, "learner-1");

    await expect(service.openRequestsForHelper("helper-1")).resolves.toHaveLength(1);
  });

  it("offers a completed question without requiring another evidence lane", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"] }, [], {});
    await openRequest(service, "learner-1");

    await expect(service.openRequestsForHelper("helper-1")).resolves.toHaveLength(1);
  });

  it("puts requests in a verified language ahead of cross-language requests", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"] });
    const python = await service.open({
      learnerId: "learner-1",
      questionSlug: "lru-cache",
      language: "python",
      context
    });
    const java = await service.open({
      learnerId: "learner-2",
      questionSlug: "lru-cache",
      language: "java",
      context
    });

    const inbox = await service.openRequestsForHelper("helper-1");
    expect(inbox.map((request) => request.id)).toEqual([java.id, python.id]);
  });

  it("persists a decline for one helper without closing the learner's request", async () => {
    const { service, declines } = serviceUnderTest();
    const request = await openRequest(service, "learner-1");

    await expect(service.decline(request.id, "helper-1")).resolves.toMatchObject({
      status: HelpRequestStatus.OPEN
    });
    await expect(service.decline(request.id, "helper-1")).resolves.toMatchObject({
      status: HelpRequestStatus.OPEN
    });
    expect(declines).toEqual([{ requestId: request.id, helperId: "helper-1" }]);
    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
    await expect(service.openRequestsForHelper("helper-2")).resolves.toHaveLength(1);
  });

  it("does not show more requests while the helper is already helping", async () => {
    const { service } = serviceUnderTest();
    const first = await openRequest(service, "learner-1");
    await service.open({
      learnerId: "learner-2",
      questionSlug: "two-sum",
      language: "java",
      context
    });
    await service.claim(first.id, "helper-1");

    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
  });

  it("does not show requests while the helper is waiting for help themselves", async () => {
    const { service } = serviceUnderTest();
    await openRequest(service, "helper-1");
    await service.open({
      learnerId: "learner-1",
      questionSlug: "two-sum",
      language: "java",
      context
    });

    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
  });

  it("does not offer an overdue open request", async () => {
    const { service, rows } = serviceUnderTest({ "helper-1": ["lru-cache"] });
    await openRequest(service, "learner-1");
    rows[0]!.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
  });

  it("drops a request from the pool once it is claimed", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"], "helper-2": ["lru-cache"] });
    const request = await openRequest(service, "learner-1");

    await service.claim(request.id, "helper-1");

    // Gone from everyone else's inbox, and in the claimer's own list.
    await expect(service.openRequestsForHelper("helper-2")).resolves.toEqual([]);
    const mine = await service.claimedByHelper("helper-1");
    expect(mine.map((entry) => entry.id)).toEqual([request.id]);
  });

  it("returns a released request to the pool", async () => {
    const { service } = serviceUnderTest({ "helper-1": ["lru-cache"], "helper-2": ["lru-cache"] });
    const request = await openRequest(service, "learner-1");
    await service.claim(request.id, "helper-1");
    await service.release(request.id, "helper-1");

    await expect(service.openRequestsForHelper("helper-2")).resolves.toHaveLength(1);
    await expect(service.openRequestsForHelper("helper-1")).resolves.toEqual([]);
    await expect(service.claimedByHelper("helper-1")).resolves.toEqual([]);
  });
});

describe("expiry sweep", () => {
  it("reports who to tell, so expiry is never silent", async () => {
    const { service, rows } = serviceUnderTest();
    const stale = await openRequest(service, "learner-1");
    for (const row of rows) row.expiresAt = new Date(Date.now() - 1_000);

    const expired = await service.expireStaleAndReport();
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ id: stale.id, learnerId: "learner-1" });
  });

  it("reports each request once, so a second sweep notifies nobody", async () => {
    const { service, rows } = serviceUnderTest();
    await openRequest(service, "learner-1");
    for (const row of rows) row.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.expireStaleAndReport()).resolves.toHaveLength(1);
    await expect(service.expireStaleAndReport()).resolves.toEqual([]);
  });

  it("leaves a claimed request alone even when it is past its window", async () => {
    const { service, rows } = serviceUnderTest();
    const request = await openRequest(service, "learner-1");
    await service.claim(request.id, "helper-1");
    for (const row of rows) row.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.expireStaleAndReport()).resolves.toEqual([]);
  });
});

describe("help request transitions", () => {
  it("treats RESOLVED, EXPIRED and CANCELLED as terminal", () => {
    expect(isTerminal(HelpRequestStatus.RESOLVED)).toBe(true);
    expect(isTerminal(HelpRequestStatus.EXPIRED)).toBe(true);
    expect(isTerminal(HelpRequestStatus.CANCELLED)).toBe(true);
    expect(isTerminal(HelpRequestStatus.OPEN)).toBe(false);
    expect(isTerminal(HelpRequestStatus.CLAIMED)).toBe(false);
  });

  it("allows a claimed request back to open but never a resolved one", () => {
    expect(canTransition(HelpRequestStatus.CLAIMED, HelpRequestStatus.OPEN)).toBe(true);
    expect(canTransition(HelpRequestStatus.RESOLVED, HelpRequestStatus.OPEN)).toBe(false);
    expect(canTransition(HelpRequestStatus.OPEN, HelpRequestStatus.RESOLVED)).toBe(false);
  });
});

describe("context snapshot", () => {
  it("caps code and test output so one paste cannot bloat the row", () => {
    const clamped = clampContext({
      ...context,
      code: "x".repeat(CODE_LIMIT + 5_000),
      testOutput: "y".repeat(10_000)
    });

    expect(clamped.code).toHaveLength(CODE_LIMIT);
    expect(clamped.testOutput).toHaveLength(4_000);
  });

  it("keeps a null test output null rather than turning it into an empty string", () => {
    expect(clampContext({ ...context, testOutput: null }).testOutput).toBeNull();
  });
});
