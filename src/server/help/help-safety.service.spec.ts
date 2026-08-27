import { Prisma } from "@prisma/client";

import { HelpSafetyService, HelpReportReason, REPORT_DETAIL_LIMIT } from "./help-safety.service";
import { HelpRequestStatus } from "./help-request.types";
import type { PrismaService } from "../database/prisma.service";

interface BlockRow {
  id: string;
  ownerId: string;
  blockedId: string;
}

interface ReportRow {
  id: string;
  requestId: string;
  reporterId: string;
  reportedId: string;
  reason: HelpReportReason;
  detail: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

interface RequestRow {
  id: string;
  learnerId: string;
  helperId: string | null;
  status: HelpRequestStatus;
  closedAt: Date | null;
}

interface SessionRow {
  requestId: string;
  endedAt: Date | null;
  endedReason: string | null;
}

const request: RequestRow = {
  id: "req-1",
  learnerId: "learner-1",
  helperId: "helper-1",
  status: HelpRequestStatus.CLAIMED,
  closedAt: null
};

function fakePrisma(seedRequests: RequestRow[] = [request]) {
  const requests = seedRequests.map((row) => ({ ...row }));
  const blocks: BlockRow[] = [];
  const reports: ReportRow[] = [];
  const sessions: SessionRow[] = requests.map((row) => ({
    requestId: row.id,
    endedAt: null,
    endedReason: null
  }));
  let next = 1;

  const helpBlock = {
    async create({ data }: { data: { ownerId: string; blockedId: string } }) {
      if (blocks.some((b) => b.ownerId === data.ownerId && b.blockedId === data.blockedId)) {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test"
        });
      }
      const row = { id: `b-${next++}`, ...data };
      blocks.push(row);
      return row;
    },
    async deleteMany({ where }: { where: { ownerId: string; blockedId: string } }) {
      const before = blocks.length;
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i]!.ownerId === where.ownerId && blocks[i]!.blockedId === where.blockedId) {
          blocks.splice(i, 1);
        }
      }
      return { count: before - blocks.length };
    },
    async upsert({
      where,
      create
    }: {
      where: { ownerId_blockedId: { ownerId: string; blockedId: string } };
      create: { ownerId: string; blockedId: string };
    }) {
      const key = where.ownerId_blockedId;
      const existing = blocks.find(
        (row) => row.ownerId === key.ownerId && row.blockedId === key.blockedId
      );
      if (existing) return { ...existing };
      const row = { id: `b-${next++}`, ...create };
      blocks.push(row);
      return { ...row };
    },
    async findFirst({ where }: { where: { OR: Array<Record<string, string>> } }) {
      const hit = blocks.find((b) =>
        where.OR.some((clause) => b.ownerId === clause.ownerId && b.blockedId === clause.blockedId)
      );
      return hit ? { id: hit.id } : null;
    },
    async findMany({ where }: { where: { OR: Array<Record<string, string>> } }) {
      return blocks.filter((b) =>
        where.OR.some((clause) =>
          "ownerId" in clause ? b.ownerId === clause.ownerId : b.blockedId === clause.blockedId
        )
      );
    }
  };

  const helpRequest = {
    async findUnique({ where }: { where: { id: string } }) {
      const row = requests.find((r) => r.id === where.id);
      return row ? { learnerId: row.learnerId, helperId: row.helperId } : null;
    },
    async updateMany({ where, data }: { where: Partial<RequestRow>; data: Partial<RequestRow> }) {
      const hits = requests.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key as keyof RequestRow] === value)
      );
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    }
  };

  const helpReport = {
    async findUnique({
      where
    }: {
      where: { requestId_reporterId: { requestId: string; reporterId: string } };
    }) {
      const key = where.requestId_reporterId;
      const row = reports.find(
        (report) => report.requestId === key.requestId && report.reporterId === key.reporterId
      );
      return row ? { ...row } : null;
    },
    async create({ data }: { data: Omit<ReportRow, "id" | "createdAt" | "reviewedAt"> }) {
      const row: ReportRow = {
        id: `r-${next++}`,
        createdAt: new Date(),
        reviewedAt: null,
        ...data
      };
      reports.push(row);
      return { ...row };
    },
    async findMany({ take }: { take?: number }) {
      return reports.filter((r) => r.reviewedAt === null).slice(0, take);
    },
    async updateMany({ where, data }: { where: { id: string }; data: { reviewedAt: Date } }) {
      const hits = reports.filter((r) => r.id === where.id && r.reviewedAt === null);
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    }
  };

  const helpSession = {
    async updateMany({
      where,
      data
    }: {
      where: { requestId: string; endedAt: null };
      data: Partial<SessionRow>;
    }) {
      const hits = sessions.filter(
        (row) => row.requestId === where.requestId && row.endedAt === where.endedAt
      );
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    }
  };

  async function $queryRaw(_query: TemplateStringsArray, ...values: unknown[]) {
    const row = requests.find((candidate) => candidate.id === values[0]);
    return row ? [{ ...row }] : [];
  }

  const transactionClient = { helpBlock, helpRequest, helpReport, helpSession, $queryRaw };
  async function $transaction<T>(
    operation: (transaction: typeof transactionClient) => Promise<T>
  ): Promise<T> {
    return operation(transactionClient);
  }

  return {
    prisma: { ...transactionClient, $transaction } as unknown as PrismaService,
    requests,
    blocks,
    reports,
    sessions
  };
}

describe("blocking", () => {
  it("is symmetric — neither side can reach the other", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);
    await safety.block("learner-1", "helper-1");

    // The person who was blocked must be filtered too, or they could still
    // claim the blocker's requests and infer the block from the silence.
    await expect(safety.isBlocked("learner-1", "helper-1")).resolves.toBe(true);
    await expect(safety.isBlocked("helper-1", "learner-1")).resolves.toBe(true);
  });

  it("is idempotent", async () => {
    const { prisma, blocks } = fakePrisma();
    const safety = new HelpSafetyService(prisma);

    await safety.block("learner-1", "helper-1");
    await expect(safety.block("learner-1", "helper-1")).resolves.toBeUndefined();
    expect(blocks).toHaveLength(1);
  });

  it("refuses a self-block", async () => {
    const { prisma } = fakePrisma();
    await expect(
      new HelpSafetyService(prisma).block("learner-1", "learner-1")
    ).rejects.toMatchObject({ reason: "ILLEGAL_TRANSITION" });
  });

  it("lists everyone unreachable in either direction", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);
    await safety.block("me", "i-blocked-them");
    await safety.block("they-blocked-me", "me");

    const ids = await safety.blockedIds("me");
    expect(ids.sort()).toEqual(["i-blocked-them", "they-blocked-me"]);
  });

  it("clears on unblock", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);
    await safety.block("learner-1", "helper-1");
    await safety.unblock("learner-1", "helper-1");

    await expect(safety.isBlocked("learner-1", "helper-1")).resolves.toBe(false);
  });

  it("blocks a request counterparty and ends the interaction atomically", async () => {
    const { prisma, blocks, requests, sessions } = fakePrisma();
    const safety = new HelpSafetyService(prisma);

    await expect(safety.blockForRequest("req-1", "learner-1")).resolves.toEqual({
      blockedId: "helper-1"
    });
    expect(blocks).toHaveLength(1);
    expect(requests[0]!.status).toBe(HelpRequestStatus.CANCELLED);
    expect(sessions[0]!.endedReason).toBe("blocked");
  });

  it("reports nobody blocked when there are no blocks", async () => {
    const { prisma } = fakePrisma();
    await expect(new HelpSafetyService(prisma).blockedIds("someone")).resolves.toEqual([]);
  });
});

describe("reporting", () => {
  it("derives who was reported from the request, not the caller", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);

    const asLearner = await safety.report({
      requestId: "req-1",
      reporterId: "learner-1",
      reason: HelpReportReason.HARASSMENT
    });
    expect(asLearner.reportedId).toBe("helper-1");

    const { prisma: second } = fakePrisma();
    const asHelper = await new HelpSafetyService(second).report({
      requestId: "req-1",
      reporterId: "helper-1",
      reason: HelpReportReason.SPAM
    });
    expect(asHelper.reportedId).toBe("learner-1");
  });

  it("refuses a report from somebody who was not on the request", async () => {
    const { prisma } = fakePrisma();
    await expect(
      new HelpSafetyService(prisma).report({
        requestId: "req-1",
        reporterId: "bystander",
        reason: HelpReportReason.OTHER
      })
    ).rejects.toMatchObject({ reason: "NOT_THE_HELPER" });
  });

  it("refuses a report on a request with no counterparty yet", async () => {
    const { prisma } = fakePrisma([{ ...request, helperId: null as unknown as string }]);
    await expect(
      new HelpSafetyService(prisma).report({
        requestId: "req-1",
        reporterId: "learner-1",
        reason: HelpReportReason.OTHER
      })
    ).rejects.toMatchObject({ reason: "NOT_THE_HELPER" });
  });

  it("blocks as a side effect, so nobody has to act twice", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);

    await safety.report({
      requestId: "req-1",
      reporterId: "learner-1",
      reason: HelpReportReason.HARASSMENT
    });

    await expect(safety.isBlocked("learner-1", "helper-1")).resolves.toBe(true);
  });

  it("makes a retried report idempotent", async () => {
    const { prisma, reports } = fakePrisma();
    const safety = new HelpSafetyService(prisma);
    const input = {
      requestId: "req-1",
      reporterId: "learner-1",
      reason: HelpReportReason.HARASSMENT
    };

    const first = await safety.report(input);
    const retry = await safety.report(input);

    expect(retry.id).toBe(first.id);
    expect(reports).toHaveLength(1);
  });

  it("ends the active interaction when a report is filed", async () => {
    const { prisma, requests, sessions } = fakePrisma();

    await new HelpSafetyService(prisma).report({
      requestId: "req-1",
      reporterId: "helper-1",
      reason: HelpReportReason.SPAM
    });

    expect(requests[0]!.status).toBe(HelpRequestStatus.CANCELLED);
    expect(sessions[0]!.endedReason).toBe("reported");
  });

  it("caps an over-long detail rather than rejecting the report", async () => {
    const { prisma } = fakePrisma();
    const created = await new HelpSafetyService(prisma).report({
      requestId: "req-1",
      reporterId: "learner-1",
      reason: HelpReportReason.OTHER,
      detail: "x".repeat(REPORT_DETAIL_LIMIT + 500)
    });

    expect(created.detail).toHaveLength(REPORT_DETAIL_LIMIT);
  });

  it("queues reports for review, oldest first, and clears them once read", async () => {
    const { prisma } = fakePrisma();
    const safety = new HelpSafetyService(prisma);
    const filed = await safety.report({
      requestId: "req-1",
      reporterId: "learner-1",
      reason: HelpReportReason.OTHER
    });

    await expect(safety.pendingReports()).resolves.toHaveLength(1);
    await expect(safety.markReviewed(filed.id)).resolves.toBe(true);
    await expect(safety.markReviewed(filed.id)).resolves.toBe(false);
    await expect(safety.pendingReports()).resolves.toEqual([]);
  });

  it("refuses a report against an unknown request", async () => {
    const { prisma } = fakePrisma();
    await expect(
      new HelpSafetyService(prisma).report({
        requestId: "missing",
        reporterId: "learner-1",
        reason: HelpReportReason.OTHER
      })
    ).rejects.toMatchObject({ reason: "NOT_FOUND" });
  });
});
