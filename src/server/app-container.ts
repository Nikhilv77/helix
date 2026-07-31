import { GoogleGenAI } from "@google/genai";
import { AiService } from "./ai/ai.service";
import { GeminiEmbeddingsProvider } from "./ai/providers/gemini-embeddings.provider";
import { GeminiProvider } from "./ai/providers/gemini.provider";
import { AppConfigService } from "./config/app-config.service";
import { validateEnvironment } from "./config/environment.schema";
import { PrismaService } from "./database/prisma.service";
import { DesignSessionDiagramsService } from "./design-sessions/design-session-diagrams.service";
import { DesignSessionsRepository } from "./design-sessions/design-sessions.repository";
import { DesignSessionsService } from "./design-sessions/design-sessions.service";
import { DesignValidationService } from "./design-sessions/design-validation.service";
import { DeterministicDesignValidatorService } from "./design-sessions/deterministic-design-validator.service";
import { MermaidFlowchartValidator } from "./design-sessions/mermaid-flowchart.validator";
import { HealthService } from "./health/health.service";
import { EmbeddingsService } from "./knowledge/embeddings.service";
import { KnowledgeRepository } from "./knowledge/knowledge.repository";
import { KnowledgeService } from "./knowledge/knowledge.service";
import { ProjectsRepository } from "./projects/projects.repository";
import { ProjectsService } from "./projects/projects.service";
import { RetrievalRepository } from "./retrieval/retrieval.repository";
import { RetrievalService } from "./retrieval/retrieval.service";
import { CapacityCalculatorTool } from "./tools/capacity-calculator/capacity-calculator.tool";
import { ToolRegistry } from "./tools/tool-registry";
import { ToolsService } from "./tools/tools.service";

export interface AppContainer {
  config: AppConfigService;
  healthService: HealthService;
  projectsService: ProjectsService;
  designSessionsService: DesignSessionsService;
  designSessionDiagramsService: DesignSessionDiagramsService;
  designValidationService: DesignValidationService;
  knowledgeService: KnowledgeService;
  embeddingsService: EmbeddingsService;
  retrievalService: RetrievalService;
  toolsService: ToolsService;
}

let container: AppContainer | null = null;

export function getAppContainer(): AppContainer {
  if (container) {
    return container;
  }

  const config = new AppConfigService(validateEnvironment(process.env));
  const prisma = new PrismaService();
  const geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const geminiProvider = new GeminiProvider(config, geminiClient);
  const geminiEmbeddingsProvider = new GeminiEmbeddingsProvider(config, geminiClient);
  const aiService = new AiService(geminiProvider);

  const projectsRepository = new ProjectsRepository(prisma);
  const projectsService = new ProjectsService(projectsRepository);
  const toolsService = new ToolsService(new ToolRegistry(new CapacityCalculatorTool()));
  const knowledgeRepository = new KnowledgeRepository(prisma);
  const embeddingsService = new EmbeddingsService(config, knowledgeRepository, geminiEmbeddingsProvider);
  const retrievalRepository = new RetrievalRepository(prisma);
  const retrievalService = new RetrievalService(config, retrievalRepository, geminiEmbeddingsProvider);
  const designSessionsRepository = new DesignSessionsRepository(prisma);
  const designSessionsService = new DesignSessionsService(
    designSessionsRepository,
    projectsService,
    aiService,
    toolsService,
    retrievalService
  );

  container = {
    config,
    healthService: new HealthService(config, prisma),
    projectsService,
    designSessionsService,
    designSessionDiagramsService: new DesignSessionDiagramsService(
      designSessionsRepository,
      aiService,
      new MermaidFlowchartValidator()
    ),
    designValidationService: new DesignValidationService(
      designSessionsRepository,
      new DeterministicDesignValidatorService(),
      aiService
    ),
    knowledgeService: new KnowledgeService(config, knowledgeRepository),
    embeddingsService,
    retrievalService,
    toolsService
  };

  return container;
}
