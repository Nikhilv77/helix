CREATE TABLE "PrepPracticeBlockQuestionState" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockQuestionId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "draft" JSONB,
    "note" TEXT,
    "revealedHintCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrepPracticeBlockQuestionState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrepPracticeBlockQuestionState_blockQuestionId_key"
ON "PrepPracticeBlockQuestionState"("blockQuestionId");
CREATE UNIQUE INDEX "PrepPracticeBlockQuestionState_blockQuestionId_ownerId_key"
ON "PrepPracticeBlockQuestionState"("blockQuestionId", "ownerId");
CREATE INDEX "PrepPracticeBlockQuestionState_ownerId_updatedAt_idx"
ON "PrepPracticeBlockQuestionState"("ownerId", "updatedAt");

ALTER TABLE "PrepPracticeBlockQuestionState"
ADD CONSTRAINT "PrepPracticeBlockQuestionState_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeBlockQuestionState"
ADD CONSTRAINT "PrepPracticeBlockQuestionState_blockQuestionId_ownerId_fkey"
FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "PrepPracticeBlockQuestion"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

