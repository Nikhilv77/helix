-- Frontend and data story practice reuse the AI/ML cohort tables. A session is
-- now unique per owner, discipline, and track; existing rows are AI/ML.
ALTER TABLE "AiMlPracticeSession"
  ADD COLUMN "discipline" VARCHAR(16) NOT NULL DEFAULT 'ai-ml';

ALTER TABLE "AiMlPracticeSession"
  ADD CONSTRAINT "AiMlPracticeSession_discipline_check"
  CHECK ("discipline" IN ('ai-ml', 'frontend', 'data'));

DROP INDEX "AiMlPracticeSession_ownerId_track_key";
CREATE UNIQUE INDEX "AiMlPracticeSession_ownerId_discipline_track_key"
  ON "AiMlPracticeSession"("ownerId", "discipline", "track");
