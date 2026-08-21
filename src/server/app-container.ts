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
import { PrismaSessionStore } from "./interview/session-store";
import { CurriculumService } from "./curriculum/curriculum.service";
import { DsaService } from "./dsa/dsa.service";
import { DsaNotesService } from "./dsa/dsa-notes.service";
import { DsaInterviewEvaluator } from "./dsa/interview-evaluator";
import { ProfileService } from "./profile/profile.service";
import { ProgressService } from "./progress/progress.service";
import { FrontendRoadmapService } from "./roadmap/frontend-roadmap.service";
import { ResumeService } from "./onboarding/resume/service";

export interface AppContainer {
  config: AppConfigService;
  healthService: HealthService;
  interviewService: InterviewService;
  profileService: ProfileService;
  curriculumService: CurriculumService;
  resumeService: ResumeService;
  dsaService: DsaService;
  dsaNotesService: DsaNotesService;
  dsaInterviewEvaluator: DsaInterviewEvaluator;
  frontendRoadmapService: FrontendRoadmapService;
  progressService: ProgressService;
}

let container: AppContainer | null = null;

export function getAppContainer(): AppContainer {
  if (container) {
    return container;
  }

  const config = new AppConfigService(validateEnvironment(process.env));
  const prisma = new PrismaService();
  const geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const geminiAi = new AiService(new GeminiProvider(config, geminiClient));
  // Interview setup and live turns both need a tight response budget. Prefer
  // Groq for that path, while preserving Gemini as the zero-config fallback.
  const interviewAi = config.groqApiKey
    ? new AiService(new GroqProvider(config, config.groqApiKey, config.groqDeciderModel))
    : geminiAi;

  container = {
    config,
    healthService: new HealthService(config, prisma),
    profileService: new ProfileService(prisma),
    // Seeded content, identical for every user, so the service caches it.
    dsaService: new DsaService(prisma),
    dsaNotesService: new DsaNotesService(prisma),
    dsaInterviewEvaluator: new DsaInterviewEvaluator(interviewAi),
    frontendRoadmapService: new FrontendRoadmapService(prisma),
    // Read-only aggregate over roadmap progress and attempt history.
    progressService: new ProgressService(prisma),
    // The plan is written once per resume, so quality matters more than latency.
    curriculumService: new CurriculumService(geminiAi),
    // Resume classification benefits from the document-oriented model path;
    // keep the low-latency interview model reserved for live conversation.
    resumeService: new ResumeService(geminiAi),
    interviewService: new InterviewService(
      new InterviewPlanner(interviewAi),
      new InterviewDecider(interviewAi),
      new PrismaSessionStore(prisma),
      config.interviewDailyLimit
    )
  };

  return container;
}
