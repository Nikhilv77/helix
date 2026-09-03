-- The first local version of Resume Roast deduplicated generations by resume,
-- target, and prompt. That prevents a user from retrying a failed roast or
-- intentionally requesting fresh feedback for the same target.
DROP INDEX IF EXISTS "ResumeRoast_ownerId_resumeProfileVersionId_role_companyEnvironm";

-- Reconcile databases that applied the earlier lease-based draft of the
-- uncommitted Resume Roast migration with the current append-only schema.
DROP INDEX IF EXISTS "ResumeRoast_ownerId_status_leaseUntil_idx";
ALTER TABLE "ResumeRoast" DROP COLUMN IF EXISTS "leaseUntil";

CREATE INDEX IF NOT EXISTS "ResumeRoast_ownerId_status_createdAt_idx"
ON "ResumeRoast"("ownerId", "status", "createdAt");
