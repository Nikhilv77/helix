-- The interview plan uses the full candidate profile. Any profile edit can
-- change its inputs, so a prepared page must be rebuilt after that edit.
DROP TRIGGER workspace_page_snapshot_profile_dirty ON "CandidateProfile";

CREATE TRIGGER workspace_page_snapshot_profile_dirty
  AFTER UPDATE ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION workspace_page_snapshot_mark_dirty();
