ALTER TABLE "ArchitectureBlock"
  ADD COLUMN "canvasDocument" JSONB,
  ADD COLUMN "canvasRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "canvasUpdatedAt" TIMESTAMP(3);
