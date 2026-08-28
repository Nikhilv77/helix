import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Logger } from "../common/logger";
import { TRAILGRAD_LOGO_CID, TRAILGRAD_LOGO_CONTENT_ID } from "./email-template";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8_000;

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text remains the accessibility and graceful-degradation fallback. */
  text: string;
  /** Optional materialized HTML, persisted with the notification before send. */
  html?: string;
  /** Visible label only; the configured verified email address never changes. */
  fromName?: string;
  /** Stable across retries so Resend can suppress a post-send crash replay. */
  idempotencyKey?: string;
}

/** Looks up a recipient's address. Clerk owns identity; the database does not. */
export type AddressBook = (ownerId: string) => Promise<string | null>;

/**
 * Email delivery through Resend's REST API.
 *
 * Called over `fetch` rather than through the SDK on purpose. This keeps the
 * delivery path small while still supporting HTML and one inline brand asset.
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
      const attachments = message.html?.includes(TRAILGRAD_LOGO_CID)
        ? await trailgradLogoAttachment()
        : [];
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey } : {})
        },
        body: JSON.stringify({
          from: senderAddress(this.from!, message.fromName),
          to: [to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(attachments.length ? { attachments } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.logger.error(JSON.stringify({ event: "email.send.failed", status: response.status }));
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

let logoContent: Promise<string | null> | null = null;

function trailgradLogoAttachment(): Promise<
  | Array<{
      content: string;
      filename: string;
      content_id: string;
      content_type: string;
    }>
  | []
> {
  logoContent ??= readFile(join(process.cwd(), "public", "brand", "trailgrad-icon.png"))
    .then((content) => content.toString("base64"))
    .catch(() => null);

  return logoContent.then((content) =>
    content
      ? [
          {
            content,
            filename: "trailgrad-logo.png",
            content_id: TRAILGRAD_LOGO_CONTENT_ID,
            content_type: "image/png"
          }
        ]
      : []
  );
}

/** Keep the verified mailbox and replace only the human-readable label. */
function senderAddress(configured: string, requestedName?: string): string {
  if (!requestedName) return configured;

  const match = configured.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  const address = match?.[1] ?? configured.trim();
  const safeName = requestedName
    .replace(/[<>"\r\n]/g, "")
    .trim()
    .slice(0, 80);
  return safeName ? `${safeName} <${address}>` : configured;
}
