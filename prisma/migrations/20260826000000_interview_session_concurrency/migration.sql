ALTER TABLE "InterviewSession"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "InterviewAnswerRequest" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "turnId" UUID NOT NULL,
    "answerHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewAnswerRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterviewAnswerRequest_sessionId_turnId_key"
ON "InterviewAnswerRequest"("sessionId", "turnId");

CREATE INDEX "InterviewAnswerRequest_status_leaseUntil_idx"
ON "InterviewAnswerRequest"("status", "leaseUntil");

ALTER TABLE "InterviewAnswerRequest"
ADD CONSTRAINT "InterviewAnswerRequest_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
