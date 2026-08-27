-- Part 2: persist the candidate-facing Practice roadmap while retaining the
-- existing roadmap/session/question rows and all historical progress.
CREATE TYPE "PracticeSessionAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

ALTER TABLE "UserRoadmap"
ADD COLUMN "sourceInterviewPlanId" UUID,
ADD COLUMN "sourceInterviewPlanRevision" INTEGER,
ADD COLUMN "sourceProfileVersionId" UUID,
ADD COLUMN "sourceProfileRevision" INTEGER,
ADD COLUMN "practiceGenerationVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "UserSessionProgress"
ADD COLUMN "practiceSessionKey" TEXT,
ADD COLUMN "availability" "PracticeSessionAvailability" NOT NULL DEFAULT 'UNAVAILABLE',
ADD COLUMN "titleSnapshot" TEXT,
ADD COLUMN "purposeSnapshot" TEXT,
ADD COLUMN "coversSnapshot" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "difficultySnapshot" TEXT,
ADD COLUMN "durationMinutesSnapshot" INTEGER,
ADD COLUMN "sourceBlueprintId" UUID,
ADD COLUMN "sourceBlueprintKind" TEXT,
ADD COLUMN "personalizedAt" TIMESTAMP(3);

UPDATE "UserSessionProgress" AS progress
SET
  "practiceSessionKey" = CASE session."slug"
    WHEN 'frontend-dsa' THEN 'frontend-dsa'
    WHEN 'javascript-react-core' THEN 'core-technical'
    WHEN 'computer-fundamentals' THEN 'applied-engineering'
    WHEN 'production-ui-quality' THEN 'architecture-system-design'
    WHEN 'resume-behavioral-defense' THEN 'resume-behavioral-defense'
    WHEN 'final-frontend-mock' THEN 'final-mock'
    ELSE session."slug"
  END,
  "availability" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "RoadmapQuestionTemplate" AS question
      WHERE question."sessionTemplateId" = session."id"
    ) THEN 'AVAILABLE'::"PracticeSessionAvailability"
    ELSE 'UNAVAILABLE'::"PracticeSessionAvailability"
  END,
  "titleSnapshot" = session."title",
  "purposeSnapshot" = session."purpose",
  "coversSnapshot" = session."covers",
  "personalizedAt" = progress."updatedAt"
FROM "RoadmapSessionTemplate" AS session
WHERE progress."sessionTemplateId" = session."id";

ALTER TABLE "UserSessionProgress"
ALTER COLUMN "practiceSessionKey" SET NOT NULL;

CREATE UNIQUE INDEX "UserSessionProgress_roadmapId_practiceSessionKey_key"
ON "UserSessionProgress"("roadmapId", "practiceSessionKey");
