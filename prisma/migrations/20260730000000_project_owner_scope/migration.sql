ALTER TABLE "Project" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'local-dev';

CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
