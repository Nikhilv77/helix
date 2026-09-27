-- Written assessments for finished Frontend, Data, and AI/ML story paths.
CREATE TYPE "StoryTrackAssessmentStatus" AS ENUM ('IN_PROGRESS', 'FINALIZING', 'COMPLETED');

CREATE TABLE "StoryTrackAssessment" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "discipline" VARCHAR(16) NOT NULL,
    "track" "AiMlPracticeTrack" NOT NULL,
    "pathKey" TEXT NOT NULL,
    "status" "StoryTrackAssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "schemaVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "report" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryTrackAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryTrackAssessment_ownerId_discipline_track_pathKey_key"
  ON "StoryTrackAssessment"("ownerId", "discipline", "track", "pathKey");
CREATE INDEX "StoryTrackAssessment_ownerId_completedAt_idx"
  ON "StoryTrackAssessment"("ownerId", "completedAt");

ALTER TABLE "StoryTrackAssessment"
  ADD CONSTRAINT "StoryTrackAssessment_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
  ON DELETE CASCADE ON UPDATE CASCADE;
