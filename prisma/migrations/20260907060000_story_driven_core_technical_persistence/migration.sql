-- Active story-driven Core Technical persistence. The retired PrepPractice and
-- CoreTechnicalTrackVersion tables are deliberately left untouched.
CREATE TYPE "CoreTechnicalStoryPublicationStatus" AS ENUM ('REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "CoreTechnicalStoryProgressStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'PREPARING', 'PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "CoreTechnicalBlockStatus" AS ENUM ('PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "CoreTechnicalQuestionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'LEARNED');
CREATE TYPE "CoreTechnicalPreparationStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED');
CREATE TYPE "CoreTechnicalAssessmentStatus" AS ENUM ('LOCKED', 'READY', 'IN_PROGRESS', 'FINALIZING', 'COMPLETED');

ALTER TABLE "CandidateProfile" ADD COLUMN "activeCoreTechnicalFocusRevisionId" UUID;

CREATE TABLE "CoreTechnicalFocusRevision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "focusFingerprint" TEXT NOT NULL,
    "baselineSchemaVersion" INTEGER NOT NULL,
    "baselineSourceFingerprint" TEXT NOT NULL,
    "focusSnapshot" JSONB NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoreTechnicalFocusRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalFocusRevision_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "CoreTechnicalFocusRevision_schema_check" CHECK ("schemaVersion" > 0 AND "baselineSchemaVersion" > 0)
);

CREATE TABLE "CoreTechnicalStoryDefinition" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalStoryDefinition_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "CoreTechnicalStoryVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "publicationStatus" "CoreTechnicalStoryPublicationStatus" NOT NULL DEFAULT 'REVIEW',
    "contentFingerprint" TEXT NOT NULL,
    "storySnapshot" JSONB NOT NULL,
    "reviewSnapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoreTechnicalStoryVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalStoryVersion_version_check" CHECK ("version" > 0 AND "schemaVersion" > 0),
    CONSTRAINT "CoreTechnicalStoryVersion_status_dates_check" CHECK (
      ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL) AND
      ("publicationStatus" <> 'RETIRED' OR "retiredAt" IS NOT NULL)
    )
);

CREATE TABLE "CoreTechnicalStoryProgress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "storyKey" TEXT NOT NULL,
    "status" "CoreTechnicalStoryProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalStoryProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoreTechnicalBlock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "CoreTechnicalBlockStatus" NOT NULL DEFAULT 'PRACTISING',
    "focusRevisionId" UUID NOT NULL,
    "storyVersionId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "rankingPolicyVersion" INTEGER NOT NULL,
    "preparationRequestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "storySnapshot" JSONB NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "assessmentReadyAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalBlock_positive_check" CHECK ("ordinal" > 0 AND "schemaVersion" > 0 AND "rankingPolicyVersion" > 0)
);

CREATE TABLE "CoreTechnicalBlockQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "status" "CoreTechnicalQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicSnapshot" JSONB NOT NULL,
    "privateSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "learnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalBlockQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalBlockQuestion_order_check" CHECK ("order" BETWEEN 1 AND 8),
    CONSTRAINT "CoreTechnicalBlockQuestion_version_check" CHECK ("contentVersion" > 0),
    CONSTRAINT "CoreTechnicalBlockQuestion_terminal_check" CHECK (NOT ("completedAt" IS NOT NULL AND "learnedAt" IS NOT NULL))
);

CREATE TABLE "CoreTechnicalQuestionState" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockQuestionId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "draft" JSONB,
    "revealedHintCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalQuestionState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalQuestionState_hint_check" CHECK ("revealedHintCount" BETWEEN 0 AND 3)
);

CREATE TABLE "CoreTechnicalQuestionAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "blockQuestionId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "workFingerprint" TEXT NOT NULL,
    "answerSnapshot" JSONB NOT NULL,
    "evaluationSnapshot" JSONB NOT NULL,
    "verificationStatus" "PracticeAttemptVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoreTechnicalQuestionAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalQuestionAttempt_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10))
);

CREATE TABLE "CoreTechnicalCodeRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "blockQuestionId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "codeFingerprint" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "runnerVersion" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoreTechnicalCodeRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoreTechnicalAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "CoreTechnicalAssessmentStatus" NOT NULL DEFAULT 'LOCKED',
    "schemaVersion" INTEGER NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "assessmentSnapshot" JSONB,
    "startRequestId" UUID,
    "finalizationRequestId" UUID,
    "readyAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalAssessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalAssessment_schema_check" CHECK ("schemaVersion" > 0)
);

CREATE TABLE "CoreTechnicalAssessmentReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "transcriptSnapshot" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoreTechnicalAssessmentReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoreTechnicalAssessmentReport_schema_check" CHECK ("schemaVersion" > 0)
);

CREATE TABLE "CoreTechnicalPreparationAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "focusRevisionId" UUID NOT NULL,
    "blockId" UUID,
    "requestId" UUID NOT NULL,
    "status" "CoreTechnicalPreparationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "generatorVersion" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "diagnosticsSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoreTechnicalPreparationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoreTechnicalFocusRevision_ownerId_revision_key" ON "CoreTechnicalFocusRevision"("ownerId", "revision");
CREATE UNIQUE INDEX "CoreTechnicalFocusRevision_ownerId_focusFingerprint_schemaV_key" ON "CoreTechnicalFocusRevision"("ownerId", "focusFingerprint", "schemaVersion");
CREATE UNIQUE INDEX "CoreTechnicalFocusRevision_id_ownerId_key" ON "CoreTechnicalFocusRevision"("id", "ownerId");
CREATE INDEX "CoreTechnicalFocusRevision_ownerId_confirmedAt_idx" ON "CoreTechnicalFocusRevision"("ownerId", "confirmedAt");
CREATE INDEX "CoreTechnicalFocusRevision_baselineSourceFingerprint_idx" ON "CoreTechnicalFocusRevision"("baselineSourceFingerprint");
CREATE INDEX "CandidateProfile_activeCoreTechnicalFocusRevisionId_idx" ON "CandidateProfile"("activeCoreTechnicalFocusRevisionId");

CREATE UNIQUE INDEX "CoreTechnicalStoryVersion_storyKey_version_key" ON "CoreTechnicalStoryVersion"("storyKey", "version");
CREATE UNIQUE INDEX "CoreTechnicalStoryVersion_storyKey_contentFingerprint_key" ON "CoreTechnicalStoryVersion"("storyKey", "contentFingerprint");
CREATE INDEX "CoreTechnicalStoryVersion_publicationStatus_storyKey_idx" ON "CoreTechnicalStoryVersion"("publicationStatus", "storyKey");
CREATE INDEX "CoreTechnicalStoryVersion_contentFingerprint_idx" ON "CoreTechnicalStoryVersion"("contentFingerprint");

CREATE UNIQUE INDEX "CoreTechnicalStoryProgress_ownerId_storyKey_key" ON "CoreTechnicalStoryProgress"("ownerId", "storyKey");
CREATE INDEX "CoreTechnicalStoryProgress_ownerId_status_idx" ON "CoreTechnicalStoryProgress"("ownerId", "status");

CREATE UNIQUE INDEX "CoreTechnicalBlock_ownerId_ordinal_key" ON "CoreTechnicalBlock"("ownerId", "ordinal");
CREATE UNIQUE INDEX "CoreTechnicalBlock_ownerId_preparationRequestId_key" ON "CoreTechnicalBlock"("ownerId", "preparationRequestId");
CREATE UNIQUE INDEX "CoreTechnicalBlock_id_ownerId_key" ON "CoreTechnicalBlock"("id", "ownerId");
CREATE UNIQUE INDEX "CoreTechnicalBlock_one_current_per_owner" ON "CoreTechnicalBlock"("ownerId") WHERE "isCurrent";
CREATE INDEX "CoreTechnicalBlock_ownerId_isCurrent_idx" ON "CoreTechnicalBlock"("ownerId", "isCurrent");
CREATE INDEX "CoreTechnicalBlock_ownerId_createdAt_idx" ON "CoreTechnicalBlock"("ownerId", "createdAt");
CREATE INDEX "CoreTechnicalBlock_storyVersionId_idx" ON "CoreTechnicalBlock"("storyVersionId");
CREATE INDEX "CoreTechnicalBlock_status_idx" ON "CoreTechnicalBlock"("status");

CREATE UNIQUE INDEX "CoreTechnicalBlockQuestion_blockId_order_key" ON "CoreTechnicalBlockQuestion"("blockId", "order");
CREATE UNIQUE INDEX "CoreTechnicalBlockQuestion_blockId_questionKey_key" ON "CoreTechnicalBlockQuestion"("blockId", "questionKey");
CREATE UNIQUE INDEX "CoreTechnicalBlockQuestion_id_ownerId_key" ON "CoreTechnicalBlockQuestion"("id", "ownerId");
CREATE INDEX "CoreTechnicalBlockQuestion_ownerId_blockId_idx" ON "CoreTechnicalBlockQuestion"("ownerId", "blockId");
CREATE INDEX "CoreTechnicalBlockQuestion_ownerId_status_idx" ON "CoreTechnicalBlockQuestion"("ownerId", "status");
CREATE INDEX "CoreTechnicalBlockQuestion_contentFingerprint_idx" ON "CoreTechnicalBlockQuestion"("contentFingerprint");

CREATE UNIQUE INDEX "CoreTechnicalQuestionState_blockQuestionId_key" ON "CoreTechnicalQuestionState"("blockQuestionId");
CREATE UNIQUE INDEX "CoreTechnicalQuestionState_blockQuestionId_ownerId_key" ON "CoreTechnicalQuestionState"("blockQuestionId", "ownerId");
CREATE INDEX "CoreTechnicalQuestionState_ownerId_updatedAt_idx" ON "CoreTechnicalQuestionState"("ownerId", "updatedAt");

CREATE UNIQUE INDEX "CoreTechnicalQuestionAttempt_ownerId_requestId_key" ON "CoreTechnicalQuestionAttempt"("ownerId", "requestId");
CREATE UNIQUE INDEX "CoreTechnicalQuestionAttempt_id_ownerId_key" ON "CoreTechnicalQuestionAttempt"("id", "ownerId");
CREATE INDEX "CoreTechnicalQuestionAttempt_ownerId_blockQuestionId_create_idx" ON "CoreTechnicalQuestionAttempt"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "CoreTechnicalQuestionAttempt_ownerId_workFingerprint_idx" ON "CoreTechnicalQuestionAttempt"("ownerId", "workFingerprint");

CREATE UNIQUE INDEX "CoreTechnicalCodeRun_ownerId_requestId_key" ON "CoreTechnicalCodeRun"("ownerId", "requestId");
CREATE UNIQUE INDEX "CoreTechnicalCodeRun_id_ownerId_key" ON "CoreTechnicalCodeRun"("id", "ownerId");
CREATE INDEX "CoreTechnicalCodeRun_ownerId_blockQuestionId_createdAt_idx" ON "CoreTechnicalCodeRun"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "CoreTechnicalCodeRun_ownerId_codeFingerprint_idx" ON "CoreTechnicalCodeRun"("ownerId", "codeFingerprint");

CREATE UNIQUE INDEX "CoreTechnicalAssessment_blockId_key" ON "CoreTechnicalAssessment"("blockId");
CREATE UNIQUE INDEX "CoreTechnicalAssessment_ownerId_startRequestId_key" ON "CoreTechnicalAssessment"("ownerId", "startRequestId");
CREATE UNIQUE INDEX "CoreTechnicalAssessment_ownerId_finalizationRequestId_key" ON "CoreTechnicalAssessment"("ownerId", "finalizationRequestId");
CREATE UNIQUE INDEX "CoreTechnicalAssessment_id_ownerId_key" ON "CoreTechnicalAssessment"("id", "ownerId");
CREATE UNIQUE INDEX "CoreTechnicalAssessment_blockId_ownerId_key" ON "CoreTechnicalAssessment"("blockId", "ownerId");
CREATE INDEX "CoreTechnicalAssessment_ownerId_status_createdAt_idx" ON "CoreTechnicalAssessment"("ownerId", "status", "createdAt");

CREATE UNIQUE INDEX "CoreTechnicalAssessmentReport_assessmentId_key" ON "CoreTechnicalAssessmentReport"("assessmentId");
CREATE UNIQUE INDEX "CoreTechnicalAssessmentReport_assessmentId_ownerId_key" ON "CoreTechnicalAssessmentReport"("assessmentId", "ownerId");
CREATE INDEX "CoreTechnicalAssessmentReport_ownerId_finalizedAt_idx" ON "CoreTechnicalAssessmentReport"("ownerId", "finalizedAt");

CREATE UNIQUE INDEX "CoreTechnicalPreparationAttempt_ownerId_requestId_key" ON "CoreTechnicalPreparationAttempt"("ownerId", "requestId");
CREATE INDEX "CoreTechnicalPreparationAttempt_ownerId_status_createdAt_idx" ON "CoreTechnicalPreparationAttempt"("ownerId", "status", "createdAt");
CREATE INDEX "CoreTechnicalPreparationAttempt_focusRevisionId_idx" ON "CoreTechnicalPreparationAttempt"("focusRevisionId");
CREATE INDEX "CoreTechnicalPreparationAttempt_blockId_idx" ON "CoreTechnicalPreparationAttempt"("blockId");

ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_activeCoreTechnicalFocusRevisionId_fkey" FOREIGN KEY ("activeCoreTechnicalFocusRevisionId") REFERENCES "CoreTechnicalFocusRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalFocusRevision" ADD CONSTRAINT "CoreTechnicalFocusRevision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalStoryVersion" ADD CONSTRAINT "CoreTechnicalStoryVersion_storyKey_fkey" FOREIGN KEY ("storyKey") REFERENCES "CoreTechnicalStoryDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalStoryProgress" ADD CONSTRAINT "CoreTechnicalStoryProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalStoryProgress" ADD CONSTRAINT "CoreTechnicalStoryProgress_storyKey_fkey" FOREIGN KEY ("storyKey") REFERENCES "CoreTechnicalStoryDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalBlock" ADD CONSTRAINT "CoreTechnicalBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalBlock" ADD CONSTRAINT "CoreTechnicalBlock_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "CoreTechnicalFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalBlock" ADD CONSTRAINT "CoreTechnicalBlock_storyVersionId_fkey" FOREIGN KEY ("storyVersionId") REFERENCES "CoreTechnicalStoryVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalBlockQuestion" ADD CONSTRAINT "CoreTechnicalBlockQuestion_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "CoreTechnicalBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalBlockQuestion" ADD CONSTRAINT "CoreTechnicalBlockQuestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalQuestionState" ADD CONSTRAINT "CoreTechnicalQuestionState_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "CoreTechnicalBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalQuestionState" ADD CONSTRAINT "CoreTechnicalQuestionState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalQuestionAttempt" ADD CONSTRAINT "CoreTechnicalQuestionAttempt_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "CoreTechnicalBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalQuestionAttempt" ADD CONSTRAINT "CoreTechnicalQuestionAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalCodeRun" ADD CONSTRAINT "CoreTechnicalCodeRun_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "CoreTechnicalBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalCodeRun" ADD CONSTRAINT "CoreTechnicalCodeRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalAssessment" ADD CONSTRAINT "CoreTechnicalAssessment_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "CoreTechnicalBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalAssessment" ADD CONSTRAINT "CoreTechnicalAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalAssessmentReport" ADD CONSTRAINT "CoreTechnicalAssessmentReport_assessmentId_ownerId_fkey" FOREIGN KEY ("assessmentId", "ownerId") REFERENCES "CoreTechnicalAssessment"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalAssessmentReport" ADD CONSTRAINT "CoreTechnicalAssessmentReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalPreparationAttempt" ADD CONSTRAINT "CoreTechnicalPreparationAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalPreparationAttempt" ADD CONSTRAINT "CoreTechnicalPreparationAttempt_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "CoreTechnicalFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoreTechnicalPreparationAttempt" ADD CONSTRAINT "CoreTechnicalPreparationAttempt_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "CoreTechnicalBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
