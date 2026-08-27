-- Part 3: version and publish canonical prep questions, then place one
-- canonical progress record into one or more candidate Practice sessions.
CREATE TYPE "PrepQuestionPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "PrepQuestionTemplate"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sessionKey" TEXT,
ADD COLUMN "chapterKey" TEXT,
ADD COLUMN "format" TEXT NOT NULL DEFAULT 'typed',
ADD COLUMN "objective" TEXT,
ADD COLUMN "prerequisites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "explanation" TEXT,
ADD COLUMN "answerKey" JSONB,
ADD COLUMN "publicationStatus" "PrepQuestionPublicationStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "PrepQuestionTemplate"
SET
  "sessionKey" = CASE
    WHEN "bank" = 'behavioral-resume-deep-dive' THEN 'resume-behavioral-defense'
    WHEN "competency" IN ('frontend-system-design', 'performance', 'accessibility-browser', 'css-layout')
      THEN 'architecture-system-design'
    WHEN "competency" = 'frontend-depth' THEN 'resume-behavioral-defense'
    ELSE 'core-technical'
  END,
  "chapterKey" = CASE
    WHEN "competency" LIKE 'javascript-%' THEN 'javascript-runtime'
    WHEN "competency" IN ('react-core', 'component-design', 'forms') THEN 'react-engineering'
    WHEN "competency" IN ('frontend-system-design', 'performance') THEN 'frontend-systems'
    WHEN "competency" IN ('accessibility-browser', 'css-layout', 'frontend-testing') THEN 'ui-quality'
    WHEN "category" = 'resume-deep-dive' THEN 'resume-claims'
    ELSE 'behavioral-stories'
  END,
  "objective" = 'Demonstrate: ' || array_to_string("whatItTests", ', '),
  "hints" = ARRAY[
    'Start by naming the underlying mechanism or decision.',
    'Then connect it to a concrete example, trade-off, or measurable result.'
  ],
  "explanation" = 'A strong response follows the authored answer structure and addresses: ' ||
    array_to_string("whatItTests", ', ') || '.';

ALTER TABLE "PrepQuestionTemplate"
ALTER COLUMN "sessionKey" SET NOT NULL,
ALTER COLUMN "chapterKey" SET NOT NULL,
ALTER COLUMN "objective" SET NOT NULL,
ALTER COLUMN "explanation" SET NOT NULL;

CREATE INDEX "PrepQuestionTemplate_sessionKey_publicationStatus_idx"
ON "PrepQuestionTemplate"("sessionKey", "publicationStatus");
CREATE INDEX "PrepQuestionTemplate_chapterKey_idx"
ON "PrepQuestionTemplate"("chapterKey");

CREATE UNIQUE INDEX "UserQuestionProgress_roadmapId_prepQuestionTemplateId_key"
ON "UserQuestionProgress"("roadmapId", "prepQuestionTemplateId");

CREATE UNIQUE INDEX "RoadmapQuestionTemplate_sessionTemplateId_prepQuestionTemplateId_key"
ON "RoadmapQuestionTemplate"("sessionTemplateId", "prepQuestionTemplateId");

CREATE TABLE "PracticeQuestionPlacement" (
  "id" UUID NOT NULL,
  "roadmapId" UUID NOT NULL,
  "sessionProgressId" UUID NOT NULL,
  "questionProgressId" UUID NOT NULL,
  "practiceSessionKey" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "selectionReason" TEXT NOT NULL,
  "contentVersion" INTEGER NOT NULL,
  "sourceInterviewPlanId" UUID,
  "sourceInterviewPlanRevision" INTEGER,
  "sourceProfileVersionId" UUID,
  "sourceProfileRevision" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeQuestionPlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeQuestionPlacement_sessionProgressId_order_key"
ON "PracticeQuestionPlacement"("sessionProgressId", "order");
CREATE UNIQUE INDEX "PracticeQuestionPlacement_sessionProgressId_questionProgressId_key"
ON "PracticeQuestionPlacement"("sessionProgressId", "questionProgressId");
CREATE INDEX "PracticeQuestionPlacement_roadmapId_practiceSessionKey_idx"
ON "PracticeQuestionPlacement"("roadmapId", "practiceSessionKey");
CREATE INDEX "PracticeQuestionPlacement_questionProgressId_idx"
ON "PracticeQuestionPlacement"("questionProgressId");
CREATE INDEX "PracticeQuestionPlacement_sourceInterviewPlanId_idx"
ON "PracticeQuestionPlacement"("sourceInterviewPlanId");

ALTER TABLE "PracticeQuestionPlacement"
ADD CONSTRAINT "PracticeQuestionPlacement_roadmapId_fkey"
FOREIGN KEY ("roadmapId") REFERENCES "UserRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuestionPlacement"
ADD CONSTRAINT "PracticeQuestionPlacement_sessionProgressId_fkey"
FOREIGN KEY ("sessionProgressId") REFERENCES "UserSessionProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuestionPlacement"
ADD CONSTRAINT "PracticeQuestionPlacement_questionProgressId_fkey"
FOREIGN KEY ("questionProgressId") REFERENCES "UserQuestionProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
