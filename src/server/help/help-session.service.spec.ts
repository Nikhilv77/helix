import { Prisma } from "@prisma/client";

import { HelpSessionService, SESSION_CAP_MS } from "./help-session.service";
import { HelpRequestStatus } from "./help-request.types";
import type { PrismaService } from "../database/prisma.service";

interface RequestRow {
  id: string;
  status: HelpRequestStatus;
  learnerId: string;
  helperId: string | null;
  questionSlug: string;
}

interface SessionRow {
  id: string;
  requestId: string;
  roomName: string;
  startedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  learnerJoinedAt: Date | null;
  helperJoinedAt: Date | null;
  learnerRating: number | null;
  learnerRatingSkippedAt: Date | null;
}

function fakePrisma(seedRequests: RequestRow[]) {
  const requests = seedRequests.map((request) => ({ ...request }));
  const sessions: SessionRow[] = [];
  let next = 1;

  const helpRequest = {
    async findUnique({ where }: { where: { id: string } }) {
      const row = requests.find((request) => request.id === where.id);
      return row ? { ...row } : null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<RequestRow> }) {
      const row = requests.find((request) => request.id === where.id);
      if (!row) throw new Error("missing request");
      Object.assign(row, data);
      return { ...row };
    }
  };

  const helpSession = {
    async findUnique({ where }: { where: { requestId: string } }) {
      const row = sessions.find((session) => session.requestId === where.requestId);
      return row ? { ...row } : null;
    },
    async create({ data }: { data: { requestId: string; roomName: string } }) {
      if (sessions.some((session) => session.requestId === data.requestId)) {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test"
        });
      }
      const row: SessionRow = {
        id: `s-${next++}`,
        startedAt: new Date(),
        endedAt: null,
        endedReason: null,
        learnerJoinedAt: null,
        helperJoinedAt: null,
        learnerRating: null,
        learnerRatingSkippedAt: null,
        ...data
      };
      sessions.push(row);
      return { ...row };
    },
    async updateMany({
      where,
      data
    }: {
      where: Record<string, unknown>;
      data: Partial<SessionRow>;
    }) {
      const hits = sessions.filter((session) =>
        Object.entries(where).every(([field, value]) => {
          const current = session[field as keyof SessionRow];
          if (value && typeof value === "object" && "not" in value) {
            return current !== (value as { not: unknown }).not;
          }
          if (value && typeof value === "object" && "in" in value) {
            return (value as { in: unknown[] }).in.includes(current);
          }
          return value === null ? current === null : current === value;
        })
      );
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    },
    async update({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) {
      const row = sessions.find((session) => session.id === where.id);
      if (!row) throw new Error("missing session");
      Object.assign(row, data);
      return { ...row };
    },
    async findFirst({
      where
    }: {
      where: {
        endedAt: { not: null };
        endedReason: { in: string[] };
        learnerJoinedAt: { not: null };
        helperJoinedAt: { not: null };
        request: { is: { learnerId: string; questionSlug: string } };
      };
    }) {
      const row = sessions
        .filter((session) => {
          const request = requests.find((candidate) => candidate.id === session.requestId);
          return (
            session.endedAt !== null &&
            where.endedReason.in.includes(session.endedReason ?? "") &&
            session.learnerJoinedAt !== null &&
            session.helperJoinedAt !== null &&
            request?.learnerId === where.request.is.learnerId &&
            request.questionSlug === where.request.is.questionSlug
          );
        })
        .sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0))[0];
      return row
        ? {
            requestId: row.requestId,
            learnerRating: row.learnerRating,
            learnerRatingSkippedAt: row.learnerRatingSkippedAt
          }
        : null;
    }
  };

  async function $queryRaw(_query: TemplateStringsArray, ...values: unknown[]) {
    const row = requests.find((request) => request.id === values[0]);
    return row ? [{ ...row }] : [];
  }

  const transactionClient = { helpRequest, helpSession, $queryRaw };
  let transactionTail = Promise.resolve();
  async function $transaction<T>(operation: (transaction: typeof transactionClient) => Promise<T>) {
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation(transactionClient);
    } finally {
      release();
    }
  }

  return {
    prisma: {
      ...transactionClient,
      $transaction
    } as unknown as PrismaService,
    requests,
    sessions
  };
}

const claimed: RequestRow = {
  id: "req-1",
  status: HelpRequestStatus.CLAIMED,
  learnerId: "learner-1",
  helperId: "helper-1",
  questionSlug: "lru-cache"
};

describe("joining a help call", () => {
  it("seats the learner and the helper, and nobody else", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);

    await expect(service.join("req-1", "learner-1")).resolves.toMatchObject({ seat: "learner" });
    await expect(service.join("req-1", "helper-1")).resolves.toMatchObject({ seat: "helper" });
    await expect(service.join("req-1", "stranger")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
  });

  it("puts both parties in the same room", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);

    const first = await service.join("req-1", "learner-1");
    const second = await service.join("req-1", "helper-1");

    expect(first.session.roomName).toBe(second.session.roomName);
    expect(sessions).toHaveLength(1);
  });

  it("mints exactly one room when both join at the same instant", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);

    // The loser of the create race must read the winner's row, not end up alone
    // in a second room.
    const [a, b] = await Promise.all([
      service.join("req-1", "learner-1"),
      service.join("req-1", "helper-1")
    ]);

    expect(sessions).toHaveLength(1);
    expect(a.session.roomName).toBe(b.session.roomName);
  });

  it("refuses a request that is not claimed", async () => {
    for (const status of [
      HelpRequestStatus.OPEN,
      HelpRequestStatus.RESOLVED,
      HelpRequestStatus.CANCELLED,
      HelpRequestStatus.EXPIRED
    ]) {
      const { prisma } = fakePrisma([{ ...claimed, status }]);
      await expect(new HelpSessionService(prisma).join("req-1", "learner-1")).rejects.toMatchObject(
        { reason: "ILLEGAL_TRANSITION" }
      );
    }
  });

  it("refuses an unknown request", async () => {
    const { prisma } = fakePrisma([]);
    await expect(new HelpSessionService(prisma).join("missing", "learner-1")).rejects.toMatchObject(
      { reason: "NOT_FOUND" }
    );
  });

  it("hands back time that shrinks toward the cap", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);

    const first = await service.join("req-1", "learner-1");
    expect(first.remainingMs).toBeLessThanOrEqual(SESSION_CAP_MS);
    expect(first.remainingMs).toBeGreaterThan(SESSION_CAP_MS - 5_000);

    sessions[0]!.startedAt = new Date(Date.now() - SESSION_CAP_MS / 2);
    const later = await service.join("req-1", "helper-1");
    expect(later.remainingMs).toBeLessThan(first.remainingMs);
  });

  it("closes a call that has run past the cap instead of extending it", async () => {
    const { prisma, requests, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    sessions[0]!.startedAt = new Date(Date.now() - SESSION_CAP_MS - 1_000);

    await expect(service.join("req-1", "helper-1")).rejects.toMatchObject({
      reason: "ILLEGAL_TRANSITION"
    });
    expect(sessions[0]!.endedAt).not.toBeNull();
    expect(sessions[0]!.endedReason).toBe("timeout");
    expect(requests[0]!.status).toBe(HelpRequestStatus.RESOLVED);
  });

  it("refuses to rejoin a call somebody already left", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.leave("req-1", "learner-1");

    await expect(service.join("req-1", "helper-1")).rejects.toMatchObject({
      reason: "ILLEGAL_TRANSITION"
    });
  });
});

describe("ending a call", () => {
  it("lets either participant leave but refuses a stranger", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.leave("req-1", "stranger")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
    await expect(service.leave("req-1", "helper-1")).resolves.toMatchObject({
      ended: true,
      resolved: true
    });
  });

  it("reports an unknown request before attempting to leave", async () => {
    const { prisma } = fakePrisma([]);

    await expect(
      new HelpSessionService(prisma).leave("missing", "learner-1")
    ).rejects.toMatchObject({ reason: "NOT_FOUND" });
  });

  it("is idempotent, so a second leave changes nothing", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.leave("req-1", "learner-1")).resolves.toMatchObject({ ended: true });
    await expect(service.leave("req-1", "learner-1")).resolves.toMatchObject({ ended: false });
  });

  it("leaves a request alone when its call never started", async () => {
    const { prisma } = fakePrisma([claimed]);
    await expect(new HelpSessionService(prisma).leave("req-1", "learner-1")).resolves.toMatchObject(
      { ended: false, resolved: false }
    );
  });

  it("terminates both the room and request after a safety action", async () => {
    const { prisma, requests, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.terminate("req-1", "learner-1", "reported")).resolves.toBe(true);
    expect(requests[0]!.status).toBe(HelpRequestStatus.CANCELLED);
    expect(sessions[0]!.endedAt).not.toBeNull();
    expect(sessions[0]!.endedReason).toBe("reported");
  });
});

describe("recording connected seats", () => {
  it("records each seat after connection and keeps reconnects idempotent", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.connected("req-1", "learner-1")).resolves.toBe(true);
    await expect(service.connected("req-1", "learner-1")).resolves.toBe(true);
    await expect(service.connected("req-1", "helper-1")).resolves.toBe(true);
    expect(sessions[0]!.learnerJoinedAt).not.toBeNull();
    expect(sessions[0]!.helperJoinedAt).not.toBeNull();
  });

  it("refuses a connection acknowledgement from a stranger", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.connected("req-1", "stranger")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
  });
});

describe("reconciling a call", () => {
  it("returns authoritative remaining time to either participant", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    sessions[0]!.startedAt = new Date(Date.now() - 5 * 60_000);

    await expect(service.status("req-1", "helper-1")).resolves.toMatchObject({
      active: true,
      ended: false,
      resolved: false
    });
    const status = await service.status("req-1", "learner-1");
    expect(status.remainingMs).toBeLessThanOrEqual(25 * 60_000);
    expect(status.remainingMs).toBeGreaterThan(25 * 60_000 - 5_000);
  });

  it("does not expose session state to a stranger", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    await expect(service.status("req-1", "stranger")).rejects.toMatchObject({
      reason: "NOT_THE_HELPER"
    });
  });

  it("closes and resolves a session when the server cap is reached", async () => {
    const { prisma, requests, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    sessions[0]!.startedAt = new Date(Date.now() - SESSION_CAP_MS - 1);

    await expect(service.status("req-1", "helper-1")).resolves.toMatchObject({
      active: false,
      ended: true,
      remainingMs: 0,
      resolved: true
    });
    expect(sessions[0]!.endedReason).toBe("timeout");
    expect(requests[0]!.status).toBe(HelpRequestStatus.RESOLVED);

    // A later poll observes the terminal state but does not redeliver its side effect.
    await expect(service.status("req-1", "learner-1")).resolves.toMatchObject({
      ended: true,
      resolved: false
    });
  });

  it("lets the other participant observe a completed leave", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.leave("req-1", "helper-1");

    await expect(service.status("req-1", "learner-1")).resolves.toMatchObject({
      active: false,
      ended: true,
      remainingMs: 0
    });
  });
});

describe("rating", () => {
  it("accepts a rating from the learner only", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.connected("req-1", "learner-1");
    await service.connected("req-1", "helper-1");
    await service.leave("req-1", "learner-1");

    await expect(service.rate("req-1", "learner-1", 5)).resolves.toBe(true);
    // Rating the person who asked for help would attach a score to needing help.
    await expect(service.rate("req-1", "helper-1", 5)).rejects.toMatchObject({
      reason: "NOT_THE_LEARNER"
    });
  });

  it("does not accept a rating before the conversation ends or overwrite one", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.connected("req-1", "learner-1");
    await service.connected("req-1", "helper-1");

    await expect(service.rate("req-1", "learner-1", 4)).resolves.toBe(false);
    await service.leave("req-1", "learner-1");
    await expect(service.rate("req-1", "learner-1", 4)).resolves.toBe(true);
    await expect(service.rate("req-1", "learner-1", 2)).resolves.toBe(false);
  });

  it("rejects a rating outside one to five", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");

    for (const rating of [0, 6, 2.5, -1]) {
      await expect(service.rate("req-1", "learner-1", rating)).rejects.toMatchObject({
        reason: "ILLEGAL_TRANSITION"
      });
    }
  });

  it("persists skip and does not prompt or accept a rating afterward", async () => {
    const { prisma, sessions } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.connected("req-1", "learner-1");
    await service.connected("req-1", "helper-1");
    await service.leave("req-1", "helper-1");

    await expect(service.pendingRatingForLearner("learner-1", "lru-cache")).resolves.toEqual({
      requestId: "req-1"
    });
    await expect(service.skipRating("req-1", "learner-1")).resolves.toBe(true);
    expect(sessions[0]!.learnerRatingSkippedAt).not.toBeNull();
    await expect(service.pendingRatingForLearner("learner-1", "lru-cache")).resolves.toBeNull();
    await expect(service.rate("req-1", "learner-1", 5)).resolves.toBe(false);
  });

  it("never prompts for or accepts ratings after a safety termination", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.terminate("req-1", "learner-1", "reported");

    await expect(service.pendingRatingForLearner("learner-1", "lru-cache")).resolves.toBeNull();
    await expect(service.rate("req-1", "learner-1", 1)).resolves.toBe(false);
    await expect(service.skipRating("req-1", "learner-1")).resolves.toBe(false);
  });

  it("does not ask for feedback when only one seat ever connected", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.connected("req-1", "learner-1");
    await service.leave("req-1", "learner-1");

    await expect(service.pendingRatingForLearner("learner-1", "lru-cache")).resolves.toBeNull();
    await expect(service.rate("req-1", "learner-1", 5)).resolves.toBe(false);
  });

  it("lets only the learner skip their own rating", async () => {
    const { prisma } = fakePrisma([claimed]);
    const service = new HelpSessionService(prisma);
    await service.join("req-1", "learner-1");
    await service.connected("req-1", "learner-1");
    await service.connected("req-1", "helper-1");
    await service.leave("req-1", "learner-1");

    await expect(service.skipRating("req-1", "helper-1")).rejects.toMatchObject({
      reason: "NOT_THE_LEARNER"
    });
  });
});
