-- A generic inbox. Help requests are its first caller, but nothing here is
-- help-specific so the next feature that needs to reach somebody reuses it.

CREATE TYPE "NotificationKind" AS ENUM (
  'HELP_REQUEST_OPENED',
  'HELP_REQUEST_CLAIMED',
  'HELP_REQUEST_RESOLVED'
);

ALTER TABLE "CandidateProfile"
ADD COLUMN "helpNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "subjectId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Delivering the same event twice must be a no-op rather than a duplicate row.
-- Postgres treats NULLs as distinct, so notifications with no subject are
-- unaffected by this constraint.
CREATE UNIQUE INDEX "Notification_ownerId_kind_subjectId_key"
ON "Notification"("ownerId", "kind", "subjectId");

CREATE INDEX "Notification_ownerId_readAt_idx" ON "Notification"("ownerId", "readAt");
CREATE INDEX "Notification_ownerId_createdAt_idx" ON "Notification"("ownerId", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;
