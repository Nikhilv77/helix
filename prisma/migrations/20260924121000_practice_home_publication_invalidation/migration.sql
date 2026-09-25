-- Publishing or replacing reviewed content changes Practice availability for
-- many candidates at once, so invalidate their prepared landing pages.
CREATE FUNCTION practice_home_mark_all_dirty() RETURNS trigger AS $$
BEGIN
  UPDATE "PracticeHomeSnapshot"
    SET "dirtyVersion" = "dirtyVersion" + 1;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  source_table TEXT;
BEGIN
  FOREACH source_table IN ARRAY ARRAY[
    'ArchitectureScenarioVersion',
    'CoreTechnicalStoryVersion',
    'AppliedEngineeringIncidentVersion',
    'RoadmapTemplate'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER practice_home_publication_dirty AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION practice_home_mark_all_dirty()',
      source_table
    );
  END LOOP;
END;
$$;
