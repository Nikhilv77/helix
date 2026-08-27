-- A request nobody claims has to say so. Without this the learner watches a
-- request sit "open" forever and learns the feature does not work, when what
-- actually happened is that it timed out.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'HELP_REQUEST_EXPIRED';
