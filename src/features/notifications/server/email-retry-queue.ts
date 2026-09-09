import { send } from "@vercel/queue";

export const NOTIFICATION_EMAIL_RETRY_TOPIC = "notification-email-retry";

export interface EmailRetryMessage {
  version: 1;
  notificationId: string;
}

export interface EmailRetryScheduler {
  schedule(notificationId: string, nextAttempt: number, delayMs: number): Promise<void>;
}

/**
 * Publishes only the notification id. The persisted notification remains the
 * authority for content, recipient, consent, attempt count, and lease state.
 */
export class VercelEmailRetryScheduler implements EmailRetryScheduler {
  async schedule(notificationId: string, nextAttempt: number, delayMs: number): Promise<void> {
    await send<EmailRetryMessage>(
      NOTIFICATION_EMAIL_RETRY_TOPIC,
      { version: 1, notificationId },
      {
        delaySeconds: Math.max(1, Math.ceil(delayMs / 1_000)),
        retentionSeconds: 2 * 60 * 60,
        // Publishing can be retried independently of delivery. One queue item
        // per database attempt prevents those retries from duplicating sends.
        idempotencyKey: `notification-email-retry:${notificationId}:${nextAttempt}`
      }
    );
  }
}
