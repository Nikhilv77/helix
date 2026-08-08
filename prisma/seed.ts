import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DesignSessionStatus,
  KnowledgeDocumentStatus,
  KnowledgeSourceType,
  Prisma,
  PrismaClient,
  ProjectStatus,
  RoadmapQuestionSourceType,
  RoadmapTemplateStatus
} from "@prisma/client";
import {
  buildFrontendDsaPlan,
  FRONTEND_SESSIONS,
  type PlanQuestion
} from "../src/lib/frontend-plan";

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
  category: string;
  title: string;
  roles: string[];
  levels: string[];
  difficulty: string;
  expectedMinutes: number;
  evidenceType: string;
  competency: string;
  prompt: string;
  promptTemplate?: string;
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

  await prisma.dsaQuestion.deleteMany({
    where: { slug: { notIn: questionSlugs } }
  });
  await prisma.dsaPhase.deleteMany({
    where: { slug: { notIn: phaseSlugs } }
  });

  for (const phase of phases) {
    const phaseSlug = dsaPhaseSlug(phase.phase);
    const phaseNumber = dsaPhaseNumber(phase.phase);

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

    for (const question of phase.questions) {
      await prisma.dsaQuestion.upsert({
        where: { slug: question.slug },
        update: dsaQuestionData(phaseSlug, question),
        create: {
          slug: question.slug,
          ...dsaQuestionData(phaseSlug, question)
        }
      });
    }
  }

  console.log(`Seeded ${questionSlugs.length} DSA questions across ${phaseSlugs.length} phases.`);
}

async function seedPrepQuestionTemplates(): Promise<void> {
  const prepDir = join(process.cwd(), "src/data/prep");
  const banks = readdirSync(prepDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(prepDir, file), "utf8")) as PrepQuestionBankSeed);

  let totalTemplates = 0;

  for (const bank of banks) {
    const sourceLinks = new Map(bank.sourceLinks.map((source) => [source.id, source]));
    const templateIds = bank.templates.map((template) => template.id);

    await prisma.prepQuestionTemplate.deleteMany({
      where: {
        bank: bank.bank,
        id: { notIn: templateIds }
      }
    });

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
      role: "frontend",
      title: "Frontend Interview Roadmap",
      description:
        "A six-session frontend interview preparation path personalized per user after onboarding.",
      version: 1,
      status: RoadmapTemplateStatus.ACTIVE,
      metadata: {
        source: "src/lib/frontend-plan.ts",
        personalizationInputs: ["targetRole", "level", "resume", "progress", "attempts"]
      }
    },
    create: {
      role: "frontend",
      slug: "frontend-roadmap",
      title: "Frontend Interview Roadmap",
      description:
        "A six-session frontend interview preparation path personalized per user after onboarding.",
      version: 1,
      status: RoadmapTemplateStatus.ACTIVE,
      metadata: {
        source: "src/lib/frontend-plan.ts",
        personalizationInputs: ["targetRole", "level", "resume", "progress", "attempts"]
      }
    }
  });

  const sessionTemplateIds: string[] = [];
  for (const session of FRONTEND_SESSIONS) {
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

  await prisma.roadmapSessionTemplate.deleteMany({
    where: {
      templateId: frontendTemplate.id,
      id: { notIn: sessionTemplateIds }
    }
  });

  const frontendDsaSession = await prisma.roadmapSessionTemplate.findUniqueOrThrow({
    where: {
      templateId_slug: {
        templateId: frontendTemplate.id,
        slug: "frontend-dsa"
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

  const nonDsaSessionIds = sessionTemplateIds.filter((id) => id !== frontendDsaSession.id);
  await prisma.roadmapQuestionTemplate.deleteMany({
    where: { sessionTemplateId: { in: nonDsaSessionIds } }
  });
  await prisma.roadmapChapterTemplate.deleteMany({
    where: { sessionTemplateId: { in: nonDsaSessionIds } }
  });

  console.log(
    `Seeded frontend roadmap template with ${FRONTEND_SESSIONS.length} sessions, ${plan.chapters.length} DSA chapters, and ${plan.totalQuestions} DSA question mappings.`
  );
}

function prepTemplateData(
  bank: string,
  template: PrepQuestionTemplateSeed,
  sourceLinks: PrepSourceLinkSeed[]
) {
  return {
    bank,
    category: template.category,
    title: template.title,
    roles: template.roles,
    levels: template.levels,
    difficulty: template.difficulty,
    expectedMinutes: template.expectedMinutes,
    evidenceType: template.evidenceType,
    competency: template.competency,
    prompt: template.prompt,
    promptTemplate: template.promptTemplate ?? null,
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
