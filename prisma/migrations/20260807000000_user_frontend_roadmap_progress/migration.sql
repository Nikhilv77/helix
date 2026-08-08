-- CreateEnum
CREATE TYPE "RoadmapTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRoadmapStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoadmapProgressStatus" AS ENUM ('LOCKED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RoadmapQuestionSourceType" AS ENUM ('DSA', 'PREP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoadmapQuestionAttemptStatus" AS ENUM ('STARTED', 'SUBMITTED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MayaInsightKind" AS ENUM ('NEXT_PRIORITY', 'COMMON_TRAP', 'STRONG_SIGNAL', 'STREAK', 'RECOMMENDED_ACTION');

-- CreateTable
CREATE TABLE "RoadmapTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "RoadmapTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoadmapTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapSessionTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "templateId" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "covers" TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoadmapSessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapChapterTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionTemplateId" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoadmapChapterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapQuestionTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionTemplateId" UUID NOT NULL,
  "chapterTemplateId" UUID,
  "order" INTEGER NOT NULL,
  "sourceType" "RoadmapQuestionSourceType" NOT NULL,
  "dsaQuestionSlug" TEXT,
  "prepQuestionTemplateId" TEXT,
  "titleSnapshot" TEXT NOT NULL,
  "difficulty" TEXT,
  "expectedMinutes" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoadmapQuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoadmap" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" TEXT NOT NULL,
  "templateId" UUID,
  "role" TEXT NOT NULL,
  "status" "UserRoadmapStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT NOT NULL,
  "templateVersion" INTEGER,
  "currentSessionTemplateSlug" TEXT,
  "currentChapterTemplateSlug" TEXT,
  "nextQuestionKey" TEXT,
  "totalSessions" INTEGER NOT NULL DEFAULT 0,
  "completedSessions" INTEGER NOT NULL DEFAULT 0,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "attemptedQuestions" INTEGER NOT NULL DEFAULT 0,
  "completedQuestions" INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutesRemaining" INTEGER,
  "overallProgressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "personalization" JSONB,
  "stats" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recalculatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserRoadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSessionProgress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roadmapId" UUID NOT NULL,
  "sessionTemplateId" UUID NOT NULL,
  "status" "RoadmapProgressStatus" NOT NULL DEFAULT 'LOCKED',
  "order" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "attemptedQuestions" INTEGER NOT NULL DEFAULT 0,
  "completedQuestions" INTEGER NOT NULL DEFAULT 0,
  "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserSessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChapterProgress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roadmapId" UUID NOT NULL,
  "sessionProgressId" UUID NOT NULL,
  "chapterTemplateId" UUID NOT NULL,
  "status" "RoadmapProgressStatus" NOT NULL DEFAULT 'LOCKED',
  "order" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "attemptedQuestions" INTEGER NOT NULL DEFAULT 0,
  "completedQuestions" INTEGER NOT NULL DEFAULT 0,
  "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserChapterProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionProgress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roadmapId" UUID NOT NULL,
  "sessionProgressId" UUID NOT NULL,
  "chapterProgressId" UUID,
  "roadmapQuestionTemplateId" UUID,
  "sourceType" "RoadmapQuestionSourceType" NOT NULL,
  "dsaQuestionSlug" TEXT,
  "prepQuestionTemplateId" TEXT,
  "status" "RoadmapProgressStatus" NOT NULL DEFAULT 'LOCKED',
  "order" INTEGER NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "bestScore" DOUBLE PRECISION,
  "lastAttemptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserQuestionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" TEXT NOT NULL,
  "questionProgressId" UUID NOT NULL,
  "sourceType" "RoadmapQuestionSourceType" NOT NULL,
  "dsaQuestionSlug" TEXT,
  "prepQuestionTemplateId" TEXT,
  "status" "RoadmapQuestionAttemptStatus" NOT NULL DEFAULT 'STARTED',
  "answer" TEXT,
  "score" DOUBLE PRECISION,
  "correctness" TEXT,
  "durationMs" INTEGER,
  "feedback" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserQuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMayaInsight" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roadmapId" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" "MayaInsightKind" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "evidenceLabel" TEXT,
  "ctaLabel" TEXT,
  "ctaHref" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "source" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserMayaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapTemplate_slug_key" ON "RoadmapTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapTemplate_role_version_key" ON "RoadmapTemplate"("role", "version");

-- CreateIndex
CREATE INDEX "RoadmapTemplate_role_idx" ON "RoadmapTemplate"("role");

-- CreateIndex
CREATE INDEX "RoadmapTemplate_status_idx" ON "RoadmapTemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapSessionTemplate_templateId_slug_key" ON "RoadmapSessionTemplate"("templateId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapSessionTemplate_templateId_order_key" ON "RoadmapSessionTemplate"("templateId", "order");

-- CreateIndex
CREATE INDEX "RoadmapSessionTemplate_templateId_idx" ON "RoadmapSessionTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapChapterTemplate_sessionTemplateId_slug_key" ON "RoadmapChapterTemplate"("sessionTemplateId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapChapterTemplate_sessionTemplateId_order_key" ON "RoadmapChapterTemplate"("sessionTemplateId", "order");

-- CreateIndex
CREATE INDEX "RoadmapChapterTemplate_sessionTemplateId_idx" ON "RoadmapChapterTemplate"("sessionTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapQuestionTemplate_sessionTemplateId_order_key" ON "RoadmapQuestionTemplate"("sessionTemplateId", "order");

-- CreateIndex
CREATE INDEX "RoadmapQuestionTemplate_sessionTemplateId_idx" ON "RoadmapQuestionTemplate"("sessionTemplateId");

-- CreateIndex
CREATE INDEX "RoadmapQuestionTemplate_chapterTemplateId_idx" ON "RoadmapQuestionTemplate"("chapterTemplateId");

-- CreateIndex
CREATE INDEX "RoadmapQuestionTemplate_sourceType_idx" ON "RoadmapQuestionTemplate"("sourceType");

-- CreateIndex
CREATE INDEX "RoadmapQuestionTemplate_dsaQuestionSlug_idx" ON "RoadmapQuestionTemplate"("dsaQuestionSlug");

-- CreateIndex
CREATE INDEX "RoadmapQuestionTemplate_prepQuestionTemplateId_idx" ON "RoadmapQuestionTemplate"("prepQuestionTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoadmap_ownerId_role_key" ON "UserRoadmap"("ownerId", "role");

-- CreateIndex
CREATE INDEX "UserRoadmap_ownerId_idx" ON "UserRoadmap"("ownerId");

-- CreateIndex
CREATE INDEX "UserRoadmap_templateId_idx" ON "UserRoadmap"("templateId");

-- CreateIndex
CREATE INDEX "UserRoadmap_role_idx" ON "UserRoadmap"("role");

-- CreateIndex
CREATE INDEX "UserRoadmap_status_idx" ON "UserRoadmap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserSessionProgress_roadmapId_sessionTemplateId_key" ON "UserSessionProgress"("roadmapId", "sessionTemplateId");

-- CreateIndex
CREATE INDEX "UserSessionProgress_roadmapId_idx" ON "UserSessionProgress"("roadmapId");

-- CreateIndex
CREATE INDEX "UserSessionProgress_sessionTemplateId_idx" ON "UserSessionProgress"("sessionTemplateId");

-- CreateIndex
CREATE INDEX "UserSessionProgress_status_idx" ON "UserSessionProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserChapterProgress_roadmapId_chapterTemplateId_key" ON "UserChapterProgress"("roadmapId", "chapterTemplateId");

-- CreateIndex
CREATE INDEX "UserChapterProgress_roadmapId_idx" ON "UserChapterProgress"("roadmapId");

-- CreateIndex
CREATE INDEX "UserChapterProgress_sessionProgressId_idx" ON "UserChapterProgress"("sessionProgressId");

-- CreateIndex
CREATE INDEX "UserChapterProgress_chapterTemplateId_idx" ON "UserChapterProgress"("chapterTemplateId");

-- CreateIndex
CREATE INDEX "UserChapterProgress_status_idx" ON "UserChapterProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestionProgress_roadmapId_order_key" ON "UserQuestionProgress"("roadmapId", "order");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_roadmapId_idx" ON "UserQuestionProgress"("roadmapId");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_sessionProgressId_idx" ON "UserQuestionProgress"("sessionProgressId");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_chapterProgressId_idx" ON "UserQuestionProgress"("chapterProgressId");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_roadmapQuestionTemplateId_idx" ON "UserQuestionProgress"("roadmapQuestionTemplateId");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_sourceType_idx" ON "UserQuestionProgress"("sourceType");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_status_idx" ON "UserQuestionProgress"("status");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_dsaQuestionSlug_idx" ON "UserQuestionProgress"("dsaQuestionSlug");

-- CreateIndex
CREATE INDEX "UserQuestionProgress_prepQuestionTemplateId_idx" ON "UserQuestionProgress"("prepQuestionTemplateId");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_ownerId_createdAt_idx" ON "UserQuestionAttempt"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_questionProgressId_idx" ON "UserQuestionAttempt"("questionProgressId");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_sourceType_idx" ON "UserQuestionAttempt"("sourceType");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_status_idx" ON "UserQuestionAttempt"("status");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_dsaQuestionSlug_idx" ON "UserQuestionAttempt"("dsaQuestionSlug");

-- CreateIndex
CREATE INDEX "UserQuestionAttempt_prepQuestionTemplateId_idx" ON "UserQuestionAttempt"("prepQuestionTemplateId");

-- CreateIndex
CREATE INDEX "UserMayaInsight_roadmapId_idx" ON "UserMayaInsight"("roadmapId");

-- CreateIndex
CREATE INDEX "UserMayaInsight_ownerId_isActive_idx" ON "UserMayaInsight"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "UserMayaInsight_kind_idx" ON "UserMayaInsight"("kind");

-- CreateIndex
CREATE INDEX "UserMayaInsight_priority_idx" ON "UserMayaInsight"("priority");

-- AddForeignKey
ALTER TABLE "RoadmapSessionTemplate" ADD CONSTRAINT "RoadmapSessionTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RoadmapTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapChapterTemplate" ADD CONSTRAINT "RoadmapChapterTemplate_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "RoadmapSessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapQuestionTemplate" ADD CONSTRAINT "RoadmapQuestionTemplate_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "RoadmapSessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapQuestionTemplate" ADD CONSTRAINT "RoadmapQuestionTemplate_chapterTemplateId_fkey" FOREIGN KEY ("chapterTemplateId") REFERENCES "RoadmapChapterTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapQuestionTemplate" ADD CONSTRAINT "RoadmapQuestionTemplate_dsaQuestionSlug_fkey" FOREIGN KEY ("dsaQuestionSlug") REFERENCES "DsaQuestion"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapQuestionTemplate" ADD CONSTRAINT "RoadmapQuestionTemplate_prepQuestionTemplateId_fkey" FOREIGN KEY ("prepQuestionTemplateId") REFERENCES "PrepQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoadmap" ADD CONSTRAINT "UserRoadmap_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoadmap" ADD CONSTRAINT "UserRoadmap_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RoadmapTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSessionProgress" ADD CONSTRAINT "UserSessionProgress_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "UserRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSessionProgress" ADD CONSTRAINT "UserSessionProgress_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "RoadmapSessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChapterProgress" ADD CONSTRAINT "UserChapterProgress_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "UserRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChapterProgress" ADD CONSTRAINT "UserChapterProgress_sessionProgressId_fkey" FOREIGN KEY ("sessionProgressId") REFERENCES "UserSessionProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChapterProgress" ADD CONSTRAINT "UserChapterProgress_chapterTemplateId_fkey" FOREIGN KEY ("chapterTemplateId") REFERENCES "RoadmapChapterTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "UserRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_sessionProgressId_fkey" FOREIGN KEY ("sessionProgressId") REFERENCES "UserSessionProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_chapterProgressId_fkey" FOREIGN KEY ("chapterProgressId") REFERENCES "UserChapterProgress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_roadmapQuestionTemplateId_fkey" FOREIGN KEY ("roadmapQuestionTemplateId") REFERENCES "RoadmapQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_dsaQuestionSlug_fkey" FOREIGN KEY ("dsaQuestionSlug") REFERENCES "DsaQuestion"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_prepQuestionTemplateId_fkey" FOREIGN KEY ("prepQuestionTemplateId") REFERENCES "PrepQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionAttempt" ADD CONSTRAINT "UserQuestionAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionAttempt" ADD CONSTRAINT "UserQuestionAttempt_questionProgressId_fkey" FOREIGN KEY ("questionProgressId") REFERENCES "UserQuestionProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionAttempt" ADD CONSTRAINT "UserQuestionAttempt_dsaQuestionSlug_fkey" FOREIGN KEY ("dsaQuestionSlug") REFERENCES "DsaQuestion"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionAttempt" ADD CONSTRAINT "UserQuestionAttempt_prepQuestionTemplateId_fkey" FOREIGN KEY ("prepQuestionTemplateId") REFERENCES "PrepQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMayaInsight" ADD CONSTRAINT "UserMayaInsight_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "UserRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMayaInsight" ADD CONSTRAINT "UserMayaInsight_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CandidateProfile"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
