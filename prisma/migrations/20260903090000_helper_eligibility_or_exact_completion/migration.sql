-- Exact completion is an independent helper lane. A candidate may answer when
-- the evidence policy gives them a positive score OR when Trailgrad records
-- that they completed this exact problem, regardless of the attempt's score.
CREATE OR REPLACE FUNCTION "helpHelperSolvedQuestion"(
  p_helper_id TEXT,
  p_question_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "UserQuestionAttempt" AS attempt
    WHERE attempt."ownerId" = p_helper_id
      AND attempt."dsaQuestionSlug" = p_question_slug
      AND attempt."status" = 'COMPLETED'::"RoadmapQuestionAttemptStatus"
  );
$$;

COMMENT ON FUNCTION "helpHelperSolvedQuestion"(TEXT, TEXT) IS
  'True when the candidate has completed the exact Trailgrad DSA question; used as an independent peer-help qualification lane.';
