import { KnowledgeSourceType, Prisma } from "@prisma/client";
import type { EmbeddingsProvider } from "../ai/interfaces/embeddings-provider.interface";
import { Logger } from "../common/logger";
import { AppConfigService } from "../config/app-config.service";
import { RetrievalRepository, RetrievalSearchRow } from "./retrieval.repository";

export interface RetrievalSearchRequest {
  query: string;
  topK?: number;
  minSimilarity?: number;
  sourceType?: KnowledgeSourceType;
  documentId?: string;
}

export interface RetrievalSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string | null;
  content: string;
  similarity: number;
  metadata: Prisma.JsonValue;
}

export interface RetrievalSearchResponse {
  query: string;
  results: RetrievalSearchResult[];
  meta: {
    topK: number;
    minSimilarity: number;
    returned: number;
    scanned: number;
    sourceType?: KnowledgeSourceType;
    documentId?: string;
  };
}

const OVERFETCH_MULTIPLIER = 4;
const MIN_OVERFETCH = 20;
const NEAR_DUPLICATE_THRESHOLD = 0.92;

export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly retrievalRepository: RetrievalRepository,
    private readonly embeddingsProvider: EmbeddingsProvider
  ) {}

  async search(request: RetrievalSearchRequest): Promise<RetrievalSearchResponse> {
    const topK = request.topK ?? this.config.retrievalDefaultTopK;
    const minSimilarity = request.minSimilarity ?? this.config.retrievalMinSimilarity;
    const embeddingResult = await this.embeddingsProvider.generateEmbeddings({
      operation: "retrieval.query.embed",
      texts: [request.query]
    });
    const queryEmbedding = embeddingResult.embeddings[0];

    if (!queryEmbedding) {
      return this.emptyResponse(request, topK, minSimilarity);
    }

    const searchLimit = Math.max(topK * OVERFETCH_MULTIPLIER, MIN_OVERFETCH);
    const rows = await this.retrievalRepository.searchKnowledgeChunks({
      embedding: queryEmbedding,
      topK: searchLimit,
      minSimilarity,
      sourceType: request.sourceType,
      documentId: request.documentId,
      model: embeddingResult.model,
      modelVersion: embeddingResult.modelVersion
    });
    const results = this.dedupeResults(rows).slice(0, topK);

    this.logger.log(
      JSON.stringify({
        event: "retrieval.search",
        queryLength: request.query.length,
        topK,
        minSimilarity,
        sourceType: request.sourceType,
        documentId: request.documentId,
        scanned: rows.length,
        returned: results.length,
        embeddingModel: embeddingResult.model,
        embeddingModelVersion: embeddingResult.modelVersion
      })
    );

    return {
      query: request.query,
      results,
      meta: {
        topK,
        minSimilarity,
        returned: results.length,
        scanned: rows.length,
        sourceType: request.sourceType,
        documentId: request.documentId
      }
    };
  }

  private emptyResponse(
    request: RetrievalSearchRequest,
    topK: number,
    minSimilarity: number
  ): RetrievalSearchResponse {
    return {
      query: request.query,
      results: [],
      meta: {
        topK,
        minSimilarity,
        returned: 0,
        scanned: 0,
        sourceType: request.sourceType,
        documentId: request.documentId
      }
    };
  }

  private dedupeResults(rows: RetrievalSearchRow[]): RetrievalSearchResult[] {
    const results: RetrievalSearchResult[] = [];
    const seenHashes = new Set<string>();

    for (const row of rows) {
      if (row.contentHash && seenHashes.has(row.contentHash)) {
        continue;
      }

      const normalizedContent = this.normalizeForDeduplication(row.content);
      const isNearDuplicate = results.some(
        (result) =>
          this.jaccardSimilarity(normalizedContent, this.normalizeForDeduplication(result.content)) >=
          NEAR_DUPLICATE_THRESHOLD
      );

      if (isNearDuplicate) {
        continue;
      }

      if (row.contentHash) {
        seenHashes.add(row.contentHash);
      }

      results.push({
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl,
        content: row.content,
        similarity: row.similarity,
        metadata: row.metadata
      });
    }

    return results;
  }

  private normalizeForDeduplication(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private jaccardSimilarity(leftTokens: string[], rightTokens: string[]): number {
    if (leftTokens.length === 0 || rightTokens.length === 0) {
      return 0;
    }

    const left = new Set(leftTokens);
    const right = new Set(rightTokens);
    let intersection = 0;

    for (const token of left) {
      if (right.has(token)) {
        intersection += 1;
      }
    }

    return intersection / (left.size + right.size - intersection);
  }
}
