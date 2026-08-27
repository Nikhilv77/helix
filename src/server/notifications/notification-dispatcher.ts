import { Logger } from "../common/logger";
import type { EmailChannel } from "./email-channel";
import {
  NotificationKind,
  isOptional,
  type DeliverInput,
  type NotificationService
} from "./notification.service";

export interface DispatchResult {
  /** False when the recipient had muted this kind, or it was a duplicate. */
  recorded: boolean;
  emailed: boolean;
}

/**
 * Kinds worth interrupting somebody's day for.
 *
 * A request to help is time-sensitive — a learner waiting six hours has moved
 * on — so it earns an email. The rest can wait until the recipient next opens
 * the app, and emailing them anyway is how an inbox becomes something people
 * filter out.
 */
const EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set([
  NotificationKind.TEACHER_WELCOME,
  NotificationKind.HELP_REQUEST_OPENED,
  NotificationKind.HELP_REQUEST_CLAIMED
]);

/**
 * Fans one notification out across the channels.
 *
 * Order is deliberate: the inbox row is written first and email only follows a
 * successful write. That way the durable record never depends on a third-party
 * API being up, and a notification the recipient was never emailed is still
 * waiting for them when they next visit.
 */
export class NotificationDispatcher {
  private readonly logger = new Logger("NotificationDispatcher");

  constructor(
    private readonly notifications: NotificationService,
    private readonly email: EmailChannel,
    /** Absolute origin, so links in email are not relative to nothing. */
    private readonly appOrigin?: string
  ) {}

  async dispatch(input: DeliverInput): Promise<DispatchResult> {
    const wantsEmail = EMAIL_KINDS.has(input.kind) && this.email.configured;
    const delivery = await this.notifications.recordForDispatch(input, wantsEmail);

    // Muted or a recipient/profile that no longer exists.
    if (!delivery) return { recorded: false, emailed: false };

    if (!wantsEmail) return { recorded: delivery.created, emailed: false };

    const emailed = await this.attemptEmail(delivery.notification.id);

    this.logger.log(
      JSON.stringify({
        event: "notification.dispatched",
        kind: input.kind,
        notificationId: delivery.notification.id,
        emailed
      })
    );

    return {
      recorded: delivery.created,
      // A replay after a successful send is idempotently "emailed" even though
      // this invocation correctly did not send another copy.
      emailed: emailed || delivery.notification.emailSentAt !== null
    };
  }

  /** Retry a bounded batch. Safe to call from many app instances at once. */
  async retryPending(limit = 10): Promise<{ attempted: number; emailed: number }> {
    const ids = await this.notifications.dueEmailDeliveryIds(new Date(), limit);
    const results = await Promise.all(ids.map((id) => this.attemptEmail(id)));
    return {
      attempted: results.filter((result) => result !== null).length,
      emailed: results.filter((result) => result === true).length
    };
  }

  private async attemptEmail(notificationId: string): Promise<boolean | null> {
    const claim = await this.notifications.claimEmailDelivery(notificationId);
    if (!claim) return null;

    const notification = claim.notification;
    if (!(await this.notifications.recipientAllowsKind(notification.ownerId, notification.kind))) {
      await this.notifications.cancelEmailDelivery(claim);
      return false;
    }

    const emailed = await this.email.send(notification.ownerId, {
      subject: notification.emailSubject ?? notification.title,
      // Resend retains the key across retries, covering the narrow crash window
      // after the provider accepted a send but before our SENT write committed.
      idempotencyKey: `notification/${notification.id}`,
      text: this.emailBody(
        {
          ownerId: notification.ownerId,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          href: notification.href ?? undefined,
          subjectId: notification.subjectId ?? undefined
        },
        notification.emailBody ?? notification.body
      )
    });

    await this.notifications.completeEmailDelivery(claim, emailed);
    return emailed;
  }

  private emailBody(input: DeliverInput, body = input.body): string {
    const link = input.href && this.appOrigin ? `${this.appOrigin}${input.href}` : null;

    return [
      body,
      link ? `\n${link}` : null,
      // Every optional kind has to carry its own way out, or the only lever a
      // recipient has left is marking the sender as spam.
      isOptional(input.kind) && this.appOrigin
        ? `\nNotification settings: ${this.appOrigin}/manage#notifications`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }
}
