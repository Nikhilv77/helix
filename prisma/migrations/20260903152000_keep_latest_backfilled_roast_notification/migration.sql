-- The previous repair migration ran immediately after this notification kind
-- was introduced. Keep only the newest repaired alert per user so historical
-- roasts do not arrive as a burst of unread notifications.
WITH ranked AS (
    SELECT
        notification."id",
        ROW_NUMBER() OVER (
            PARTITION BY notification."ownerId"
            ORDER BY notification."createdAt" DESC, notification."id" DESC
        ) AS position
    FROM "Notification" AS notification
    WHERE notification."kind" = 'RESUME_ROAST_COMPLETED'::"NotificationKind"
)
DELETE FROM "Notification" AS notification
USING ranked
WHERE notification."id" = ranked."id"
  AND ranked.position > 1;
