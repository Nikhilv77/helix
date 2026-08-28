-- Peer-help asks are intentionally short-lived. Clamp rows created under the
-- previous 24-hour policy before retiring those whose new window already ended.
UPDATE "HelpRequest"
SET "expiresAt" = "createdAt" + INTERVAL '10 minutes',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'OPEN'::"HelpRequestStatus"
  AND "expiresAt" > "createdAt" + INTERVAL '10 minutes';

UPDATE "HelpRequest"
SET "status" = 'EXPIRED'::"HelpRequestStatus",
    "closedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'OPEN'::"HelpRequestStatus"
  AND "expiresAt" <= CURRENT_TIMESTAMP;

-- These alerts no longer describe an actionable request and should not remain
-- in the helper's bell inbox or its unread count.
DELETE FROM "Notification"
WHERE "kind" = 'HELP_REQUEST_OPENED'::"NotificationKind"
  AND "createdAt" <= CURRENT_TIMESTAMP - INTERVAL '10 minutes';
