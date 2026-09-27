-- One running Resume Roast per owner. A second tab, a double submit or a
-- retry during generation joins the running roast instead of paying for a
-- duplicate model call. Rows left GENERATING by a killed function are failed
-- by the application after the generation budget, which frees the slot.

-- Any duplicates from before this constraint can no longer be running.
UPDATE "ResumeRoast" AS roast
SET "status" = 'FAILED'::"ResumeRoastStatus", "generationToken" = NULL, "result" = NULL
WHERE roast."status" = 'GENERATING'::"ResumeRoastStatus"
  AND (
    roast."createdAt" < now() - interval '10 minutes'
    OR EXISTS (
      SELECT 1 FROM "ResumeRoast" AS newer
      WHERE newer."ownerId" = roast."ownerId"
        AND newer."status" = 'GENERATING'::"ResumeRoastStatus"
        AND (newer."createdAt", newer."id") > (roast."createdAt", roast."id")
    )
  );

CREATE UNIQUE INDEX "ResumeRoast_one_generating_per_owner"
ON "ResumeRoast"("ownerId")
WHERE "status" = 'GENERATING'::"ResumeRoastStatus";
