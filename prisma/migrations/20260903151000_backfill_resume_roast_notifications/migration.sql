-- Repair completed roasts created before notification persistence became part
-- of the READY transaction. The unique inbox key makes this safe to replay.
INSERT INTO "Notification" (
    "id",
    "ownerId",
    "kind",
    "title",
    "body",
    "href",
    "subjectId",
    "createdAt"
)
SELECT
    gen_random_uuid(),
    roast."ownerId",
    'RESUME_ROAST_COMPLETED'::"NotificationKind",
    'James has analysed your resume',
    'Your target-fit score is ' ||
      COALESCE(roast."result" -> 'verdict' ->> 'targetFitScore', '—') ||
      '/100. Open the analysis to see James’s feedback.',
    '/resume-roast',
    roast."id",
    roast."updatedAt"
FROM "ResumeRoast" AS roast
WHERE roast."status" = 'READY'::"ResumeRoastStatus"
ON CONFLICT ("ownerId", "kind", "subjectId") DO NOTHING;
