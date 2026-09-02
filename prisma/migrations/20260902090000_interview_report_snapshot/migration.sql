-- Persist a transcript-free report read model so /reports does not deserialize
-- every complete interview state. Existing rows are backfilled on first read.
ALTER TABLE "InterviewSession" ADD COLUMN "reportSnapshot" JSONB;
