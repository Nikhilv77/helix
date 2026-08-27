-- Version authored DSA content without rewriting any existing question.
ALTER TABLE "DsaQuestion"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

-- Existing attempt rows remain valid with a null key. New practice writes use
-- a client-generated UUID so a retried request replays instead of double-counting.
ALTER TABLE "UserQuestionAttempt"
ADD COLUMN "idempotencyKey" UUID;

CREATE UNIQUE INDEX "UserQuestionAttempt_ownerId_idempotencyKey_key"
ON "UserQuestionAttempt"("ownerId", "idempotencyKey");
