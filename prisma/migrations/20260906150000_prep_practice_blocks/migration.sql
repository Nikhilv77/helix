-- Generic durable adaptive blocks for non-DSA Practice. Existing DSA block,
-- assessment, attempt, and history values are not rewritten.
CREATE TYPE "PrepPracticeBlockStatus" AS ENUM (
    'PRACTISING',
    'ASSESSMENT_READY',
    'ASSESSMENT_IN_PROGRESS',
    'ASSESSED'
);

CREATE TYPE "PrepPracticeBlockQuestionStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'SKIPPED'
);

CREATE TYPE "PrepBlockAssessmentStatus" AS ENUM (
    'LOCKED',
    'READY',
    'IN_PROGRESS',
    'FINALIZING',
    'COMPLETED'
);

ALTER TABLE "UserQuestionAttempt"
ADD COLUMN "prepPracticeBlockQuestionId" UUID;

CREATE TABLE "PrepPracticeBlock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "practiceSessionKey" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "PrepPracticeBlockStatus" NOT NULL DEFAULT 'PRACTISING',
    "schemaVersion" INTEGER NOT NULL,
    "recommendationVersion" TEXT NOT NULL,
    "preparationRequestId" UUID NOT NULL,
    "trackSnapshot" JSONB NOT NULL,
    "recommendationSnapshot" JSONB NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "assessmentReadyAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepPracticeBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrepPracticeBlock_ordinal_check" CHECK ("ordinal" > 0),
    CONSTRAINT "PrepPracticeBlock_schemaVersion_check" CHECK ("schemaVersion" > 0),
    CONSTRAINT "PrepPracticeBlock_session_check" CHECK (
        "practiceSessionKey" IN (
            'core-technical',
            'applied-engineering',
            'architecture-system-design'
        )
    )
);

CREATE TABLE "PrepPracticeBlockQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "questionTemplateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "status" "PrepPracticeBlockQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "questionSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepPracticeBlockQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrepPracticeBlockQuestion_order_check" CHECK ("order" > 0),
    CONSTRAINT "PrepPracticeBlockQuestion_contentVersion_check" CHECK ("contentVersion" > 0)
);

CREATE TABLE "PrepBlockAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "PrepBlockAssessmentStatus" NOT NULL DEFAULT 'LOCKED',
    "assessmentSnapshot" JSONB,
    "interviewSessionId" UUID,
    "startRequestId" UUID,
    "finalizationRequestId" UUID,
    "readyAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepBlockAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrepBlockAssessmentReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBlockAssessmentReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrepBlockAssessmentReport_schemaVersion_check" CHECK ("schemaVersion" > 0)
);

CREATE UNIQUE INDEX "PrepPracticeBlock_ownerId_practiceSessionKey_ordinal_key"
ON "PrepPracticeBlock"("ownerId", "practiceSessionKey", "ordinal");

CREATE UNIQUE INDEX "PrepPracticeBlock_ownerId_preparationRequestId_key"
ON "PrepPracticeBlock"("ownerId", "preparationRequestId");

CREATE UNIQUE INDEX "PrepPracticeBlock_id_ownerId_key"
ON "PrepPracticeBlock"("id", "ownerId");

-- Prisma cannot express this partial index. It permits any amount of history
-- while preventing concurrent current cohorts for one owner/session.
CREATE UNIQUE INDEX "PrepPracticeBlock_one_current_per_owner_session"
ON "PrepPracticeBlock"("ownerId", "practiceSessionKey")
WHERE "isCurrent";

CREATE INDEX "PrepPracticeBlock_ownerId_practiceSessionKey_isCurrent_idx"
ON "PrepPracticeBlock"("ownerId", "practiceSessionKey", "isCurrent");

CREATE INDEX "PrepPracticeBlock_ownerId_practiceSessionKey_createdAt_idx"
ON "PrepPracticeBlock"("ownerId", "practiceSessionKey", "createdAt");

CREATE INDEX "PrepPracticeBlock_status_idx"
ON "PrepPracticeBlock"("status");

CREATE UNIQUE INDEX "PrepPracticeBlockQuestion_blockId_order_key"
ON "PrepPracticeBlockQuestion"("blockId", "order");

CREATE UNIQUE INDEX "PrepPracticeBlockQuestion_blockId_questionTemplateId_key"
ON "PrepPracticeBlockQuestion"("blockId", "questionTemplateId");

CREATE UNIQUE INDEX "PrepPracticeBlockQuestion_id_ownerId_key"
ON "PrepPracticeBlockQuestion"("id", "ownerId");

CREATE INDEX "PrepPracticeBlockQuestion_ownerId_blockId_idx"
ON "PrepPracticeBlockQuestion"("ownerId", "blockId");

CREATE INDEX "PrepPracticeBlockQuestion_questionTemplateId_idx"
ON "PrepPracticeBlockQuestion"("questionTemplateId");

CREATE INDEX "PrepPracticeBlockQuestion_status_idx"
ON "PrepPracticeBlockQuestion"("status");

CREATE UNIQUE INDEX "PrepBlockAssessment_blockId_key"
ON "PrepBlockAssessment"("blockId");

CREATE UNIQUE INDEX "PrepBlockAssessment_interviewSessionId_key"
ON "PrepBlockAssessment"("interviewSessionId");

CREATE UNIQUE INDEX "PrepBlockAssessment_ownerId_startRequestId_key"
ON "PrepBlockAssessment"("ownerId", "startRequestId");

CREATE UNIQUE INDEX "PrepBlockAssessment_ownerId_finalizationRequestId_key"
ON "PrepBlockAssessment"("ownerId", "finalizationRequestId");

CREATE UNIQUE INDEX "PrepBlockAssessment_blockId_ownerId_key"
ON "PrepBlockAssessment"("blockId", "ownerId");

CREATE UNIQUE INDEX "PrepBlockAssessment_id_ownerId_key"
ON "PrepBlockAssessment"("id", "ownerId");

CREATE INDEX "PrepBlockAssessment_ownerId_status_createdAt_idx"
ON "PrepBlockAssessment"("ownerId", "status", "createdAt");

CREATE INDEX "PrepBlockAssessment_ownerId_completedAt_idx"
ON "PrepBlockAssessment"("ownerId", "completedAt");

CREATE UNIQUE INDEX "PrepBlockAssessmentReport_assessmentId_key"
ON "PrepBlockAssessmentReport"("assessmentId");

CREATE UNIQUE INDEX "PrepBlockAssessmentReport_assessmentId_ownerId_key"
ON "PrepBlockAssessmentReport"("assessmentId", "ownerId");

CREATE INDEX "PrepBlockAssessmentReport_ownerId_finalizedAt_idx"
ON "PrepBlockAssessmentReport"("ownerId", "finalizedAt");

CREATE INDEX "UserQuestionAttempt_prepPracticeBlockQuestionId_idx"
ON "UserQuestionAttempt"("prepPracticeBlockQuestionId");

ALTER TABLE "PrepPracticeBlock"
ADD CONSTRAINT "PrepPracticeBlock_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeBlockQuestion"
ADD CONSTRAINT "PrepPracticeBlockQuestion_blockId_ownerId_fkey"
FOREIGN KEY ("blockId", "ownerId") REFERENCES "PrepPracticeBlock"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeBlockQuestion"
ADD CONSTRAINT "PrepPracticeBlockQuestion_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeBlockQuestion"
ADD CONSTRAINT "PrepPracticeBlockQuestion_questionTemplateId_fkey"
FOREIGN KEY ("questionTemplateId") REFERENCES "PrepQuestionTemplate"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrepBlockAssessment"
ADD CONSTRAINT "PrepBlockAssessment_blockId_ownerId_fkey"
FOREIGN KEY ("blockId", "ownerId") REFERENCES "PrepPracticeBlock"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepBlockAssessment"
ADD CONSTRAINT "PrepBlockAssessment_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepBlockAssessmentReport"
ADD CONSTRAINT "PrepBlockAssessmentReport_assessmentId_ownerId_fkey"
FOREIGN KEY ("assessmentId", "ownerId") REFERENCES "PrepBlockAssessment"("id", "ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepBlockAssessmentReport"
ADD CONSTRAINT "PrepBlockAssessmentReport_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserQuestionAttempt"
ADD CONSTRAINT "UserQuestionAttempt_prepPracticeBlockQuestionId_fkey"
FOREIGN KEY ("prepPracticeBlockQuestionId") REFERENCES "PrepPracticeBlockQuestion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

