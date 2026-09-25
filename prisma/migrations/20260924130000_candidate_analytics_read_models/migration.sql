CREATE TABLE "CandidateAnalyticsSnapshot" (
  "ownerId" TEXT NOT NULL,
  "payload" JSONB,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "dirtyVersion" INTEGER NOT NULL DEFAULT 1,
  "builtVersion" INTEGER NOT NULL DEFAULT 0,
  "builtDay" TEXT,
  "builtAt" TIMESTAMP(3),
  CONSTRAINT "CandidateAnalyticsSnapshot_pkey" PRIMARY KEY ("ownerId")
);

CREATE TABLE "CandidateActivityDaily" (
  "ownerId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "practiceAttempts" INTEGER NOT NULL DEFAULT 0,
  "practiceSolved" INTEGER NOT NULL DEFAULT 0,
  "interviewsStarted" INTEGER NOT NULL DEFAULT 0,
  "interviewsCompleted" INTEGER NOT NULL DEFAULT 0,
  "roastsCompleted" INTEGER NOT NULL DEFAULT 0,
  "trailmateResolved" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CandidateActivityDaily_pkey" PRIMARY KEY ("ownerId", "day")
);

CREATE INDEX "CandidateActivityDaily_day_idx" ON "CandidateActivityDaily"("day");
ALTER TABLE "CandidateAnalyticsSnapshot" ADD CONSTRAINT "CandidateAnalyticsSnapshot_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateActivityDaily" ADD CONSTRAINT "CandidateActivityDaily_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION candidate_analytics_dirty_owner(affected_owner TEXT) RETURNS void AS $$
BEGIN
  IF affected_owner IS NOT NULL AND EXISTS (
    SELECT 1 FROM "CandidateProfile" WHERE "ownerId" = affected_owner
  ) THEN
    INSERT INTO "CandidateAnalyticsSnapshot" ("ownerId", "dirtyVersion")
    VALUES (affected_owner, 1)
    ON CONFLICT ("ownerId") DO UPDATE
      SET "dirtyVersion" = "CandidateAnalyticsSnapshot"."dirtyVersion" + 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION candidate_analytics_mark_dirty() RETURNS trigger AS $$
DECLARE
  affected_owner TEXT;
  affected_roadmap UUID;
  affected_request UUID;
  old_owner TEXT;
BEGIN
  IF TG_TABLE_NAME = 'HelpRequest' THEN
    IF TG_OP = 'UPDATE' THEN
      PERFORM candidate_analytics_dirty_owner(OLD."learnerId");
      PERFORM candidate_analytics_dirty_owner(OLD."helperId");
    END IF;
    IF TG_OP = 'DELETE' THEN
      PERFORM candidate_analytics_dirty_owner(OLD."learnerId");
      PERFORM candidate_analytics_dirty_owner(OLD."helperId");
    ELSE
      PERFORM candidate_analytics_dirty_owner(NEW."learnerId");
      PERFORM candidate_analytics_dirty_owner(NEW."helperId");
    END IF;
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'HelpSession' THEN
    IF TG_OP = 'DELETE' THEN affected_request := OLD."requestId";
    ELSE affected_request := NEW."requestId";
    END IF;
    SELECT "learnerId", "helperId" INTO affected_owner, old_owner
      FROM "HelpRequest" WHERE id = affected_request;
    PERFORM candidate_analytics_dirty_owner(affected_owner);
    PERFORM candidate_analytics_dirty_owner(old_owner);
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME IN ('UserQuestionProgress', 'UserSessionProgress', 'UserChapterProgress') THEN
    IF TG_OP = 'DELETE' THEN affected_roadmap := OLD."roadmapId";
    ELSE affected_roadmap := NEW."roadmapId";
    END IF;
    SELECT "ownerId" INTO affected_owner FROM "UserRoadmap" WHERE id = affected_roadmap;
  ELSE
    IF TG_OP = 'DELETE' THEN affected_owner := OLD."ownerId";
    ELSE affected_owner := NEW."ownerId";
    END IF;
  END IF;
  PERFORM candidate_analytics_dirty_owner(affected_owner);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE source_table TEXT;
BEGIN
  FOREACH source_table IN ARRAY ARRAY[
    'CandidateProfile', 'UserRoadmap', 'UserQuestionAttempt',
    'UserQuestionProgress', 'UserSessionProgress', 'UserChapterProgress',
    'CoreTechnicalBlock', 'CoreTechnicalBlockQuestion', 'CoreTechnicalQuestionAttempt',
    'CoreTechnicalAssessment', 'CoreTechnicalAssessmentReport',
    'AppliedEngineeringBlock', 'AppliedEngineeringBlockQuestion',
    'AppliedEngineeringQuestionAttempt', 'AppliedEngineeringAssessment',
    'AppliedEngineeringAssessmentReport',
    'ArchitectureBlock', 'ArchitectureBlockQuestion', 'ArchitectureQuestionAttempt',
    'ArchitectureAssessment', 'ArchitectureAssessmentReport',
    'AiMlPracticeSession', 'AiMlPracticeQuestion', 'AiMlPracticeAttempt',
    'InterviewSession', 'ResumeRoast', 'HelpRequest', 'HelpSession'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER candidate_analytics_dirty AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION candidate_analytics_mark_dirty()',
      source_table
    );
  END LOOP;
END;
$$;
