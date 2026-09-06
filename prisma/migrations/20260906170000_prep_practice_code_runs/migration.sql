CREATE TABLE "PrepPracticeCodeRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "blockQuestionId" UUID NOT NULL,
    "codeFingerprint" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrepPracticeCodeRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrepPracticeCodeRun_id_ownerId_key"
ON "PrepPracticeCodeRun"("id", "ownerId");
CREATE INDEX "PrepPracticeCodeRun_ownerId_blockQuestionId_createdAt_idx"
ON "PrepPracticeCodeRun"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "PrepPracticeCodeRun_ownerId_codeFingerprint_idx"
ON "PrepPracticeCodeRun"("ownerId", "codeFingerprint");

ALTER TABLE "PrepPracticeCodeRun"
ADD CONSTRAINT "PrepPracticeCodeRun_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeCodeRun"
ADD CONSTRAINT "PrepPracticeCodeRun_blockQuestionId_ownerId_fkey"
FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "PrepPracticeBlockQuestion"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

