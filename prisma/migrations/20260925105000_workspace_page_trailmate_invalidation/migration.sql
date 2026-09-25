-- Trailmate's warm page contains the owner's help counters and first history pages.
-- Invalidate both participants when a request or session changes.
CREATE FUNCTION workspace_trailmate_mark_owner_dirty(affected_owner TEXT) RETURNS void AS $$
BEGIN
  IF affected_owner IS NOT NULL THEN
    UPDATE "WorkspacePageSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1
    WHERE "ownerId" = affected_owner AND "page" = 'trailmate';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION workspace_trailmate_mark_dirty() RETURNS trigger AS $$
DECLARE
  learner_owner TEXT;
  helper_owner TEXT;
BEGIN
  IF TG_TABLE_NAME = 'CandidateProfile' THEN
    PERFORM workspace_trailmate_mark_owner_dirty(NEW."ownerId");
  ELSIF TG_TABLE_NAME = 'HelpRequest' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM workspace_trailmate_mark_owner_dirty(OLD."learnerId");
      PERFORM workspace_trailmate_mark_owner_dirty(OLD."helperId");
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM workspace_trailmate_mark_owner_dirty(NEW."learnerId");
      PERFORM workspace_trailmate_mark_owner_dirty(NEW."helperId");
    END IF;
  ELSE
    SELECT "learnerId", "helperId" INTO learner_owner, helper_owner
    FROM "HelpRequest"
    WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."requestId" ELSE NEW."requestId" END;
    PERFORM workspace_trailmate_mark_owner_dirty(learner_owner);
    PERFORM workspace_trailmate_mark_owner_dirty(helper_owner);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_trailmate_request_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "HelpRequest"
  FOR EACH ROW EXECUTE FUNCTION workspace_trailmate_mark_dirty();

CREATE TRIGGER workspace_trailmate_session_dirty
  AFTER INSERT OR UPDATE OR DELETE ON "HelpSession"
  FOR EACH ROW EXECUTE FUNCTION workspace_trailmate_mark_dirty();

-- The owner's public identity is shown in their Trailmate overview. Other
-- participants and the global leaderboard refresh at the page's short TTL.
CREATE TRIGGER workspace_trailmate_profile_dirty
  AFTER UPDATE OF "resumeAnalysis", "headline", "profileImage" ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION workspace_trailmate_mark_dirty();
