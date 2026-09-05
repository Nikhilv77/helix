-- Durable lifecycle for adaptive DSA practice blocks and their one-to-one
-- end-of-block assessments. Existing JSON-backed blocks are lazily imported by
-- the application so this migration never guesses a candidate's cohort.
CREATE TYPE "DsaPracticeBlockStatus" AS ENUM (
    'PRACTISING',
    'ASSESSMENT_READY',
    'ASSESSMENT_IN_PROGRESS',
    'ASSESSED'
);

CREATE TABLE "DsaPracticeBlock" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "DsaPracticeBlockStatus" NOT NULL DEFAULT 'PRACTISING',
    "recommendationSnapshot" JSONB NOT NULL,
    "questionSlugs" TEXT[] NOT NULL,
    "assessmentReadyAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsaPracticeBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DsaBlockAssessment" (
    "id" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assessmentSnapshot" JSONB,
    "interviewSessionId" UUID,
    "reportSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DsaBlockAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DsaPracticeBlock_ownerId_ordinal_key"
ON "DsaPracticeBlock"("ownerId", "ordinal");

-- PostgreSQL partial index: one active/current cohort per owner, while every
-- historical block remains queryable with `isCurrent = false`.
CREATE UNIQUE INDEX "DsaPracticeBlock_one_current_per_owner"
ON "DsaPracticeBlock"("ownerId")
WHERE "isCurrent";

CREATE INDEX "DsaPracticeBlock_ownerId_isCurrent_idx"
ON "DsaPracticeBlock"("ownerId", "isCurrent");

CREATE INDEX "DsaPracticeBlock_ownerId_createdAt_idx"
ON "DsaPracticeBlock"("ownerId", "createdAt");

CREATE INDEX "DsaPracticeBlock_status_idx"
ON "DsaPracticeBlock"("status");

CREATE UNIQUE INDEX "DsaBlockAssessment_blockId_key"
ON "DsaBlockAssessment"("blockId");

CREATE INDEX "DsaBlockAssessment_ownerId_createdAt_idx"
ON "DsaBlockAssessment"("ownerId", "createdAt");

CREATE INDEX "DsaBlockAssessment_ownerId_completedAt_idx"
ON "DsaBlockAssessment"("ownerId", "completedAt");

CREATE INDEX "DsaBlockAssessment_interviewSessionId_idx"
ON "DsaBlockAssessment"("interviewSessionId");

ALTER TABLE "DsaPracticeBlock"
ADD CONSTRAINT "DsaPracticeBlock_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DsaBlockAssessment"
ADD CONSTRAINT "DsaBlockAssessment_blockId_fkey"
FOREIGN KEY ("blockId") REFERENCES "DsaPracticeBlock"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DsaBlockAssessment"
ADD CONSTRAINT "DsaBlockAssessment_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;
