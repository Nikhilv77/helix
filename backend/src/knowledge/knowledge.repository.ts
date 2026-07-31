import { Injectable } from "@nestjs/common";
import {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeEmbeddingStatus,
  KnowledgeSourceType,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { PreparedKnowledgeChunk } from "./utils/knowledge-chunker";

export type KnowledgeDocumentWithChunks = KnowledgeDocument & {
  chunks: KnowledgeChunk[];
};

export interface KnowledgeChunkEmbeddingCandidate {
  id: string;
  documentId: string;
  content: string;
  contentHash: string | null;
  embeddingStatus: KnowledgeEmbeddingStatus;
  embeddingModel: string | null;
  embeddingModelVersion: string | null;
  embeddingContentHash: string | null;
}

export interface KnowledgeEmbeddingStatusCounts {
  documents: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  chunks: {
    total: number;
    pending: number;
    processing: number;
    embedded: number;
    failed: number;
    outdated: number;
  };
  model: string;
  modelVersion: string;
}

interface CreatePendingDocumentInput {
  title: string;
  sourceType: KnowledgeSourceType;
  sourceUrl?: string | null;
  contentHash: string;
}

@Injectable()
export class KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByContentHash(contentHash: string): Promise<KnowledgeDocument | null> {
    return this.prisma.knowledgeDocument.findUnique({
      where: { contentHash }
    });
  }

  createPendingDocument(input: CreatePendingDocumentInput): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.create({
      data: {
        title: input.title,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        contentHash: input.contentHash,
        status: KnowledgeDocumentStatus.PENDING
      }
    });
  }

  startProcessing(documentId: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeDocumentStatus.PROCESSING,
        errorMessage: null
      }
    });
  }

  completeDocument(
    documentId: string,
    chunks: PreparedKnowledgeChunk[]
  ): Promise<KnowledgeDocumentWithChunks> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId,
          content: chunk.content,
          contentHash: chunk.contentHash,
          chunkIndex: chunk.chunkIndex,
          tokenEstimate: chunk.tokenEstimate,
          metadata: chunk.metadata
        }))
      });

      return transaction.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeDocumentStatus.COMPLETED,
          errorMessage: null
        },
        include: {
          chunks: {
            orderBy: { chunkIndex: "asc" }
          }
        }
      });
    });
  }

  failDocument(documentId: string, errorMessage: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeDocumentStatus.FAILED,
        errorMessage
      }
    });
  }

  listDocuments(): Promise<KnowledgeDocument[]> {
    return this.prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  findDocumentById(id: string): Promise<KnowledgeDocumentWithChunks | null> {
    return this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" }
        }
      }
    });
  }

  deleteDocument(id: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.delete({
      where: { id }
    });
  }

  countChunksForDocument(documentId: string): Promise<number> {
    return this.prisma.knowledgeChunk.count({
      where: { documentId }
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  findChunkEmbeddingCandidatesByDocumentId(
    documentId: string
  ): Promise<KnowledgeChunkEmbeddingCandidate[]> {
    return this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
      select: {
        id: true,
        documentId: true,
        content: true,
        contentHash: true,
        embeddingStatus: true,
        embeddingModel: true,
        embeddingModelVersion: true,
        embeddingContentHash: true
      }
    });
  }

  findAllChunkEmbeddingCandidates(): Promise<KnowledgeChunkEmbeddingCandidate[]> {
    return this.prisma.knowledgeChunk.findMany({
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
      select: {
        id: true,
        documentId: true,
        content: true,
        contentHash: true,
        embeddingStatus: true,
        embeddingModel: true,
        embeddingModelVersion: true,
        embeddingContentHash: true
      }
    });
  }

  listKnowledgeDocumentIds(): Promise<Array<{ id: string }>> {
    return this.prisma.knowledgeDocument.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" }
    });
  }

  markDocumentEmbeddingProcessing(documentId: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.PROCESSING,
        embeddingErrorMessage: null
      }
    });
  }

  markDocumentEmbeddingCompleted(documentId: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.COMPLETED,
        embeddingErrorMessage: null,
        embeddedAt: new Date()
      }
    });
  }

  markDocumentEmbeddingFailed(documentId: string, errorMessage: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.FAILED,
        embeddingErrorMessage: errorMessage
      }
    });
  }

  markChunksEmbeddingProcessing(chunkIds: string[]): Promise<Prisma.BatchPayload> {
    return this.prisma.knowledgeChunk.updateMany({
      where: { id: { in: chunkIds } },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.PROCESSING,
        embeddingErrorMessage: null
      }
    });
  }

  async markChunkEmbeddingCompleted(input: {
    chunkId: string;
    embedding: number[];
    model: string;
    modelVersion: string;
    contentHash: string;
  }): Promise<void> {
    const vector = `[${input.embedding.join(",")}]`;

    await this.prisma.$executeRaw`
      UPDATE "KnowledgeChunk"
      SET
        "embedding" = ${vector}::vector,
        "embeddingStatus" = 'COMPLETED'::"KnowledgeEmbeddingStatus",
        "embeddingModel" = ${input.model},
        "embeddingModelVersion" = ${input.modelVersion},
        "embeddingContentHash" = ${input.contentHash},
        "contentHash" = ${input.contentHash},
        "embeddingErrorMessage" = NULL,
        "embeddedAt" = NOW()
      WHERE "id" = ${input.chunkId}::uuid
    `;
  }

  markChunkEmbeddingFailed(chunkId: string, errorMessage: string): Promise<KnowledgeChunk> {
    return this.prisma.knowledgeChunk.update({
      where: { id: chunkId },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.FAILED,
        embeddingErrorMessage: errorMessage
      }
    });
  }

  async getEmbeddingStatusCounts(
    model: string,
    modelVersion: string
  ): Promise<KnowledgeEmbeddingStatusCounts> {
    const [
      documentTotal,
      pendingDocuments,
      processingDocuments,
      completedDocuments,
      failedDocuments,
      chunkTotal,
      pendingChunks,
      processingChunks,
      completedChunks,
      failedChunks,
      outdatedRows
    ] =
      await this.prisma.$transaction([
        this.prisma.knowledgeDocument.count(),
        this.countDocumentsByEmbeddingStatus(KnowledgeEmbeddingStatus.PENDING),
        this.countDocumentsByEmbeddingStatus(KnowledgeEmbeddingStatus.PROCESSING),
        this.countDocumentsByEmbeddingStatus(KnowledgeEmbeddingStatus.COMPLETED),
        this.countDocumentsByEmbeddingStatus(KnowledgeEmbeddingStatus.FAILED),
        this.prisma.knowledgeChunk.count(),
        this.countChunksByEmbeddingStatus(KnowledgeEmbeddingStatus.PENDING),
        this.countChunksByEmbeddingStatus(KnowledgeEmbeddingStatus.PROCESSING),
        this.countChunksByEmbeddingStatus(KnowledgeEmbeddingStatus.COMPLETED),
        this.countChunksByEmbeddingStatus(KnowledgeEmbeddingStatus.FAILED),
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "KnowledgeChunk"
          WHERE "embeddingStatus" = 'COMPLETED'::"KnowledgeEmbeddingStatus"
            AND (
              "embeddingModel" IS DISTINCT FROM ${model}
              OR "embeddingModelVersion" IS DISTINCT FROM ${modelVersion}
              OR "embeddingContentHash" IS NULL
              OR "contentHash" IS NULL
              OR "embeddingContentHash" IS DISTINCT FROM "contentHash"
          )
        `
      ]);

    return {
      documents: {
        total: documentTotal,
        pending: pendingDocuments,
        processing: processingDocuments,
        completed: completedDocuments,
        failed: failedDocuments
      },
      chunks: {
        total: chunkTotal,
        pending: pendingChunks,
        processing: processingChunks,
        embedded: completedChunks,
        failed: failedChunks,
        outdated: Number(outdatedRows[0]?.count ?? 0)
      },
      model,
      modelVersion
    };
  }

  private countDocumentsByEmbeddingStatus(status: KnowledgeEmbeddingStatus): Prisma.PrismaPromise<number> {
    return this.prisma.knowledgeDocument.count({
      where: { embeddingStatus: status }
    });
  }

  private countChunksByEmbeddingStatus(status: KnowledgeEmbeddingStatus): Prisma.PrismaPromise<number> {
    return this.prisma.knowledgeChunk.count({
      where: { embeddingStatus: status }
    });
  }
}
