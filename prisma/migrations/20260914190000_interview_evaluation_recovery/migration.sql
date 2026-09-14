CREATE TABLE "InterviewEvaluationJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "answerHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InterviewEvaluationJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InterviewEvaluationJob_question_check" CHECK ("questionIndex" >= 0),
    CONSTRAINT "InterviewEvaluationJob_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" > 0)
);

CREATE UNIQUE INDEX "InterviewEvaluationJob_sessionId_questionIndex_answerHash_key"
ON "InterviewEvaluationJob"("sessionId", "questionIndex", "answerHash");

CREATE INDEX "InterviewEvaluationJob_status_availableAt_idx"
ON "InterviewEvaluationJob"("status", "availableAt");

CREATE INDEX "InterviewEvaluationJob_sessionId_questionIndex_idx"
ON "InterviewEvaluationJob"("sessionId", "questionIndex");

ALTER TABLE "InterviewEvaluationJob"
ADD CONSTRAINT "InterviewEvaluationJob_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
