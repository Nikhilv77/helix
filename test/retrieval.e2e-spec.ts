import { INestApplication } from "@nestjs/common";
import { KnowledgeSourceType } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../backend/src/common/utils/is-record";
import { PrismaService } from "../backend/src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Retrieval e2e", () => {
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

  it("ranks relevant retry and queue chunks above unrelated chunks", async () => {
    const server = getHttpServer(httpServer);

    await createKnowledgeDocument(server, {
      title: "Message Queue Reliability",
      sourceType: KnowledgeSourceType.MARKDOWN,
      content: `# Message Queues

Queues decouple notification producers from consumers.

## Retries

Failed notification deliveries should use retries, dead-letter queues, and idempotent consumers.`
    });
    await createKnowledgeDocument(server, {
      title: "Caching Strategies",
      sourceType: KnowledgeSourceType.MARKDOWN,
      content: `# Caching

Caches reduce database reads with TTLs and invalidation events.`
    });
    await createKnowledgeDocument(server, {
      title: "Database Choices",
      sourceType: KnowledgeSourceType.MARKDOWN,
      content: `# Databases

Relational databases support transactions and constraints for consistent writes.`
    });

    await request(server).post("/api/v1/knowledge/embeddings/rebuild").expect(201);

    const response = await request(server)
      .post("/api/v1/retrieval/search")
      .send({
        query: "How should a scalable notification system handle retries?",
        topK: 3,
        minSimilarity: 0
      })
      .expect(201);
    const data = getDataRecord(response.body);
    const results = getArray(data.results).map(getRecord);

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]?.documentTitle).toBe("Message Queue Reliability");
    expect(Number(results[0]?.similarity)).toBeGreaterThan(Number(results[1]?.similarity));
    expect(results.some((result) => result.documentTitle === "Caching Strategies")).toBe(true);
  });

  it("supports source type filtering", async () => {
    const server = getHttpServer(httpServer);

    await createKnowledgeDocument(server, {
      title: "Queue Text",
      sourceType: KnowledgeSourceType.PLAIN_TEXT,
      content: "Message queues retry notification delivery and isolate slow consumers."
    });
    await createKnowledgeDocument(server, {
      title: "Queue Markdown",
      sourceType: KnowledgeSourceType.MARKDOWN,
      content: "# Queues\n\nMessage queues retry failed notification jobs."
    });

    await request(server).post("/api/v1/knowledge/embeddings/rebuild").expect(201);

    const response = await request(server)
      .post("/api/v1/retrieval/search")
      .send({
        query: "notification retries",
        topK: 5,
        minSimilarity: 0,
        sourceType: KnowledgeSourceType.PLAIN_TEXT
      })
      .expect(201);
    const results = getArray(getDataRecord(response.body).results).map(getRecord);

    expect(results.length).toBe(1);
    expect(results[0]?.documentTitle).toBe("Queue Text");
    expect(results[0]?.sourceType).toBe(KnowledgeSourceType.PLAIN_TEXT);
  });
});

async function createKnowledgeDocument(
  server: Server,
  input: {
    title: string;
    sourceType: KnowledgeSourceType;
    content: string;
  }
): Promise<void> {
  await request(server)
    .post("/api/v1/knowledge/documents")
    .send({
      title: input.title,
      sourceType: input.sourceType,
      sourceUrl: null,
      content: input.content
    })
    .expect(201);
}

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
