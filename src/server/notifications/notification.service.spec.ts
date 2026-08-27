import { Prisma } from "@prisma/client";

import { NotificationKind, NotificationService, isOptional } from "./notification.service";
import type { PrismaService } from "../database/prisma.service";

interface Row {
  id: string;
  ownerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  subjectId: string | null;
  readAt: Date | null;
  emailRequestedAt: Date | null;
  emailAttempts: number;
  emailLeaseToken: string | null;
  emailLeaseUntil: Date | null;
  emailNextAttemptAt: Date | null;
  emailSentAt: Date | null;
  emailFailedAt: Date | null;
  emailLastError: string | null;
  createdAt: Date;
}

/**
 * Enough of Postgres to exercise the dedupe index and the owner-scoped writes.
 * `updateMany` filters before writing, as a conditional UPDATE does, so a
 * cross-owner id matches nothing here for the same reason it would live.
 */
type ProfilePreference =
  | boolean
  | { helpNotificationsEnabled: boolean; teacherNotificationsEnabled: boolean };

function fakePrisma(profiles: Record<string, ProfilePreference> = {}) {
  const rows: Row[] = [];
  let next = 1;

  function matches(row: Row, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([field, condition]) => {
      if (field === "AND") {
        return (condition as Array<Record<string, unknown>>).every((clause) =>
          matches(row, clause)
        );
      }
      if (field === "OR") {
        return (condition as Array<Record<string, unknown>>).some((clause) => matches(row, clause));
      }

      const value = row[field as keyof Row];
      if (condition === null) return value === null;
      if (condition && typeof condition === "object" && !(condition instanceof Date)) {
        const clause = condition as { in?: unknown[]; not?: unknown; lt?: number; lte?: Date };
        if (clause.in) return clause.in.includes(value);
        if ("not" in clause) return value !== clause.not;
        if (clause.lt !== undefined) return typeof value === "number" && value < clause.lt;
        if (clause.lte) return value instanceof Date && value <= clause.lte;
      }
      return value === condition;
    });
  }

  const notification = {
    async create({
      data
    }: {
      data: Pick<Row, "ownerId" | "kind" | "title" | "body" | "href" | "subjectId"> & {
        emailRequestedAt?: Date | null;
      };
    }) {
      const clash = rows.find(
        (row) =>
          row.ownerId === data.ownerId &&
          row.kind === data.kind &&
          row.subjectId !== null &&
          row.subjectId === data.subjectId
      );
      if (clash) {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test"
        });
      }
      const row: Row = {
        id: `n-${next++}`,
        readAt: null,
        emailRequestedAt: null,
        emailAttempts: 0,
        emailLeaseToken: null,
        emailLeaseUntil: null,
        emailNextAttemptAt: null,
        emailSentAt: null,
        emailFailedAt: null,
        emailLastError: null,
        createdAt: new Date(Date.now() + next),
        ...data
      };
      rows.push(row);
      return { ...row };
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    async findUnique({ where }: { where: { id: string } }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      return row ? { ...row } : null;
    },
    async findMany({ where, take }: { where?: Record<string, unknown>; take?: number }) {
      return [...rows]
        .filter((row) => !where || matches(row, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take)
        .map((row) => ({ ...row }));
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return rows.filter((row) => matches(row, where)).length;
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) {
      const hits = rows.filter((row) => matches(row, where));
      for (const row of hits) {
        for (const [field, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in value) {
            const key = field as keyof Row;
            (row[key] as number) += (value as { increment: number }).increment;
          } else {
            Object.assign(row, { [field]: value });
          }
        }
      }
      return { count: hits.length };
    }
  };

  const candidateProfile = {
    async findUnique({ where }: { where: { ownerId: string } }) {
      if (!(where.ownerId in profiles)) return null;
      const value = profiles[where.ownerId]!;
      return typeof value === "boolean"
        ? { helpNotificationsEnabled: value, teacherNotificationsEnabled: true }
        : { ...value };
    },
    async updateMany({
      where,
      data
    }: {
      where: { ownerId: string };
      data: Record<string, boolean>;
    }) {
      if (!(where.ownerId in profiles)) return { count: 0 };
      const value = profiles[where.ownerId]!;
      const current =
        typeof value === "boolean"
          ? { helpNotificationsEnabled: value, teacherNotificationsEnabled: true }
          : value;
      profiles[where.ownerId] = { ...current, ...data };
      return { count: 1 };
    }
  };

  return { prisma: { notification, candidateProfile } as unknown as PrismaService, rows, profiles };
}

const opened = {
  ownerId: "helper-1",
  kind: NotificationKind.HELP_REQUEST_OPENED,
  title: "Someone needs help with LRU Cache",
  body: "Reads are not affecting their eviction order.",
  href: "/dsa-questions/lru-cache",
  subjectId: "req-1"
};

describe("notification delivery", () => {
  it("records a notification for a candidate who accepts them", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    const created = await service.deliver(opened);
    expect(created).not.toBeNull();
    expect(created!.title).toContain("LRU Cache");
  });

  it("drops an optional notification for someone who opted out", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": false });
    const service = new NotificationService(prisma);

    await expect(service.deliver(opened)).resolves.toBeNull();
    expect(rows).toHaveLength(0);
  });

  it("still delivers transactional kinds to someone who opted out", async () => {
    // The opt-out covers being asked to help. It must not silence updates about
    // a request the candidate opened themselves.
    const { prisma } = fakePrisma({ "learner-1": false });
    const service = new NotificationService(prisma);

    const claimed = await service.deliver({
      ...opened,
      ownerId: "learner-1",
      kind: NotificationKind.HELP_REQUEST_CLAIMED
    });

    expect(claimed).not.toBeNull();
  });

  it("treats a repeat delivery of the same subject as a no-op", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    await service.deliver(opened);
    await expect(service.deliver(opened)).resolves.toBeNull();
    expect(rows).toHaveLength(1);
  });

  it("still allows a different kind about the same subject", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    await service.deliver(opened);
    await service.deliver({ ...opened, kind: NotificationKind.HELP_REQUEST_RESOLVED });
    expect(rows).toHaveLength(2);
  });

  it("does not throw for a recipient whose profile is gone", async () => {
    const { prisma } = fakePrisma({});
    await expect(new NotificationService(prisma).deliver(opened)).resolves.toBeNull();
  });

  it("recovers a duplicate row so a failed email can be retried", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    const first = await service.recordForDispatch(opened, true);
    const replay = await service.recordForDispatch(opened, true);

    expect(first).toMatchObject({ created: true });
    expect(replay).toMatchObject({ created: false });
    expect(replay!.notification.id).toBe(first!.notification.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.emailRequestedAt).not.toBeNull();
  });

  it("leases one sender and schedules a failed attempt for retry", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    const start = new Date("2026-08-26T00:00:00.000Z");
    const record = await service.recordForDispatch(opened, true);

    const claim = await service.claimEmailDelivery(record!.notification.id, start);
    expect(claim).not.toBeNull();
    await expect(service.claimEmailDelivery(record!.notification.id, start)).resolves.toBeNull();

    await service.completeEmailDelivery(claim!, false, "temporary", start);
    expect(rows[0]!.emailAttempts).toBe(1);
    expect(rows[0]!.emailLastError).toBe("temporary");
    await expect(service.dueEmailDeliveryIds(start)).resolves.toEqual([]);
    await expect(service.dueEmailDeliveryIds(new Date(start.getTime() + 60_001))).resolves.toEqual([
      record!.notification.id
    ]);
  });

  it("marks a successful leased delivery so it is never selected again", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    const now = new Date("2026-08-26T00:00:00.000Z");
    const record = await service.recordForDispatch(opened, true);
    const claim = await service.claimEmailDelivery(record!.notification.id, now);

    await service.completeEmailDelivery(claim!, true, "", now);
    expect(rows[0]!.emailSentAt).toEqual(now);
    await expect(
      service.dueEmailDeliveryIds(new Date(now.getTime() + 86_400_000))
    ).resolves.toEqual([]);
  });

  it("cancels a leased optional email after the recipient opts out", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    const record = await service.recordForDispatch(opened, true);
    const claim = await service.claimEmailDelivery(record!.notification.id);

    await expect(service.cancelEmailDelivery(claim!)).resolves.toBe(true);
    expect(rows[0]).toMatchObject({
      emailLeaseToken: null,
      emailFailedAt: expect.any(Date),
      emailLastError: "Recipient opted out"
    });
  });
});

describe("inbox", () => {
  it("counts only unread and clears them together", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    await service.deliver(opened);
    await service.deliver({ ...opened, subjectId: "req-2" });
    await expect(service.unreadCount("helper-1")).resolves.toBe(2);

    await expect(service.markAllRead("helper-1")).resolves.toBe(2);
    await expect(service.unreadCount("helper-1")).resolves.toBe(0);
  });

  it("refuses to mark a notification belonging to somebody else", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    const created = await service.deliver(opened);

    await expect(service.markRead("someone-else", created!.id)).resolves.toBe(false);
    await expect(service.unreadCount("helper-1")).resolves.toBe(1);
  });

  it("reports false when marking an already-read notification", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    const created = await service.deliver(opened);

    await expect(service.markRead("helper-1", created!.id)).resolves.toBe(true);
    await expect(service.markRead("helper-1", created!.id)).resolves.toBe(false);
  });

  it("marks only the visible owner-scoped ids in a batch", async () => {
    const { prisma } = fakePrisma({ "helper-1": true, "helper-2": true });
    const service = new NotificationService(prisma);
    const visible = await service.deliver(opened);
    await service.deliver({ ...opened, subjectId: "req-2" });
    const somebodyElses = await service.deliver({
      ...opened,
      ownerId: "helper-2",
      subjectId: "req-3"
    });

    await expect(
      service.markManyRead("helper-1", [visible!.id, somebodyElses!.id, visible!.id])
    ).resolves.toBe(1);
    await expect(service.unreadCount("helper-1")).resolves.toBe(1);
    await expect(service.unreadCount("helper-2")).resolves.toBe(1);
  });

  it("returns newest first", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    await service.deliver(opened);
    await service.deliver({ ...opened, subjectId: "req-2", title: "Newer" });

    const items = await service.list("helper-1");
    expect(items[0]!.title).toBe("Newer");
  });
});

describe("preferences", () => {
  it("round-trips the help opt-out", async () => {
    const { prisma } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);

    await service.setHelpNotifications("helper-1", false);
    await expect(service.helpNotificationsEnabled("helper-1")).resolves.toBe(false);

    await service.setHelpNotifications("helper-1", true);
    await expect(service.helpNotificationsEnabled("helper-1")).resolves.toBe(true);
  });

  it("round-trips teacher coaching independently from peer help", async () => {
    const { prisma } = fakePrisma({
      "helper-1": { helpNotificationsEnabled: true, teacherNotificationsEnabled: true }
    });
    const service = new NotificationService(prisma);

    await service.setTeacherNotifications("helper-1", false);
    await expect(service.teacherNotificationsEnabled("helper-1")).resolves.toBe(false);
    await expect(service.helpNotificationsEnabled("helper-1")).resolves.toBe(true);

    await expect(
      service.deliver({
        ...opened,
        kind: NotificationKind.TEACHER_RECOMMENDATION,
        subjectId: "2026-08-28:primary"
      })
    ).resolves.toBeNull();
  });

  it("cancels pending help-request email when the recipient opts out", async () => {
    const { prisma, rows } = fakePrisma({ "helper-1": true });
    const service = new NotificationService(prisma);
    await service.recordForDispatch(opened, true);

    await service.setHelpNotifications("helper-1", false);
    expect(rows[0]).toMatchObject({
      emailFailedAt: expect.any(Date),
      emailLastError: "Recipient opted out",
      emailLeaseToken: null
    });
  });

  it("classifies daily teacher coaching and being-asked-to-help as optional", () => {
    expect(isOptional(NotificationKind.TEACHER_RECOMMENDATION)).toBe(true);
    expect(isOptional(NotificationKind.TEACHER_REMINDER)).toBe(true);
    expect(isOptional(NotificationKind.TEACHER_WELCOME)).toBe(false);
    expect(isOptional(NotificationKind.HELP_REQUEST_OPENED)).toBe(true);
    expect(isOptional(NotificationKind.HELP_REQUEST_CLAIMED)).toBe(false);
    expect(isOptional(NotificationKind.HELP_REQUEST_RESOLVED)).toBe(false);
  });
});
