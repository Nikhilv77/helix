-- Presence: who has Trailgrad open right now, so help invitations reach
-- people who can actually answer within the request's ten-minute window.
CREATE TABLE "HelpPresence" (
  "ownerId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpPresence_pkey" PRIMARY KEY ("ownerId")
);
CREATE INDEX "HelpPresence_lastSeenAt_idx" ON "HelpPresence"("lastSeenAt");
ALTER TABLE "HelpPresence"
  ADD CONSTRAINT "HelpPresence_ownerId_fkey" FOREIGN KEY ("ownerId")
  REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- The status check reads each participant's newest change with one index
-- step instead of aggregating their whole help history every 15 seconds.
CREATE INDEX "HelpRequest_learnerId_updatedAt_idx" ON "HelpRequest"("learnerId", "updatedAt");
CREATE INDEX "HelpRequest_helperId_updatedAt_idx" ON "HelpRequest"("helperId", "updatedAt");

-- Live rows are few; these answer "is anything live?" for the status check
-- and helper matching's availability filters without scanning history.
CREATE INDEX "HelpRequest_live_learner_idx" ON "HelpRequest"("learnerId")
  WHERE "status" IN ('OPEN'::"HelpRequestStatus", 'CLAIMED'::"HelpRequestStatus");
CREATE INDEX "HelpRequest_live_helper_idx" ON "HelpRequest"("helperId")
  WHERE "status" IN ('OPEN'::"HelpRequestStatus", 'CLAIMED'::"HelpRequestStatus");
