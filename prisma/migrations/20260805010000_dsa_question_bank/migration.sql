-- CreateTable
CREATE TABLE "DsaPhase" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsaPhase_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "DsaQuestion" (
    "slug" TEXT NOT NULL,
    "phaseSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "primaryPattern" TEXT NOT NULL,
    "subPatterns" TEXT[],
    "difficulty" TEXT NOT NULL,
    "expectedTimeMinutes" INTEGER NOT NULL,
    "recommendedOrder" INTEGER NOT NULL,
    "prerequisites" TEXT[],
    "conceptsTested" TEXT[],
    "commonMistakes" TEXT[],
    "interviewSignals" TEXT[],
    "followUpPrompts" TEXT[],
    "promptSummary" TEXT NOT NULL,
    "highLevelApproach" TEXT NOT NULL,
    "complexity" JSONB NOT NULL,
    "problemStatement" TEXT,
    "constraints" TEXT[],
    "examples" JSONB,
    "keyInsight" TEXT,
    "hints" TEXT[],
    "approaches" JSONB,
    "edgeCases" TEXT[],
    "relatedQuestions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsaQuestion_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "DsaPhase_phaseNumber_idx" ON "DsaPhase"("phaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DsaQuestion_phaseSlug_recommendedOrder_key" ON "DsaQuestion"("phaseSlug", "recommendedOrder");

-- CreateIndex
CREATE INDEX "DsaQuestion_phaseSlug_idx" ON "DsaQuestion"("phaseSlug");

-- CreateIndex
CREATE INDEX "DsaQuestion_primaryPattern_idx" ON "DsaQuestion"("primaryPattern");

-- CreateIndex
CREATE INDEX "DsaQuestion_difficulty_idx" ON "DsaQuestion"("difficulty");

-- CreateIndex
CREATE INDEX "DsaQuestion_recommendedOrder_idx" ON "DsaQuestion"("recommendedOrder");

-- AddForeignKey
ALTER TABLE "DsaQuestion" ADD CONSTRAINT "DsaQuestion_phaseSlug_fkey" FOREIGN KEY ("phaseSlug") REFERENCES "DsaPhase"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
