ALTER TABLE "InterviewSession" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "InterviewSession" DISABLE TRIGGER candidate_analytics_dirty;
UPDATE "InterviewSession"
SET "completedAt" = "touchedAt"
WHERE state->>'phase' = 'done';
ALTER TABLE "InterviewSession" ENABLE TRIGGER candidate_analytics_dirty;
UPDATE "CandidateAnalyticsSnapshot" SET "dirtyVersion" = "dirtyVersion" + 1;
CREATE INDEX "InterviewSession_ownerId_completedAt_idx" ON "InterviewSession"("ownerId", "completedAt");
