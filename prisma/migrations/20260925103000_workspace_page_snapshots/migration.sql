CREATE TABLE "WorkspacePageSnapshot" (
  "ownerId" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "payload" JSONB,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "dirtyVersion" INTEGER NOT NULL DEFAULT 1,
  "builtVersion" INTEGER NOT NULL DEFAULT 0,
  "builtAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "WorkspacePageSnapshot_pkey" PRIMARY KEY ("ownerId", "page")
);

ALTER TABLE "WorkspacePageSnapshot" ADD CONSTRAINT "WorkspacePageSnapshot_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION workspace_page_snapshot_mark_dirty() RETURNS trigger AS $$
DECLARE
  affected_owner TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_owner := OLD."ownerId";
  ELSE
    affected_owner := NEW."ownerId";
  END IF;

  IF affected_owner IS NULL THEN RETURN NULL; END IF;

  IF TG_TABLE_NAME IN (
    'CandidateProfile', 'InterviewSession', 'CoreTechnicalAssessment',
    'AppliedEngineeringAssessment', 'UserQuestionAttempt',
    'PersonalizedInterviewPlanVersion', 'CandidatePerformanceProfileVersion',
    'CandidatePracticeEvidenceVersion', 'CandidateInterviewProfileVersion'
  ) THEN
    UPDATE "WorkspacePageSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1
    WHERE "ownerId" = affected_owner AND "page" = 'interviews';
  END IF;

  IF TG_TABLE_NAME IN (
    'CandidateProfile', 'CandidateInterviewProfileVersion',
    'ResumeRoast', 'ResumeRoastTarget'
  ) THEN
    UPDATE "WorkspacePageSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1
    WHERE "ownerId" = affected_owner AND "page" = 'resume-roast';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_page_snapshot_profile_dirty
  AFTER UPDATE OF "targetRole", "level", "resumeAnalysis", "activeResumeVersionId",
    "onboardingCompletedAt", "preparationOnboarding" ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION workspace_page_snapshot_mark_dirty();

DO $$
DECLARE source_table TEXT;
BEGIN
  FOREACH source_table IN ARRAY ARRAY[
    'InterviewSession', 'CoreTechnicalAssessment', 'AppliedEngineeringAssessment',
    'UserQuestionAttempt', 'PersonalizedInterviewPlanVersion',
    'CandidatePerformanceProfileVersion', 'CandidatePracticeEvidenceVersion',
    'CandidateInterviewProfileVersion', 'ResumeRoast', 'ResumeRoastTarget'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER workspace_page_snapshot_dirty AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION workspace_page_snapshot_mark_dirty()',
      source_table
    );
  END LOOP;
END;
$$;
