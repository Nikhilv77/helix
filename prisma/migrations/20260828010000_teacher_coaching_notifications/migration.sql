-- Teacher-authored onboarding and daily coaching notifications.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'TEACHER_WELCOME';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'TEACHER_RECOMMENDATION';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'TEACHER_REMINDER';

ALTER TABLE "CandidateProfile"
  ADD COLUMN "teacherNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Notification"
  ADD COLUMN "emailSubject" TEXT,
  ADD COLUMN "emailBody" TEXT;
