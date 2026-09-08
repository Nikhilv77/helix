-- Story-driven Applied Engineering persistence. This namespace is deliberately
-- separate from DSA, retired PrepPractice, and Core Technical history.
CREATE TYPE "AppliedEngineeringIncidentPublicationStatus" AS ENUM ('REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "AppliedEngineeringIncidentProgressStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'PREPARING', 'PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "AppliedEngineeringBlockStatus" AS ENUM ('PRACTISING', 'ASSESSMENT_READY', 'ASSESSMENT_IN_PROGRESS', 'ASSESSED');
CREATE TYPE "AppliedEngineeringQuestionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'LEARNED');
CREATE TYPE "AppliedEngineeringPreparationStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED');
CREATE TYPE "AppliedEngineeringAssessmentStatus" AS ENUM ('LOCKED', 'READY', 'IN_PROGRESS', 'FINALIZING', 'COMPLETED');

ALTER TABLE "CandidateProfile" ADD COLUMN "activeAppliedEngineeringFocusRevisionId" UUID;

CREATE TABLE "AppliedEngineeringFocusRevision" (
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
    CONSTRAINT "AppliedEngineeringFocusRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppliedEngineeringFocusRevision_check" CHECK ("revision" > 0 AND "schemaVersion" > 0 AND "baselineSchemaVersion" > 0)
);

CREATE TABLE "AppliedEngineeringIncidentDefinition" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringIncidentDefinition_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AppliedEngineeringIncidentVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incidentKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "publicationStatus" "AppliedEngineeringIncidentPublicationStatus" NOT NULL DEFAULT 'REVIEW',
    "contentFingerprint" TEXT NOT NULL,
    "incidentSnapshot" JSONB NOT NULL,
    "reviewSnapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppliedEngineeringIncidentVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppliedEngineeringIncidentVersion_check" CHECK ("version" > 0 AND "schemaVersion" > 0),
    CONSTRAINT "AppliedEngineeringIncidentVersion_status_dates_check" CHECK (("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL) AND ("publicationStatus" <> 'RETIRED' OR "retiredAt" IS NOT NULL))
);

CREATE TABLE "AppliedEngineeringIncidentProgress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "incidentKey" TEXT NOT NULL,
    "status" "AppliedEngineeringIncidentProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringIncidentProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppliedEngineeringBlock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "AppliedEngineeringBlockStatus" NOT NULL DEFAULT 'PRACTISING',
    "focusRevisionId" UUID NOT NULL,
    "incidentVersionId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "rankingPolicyVersion" INTEGER NOT NULL,
    "preparationRequestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "incidentSnapshot" JSONB NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "assessmentReadyAt" TIMESTAMP(3),
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppliedEngineeringBlock_check" CHECK ("ordinal" > 0 AND "schemaVersion" > 0 AND "rankingPolicyVersion" > 0)
);

CREATE TABLE "AppliedEngineeringBlockQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "status" "AppliedEngineeringQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicSnapshot" JSONB NOT NULL,
    "privateSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "learnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringBlockQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppliedEngineeringBlockQuestion_order_check" CHECK ("order" BETWEEN 1 AND 8),
    CONSTRAINT "AppliedEngineeringBlockQuestion_version_check" CHECK ("contentVersion" > 0),
    CONSTRAINT "AppliedEngineeringBlockQuestion_terminal_check" CHECK (NOT ("completedAt" IS NOT NULL AND "learnedAt" IS NOT NULL))
);

CREATE TABLE "AppliedEngineeringQuestionState" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockQuestionId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "draft" JSONB,
    "revealedHintCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringQuestionState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppliedEngineeringQuestionState_hint_check" CHECK ("revealedHintCount" BETWEEN 0 AND 3)
);

CREATE TABLE "AppliedEngineeringQuestionAttempt" (
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
    CONSTRAINT "AppliedEngineeringQuestionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppliedEngineeringCodeRun" (
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
    CONSTRAINT "AppliedEngineeringCodeRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppliedEngineeringAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "AppliedEngineeringAssessmentStatus" NOT NULL DEFAULT 'LOCKED',
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
    CONSTRAINT "AppliedEngineeringAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppliedEngineeringAssessmentReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "transcriptSnapshot" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppliedEngineeringAssessmentReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppliedEngineeringPreparationAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "focusRevisionId" UUID NOT NULL,
    "blockId" UUID,
    "requestId" UUID NOT NULL,
    "status" "AppliedEngineeringPreparationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "generatorVersion" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "diagnosticsSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedEngineeringPreparationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppliedEngineeringFocusRevision_ownerId_revision_key" ON "AppliedEngineeringFocusRevision"("ownerId", "revision");
CREATE UNIQUE INDEX "AppliedEngineeringFocusRevision_ownerId_focusFingerprint_schemaVersion_key" ON "AppliedEngineeringFocusRevision"("ownerId", "focusFingerprint", "schemaVersion");
CREATE UNIQUE INDEX "AppliedEngineeringFocusRevision_id_ownerId_key" ON "AppliedEngineeringFocusRevision"("id", "ownerId");
CREATE INDEX "AppliedEngineeringFocusRevision_ownerId_confirmedAt_idx" ON "AppliedEngineeringFocusRevision"("ownerId", "confirmedAt");
CREATE INDEX "AppliedEngineeringFocusRevision_baselineSourceFingerprint_idx" ON "AppliedEngineeringFocusRevision"("baselineSourceFingerprint");
CREATE UNIQUE INDEX "AppliedEngineeringIncidentVersion_incidentKey_version_key" ON "AppliedEngineeringIncidentVersion"("incidentKey", "version");
CREATE UNIQUE INDEX "AppliedEngineeringIncidentVersion_incidentKey_contentFingerprint_key" ON "AppliedEngineeringIncidentVersion"("incidentKey", "contentFingerprint");
CREATE INDEX "AppliedEngineeringIncidentVersion_publicationStatus_incidentKey_idx" ON "AppliedEngineeringIncidentVersion"("publicationStatus", "incidentKey");
CREATE INDEX "AppliedEngineeringIncidentVersion_contentFingerprint_idx" ON "AppliedEngineeringIncidentVersion"("contentFingerprint");
CREATE UNIQUE INDEX "AppliedEngineeringIncidentProgress_ownerId_incidentKey_key" ON "AppliedEngineeringIncidentProgress"("ownerId", "incidentKey");
CREATE INDEX "AppliedEngineeringIncidentProgress_ownerId_status_idx" ON "AppliedEngineeringIncidentProgress"("ownerId", "status");
CREATE UNIQUE INDEX "AppliedEngineeringBlock_ownerId_ordinal_key" ON "AppliedEngineeringBlock"("ownerId", "ordinal");
CREATE UNIQUE INDEX "AppliedEngineeringBlock_ownerId_preparationRequestId_key" ON "AppliedEngineeringBlock"("ownerId", "preparationRequestId");
CREATE UNIQUE INDEX "AppliedEngineeringBlock_id_ownerId_key" ON "AppliedEngineeringBlock"("id", "ownerId");
CREATE UNIQUE INDEX "AppliedEngineeringBlock_one_current_per_owner" ON "AppliedEngineeringBlock"("ownerId") WHERE "isCurrent";
CREATE INDEX "AppliedEngineeringBlock_ownerId_isCurrent_idx" ON "AppliedEngineeringBlock"("ownerId", "isCurrent");
CREATE INDEX "AppliedEngineeringBlock_ownerId_createdAt_idx" ON "AppliedEngineeringBlock"("ownerId", "createdAt");
CREATE INDEX "AppliedEngineeringBlock_incidentVersionId_idx" ON "AppliedEngineeringBlock"("incidentVersionId");
CREATE INDEX "AppliedEngineeringBlock_status_idx" ON "AppliedEngineeringBlock"("status");
CREATE UNIQUE INDEX "AppliedEngineeringBlockQuestion_blockId_order_key" ON "AppliedEngineeringBlockQuestion"("blockId", "order");
CREATE UNIQUE INDEX "AppliedEngineeringBlockQuestion_blockId_questionKey_key" ON "AppliedEngineeringBlockQuestion"("blockId", "questionKey");
CREATE UNIQUE INDEX "AppliedEngineeringBlockQuestion_id_ownerId_key" ON "AppliedEngineeringBlockQuestion"("id", "ownerId");
CREATE INDEX "AppliedEngineeringBlockQuestion_ownerId_blockId_idx" ON "AppliedEngineeringBlockQuestion"("ownerId", "blockId");
CREATE INDEX "AppliedEngineeringBlockQuestion_ownerId_status_idx" ON "AppliedEngineeringBlockQuestion"("ownerId", "status");
CREATE INDEX "AppliedEngineeringBlockQuestion_contentFingerprint_idx" ON "AppliedEngineeringBlockQuestion"("contentFingerprint");
CREATE UNIQUE INDEX "AppliedEngineeringQuestionState_blockQuestionId_key" ON "AppliedEngineeringQuestionState"("blockQuestionId");
CREATE UNIQUE INDEX "AppliedEngineeringQuestionState_blockQuestionId_ownerId_key" ON "AppliedEngineeringQuestionState"("blockQuestionId", "ownerId");
CREATE INDEX "AppliedEngineeringQuestionState_ownerId_updatedAt_idx" ON "AppliedEngineeringQuestionState"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "AppliedEngineeringQuestionAttempt_ownerId_requestId_key" ON "AppliedEngineeringQuestionAttempt"("ownerId", "requestId");
CREATE UNIQUE INDEX "AppliedEngineeringQuestionAttempt_id_ownerId_key" ON "AppliedEngineeringQuestionAttempt"("id", "ownerId");
CREATE INDEX "AppliedEngineeringQuestionAttempt_ownerId_blockQuestionId_create_idx" ON "AppliedEngineeringQuestionAttempt"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "AppliedEngineeringQuestionAttempt_ownerId_workFingerprint_idx" ON "AppliedEngineeringQuestionAttempt"("ownerId", "workFingerprint");
CREATE UNIQUE INDEX "AppliedEngineeringCodeRun_ownerId_requestId_key" ON "AppliedEngineeringCodeRun"("ownerId", "requestId");
CREATE UNIQUE INDEX "AppliedEngineeringCodeRun_id_ownerId_key" ON "AppliedEngineeringCodeRun"("id", "ownerId");
CREATE INDEX "AppliedEngineeringCodeRun_ownerId_blockQuestionId_createdAt_idx" ON "AppliedEngineeringCodeRun"("ownerId", "blockQuestionId", "createdAt");
CREATE INDEX "AppliedEngineeringCodeRun_ownerId_codeFingerprint_idx" ON "AppliedEngineeringCodeRun"("ownerId", "codeFingerprint");
CREATE UNIQUE INDEX "AppliedEngineeringAssessment_blockId_key" ON "AppliedEngineeringAssessment"("blockId");
CREATE UNIQUE INDEX "AppliedEngineeringAssessment_ownerId_startRequestId_key" ON "AppliedEngineeringAssessment"("ownerId", "startRequestId");
CREATE UNIQUE INDEX "AppliedEngineeringAssessment_ownerId_finalizationRequestId_key" ON "AppliedEngineeringAssessment"("ownerId", "finalizationRequestId");
CREATE UNIQUE INDEX "AppliedEngineeringAssessment_id_ownerId_key" ON "AppliedEngineeringAssessment"("id", "ownerId");
CREATE UNIQUE INDEX "AppliedEngineeringAssessment_blockId_ownerId_key" ON "AppliedEngineeringAssessment"("blockId", "ownerId");
CREATE INDEX "AppliedEngineeringAssessment_ownerId_status_createdAt_idx" ON "AppliedEngineeringAssessment"("ownerId", "status", "createdAt");
CREATE UNIQUE INDEX "AppliedEngineeringAssessmentReport_assessmentId_key" ON "AppliedEngineeringAssessmentReport"("assessmentId");
CREATE UNIQUE INDEX "AppliedEngineeringAssessmentReport_assessmentId_ownerId_key" ON "AppliedEngineeringAssessmentReport"("assessmentId", "ownerId");
CREATE INDEX "AppliedEngineeringAssessmentReport_ownerId_finalizedAt_idx" ON "AppliedEngineeringAssessmentReport"("ownerId", "finalizedAt");
CREATE UNIQUE INDEX "AppliedEngineeringPreparationAttempt_ownerId_requestId_key" ON "AppliedEngineeringPreparationAttempt"("ownerId", "requestId");
CREATE INDEX "AppliedEngineeringPreparationAttempt_ownerId_status_createdAt_idx" ON "AppliedEngineeringPreparationAttempt"("ownerId", "status", "createdAt");
CREATE INDEX "AppliedEngineeringPreparationAttempt_focusRevisionId_idx" ON "AppliedEngineeringPreparationAttempt"("focusRevisionId");
CREATE INDEX "AppliedEngineeringPreparationAttempt_blockId_idx" ON "AppliedEngineeringPreparationAttempt"("blockId");

ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_activeAppliedEngineeringFocusRevisionId_fkey" FOREIGN KEY ("activeAppliedEngineeringFocusRevisionId") REFERENCES "AppliedEngineeringFocusRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringFocusRevision" ADD CONSTRAINT "AppliedEngineeringFocusRevision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringIncidentVersion" ADD CONSTRAINT "AppliedEngineeringIncidentVersion_incidentKey_fkey" FOREIGN KEY ("incidentKey") REFERENCES "AppliedEngineeringIncidentDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringIncidentProgress" ADD CONSTRAINT "AppliedEngineeringIncidentProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringIncidentProgress" ADD CONSTRAINT "AppliedEngineeringIncidentProgress_incidentKey_fkey" FOREIGN KEY ("incidentKey") REFERENCES "AppliedEngineeringIncidentDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringBlock" ADD CONSTRAINT "AppliedEngineeringBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringBlock" ADD CONSTRAINT "AppliedEngineeringBlock_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "AppliedEngineeringFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringBlock" ADD CONSTRAINT "AppliedEngineeringBlock_incidentVersionId_fkey" FOREIGN KEY ("incidentVersionId") REFERENCES "AppliedEngineeringIncidentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringBlockQuestion" ADD CONSTRAINT "AppliedEngineeringBlockQuestion_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "AppliedEngineeringBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringBlockQuestion" ADD CONSTRAINT "AppliedEngineeringBlockQuestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringQuestionState" ADD CONSTRAINT "AppliedEngineeringQuestionState_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "AppliedEngineeringBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringQuestionState" ADD CONSTRAINT "AppliedEngineeringQuestionState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringQuestionAttempt" ADD CONSTRAINT "AppliedEngineeringQuestionAttempt_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "AppliedEngineeringBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringQuestionAttempt" ADD CONSTRAINT "AppliedEngineeringQuestionAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringCodeRun" ADD CONSTRAINT "AppliedEngineeringCodeRun_blockQuestionId_ownerId_fkey" FOREIGN KEY ("blockQuestionId", "ownerId") REFERENCES "AppliedEngineeringBlockQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringCodeRun" ADD CONSTRAINT "AppliedEngineeringCodeRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringAssessment" ADD CONSTRAINT "AppliedEngineeringAssessment_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "AppliedEngineeringBlock"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringAssessment" ADD CONSTRAINT "AppliedEngineeringAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringAssessmentReport" ADD CONSTRAINT "AppliedEngineeringAssessmentReport_assessmentId_ownerId_fkey" FOREIGN KEY ("assessmentId", "ownerId") REFERENCES "AppliedEngineeringAssessment"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringAssessmentReport" ADD CONSTRAINT "AppliedEngineeringAssessmentReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringPreparationAttempt" ADD CONSTRAINT "AppliedEngineeringPreparationAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringPreparationAttempt" ADD CONSTRAINT "AppliedEngineeringPreparationAttempt_focusRevisionId_ownerId_fkey" FOREIGN KEY ("focusRevisionId", "ownerId") REFERENCES "AppliedEngineeringFocusRevision"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppliedEngineeringPreparationAttempt" ADD CONSTRAINT "AppliedEngineeringPreparationAttempt_blockId_ownerId_fkey" FOREIGN KEY ("blockId", "ownerId") REFERENCES "AppliedEngineeringBlock"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
