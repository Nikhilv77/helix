import { INestApplication } from "@nestjs/common";
import { KnowledgeDocumentStatus, KnowledgeSourceType } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../backend/src/common/utils/is-record";
import { PrismaService } from "../backend/src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Knowledge documents e2e", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let httpServer: Server | undefined;

  beforeAll(async () => {
    await applyMigrations();
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates, lists, gets, rejects duplicates, and deletes knowledge documents", async () => {
    const server = getHttpServer(httpServer);
    const createResponse = await request(server)
      .post("/api/v1/knowledge/documents")
      .send({
        title: "  Caching Strategies  ",
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceUrl: null,
        content: `# Caching

Caching reduces repeated reads.

## Cache Aside

Read from cache first. Load from storage on misses.

## Invalidation

Expire keys or publish invalidation events.`
      })
      .expect(201);
    const createdDocument = getDataRecord(createResponse.body);
    const documentId = getString(createdDocument.id);
    const createdChunks = getArray(createdDocument.chunks);

    expect(createdDocument.title).toBe("Caching Strategies");
    expect(createdDocument.sourceType).toBe(KnowledgeSourceType.MARKDOWN);
    expect(createdDocument.status).toBe(KnowledgeDocumentStatus.COMPLETED);
    expect(createdChunks.length).toBeGreaterThan(1);
    expect(getRecord(createdChunks[0]).metadata).toMatchObject({
      headingPath: ["Caching"],
      sourceTitle: "Caching Strategies",
      sourceType: KnowledgeSourceType.MARKDOWN
    });

    const listResponse = await request(server).get("/api/v1/knowledge/documents").expect(200);
    const listedDocuments = getDataArray(listResponse.body);
    expect(listedDocuments).toHaveLength(1);
    expect(getRecord(listedDocuments[0]).id).toBe(documentId);

    const getResponse = await request(server)
      .get(`/api/v1/knowledge/documents/${documentId}`)
      .expect(200);
    expect(getDataRecord(getResponse.body).id).toBe(documentId);

    const embedResponse = await request(server)
      .post(`/api/v1/knowledge/documents/${documentId}/embed`)
      .expect(201);
    expect(getDataRecord(embedResponse.body)).toMatchObject({
      documentId,
      totalChunks: createdChunks.length,
      embeddedChunks: createdChunks.length,
      skippedChunks: 0,
      failedChunks: 0
    });

    const statusResponse = await request(server).get("/api/v1/knowledge/embeddings/status").expect(200);
    const embeddingStatus = getDataRecord(statusResponse.body);
    const chunkStatus = getRecord(embeddingStatus.chunks);
    expect(embeddingStatus.model).toBe("gemini-embedding-test");
    expect(embeddingStatus.modelVersion).toBe("test-version");
    expect(chunkStatus.total).toBe(createdChunks.length);
    expect(chunkStatus.embedded).toBe(createdChunks.length);
    expect(chunkStatus.failed).toBe(0);
    expect(chunkStatus.outdated).toBe(0);

    const rebuildResponse = await request(server)
      .post("/api/v1/knowledge/embeddings/rebuild")
      .expect(201);
    expect(getDataRecord(rebuildResponse.body)).toMatchObject({
      totalChunks: createdChunks.length,
      embeddedChunks: 0,
      skippedChunks: createdChunks.length,
      failedChunks: 0
    });

    const duplicateResponse = await request(server)
      .post("/api/v1/knowledge/documents")
      .send({
        title: "Duplicate Caching",
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceUrl: null,
        content: `# Caching


Caching reduces repeated reads.

## Cache Aside

Read from cache first. Load from storage on misses.

## Invalidation

Expire keys or publish invalidation events.`
      })
      .expect(409);
    expect(getErrorRecord(duplicateResponse.body).code).toBe("KNOWLEDGE_DOCUMENT_DUPLICATE");

    await request(server).delete(`/api/v1/knowledge/documents/${documentId}`).expect(200);

    await request(server).get(`/api/v1/knowledge/documents/${documentId}`).expect(404);
    await expect(prisma.knowledgeChunk.count({ where: { documentId } })).resolves.toBe(0);
  });
});

function getHttpServer(server: Server | undefined): Server {
  if (!server) {
    throw new Error("Expected HTTP server to be initialized");
  }

  return server;
}

function getDataRecord(body: unknown): Record<string, unknown> {
  const envelope = getRecord(body);
  return getRecord(envelope.data);
}

function getDataArray(body: unknown): unknown[] {
  const envelope = getRecord(body);
  return getArray(envelope.data);
}

function getErrorRecord(body: unknown): Record<string, unknown> {
  const envelope = getRecord(body);
  return getRecord(envelope.error);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected value to be an object");
  }

  return value;
}

function getArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected value to be an array");
  }

  return value;
}

function getString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected value to be a string");
  }

  return value;
}
