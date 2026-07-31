ALTER TABLE "DesignSession"
ADD COLUMN "requirementAnalysis" JSONB,
ADD COLUMN "clarificationAnswers" JSONB,
ADD COLUMN "requirementsAnalyzedAt" TIMESTAMP(3);

