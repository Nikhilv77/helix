-- Resume replacement keeps immutable snapshots and an explicit active pointer.
-- Existing interview-profile revisions remain valid; new confirmations attach
-- the original resume projection and file metadata to the same immutable row.
ALTER TABLE "CandidateProfile"
ADD COLUMN "activeResumeVersionId" UUID;

ALTER TABLE "CandidateInterviewProfileVersion"
ADD COLUMN "resumeSnapshot" JSONB,
ADD COLUMN "resumeFileName" TEXT,
ADD COLUMN "resumeMimeType" TEXT,
ADD COLUMN "resumeUploadedAt" TIMESTAMP(3),
ADD COLUMN "resumeConfidence" DOUBLE PRECISION;

CREATE INDEX "CandidateProfile_activeResumeVersionId_idx"
ON "CandidateProfile"("activeResumeVersionId");

ALTER TABLE "CandidateProfile"
ADD CONSTRAINT "CandidateProfile_activeResumeVersionId_fkey"
FOREIGN KEY ("activeResumeVersionId")
REFERENCES "CandidateInterviewProfileVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Best-effort legacy backfill. Old revisions did not retain their original
-- file snapshot, so only the latest row can safely represent the live resume.
UPDATE "CandidateProfile" AS candidate
SET "activeResumeVersionId" = (
  SELECT profile_version."id"
  FROM "CandidateInterviewProfileVersion" AS profile_version
  WHERE profile_version."ownerId" = candidate."ownerId"
  ORDER BY profile_version."revision" DESC
  LIMIT 1
)
WHERE candidate."resumeAnalysis" IS NOT NULL
AND EXISTS (
  SELECT 1
  FROM "CandidateInterviewProfileVersion" AS profile_version
  WHERE profile_version."ownerId" = candidate."ownerId"
);

UPDATE "CandidateInterviewProfileVersion" AS version
SET
  "resumeSnapshot" = candidate."resumeAnalysis",
  "resumeFileName" = candidate."resumeFileName",
  "resumeMimeType" = candidate."resumeMimeType",
  "resumeUploadedAt" = candidate."resumeUploadedAt",
  "resumeConfidence" = candidate."resumeConfidence"
FROM "CandidateProfile" AS candidate
WHERE candidate."activeResumeVersionId" = version."id";
