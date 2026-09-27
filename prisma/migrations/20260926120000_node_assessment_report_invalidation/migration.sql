-- Reports lists Applied Engineering and Architecture assessments beside Core
-- Technical, so their assessments and reports must refresh the Reports page.
CREATE TRIGGER workspace_reports_applied_assessment_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "AppliedEngineeringAssessment"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_applied_report_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "AppliedEngineeringAssessmentReport"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_architecture_assessment_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "ArchitectureAssessment"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();
CREATE TRIGGER workspace_reports_architecture_report_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "ArchitectureAssessmentReport"
  FOR EACH ROW EXECUTE FUNCTION workspace_reports_mark_dirty();

-- The Interviews page history now includes Architecture assessments, as it
-- already did Core Technical and Applied Engineering ones.
CREATE FUNCTION workspace_interviews_mark_dirty() RETURNS trigger AS $$
DECLARE
  affected_owner TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    affected_owner := OLD."ownerId";
    UPDATE "WorkspacePageSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1
    WHERE "ownerId" = affected_owner AND "page" = 'interviews';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected_owner := NEW."ownerId";
    IF TG_OP <> 'UPDATE' OR affected_owner IS DISTINCT FROM OLD."ownerId" THEN
      UPDATE "WorkspacePageSnapshot"
      SET "dirtyVersion" = "dirtyVersion" + 1
      WHERE "ownerId" = affected_owner AND "page" = 'interviews';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_interviews_architecture_assessment_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "ArchitectureAssessment"
  FOR EACH ROW EXECUTE FUNCTION workspace_interviews_mark_dirty();
