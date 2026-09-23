-- Keep the candidate's active Applied Engineering focus lookup indexed.
CREATE INDEX IF NOT EXISTS "CandidateProfile_activeAppliedEngineeringFocusRevisionId_idx"
  ON "CandidateProfile"("activeAppliedEngineeringFocusRevisionId");
