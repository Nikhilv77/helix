import "dotenv/config";
import {
  DesignSessionStatus,
  KnowledgeDocumentStatus,
  KnowledgeSourceType,
  PrismaClient,
  ProjectStatus
} from "@prisma/client";
import { createContentHash } from "../src/server/knowledge/utils/content-hash";
import { chunkKnowledgeDocument } from "../src/server/knowledge/utils/knowledge-chunker";
import { normalizeKnowledgeText } from "../src/server/knowledge/utils/text-normalizer";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const activeProject = await prisma.project.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {
      name: "Realtime Chat Platform",
      description: "Seed project for an active system design workspace.",
      status: ProjectStatus.ACTIVE,
      archivedAt: null
    },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Realtime Chat Platform",
      description: "Seed project for an active system design workspace.",
      status: ProjectStatus.ACTIVE
    }
  });

  await prisma.project.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {
      name: "Legacy URL Shortener",
      description: "Seed project representing an archived design workspace.",
      status: ProjectStatus.ARCHIVED,
      archivedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Legacy URL Shortener",
      description: "Seed project representing an archived design workspace.",
      status: ProjectStatus.ARCHIVED,
      archivedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  await prisma.designSession.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    update: {
      projectId: activeProject.id,
      title: "Initial chat design",
      problemStatement: "Design a realtime chat system for web and mobile clients.",
      status: DesignSessionStatus.DRAFT,
      currentStep: null,
      failureCode: null,
      failureMessage: null,
      startedAt: null,
      completedAt: null
    },
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      projectId: activeProject.id,
      title: "Initial chat design",
      problemStatement: "Design a realtime chat system for web and mobile clients.",
      status: DesignSessionStatus.DRAFT
    }
  });

  await prisma.designSession.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    update: {
      projectId: activeProject.id,
      title: "Failure recovery scenario",
      problemStatement: "Design recovery behavior for degraded realtime delivery.",
      status: DesignSessionStatus.FAILED,
      currentStep: "generation",
      failureCode: "SEED_FAILURE",
      failureMessage: "Seeded failure state for API testing.",
      startedAt: new Date("2026-01-02T00:00:00.000Z"),
      completedAt: null
    },
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      projectId: activeProject.id,
      title: "Failure recovery scenario",
      problemStatement: "Design recovery behavior for degraded realtime delivery.",
      status: DesignSessionStatus.FAILED,
      currentStep: "generation",
      failureCode: "SEED_FAILURE",
      failureMessage: "Seeded failure state for API testing.",
      startedAt: new Date("2026-01-02T00:00:00.000Z")
    }
  });

  await seedKnowledgeDocument({
    id: "55555555-5555-4555-8555-555555555555",
    title: "Caching Strategies",
    sourceType: KnowledgeSourceType.MARKDOWN,
    content: `# Caching Strategies

Caching reduces repeated work and protects downstream systems from avoidable reads.

## Cache Aside

Applications read from cache first and load from the database on misses. This pattern is simple and works well for read-heavy workloads.

## Invalidation

Use TTLs, explicit invalidation events, or versioned keys when freshness matters. Keep stale-data behavior visible in product requirements.`
  });

  await seedKnowledgeDocument({
    id: "66666666-6666-4666-8666-666666666666",
    title: "Database Selection",
    sourceType: KnowledgeSourceType.MARKDOWN,
    content: `# Database Selection

Database choice should follow access patterns, consistency requirements, and operational maturity.

## Relational Databases

Relational databases are a strong default for transactional systems, normalized data, and queries that need constraints.

## Document Databases

Document databases can fit flexible object-shaped records and high write throughput, but query and consistency trade-offs should be explicit.`
  });

  await seedKnowledgeDocument({
    id: "77777777-7777-4777-8777-777777777777",
    title: "Message Queues",
    sourceType: KnowledgeSourceType.PLAIN_TEXT,
    content: `Message queues decouple producers from consumers and smooth bursts of work.

They are useful for asynchronous jobs, fan-out workflows, retries, and isolating slow downstream services.

Designs should define delivery semantics, dead-letter handling, idempotency, and observability for consumer lag.`
  });
}

async function seedKnowledgeDocument(input: {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  content: string;
}): Promise<void> {
  const normalizedContent = normalizeKnowledgeText(input.content);
  const contentHash = createContentHash(normalizedContent);
  const chunks = chunkKnowledgeDocument({
    sourceTitle: input.title,
    sourceType: input.sourceType,
    content: normalizedContent,
    maxTokens: 120
  });

  const document = await prisma.knowledgeDocument.upsert({
    where: { id: input.id },
    update: {
      title: input.title,
      sourceType: input.sourceType,
      sourceUrl: null,
      contentHash,
      status: KnowledgeDocumentStatus.COMPLETED,
      errorMessage: null
    },
    create: {
      id: input.id,
      title: input.title,
      sourceType: input.sourceType,
      sourceUrl: null,
      contentHash,
      status: KnowledgeDocumentStatus.COMPLETED
    }
  });

  await prisma.knowledgeChunk.deleteMany({
    where: { documentId: document.id }
  });

  await prisma.knowledgeChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: document.id,
      content: chunk.content,
      contentHash: chunk.contentHash,
      chunkIndex: chunk.chunkIndex,
      tokenEstimate: chunk.tokenEstimate,
      metadata: chunk.metadata
    }))
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
