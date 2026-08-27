-- Contextual peer help: a learner stuck on a practice problem asks for a human,
-- and a helper who has already solved that problem can claim the request.

CREATE TYPE "HelpRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'RESOLVED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "HelpRequest" (
    "id" UUID NOT NULL,
    "learnerId" TEXT NOT NULL,
    "questionSlug" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'OPEN',
    "context" JSONB NOT NULL,
    "summary" TEXT,
    "helperId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpRequest_status_expiresAt_idx" ON "HelpRequest"("status", "expiresAt");
CREATE INDEX "HelpRequest_questionSlug_status_idx" ON "HelpRequest"("questionSlug", "status");
CREATE INDEX "HelpRequest_learnerId_createdAt_idx" ON "HelpRequest"("learnerId", "createdAt");
CREATE INDEX "HelpRequest_helperId_idx" ON "HelpRequest"("helperId");

-- One live request per learner per question. Prisma cannot express a partial
-- unique index, so it lives here: without it a learner can spam the helper pool
-- by clicking "Ask someone" repeatedly on the same problem, and the duplicates
-- are indistinguishable from genuine demand. Terminal rows are excluded so the
-- same learner may ask again after a request resolves or expires.
CREATE UNIQUE INDEX "HelpRequest_one_live_per_learner_question"
ON "HelpRequest"("learnerId", "questionSlug")
WHERE "status" IN ('OPEN', 'CLAIMED');

ALTER TABLE "HelpRequest"
ADD CONSTRAINT "HelpRequest_learnerId_fkey"
FOREIGN KEY ("learnerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpRequest"
ADD CONSTRAINT "HelpRequest_questionSlug_fkey"
FOREIGN KEY ("questionSlug") REFERENCES "DsaQuestion"("slug")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HelpSession" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "learnerRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpSession_requestId_key" ON "HelpSession"("requestId");
CREATE UNIQUE INDEX "HelpSession_roomName_key" ON "HelpSession"("roomName");
CREATE INDEX "HelpSession_startedAt_idx" ON "HelpSession"("startedAt");

ALTER TABLE "HelpSession"
ADD CONSTRAINT "HelpSession_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "HelpRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
