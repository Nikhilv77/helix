-- Part 4 evidence integrity: every new PREP attempt records the authored
-- content revision, evaluator contract, and whether it is safe to consume as
-- demonstrated ability. Nullable columns preserve all legacy DSA history.
CREATE TYPE "PracticeAttemptVerificationStatus" AS ENUM (
  'VERIFIED',
  'UNVERIFIED',
  'NOT_APPLICABLE'
);

ALTER TABLE "UserQuestionAttempt"
ADD COLUMN "questionContentVersion" INTEGER,
ADD COLUMN "evaluatorVersion" TEXT,
ADD COLUMN "verificationStatus" "PracticeAttemptVerificationStatus";

CREATE INDEX "UserQuestionAttempt_sourceType_verificationStatus_createdAt_idx"
ON "UserQuestionAttempt"("sourceType", "verificationStatus", "createdAt");
