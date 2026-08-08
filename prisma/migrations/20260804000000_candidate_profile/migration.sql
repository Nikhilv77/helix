-- CandidateProfile was created with `db push` rather than a migration, so the
-- table existed on developer databases while no migration ever produced it.
-- Building a fresh database failed at `20260805000000_candidate_curriculum`,
-- which alters a table nothing had created.
--
-- `IF NOT EXISTS` throughout, so this is a no-op on databases that already
-- have the table and only does real work on a fresh one.
--
-- `curriculum` and `curriculumBuiltAt` are deliberately absent: the very next
-- migration adds them, and it is not idempotent.
CREATE TABLE IF NOT EXISTS "CandidateProfile" (
    "ownerId" TEXT NOT NULL,
    "targetRole" TEXT,
    "level" TEXT,
    "targetCompany" TEXT,
    "targetDate" TIMESTAMP(3),
    "headline" TEXT,
    "context" TEXT,
    "focusAreas" JSONB NOT NULL,
    "stories" JSONB NOT NULL,
    "resumeFileName" TEXT,
    "resumeMimeType" TEXT,
    "resumeAnalysis" JSONB,
    "resumeUploadedAt" TIMESTAMP(3),
    "resumeVerifiedAt" TIMESTAMP(3),
    "resumeConfidence" DOUBLE PRECISION,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("ownerId")
);

CREATE INDEX IF NOT EXISTS "CandidateProfile_updatedAt_idx" ON "CandidateProfile"("updatedAt");
