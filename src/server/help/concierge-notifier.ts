import { Logger } from "../common/logger";
import type { StuckSummary } from "./stuck-summary";

const TIMEOUT_MS = 5_000;

export interface ConciergeRequest {
  requestId: string;
  questionTitle: string;
  questionSlug: string;
  language: string;
  difficulty: string;
  summary: StuckSummary;
  timeSpentMs: number;
  hintsUsed: number;
}

/**
 * Where a help request goes before there are helpers.
 *
 * Milestone A routes every request to whoever is running the product, not to
 * other users: at the current active-user count a real helper pool cannot form,
 * and a matching screen that never matches would measure nothing. A webhook is
 * the whole mechanism — no inbox, no delivery preferences, no email vendor.
 * Those arrive with the notification layer in Part 5, once there is evidence
 * anyone wants this.
 *
 * The payload carries both `text` and `content` because Slack reads the former
 * and Discord the latter, and each ignores the other. That covers both without
 * a vendor SDK or a config flag naming which one is in use.
 */
export class ConciergeNotifier {
  private readonly logger = new Logger("HelpConcierge");

  constructor(private readonly webhookUrl?: string) {}

  /**
   * Never throws and never rejects. The learner's request is already stored by
   * the time this runs, so a failed webhook is an operator problem to read in
   * the logs — not a reason to tell the learner their ask failed.
   */
  async notify(request: ConciergeRequest): Promise<void> {
    const message = formatConciergeMessage(request);

    if (!this.webhookUrl) {
      // Still worth emitting: on a box without a webhook configured, the log is
      // the only trace that somebody asked for help.
      this.logger.log(
        JSON.stringify({ event: "help.request.unrouted", requestId: request.requestId, message })
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message, content: message }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.logger.error(
          JSON.stringify({
            event: "help.concierge.failed",
            requestId: request.requestId,
            status: response.status
          })
        );
        return;
      }

      this.logger.log(
        JSON.stringify({ event: "help.concierge.notified", requestId: request.requestId })
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "help.concierge.failed",
          requestId: request.requestId,
          reason: error instanceof Error ? error.message : String(error)
        })
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Plain text on purpose. It has to read well in Slack, in Discord and in a log
 * line, and rich block formats render as noise in at least one of those.
 */
export function formatConciergeMessage(request: ConciergeRequest): string {
  const minutes = Math.round(request.timeSpentMs / 60_000);
  const understands = request.summary.understands.length
    ? request.summary.understands.map((item) => `  • ${item}`).join("\n")
    : "  • (nothing recorded)";

  return [
    `Someone needs help — ${request.questionTitle} (${request.difficulty}, ${request.language})`,
    "",
    request.summary.headline,
    "",
    "Already has:",
    understands,
    "",
    `Blocked on: ${request.summary.blockedOn}`,
    "",
    `Open with: ${request.summary.opener}`,
    "",
    `${minutes} min on the problem · ${request.hintsUsed} AI hints taken · ~${request.summary.estimatedMinutes} min to help`,
    `Request ${request.requestId} · /dsa-questions/${request.questionSlug}`
  ].join("\n");
}
