-- Draft text, hint reveals, request summaries, and live room collaboration
-- autosaves do not change candidate analytics. Avoid invalidating on them.
DROP TRIGGER candidate_analytics_dirty ON "UserQuestionProgress";
CREATE TRIGGER candidate_analytics_dirty
  AFTER INSERT OR DELETE OR UPDATE OF
    "status", "attemptCount", "bestScore", "lastAttemptedAt", "completedAt", "roadmapId"
  ON "UserQuestionProgress" FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty();

DROP TRIGGER candidate_analytics_dirty ON "AiMlPracticeQuestion";
CREATE TRIGGER candidate_analytics_dirty
  AFTER INSERT OR DELETE OR UPDATE OF "status", "completedAt", "learnedAt", "sessionId"
  ON "AiMlPracticeQuestion" FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty();

DROP TRIGGER candidate_analytics_dirty ON "HelpRequest";
CREATE TRIGGER candidate_analytics_dirty
  AFTER INSERT OR DELETE OR UPDATE OF
    "status", "learnerId", "helperId", "claimedAt", "resolvedAt", "closedAt"
  ON "HelpRequest" FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty();

DROP TRIGGER candidate_analytics_dirty ON "HelpSession";
CREATE TRIGGER candidate_analytics_dirty
  AFTER INSERT OR DELETE OR UPDATE OF
    "learnerJoinedAt", "helperJoinedAt", "endedAt", "endedReason",
    "learnerRating", "helperWaitCreditAt"
  ON "HelpSession" FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty();
