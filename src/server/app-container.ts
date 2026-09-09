import { GoogleGenAI } from "@google/genai";
import { AiService } from "./ai/ai.service";
import { GeminiProvider } from "./ai/providers/gemini.provider";
import { GroqProvider } from "./ai/providers/groq.provider";
import { FallbackAiService } from "./ai/fallback-ai.service";
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
import { DsaPracticeBlockStore } from "./dsa/dsa-practice-block.store";
import { DsaBlockAssessmentPreparationService } from "./dsa/dsa-block-assessment-preparation.service";
import { DsaBlockAssessmentRuntimeService } from "./dsa/dsa-block-assessment-runtime.service";
import { DsaBlockAssessmentFinalizationService } from "./dsa/dsa-block-assessment-finalization.service";
import { DsaBlockHistoryService } from "./dsa/dsa-block-history.service";
import { HelpRequestService } from "./help/help-request.service";
import { StuckSummaryService } from "./help/stuck-summary";
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
import { ResumeInterviewKitService } from "@/features/onboarding/server/resume/interview-kit";
import { ResumeService } from "@/features/onboarding/server/resume/service";
import { PersonalizedPlanningStore } from "./interview/personalized-planning-store";
import { PersonalizedPerformanceStore } from "./interview/personalized-performance-store";
import { TechnicalAnswerEvaluator } from "./interview/technical-answer-evaluator";
import { PracticeRoadmapService } from "./practice/practice-roadmap.service";
import { PracticeEvidenceStore } from "./practice/practice-evidence-store";
import { WorkspaceSearchService } from "./search/workspace-search.service";
import { TeacherNotificationService } from "./notifications/teacher-notification.service";
import { ResumeRoastGenerator } from "./resume-roast/resume-roast.generator";
import { ResumeRoastService } from "./resume-roast/resume-roast.service";
import { ResumeRoastStore } from "./resume-roast/resume-roast.store";
import { PreparationOnboardingService } from "./preparation/preparation-onboarding.service";
import { CoreTechnicalStoryGenerator } from "./core-technical/story-generator";
import { CoreTechnicalQuestionGenerator } from "./core-technical/question-generator";
import { CoreTechnicalGenerationCritic } from "./core-technical/generation-critic";
import { CoreTechnicalGenerationPipeline } from "./core-technical/generation-pipeline";
import { CoreTechnicalGoldEvaluator } from "./core-technical/gold-evaluator";
import { CoreTechnicalGoldEvaluationRunner } from "./core-technical/gold-evaluation-runner";
import { CoreTechnicalBaselineEvidenceService } from "./core-technical/baseline-evidence.service";
import { CoreTechnicalFocusService } from "./core-technical/focus.service";
import { CoreTechnicalStoryRankingService } from "./core-technical/story-ranking.service";
import { CoreTechnicalPersistenceService } from "./core-technical/persistence.service";
import { CoreTechnicalRunnerService } from "./core-technical/runner.service";
import { CoreTechnicalAttemptEvaluator } from "./core-technical/attempt-evaluator";
import { CoreTechnicalPracticeService } from "./core-technical/practice.service";
import { CoreTechnicalPreparationService } from "./core-technical/preparation.service";
import { CoreTechnicalAssessmentEvaluator } from "./core-technical/assessment-evaluator";
import { CoreTechnicalAssessmentService } from "./core-technical/assessment.service";
import { CoreTechnicalContinuationService } from "./core-technical/continuation.service";
import { CoreTechnicalHistoryService } from "./core-technical/history.service";
import { CoreTechnicalEligibilityService } from "./core-technical/eligibility.service";
import { CoreTechnicalWorkspaceAnalyticsService } from "./core-technical/workspace-analytics.service";
import { VercelSandboxNode22Executor } from "./core-technical/vercel-sandbox-executor";
import { AppliedEngineeringBaselineEvidenceService } from "./applied-engineering/baseline-evidence.service";
import { AppliedEngineeringFocusService } from "./applied-engineering/focus.service";
import { AppliedEngineeringIncidentRankingService } from "./applied-engineering/incident-ranking.service";
import { AppliedEngineeringPersistenceService } from "./applied-engineering/persistence.service";
import { AppliedEngineeringRunnerService } from "./applied-engineering/runner.service";
import { AppliedEngineeringAttemptEvaluator } from "./applied-engineering/attempt-evaluator";
import { AppliedEngineeringPracticeService } from "./applied-engineering/practice.service";
import { AppliedEngineeringAssessmentEvaluator } from "./applied-engineering/assessment-evaluator";
import { AppliedEngineeringAssessmentService } from "./applied-engineering/assessment.service";
import { AppliedEngineeringContinuationService } from "./applied-engineering/continuation.service";
import { AppliedEngineeringHistoryService } from "./applied-engineering/history.service";
import { AppliedEngineeringEligibilityService } from "./applied-engineering/eligibility.service";
import { AppliedEngineeringWorkspaceAnalyticsService } from "./applied-engineering/workspace-analytics.service";
import { AppliedEngineeringPreparationService } from "./applied-engineering/preparation.service";
import { ArchitectureDesignAssessmentEvaluator } from "./architecture-design/assessment-evaluator";
import { ArchitectureDesignAssessmentService } from "./architecture-design/assessment.service";
import { ArchitectureDesignAttemptEvaluator } from "./architecture-design/attempt-evaluator";
import { ArchitectureDesignBaselineEvidenceService } from "./architecture-design/baseline-evidence.service";
import { ArchitectureDesignContinuationService } from "./architecture-design/continuation.service";
import { ArchitectureDesignEligibilityService } from "./architecture-design/eligibility.service";
import { ArchitectureDesignFocusService } from "./architecture-design/focus.service";
import { ArchitectureDesignHistoryService } from "./architecture-design/history.service";
import { ArchitectureDesignPracticeService } from "./architecture-design/practice.service";
import { ArchitectureDesignPreparationService } from "./architecture-design/preparation.service";
import { ArchitectureDesignRepositoryAdapter } from "./architecture-design/repository-adapter";
import { ArchitectureDesignScenarioRankingService } from "./architecture-design/scenario-ranking.service";
import { ArchitectureDesignWorkspaceAnalyticsService } from "./architecture-design/workspace-analytics.service";
import { NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE } from "../lib/practice/applied-engineering/incident-ranking-catalogue";
import { ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE } from "../lib/practice/architecture-design/scenario-ranking-catalogue";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "../lib/practice/core-technical/story-ranking-catalogue";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "../lib/practice/core-technical/domain-map";
import {
  CORE_TECHNICAL_INTERVIEW_EVIDENCE,
  CORE_TECHNICAL_SOURCES,
  NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
} from "../lib/practice/core-technical/interview-patterns";

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
    concurrency: 1
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
