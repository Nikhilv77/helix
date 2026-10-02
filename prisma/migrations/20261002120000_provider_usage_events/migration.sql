-- CreateTable
CREATE TABLE "ProviderUsageEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "ownerId" TEXT,
    "outcome" TEXT NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "units" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderUsageEvent_createdAt_idx" ON "ProviderUsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderUsageEvent_kind_createdAt_idx" ON "ProviderUsageEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderUsageEvent_ownerId_createdAt_idx" ON "ProviderUsageEvent"("ownerId", "createdAt");
