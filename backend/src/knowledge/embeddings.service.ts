import { Inject, Injectable } from "@nestjs/common";
import { KnowledgeEmbeddingStatus } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import type { EmbeddingsProvider } from "../ai/interfaces/embeddings-provider.interface";
import { EMBEDDINGS_PROVIDER } from "../ai/tokens/embeddings-provider.token";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { AppConfigService } from "../config/app-config.service";
import {
  KnowledgeChunkEmbeddingCandidate,
  KnowledgeEmbeddingStatusCounts,
  KnowledgeRepository
} from "./knowledge.repository";
import { createContentHash } from "./utils/content-hash";

export interface EmbedKnowledgeDocumentResult {
  documentId: string;
  totalChunks: number;
  embeddedChunks: number;
  skippedChunks: number;
  failedChunks: number;
}

export interface RebuildKnowledgeEmbeddingsResult {
  documents: EmbedKnowledgeDocumentResult[];
  totalChunks: number;
  embeddedChunks: number;
  skippedChunks: number;
  failedChunks: number;
}

interface EligibleChunk {
  id: string;
  documentId: string;
  content: string;
  contentHash: string;
}

@Injectable()
export class EmbeddingsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly knowledgeRepository: KnowledgeRepository,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddingsProvider: EmbeddingsProvider
  ) {}

  async embedDocument(documentId: string): Promise<EmbedKnowledgeDocumentResult> {
    const document = await this.knowledgeRepository.findDocumentById(documentId);

    if (!document) {
      throw new NotFoundErrorException("KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document not found", {
        documentId
      });
    }

    await this.knowledgeRepository.markDocumentEmbeddingProcessing(documentId);
    const candidates = await this.knowledgeRepository.findChunkEmbeddingCandidatesByDocumentId(documentId);
    const eligibleChunks = candidates.filter((chunk) => !this.isChunkCurrent(chunk));
    const result: EmbedKnowledgeDocumentResult = {
      documentId,
      totalChunks: candidates.length,
      embeddedChunks: 0,
      skippedChunks: candidates.length - eligibleChunks.length,
      failedChunks: 0
    };

    for (const batch of this.toBatches(eligibleChunks)) {
      const batchResult = await this.embedBatch("knowledge.document.embed", batch);
      result.embeddedChunks += batchResult.embeddedChunks;
      result.failedChunks += batchResult.failedChunks;
    }

    if (result.failedChunks > 0) {
      await this.knowledgeRepository.markDocumentEmbeddingFailed(
        documentId,
        "One or more knowledge chunks failed to embed"
      );
    } else {
      await this.knowledgeRepository.markDocumentEmbeddingCompleted(documentId);
    }

    return result;
  }

  async rebuildEmbeddings(): Promise<RebuildKnowledgeEmbeddingsResult> {
    const documents = await this.knowledgeRepository.listKnowledgeDocumentIds();
    const documentResults: EmbedKnowledgeDocumentResult[] = [];

    for (const document of documents) {
      documentResults.push(await this.embedDocument(document.id));
    }

    return {
      documents: documentResults,
      totalChunks: documentResults.reduce((sum, result) => sum + result.totalChunks, 0),
      embeddedChunks: documentResults.reduce((sum, result) => sum + result.embeddedChunks, 0),
      skippedChunks: documentResults.reduce((sum, result) => sum + result.skippedChunks, 0),
      failedChunks: documentResults.reduce((sum, result) => sum + result.failedChunks, 0)
    };
  }

  getStatus(): Promise<KnowledgeEmbeddingStatusCounts> {
    return this.knowledgeRepository.getEmbeddingStatusCounts(
      this.config.geminiEmbeddingModel,
      this.config.geminiEmbeddingModelVersion
    );
  }

  private async embedBatch(
    operation: string,
    batch: EligibleChunk[]
  ): Promise<{ embeddedChunks: number; failedChunks: number }> {
    await this.knowledgeRepository.markChunksEmbeddingProcessing(batch.map((chunk) => chunk.id));

    try {
      const result = await this.embeddingsProvider.generateEmbeddings({
        operation,
        texts: batch.map((chunk) => chunk.content)
      });

      for (let index = 0; index < batch.length; index += 1) {
        const chunk = batch[index];
        const embedding = result.embeddings[index];

        if (!chunk || !embedding) {
          throw new AiProviderException({
            code: "AI_INVALID_EMBEDDING_RESPONSE",
            message: "AI embedding provider returned an invalid response",
            provider: "embeddings",
            operation,
            retryable: false
          });
        }

        await this.knowledgeRepository.markChunkEmbeddingCompleted({
          chunkId: chunk.id,
          embedding,
          model: result.model,
          modelVersion: result.modelVersion,
          contentHash: chunk.contentHash
        });
      }

      return {
        embeddedChunks: batch.length,
        failedChunks: 0
      };
    } catch {
      await Promise.all(
        batch.map((chunk) =>
          this.knowledgeRepository.markChunkEmbeddingFailed(
            chunk.id,
            "Knowledge chunk embedding failed"
          )
        )
      );

      return {
        embeddedChunks: 0,
        failedChunks: batch.length
      };
    }
  }

  private isChunkCurrent(chunk: KnowledgeChunkEmbeddingCandidate): boolean {
    const contentHash = chunk.contentHash ?? createContentHash(chunk.content);

    return (
      chunk.embeddingStatus === KnowledgeEmbeddingStatus.COMPLETED &&
      chunk.embeddingModel === this.config.geminiEmbeddingModel &&
      chunk.embeddingModelVersion === this.config.geminiEmbeddingModelVersion &&
      chunk.embeddingContentHash === contentHash
    );
  }

  private toBatches(chunks: KnowledgeChunkEmbeddingCandidate[]): EligibleChunk[][] {
    const eligibleChunks = chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      contentHash: chunk.contentHash ?? createContentHash(chunk.content)
    }));
    const batches: EligibleChunk[][] = [];

    for (let index = 0; index < eligibleChunks.length; index += this.config.knowledgeEmbeddingBatchSize) {
      batches.push(eligibleChunks.slice(index, index + this.config.knowledgeEmbeddingBatchSize));
    }

    return batches;
  }
}
