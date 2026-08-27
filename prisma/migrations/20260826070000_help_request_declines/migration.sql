-- A decline is per helper, not a request lifecycle state: one person passing
-- must never close the learner's request for everybody else.

CREATE TABLE "HelpRequestDecline" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "helperId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpRequestDecline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpRequestDecline_requestId_helperId_key"
ON "HelpRequestDecline"("requestId", "helperId");

CREATE INDEX "HelpRequestDecline_helperId_createdAt_idx"
ON "HelpRequestDecline"("helperId", "createdAt");

ALTER TABLE "HelpRequestDecline"
ADD CONSTRAINT "HelpRequestDecline_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "HelpRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpRequestDecline"
ADD CONSTRAINT "HelpRequestDecline_helperId_fkey"
FOREIGN KEY ("helperId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;
