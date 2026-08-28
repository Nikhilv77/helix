-- Persist presentation alongside text so retries never rebuild different mail
-- after a deployment, and retain the teacher-specific visible sender name.
ALTER TABLE "Notification"
ADD COLUMN "emailHtml" TEXT,
ADD COLUMN "emailFromName" TEXT;
