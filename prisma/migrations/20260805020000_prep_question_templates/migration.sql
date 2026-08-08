-- CreateTable
CREATE TABLE "PrepQuestionTemplate" (
    "id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roles" TEXT[],
    "levels" TEXT[],
    "difficulty" TEXT NOT NULL,
    "expectedMinutes" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptTemplate" TEXT,
    "tags" TEXT[],
    "whatItTests" TEXT[],
    "goodAnswerSignals" TEXT[],
    "weakAnswerSignals" TEXT[],
    "followUpPrompts" TEXT[],
    "mayaPushbacks" TEXT[],
    "answerStructure" JSONB NOT NULL,
    "scoringRubric" JSONB NOT NULL,
    "sourceLinks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepQuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepQuestionTemplate_bank_idx" ON "PrepQuestionTemplate"("bank");

-- CreateIndex
CREATE INDEX "PrepQuestionTemplate_category_idx" ON "PrepQuestionTemplate"("category");

-- CreateIndex
CREATE INDEX "PrepQuestionTemplate_competency_idx" ON "PrepQuestionTemplate"("competency");

-- CreateIndex
CREATE INDEX "PrepQuestionTemplate_difficulty_idx" ON "PrepQuestionTemplate"("difficulty");
