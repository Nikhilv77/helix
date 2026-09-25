-- Local drafts and revealed hints do not change the Practice landing cards.
DROP TRIGGER practice_home_dirty ON "CoreTechnicalQuestionState";
DROP TRIGGER practice_home_dirty ON "AppliedEngineeringQuestionState";
DROP TRIGGER practice_home_dirty ON "ArchitectureQuestionState";

DROP TRIGGER practice_home_dirty ON "AiMlPracticeQuestion";
CREATE TRIGGER practice_home_dirty
  AFTER INSERT OR UPDATE OF "status", "completedAt", "learnedAt", "sessionId"
  ON "AiMlPracticeQuestion"
  FOR EACH ROW EXECUTE FUNCTION practice_home_mark_dirty();
