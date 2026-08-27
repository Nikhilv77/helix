-- PostgreSQL remains the search engine: authored banks and private learner
-- records stay canonical, while these indexes make ranked/fuzzy lookup cheap.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "DsaQuestion_title_trgm_idx"
ON "DsaQuestion" USING GIN (lower("title") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "DsaQuestion_search_fts_idx"
ON "DsaQuestion" USING GIN (
  to_tsvector(
    'english',
    coalesce("title", '') || ' ' ||
    coalesce("primaryPattern", '') || ' ' ||
    coalesce("promptSummary", '')
  )
);

CREATE INDEX IF NOT EXISTS "PrepQuestionTemplate_title_trgm_idx"
ON "PrepQuestionTemplate" USING GIN (lower("title") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PrepQuestionTemplate_search_fts_idx"
ON "PrepQuestionTemplate" USING GIN (
  to_tsvector(
    'english',
    coalesce("title", '') || ' ' ||
    coalesce("prompt", '') || ' ' ||
    coalesce("objective", '') || ' ' ||
    coalesce("competency", '')
  )
);

CREATE INDEX IF NOT EXISTS "UserDsaQuestionNote_content_fts_idx"
ON "UserDsaQuestionNote" USING GIN (to_tsvector('english', coalesce("content", '')));

CREATE INDEX IF NOT EXISTS "UserPrepQuestionNote_content_fts_idx"
ON "UserPrepQuestionNote" USING GIN (to_tsvector('english', coalesce("content", '')));
