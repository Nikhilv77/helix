CREATE TABLE "PracticeHomeSnapshot" (
  "ownerId" TEXT NOT NULL,
  "payload" JSONB,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "dirtyVersion" INTEGER NOT NULL DEFAULT 1,
  "builtVersion" INTEGER NOT NULL DEFAULT 0,
  "builtDay" TEXT,
  "builtAt" TIMESTAMP(3),
  CONSTRAINT "PracticeHomeSnapshot_pkey" PRIMARY KEY ("ownerId")
);

ALTER TABLE "PracticeHomeSnapshot" ADD CONSTRAINT "PracticeHomeSnapshot_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- The trigger is the safety net for writes outside a particular API route.
-- Bumping a version also prevents a concurrent builder from publishing stale data.
CREATE FUNCTION practice_home_mark_dirty() RETURNS trigger AS $$
DECLARE
  affected_owner TEXT;
BEGIN
  IF TG_TABLE_NAME IN ('UserQuestionProgress', 'UserSessionProgress', 'UserChapterProgress') THEN
    SELECT "ownerId" INTO affected_owner FROM "UserRoadmap" WHERE id = NEW."roadmapId";
  ELSE
    affected_owner := NEW."ownerId";
  END IF;

  IF affected_owner IS NOT NULL THEN
    INSERT INTO "PracticeHomeSnapshot" ("ownerId", "dirtyVersion")
    VALUES (affected_owner, 1)
    ON CONFLICT ("ownerId") DO UPDATE
      SET "dirtyVersion" = "PracticeHomeSnapshot"."dirtyVersion" + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  source_table TEXT;
BEGIN
  FOREACH source_table IN ARRAY ARRAY[
    'CandidateProfile',
    'UserRoadmap', 'UserQuestionAttempt',
    'UserQuestionProgress', 'UserSessionProgress', 'UserChapterProgress',
    'DsaPracticeBlock', 'DsaBlockAssessment',
    'CoreTechnicalFocusRevision', 'CoreTechnicalStoryProgress',
    'CoreTechnicalBlock', 'CoreTechnicalBlockQuestion', 'CoreTechnicalQuestionState',
    'CoreTechnicalQuestionAttempt', 'CoreTechnicalAssessment',
    'AppliedEngineeringFocusRevision', 'AppliedEngineeringIncidentProgress',
    'AppliedEngineeringBlock', 'AppliedEngineeringBlockQuestion', 'AppliedEngineeringQuestionState',
    'AppliedEngineeringQuestionAttempt', 'AppliedEngineeringAssessment',
    'ArchitectureFocusRevision', 'ArchitectureScenarioProgress',
    'ArchitectureBlock', 'ArchitectureBlockQuestion', 'ArchitectureQuestionState',
    'ArchitectureQuestionAttempt', 'ArchitectureAssessment',
    'AiMlPracticeSession', 'AiMlPracticeQuestion', 'AiMlPracticeAttempt',
    'InterviewSession', 'PersonalizedInterviewPlanVersion',
    'CandidatePerformanceProfileVersion', 'CandidatePracticeEvidenceVersion',
    'CandidateInterviewProfileVersion'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER practice_home_dirty AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION practice_home_mark_dirty()',
      source_table
    );
  END LOOP;
END;
$$;
