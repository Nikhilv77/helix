import {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeEmbeddingStatus,
  KnowledgeSourceType
} from "@prisma/client";
import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeController, KnowledgeEmbeddingsController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";

describe("KnowledgeController", () => {
  const document: KnowledgeDocument = {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Caching",
    sourceType: KnowledgeSourceType.MARKDOWN,
    sourceUrl: null,
    contentHash: "hash",
    status: KnowledgeDocumentStatus.COMPLETED,
    errorMessage: null,
    embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
    embeddingErrorMessage: null,
    embeddedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };

  it("keeps endpoints thin by delegating to the service", async () => {
    const createDocument = jest.fn().mockResolvedValue({ ...document, chunks: [] });
    const listDocuments = jest.fn().mockResolvedValue([document]);
    const getDocument = jest.fn().mockResolvedValue({ ...document, chunks: [] });
    const deleteDocument = jest.fn().mockResolvedValue(document);
    const embedDocument = jest.fn();
    const controller = new KnowledgeController(
      {
        createDocument,
        listDocuments,
        getDocument,
        deleteDocument
      } as unknown as KnowledgeService,
      { embedDocument } as unknown as EmbeddingsService
    );

    await expect(
      controller.createDocument({
        title: "Caching",
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceUrl: null,
        content: "# Caching"
      })
    ).resolves.toMatchObject({ id: document.id });
    await expect(controller.listDocuments()).resolves.toEqual([document]);
    await expect(controller.getDocument(document.id)).resolves.toMatchObject({ id: document.id });
    await expect(controller.deleteDocument(document.id)).resolves.toBe(document);
  });

  it("delegates embedding endpoints to the embeddings service", async () => {
    const embedDocument = jest.fn().mockResolvedValue({
      documentId: document.id,
      totalChunks: 1,
      embeddedChunks: 1,
      skippedChunks: 0,
      failedChunks: 0
    });
    const rebuildEmbeddings = jest.fn().mockResolvedValue({
      documents: [],
      totalChunks: 0,
      embeddedChunks: 0,
      skippedChunks: 0,
      failedChunks: 0
    });
    const getStatus = jest.fn().mockResolvedValue({
      documents: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
      chunks: { total: 0, pending: 0, processing: 0, embedded: 0, failed: 0, outdated: 0 },
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    const documentsController = new KnowledgeController(
      {} as KnowledgeService,
      { embedDocument } as unknown as EmbeddingsService
    );
    const embeddingsController = new KnowledgeEmbeddingsController({
      rebuildEmbeddings,
      getStatus
    } as unknown as EmbeddingsService);

    await expect(documentsController.embedDocument(document.id)).resolves.toMatchObject({
      embeddedChunks: 1
    });
    await expect(embeddingsController.rebuildEmbeddings()).resolves.toMatchObject({
      totalChunks: 0
    });
    await expect(embeddingsController.getStatus()).resolves.toMatchObject({
      model: "gemini-embedding-test"
    });
  });
});
