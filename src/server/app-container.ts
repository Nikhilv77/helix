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
import { PersonalizedInterviewPlanningService } from "./interview/personalized-interview-planning.service";
import { PersonalizedInterviewPlanGenerator } from "./interview/personalized-plan-generator";
import { PrismaSessionStore } from "./interview/session-store";
import { CurriculumService } from "./curriculum/curriculum.service";
import { DsaService } from "./dsa/dsa.service";
import { DsaNotesService } from "./dsa/dsa-notes.service";
import { DsaInterviewEvaluator } from "./dsa/interview-evaluator";
import { ProfileService } from "./profile/profile.service";
import { ProgressService } from "./progress/progress.service";
import { FrontendRoadmapService } from "./roadmap/frontend-roadmap.service";
import { ResumeService } from "./onboarding/resume/service";
import { ResumeInterviewKitService } from "./onboarding/resume/interview-kit";
import { PersonalizedPlanningStore } from "./interview/personalized-planning-store";
import { PersonalizedPerformanceStore } from "./interview/personalized-performance-store";
import { TechnicalAnswerEvaluator } from "./interview/technical-answer-evaluator";

export interface AppContainer {
  config: AppConfigService;
  healthService: HealthService;
  interviewService: InterviewService;
  profileService: ProfileService;
  curriculumService: CurriculumService;
  resumeService: ResumeService;
  resumeInterviewKitService: ResumeInterviewKitService;
  dsaService: DsaService;
  dsaNotesService: DsaNotesService;
  dsaInterviewEvaluator: DsaInterviewEvaluator;
  frontendRoadmapService: FrontendRoadmapService;
  progressService: ProgressService;
  personalizedPlanningStore: PersonalizedPlanningStore;
  personalizedPerformanceStore: PersonalizedPerformanceStore;
  personalizedInterviewPlanGenerator: PersonalizedInterviewPlanGenerator;
  personalizedInterviewPlanningService: PersonalizedInterviewPlanningService;
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

  const profileService = new ProfileService(prisma);
  const personalizedPlanningStore = new PersonalizedPlanningStore(prisma, profileService);
  const personalizedPerformanceStore = new PersonalizedPerformanceStore(prisma);
  const personalizedInterviewPlanGenerator = new PersonalizedInterviewPlanGenerator();

  container = {
    config,
    healthService: new HealthService(config, prisma),
    profileService,
    // Seeded content, identical for every user, so the service caches it.
    dsaService: new DsaService(prisma),
    dsaNotesService: new DsaNotesService(prisma),
    dsaInterviewEvaluator: new DsaInterviewEvaluator(interviewAi),
    frontendRoadmapService: new FrontendRoadmapService(prisma),
    // Read-only aggregate over roadmap progress and attempt history.
    progressService: new ProgressService(prisma),
    // Additive versioned storage for the dynamic interview-planning pipeline.
    // Existing candidates are lazily backfilled from their saved resume.
    personalizedPlanningStore,
    personalizedPerformanceStore,
    // Produces the five evidence-grounded blueprints before question generation.
    personalizedInterviewPlanGenerator,
    // Reuses or publishes the active immutable plan for the current inputs.
    personalizedInterviewPlanningService: new PersonalizedInterviewPlanningService(
      personalizedPlanningStore,
      personalizedInterviewPlanGenerator,
      profileService,
      personalizedPerformanceStore
    ),
    // Curriculum generation remains independent from the adaptive interview plan.
    curriculumService: new CurriculumService(geminiAi),
    // Resume classification benefits from the document-oriented model path;
    // keep the low-latency interview model reserved for live conversation.
    resumeService: new ResumeService(geminiAi),
    // Written once per resume and read by every later resume round, so the
    // round itself never spends a model call on planning.
    resumeInterviewKitService: new ResumeInterviewKitService(geminiAi, profileService),
    interviewService: new InterviewService(
      new InterviewPlanner(interviewAi),
      new InterviewDecider(interviewAi),
      new PrismaSessionStore(prisma),
      config.interviewDailyLimit,
      new TechnicalAnswerEvaluator(interviewAi)
    )
  };

  return container;
}
