import { KnowledgeDocumentStatus, KnowledgeEmbeddingStatus, KnowledgeSourceType } from "@prisma/client";
import { EmbeddingsProvider } from "../ai/interfaces/embeddings-provider.interface";
import { AppConfigService } from "../config/app-config.service";
import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeChunkEmbeddingCandidate, KnowledgeRepository } from "./knowledge.repository";
import { createContentHash } from "./utils/content-hash";

describe("EmbeddingsService", () => {
  const documentId = "55555555-5555-4555-8555-555555555555";
  const document = {
    id: documentId,
    title: "Caching",
    sourceType: KnowledgeSourceType.MARKDOWN,
    sourceUrl: null,
    contentHash: "document-hash",
    status: KnowledgeDocumentStatus.COMPLETED,
    errorMessage: null,
    embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
    embeddingErrorMessage: null,
    embeddedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    chunks: []
  };

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
      retrievalDefaultTopK: 5,
      retrievalMinSimilarity: 0.2,
      ...overrides
    });
  }

  function createChunk(
    index: number,
    overrides: Partial<KnowledgeChunkEmbeddingCandidate> = {}
  ): KnowledgeChunkEmbeddingCandidate {
    const content = `Chunk ${index}`;

    return {
      id: `${index}${index}${index}${index}${index}${index}${index}${index}-${index}${index}${index}${index}-4${index}${index}${index}-8${index}${index}${index}-${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}`,
      documentId,
      content,
      contentHash: createContentHash(content),
      embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
      embeddingModel: null,
      embeddingModelVersion: null,
      embeddingContentHash: null,
      ...overrides
    };
  }

  function createService(input: {
    chunks: KnowledgeChunkEmbeddingCandidate[];
    provider?: {
      generateEmbeddings: jest.MockedFunction<EmbeddingsProvider["generateEmbeddings"]>;
    };
    repository?: Partial<KnowledgeRepository>;
    config?: Partial<ConstructorParameters<typeof AppConfigService>[0]>;
  }): {
    service: EmbeddingsService;
    generateEmbeddings: jest.MockedFunction<EmbeddingsProvider["generateEmbeddings"]>;
    markChunkEmbeddingFailed: jest.Mock;
    markDocumentEmbeddingFailed: jest.Mock;
    getEmbeddingStatusCounts: jest.Mock;
  } {
    const markChunkEmbeddingFailed = jest.fn().mockResolvedValue(undefined);
    const markDocumentEmbeddingFailed = jest.fn().mockResolvedValue({
      ...document,
      embeddingStatus: KnowledgeEmbeddingStatus.FAILED
    });
    const getEmbeddingStatusCounts = jest.fn().mockResolvedValue({
      documents: { total: 1, pending: 0, processing: 0, completed: 1, failed: 0 },
      chunks: { total: 1, pending: 0, processing: 0, embedded: 1, failed: 0, outdated: 0 },
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    const repository = {
      findDocumentById: jest.fn().mockResolvedValue(document),
      findChunkEmbeddingCandidatesByDocumentId: jest.fn().mockResolvedValue(input.chunks),
      listKnowledgeDocumentIds: jest.fn().mockResolvedValue([{ id: documentId }]),
      markDocumentEmbeddingProcessing: jest.fn().mockResolvedValue(document),
      markDocumentEmbeddingCompleted: jest.fn().mockResolvedValue({
        ...document,
        embeddingStatus: KnowledgeEmbeddingStatus.COMPLETED
      }),
      markDocumentEmbeddingFailed,
      markChunksEmbeddingProcessing: jest.fn().mockResolvedValue({ count: input.chunks.length }),
      markChunkEmbeddingCompleted: jest.fn().mockResolvedValue(undefined),
      markChunkEmbeddingFailed,
      getEmbeddingStatusCounts,
      ...input.repository
    } as unknown as KnowledgeRepository;
    const defaultGenerateEmbeddings = jest
      .fn<ReturnType<EmbeddingsProvider["generateEmbeddings"]>, Parameters<EmbeddingsProvider["generateEmbeddings"]>>()
      .mockResolvedValue({
        embeddings: input.chunks.map(() => [0.1, 0.2, 0.3, 0.4]),
        model: "gemini-embedding-test",
        modelVersion: "test-version"
      });
    const generateEmbeddings = input.provider?.generateEmbeddings ?? defaultGenerateEmbeddings;
    const provider: EmbeddingsProvider = { generateEmbeddings };
    const service = new EmbeddingsService(createConfig(input.config), repository, provider);

    return {
      service,
      generateEmbeddings,
      markChunkEmbeddingFailed,
      markDocumentEmbeddingFailed,
      getEmbeddingStatusCounts
    };
  }

  it("generates embeddings in configured batches", async () => {
    const chunks = [createChunk(1), createChunk(2), createChunk(3)];
    const { service, generateEmbeddings } = createService({ chunks });

    await expect(service.embedDocument(documentId)).resolves.toMatchObject({
      totalChunks: 3,
      embeddedChunks: 3,
      skippedChunks: 0,
      failedChunks: 0
    });
    expect(generateEmbeddings).toHaveBeenCalledTimes(2);
  });

  it("skips chunks that are unchanged for the current model version", async () => {
    const currentContent = "Current chunk";
    const currentHash = createContentHash(currentContent);
    const chunks = [
      createChunk(1, {
        content: currentContent,
        contentHash: currentHash,
        embeddingStatus: KnowledgeEmbeddingStatus.COMPLETED,
        embeddingModel: "gemini-embedding-test",
        embeddingModelVersion: "test-version",
        embeddingContentHash: currentHash
      }),
      createChunk(2)
    ];
    const { service, generateEmbeddings } = createService({ chunks });

    await expect(service.embedDocument(documentId)).resolves.toMatchObject({
      totalChunks: 2,
      embeddedChunks: 1,
      skippedChunks: 1,
      failedChunks: 0
    });
    expect(generateEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("marks chunks and document failed when a batch fails", async () => {
    const chunks = [createChunk(1), createChunk(2)];
    const { service, markChunkEmbeddingFailed, markDocumentEmbeddingFailed } = createService({
      chunks,
      provider: {
        generateEmbeddings: jest.fn().mockRejectedValue(new Error("provider failed"))
      }
    });

    await expect(service.embedDocument(documentId)).resolves.toMatchObject({
      embeddedChunks: 0,
      failedChunks: 2
    });
    expect(markChunkEmbeddingFailed).toHaveBeenCalledTimes(2);
    expect(markDocumentEmbeddingFailed).toHaveBeenCalledWith(
      documentId,
      "One or more knowledge chunks failed to embed"
    );
  });

  it("rebuilds embeddings across documents while skipping unchanged chunks", async () => {
    const chunks = [createChunk(1)];
    const { service } = createService({ chunks });

    await expect(service.rebuildEmbeddings()).resolves.toMatchObject({
      totalChunks: 1,
      embeddedChunks: 1,
      skippedChunks: 0,
      failedChunks: 0
    });
  });

  it("returns embedding status counts", async () => {
    const { service, getEmbeddingStatusCounts } = createService({ chunks: [] });

    await expect(service.getStatus()).resolves.toMatchObject({
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    expect(getEmbeddingStatusCounts).toHaveBeenCalledWith(
      "gemini-embedding-test",
      "test-version"
    );
  });
});
