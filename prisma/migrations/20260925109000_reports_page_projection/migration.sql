-- Reports has its own projection so it never rebuilds Home/Progress/Practice data.
CREATE FUNCTION workspace_reports_mark_dirty() RETURNS trigger AS $$
DECLARE
  affected_owner TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    affected_owner := OLD."ownerId";
    UPDATE "WorkspacePageSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1
    WHERE "ownerId" = affected_owner AND "page" = 'reports';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected_owner := NEW."ownerId";
    IF TG_OP <> 'UPDATE' OR affected_owner IS DISTINCT FROM OLD."ownerId" THEN
      UPDATE "WorkspacePageSnapshot"
      SET "dirtyVersion" = "dirtyVersion" + 1
      WHERE "ownerId" = affected_owner AND "page" = 'reports';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_reports_interview_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "InterviewSession"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_core_assessment_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "CoreTechnicalAssessment"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_core_report_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "CoreTechnicalAssessmentReport"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_profile_dirty
  AFTER UPDATE OF "targetRole", "resumeAnalysis" ON "CandidateProfile"
  FOR EACH ROW
  WHEN ((OLD."targetRole", OLD."resumeAnalysis") IS DISTINCT FROM
        (NEW."targetRole", NEW."resumeAnalysis"))
  EXECUTE FUNCTION workspace_reports_mark_dirty();
