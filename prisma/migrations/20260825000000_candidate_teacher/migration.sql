-- The teacher a candidate picks at the start of onboarding. Stored as the
-- persona id from src/lib/avatars/personas.ts rather than a foreign key: the
-- cast is code, not data, and a retired persona should degrade to the default
-- rather than break the profile row.

ALTER TABLE "CandidateProfile" ADD COLUMN "teacherId" TEXT;
