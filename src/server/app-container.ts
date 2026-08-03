import { GoogleGenAI } from "@google/genai";
import { AiService } from "./ai/ai.service";
import { GeminiProvider } from "./ai/providers/gemini.provider";
import { GroqProvider } from "./ai/providers/groq.provider";
import { AppConfigService } from "./config/app-config.service";
import { validateEnvironment } from "./config/environment.schema";
import { PrismaService } from "./database/prisma.service";
import { HealthService } from "./health/health.service";
import { InterviewDecider } from "./interview/decider";
import { InterviewPlanner } from "./interview/planner";
import { InterviewService } from "./interview/interview.service";
import { MemorySessionStore } from "./interview/session-store";

export interface AppContainer {
  config: AppConfigService;
  healthService: HealthService;
  interviewService: InterviewService;
}

let container: AppContainer | null = null;

export function getAppContainer(): AppContainer {
  if (container) {
    return container;
  }

  const config = new AppConfigService(validateEnvironment(process.env));
  const prisma = new PrismaService();
  const geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });

  // Planning runs once per session and is not in the latency path, so it stays
  // on Gemini. The per-turn decision goes to Groq when configured: it sits in
  // the voice turn loop, where time-to-first-token is the budget that matters.
  const planningAi = new AiService(new GeminiProvider(config, geminiClient));
  const decidingAi = config.groqApiKey
    ? new AiService(new GroqProvider(config, config.groqApiKey, config.groqDeciderModel))
    : planningAi;

  container = {
    config,
    healthService: new HealthService(config, prisma),
    interviewService: new InterviewService(
      new InterviewPlanner(planningAi),
      new InterviewDecider(decidingAi),
      // Phase 6 swaps this for a Prisma-backed store.
      new MemorySessionStore(),
      config.interviewDailyLimit
    )
  };

  return container;
}
