-- Completed interview reports are durable, in-app-only notifications. The
-- session id is the subject id so replayed final turns cannot create duplicates.
ALTER TYPE "NotificationKind" ADD VALUE 'INTERVIEW_REPORT_READY';
