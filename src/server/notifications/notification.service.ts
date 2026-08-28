import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { DEFAULT_TTL_MS } from "../help/help-request.types";
import type { PrismaService } from "../database/prisma.service";

/**
 * Declared locally for the same reason as HelpRequestStatus: Prisma's generated
 * enums are runtime values, and Next's SSR bundle can resolve them to undefined
 * at module evaluation — which would break OPTIONAL_KINDS below on import.
 * Mirrors the enum in schema.prisma.
 */
export const NotificationKind = {
  TEACHER_WELCOME: "TEACHER_WELCOME",
  TEACHER_RECOMMENDATION: "TEACHER_RECOMMENDATION",
  TEACHER_ENCOURAGEMENT: "TEACHER_ENCOURAGEMENT",
  TEACHER_REMINDER: "TEACHER_REMINDER",
  HELP_REQUEST_OPENED: "HELP_REQUEST_OPENED",
  HELP_REQUEST_CLAIMED: "HELP_REQUEST_CLAIMED",
  HELP_REQUEST_RESOLVED: "HELP_REQUEST_RESOLVED",
  HELP_REQUEST_EXPIRED: "HELP_REQUEST_EXPIRED",
  HELP_FEEDBACK_RECEIVED: "HELP_FEEDBACK_RECEIVED"
} as const;

export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

/** Postgres unique violation, raised here by the dedupe index. */
const UNIQUE_VIOLATION = "P2002";

/** Nobody reads a hundred rows; the inbox shows a window and drops the rest. */
export const INBOX_PAGE_SIZE = 20;
export const MAX_EMAIL_ATTEMPTS = 4;
const EMAIL_LEASE_MS = 2 * 60_000;
const EMAIL_ERROR_LIMIT = 1_000;
const READ_BATCH_LIMIT = 50;
const EMAIL_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;

export interface DeliverInput {
  ownerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  /**
   * What produced this. With `kind` it makes redelivery idempotent, which is
   * what lets a retry, a replayed job, or a double-fired webhook be harmless.
   */
  subjectId?: string;
  /** Channel-specific copy. Persisted so a retry never rebuilds different mail. */
  email?: {
    subject: string;
    body: string;
    html?: string;
    fromName?: string;
  };
}

export interface DispatchRecord {
  notification: EmailDeliveryRecord;
  created: boolean;
}

export interface EmailDeliveryRecord {
  id: string;
  ownerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  subjectId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  emailHtml: string | null;
  emailFromName: string | null;
  emailAttempts: number;
  emailSentAt: Date | null;
}

export interface EmailDeliveryClaim {
  token: string;
  notification: EmailDeliveryRecord;
}

/**
 * Kinds a candidate can switch off. Anything absent here is transactional —
 * about something the candidate themselves did — and is always delivered.
 */
const OPTIONAL_KINDS: ReadonlySet<NotificationKind> = new Set([
  NotificationKind.TEACHER_RECOMMENDATION,
  NotificationKind.TEACHER_ENCOURAGEMENT,
  NotificationKind.TEACHER_REMINDER,
  NotificationKind.HELP_REQUEST_OPENED
]);

export function isOptional(kind: NotificationKind): boolean {
  return OPTIONAL_KINDS.has(kind);
}

/**
 * The inbox.
 *
 * Storage only — this decides *whether* somebody is told and records it, and
 * knows nothing about email, push, or any other transport. The dispatcher layers
 * those on top, so a delivery failure in one channel cannot lose the record.
 */
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a notification, honouring the recipient's opt-out.
   *
   * Returns null when the candidate has muted this kind or when the same
   * subject was already delivered — both are ordinary outcomes, not errors, so
   * callers can fire without checking first.
   */
  async deliver(input: DeliverInput) {
    const delivery = await this.record(input, false);
    return delivery?.created ? delivery.notification : null;
  }

  /**
   * Record for the multi-channel dispatcher.
   *
   * Unlike `deliver`, a duplicate returns its existing row. That distinction is
   * what permits a failed email to be retried without inserting another inbox
   * item. An opted-out recipient still returns null and is never contacted.
   */
  async recordForDispatch(input: DeliverInput, emailRequested: boolean) {
    return this.record(input, emailRequested);
  }

  private async record(
    input: DeliverInput,
    emailRequested: boolean
  ): Promise<DispatchRecord | null> {
    if (!(await this.recipientAllows(input))) return null;

    const requestedAt = emailRequested ? new Date() : null;

    try {
      const notification = await this.prisma.notification.create({
        data: {
          ownerId: input.ownerId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          href: input.href ?? null,
          subjectId: input.subjectId ?? null,
          emailRequestedAt: requestedAt,
          emailSubject: input.email?.subject ?? null,
          emailBody: input.email?.body ?? null,
          emailHtml: input.email?.html ?? null,
          emailFromName: input.email?.fromName ?? null
        }
      });
      return { notification, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        // The dedupe key includes subjectId. A null subject is intentionally
        // never deduped by Postgres, so there is no safe row to recover here.
        if (!input.subjectId) return null;

        const existing = await this.prisma.notification.findFirst({
          where: {
            ownerId: input.ownerId,
            kind: input.kind,
            subjectId: input.subjectId
          }
        });
        if (!existing) return null;

        if (emailRequested && !existing.emailRequestedAt) {
          await this.prisma.notification.updateMany({
            where: { id: existing.id, emailRequestedAt: null },
            data: { emailRequestedAt: requestedAt }
          });
          existing.emailRequestedAt = requestedAt;
        }

        return { notification: existing, created: false };
      }
      throw error;
    }
  }

  private async recipientAllows(input: DeliverInput): Promise<boolean> {
    return this.recipientAllowsKind(input.ownerId, input.kind);
  }

  /** Re-check immediately before an optional external delivery is attempted. */
  async recipientAllowsKind(ownerId: string, kind: NotificationKind): Promise<boolean> {
    if (!isOptional(kind)) return true;

    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { helpNotificationsEnabled: true, teacherNotificationsEnabled: true }
    });

    // Profiles can disappear while an enrichment job is still in flight.
    if (!profile) return false;
    return kind === NotificationKind.HELP_REQUEST_OPENED
      ? profile.helpNotificationsEnabled
      : profile.teacherNotificationsEnabled;
  }

  /** Pending ids are candidates only; `claimEmailDelivery` is the authority. */
  async dueEmailDeliveryIds(now = new Date(), limit = 20): Promise<string[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        emailRequestedAt: { not: null },
        emailSentAt: null,
        emailFailedAt: null,
        emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
        AND: [
          { OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: now } }] },
          { OR: [{ emailNextAttemptAt: null }, { emailNextAttemptAt: { lte: now } }] }
        ]
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: Math.min(Math.max(limit, 1), 50)
    });

    return rows.map((row) => row.id);
  }

  /**
   * Lease one email attempt. Conditional UPDATE means concurrent dispatchers
   * cannot both send it, even if they discovered the same due row.
   */
  async claimEmailDelivery(id: string, now = new Date()): Promise<EmailDeliveryClaim | null> {
    const token = randomUUID();
    const { count } = await this.prisma.notification.updateMany({
      where: {
        id,
        emailRequestedAt: { not: null },
        emailSentAt: null,
        emailFailedAt: null,
        emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
        AND: [
          { OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: now } }] },
          { OR: [{ emailNextAttemptAt: null }, { emailNextAttemptAt: { lte: now } }] }
        ]
      },
      data: {
        emailLeaseToken: token,
        emailLeaseUntil: new Date(now.getTime() + EMAIL_LEASE_MS),
        emailAttempts: { increment: 1 },
        emailLastError: null
      }
    });
    if (count === 0) return null;

    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) return null;
    return { token, notification };
  }

  /** Complete only the lease that performed the send; stale workers are ignored. */
  async completeEmailDelivery(
    claim: EmailDeliveryClaim,
    sent: boolean,
    error = "Email delivery failed",
    now = new Date()
  ): Promise<boolean> {
    const terminal = claim.notification.emailAttempts >= MAX_EMAIL_ATTEMPTS;
    const retryDelay = EMAIL_BACKOFF_MS[claim.notification.emailAttempts - 1] ?? null;
    const { count } = await this.prisma.notification.updateMany({
      where: { id: claim.notification.id, emailLeaseToken: claim.token },
      data: sent
        ? {
            emailSentAt: now,
            emailLeaseToken: null,
            emailLeaseUntil: null,
            emailNextAttemptAt: null,
            emailLastError: null
          }
        : {
            emailFailedAt: terminal ? now : null,
            emailNextAttemptAt:
              !terminal && retryDelay !== null ? new Date(now.getTime() + retryDelay) : null,
            emailLeaseToken: null,
            emailLeaseUntil: null,
            emailLastError: error.slice(0, EMAIL_ERROR_LIMIT)
          }
    });

    return count > 0;
  }

  /** Permanently release a leased email when the recipient has opted out. */
  async cancelEmailDelivery(
    claim: EmailDeliveryClaim,
    reason = "Recipient opted out",
    now = new Date()
  ): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: claim.notification.id, emailLeaseToken: claim.token },
      data: {
        emailFailedAt: now,
        emailNextAttemptAt: null,
        emailLeaseToken: null,
        emailLeaseUntil: null,
        emailLastError: reason.slice(0, EMAIL_ERROR_LIMIT)
      }
    });

    return count > 0;
  }

  /**
   * Unread first, then recent read history.
   *
   * Without nulls-first ordering, an inbox with more than one page can leave
   * old unread rows permanently hidden behind the same newest read rows.
   */
  async list(ownerId: string, limit = INBOX_PAGE_SIZE) {
    return this.prisma.notification.findMany({
      where: { ownerId },
      orderBy: [{ readAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: Math.min(limit, INBOX_PAGE_SIZE)
    });
  }

  async unreadCount(ownerId: string): Promise<number> {
    return this.prisma.notification.count({ where: { ownerId, readAt: null } });
  }

  /** Remove helper alerts once the ten-minute request window has passed. */
  async purgeExpiredHelpRequestNotifications(ownerId: string, now = new Date()): Promise<number> {
    const { count } = await this.prisma.notification.deleteMany({
      where: {
        ownerId,
        kind: NotificationKind.HELP_REQUEST_OPENED,
        createdAt: { lte: new Date(now.getTime() - DEFAULT_TTL_MS) }
      }
    });

    return count;
  }

  /**
   * Mark one notification read. Scoped by owner so an id from someone else's
   * inbox silently matches nothing rather than mutating their row.
   */
  async markRead(ownerId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, ownerId, readAt: null },
      data: { readAt: new Date() }
    });

    return count > 0;
  }

  /** Mark only rows actually rendered to this owner, never unseen pages. */
  async markManyRead(ownerId: string, ids: string[]): Promise<number> {
    const uniqueIds = [...new Set(ids)].slice(0, READ_BATCH_LIMIT);
    if (uniqueIds.length === 0) return 0;

    const { count } = await this.prisma.notification.updateMany({
      where: { id: { in: uniqueIds }, ownerId, readAt: null },
      data: { readAt: new Date() }
    });

    return count;
  }

  async markAllRead(ownerId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { ownerId, readAt: null },
      data: { readAt: new Date() }
    });

    return count;
  }

  /** Whether this candidate currently accepts requests to help other people. */
  async helpNotificationsEnabled(ownerId: string): Promise<boolean> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { helpNotificationsEnabled: true }
    });

    return profile?.helpNotificationsEnabled ?? false;
  }

  async teacherNotificationsEnabled(ownerId: string): Promise<boolean> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { teacherNotificationsEnabled: true }
    });

    return profile?.teacherNotificationsEnabled ?? false;
  }

  async setTeacherNotifications(ownerId: string, enabled: boolean): Promise<void> {
    await this.prisma.candidateProfile.updateMany({
      where: { ownerId },
      data: { teacherNotificationsEnabled: enabled }
    });
  }

  async setHelpNotifications(ownerId: string, enabled: boolean): Promise<void> {
    await this.prisma.candidateProfile.updateMany({
      where: { ownerId },
      data: { helpNotificationsEnabled: enabled }
    });

    if (!enabled) {
      const now = new Date();
      await this.prisma.notification.updateMany({
        where: {
          ownerId,
          kind: NotificationKind.HELP_REQUEST_OPENED,
          emailRequestedAt: { not: null },
          emailSentAt: null,
          emailFailedAt: null
        },
        data: {
          emailFailedAt: now,
          emailNextAttemptAt: null,
          emailLeaseToken: null,
          emailLeaseUntil: null,
          emailLastError: "Recipient opted out"
        }
      });
    }
  }
}
