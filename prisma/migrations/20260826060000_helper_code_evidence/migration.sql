-- Test-backed helper evidence.
--
-- Completion is still recorded separately, but matching can now prove how a
-- candidate performed and prefer somebody who used the learner's language.

ALTER TABLE "UserQuestionAttempt"
ADD COLUMN "language" TEXT;

CREATE INDEX "UserQuestionAttempt_ownerId_dsaQuestionSlug_status_score_idx"
ON "UserQuestionAttempt"("ownerId", "dsaQuestionSlug", "status", "score");

CREATE INDEX "UserQuestionAttempt_dsaQuestionSlug_language_status_score_idx"
ON "UserQuestionAttempt"("dsaQuestionSlug", "language", "status", "score");

-- The matching query excludes busy helpers, and this index makes the same rule
-- hold when two different requests are claimed concurrently.
CREATE UNIQUE INDEX "HelpRequest_one_claimed_per_helper_idx"
ON "HelpRequest"("helperId")
WHERE "status" = 'CLAIMED' AND "helperId" IS NOT NULL;
