CREATE TABLE "InterviewDesignCanvas" (
    "sessionId" UUID NOT NULL,
    "document" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewDesignCanvas_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX "InterviewDesignCanvas_updatedAt_idx" ON "InterviewDesignCanvas"("updatedAt");

ALTER TABLE "InterviewDesignCanvas"
ADD CONSTRAINT "InterviewDesignCanvas_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
