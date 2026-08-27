-- Correct the first flexible-policy version without modifying its already
-- applied migration. PostgreSQL LEAST(NULL, 1) returns 1, so the exact-evidence
-- branch must guard the aggregate explicitly. Also normalize legacy resume
-- confidence values stored on a 0..100 scale alongside current 0..1 values.
CREATE OR REPLACE FUNCTION "helpHelperEligibilityScore"(
  p_helper_id TEXT,
  p_question_slug TEXT,
  p_language TEXT
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH target AS (
    SELECT "primaryPattern"
    FROM "DsaQuestion"
    WHERE "slug" = p_question_slug
  ),
  helper_profile AS (
    SELECT
      profile.*,
      CASE
        WHEN COALESCE(profile."resumeConfidence", 0) > 1
        THEN profile."resumeConfidence" / 100
        ELSE COALESCE(profile."resumeConfidence", 0)
      END AS normalized_resume_confidence
    FROM "CandidateProfile" AS profile
    WHERE profile."ownerId" = p_helper_id
      AND profile."helpNotificationsEnabled" = TRUE
  ),
  exact_evidence AS (
    SELECT MAX(submitted."score")::DOUBLE PRECISION AS score
    FROM "UserQuestionAttempt" AS submitted
    WHERE submitted."ownerId" = p_helper_id
      AND submitted."dsaQuestionSlug" = p_question_slug
      AND submitted."status" = 'SUBMITTED'::"RoadmapQuestionAttemptStatus"
      AND submitted."score" >= 0.80
      AND EXISTS (
        SELECT 1
        FROM "UserQuestionAttempt" AS completed
        WHERE completed."ownerId" = p_helper_id
          AND completed."dsaQuestionSlug" = p_question_slug
          AND completed."status" = 'COMPLETED'::"RoadmapQuestionAttemptStatus"
      )
  ),
  pattern_evidence AS (
    SELECT
      COUNT(DISTINCT submitted."dsaQuestionSlug")::INTEGER AS solved_count,
      AVG(submitted."score")::DOUBLE PRECISION AS average_score
    FROM "UserQuestionAttempt" AS submitted
    JOIN "DsaQuestion" AS question
      ON question."slug" = submitted."dsaQuestionSlug"
    JOIN target ON target."primaryPattern" = question."primaryPattern"
    WHERE submitted."ownerId" = p_helper_id
      AND submitted."status" = 'SUBMITTED'::"RoadmapQuestionAttemptStatus"
      AND submitted."score" >= 0.70
      AND EXISTS (
        SELECT 1
        FROM "UserQuestionAttempt" AS completed
        WHERE completed."ownerId" = p_helper_id
          AND completed."dsaQuestionSlug" = submitted."dsaQuestionSlug"
          AND completed."status" = 'COMPLETED'::"RoadmapQuestionAttemptStatus"
      )
  ),
  latest_performance AS (
    SELECT version."profile"
    FROM "CandidatePerformanceProfileVersion" AS version
    WHERE version."ownerId" = p_helper_id
    ORDER BY version."revision" DESC
    LIMIT 1
  ),
  performance_evidence AS (
    SELECT COALESCE(
      MAX(
        CASE
          WHEN skill->>'skillKey' = 'dsa-pattern:' || target."primaryPattern"
            AND (skill->>'score')::DOUBLE PRECISION >= 65
            AND (skill->>'confidence')::DOUBLE PRECISION >= 0.35
            AND (skill->>'sampleSize')::INTEGER >= 2
          THEN 0.60
            + LEAST((skill->>'score')::DOUBLE PRECISION / 100, 1) * 0.20
            + LEAST((skill->>'confidence')::DOUBLE PRECISION, 1) * 0.08
          WHEN skill->>'skillKey' = 'problem-solving'
            AND (skill->>'score')::DOUBLE PRECISION >= 72
            AND (skill->>'confidence')::DOUBLE PRECISION >= 0.45
            AND (skill->>'sampleSize')::INTEGER >= 3
          THEN 0.56
            + LEAST((skill->>'score')::DOUBLE PRECISION / 100, 1) * 0.18
            + LEAST((skill->>'confidence')::DOUBLE PRECISION, 1) * 0.08
          ELSE 0
        END
      ),
      0
    )::DOUBLE PRECISION AS score
    FROM latest_performance
    CROSS JOIN target
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(latest_performance."profile"->'skills') = 'array'
        THEN latest_performance."profile"->'skills'
        ELSE '[]'::jsonb
      END
    ) AS skill
  ),
  profile_evidence AS (
    SELECT CASE
      WHEN profile."resumeVerifiedAt" IS NULL
        OR profile.normalized_resume_confidence < 0.65
        OR profile."onboardingCompletedAt" IS NULL
      THEN 0
      WHEN profile."resumeAnalysis"::TEXT ~* '(leetcode|codeforces|hackerrank|codechef|competitive[ -]?programming|data[ -]?structures|algorithms)'
      THEN 0.62 + LEAST(profile.normalized_resume_confidence, 1) * 0.15
      WHEN profile."level" IN ('3-5', '5-plus')
        AND CASE p_language
          WHEN 'python' THEN profile."resumeAnalysis"::TEXT ~* '\mpython\M'
          WHEN 'java' THEN profile."resumeAnalysis"::TEXT ~* '\mjava\M|spring'
          WHEN 'javascript' THEN profile."resumeAnalysis"::TEXT ~* '(javascript|typescript|node\.?js|react)'
          WHEN 'cpp' THEN profile."resumeAnalysis"::TEXT ~* '(c\+\+|\mcpp\M)'
          ELSE FALSE
        END
      THEN 0.55 + LEAST(profile.normalized_resume_confidence, 1) * 0.12
      ELSE 0
    END::DOUBLE PRECISION AS score
    FROM helper_profile AS profile
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM helper_profile) OR NOT EXISTS (SELECT 1 FROM target)
    THEN 0
    ELSE GREATEST(
      COALESCE(
        (
          SELECT CASE
            WHEN exact_evidence.score IS NOT NULL
            THEN 0.85 + LEAST(exact_evidence.score, 1) * 0.15
            ELSE 0
          END
          FROM exact_evidence
        ),
        0
      ),
      COALESCE(
        (
          SELECT CASE
            WHEN pattern_evidence.solved_count >= 2
            THEN 0.68
              + LEAST(pattern_evidence.solved_count::DOUBLE PRECISION / 8, 1) * 0.10
              + LEAST(pattern_evidence.average_score, 1) * 0.10
            ELSE 0
          END
          FROM pattern_evidence
        ),
        0
      ),
      COALESCE((SELECT performance_evidence.score FROM performance_evidence), 0),
      COALESCE((SELECT profile_evidence.score FROM profile_evidence), 0)
    )
  END;
$$;

COMMENT ON FUNCTION "helpHelperEligibilityScore"(TEXT, TEXT, TEXT) IS
  'Returns 0 for an ineligible helper or a normalized evidence score from exact, pattern, demonstrated-performance, or verified-profile evidence.';
