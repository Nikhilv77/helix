import type { AppConfigService } from "@/server/config/app-config.service";
import { ownerIdToUserId } from "@/features/interviews/server/owner";

/**
 * Interview operations is a single-admin surface in every environment.
 *
 * Keeping this separate from the report-moderator allowlist prevents adding a
 * moderator from silently granting access to production reliability data. An
 * unset value, signed-out request, or mismatch all fail closed.
 */
export function canViewInterviewOperations(
  config: AppConfigService,
  authenticatedOwnerId: string | null
): boolean {
  if (!authenticatedOwnerId || !config.interviewOperationsAdminUserId) return false;
  return ownerIdToUserId(authenticatedOwnerId) === config.interviewOperationsAdminUserId;
}
