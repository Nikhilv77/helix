-- Resume Roast targets are user preferences; each analysis is stored as a
-- separate owner-scoped history row tied to the resume revision it reviewed.
CREATE TYPE "ResumeRoastStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

CREATE TABLE "ResumeRoastTarget" (
    "ownerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "companyEnvironment" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeRoastTarget_pkey" PRIMARY KEY ("ownerId")
);

CREATE TABLE "ResumeRoast" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "resumeProfileVersionId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "companyEnvironment" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "ResumeRoastStatus" NOT NULL DEFAULT 'GENERATING',
    "generationToken" UUID,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeRoast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResumeRoast_ownerId_status_createdAt_idx"
ON "ResumeRoast"("ownerId", "status", "createdAt");

CREATE INDEX "ResumeRoast_resumeProfileVersionId_idx"
ON "ResumeRoast"("resumeProfileVersionId");

CREATE UNIQUE INDEX "CandidateInterviewProfileVersion_ownerId_id_key"
ON "CandidateInterviewProfileVersion"("ownerId", "id");

ALTER TABLE "ResumeRoastTarget"
ADD CONSTRAINT "ResumeRoastTarget_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResumeRoast"
ADD CONSTRAINT "ResumeRoast_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResumeRoast"
ADD CONSTRAINT "ResumeRoast_ownerId_resumeProfileVersionId_fkey"
FOREIGN KEY ("ownerId", "resumeProfileVersionId") REFERENCES "CandidateInterviewProfileVersion"("ownerId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
