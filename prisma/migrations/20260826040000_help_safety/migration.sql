-- Block and report. These exist before the first bad interaction rather than
-- after it, which is the only time adding them is cheap.

CREATE TYPE "HelpReportReason" AS ENUM (
  'HARASSMENT', 'SPAM', 'OFF_TOPIC', 'SOLUTION_DUMPING', 'OTHER'
);

CREATE TABLE "HelpBlock" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpBlock_pkey" PRIMARY KEY ("id")
);

-- Blocking twice is a no-op, not an error.
CREATE UNIQUE INDEX "HelpBlock_ownerId_blockedId_key" ON "HelpBlock"("ownerId", "blockedId");
-- Matching checks both directions, so the reverse lookup needs its own index.
CREATE INDEX "HelpBlock_blockedId_idx" ON "HelpBlock"("blockedId");

CREATE TABLE "HelpReport" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" "HelpReportReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "HelpReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpReport_reportedId_idx" ON "HelpReport"("reportedId");
CREATE INDEX "HelpReport_reviewedAt_createdAt_idx" ON "HelpReport"("reviewedAt", "createdAt");
CREATE INDEX "HelpReport_requestId_idx" ON "HelpReport"("requestId");
