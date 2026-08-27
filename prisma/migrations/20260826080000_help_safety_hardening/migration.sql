-- Part 9 hardening: durable rating dismissal, idempotent reports, and database
-- invariants for values that are also validated by the application layer.

ALTER TABLE "HelpSession"
ADD COLUMN "learnerRatingSkippedAt" TIMESTAMP(3),
ADD COLUMN "learnerJoinedAt" TIMESTAMP(3),
ADD COLUMN "helperJoinedAt" TIMESTAMP(3);

ALTER TABLE "HelpSession"
ADD CONSTRAINT "HelpSession_learnerRating_range_check"
CHECK ("learnerRating" IS NULL OR "learnerRating" BETWEEN 1 AND 5);

ALTER TABLE "HelpSession"
ADD CONSTRAINT "HelpSession_rating_or_skip_check"
CHECK ("learnerRating" IS NULL OR "learnerRatingSkippedAt" IS NULL);

ALTER TABLE "HelpBlock"
ADD CONSTRAINT "HelpBlock_not_self_check"
CHECK ("ownerId" <> "blockedId");

ALTER TABLE "HelpReport"
ADD CONSTRAINT "HelpReport_not_self_check"
CHECK ("reporterId" <> "reportedId");

-- Keep the first copy if retries created duplicate reports before this
-- migration. A participant gets one moderation record per interaction.
DELETE FROM "HelpReport" newer
USING "HelpReport" older
WHERE newer."requestId" = older."requestId"
  AND newer."reporterId" = older."reporterId"
  AND (
    newer."createdAt" > older."createdAt"
    OR (newer."createdAt" = older."createdAt" AND newer."id" > older."id")
  );

CREATE UNIQUE INDEX "HelpReport_requestId_reporterId_key"
ON "HelpReport"("requestId", "reporterId");
