import { Injectable } from "@nestjs/common";
import { KnowledgeSourceType, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface RetrievalSearchFilters {
  sourceType?: KnowledgeSourceType;
  documentId?: string;
}

export interface RetrievalSearchRow {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string | null;
  content: string;
  contentHash: string | null;
  metadata: Prisma.JsonValue;
  similarity: number;
}

interface RetrievalSearchInput extends RetrievalSearchFilters {
  embedding: number[];
  topK: number;
  minSimilarity: number;
  model: string;
  modelVersion: string;
}

@Injectable()
export class RetrievalRepository {
  constructor(private readonly prisma: PrismaService) {}

  searchKnowledgeChunks(input: RetrievalSearchInput): Promise<RetrievalSearchRow[]> {
    const vector = `[${input.embedding.join(",")}]`;

    return this.prisma.$queryRaw<RetrievalSearchRow[]>`
      SELECT
        chunk."id"::text AS "chunkId",
        document."id"::text AS "documentId",
        document."title" AS "documentTitle",
        document."sourceType" AS "sourceType",
        document."sourceUrl" AS "sourceUrl",
        chunk."content" AS "content",
        chunk."contentHash" AS "contentHash",
        chunk."metadata" AS "metadata",
        1 - (chunk."embedding" <=> ${vector}::vector) AS "similarity"
      FROM "KnowledgeChunk" chunk
      INNER JOIN "KnowledgeDocument" document ON document."id" = chunk."documentId"
      WHERE chunk."embedding" IS NOT NULL
        AND chunk."embeddingStatus" = 'COMPLETED'::"KnowledgeEmbeddingStatus"
        AND chunk."embeddingModel" = ${input.model}
        AND chunk."embeddingModelVersion" = ${input.modelVersion}
        AND 1 - (chunk."embedding" <=> ${vector}::vector) >= ${input.minSimilarity}
        AND (${input.sourceType ?? null}::"KnowledgeSourceType" IS NULL OR document."sourceType" = ${input.sourceType ?? null}::"KnowledgeSourceType")
        AND (${input.documentId ?? null}::uuid IS NULL OR document."id" = ${input.documentId ?? null}::uuid)
      ORDER BY chunk."embedding" <=> ${vector}::vector ASC, chunk."chunkIndex" ASC
      LIMIT ${input.topK}
    `;
  }
}
