-- Persist immutable Core Technical track revisions and keep only an active pointer
-- on the mutable candidate profile. Future block rows will copy the selected
-- revision into their own frozen snapshot.
CREATE TABLE "CoreTechnicalTrackVersion" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "trackKey" TEXT NOT NULL,
    "targetRoleFamily" TEXT NOT NULL,
    "targetRoleTitle" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "primaryLanguage" TEXT NOT NULL,
    "runtime" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secondaryTechnologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL,
    "resumeFingerprint" TEXT,
    "targetJobFingerprint" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoreTechnicalTrackVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CandidateProfile"
ADD COLUMN "activeCoreTechnicalTrackVersionId" UUID;

CREATE UNIQUE INDEX "CoreTechnicalTrackVersion_ownerId_revision_key"
ON "CoreTechnicalTrackVersion"("ownerId", "revision");

CREATE UNIQUE INDEX "CoreTechnicalTrackVersion_ownerId_id_key"
ON "CoreTechnicalTrackVersion"("ownerId", "id");

CREATE INDEX "CoreTechnicalTrackVersion_ownerId_confirmedAt_idx"
ON "CoreTechnicalTrackVersion"("ownerId", "confirmedAt");

CREATE INDEX "CoreTechnicalTrackVersion_primaryLanguage_runtime_idx"
ON "CoreTechnicalTrackVersion"("primaryLanguage", "runtime");

CREATE INDEX "CandidateProfile_activeCoreTechnicalTrackVersionId_idx"
ON "CandidateProfile"("activeCoreTechnicalTrackVersionId");

ALTER TABLE "CoreTechnicalTrackVersion"
ADD CONSTRAINT "CoreTechnicalTrackVersion_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateProfile"
ADD CONSTRAINT "CandidateProfile_activeCoreTechnicalTrackVersionId_fkey"
FOREIGN KEY ("activeCoreTechnicalTrackVersionId") REFERENCES "CoreTechnicalTrackVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

