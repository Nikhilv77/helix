-- CreateTable
CREATE TABLE "UserDsaQuestionNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDsaQuestionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDsaQuestionNote_ownerId_slug_key" ON "UserDsaQuestionNote"("ownerId", "slug");
CREATE INDEX "UserDsaQuestionNote_ownerId_idx" ON "UserDsaQuestionNote"("ownerId");
CREATE INDEX "UserDsaQuestionNote_slug_idx" ON "UserDsaQuestionNote"("slug");

-- AddForeignKey
ALTER TABLE "UserDsaQuestionNote" ADD CONSTRAINT "UserDsaQuestionNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDsaQuestionNote" ADD CONSTRAINT "UserDsaQuestionNote_slug_fkey" FOREIGN KEY ("slug") REFERENCES "DsaQuestion"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
