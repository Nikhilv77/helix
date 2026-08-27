CREATE TABLE "CandidatePracticeEvidenceVersion" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "sourceAttemptFingerprint" TEXT NOT NULL,
    "verifiedAttemptCount" INTEGER NOT NULL,
    "verifiedQuestionCount" INTEGER NOT NULL,
    "evidence" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidatePracticeEvidenceVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidatePracticeEvidenceVersion_ownerId_revision_key"
ON "CandidatePracticeEvidenceVersion"("ownerId", "revision");

CREATE UNIQUE INDEX "CandidatePracticeEvidenceVersion_ownerId_sourceAttemptFingerprint_schemaVersion_key"
ON "CandidatePracticeEvidenceVersion"("ownerId", "sourceAttemptFingerprint", "schemaVersion");

CREATE INDEX "CandidatePracticeEvidenceVersion_ownerId_generatedAt_idx"
ON "CandidatePracticeEvidenceVersion"("ownerId", "generatedAt");

CREATE INDEX "CandidatePracticeEvidenceVersion_sourceAttemptFingerprint_idx"
ON "CandidatePracticeEvidenceVersion"("sourceAttemptFingerprint");

ALTER TABLE "CandidatePracticeEvidenceVersion"
ADD CONSTRAINT "CandidatePracticeEvidenceVersion_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
