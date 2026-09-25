-- A change to appearance, notification preferences, or the DSA editor does
-- not change the Interviews or Roastumé page data. Keep their prepared pages
-- warm when those settings are saved.
DROP TRIGGER workspace_page_snapshot_profile_dirty ON "CandidateProfile";

CREATE TRIGGER workspace_page_snapshot_profile_dirty
  AFTER UPDATE OF "targetRole", "level", "targetCompany", "targetDate",
    "headline", "context", "focusAreas", "stories", "resumeAnalysis",
    "activeResumeVersionId", "onboardingCompletedAt", "preparationOnboarding",
    "resumeFileName", "resumeMimeType", "resumeUploadedAt", "resumeVerifiedAt",
    "resumeConfidence", "activeCoreTechnicalTrackVersionId",
    "activeCoreTechnicalFocusRevisionId", "activeAppliedEngineeringFocusRevisionId",
    "activeArchitectureFocusRevisionId", "curriculum", "curriculumBuiltAt"
  ON "CandidateProfile"
  FOR EACH ROW
  WHEN (
    (OLD."targetRole", OLD."level", OLD."targetCompany", OLD."targetDate",
     OLD."headline", OLD."context", OLD."focusAreas", OLD."stories",
     OLD."resumeAnalysis", OLD."activeResumeVersionId", OLD."onboardingCompletedAt",
     OLD."preparationOnboarding", OLD."resumeFileName", OLD."resumeMimeType",
     OLD."resumeUploadedAt", OLD."resumeVerifiedAt", OLD."resumeConfidence",
     OLD."activeCoreTechnicalTrackVersionId", OLD."activeCoreTechnicalFocusRevisionId",
     OLD."activeAppliedEngineeringFocusRevisionId", OLD."activeArchitectureFocusRevisionId",
     OLD."curriculum", OLD."curriculumBuiltAt")
    IS DISTINCT FROM
    (NEW."targetRole", NEW."level", NEW."targetCompany", NEW."targetDate",
     NEW."headline", NEW."context", NEW."focusAreas", NEW."stories",
     NEW."resumeAnalysis", NEW."activeResumeVersionId", NEW."onboardingCompletedAt",
     NEW."preparationOnboarding", NEW."resumeFileName", NEW."resumeMimeType",
     NEW."resumeUploadedAt", NEW."resumeVerifiedAt", NEW."resumeConfidence",
     NEW."activeCoreTechnicalTrackVersionId", NEW."activeCoreTechnicalFocusRevisionId",
     NEW."activeAppliedEngineeringFocusRevisionId", NEW."activeArchitectureFocusRevisionId",
     NEW."curriculum", NEW."curriculumBuiltAt")
  )
  EXECUTE FUNCTION workspace_page_snapshot_mark_dirty();
