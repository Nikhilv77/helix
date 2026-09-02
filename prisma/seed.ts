import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DesignSessionStatus,
  KnowledgeDocumentStatus,
  KnowledgeSourceType,
  PrepQuestionPublicationStatus,
  Prisma,
  PrismaClient,
  ProjectStatus,
  RoadmapQuestionSourceType,
  RoadmapTemplateStatus
} from "@prisma/client";
import {
  buildFrontendDsaPlan,
  PREP_SESSIONS,
  type PlanQuestion
} from "../src/lib/roadmap/frontend-plan";
import { assertPrepQuestionBankPublishable } from "../src/server/practice/questions/prep-bank-audit";

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

  await seedDsaQuestionBank();
  await seedPrepQuestionTemplates();
  assertPrepQuestionBankPublishable(await prisma.prepQuestionTemplate.findMany());
  await seedFrontendRoadmapTemplates();
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

interface KnowledgeSeedChunk {
  content: string;
  contentHash: string;
  chunkIndex: number;
  tokenEstimate: number;
  metadata: Prisma.InputJsonObject;
}

function normalizeKnowledgeText(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function createContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function chunkKnowledgeDocument(input: {
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  content: string;
  maxTokens: number;
}): KnowledgeSeedChunk[] {
  const paragraphs = input.content.split(/\n{2,}/).filter(Boolean);
  const chunks: KnowledgeSeedChunk[] = [];
  let buffer: string[] = [];
  let tokenEstimate = 0;

  function flush() {
    if (buffer.length === 0) return;
    const content = buffer.join("\n\n");
    chunks.push({
      content,
      contentHash: createContentHash(content),
      chunkIndex: chunks.length,
      tokenEstimate,
      metadata: {
        sourceTitle: input.sourceTitle,
        sourceType: input.sourceType
      }
    });
    buffer = [];
    tokenEstimate = 0;
  }

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    if (buffer.length > 0 && tokenEstimate + paragraphTokens > input.maxTokens) {
      flush();
    }
    buffer.push(paragraph);
    tokenEstimate += paragraphTokens;
  }

  flush();
  return chunks;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length * 1.35));
}

interface DsaQuestionSeed {
  title: string;
  slug: string;
  contentVersion?: number;
  source: string;
  externalUrl: string;
  primaryPattern: string;
  subPatterns: string[];
  difficulty: string;
  expectedTimeMinutes: number;
  recommendedOrder: number;
  prerequisites: string[];
  conceptsTested: string[];
  commonMistakes: string[];
  interviewSignals: string[];
  followUpPrompts: string[];
  promptSummary: string;
  highLevelApproach: string;
  complexity: Prisma.InputJsonValue;
  problemStatement?: string;
  constraints?: string[];
  examples?: Prisma.InputJsonValue;
  keyInsight?: string;
  hints?: string[];
  approaches?: Prisma.InputJsonValue;
  edgeCases?: string[];
  relatedQuestions?: string[];
}

interface DsaPhaseSeed {
  phase: string;
  questions: DsaQuestionSeed[];
}

interface PrepSourceLinkSeed {
  id: string;
  title: string;
  url: string;
  notes: string;
}

interface PrepQuestionTemplateSeed {
  id: string;
  contentVersion?: number;
  sessionKey?: string;
  chapterKey?: string;
  category: string;
  title: string;
  roles: string[];
  levels: string[];
  languages?: string[];
  difficulty: string;
  expectedMinutes: number;
  evidenceType: string;
  competency: string;
  format?: "mcq" | "typed" | "spoken" | "diagram" | "predict-run" | "find-the-flaw" | "diagnose";
  prompt: string;
  promptTemplate?: string;
  objective?: string;
  prerequisites?: string[];
  hints?: string[];
  explanation?: string;
  answerKey?: Prisma.InputJsonValue | null;
  tags: string[];
  whatItTests: string[];
  goodAnswerSignals: string[];
  weakAnswerSignals: string[];
  followUpPrompts: string[];
  mayaPushbacks: string[];
  answerStructure: Prisma.InputJsonValue;
  scoringRubric: Prisma.InputJsonValue;
  sourceLinkIds: string[];
}

interface PrepQuestionBankSeed {
  bank: string;
  sourceLinks: PrepSourceLinkSeed[];
  templates: PrepQuestionTemplateSeed[];
}

async function seedDsaQuestionBank(): Promise<void> {
  const dsaDir = join(process.cwd(), "src/data/dsa");
  const phases = readdirSync(dsaDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dsaDir, file), "utf8")) as DsaPhaseSeed);

  const phaseSlugs = phases.map((phase) => dsaPhaseSlug(phase.phase));
  const questionSlugs = phases.flatMap((phase) => phase.questions.map((question) => question.slug));

  // DSA slugs are durable route and history identities. Content seeding is
  // additive: a question or phase missing from today's source files is kept in
  // the database instead of cascading into notes, progress, or attempts.
  const [preservedQuestions, preservedPhases] = await Promise.all([
    prisma.dsaQuestion.count({ where: { slug: { notIn: questionSlugs } } }),
    prisma.dsaPhase.count({ where: { slug: { notIn: phaseSlugs } } })
  ]);
  if (preservedQuestions || preservedPhases) {
    console.warn(
      `Preserving ${preservedQuestions} DSA questions and ${preservedPhases} phases not present in the current seed source.`
    );
  }

  for (const phase of phases) {
    const phaseSlug = dsaPhaseSlug(phase.phase);
    const phaseNumber = dsaPhaseNumber(phase.phase);
    const sourceQuestionSlugs = new Set(phase.questions.map((question) => question.slug));

    await prisma.dsaPhase.upsert({
      where: { slug: phaseSlug },
      update: {
        title: phase.phase,
        phaseNumber,
        questionCount: phase.questions.length
      },
      create: {
        slug: phaseSlug,
        title: phase.phase,
        phaseNumber,
        questionCount: phase.questions.length
      }
    });

    await prisma.$transaction(
      async (transaction) => {
        const existingQuestions = await transaction.dsaQuestion.findMany({
          where: { phaseSlug },
          select: { slug: true, recommendedOrder: true },
          orderBy: [{ recommendedOrder: "asc" }, { slug: "asc" }]
        });
        const sourceMaxOrder = phase.questions.reduce(
          (maximum, question) => Math.max(maximum, question.recommendedOrder),
          0
        );

        // Park every current order above both the existing and incoming ranges.
        // This makes replacements and arbitrary reorders safe with the unique
        // (phaseSlug, recommendedOrder) constraint.
        if (existingQuestions.length > 0) {
          const existingOrders = existingQuestions.map((question) => question.recommendedOrder);
          const existingMinOrder = Math.min(...existingOrders);
          const occupiedMaxOrder = Math.max(sourceMaxOrder, ...existingOrders);
          const temporaryOrderOffset = occupiedMaxOrder - existingMinOrder + 1;

          await transaction.dsaQuestion.updateMany({
            where: { phaseSlug },
            data: { recommendedOrder: { increment: temporaryOrderOffset } }
          });
        }

        for (const question of phase.questions) {
          const data = dsaQuestionData(phaseSlug, question);
          await transaction.dsaQuestion.upsert({
            where: { slug: question.slug },
            update: {
              ...data,
              ...(question.contentVersion === undefined
                ? {}
                : { contentVersion: question.contentVersion })
            },
            create: {
              slug: question.slug,
              contentVersion: question.contentVersion ?? 1,
              ...data
            }
          });
        }

        const preservedQuestions = existingQuestions.filter(
          (question) => !sourceQuestionSlugs.has(question.slug)
        );
        for (const [index, question] of preservedQuestions.entries()) {
          await transaction.dsaQuestion.update({
            where: { slug: question.slug },
            data: { recommendedOrder: sourceMaxOrder + index + 1 }
          });
        }
      },
      { timeout: 120_000 }
    );
  }

  console.log(`Seeded ${questionSlugs.length} DSA questions across ${phaseSlugs.length} phases.`);
}

async function seedPrepQuestionTemplates(): Promise<void> {
  const prepDir = join(process.cwd(), "src/data/prep");
  const banks = readdirSync(prepDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(prepDir, file), "utf8")) as PrepQuestionBankSeed);
  banks.push(fundamentalsPrepBank());

  let totalTemplates = 0;

  for (const bank of banks) {
    const sourceLinks = new Map(bank.sourceLinks.map((source) => [source.id, source]));
    const templateIds = bank.templates.map((template) => template.id);

    const preservedTemplates = await prisma.prepQuestionTemplate.count({
      where: { bank: bank.bank, id: { notIn: templateIds } }
    });
    if (preservedTemplates > 0) {
      console.warn(
        `Preserving ${preservedTemplates} prep templates from ${bank.bank} that are absent from the current seed source.`
      );
    }

    for (const template of bank.templates) {
      const resolvedSourceLinks = template.sourceLinkIds
        .map((sourceId) => sourceLinks.get(sourceId))
        .filter((source): source is PrepSourceLinkSeed => source !== undefined);

      await prisma.prepQuestionTemplate.upsert({
        where: { id: template.id },
        update: prepTemplateData(bank.bank, template, resolvedSourceLinks),
        create: {
          id: template.id,
          ...prepTemplateData(bank.bank, template, resolvedSourceLinks)
        }
      });
    }

    totalTemplates += templateIds.length;
    console.log(`Seeded ${templateIds.length} prep question templates from ${bank.bank}.`);
  }

  console.log(`Seeded ${totalTemplates} prep question templates across ${banks.length} banks.`);
}

async function seedFrontendRoadmapTemplates(): Promise<void> {
  const frontendTemplate = await prisma.roadmapTemplate.upsert({
    where: { slug: "frontend-roadmap" },
    update: {
      role: "fullstack",
      title: "Full-stack Interview Roadmap",
      description:
        "A six-session full-stack interview preparation path personalized per user after onboarding.",
      version: 2,
      status: RoadmapTemplateStatus.ACTIVE,
      metadata: {
        source: "src/lib/roadmap/frontend-plan.ts",
        personalizationInputs: ["targetRole", "level", "resume", "progress", "attempts"]
      }
    },
    create: {
      role: "fullstack",
      slug: "frontend-roadmap",
      title: "Full-stack Interview Roadmap",
      description:
        "A six-session full-stack interview preparation path personalized per user after onboarding.",
      version: 2,
      status: RoadmapTemplateStatus.ACTIVE,
      metadata: {
        source: "src/lib/roadmap/frontend-plan.ts",
        personalizationInputs: ["targetRole", "level", "resume", "progress", "attempts"]
      }
    }
  });

  const sessionSlugs = PREP_SESSIONS.map((session) => session.id);

  // Sessions are unique on (templateId, order) as well as (templateId, slug).
  // Removing dropped sessions first, then parking the survivors outside the
  // real range, keeps a rename or a reorder from colliding with the row it is
  // about to replace.
  await prisma.roadmapSessionTemplate.deleteMany({
    where: { templateId: frontendTemplate.id, slug: { notIn: sessionSlugs } }
  });
  await prisma.$executeRaw`
    UPDATE "RoadmapSessionTemplate"
    SET "order" = -"order"
    WHERE "templateId" = ${frontendTemplate.id}::uuid AND "order" > 0
  `;

  const sessionTemplateIds: string[] = [];
  for (const session of PREP_SESSIONS) {
    const stored = await prisma.roadmapSessionTemplate.upsert({
      where: {
        templateId_slug: {
          templateId: frontendTemplate.id,
          slug: session.id
        }
      },
      update: {
        order: session.order,
        title: session.title,
        purpose: session.purpose,
        covers: session.covers,
        metadata: { status: session.status }
      },
      create: {
        templateId: frontendTemplate.id,
        slug: session.id,
        order: session.order,
        title: session.title,
        purpose: session.purpose,
        covers: session.covers,
        metadata: { status: session.status }
      }
    });
    sessionTemplateIds.push(stored.id);
  }

  // Anything still parked was neither upserted nor dropped above.
  await prisma.roadmapSessionTemplate.deleteMany({
    where: { templateId: frontendTemplate.id, id: { notIn: sessionTemplateIds } }
  });

  const frontendDsaSession = await prisma.roadmapSessionTemplate.findUniqueOrThrow({
    where: {
      templateId_slug: {
        templateId: frontendTemplate.id,
        slug: "dsa"
      }
    }
  });

  const dsaRows = await prisma.dsaQuestion.findMany({
    select: {
      slug: true,
      title: true,
      difficulty: true,
      primaryPattern: true,
      expectedTimeMinutes: true,
      phaseSlug: true,
      recommendedOrder: true,
      phase: { select: { phaseNumber: true } }
    },
    orderBy: [{ phase: { phaseNumber: "asc" } }, { recommendedOrder: "asc" }]
  });

  const plan = buildFrontendDsaPlan(
    dsaRows.map((row): PlanQuestion => ({
      slug: row.slug,
      title: row.title,
      difficulty:
        row.difficulty === "easy" || row.difficulty === "hard" ? row.difficulty : "medium",
      primaryPattern: row.primaryPattern,
      expectedTimeMinutes: row.expectedTimeMinutes,
      phaseSlug: row.phaseSlug,
      phaseNumber: row.phase.phaseNumber,
      recommendedOrder: row.recommendedOrder
    }))
  );

  const chapterTemplateIds: string[] = [];
  for (const [chapterIndex, chapter] of plan.chapters.entries()) {
    const stored = await prisma.roadmapChapterTemplate.upsert({
      where: {
        sessionTemplateId_slug: {
          sessionTemplateId: frontendDsaSession.id,
          slug: chapter.id
        }
      },
      update: {
        order: chapterIndex + 1,
        title: chapter.title,
        purpose: chapter.whyItMatters,
        metadata: {
          counts: chapter.counts,
          minutes: chapter.minutes
        }
      },
      create: {
        sessionTemplateId: frontendDsaSession.id,
        slug: chapter.id,
        order: chapterIndex + 1,
        title: chapter.title,
        purpose: chapter.whyItMatters,
        metadata: {
          counts: chapter.counts,
          minutes: chapter.minutes
        }
      }
    });
    chapterTemplateIds.push(stored.id);
  }

  await prisma.roadmapChapterTemplate.deleteMany({
    where: {
      sessionTemplateId: frontendDsaSession.id,
      id: { notIn: chapterTemplateIds }
    }
  });

  const chaptersBySlug = new Map(
    (
      await prisma.roadmapChapterTemplate.findMany({
        where: { sessionTemplateId: frontendDsaSession.id },
        select: { id: true, slug: true }
      })
    ).map((chapter) => [chapter.slug, chapter.id])
  );

  const questionOrders: number[] = [];
  let questionOrder = 1;
  for (const chapter of plan.chapters) {
    const chapterTemplateId = chaptersBySlug.get(chapter.id);

    for (const question of chapter.questions) {
      questionOrders.push(questionOrder);
      await prisma.roadmapQuestionTemplate.upsert({
        where: {
          sessionTemplateId_order: {
            sessionTemplateId: frontendDsaSession.id,
            order: questionOrder
          }
        },
        update: {
          chapterTemplateId: chapterTemplateId ?? null,
          sourceType: RoadmapQuestionSourceType.DSA,
          dsaQuestionSlug: question.slug,
          prepQuestionTemplateId: null,
          titleSnapshot: question.title,
          difficulty: question.difficulty,
          expectedMinutes: question.expectedTimeMinutes,
          metadata: {
            chapterSlug: chapter.id,
            phaseSlug: question.phaseSlug,
            primaryPattern: question.primaryPattern,
            phaseNumber: question.phaseNumber,
            recommendedOrder: question.recommendedOrder
          }
        },
        create: {
          sessionTemplateId: frontendDsaSession.id,
          chapterTemplateId: chapterTemplateId ?? null,
          order: questionOrder,
          sourceType: RoadmapQuestionSourceType.DSA,
          dsaQuestionSlug: question.slug,
          prepQuestionTemplateId: null,
          titleSnapshot: question.title,
          difficulty: question.difficulty,
          expectedMinutes: question.expectedTimeMinutes,
          metadata: {
            chapterSlug: chapter.id,
            phaseSlug: question.phaseSlug,
            primaryPattern: question.primaryPattern,
            phaseNumber: question.phaseNumber,
            recommendedOrder: question.recommendedOrder
          }
        }
      });
      questionOrder += 1;
    }
  }

  await prisma.roadmapQuestionTemplate.deleteMany({
    where: {
      sessionTemplateId: frontendDsaSession.id,
      order: { notIn: questionOrders }
    }
  });

  await seedFrontendPrepRoadmapTemplates(frontendTemplate.id);

  console.log(
    `Seeded full-stack roadmap template with ${PREP_SESSIONS.length} sessions, ${plan.chapters.length} DSA chapters, and ${plan.totalQuestions} DSA question mappings plus published prep placements.`
  );
}

const PREP_CHAPTER_TITLES: Record<string, { title: string; purpose: string }> = {
  // One chapter per language. Placement round-robins across chapters, so a
  // language spanning more chapters would quietly take a bigger share of the
  // session than the others.
  "python-runtime": {
    title: "Python Runtime & Data Model",
    purpose: "Predict what Python actually does with objects, scope, and defaults."
  },
  "java-runtime": {
    title: "Java Runtime & Type Semantics",
    purpose: "Predict boxing, dispatch, initialization order, and integer behaviour."
  },
  "cpp-runtime": {
    title: "C++ Runtime & Value Semantics",
    purpose: "Predict copies, lifetimes, conversions, and virtual dispatch."
  },
  "javascript-runtime": {
    title: "JavaScript Runtime & Type Safety",
    purpose: "Reason about the language mechanisms behind production UI behavior."
  },
  "react-engineering": {
    title: "React Engineering",
    purpose: "Model rendering, state, effects, forms, and component boundaries accurately."
  },
  "testing-and-reliability": {
    title: "Testing & Reliability",
    purpose: "Prove user-visible behavior across success, failure, and recovery."
  },
  networking: {
    title: "Networking",
    purpose: "Understand the protocols, caching, and failure paths underneath a web request."
  },
  "browser-os": {
    title: "Browser & OS",
    purpose: "Connect browser behavior to processes, threads, memory, and scheduling."
  },
  databases: {
    title: "Databases",
    purpose: "Reason about indexes, transactions, consistency, and query cost."
  },
  systems: {
    title: "Systems Basics",
    purpose: "Use latency, queues, capacity, and failure models in practical diagnosis."
  },
  "frontend-systems": {
    title: "Frontend Systems",
    purpose: "Choose rendering, data, caching, and performance boundaries at product scale."
  },
  "data-and-consistency": {
    title: "Data & Consistency",
    purpose: "Keep cached, optimistic, retried, and concurrent client state correct."
  },
  "design-system-scale": {
    title: "Design Systems at Scale",
    purpose: "Evolve shared UI contracts safely across many consumers."
  },
  "performance-and-resilience": {
    title: "Performance & Resilience",
    purpose: "Design responsive interfaces that recover from load, failure, and disconnection."
  },
  "ui-quality": {
    title: "UI Quality",
    purpose: "Make accessibility, responsive behavior, and browser correctness architectural."
  },
  "behavioral-stories": {
    title: "Behavioral Stories",
    purpose: "Build concise, evidence-backed stories about ownership, impact, conflict, and growth."
  },
  "resume-claims": {
    title: "Resume Claim Defense",
    purpose: "Defend project decisions, personal contribution, metrics, and technical depth."
  }
};

async function seedFrontendPrepRoadmapTemplates(templateId: string): Promise<void> {
  const sessions = await prisma.roadmapSessionTemplate.findMany({
    where: { templateId },
    select: { id: true, slug: true }
  });
  // Template slug and Practice session key are the same string since the
  // sessions were renamed; this list is just which sessions get prep chapters.
  const prepSessionKeys = [
    "core-technical",
    "applied-engineering",
    "architecture-system-design",
    "resume-behavioral-defense"
  ];
  const sessionBySlug = new Map(sessions.map((session) => [session.slug, session]));

  for (const practiceSessionKey of prepSessionKeys) {
    const sessionSlug = practiceSessionKey;
    const session = sessionBySlug.get(sessionSlug);
    if (!session) throw new Error(`Missing roadmap session template: ${sessionSlug}`);
    const questions = await prisma.prepQuestionTemplate.findMany({
      where: {
        sessionKey: practiceSessionKey,
        publicationStatus: PrepQuestionPublicationStatus.PUBLISHED
      },
      orderBy: [{ chapterKey: "asc" }, { difficulty: "asc" }, { id: "asc" }]
    });
    const chapterKeys = [...new Set(questions.map((question) => question.chapterKey))];
    const chapterIds = new Map<string, string>();
    await prisma.roadmapChapterTemplate.deleteMany({
      where: { sessionTemplateId: session.id, slug: { notIn: chapterKeys } }
    });
    await prisma.$executeRaw`
      UPDATE "RoadmapChapterTemplate"
      SET "order" = -"order"
      WHERE "sessionTemplateId" = ${session.id}::uuid AND "order" > 0
    `;
    for (const [index, chapterKey] of chapterKeys.entries()) {
      const copy = PREP_CHAPTER_TITLES[chapterKey] ?? {
        title: chapterKey,
        purpose: "Practice the canonical questions in this topic."
      };
      const chapter = await prisma.roadmapChapterTemplate.upsert({
        where: {
          sessionTemplateId_slug: { sessionTemplateId: session.id, slug: chapterKey }
        },
        update: { order: index + 1, title: copy.title, purpose: copy.purpose },
        create: {
          sessionTemplateId: session.id,
          slug: chapterKey,
          order: index + 1,
          title: copy.title,
          purpose: copy.purpose,
          metadata: { source: "published-prep-bank", practiceSessionKey }
        }
      });
      chapterIds.set(chapterKey, chapter.id);
    }
    await prisma.roadmapChapterTemplate.deleteMany({
      where: { sessionTemplateId: session.id, slug: { notIn: chapterKeys } }
    });

    await prisma.$executeRaw`
      UPDATE "RoadmapQuestionTemplate"
      SET "order" = -"order"
      WHERE "sessionTemplateId" = ${session.id}::uuid AND "order" > 0
    `;
    const keptQuestionIds: string[] = [];
    for (const [index, question] of questions.entries()) {
      const placement = await prisma.roadmapQuestionTemplate.upsert({
        where: {
          sessionTemplateId_prepQuestionTemplateId: {
            sessionTemplateId: session.id,
            prepQuestionTemplateId: question.id
          }
        },
        update: {
          chapterTemplateId: chapterIds.get(question.chapterKey) ?? null,
          order: index + 1,
          sourceType: RoadmapQuestionSourceType.PREP,
          dsaQuestionSlug: null,
          titleSnapshot: question.title,
          difficulty: question.difficulty,
          expectedMinutes: question.expectedMinutes,
          metadata: {
            practiceSessionKey,
            chapterKey: question.chapterKey,
            selectionReason: "published-role-bank",
            contentVersion: question.contentVersion
          }
        },
        create: {
          sessionTemplateId: session.id,
          chapterTemplateId: chapterIds.get(question.chapterKey) ?? null,
          order: index + 1,
          sourceType: RoadmapQuestionSourceType.PREP,
          dsaQuestionSlug: null,
          prepQuestionTemplateId: question.id,
          titleSnapshot: question.title,
          difficulty: question.difficulty,
          expectedMinutes: question.expectedMinutes,
          metadata: {
            practiceSessionKey,
            chapterKey: question.chapterKey,
            selectionReason: "published-role-bank",
            contentVersion: question.contentVersion
          }
        }
      });
      keptQuestionIds.push(placement.id);
    }
    await prisma.roadmapQuestionTemplate.deleteMany({
      where: { sessionTemplateId: session.id, id: { notIn: keptQuestionIds } }
    });
  }

  const finalSession = sessionBySlug.get("final-mock");
  if (finalSession) {
    await prisma.roadmapQuestionTemplate.deleteMany({
      where: { sessionTemplateId: finalSession.id }
    });
    await prisma.roadmapChapterTemplate.deleteMany({
      where: { sessionTemplateId: finalSession.id, slug: { not: "mixed-review" } }
    });
    await prisma.roadmapChapterTemplate.upsert({
      where: {
        sessionTemplateId_slug: {
          sessionTemplateId: finalSession.id,
          slug: "mixed-review"
        }
      },
      update: {
        order: 1,
        title: "Mixed Review",
        purpose: "Revisit canonical progress from the earlier Practice sessions."
      },
      create: {
        sessionTemplateId: finalSession.id,
        slug: "mixed-review",
        order: 1,
        title: "Mixed Review",
        purpose: "Revisit canonical progress from the earlier Practice sessions.",
        metadata: { composition: "reuse-earlier-canonical-progress" }
      }
    });
  }
}

function prepTemplateData(
  bank: string,
  template: PrepQuestionTemplateSeed,
  sourceLinks: PrepSourceLinkSeed[]
) {
  const sessionKey = template.sessionKey ?? prepSessionKey(bank, template.competency);
  const chapterKey = template.chapterKey ?? prepChapterKey(sessionKey, template);
  const answerSteps = answerStructureSteps(template.answerStructure);
  const objective =
    template.objective ??
    `Demonstrate ${template.whatItTests.join(", ")} through a concrete answer.`;
  const hints = template.hints?.length
    ? template.hints
    : answerSteps.map((step) => `Start with this part: ${step}`).slice(0, 3);
  const explanation =
    template.explanation ??
    `A strong answer follows ${answerStructureFramework(template.answerStructure)} and covers ${template.whatItTests.join(", ")}.`;
  const publicationErrors = validatePrepPublication({
    ...template,
    sessionKey,
    chapterKey,
    objective,
    hints,
    explanation
  });

  return {
    contentVersion: template.contentVersion ?? 1,
    bank,
    sessionKey,
    chapterKey,
    category: template.category,
    title: template.title,
    roles: template.roles,
    levels: template.levels,
    languages: templateLanguages(template),
    difficulty: template.difficulty,
    expectedMinutes: template.expectedMinutes,
    evidenceType: template.evidenceType,
    competency: template.competency,
    format: template.format ?? (sessionKey === "resume-behavioral-defense" ? "spoken" : "typed"),
    prompt: template.prompt,
    promptTemplate: template.promptTemplate ?? null,
    objective,
    prerequisites: template.prerequisites ?? [],
    hints,
    explanation,
    answerKey: template.answerKey ?? Prisma.JsonNull,
    publicationStatus:
      publicationErrors.length === 0
        ? PrepQuestionPublicationStatus.PUBLISHED
        : PrepQuestionPublicationStatus.DRAFT,
    tags: template.tags,
    whatItTests: template.whatItTests,
    goodAnswerSignals: template.goodAnswerSignals,
    weakAnswerSignals: template.weakAnswerSignals,
    followUpPrompts: template.followUpPrompts,
    mayaPushbacks: template.mayaPushbacks,
    answerStructure: template.answerStructure,
    scoringRubric: template.scoringRubric,
    sourceLinks: JSON.parse(JSON.stringify(sourceLinks)) as Prisma.InputJsonValue
  };
}

/**
 * A question is language-bound when its answer depends on one language's
 * semantics. `predict-run` always is — the whole exercise is predicting what a
 * specific runtime prints. Everything else is agnostic unless the author says
 * otherwise, because a JavaScript snippet demonstrating an N+1 query still
 * teaches a Go candidate.
 */
function templateLanguages(template: PrepQuestionTemplateSeed): string[] {
  if (template.languages?.length) return template.languages;
  if (template.format !== "predict-run") return [];
  const key = template.answerKey as { language?: unknown } | null | undefined;
  return typeof key?.language === "string" ? [key.language] : [];
}

function prepSessionKey(bank: string, competency: string): string {
  // Retired from Practice. These 42 MCQs are recognition-only, and
  // applied-engineering now has 40 artifact-based questions that do not need
  // them to clear its floor. They stay published for the placement quiz.
  if (bank === "placement-fundamentals") return "placement";
  if (bank === "behavioral-resume-deep-dive" || competency === "frontend-depth") {
    return "resume-behavioral-defense";
  }
  if (
    ["frontend-system-design", "performance", "accessibility-browser", "css-layout"].includes(
      competency
    )
  ) {
    return "architecture-system-design";
  }
  return "core-technical";
}

function prepChapterKey(
  sessionKey: string,
  template: Pick<PrepQuestionTemplateSeed, "category" | "competency">
): string {
  if (sessionKey === "applied-engineering" || sessionKey === "placement") {
    return template.category;
  }
  if (sessionKey === "resume-behavioral-defense") {
    return template.category === "resume-deep-dive" ? "resume-claims" : "behavioral-stories";
  }
  if (template.competency.startsWith("javascript-")) return "javascript-runtime";
  if (["react-core", "component-design", "forms"].includes(template.competency)) {
    return "react-engineering";
  }
  if (template.competency === "frontend-testing") return "testing-and-reliability";
  if (["frontend-system-design", "performance"].includes(template.competency)) {
    return "frontend-systems";
  }
  return "ui-quality";
}

function answerStructureSteps(value: Prisma.InputJsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const steps = (value as Record<string, unknown>).steps;
  return Array.isArray(steps)
    ? steps.filter((step): step is string => typeof step === "string")
    : [];
}

function answerStructureFramework(value: Prisma.InputJsonValue): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "the authored structure";
  const framework = (value as Record<string, unknown>).framework;
  return typeof framework === "string" ? framework : "the authored structure";
}

function validatePrepPublication(
  template: PrepQuestionTemplateSeed & {
    sessionKey: string;
    chapterKey: string;
    objective: string;
    hints: string[];
    explanation: string;
  }
): string[] {
  const errors: string[] = [];
  if (!template.sessionKey || !template.chapterKey) errors.push("classification");
  if (template.prompt.trim().length < (template.format === "mcq" ? 20 : 30)) {
    errors.push("prompt");
  }
  if (template.objective.trim().length < 20) errors.push("objective");
  if (template.hints.length < 2 || template.hints.some((hint) => hint.trim().length < 12)) {
    errors.push("hints");
  }
  if (template.explanation.trim().length < 40) errors.push("explanation");
  if (template.goodAnswerSignals.length < 2) errors.push("good-signals");
  if (template.weakAnswerSignals.length < 2) errors.push("weak-signals");
  if (template.format === "mcq") {
    const answerKey = template.answerKey;
    const valid =
      answerKey !== null &&
      typeof answerKey === "object" &&
      !Array.isArray(answerKey) &&
      typeof (answerKey as Record<string, unknown>).correctOptionIndex === "number";
    if (!valid) errors.push("answer-key");
  }
  return errors;
}

function fundamentalsPrepBank(): PrepQuestionBankSeed {
  const fundamentalsDir = join(process.cwd(), "src/data/fundamentals");
  const files = readdirSync(fundamentalsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map(
      (file) =>
        JSON.parse(readFileSync(join(fundamentalsDir, file), "utf8")) as {
          area: string;
          title: string;
          questions: Array<{
            slug: string;
            contentVersion?: number;
            format: "mcq" | "explain" | "scenario";
            levels: string[];
            prompt: string;
            options?: string[];
            answerIndex?: number;
            explanation: string;
            expects?: string[];
            probeIfMissing?: string;
            concept: { title: string; summary: string; points: string[] };
          }>;
        }
    );

  return {
    bank: "placement-fundamentals",
    sourceLinks: [],
    templates: files.flatMap((area) =>
      area.questions.map((question): PrepQuestionTemplateSeed => {
        const isMcq = question.format === "mcq";
        const strongSignals = question.expects?.length
          ? question.expects
          : question.concept.points.slice(0, 3);
        return {
          id: `fundamentals-${question.slug}`,
          contentVersion: question.contentVersion ?? 1,
          sessionKey: "placement",
          chapterKey: area.area,
          category: area.area,
          title: question.concept.title,
          roles: ["backend", "frontend", "fullstack", "data", "ai-ml"],
          levels: question.levels,
          difficulty: isMcq ? "easy" : question.format === "scenario" ? "hard" : "medium",
          expectedMinutes: isMcq ? 4 : question.format === "scenario" ? 10 : 7,
          evidenceType: question.format === "scenario" ? "diagnosis" : "fundamental",
          competency: area.area,
          format: isMcq ? "mcq" : "typed",
          prompt: question.prompt,
          objective: `Explain ${question.concept.title.toLowerCase()} accurately and connect it to engineering behavior.`,
          prerequisites: [],
          tags: ["fundamentals", area.area, question.format],
          whatItTests: [question.concept.title, ...question.concept.points.slice(0, 2)],
          goodAnswerSignals: strongSignals,
          weakAnswerSignals: [
            "Names a term or option without explaining the mechanism",
            "Misses the operational consequence or trade-off"
          ],
          followUpPrompts: question.probeIfMissing ? [question.probeIfMissing] : [],
          mayaPushbacks: question.probeIfMissing ? [question.probeIfMissing] : [],
          hints: question.concept.points.slice(0, 3),
          explanation: `${question.explanation} ${question.concept.summary}`,
          answerKey: isMcq
            ? {
                kind: "mcq",
                correctOptionIndex: question.answerIndex ?? 0,
                options: question.options ?? []
              }
            : null,
          answerStructure: {
            framework: "Mechanism → consequence → example",
            steps: [
              "Name the mechanism",
              "Explain the consequence",
              "Give a concrete engineering example"
            ]
          },
          scoringRubric: {
            strong: "Mechanism, consequence, and example are technically correct.",
            developing: "Core idea is present but one link is missing.",
            weak: "Term recognition without a correct mechanism."
          },
          sourceLinkIds: []
        };
      })
    )
  };
}

function dsaQuestionData(phaseSlug: string, question: DsaQuestionSeed) {
  return {
    phaseSlug,
    title: question.title,
    source: question.source,
    externalUrl: question.externalUrl,
    primaryPattern: question.primaryPattern,
    subPatterns: question.subPatterns,
    difficulty: question.difficulty,
    expectedTimeMinutes: question.expectedTimeMinutes,
    recommendedOrder: question.recommendedOrder,
    prerequisites: question.prerequisites,
    conceptsTested: question.conceptsTested,
    commonMistakes: question.commonMistakes,
    interviewSignals: question.interviewSignals,
    followUpPrompts: question.followUpPrompts,
    promptSummary: question.promptSummary,
    highLevelApproach: question.highLevelApproach,
    complexity: question.complexity,
    problemStatement: question.problemStatement ?? null,
    constraints: question.constraints ?? [],
    examples: question.examples ?? Prisma.JsonNull,
    keyInsight: question.keyInsight ?? null,
    hints: question.hints ?? [],
    approaches: question.approaches ?? Prisma.JsonNull,
    edgeCases: question.edgeCases ?? [],
    relatedQuestions: question.relatedQuestions ?? []
  };
}

function dsaPhaseSlug(phase: string): string {
  return phase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dsaPhaseNumber(phase: string): number {
  const [, rawNumber] = /^Phase\s+(\d+)/.exec(phase) ?? [];
  return rawNumber ? Number(rawNumber) : 0;
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
