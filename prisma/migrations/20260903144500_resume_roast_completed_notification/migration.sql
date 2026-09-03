-- A completed Resume Roast is a durable, in-app-only notification. The roast
-- id is stored as Notification.subjectId so retried delivery stays idempotent.
ALTER TYPE "NotificationKind" ADD VALUE 'RESUME_ROAST_COMPLETED';
