-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('PLAIN_TEXT', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "sourceType" "KnowledgeSourceType" NOT NULL,
  "sourceUrl" TEXT,
  "contentHash" TEXT NOT NULL,
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "tokenEstimate" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_contentHash_key" ON "KnowledgeDocument"("contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_sourceType_idx" ON "KnowledgeDocument"("sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_createdAt_idx" ON "KnowledgeDocument"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_chunkIndex_idx" ON "KnowledgeChunk"("chunkIndex");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
