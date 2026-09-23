-- CreateEnum
CREATE TYPE "AiMlPracticeTrack" AS ENUM ('CORE_TECHNICAL', 'APPLIED_ENGINEERING');

-- CreateEnum
CREATE TYPE "AiMlPracticeSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AiMlPracticeQuestionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "AiMlPracticeSession" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "track" "AiMlPracticeTrack" NOT NULL,
    "status" "AiMlPracticeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "schemaVersion" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMlPracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMlPracticeQuestion" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "status" "AiMlPracticeQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicSnapshot" JSONB NOT NULL,
    "privateSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMlPracticeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMlPracticeAttempt" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "questionId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "selectedOptionId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answerSnapshot" JSONB NOT NULL,
    "evaluationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMlPracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMlPracticeSession_ownerId_track_key" ON "AiMlPracticeSession"("ownerId", "track");
CREATE UNIQUE INDEX "AiMlPracticeSession_id_ownerId_key" ON "AiMlPracticeSession"("id", "ownerId");
CREATE INDEX "AiMlPracticeSession_ownerId_status_idx" ON "AiMlPracticeSession"("ownerId", "status");
CREATE INDEX "AiMlPracticeSession_contentFingerprint_idx" ON "AiMlPracticeSession"("contentFingerprint");
CREATE UNIQUE INDEX "AiMlPracticeQuestion_sessionId_order_key" ON "AiMlPracticeQuestion"("sessionId", "order");
CREATE UNIQUE INDEX "AiMlPracticeQuestion_sessionId_questionKey_key" ON "AiMlPracticeQuestion"("sessionId", "questionKey");
CREATE UNIQUE INDEX "AiMlPracticeQuestion_id_ownerId_key" ON "AiMlPracticeQuestion"("id", "ownerId");
CREATE INDEX "AiMlPracticeQuestion_ownerId_sessionId_idx" ON "AiMlPracticeQuestion"("ownerId", "sessionId");
CREATE INDEX "AiMlPracticeQuestion_ownerId_status_idx" ON "AiMlPracticeQuestion"("ownerId", "status");
CREATE UNIQUE INDEX "AiMlPracticeAttempt_questionId_key" ON "AiMlPracticeAttempt"("questionId");
CREATE UNIQUE INDEX "AiMlPracticeAttempt_ownerId_requestId_key" ON "AiMlPracticeAttempt"("ownerId", "requestId");
CREATE UNIQUE INDEX "AiMlPracticeAttempt_questionId_ownerId_key" ON "AiMlPracticeAttempt"("questionId", "ownerId");
CREATE UNIQUE INDEX "AiMlPracticeAttempt_id_ownerId_key" ON "AiMlPracticeAttempt"("id", "ownerId");
CREATE INDEX "AiMlPracticeAttempt_ownerId_createdAt_idx" ON "AiMlPracticeAttempt"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiMlPracticeSession" ADD CONSTRAINT "AiMlPracticeSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMlPracticeQuestion" ADD CONSTRAINT "AiMlPracticeQuestion_sessionId_ownerId_fkey" FOREIGN KEY ("sessionId", "ownerId") REFERENCES "AiMlPracticeSession"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMlPracticeQuestion" ADD CONSTRAINT "AiMlPracticeQuestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMlPracticeAttempt" ADD CONSTRAINT "AiMlPracticeAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMlPracticeAttempt" ADD CONSTRAINT "AiMlPracticeAttempt_questionId_ownerId_fkey" FOREIGN KEY ("questionId", "ownerId") REFERENCES "AiMlPracticeQuestion"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
