-- Match Prisma's required-list contract. The table is new and contains no
-- nullable rows, but coalesce defensively before adding the constraints.
UPDATE "CoreTechnicalTrackVersion"
SET "frameworks" = ARRAY[]::TEXT[]
WHERE "frameworks" IS NULL;

UPDATE "CoreTechnicalTrackVersion"
SET "secondaryTechnologies" = ARRAY[]::TEXT[]
WHERE "secondaryTechnologies" IS NULL;

ALTER TABLE "CoreTechnicalTrackVersion"
ALTER COLUMN "frameworks" SET NOT NULL,
ALTER COLUMN "secondaryTechnologies" SET NOT NULL;

