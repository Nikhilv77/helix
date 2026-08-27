import type { AppConfigService } from "../config/app-config.service";
import { ownerIdToUserId } from "../interview/owner";

/**
 * Who may read the report queue.
 *
 * An allowlist in the environment rather than a flag on the profile row: a
 * database-stored privilege is one more thing that can be written, and the set
 * of people who moderate reports changes about as often as a deploy.
 *
 * Closed by default. An unset variable means nobody is an operator, so a
 * misconfigured environment exposes nothing — the failure mode is a locked door
 * rather than an open one.
 */
export function isOperator(config: AppConfigService, ownerId: string): boolean {
  const allowed = config.operatorUserIds;
  if (allowed.length === 0) return false;

  const userId = ownerIdToUserId(ownerId);
  if (!userId) return false;

  // Accepts either form so an operator can be listed as the raw Clerk id or the
  // prefixed owner key, whichever they happen to have to hand.
  return allowed.includes(userId) || allowed.includes(ownerId);
}
