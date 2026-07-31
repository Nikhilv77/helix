import { Logger } from "@nestjs/common";
import { KnowledgeSourceType } from "@prisma/client";
import { AppConfigService } from "../config/app-config.service";
import { RetrievalRepository, RetrievalSearchRow } from "./retrieval.repository";
import { RetrievalService } from "./retrieval.service";

describe("RetrievalService", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createConfig(overrides: Partial<ConstructorParameters<typeof AppConfigService>[0]> = {}) {
    return new AppConfigService({
      nodeEnv: "test",
      port: 3000,
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/ai_system_design",
      appName: "AI System Design Copilot",
      appVersion: "0.1.0",
      corsOrigins: [],
      logLevel: "info",
      geminiApiKey: "test-gemini-key",
      geminiFastModel: "gemini-fast-test",
      geminiReasoningModel: "gemini-reasoning-test",
      geminiEmbeddingModel: "gemini-embedding-test",
      geminiEmbeddingModelVersion: "test-version",
      aiTimeoutMs: 1000,
      aiMaxRetries: 0,
      knowledgeChunkMaxTokens: 80,
      knowledgeEmbeddingDimensions: 4,
      knowledgeEmbeddingBatchSize: 2,
      retrievalDefaultTopK: 3,
      retrievalMinSimilarity: 0.2,
      ...overrides
    });
  }

  function createRow(index: number, overrides: Partial<RetrievalSearchRow> = {}): RetrievalSearchRow {
    return {
      chunkId: `chunk-${index}`,
      documentId: `document-${index}`,
      documentTitle: `Document ${index}`,
      sourceType: KnowledgeSourceType.MARKDOWN,
      sourceUrl: null,
      content: `Content ${index}`,
      contentHash: `hash-${index}`,
      metadata: { headingPath: [`Heading ${index}`] },
      similarity: 1 - index / 10,
      ...overrides
    };
  }

  function createService(rows: RetrievalSearchRow[] = []) {
    const searchKnowledgeChunks = jest.fn().mockResolvedValue(rows);
    const generateEmbeddings = jest.fn().mockResolvedValue({
      embeddings: [[1, 0, 0, 0]],
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    const service = new RetrievalService(
      createConfig(),
      { searchKnowledgeChunks } as unknown as RetrievalRepository,
      { generateEmbeddings }
    );

    return { service, searchKnowledgeChunks, generateEmbeddings };
  }

  it("passes filters and thresholds to the retrieval repository", async () => {
    const { service, searchKnowledgeChunks } = createService([createRow(1)]);

    await service.search({
      query: "retry queues",
      topK: 5,
      minSimilarity: 0.45,
      sourceType: KnowledgeSourceType.PLAIN_TEXT,
      documentId: "55555555-5555-4555-8555-555555555555"
    });

    expect(searchKnowledgeChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: [1, 0, 0, 0],
        topK: 20,
        minSimilarity: 0.45,
        sourceType: KnowledgeSourceType.PLAIN_TEXT,
        documentId: "55555555-5555-4555-8555-555555555555",
        model: "gemini-embedding-test",
        modelVersion: "test-version"
      })
    );
  });

  it("preserves repository ranking and limits to topK", async () => {
    const rows = [createRow(1, { similarity: 0.95 }), createRow(2, { similarity: 0.91 })];
    const { service } = createService(rows);

    await expect(service.search({ query: "database choice", topK: 1 })).resolves.toMatchObject({
      results: [{ chunkId: "chunk-1", similarity: 0.95 }],
      meta: { returned: 1 }
    });
  });

  it("deduplicates exact and near-identical chunks", async () => {
    const rows = [
      createRow(1, {
        contentHash: "same-hash",
        content: "Consumers retry failed notifications through a message queue."
      }),
      createRow(2, {
        contentHash: "same-hash",
        content: "Consumers retry failed notifications through a message queue."
      }),
      createRow(3, {
        contentHash: "different-hash",
        content: "Consumers retry failed notifications through a message queue!"
      }),
      createRow(4, {
        contentHash: "unique-hash",
        content: "Relational databases support transactions."
      })
    ];
    const { service } = createService(rows);

    const response = await service.search({ query: "notification retries", topK: 5 });

    expect(response.results.map((result) => result.chunkId)).toEqual(["chunk-1", "chunk-4"]);
  });

  it("returns empty results when the repository finds no chunks above threshold", async () => {
    const { service } = createService([]);

    await expect(service.search({ query: "nothing", minSimilarity: 0.9 })).resolves.toMatchObject({
      results: [],
      meta: {
        returned: 0,
        scanned: 0,
        minSimilarity: 0.9
      }
    });
  });

  it("returns empty results when the embedding provider returns no query embedding", async () => {
    const searchKnowledgeChunks = jest.fn();
    const generateEmbeddings = jest.fn().mockResolvedValue({
      embeddings: [],
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    const service = new RetrievalService(
      createConfig(),
      { searchKnowledgeChunks } as unknown as RetrievalRepository,
      { generateEmbeddings }
    );

    await expect(service.search({ query: "retry queues" })).resolves.toMatchObject({
      results: [],
      meta: {
        returned: 0,
        scanned: 0
      }
    });
    expect(searchKnowledgeChunks).not.toHaveBeenCalled();
  });
});
