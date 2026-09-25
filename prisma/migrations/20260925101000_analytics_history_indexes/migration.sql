CREATE INDEX "HelpRequest_helperId_createdAt_idx" ON "HelpRequest"("helperId", "createdAt");
DROP INDEX IF EXISTS "HelpRequest_helperId_idx";
CREATE INDEX "ResumeRoast_ownerId_status_updatedAt_idx" ON "ResumeRoast"("ownerId", "status", "updatedAt");
