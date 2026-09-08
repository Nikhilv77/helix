-- Story-driven Architecture & Design persistence. This namespace is separate
-- from DSA, retired PrepPractice, Core Technical, and Applied Engineering history.
CREATE TYPE "ArchitectureScenarioPublicationStatus" AS ENUM ('REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "ArchitectureScenarioProgressStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'PREPARING', 'PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "ArchitectureBlockStatus" AS ENUM ('PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "ArchitectureQuestionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'LEARNED');
CREATE TYPE "ArchitecturePreparationStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ArchitectureAssessmentStatus" AS ENUM ('LOCKED', 'READY', 'IN_PROGRESS', 'FINALIZING', 'COMPLETED');

ALTER TABLE "CandidateProfile" ADD COLUMN "activeArchitectureFocusRevisionId" UUID;

CREATE TABLE "ArchitectureFocusRevision" (
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
    CONSTRAINT "ArchitectureFocusRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureFocusRevision_check" CHECK ("revision" > 0 AND "schemaVersion" > 0 AND "baselineSchemaVersion" > 0)
);

CREATE TABLE "ArchitectureScenarioDefinition" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureScenarioDefinition_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "ArchitectureScenarioVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scenarioKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "publicationStatus" "ArchitectureScenarioPublicationStatus" NOT NULL DEFAULT 'REVIEW',
    "contentFingerprint" TEXT NOT NULL,
    "scenarioSnapshot" JSONB NOT NULL,
    "publicQuestionSnapshot" JSONB NOT NULL,
    "privateQuestionSnapshot" JSONB NOT NULL,
    "reviewSnapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchitectureScenarioVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureScenarioVersion_check" CHECK ("version" > 0 AND "schemaVersion" > 0),
    CONSTRAINT "ArchitectureScenarioVersion_status_dates_check" CHECK (("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL) AND ("publicationStatus" <> 'RETIRED' OR "retiredAt" IS NOT NULL))
);

CREATE TABLE "ArchitectureScenarioProgress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "status" "ArchitectureScenarioProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureScenarioProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchitectureBlock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "ArchitectureBlockStatus" NOT NULL DEFAULT 'PRACTISING',
    "focusRevisionId" UUID NOT NULL,
    "scenarioVersionId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "rankingPolicyVersion" INTEGER NOT NULL,
    "preparationRequestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "scenarioSnapshot" JSONB NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "assessmentReadyAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureBlock_check" CHECK ("ordinal" > 0 AND "schemaVersion" > 0 AND "rankingPolicyVersion" > 0)
);

CREATE TABLE "ArchitectureBlockQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "status" "ArchitectureQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicSnapshot" JSONB NOT NULL,
    "privateSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "learnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureBlockQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureBlockQuestion_order_check" CHECK ("order" BETWEEN 1 AND 4),
    CONSTRAINT "ArchitectureBlockQuestion_version_check" CHECK ("contentVersion" > 0),
    CONSTRAINT "ArchitectureBlockQuestion_terminal_check" CHECK (NOT ("completedAt" IS NOT NULL AND "learnedAt" IS NOT NULL))
);

CREATE TABLE "ArchitectureQuestionState" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockQuestionId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "draft" JSONB,
    "revealedHintCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureQuestionState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureQuestionState_hint_check" CHECK ("revealedHintCount" BETWEEN 0 AND 3)
);

CREATE TABLE "ArchitectureQuestionAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "blockQuestionId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "workFingerprint" TEXT NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "evaluatorFingerprint" TEXT NOT NULL,
    "answerSnapshot" JSONB NOT NULL,
    "evaluationSnapshot" JSONB NOT NULL,
    "verificationStatus" "PracticeAttemptVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchitectureQuestionAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureQuestionAttempt_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10))
);

CREATE TABLE "ArchitectureAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "ArchitectureAssessmentStatus" NOT NULL DEFAULT 'LOCKED',
    "schemaVersion" INTEGER NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "evaluatorFingerprint" TEXT NOT NULL,
    "assessmentSnapshot" JSONB,
    "startRequestId" UUID,
    "finalizationRequestId" UUID,
    "readyAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureAssessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureAssessment_schema_check" CHECK ("schemaVersion" > 0)
);

CREATE TABLE "ArchitectureAssessmentReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "evaluatorFingerprint" TEXT NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "transcriptSnapshot" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchitectureAssessmentReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArchitectureAssessmentReport_schema_check" CHECK ("schemaVersion" > 0)
);

CREATE TABLE "ArchitecturePreparationAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "focusRevisionId" UUID NOT NULL,
    "blockId" UUID,
    "requestId" UUID NOT NULL,
    "status" "ArchitecturePreparationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "generatorVersion" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "diagnosticsSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitecturePreparationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchitectureFocusRevision_ownerId_revision_key" ON "ArchitectureFocusRevision"("ownerId", "revision");
CREATE UNIQUE INDEX "ArchitectureFocusRevision_ownerId_focusFingerprint_schemaVersion_key" ON "ArchitectureFocusRevision"("ownerId", "focusFingerprint", "schemaVersion");
CREATE UNIQUE INDEX "ArchitectureFocusRevision_id_ownerId_key" ON "ArchitectureFocusRevision"("id", "ownerId");
CREATE INDEX "ArchitectureFocusRevision_ownerId_confirmedAt_idx" ON "ArchitectureFocusRevision"("ownerId", "confirmedAt");
CREATE INDEX "ArchitectureFocusRevision_baselineSourceFingerprint_idx" ON "ArchitectureFocusRevision"("baselineSourceFingerprint");
CREATE INDEX "CandidateProfile_activeArchitectureFocusRevisionId_idx" ON "CandidateProfile"("activeArchitectureFocusRevisionId");
CREATE UNIQUE INDEX "ArchitectureScenarioVersion_scenarioKey_version_key" ON "ArchitectureScenarioVersion"("scenarioKey", "version");
CREATE UNIQUE INDEX "ArchitectureScenarioVersion_scenarioKey_contentFingerprint_key" ON "ArchitectureScenarioVersion"("scenarioKey", "contentFingerprint");
CREATE INDEX "ArchitectureScenarioVersion_publicationStatus_scenarioKey_idx" ON "ArchitectureScenarioVersion"("publicationStatus", "scenarioKey");
CREATE INDEX "ArchitectureScenarioVersion_contentFingerprint_idx" ON "ArchitectureScenarioVersion"("contentFingerprint");
CREATE UNIQUE INDEX "ArchitectureScenarioProgress_ownerId_scenarioKey_key" ON "ArchitectureScenarioProgress"("ownerId", "scenarioKey");
CREATE INDEX "ArchitectureScenarioProgress_ownerId_status_idx" ON "ArchitectureScenarioProgress"("ownerId", "status");
CREATE UNIQUE INDEX "ArchitectureBlock_ownerId_ordinal_key" ON "ArchitectureBlock"("ownerId", "ordinal");
CREATE UNIQUE INDEX "ArchitectureBlock_ownerId_preparationRequestId_key" ON "ArchitectureBlock"("ownerId", "preparationRequestId");
CREATE UNIQUE INDEX "ArchitectureBlock_id_ownerId_key" ON "ArchitectureBlock"("id", "ownerId");
CREATE UNIQUE INDEX "ArchitectureBlock_one_current_per_owner" ON "ArchitectureBlock"("ownerId") WHERE "isCurrent";
CREATE INDEX "ArchitectureBlock_ownerId_isCurrent_idx" ON "ArchitectureBlock"("ownerId", "isCurrent");
CREATE INDEX "ArchitectureBlock_ownerId_createdAt_idx" ON "ArchitectureBlock"("ownerId", "createdAt");
CREATE INDEX "ArchitectureBlock_scenarioVersionId_idx" ON "ArchitectureBlock"("scenarioVersionId");
CREATE INDEX "ArchitectureBlock_status_idx" ON "ArchitectureBlock"("status");
CREATE UNIQUE INDEX "ArchitectureBlockQuestion_blockId_order_key" ON "ArchitectureBlockQuestion"("blockId", "order");
CREATE UNIQUE INDEX "ArchitectureBlockQuestion_blockId_questionKey_key" ON "ArchitectureBlockQuestion"("blockId", "questionKey");
CREATE UNIQUE INDEX "ArchitectureBlockQuestion_id_ownerId_key" ON "ArchitectureBlockQuestion"("id", "ownerId");
CREATE INDEX "ArchitectureBlockQuestion_ownerId_blockId_idx" ON "ArchitectureBlockQuestion"("ownerId", "blockId");
CREATE INDEX "ArchitectureBlockQuestion_ownerId_status_idx" ON "ArchitectureBlockQuestion"("ownerId", "status");
CREATE INDEX "ArchitectureBlockQuestion_contentFingerprint_idx" ON "ArchitectureBlockQuestion"("contentFingerprint");
CREATE UNIQUE INDEX "ArchitectureQuestionState_blockQuestionId_key" ON "ArchitectureQuestionState"("blockQuestionId");
CREATE UNIQUE INDEX "ArchitectureQuestionState_blockQuestionId_ownerId_key" ON "ArchitectureQuestionState"("blockQuestionId", "ownerId");
CREATE INDEX "ArchitectureQuestionState_ownerId_updatedAt_idx" ON "ArchitectureQuestionState"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "ArchitectureQuestionAttempt_ownerId_requestId_key" ON "ArchitectureQuestionAttempt"("ownerId", "requestId");
CREATE UNIQUE INDEX "ArchitectureQuestionAttempt_id_ownerId_key" ON "ArchitectureQuestionAttempt"("id", "ownerId");
CREATE INDEX "ArchitectureQuestionAttempt_ownerId_blockQuestionId_createdAt_idx" ON "ArchitectureQuestionAttempt"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "ArchitectureQuestionAttempt_ownerId_workFingerprint_idx" ON "ArchitectureQuestionAttempt"("ownerId", "workFingerprint");
CREATE UNIQUE INDEX "ArchitectureAssessment_blockId_key" ON "ArchitectureAssessment"("blockId");
CREATE UNIQUE INDEX "ArchitectureAssessment_ownerId_startRequestId_key" ON "ArchitectureAssessment"("ownerId", "startRequestId");
CREATE UNIQUE INDEX "ArchitectureAssessment_ownerId_finalizationRequestId_key" ON "ArchitectureAssessment"("ownerId", "finalizationRequestId");
CREATE UNIQUE INDEX "ArchitectureAssessment_id_ownerId_key" ON "ArchitectureAssessment"("id", "ownerId");
CREATE UNIQUE INDEX "ArchitectureAssessment_blockId_ownerId_key" ON "ArchitectureAssessment"("blockId", "ownerId");
CREATE INDEX "ArchitectureAssessment_ownerId_status_createdAt_idx" ON "ArchitectureAssessment"("ownerId", "status", "createdAt");
CREATE UNIQUE INDEX "ArchitectureAssessmentReport_assessmentId_key" ON "ArchitectureAssessmentReport"("assessmentId");
CREATE UNIQUE INDEX "ArchitectureAssessmentReport_assessmentId_ownerId_key" ON "ArchitectureAssessmentReport"("assessmentId", "ownerId");
CREATE INDEX "ArchitectureAssessmentReport_ownerId_finalizedAt_idx" ON "ArchitectureAssessmentReport"("ownerId", "finalizedAt");
CREATE UNIQUE INDEX "ArchitecturePreparationAttempt_ownerId_requestId_key" ON "ArchitecturePreparationAttempt"("ownerId", "requestId");
CREATE INDEX "ArchitecturePreparationAttempt_ownerId_status_createdAt_idx" ON "ArchitecturePreparationAttempt"("ownerId", "status", "createdAt");
CREATE INDEX "ArchitecturePreparationAttempt_focusRevisionId_idx" ON "ArchitecturePreparationAttempt"("focusRevisionId");
CREATE INDEX "ArchitecturePreparationAttempt_blockId_idx" ON "ArchitecturePreparationAttempt"("blockId");

ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_activeArchitectureFocusRevisionId_ownerId_fkey" FOREIGN KEY ("activeArchitectureFocusRevisionId", "ownerId") REFERENCES "ArchitectureFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureFocusRevision" ADD CONSTRAINT "ArchitectureFocusRevision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureScenarioVersion" ADD CONSTRAINT "ArchitectureScenarioVersion_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "ArchitectureScenarioDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureScenarioProgress" ADD CONSTRAINT "ArchitectureScenarioProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureScenarioProgress" ADD CONSTRAINT "ArchitectureScenarioProgress_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "ArchitectureScenarioDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureBlock" ADD CONSTRAINT "ArchitectureBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureBlock" ADD CONSTRAINT "ArchitectureBlock_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "ArchitectureFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureBlock" ADD CONSTRAINT "ArchitectureBlock_scenarioVersionId_fkey" FOREIGN KEY ("scenarioVersionId") REFERENCES "ArchitectureScenarioVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureBlockQuestion" ADD CONSTRAINT "ArchitectureBlockQuestion_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "ArchitectureBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureBlockQuestion" ADD CONSTRAINT "ArchitectureBlockQuestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureQuestionState" ADD CONSTRAINT "ArchitectureQuestionState_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "ArchitectureBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureQuestionState" ADD CONSTRAINT "ArchitectureQuestionState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureQuestionAttempt" ADD CONSTRAINT "ArchitectureQuestionAttempt_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "ArchitectureBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureQuestionAttempt" ADD CONSTRAINT "ArchitectureQuestionAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureAssessment" ADD CONSTRAINT "ArchitectureAssessment_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "ArchitectureBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureAssessment" ADD CONSTRAINT "ArchitectureAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureAssessmentReport" ADD CONSTRAINT "ArchitectureAssessmentReport_assessmentId_ownerId_fkey" FOREIGN KEY ("assessmentId", "ownerId") REFERENCES "ArchitectureAssessment"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureAssessmentReport" ADD CONSTRAINT "ArchitectureAssessmentReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitecturePreparationAttempt" ADD CONSTRAINT "ArchitecturePreparationAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitecturePreparationAttempt" ADD CONSTRAINT "ArchitecturePreparationAttempt_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "ArchitectureFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitecturePreparationAttempt" ADD CONSTRAINT "ArchitecturePreparationAttempt_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "ArchitectureBlock"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
