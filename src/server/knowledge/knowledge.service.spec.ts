import {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeEmbeddingStatus,
  KnowledgeSourceType
} from "@prisma/client";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { AppConfigService } from "../config/app-config.service";
import { KnowledgeRepository } from "./knowledge.repository";
import { KnowledgeService } from "./knowledge.service";

interface CreatePendingDocumentCall {
  title: string;
  sourceType: KnowledgeSourceType;
  sourceUrl?: string | null;
  contentHash: string;
}

describe("KnowledgeService", () => {
  const document: KnowledgeDocument = {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Caching",
    sourceType: KnowledgeSourceType.MARKDOWN,
    sourceUrl: null,
    contentHash: "hash",
    status: KnowledgeDocumentStatus.PENDING,
    errorMessage: null,
    embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
    embeddingErrorMessage: null,
    embeddedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
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
      knowledgeEmbeddingDimensions: 32,
      knowledgeEmbeddingBatchSize: 4,
      retrievalDefaultTopK: 5,
      retrievalMinSimilarity: 0.2,
      ...overrides
    });
  }

  function createService(repository: Partial<KnowledgeRepository>) {
    return new KnowledgeService(createConfig(), repository as KnowledgeRepository);
  }

  it("creates a normalized, hashed, chunked document", async () => {
    const createPendingDocument = jest
      .fn<Promise<KnowledgeDocument>, [CreatePendingDocumentCall]>()
      .mockResolvedValue(document);
    const completeDocument = jest.fn().mockResolvedValue({ ...document, chunks: [] });
    const service = createService({
      findByContentHash: jest.fn().mockResolvedValue(null),
      createPendingDocument,
      startProcessing: jest.fn().mockResolvedValue({
        ...document,
        status: KnowledgeDocumentStatus.PROCESSING
      }),
      completeDocument,
      isUniqueConstraintError: jest.fn().mockReturnValue(false)
    });

    await expect(
      service.createDocument({
        title: "Caching",
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceUrl: null,
        content: "# Caching\r\n\r\nCache aside."
      })
    ).resolves.toMatchObject({
      id: document.id
    });

    const createCall = createPendingDocument.mock.calls[0]?.[0];
    expect(createCall).toBeDefined();
    expect(createCall?.title).toBe("Caching");
    expect(createCall?.sourceType).toBe(KnowledgeSourceType.MARKDOWN);
    expect(createCall?.sourceUrl).toBeNull();
    expect(typeof createCall?.contentHash).toBe("string");
    expect(completeDocument).toHaveBeenCalledWith(document.id, expect.any(Array));
  });

  it("rejects duplicate normalized content before ingestion", async () => {
    const service = createService({
      findByContentHash: jest.fn().mockResolvedValue({
        ...document,
        status: KnowledgeDocumentStatus.COMPLETED
      })
    });

    await expect(
      service.createDocument({
        title: "Duplicate",
        sourceType: KnowledgeSourceType.PLAIN_TEXT,
        content: "Same content"
      })
    ).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("marks the document failed when ingestion fails after document creation", async () => {
    const failDocument = jest.fn().mockResolvedValue({
      ...document,
      status: KnowledgeDocumentStatus.FAILED
    });
    const service = createService({
      findByContentHash: jest.fn().mockResolvedValue(null),
      createPendingDocument: jest.fn().mockResolvedValue(document),
      startProcessing: jest.fn().mockResolvedValue({
        ...document,
        status: KnowledgeDocumentStatus.PROCESSING
      }),
      completeDocument: jest.fn().mockRejectedValue(new Error("write failed")),
      failDocument,
      isUniqueConstraintError: jest.fn().mockReturnValue(false)
    });

    await expect(
      service.createDocument({
        title: "Caching",
        sourceType: KnowledgeSourceType.PLAIN_TEXT,
        content: "Caching reduces repeated reads."
      })
    ).rejects.toThrow("write failed");
    expect(failDocument).toHaveBeenCalledWith(document.id, "Knowledge document ingestion failed");
  });

  it("throws not found for missing documents", async () => {
    const service = createService({
      findDocumentById: jest.fn().mockResolvedValue(null)
    });

    await expect(service.getDocument(document.id)).rejects.toBeInstanceOf(NotFoundErrorException);
  });

  it("deletes the document through the repository so database cascade removes chunks", async () => {
    const deleteDocument = jest.fn().mockResolvedValue(document);
    const service = createService({
      findDocumentById: jest.fn().mockResolvedValue({ ...document, chunks: [] }),
      deleteDocument
    });

    await expect(service.deleteDocument(document.id)).resolves.toBe(document);
    expect(deleteDocument).toHaveBeenCalledWith(document.id);
  });
});
