CREATE TABLE "PreparationBaselineQuestion" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreparationBaselineQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreparationBaselineQuestion_ownerId_section_key"
ON "PreparationBaselineQuestion"("ownerId", "section");

CREATE INDEX "PreparationBaselineQuestion_ownerId_idx"
ON "PreparationBaselineQuestion"("ownerId");

ALTER TABLE "PreparationBaselineQuestion"
ADD CONSTRAINT "PreparationBaselineQuestion_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId")
ON DELETE CASCADE ON UPDATE CASCADE;
