-- Retire the fixed-bank non-DSA Practice flow without deleting candidate
-- attempts, notes, placements, or templates that may be needed for history.
UPDATE "PrepQuestionTemplate"
SET "publicationStatus" = 'ARCHIVED'
WHERE "publicationStatus" <> 'ARCHIVED';

-- The abandoned fixed-track WIP reached some development databases before its
-- code was retired. Preserve those rows as history while removing active pointers.
UPDATE "PrepPracticeBlock"
SET "isCurrent" = false
WHERE "isCurrent" = true;

UPDATE "CandidateProfile"
SET "activeCoreTechnicalTrackVersionId" = NULL
WHERE "activeCoreTechnicalTrackVersionId" IS NOT NULL;

-- The active Practice projection is DSA-only. Keep the old session progress
-- rows intact, but make their retired availability explicit for other readers.
UPDATE "UserSessionProgress"
SET "availability" = 'UNAVAILABLE'
WHERE "practiceSessionKey" IS NOT NULL
  AND "practiceSessionKey" NOT IN ('dsa', 'frontend-dsa');
