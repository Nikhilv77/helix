-- Appearance and notification settings do not change Home or Practice data.
-- Profile updates frequently include unchanged fields, so compare values too.
DROP TRIGGER candidate_analytics_dirty ON "CandidateProfile";
CREATE TRIGGER candidate_analytics_profile_insert_delete
  AFTER INSERT OR DELETE ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty();
CREATE TRIGGER candidate_analytics_profile_relevant_update
  AFTER UPDATE OF "targetRole", "level", "targetCompany", "targetDate", "headline",
    "context", "focusAreas", "stories", "resumeAnalysis", "activeResumeVersionId",
    "onboardingCompletedAt", "preparationOnboarding", "resumeFileName",
    "resumeUploadedAt", "resumeConfidence", "resumeMimeType"
  ON "CandidateProfile"
  FOR EACH ROW
  WHEN (
    (OLD."targetRole", OLD."level", OLD."targetCompany", OLD."targetDate",
     OLD."headline", OLD."context", OLD."focusAreas", OLD."stories",
     OLD."resumeAnalysis", OLD."activeResumeVersionId", OLD."onboardingCompletedAt",
     OLD."preparationOnboarding", OLD."resumeFileName", OLD."resumeUploadedAt",
     OLD."resumeConfidence", OLD."resumeMimeType")
    IS DISTINCT FROM
    (NEW."targetRole", NEW."level", NEW."targetCompany", NEW."targetDate",
     NEW."headline", NEW."context", NEW."focusAreas", NEW."stories",
     NEW."resumeAnalysis", NEW."activeResumeVersionId", NEW."onboardingCompletedAt",
     NEW."preparationOnboarding", NEW."resumeFileName", NEW."resumeUploadedAt",
     NEW."resumeConfidence", NEW."resumeMimeType")
  )
  EXECUTE FUNCTION candidate_analytics_mark_dirty();

DROP TRIGGER practice_home_dirty ON "CandidateProfile";
CREATE TRIGGER practice_home_profile_insert
  AFTER INSERT ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION practice_home_mark_dirty();
CREATE TRIGGER practice_home_profile_relevant_update
  AFTER UPDATE OF "targetRole", "level", "targetCompany", "targetDate", "headline",
    "context", "focusAreas", "stories", "resumeAnalysis", "activeResumeVersionId",
    "onboardingCompletedAt", "preparationOnboarding", "resumeFileName",
    "resumeUploadedAt", "resumeConfidence", "resumeMimeType"
  ON "CandidateProfile"
  FOR EACH ROW
  WHEN (
    (OLD."targetRole", OLD."level", OLD."targetCompany", OLD."targetDate",
     OLD."headline", OLD."context", OLD."focusAreas", OLD."stories",
     OLD."resumeAnalysis", OLD."activeResumeVersionId", OLD."onboardingCompletedAt",
     OLD."preparationOnboarding", OLD."resumeFileName", OLD."resumeUploadedAt",
     OLD."resumeConfidence", OLD."resumeMimeType")
    IS DISTINCT FROM
    (NEW."targetRole", NEW."level", NEW."targetCompany", NEW."targetDate",
     NEW."headline", NEW."context", NEW."focusAreas", NEW."stories",
     NEW."resumeAnalysis", NEW."activeResumeVersionId", NEW."onboardingCompletedAt",
     NEW."preparationOnboarding", NEW."resumeFileName", NEW."resumeUploadedAt",
     NEW."resumeConfidence", NEW."resumeMimeType")
  )
  EXECUTE FUNCTION practice_home_mark_dirty();
