-- Durable email delivery state for notifications.
--
-- The inbox row is already the source of truth. These columns make its email
-- side effect retryable without creating a second notification or sending the
-- same email from two workers at once.

ALTER TABLE "Notification"
ADD COLUMN "emailRequestedAt" TIMESTAMP(3),
ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailLeaseToken" TEXT,
ADD COLUMN "emailLeaseUntil" TIMESTAMP(3),
ADD COLUMN "emailNextAttemptAt" TIMESTAMP(3),
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailFailedAt" TIMESTAMP(3),
ADD COLUMN "emailLastError" TEXT;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_emailAttempts_nonnegative"
CHECK ("emailAttempts" >= 0);

-- Only pending email rows participate. Successful, permanently failed and
-- in-app-only notifications stay out of the retry scan entirely.
CREATE INDEX "Notification_email_retry_idx"
ON "Notification"("emailNextAttemptAt", "emailLeaseUntil")
WHERE "emailRequestedAt" IS NOT NULL
  AND "emailSentAt" IS NULL
  AND "emailFailedAt" IS NULL;
