-- Versioned performance profiles close the personalized interview feedback
-- loop. Each row is an immutable aggregate of completed session evidence.

CREATE TABLE "CandidatePerformanceProfileVersion" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "sourceSessionFingerprint" TEXT NOT NULL,
  "completedSessionCount" INTEGER NOT NULL,
  "answeredQuestionCount" INTEGER NOT NULL,
  "profile" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CandidatePerformanceProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidatePerformanceProfileVersion_ownerId_revision_key"
  ON "CandidatePerformanceProfileVersion"("ownerId", "revision");

CREATE UNIQUE INDEX "CandidatePerformanceProfileVersion_ownerId_sourceSessionFingerprint_schemaVersion_key"
  ON "CandidatePerformanceProfileVersion"("ownerId", "sourceSessionFingerprint", "schemaVersion");

CREATE INDEX "CandidatePerformanceProfileVersion_ownerId_generatedAt_idx"
  ON "CandidatePerformanceProfileVersion"("ownerId", "generatedAt");

CREATE INDEX "CandidatePerformanceProfileVersion_sourceSessionFingerprint_idx"
  ON "CandidatePerformanceProfileVersion"("sourceSessionFingerprint");

ALTER TABLE "CandidatePerformanceProfileVersion"
  ADD CONSTRAINT "CandidatePerformanceProfileVersion_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
  ON DELETE CASCADE ON UPDATE CASCADE;
