-- The teacher's one-time Overview tour after onboarding.
ALTER TABLE "CandidateProfile" ADD COLUMN "overviewIntroducedAt" TIMESTAMP(3);

-- People who finished onboarding before this release already know the
-- Overview; only new learners hear the tour.
UPDATE "CandidateProfile"
SET "overviewIntroducedAt" = "preparationOnboardingCompletedAt"
WHERE "preparationOnboardingCompletedAt" IS NOT NULL;
