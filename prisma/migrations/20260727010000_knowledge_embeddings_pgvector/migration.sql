-- EnableExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "embeddingErrorMessage" TEXT,
  ADD COLUMN "embeddedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "embedding" vector,
  ADD COLUMN "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "embeddingModelVersion" TEXT,
  ADD COLUMN "embeddingContentHash" TEXT,
  ADD COLUMN "embeddingErrorMessage" TEXT,
  ADD COLUMN "embeddedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_embeddingStatus_idx" ON "KnowledgeDocument"("embeddingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_contentHash_idx" ON "KnowledgeChunk"("contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_embeddingStatus_idx" ON "KnowledgeChunk"("embeddingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_embeddingModel_embeddingModelVersion_idx" ON "KnowledgeChunk"("embeddingModel", "embeddingModelVersion");
