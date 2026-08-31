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
import { HelpRequestService } from "./help/help-request.service";
import { StuckSummaryService } from "./help/stuck-summary";
import { ConciergeNotifier } from "./help/concierge-notifier";
import { HelperMatchingService } from "./help/helper-matching";
import { HelperEligibilityService } from "./help/helper-eligibility";
import { HelpSessionService } from "./help/help-session.service";
import { HelpSafetyService } from "./help/help-safety.service";
import { HelpHistoryService } from "./help/help-history.service";
import { NotificationService } from "./notifications/notification.service";
import { NotificationDispatcher } from "./notifications/notification-dispatcher";
import { EmailChannel } from "./notifications/email-channel";
import { clerkAddressBook } from "./notifications/clerk-address-book";
import { DsaInterviewEvaluator } from "./dsa/interview-evaluator";
import { DsaPracticeFeedbackService } from "./dsa/practice-feedback.service";
import { ProfileService } from "./profile/profile.service";
import { ProgressService } from "./progress/progress.service";
import { FrontendRoadmapService } from "./roadmap/frontend-roadmap.service";
import { ResumeService } from "./onboarding/resume/service";
import { ResumeInterviewKitService } from "./onboarding/resume/interview-kit";
import { PersonalizedPlanningStore } from "./interview/personalized-planning-store";
import { PersonalizedPerformanceStore } from "./interview/personalized-performance-store";
import { TechnicalAnswerEvaluator } from "./interview/technical-answer-evaluator";
import { PracticeRoadmapService } from "./practice/practice-roadmap.service";
import { PrepPracticeService } from "./practice/prep-practice.service";
import { PrepPracticeEvaluator } from "./practice/prep-practice-evaluator";
import { PracticeEvidenceStore } from "./practice/practice-evidence-store";
import { WorkspaceSearchService } from "./search/workspace-search.service";
import { TeacherNotificationService } from "./notifications/teacher-notification.service";

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
  helpRequestService: HelpRequestService;
  stuckSummaryService: StuckSummaryService;
  conciergeNotifier: ConciergeNotifier;
  helperMatchingService: HelperMatchingService;
  helpSessionService: HelpSessionService;
  helpSafetyService: HelpSafetyService;
  helpHistoryService: HelpHistoryService;
  notificationService: NotificationService;
  notificationDispatcher: NotificationDispatcher;
  teacherNotificationService: TeacherNotificationService;
  dsaInterviewEvaluator: DsaInterviewEvaluator;
  dsaPracticeFeedbackService: DsaPracticeFeedbackService;
  frontendRoadmapService: FrontendRoadmapService;
  progressService: ProgressService;
  personalizedPlanningStore: PersonalizedPlanningStore;
  personalizedPerformanceStore: PersonalizedPerformanceStore;
  practiceEvidenceStore: PracticeEvidenceStore;
  personalizedInterviewPlanGenerator: PersonalizedInterviewPlanGenerator;
  personalizedInterviewPlanningService: PersonalizedInterviewPlanningService;
  practiceRoadmapService: PracticeRoadmapService;
  prepPracticeService: PrepPracticeService;
  workspaceSearchService: WorkspaceSearchService;
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
  const practiceEvidenceStore = new PracticeEvidenceStore(prisma);
  const personalizedInterviewPlanGenerator = new PersonalizedInterviewPlanGenerator();
  const personalizedInterviewPlanningService = new PersonalizedInterviewPlanningService(
    personalizedPlanningStore,
    personalizedInterviewPlanGenerator,
    profileService,
    personalizedPerformanceStore,
    practiceEvidenceStore
  );
  const frontendRoadmapService = new FrontendRoadmapService(prisma);

  const notifications = new NotificationService(prisma);
  const notificationDispatcher = new NotificationDispatcher(
    notifications,
    new EmailChannel(
      config.notificationEmailEnabled ? config.resendApiKey : undefined,
      config.notificationEmailEnabled ? config.notificationFromEmail : undefined,
      clerkAddressBook
    ),
    config.appOrigin
  );
  const helpSafety = new HelpSafetyService(prisma);
  const helperEligibility = new HelperEligibilityService(prisma);

  container = {
    config,
    healthService: new HealthService(config, prisma),
    profileService,
    // Seeded content, identical for every user, so the service caches it.
    dsaService: new DsaService(prisma),
    dsaNotesService: new DsaNotesService(prisma),
    helpRequestService: new HelpRequestService(prisma, helpSafety, helperEligibility),
    stuckSummaryService: new StuckSummaryService(geminiAi),
    conciergeNotifier: new ConciergeNotifier(config.helpRequestWebhookUrl),
    helperMatchingService: new HelperMatchingService(prisma),
    helpSessionService: new HelpSessionService(prisma),
    helpSafetyService: helpSafety,
    helpHistoryService: new HelpHistoryService(prisma),
    notificationService: notifications,
    notificationDispatcher,
    teacherNotificationService: new TeacherNotificationService(
      prisma,
      notificationDispatcher,
      config.appOrigin
    ),
    dsaInterviewEvaluator: new DsaInterviewEvaluator(interviewAi),
    dsaPracticeFeedbackService: new DsaPracticeFeedbackService(geminiAi),
    frontendRoadmapService,
    // Read-only aggregate over roadmap progress and attempt history.
    progressService: new ProgressService(prisma),
    // Additive versioned storage for the dynamic interview-planning pipeline.
    // Existing candidates are lazily backfilled from their saved resume.
    personalizedPlanningStore,
    personalizedPerformanceStore,
    practiceEvidenceStore,
    // Produces the five evidence-grounded blueprints before question generation.
    personalizedInterviewPlanGenerator,
    // Reuses or publishes the active immutable plan for the current inputs.
    personalizedInterviewPlanningService,
    // Persists the six Practice slots from the active immutable interview plan.
    practiceRoadmapService: new PracticeRoadmapService(
      prisma,
      frontendRoadmapService,
      personalizedInterviewPlanningService,
      config.practiceNonDsaEnabled
    ),
    prepPracticeService: new PrepPracticeService(
      prisma,
      frontendRoadmapService,
      new PrepPracticeEvaluator(geminiAi)
    ),
    workspaceSearchService: new WorkspaceSearchService(prisma),
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
