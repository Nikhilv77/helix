-- Part 4: durable learner state for non-DSA Practice questions. Attempts and
-- mastery remain canonical on UserQuestionProgress/UserQuestionAttempt.
ALTER TABLE "UserQuestionProgress"
ADD COLUMN "draftAnswer" TEXT,
ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
ADD COLUMN "revealedHintCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UserPrepQuestionNote" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "prepQuestionTemplateId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPrepQuestionNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPrepQuestionNote_ownerId_prepQuestionTemplateId_key"
ON "UserPrepQuestionNote"("ownerId", "prepQuestionTemplateId");
CREATE INDEX "UserPrepQuestionNote_ownerId_idx"
ON "UserPrepQuestionNote"("ownerId");
CREATE INDEX "UserPrepQuestionNote_prepQuestionTemplateId_idx"
ON "UserPrepQuestionNote"("prepQuestionTemplateId");

ALTER TABLE "UserPrepQuestionNote"
ADD CONSTRAINT "UserPrepQuestionNote_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPrepQuestionNote"
ADD CONSTRAINT "UserPrepQuestionNote_prepQuestionTemplateId_fkey"
FOREIGN KEY ("prepQuestionTemplateId") REFERENCES "PrepQuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
