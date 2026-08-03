CREATE TABLE "InterviewSession" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "touchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterviewSession_ownerId_startedAt_idx"
ON "InterviewSession"("ownerId", "startedAt");

CREATE INDEX "InterviewSession_touchedAt_idx"
ON "InterviewSession"("touchedAt");
