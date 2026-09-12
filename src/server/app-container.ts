import { GoogleGenAI } from "@google/genai";
import { AiService } from "./ai/ai.service";
import { GeminiProvider } from "./ai/providers/gemini.provider";
import { GroqProvider } from "./ai/providers/groq.provider";
import { FallbackAiService } from "./ai/fallback-ai.service";
import { AppConfigService } from "./config/app-config.service";
import { validateEnvironment } from "./config/environment.schema";
import { PrismaService } from "./database/prisma.service";
import { HealthService } from "./health/health.service";
import { InterviewDecider } from "@/features/interviews/server/decider";
import { InterviewPlanner } from "@/features/interviews/server/planner";
import { InterviewService } from "@/features/interviews/server/interview.service";
import { PersonalizedInterviewPlanningService } from "@/features/interviews/server/personalized-interview-planning.service";
import { PersonalizedInterviewPlanGenerator } from "@/features/interviews/server/personalized-plan-generator";
import { PrismaSessionStore } from "@/features/interviews/server/session-store";
import { CurriculumService } from "./curriculum/curriculum.service";
import { DsaService } from "@/features/practice/dsa/server/dsa.service";
import { DsaNotesService } from "@/features/practice/dsa/server/dsa-notes.service";
import { DsaPracticeBlockStore } from "@/features/practice/dsa/server/dsa-practice-block.store";
import { DsaBlockAssessmentPreparationService } from "@/features/practice/dsa/server/dsa-block-assessment-preparation.service";
import { DsaBlockAssessmentRuntimeService } from "@/features/practice/dsa/server/dsa-block-assessment-runtime.service";
import { DsaBlockAssessmentFinalizationService } from "@/features/practice/dsa/server/dsa-block-assessment-finalization.service";
import { DsaBlockHistoryService } from "@/features/practice/dsa/server/dsa-block-history.service";
import { HelpRequestService } from "@/features/peer-help/server/help-request.service";
import { StuckSummaryService } from "@/features/peer-help/server/stuck-summary";
import { HelperMatchingService } from "@/features/peer-help/server/helper-matching";
import { HelperEligibilityService } from "@/features/peer-help/server/helper-eligibility";
import { HelpSessionService } from "@/features/peer-help/server/help-session.service";
import { HelpSafetyService } from "@/features/peer-help/server/help-safety.service";
import { HelpHistoryService } from "@/features/peer-help/server/help-history.service";
import { NotificationService } from "@/features/notifications/server/notification.service";
import { NotificationDispatcher } from "@/features/notifications/server/notification-dispatcher";
import { EmailChannel } from "@/features/notifications/server/email-channel";
import { clerkAddressBook } from "@/features/notifications/server/clerk-address-book";
import { DsaInterviewEvaluator } from "@/features/practice/dsa/server/interview-evaluator";
import { DsaPracticeFeedbackService } from "@/features/practice/dsa/server/practice-feedback.service";
import { ProfileService } from "@/features/profile/server/profile.service";
import { ProgressService } from "@/features/progress/server/progress.service";
import { FrontendRoadmapService } from "./roadmap/frontend-roadmap.service";
import { ResumeInterviewKitService } from "@/features/onboarding/server/resume/interview-kit";
import { ResumeService } from "@/features/onboarding/server/resume/service";
import { PersonalizedPlanningStore } from "@/features/interviews/server/personalized-planning-store";
import { PersonalizedPerformanceStore } from "@/features/interviews/server/personalized-performance-store";
import { TechnicalAnswerEvaluator } from "@/features/interviews/server/technical-answer-evaluator";
import { PracticeRoadmapService } from "@/features/practice/shared/server/practice-roadmap.service";
import { PracticeEvidenceStore } from "@/features/practice/shared/server/practice-evidence-store";
import { WorkspaceSearchService } from "@/features/search/server/workspace-search.service";
import { TeacherNotificationService } from "@/features/notifications/server/teacher-notification.service";
import { ResumeRoastGenerator } from "@/features/resume-roast/server/resume-roast.generator";
import { ResumeRoastService } from "@/features/resume-roast/server/resume-roast.service";
import { ResumeRoastStore } from "@/features/resume-roast/server/resume-roast.store";
import { PreparationOnboardingService } from "@/features/preparation-onboarding/server/preparation-onboarding.service";
import { CoreTechnicalStoryGenerator } from "@/features/practice/core-technical/server/story-generator";
import { CoreTechnicalQuestionGenerator } from "@/features/practice/core-technical/server/question-generator";
import { CoreTechnicalGenerationCritic } from "@/features/practice/core-technical/server/generation-critic";
import { CoreTechnicalGenerationPipeline } from "@/features/practice/core-technical/server/generation-pipeline";
import { CoreTechnicalGoldEvaluator } from "@/features/practice/core-technical/server/gold-evaluator";
import { CoreTechnicalGoldEvaluationRunner } from "@/features/practice/core-technical/server/gold-evaluation-runner";
import { CoreTechnicalBaselineEvidenceService } from "@/features/practice/core-technical/server/baseline-evidence.service";
import { CoreTechnicalFocusService } from "@/features/practice/core-technical/server/focus.service";
import { CoreTechnicalStoryRankingService } from "@/features/practice/core-technical/server/story-ranking.service";
import { CoreTechnicalPersistenceService } from "@/features/practice/core-technical/server/persistence.service";
import { CoreTechnicalRunnerService } from "@/features/practice/core-technical/server/runner.service";
import { CoreTechnicalAttemptEvaluator } from "@/features/practice/core-technical/server/attempt-evaluator";
import { CoreTechnicalPracticeService } from "@/features/practice/core-technical/server/practice.service";
import { CoreTechnicalPreparationService } from "@/features/practice/core-technical/server/preparation.service";
import { CoreTechnicalAssessmentEvaluator } from "@/features/practice/core-technical/server/assessment-evaluator";
import { CoreTechnicalAssessmentService } from "@/features/practice/core-technical/server/assessment.service";
import { CoreTechnicalAssessmentRuntimeService } from "@/features/practice/core-technical/server/assessment-runtime.service";
import { CoreTechnicalContinuationService } from "@/features/practice/core-technical/server/continuation.service";
import { CoreTechnicalHistoryService } from "@/features/practice/core-technical/server/history.service";
import { CoreTechnicalEligibilityService } from "@/features/practice/core-technical/server/eligibility.service";
import { CoreTechnicalWorkspaceAnalyticsService } from "@/features/practice/core-technical/server/workspace-analytics.service";
import { VercelSandboxNode22Executor } from "@/features/practice/core-technical/server/vercel-sandbox-executor";
import { AppliedEngineeringBaselineEvidenceService } from "@/features/practice/applied-engineering/server/baseline-evidence.service";
import { AppliedEngineeringFocusService } from "@/features/practice/applied-engineering/server/focus.service";
import { AppliedEngineeringIncidentRankingService } from "@/features/practice/applied-engineering/server/incident-ranking.service";
import { AppliedEngineeringPersistenceService } from "@/features/practice/applied-engineering/server/persistence.service";
import { AppliedEngineeringRunnerService } from "@/features/practice/applied-engineering/server/runner.service";
import { AppliedEngineeringAttemptEvaluator } from "@/features/practice/applied-engineering/server/attempt-evaluator";
import { AppliedEngineeringPracticeService } from "@/features/practice/applied-engineering/server/practice.service";
import { AppliedEngineeringAssessmentEvaluator } from "@/features/practice/applied-engineering/server/assessment-evaluator";
import { AppliedEngineeringAssessmentService } from "@/features/practice/applied-engineering/server/assessment.service";
import { AppliedEngineeringAssessmentRuntimeService } from "@/features/practice/applied-engineering/server/assessment-runtime.service";
import { AppliedEngineeringContinuationService } from "@/features/practice/applied-engineering/server/continuation.service";
import { AppliedEngineeringHistoryService } from "@/features/practice/applied-engineering/server/history.service";
import { AppliedEngineeringEligibilityService } from "@/features/practice/applied-engineering/server/eligibility.service";
import { AppliedEngineeringWorkspaceAnalyticsService } from "@/features/practice/applied-engineering/server/workspace-analytics.service";
import { AppliedEngineeringPreparationService } from "@/features/practice/applied-engineering/server/preparation.service";
import { ArchitectureDesignAssessmentEvaluator } from "@/features/practice/architecture-design/server/assessment-evaluator";
import { ArchitectureDesignAssessmentService } from "@/features/practice/architecture-design/server/assessment.service";
import { ArchitectureDesignAssessmentRuntimeService } from "@/features/practice/architecture-design/server/assessment-runtime.service";
import { ArchitectureDesignAttemptEvaluator } from "@/features/practice/architecture-design/server/attempt-evaluator";
import { ArchitectureDesignBaselineEvidenceService } from "@/features/practice/architecture-design/server/baseline-evidence.service";
import { ArchitectureDesignContinuationService } from "@/features/practice/architecture-design/server/continuation.service";
import { ArchitectureDesignEligibilityService } from "@/features/practice/architecture-design/server/eligibility.service";
import { ArchitectureDesignFocusService } from "@/features/practice/architecture-design/server/focus.service";
import { ArchitectureDesignHistoryService } from "@/features/practice/architecture-design/server/history.service";
import { ArchitectureDesignPracticeService } from "@/features/practice/architecture-design/server/practice.service";
import { ArchitectureDesignPreparationService } from "@/features/practice/architecture-design/server/preparation.service";
import { ArchitectureDesignRepositoryAdapter } from "@/features/practice/architecture-design/server/repository-adapter";
import { ArchitectureDesignScenarioRankingService } from "@/features/practice/architecture-design/server/scenario-ranking.service";
import { ArchitectureDesignWorkspaceAnalyticsService } from "@/features/practice/architecture-design/server/workspace-analytics.service";
import { NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE } from "@/features/practice/applied-engineering/domain/incident-ranking-catalogue";
import { ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE } from "@/features/practice/architecture-design/domain/scenario-ranking-catalogue";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/features/practice/core-technical/domain/story-ranking-catalogue";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import {
  CORE_TECHNICAL_INTERVIEW_EVIDENCE,
  CORE_TECHNICAL_SOURCES,
  NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
} from "@/features/practice/core-technical/domain/interview-patterns";

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
  dsaPracticeBlockStore: DsaPracticeBlockStore;
  dsaBlockAssessmentPreparationService: DsaBlockAssessmentPreparationService;
  dsaBlockAssessmentRuntimeService: DsaBlockAssessmentRuntimeService;
  dsaBlockAssessmentFinalizationService: DsaBlockAssessmentFinalizationService;
  dsaBlockHistoryService: DsaBlockHistoryService;
  helpRequestService: HelpRequestService;
  stuckSummaryService: StuckSummaryService;
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
  workspaceSearchService: WorkspaceSearchService;
  resumeRoastService: ResumeRoastService;
  preparationOnboardingService: PreparationOnboardingService;
  coreTechnicalStoryGenerator: CoreTechnicalStoryGenerator;
  coreTechnicalQuestionGenerator: CoreTechnicalQuestionGenerator;
  coreTechnicalGenerationCritic: CoreTechnicalGenerationCritic;
  coreTechnicalGenerationPipeline: CoreTechnicalGenerationPipeline;
  coreTechnicalGoldEvaluator: CoreTechnicalGoldEvaluator;
  coreTechnicalGoldEvaluationRunner: CoreTechnicalGoldEvaluationRunner;
  coreTechnicalBaselineEvidenceService: CoreTechnicalBaselineEvidenceService;
  coreTechnicalFocusService: CoreTechnicalFocusService;
  coreTechnicalStoryRankingService: CoreTechnicalStoryRankingService;
  coreTechnicalPersistenceService: CoreTechnicalPersistenceService;
  coreTechnicalRunnerService: CoreTechnicalRunnerService;
  coreTechnicalAttemptEvaluator: CoreTechnicalAttemptEvaluator;
  coreTechnicalPracticeService: CoreTechnicalPracticeService;
  coreTechnicalPreparationService: CoreTechnicalPreparationService;
  coreTechnicalAssessmentEvaluator: CoreTechnicalAssessmentEvaluator;
  coreTechnicalAssessmentService: CoreTechnicalAssessmentService;
  coreTechnicalAssessmentRuntimeService: CoreTechnicalAssessmentRuntimeService;
  coreTechnicalContinuationService: CoreTechnicalContinuationService;
  coreTechnicalHistoryService: CoreTechnicalHistoryService;
  coreTechnicalWorkspaceAnalyticsService: CoreTechnicalWorkspaceAnalyticsService;
  coreTechnicalEligibilityService: CoreTechnicalEligibilityService;
  appliedEngineeringBaselineEvidenceService: AppliedEngineeringBaselineEvidenceService;
  appliedEngineeringFocusService: AppliedEngineeringFocusService;
  appliedEngineeringIncidentRankingService: AppliedEngineeringIncidentRankingService;
  appliedEngineeringPersistenceService: AppliedEngineeringPersistenceService;
  appliedEngineeringRunnerService: AppliedEngineeringRunnerService;
  appliedEngineeringAttemptEvaluator: AppliedEngineeringAttemptEvaluator;
  appliedEngineeringPracticeService: AppliedEngineeringPracticeService;
  appliedEngineeringAssessmentEvaluator: AppliedEngineeringAssessmentEvaluator;
  appliedEngineeringAssessmentService: AppliedEngineeringAssessmentService;
  appliedEngineeringAssessmentRuntimeService: AppliedEngineeringAssessmentRuntimeService;
  appliedEngineeringContinuationService: AppliedEngineeringContinuationService;
  appliedEngineeringHistoryService: AppliedEngineeringHistoryService;
  appliedEngineeringEligibilityService: AppliedEngineeringEligibilityService;
  appliedEngineeringWorkspaceAnalyticsService: AppliedEngineeringWorkspaceAnalyticsService;
  appliedEngineeringPreparationService: AppliedEngineeringPreparationService;
  architectureDesign: {
    baselineEvidence: ArchitectureDesignBaselineEvidenceService;
    focus: ArchitectureDesignFocusService;
    ranking: ArchitectureDesignScenarioRankingService;
    repository: ArchitectureDesignRepositoryAdapter;
    attemptEvaluator: ArchitectureDesignAttemptEvaluator;
    practice: ArchitectureDesignPracticeService;
    preparation: ArchitectureDesignPreparationService;
    assessmentEvaluator: ArchitectureDesignAssessmentEvaluator;
    assessment: ArchitectureDesignAssessmentService;
    assessmentRuntime: ArchitectureDesignAssessmentRuntimeService;
    continuation: ArchitectureDesignContinuationService;
    history: ArchitectureDesignHistoryService;
    eligibility: ArchitectureDesignEligibilityService;
    workspaceAnalytics: ArchitectureDesignWorkspaceAnalyticsService;
  };
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
  const generationAi =
    interviewAi === geminiAi ? geminiAi : new FallbackAiService(geminiAi, interviewAi);

  const profileService = new ProfileService(prisma);
  const preparationOnboardingService = new PreparationOnboardingService(prisma);
  const coreTechnicalBaselineEvidenceService = new CoreTechnicalBaselineEvidenceService(prisma);
  const coreTechnicalFocusService = new CoreTechnicalFocusService({
    prisma,
    baselineEvidence: coreTechnicalBaselineEvidenceService
  });
  const coreTechnicalStoryRankingService = new CoreTechnicalStoryRankingService(
    NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE
  );
  const coreTechnicalPersistenceService = new CoreTechnicalPersistenceService(prisma);
  const coreTechnicalRunnerService = process.env.VERCEL
    ? new CoreTechnicalRunnerService(new VercelSandboxNode22Executor())
    : new CoreTechnicalRunnerService();
  const coreTechnicalAttemptEvaluator = new CoreTechnicalAttemptEvaluator(generationAi);
  const coreTechnicalPracticeService = new CoreTechnicalPracticeService(
    prisma,
    coreTechnicalRunnerService,
    coreTechnicalAttemptEvaluator
  );
  const coreTechnicalAssessmentEvaluator = new CoreTechnicalAssessmentEvaluator(
    generationAi,
    coreTechnicalStoryRankingService
  );
  const coreTechnicalAssessmentService = new CoreTechnicalAssessmentService(
    prisma,
    coreTechnicalAssessmentEvaluator
  );
  const coreTechnicalHistoryService = new CoreTechnicalHistoryService(
    prisma,
    coreTechnicalPracticeService
  );
  const coreTechnicalEligibilityService = new CoreTechnicalEligibilityService(
    prisma,
    coreTechnicalRunnerService
  );
  const coreTechnicalWorkspaceAnalyticsService = new CoreTechnicalWorkspaceAnalyticsService(prisma);
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
  const dsaPracticeBlockStore = new DsaPracticeBlockStore(prisma);
  const dsaBlockAssessmentPreparationService = new DsaBlockAssessmentPreparationService(prisma);
  const interviewService = new InterviewService(
    new InterviewPlanner(interviewAi),
    new InterviewDecider(interviewAi),
    new PrismaSessionStore(prisma),
    config.interviewDailyLimit,
    new TechnicalAnswerEvaluator(interviewAi)
  );
  const coreTechnicalAssessmentRuntimeService = new CoreTechnicalAssessmentRuntimeService(
    prisma,
    coreTechnicalAssessmentService,
    interviewService
  );
  const dsaBlockAssessmentRuntimeService = new DsaBlockAssessmentRuntimeService(
    prisma,
    dsaBlockAssessmentPreparationService,
    interviewService
  );
  const dsaBlockAssessmentFinalizationService = new DsaBlockAssessmentFinalizationService(prisma);
  const dsaBlockHistoryService = new DsaBlockHistoryService(dsaPracticeBlockStore, prisma);
  interviewService.setBlockAssessmentMcqGrader(dsaBlockAssessmentRuntimeService);
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
  const resumeRoastStore = new ResumeRoastStore(prisma);
  const resumeRoastService = new ResumeRoastService(
    profileService,
    resumeRoastStore,
    new ResumeRoastGenerator(geminiAi)
  );
  const helpSafety = new HelpSafetyService(prisma);
  const helperEligibility = new HelperEligibilityService(prisma);

  const coreTechnicalStoryGenerator = new CoreTechnicalStoryGenerator({
    ai: generationAi,
    domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });
  const coreTechnicalQuestionGenerator = new CoreTechnicalQuestionGenerator({
    ai: generationAi,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS,
    // Personalized preparation is user-facing; generate independent stages in parallel.
    concurrency: 4
  });
  const coreTechnicalGenerationCritic = new CoreTechnicalGenerationCritic({
    ai: generationAi,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS,
    evidenceSources: CORE_TECHNICAL_INTERVIEW_EVIDENCE,
    technicalSources: CORE_TECHNICAL_SOURCES
  });
  const coreTechnicalGenerationPipeline = new CoreTechnicalGenerationPipeline({
    storyGenerator: coreTechnicalStoryGenerator,
    questionGenerator: coreTechnicalQuestionGenerator,
    critic: coreTechnicalGenerationCritic,
    runner: coreTechnicalRunnerService
  });
  const coreTechnicalPreparationService = new CoreTechnicalPreparationService({
    prisma,
    focus: coreTechnicalFocusService,
    ranking: coreTechnicalStoryRankingService,
    generation: coreTechnicalGenerationPipeline,
    persistence: coreTechnicalPersistenceService,
    practice: coreTechnicalPracticeService
  });
  const coreTechnicalContinuationService = new CoreTechnicalContinuationService({
    prisma,
    generation: coreTechnicalGenerationPipeline,
    persistence: coreTechnicalPersistenceService,
    practice: coreTechnicalPracticeService
  });
  const coreTechnicalGoldEvaluator = new CoreTechnicalGoldEvaluator({
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });
  const appliedEngineeringRunnerService = new AppliedEngineeringRunnerService(
    coreTechnicalRunnerService
  );
  const appliedEngineeringBaselineEvidenceService = new AppliedEngineeringBaselineEvidenceService(
    prisma
  );
  const appliedEngineeringFocusService = new AppliedEngineeringFocusService({
    database: prisma,
    baselineEvidence: appliedEngineeringBaselineEvidenceService
  });
  const appliedEngineeringIncidentRankingService = new AppliedEngineeringIncidentRankingService(
    NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE
  );
  const appliedEngineeringPersistenceService = new AppliedEngineeringPersistenceService(prisma);
  const appliedEngineeringAttemptEvaluator = new AppliedEngineeringAttemptEvaluator(generationAi);
  const appliedEngineeringPracticeService = new AppliedEngineeringPracticeService(
    prisma,
    appliedEngineeringRunnerService,
    appliedEngineeringAttemptEvaluator
  );
  const appliedEngineeringAssessmentEvaluator = new AppliedEngineeringAssessmentEvaluator(
    generationAi,
    appliedEngineeringIncidentRankingService
  );
  const appliedEngineeringAssessmentService = new AppliedEngineeringAssessmentService(
    prisma,
    appliedEngineeringAssessmentEvaluator
  );
  const appliedEngineeringAssessmentRuntimeService = new AppliedEngineeringAssessmentRuntimeService(
    prisma,
    appliedEngineeringAssessmentService,
    interviewService
  );
  const appliedEngineeringContinuationService = new AppliedEngineeringContinuationService({
    prisma,
    persistence: appliedEngineeringPersistenceService,
    practice: appliedEngineeringPracticeService
  });
  const appliedEngineeringPreparationService = new AppliedEngineeringPreparationService({
    prisma,
    focus: appliedEngineeringFocusService,
    ranking: appliedEngineeringIncidentRankingService,
    persistence: appliedEngineeringPersistenceService,
    practice: appliedEngineeringPracticeService
  });
  const appliedEngineeringHistoryService = new AppliedEngineeringHistoryService(
    prisma,
    appliedEngineeringPracticeService
  );
  const appliedEngineeringEligibilityService = new AppliedEngineeringEligibilityService({
    publications: {
      published: async (candidates) => {
        const rows = await prisma.appliedEngineeringIncidentVersion.findMany({
          where: {
            OR: candidates.map((candidate) => ({
              incidentKey: candidate.key,
              version: candidate.version,
              publicationStatus: "PUBLISHED"
            }))
          },
          select: { incidentKey: true, version: true }
        });
        return rows.map((row) => ({ key: row.incidentKey, version: row.version }));
      }
    },
    runner: appliedEngineeringRunnerService
  });
  const appliedEngineeringWorkspaceAnalyticsService =
    new AppliedEngineeringWorkspaceAnalyticsService(prisma);
  const architectureDesignBaselineEvidenceService = new ArchitectureDesignBaselineEvidenceService(
    prisma
  );
  const architectureDesignFocusService = new ArchitectureDesignFocusService({
    database: prisma,
    baselineEvidence: architectureDesignBaselineEvidenceService
  });
  const architectureDesignScenarioRankingService = new ArchitectureDesignScenarioRankingService(
    ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
  );
  const architectureDesignRepositoryAdapter = new ArchitectureDesignRepositoryAdapter(prisma);
  const architectureDesignAttemptEvaluator = new ArchitectureDesignAttemptEvaluator(generationAi);
  const architectureDesignPracticeService = new ArchitectureDesignPracticeService(
    prisma,
    architectureDesignAttemptEvaluator
  );
  const architectureDesignPreparationService = new ArchitectureDesignPreparationService({
    prisma,
    focus: architectureDesignFocusService,
    ranking: architectureDesignScenarioRankingService,
    repository: architectureDesignRepositoryAdapter,
    practice: architectureDesignPracticeService
  });
  const architectureDesignAssessmentEvaluator = new ArchitectureDesignAssessmentEvaluator(
    generationAi,
    architectureDesignScenarioRankingService
  );
  const architectureDesignAssessmentService = new ArchitectureDesignAssessmentService(
    prisma,
    architectureDesignAssessmentEvaluator
  );
  const architectureDesignAssessmentRuntimeService = new ArchitectureDesignAssessmentRuntimeService(
    prisma,
    architectureDesignAssessmentService,
    interviewService
  );
  const architectureDesignContinuationService = new ArchitectureDesignContinuationService({
    prisma,
    repository: architectureDesignRepositoryAdapter,
    practice: architectureDesignPracticeService
  });
  const architectureDesignHistoryService = new ArchitectureDesignHistoryService(
    prisma,
    architectureDesignPracticeService
  );
  const architectureDesignEligibilityService = new ArchitectureDesignEligibilityService({
    publications: architectureDesignRepositoryAdapter,
    catalogue: ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
  });
  const architectureDesignWorkspaceAnalyticsService =
    new ArchitectureDesignWorkspaceAnalyticsService(prisma);

  container = {
    config,
    healthService: new HealthService(config, prisma),
    profileService,
    preparationOnboardingService,
    coreTechnicalBaselineEvidenceService,
    coreTechnicalFocusService,
    coreTechnicalStoryRankingService,
    coreTechnicalPersistenceService,
    coreTechnicalRunnerService,
    coreTechnicalAttemptEvaluator,
    coreTechnicalPracticeService,
    coreTechnicalPreparationService,
    coreTechnicalAssessmentEvaluator,
    coreTechnicalAssessmentService,
    coreTechnicalAssessmentRuntimeService,
    coreTechnicalContinuationService,
    coreTechnicalHistoryService,
    coreTechnicalEligibilityService,
    coreTechnicalWorkspaceAnalyticsService,
    coreTechnicalStoryGenerator,
    coreTechnicalQuestionGenerator,
    coreTechnicalGenerationCritic,
    coreTechnicalGenerationPipeline,
    coreTechnicalGoldEvaluator,
    appliedEngineeringBaselineEvidenceService,
    appliedEngineeringFocusService,
    appliedEngineeringIncidentRankingService,
    appliedEngineeringPersistenceService,
    appliedEngineeringRunnerService,
    appliedEngineeringAttemptEvaluator,
    appliedEngineeringPracticeService,
    appliedEngineeringAssessmentEvaluator,
    appliedEngineeringAssessmentService,
    appliedEngineeringAssessmentRuntimeService,
    appliedEngineeringContinuationService,
    appliedEngineeringHistoryService,
    appliedEngineeringEligibilityService,
    appliedEngineeringWorkspaceAnalyticsService,
    appliedEngineeringPreparationService,
    architectureDesign: {
      baselineEvidence: architectureDesignBaselineEvidenceService,
      focus: architectureDesignFocusService,
      ranking: architectureDesignScenarioRankingService,
      repository: architectureDesignRepositoryAdapter,
      attemptEvaluator: architectureDesignAttemptEvaluator,
      practice: architectureDesignPracticeService,
      preparation: architectureDesignPreparationService,
      assessmentEvaluator: architectureDesignAssessmentEvaluator,
      assessment: architectureDesignAssessmentService,
      assessmentRuntime: architectureDesignAssessmentRuntimeService,
      continuation: architectureDesignContinuationService,
      history: architectureDesignHistoryService,
      eligibility: architectureDesignEligibilityService,
      workspaceAnalytics: architectureDesignWorkspaceAnalyticsService
    },
    coreTechnicalGoldEvaluationRunner: new CoreTechnicalGoldEvaluationRunner({
      generationPipeline: coreTechnicalGenerationPipeline,
      evaluator: coreTechnicalGoldEvaluator
    }),
    // Seeded content, identical for every user, so the service caches it.
    dsaService: new DsaService(prisma),
    dsaNotesService: new DsaNotesService(prisma),
    dsaPracticeBlockStore,
    dsaBlockAssessmentPreparationService,
    dsaBlockAssessmentRuntimeService,
    dsaBlockAssessmentFinalizationService,
    dsaBlockHistoryService,
    helpRequestService: new HelpRequestService(prisma, helpSafety, helperEligibility),
    stuckSummaryService: new StuckSummaryService(geminiAi),
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
    // Persists the active DSA Practice slot from the immutable interview plan.
    practiceRoadmapService: new PracticeRoadmapService(
      prisma,
      frontendRoadmapService,
      personalizedInterviewPlanningService
    ),
    workspaceSearchService: new WorkspaceSearchService(prisma),
    // Resume Roast reuses the profile's immutable candidate revision and the
    // same Gemini client as structured resume extraction.
    resumeRoastService,
    // Curriculum generation remains independent from the adaptive interview plan.
    curriculumService: new CurriculumService(geminiAi),
    // Resume classification benefits from the document-oriented model path;
    // keep the low-latency interview model reserved for live conversation.
    resumeService: new ResumeService(geminiAi),
    // Written once per resume and read by every later resume round, so the
    // round itself never spends a model call on planning.
    resumeInterviewKitService: new ResumeInterviewKitService(geminiAi, profileService),
    interviewService
  };

  return container;
}
