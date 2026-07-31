-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DesignSessionStatus" AS ENUM (
  'DRAFT',
  'REQUIREMENTS_PENDING',
  'READY_FOR_DESIGN',
  'GENERATING',
  'COMPLETED',
  'FAILED'
);

-- CreateTable
CREATE TABLE "Project" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignSession" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "problemStatement" TEXT NOT NULL,
  "status" "DesignSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "currentStep" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DesignSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "DesignSession_projectId_idx" ON "DesignSession"("projectId");

-- CreateIndex
CREATE INDEX "DesignSession_status_idx" ON "DesignSession"("status");

-- CreateIndex
CREATE INDEX "DesignSession_projectId_createdAt_idx" ON "DesignSession"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "DesignSession" ADD CONSTRAINT "DesignSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
