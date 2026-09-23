ALTER TYPE "AiMlPracticeQuestionStatus" ADD VALUE IF NOT EXISTS 'LEARNED';

ALTER TABLE "AiMlPracticeQuestion"
  ADD COLUMN "draft" JSONB,
  ADD COLUMN "revealedHintCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "learnedAt" TIMESTAMP(3);

ALTER TABLE "AiMlPracticeAttempt"
  ALTER COLUMN "selectedOptionId" DROP NOT NULL,
  ALTER COLUMN "correct" DROP NOT NULL;
