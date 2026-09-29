-- Backend fundamentals join the story-practice engine as a fourth discipline.
ALTER TABLE "AiMlPracticeSession"
  DROP CONSTRAINT "AiMlPracticeSession_discipline_check";

ALTER TABLE "AiMlPracticeSession"
  ADD CONSTRAINT "AiMlPracticeSession_discipline_check"
  CHECK ("discipline" IN ('ai-ml', 'frontend', 'data', 'backend'));
