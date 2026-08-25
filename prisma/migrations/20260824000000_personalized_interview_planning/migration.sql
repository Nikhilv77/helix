-- Additive storage for immutable candidate interview profiles and personalized
-- five-session plans. Existing CandidateProfile rows remain valid and are
-- backfilled lazily by the application when the new planner is first opened.

CREATE TYPE "PersonalizedInterviewPlanStatus" AS ENUM ('DRAFT', 'READY', 'SUPERSEDED');

CREATE TYPE "PersonalizedInterviewSessionKind" AS ENUM (
  'PROBLEM_SOLVING',
  'CORE_TECHNICAL',
  'APPLIED_ENGINEERING',
  'ARCHITECTURE_SYSTEM_DESIGN',
  'FINAL_MOCK'
);

CREATE TABLE "CandidateInterviewProfileVersion" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "sourceResumeFingerprint" TEXT NOT NULL,
  "profile" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CandidateInterviewProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonalizedInterviewPlanVersion" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "profileVersionId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "status" "PersonalizedInterviewPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceSnapshot" JSONB NOT NULL,
  "rationale" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalizedInterviewPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewSessionBlueprint" (
  "id" UUID NOT NULL,
  "planVersionId" UUID NOT NULL,
  "kind" "PersonalizedInterviewSessionKind" NOT NULL,
  "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "difficulty" TEXT NOT NULL,
  "blueprint" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InterviewSessionBlueprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateInterviewProfileVersion_ownerId_revision_key"
  ON "CandidateInterviewProfileVersion"("ownerId", "revision");

CREATE UNIQUE INDEX "CandidateInterviewProfileVersion_ownerId_sourceResumeFingerprint_schemaVersion_key"
  ON "CandidateInterviewProfileVersion"("ownerId", "sourceResumeFingerprint", "schemaVersion");

CREATE INDEX "CandidateInterviewProfileVersion_ownerId_generatedAt_idx"
  ON "CandidateInterviewProfileVersion"("ownerId", "generatedAt");

CREATE INDEX "CandidateInterviewProfileVersion_sourceResumeFingerprint_idx"
  ON "CandidateInterviewProfileVersion"("sourceResumeFingerprint");

CREATE UNIQUE INDEX "PersonalizedInterviewPlanVersion_ownerId_revision_key"
  ON "PersonalizedInterviewPlanVersion"("ownerId", "revision");

CREATE INDEX "PersonalizedInterviewPlanVersion_ownerId_status_idx"
  ON "PersonalizedInterviewPlanVersion"("ownerId", "status");

CREATE INDEX "PersonalizedInterviewPlanVersion_profileVersionId_idx"
  ON "PersonalizedInterviewPlanVersion"("profileVersionId");

CREATE INDEX "PersonalizedInterviewPlanVersion_generatedAt_idx"
  ON "PersonalizedInterviewPlanVersion"("generatedAt");

-- The store supersedes the previous READY row in the same transaction before
-- inserting the next revision. This index is the final concurrency guard.
CREATE UNIQUE INDEX "PersonalizedInterviewPlanVersion_one_ready_per_owner"
  ON "PersonalizedInterviewPlanVersion"("ownerId")
  WHERE "status" = 'READY';

CREATE UNIQUE INDEX "InterviewSessionBlueprint_planVersionId_kind_key"
  ON "InterviewSessionBlueprint"("planVersionId", "kind");

CREATE UNIQUE INDEX "InterviewSessionBlueprint_planVersionId_order_key"
  ON "InterviewSessionBlueprint"("planVersionId", "order");

CREATE INDEX "InterviewSessionBlueprint_planVersionId_idx"
  ON "InterviewSessionBlueprint"("planVersionId");

CREATE INDEX "InterviewSessionBlueprint_kind_idx"
  ON "InterviewSessionBlueprint"("kind");

ALTER TABLE "CandidateInterviewProfileVersion"
  ADD CONSTRAINT "CandidateInterviewProfileVersion_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalizedInterviewPlanVersion"
  ADD CONSTRAINT "PersonalizedInterviewPlanVersion_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalizedInterviewPlanVersion"
  ADD CONSTRAINT "PersonalizedInterviewPlanVersion_profileVersionId_fkey"
  FOREIGN KEY ("profileVersionId") REFERENCES "CandidateInterviewProfileVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InterviewSessionBlueprint"
  ADD CONSTRAINT "InterviewSessionBlueprint_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "PersonalizedInterviewPlanVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
