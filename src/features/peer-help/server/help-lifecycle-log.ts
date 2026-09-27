import { Logger } from "@/server/common/logger";

const logger = new Logger("HelpLifecycle");

/**
 * One line per Trailmate request transition, for measuring whether help
 * reaches people: how many mates were invited (and how many were online),
 * how long a claim took, and how requests end. Ids and counts only; no code,
 * names or messages.
 */
export type HelpLifecycleEvent =
  | {
      event: "opened";
      requestId: string;
      eligibleHelpers: number;
      invited: number;
      onlineInvited: number;
    }
  | { event: "claimed"; requestId: string; waitMs: number }
  | { event: "released"; requestId: string }
  | { event: "resolved"; requestId: string; sessionMs: number | null }
  | { event: "cancelled"; requestId: string; waitMs: number; wasClaimed: boolean }
  | { event: "expired"; requestId: string }
  | { event: "rated"; requestId: string; rating: number };

export function logHelpLifecycle(entry: HelpLifecycleEvent): void {
  logger.log({ ...entry, event: `help.request.${entry.event}` });
}
