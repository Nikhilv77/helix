import "dotenv/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { execFileSync } from "child_process";
import { INestApplication } from "@nestjs/common";
import { Socket } from "net";
import { EmbeddingsProvider } from "../backend/src/ai/interfaces/embeddings-provider.interface";
import {
  GenerateStructuredRequest,
  SystemDesignerAIProvider
} from "../backend/src/ai/interfaces/system-designer-ai-provider.interface";
import { EMBEDDINGS_PROVIDER } from "../backend/src/ai/tokens/embeddings-provider.token";
import { SYSTEM_DESIGNER_AI_PROVIDER } from "../backend/src/ai/tokens/ai-provider.token";
import { AppModule } from "../backend/src/app.module";
import { PrismaService } from "../backend/src/database/prisma.service";

export const testDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/ai_system_design?schema=public";

export function configureTestEnvironment(): void {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.APP_NAME = "AI System Design Copilot";
  process.env.APP_VERSION = "0.1.0";
  process.env.CORS_ORIGINS = "http://localhost:3000";
  process.env.LOG_LEVEL = "info";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_FAST_MODEL = "gemini-fast-test";
  process.env.GEMINI_REASONING_MODEL = "gemini-reasoning-test";
  process.env.GEMINI_EMBEDDING_MODEL = "gemini-embedding-test";
  process.env.GEMINI_EMBEDDING_MODEL_VERSION = "test-version";
  process.env.AI_TIMEOUT_MS = "5000";
  process.env.AI_MAX_RETRIES = "1";
  process.env.KNOWLEDGE_CHUNK_MAX_TOKENS = "500";
  process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS = "4";
  process.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE = "2";
  process.env.RETRIEVAL_DEFAULT_TOP_K = "5";
  process.env.RETRIEVAL_MIN_SIMILARITY = "0.1";
}

export async function applyMigrations(): Promise<void> {
  await assertDatabasePortIsReachable(testDatabaseUrl);

  execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl
    },
    stdio: "pipe"
  });
}

function assertDatabasePortIsReachable(databaseUrl: string): Promise<void> {
  const parsedUrl = new URL(databaseUrl);
  const host = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 5432;

  if (!host || !Number.isInteger(port)) {
    throw new Error("PostgreSQL database URL is not usable for e2e tests");
  }

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const settle = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    socket.setTimeout(1000);
    socket.once("connect", () => settle());
    socket.once("timeout", () =>
      settle(
        new Error(
          "PostgreSQL is not reachable for e2e tests. Start it with pnpm docker:up before running pnpm test:e2e."
        )
      )
    );
    socket.once("error", () =>
      settle(
        new Error(
          "PostgreSQL is not reachable for e2e tests. Start it with pnpm docker:up before running pnpm test:e2e."
        )
      )
    );
    socket.connect(port, host);
  });
}

interface CreateE2eAppOptions {
  systemDesignerProvider?: SystemDesignerAIProvider;
  embeddingsProvider?: EmbeddingsProvider;
}

export async function createE2eApp(options: CreateE2eAppOptions = {}): Promise<INestApplication> {
  configureTestEnvironment();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(SYSTEM_DESIGNER_AI_PROVIDER)
    .useValue(options.systemDesignerProvider ?? createDeterministicSystemDesignerProvider())
    .overrideProvider(EMBEDDINGS_PROVIDER)
    .useValue(options.embeddingsProvider ?? createDeterministicEmbeddingsProvider())
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1"
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  await app.init();

  return app;
}

function createDeterministicEmbeddingsProvider(): EmbeddingsProvider {
  return {
    generateEmbeddings: (request) =>
      Promise.resolve({
      embeddings: request.texts.map((text, index) => createDeterministicEmbedding(text, index)),
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    })
  };
}

function createDeterministicSystemDesignerProvider(): SystemDesignerAIProvider {
  return {
    generateStructured: <T>(request: GenerateStructuredRequest<T>) =>
      Promise.resolve(
        request.schema.parse(
          request.operation === "system_design.generation"
            ? createDeterministicSystemDesign(request.prompt)
            : request.operation === "architecture_diagram.generation"
              ? createDeterministicArchitectureDiagram()
              : request.operation === "design_validation.review"
                ? createDeterministicDesignValidation()
                : createDeterministicRequirementAnalysis(request.prompt)
        )
      )
  };
}

function createDeterministicDesignValidation(): unknown {
  const categories = [
    "functionalRequirements",
    "scalability",
    "availability",
    "reliability",
    "dataConsistency",
    "security",
    "observability",
    "disasterRecovery",
    "costAwareness",
    "operationalComplexity"
  ];

  return {
    overallScore: 82,
    categoryScores: categories.map((category) => ({
      category,
      score: category === "disasterRecovery" || category === "costAwareness" ? 65 : 85,
      summary: `AI review summary for ${category}.`
    })),
    criticalIssues: [],
    warnings: [
      {
        category: "disasterRecovery",
        message: "Disaster recovery objectives are not concrete.",
        recommendation: "Define RPO, RTO, backup, and restore expectations."
      }
    ],
    missingAreas: [
      {
        category: "costAwareness",
        message: "Cost controls are not explicit.",
        recommendation: "Document expected cost drivers and optimization levers."
      }
    ],
    improvementSuggestions: [
      {
        category: "observability",
        message: "Add operational dashboards.",
        recommendation: "Track golden signals, queue lag, and provider failures."
      }
    ],
    strengths: [
      {
        category: "reliability",
        message: "The design addresses retries and asynchronous delivery.",
        recommendation: "Keep retry policies measurable."
      }
    ],
    unresolvedAssumptions: ["Provider rate limits are not specified."]
  };
}

function createDeterministicArchitectureDiagram(): unknown {
  return {
    mermaid: `flowchart TD
  Client[Client Apps] --> Api[Notification API]
  Api --> Cache[(Template Cache)]
  Api --> Db[(PostgreSQL)]
  Api --> Queue[Message Queue]
  Queue --> Worker[Worker Pool]
  Worker --> Provider[External Notification Provider]`
  };
}

function createDeterministicSystemDesign(prompt: string): unknown {
  const parsedPrompt = JSON.parse(prompt) as {
    retrievedSourceReferences?: unknown;
  };
  const retrievedSourceReferences = Array.isArray(parsedPrompt.retrievedSourceReferences)
    ? parsedPrompt.retrievedSourceReferences
    : [];

  return {
    architectureSummary:
      "Use a modular notification architecture with APIs, durable storage, cache-aside reads, and asynchronous workers.",
    majorComponents: [
      {
        name: "Notification API",
        responsibilities: ["Accept notification requests", "Validate recipients and templates"]
      },
      {
        name: "Worker Pool",
        responsibilities: ["Consume queued jobs", "Retry transient delivery failures"]
      }
    ],
    apiRecommendations: [
      {
        name: "Notification creation API",
        recommendation: "Expose a POST endpoint for scheduling notifications.",
        reasoning: "A command API cleanly separates producers from asynchronous delivery."
      }
    ],
    databaseChoices: [
      {
        name: "PostgreSQL",
        recommendation: "Use PostgreSQL for templates, recipient preferences, and delivery state.",
        reasoning: "Relational constraints fit user preferences and auditability."
      }
    ],
    cachingStrategy: [
      {
        name: "Cache aside",
        recommendation: "Cache notification templates and user preferences.",
        reasoning: "These reads are frequent and tolerate short TTLs."
      }
    ],
    messagingAndAsyncProcessing: [
      {
        name: "Message queue",
        recommendation: "Use a durable queue with dead-letter handling for delivery jobs.",
        reasoning: "Queues decouple producers from delivery workers and support retries."
      }
    ],
    storageStrategy: [
      {
        name: "Delivery log storage",
        recommendation: "Store compact delivery attempts and outcomes for retention windows.",
        reasoning: "Delivery history supports support workflows and observability."
      }
    ],
    scalabilityApproach: [
      {
        name: "Horizontal workers",
        description: "Scale consumers by queue depth and provider latency."
      }
    ],
    reliabilityAndFailureHandling: [
      {
        name: "Idempotent retries",
        description: "Use idempotency keys and dead-letter queues for failed delivery attempts."
      }
    ],
    security: [
      {
        name: "Tenant isolation",
        description: "Scope templates, preferences, and delivery history by tenant."
      }
    ],
    observability: [
      {
        name: "Queue and delivery metrics",
        description: "Track queue lag, retry counts, provider errors, and delivery latency."
      }
    ],
    deploymentApproach: [
      {
        name: "Separate API and workers",
        description: "Deploy stateless API services separately from autoscaled worker pools."
      }
    ],
    technologyChoices: [
      {
        category: "Messaging",
        choice: "Durable queue",
        reasoning: "A durable queue supports asynchronous retries and burst smoothing.",
        alternativesConsidered: ["Synchronous provider calls"]
      }
    ],
    assumptions: ["External notification providers can return transient failures."],
    tradeOffs: [
      {
        name: "Async delivery",
        description: "Asynchronous delivery improves reliability but adds eventual consistency."
      }
    ],
    risks: [
      {
        name: "Provider throttling",
        description: "Third-party provider limits can cause queue buildup."
      }
    ],
    retrievedSourceReferences
  };
}

function createDeterministicRequirementAnalysis(prompt: string): unknown {
  const hasClarificationAnswers = prompt.includes("Support 100 concurrent editors");

  if (hasClarificationAnswers) {
    return {
      productSummary: "A collaborative document editor for teams.",
      functionalRequirements: [
        {
          id: "FR-1",
          requirement: "Users can collaboratively edit shared documents.",
          priority: "MUST"
        },
        {
          id: "FR-2",
          requirement: "The system tracks document changes and resolves concurrent edits.",
          priority: "MUST"
        }
      ],
      nonFunctionalRequirements: [
        {
          id: "NFR-1",
          category: "Scalability",
          requirement: "Support collaborative editing sessions with bounded update latency.",
          target: "100 concurrent editors per document"
        }
      ],
      assumptions: ["Users are already authenticated before opening documents."],
      scaleInputs: {
        expectedUsers: "100 concurrent editors per document",
        requestRate: null,
        storage: null,
        regions: null,
        availabilityTarget: null,
        latencyTarget: null,
        notes: ["Concurrency target was provided through clarification answers."]
      },
      constraints: [],
      missingInformation: [],
      clarificationQuestions: []
    };
  }

  return {
    productSummary: "A collaborative document editor for teams.",
    functionalRequirements: [
      {
        id: "FR-1",
        requirement: "Users can collaboratively edit shared documents.",
        priority: "MUST"
      }
    ],
    nonFunctionalRequirements: [
      {
        id: "NFR-1",
        category: "Reliability",
        requirement: "The system should preserve edits during transient failures.",
        target: null
      }
    ],
    assumptions: ["Users are already authenticated before opening documents."],
    scaleInputs: {
      expectedUsers: null,
      requestRate: null,
      storage: null,
      regions: null,
      availabilityTarget: null,
      latencyTarget: null,
      notes: []
    },
    constraints: ["No offline editing requirement was specified."],
    missingInformation: ["Expected concurrent editors is unknown."],
    clarificationQuestions: [
      {
        id: "CQ-1",
        question: "How many concurrent editors should each document support?",
        reason: "Concurrency affects collaboration, storage, and fan-out design."
      }
    ]
  };
}

function createDeterministicEmbedding(text: string, index: number): number[] {
  const normalizedText = text.toLowerCase();

  if (/queue|message|retry|retries|notification|consumer|dead-letter/.test(normalizedText)) {
    return [1, 0.01 + index / 100, 0.01, 0.01];
  }

  if (/cache|caching|ttl|invalidation/.test(normalizedText)) {
    return [0.01, 1, 0.01 + index / 100, 0.01];
  }

  if (/database|sql|transaction|relational|document database/.test(normalizedText)) {
    return [0.01, 0.01, 1, 0.01 + index / 100];
  }

  return [0.25, 0.25, 0.25, 0.25];
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.knowledgeChunk.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.designSession.deleteMany();
  await prisma.project.deleteMany();
}
