import { Logger } from "../common/logger";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8_000;

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. No template engine, no HTML — these are short and functional. */
  text: string;
  /** Stable across retries so Resend can suppress a post-send crash replay. */
  idempotencyKey?: string;
}

/** Looks up a recipient's address. Clerk owns identity; the database does not. */
export type AddressBook = (ownerId: string) => Promise<string | null>;

/**
 * Email delivery through Resend's REST API.
 *
 * Called over `fetch` rather than through the SDK on purpose: the request is
 * one POST with three fields, and a dependency that exists to build that POST
 * costs more to carry than it saves.
 *
 * Unconfigured is a supported state, not a broken one. Most environments —
 * local, preview, CI — have no API key, and notifications must still be
 * recorded in the inbox there.
 */
export class EmailChannel {
  private readonly logger = new Logger("EmailChannel");

  constructor(
    private readonly apiKey: string | undefined,
    private readonly from: string | undefined,
    private readonly addressBook: AddressBook
  ) {}

  get configured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  /**
   * Never throws. The inbox row is already written by the time this runs, so a
   * bounced email degrades the reach of a notification rather than losing it.
   */
  async send(ownerId: string, message: Omit<EmailMessage, "to">): Promise<boolean> {
    if (!this.configured) return false;

    let to: string | null;
    try {
      to = await this.addressBook(ownerId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "email.address.lookup.failed",
          reason: error instanceof Error ? error.message : String(error)
        })
      );
      return false;
    }

    if (!to) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          ...(message.idempotencyKey
            ? { "idempotency-key": message.idempotencyKey }
            : {})
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject: message.subject,
          text: message.text
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.logger.error(
          JSON.stringify({ event: "email.send.failed", status: response.status })
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "email.send.failed",
          reason: error instanceof Error ? error.message : String(error)
        })
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
