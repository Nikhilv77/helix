-- Retain a candidate's preferred standalone DSA editor language between
-- questions and sessions. Existing candidates continue with JavaScript.
ALTER TABLE "CandidateProfile"
ADD COLUMN "dsaEditorLanguage" TEXT NOT NULL DEFAULT 'javascript';
