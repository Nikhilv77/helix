import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { DesignSession, DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { isRecord } from "../common/utils/is-record";
import { ProjectsService } from "../projects/projects.service";
import { RetrievalSearchResult, RetrievalService } from "../retrieval/retrieval.service";
import {
  CapacityCalculatorOutput,
  capacityCalculatorOutputSchema
} from "../tools/capacity-calculator/capacity-calculator.schema";
import { ToolsService } from "../tools/tools.service";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { CreateDesignSessionDto } from "./dto/create-design-session.dto";
import { SubmitClarificationsDto } from "./dto/submit-clarifications.dto";
import { UpdateDesignSessionDto } from "./dto/update-design-session.dto";
import {
  RequirementAnalysis,
  StoredClarificationAnswer,
  requirementAnalysisSchema,
  storedClarificationAnswersSchema
} from "./requirement-analysis.schema";
import {
  GeneratedSystemDesign,
  RetrievedSourceReference,
  generatedSystemDesignSchema
} from "./system-design.schema";

interface RequirementsResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  analysis: RequirementAnalysis | null;
  clarificationAnswers: StoredClarificationAnswer[];
  analyzedAt: Date | null;
}

interface CapacityResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  calculation: CapacityCalculatorOutput | null;
  calculatedAt: Date | null;
}

interface GeneratedDesignResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  design: GeneratedSystemDesign | null;
  generatedAt: Date | null;
}

const MAX_CLARIFICATION_QUESTIONS = 3;

@Injectable()
export class DesignSessionsService {
  private readonly logger = new Logger(DesignSessionsService.name);

  constructor(
    private readonly designSessionsRepository: DesignSessionsRepository,
    private readonly projectsService: ProjectsService,
    private readonly aiService: AiService,
    private readonly toolsService: ToolsService,
    private readonly retrievalService: RetrievalService
  ) {}

  async createDesignSession(
    projectId: string,
    data: CreateDesignSessionDto,
    ownerId?: string
  ): Promise<DesignSession> {
    const project = await this.projectsService.getExistingProject(projectId, ownerId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ConflictErrorException(
        "PROJECT_ARCHIVED",
        "Archived projects cannot receive new design sessions",
        { projectId }
      );
    }

    return this.designSessionsRepository.create(projectId, data);
  }

  async listProjectDesignSessions(projectId: string, ownerId?: string): Promise<DesignSession[]> {
    await this.projectsService.getExistingProject(projectId, ownerId);
    return this.designSessionsRepository.findManyByProject(projectId);
  }

  async getDesignSession(id: string, ownerId?: string): Promise<DesignSession> {
    return this.getExistingDesignSession(id, ownerId);
  }

  async updateDesignSession(
    id: string,
    data: UpdateDesignSessionDto,
    ownerId?: string
  ): Promise<DesignSession> {
    const session = await this.getExistingDesignSession(id, ownerId);

    if (session.status !== DesignSessionStatus.DRAFT) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_NOT_EDITABLE",
        "Only draft design sessions can be edited",
        { designSessionId: id, status: session.status }
      );
    }

    return this.designSessionsRepository.update(id, data);
  }

  async deleteDesignSession(id: string, ownerId?: string): Promise<DesignSession> {
    const session = await this.getExistingDesignSession(id, ownerId);

    if (
      session.status !== DesignSessionStatus.DRAFT &&
      session.status !== DesignSessionStatus.FAILED
    ) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_NOT_DELETABLE",
        "Only draft or failed design sessions can be deleted",
        { designSessionId: id, status: session.status }
      );
    }

    return this.designSessionsRepository.delete(id);
  }

  async analyzeRequirements(id: string, ownerId?: string): Promise<RequirementsResponse> {
    const existingSession = await this.getExistingDesignSession(id, ownerId);

    if (
      existingSession.status === DesignSessionStatus.FAILED &&
      existingSession.requirementAnalysis
    ) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_REQUIREMENTS_NOT_ANALYZABLE",
        "Only draft sessions or failed sessions without requirement analysis can be analyzed",
        { designSessionId: id, status: existingSession.status }
      );
    }

    const session = await this.beginRequirementAnalysis(id, [
      DesignSessionStatus.DRAFT,
      DesignSessionStatus.FAILED
    ]);

    return this.runRequirementAnalysis(session, []);
  }

  async getRequirements(id: string, ownerId?: string): Promise<RequirementsResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    return {
      designSessionId: session.id,
      status: session.status,
      analysis: this.parseStoredRequirementAnalysis(session.requirementAnalysis),
      clarificationAnswers: this.parseStoredClarificationAnswers(session.clarificationAnswers),
      analyzedAt: session.requirementsAnalyzedAt
    };
  }

  async submitClarifications(
    id: string,
    data: SubmitClarificationsDto,
    ownerId?: string
  ): Promise<RequirementsResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    if (session.status !== DesignSessionStatus.REQUIREMENTS_PENDING) {
      throw new ConflictErrorException(
        "CLARIFICATIONS_NOT_ACCEPTED",
        "Clarifications can only be submitted for sessions pending requirements clarification",
        { designSessionId: id, status: session.status }
      );
    }

    const analysis = this.parseStoredRequirementAnalysis(session.requirementAnalysis);

    if (!analysis) {
      throw new ConflictErrorException(
        "REQUIREMENTS_NOT_ANALYZED",
        "Requirement analysis must exist before clarification answers can be submitted",
        { designSessionId: id }
      );
    }

    const mergedAnswers = this.mergeClarificationAnswers(
      analysis,
      this.parseStoredClarificationAnswers(session.clarificationAnswers),
      data
    );
    const claimedSession = await this.beginRequirementAnalysis(
      id,
      DesignSessionStatus.REQUIREMENTS_PENDING,
      mergedAnswers
    );

    return this.runRequirementAnalysis(claimedSession, mergedAnswers);
  }

  async calculateCapacity(
    id: string,
    overrides: unknown,
    ownerId?: string
  ): Promise<CapacityResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    if (session.status !== DesignSessionStatus.READY_FOR_DESIGN) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_CAPACITY_NOT_CALCULABLE",
        "Only sessions ready for design can run capacity calculation",
        { designSessionId: id, status: session.status }
      );
    }

    const analysis = this.parseStoredRequirementAnalysis(session.requirementAnalysis);
    const input = {
      ...this.buildCapacityDefaults(analysis),
      ...this.normalizeCapacityOverrides(overrides)
    };
    const calculation = await this.toolsService.calculateCapacity(input);
    const updatedSession = await this.designSessionsRepository.saveCapacityCalculation(
      id,
      calculation
    );

    return {
      designSessionId: updatedSession.id,
      status: updatedSession.status,
      calculation,
      calculatedAt: updatedSession.capacityCalculatedAt
    };
  }

  async getCapacity(id: string, ownerId?: string): Promise<CapacityResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    return {
      designSessionId: session.id,
      status: session.status,
      calculation: this.parseStoredCapacityCalculation(session.capacityCalculation),
      calculatedAt: session.capacityCalculatedAt
    };
  }

  async generateDesign(id: string, ownerId?: string): Promise<GeneratedDesignResponse> {
    const existingSession = await this.getExistingDesignSession(id, ownerId);

    this.assertDesignGenerationAllowed(existingSession);

    const analysis = this.requireStoredRequirementAnalysis(existingSession);
    const capacityCalculation = this.requireStoredCapacityCalculation(existingSession);
    const clarificationAnswers = this.parseStoredClarificationAnswers(
      existingSession.clarificationAnswers
    );
    const session = await this.beginDesignGeneration(id);

    try {
      const retrievalQuery = this.buildDesignRetrievalQuery(session, analysis);
      const retrievalResponse = await this.retrievalService.search({
        query: retrievalQuery,
        topK: 5
      });
      const retrievedSourceReferences = this.buildRetrievedSourceReferences(
        retrievalResponse.results
      );

      this.logger.log({
        event: "design_generation_started",
        designSessionId: session.id,
        requirementCount:
          analysis.functionalRequirements.length + analysis.nonFunctionalRequirements.length,
        clarificationAnswerCount: clarificationAnswers.length,
        retrievedSourceCount: retrievalResponse.results.length
      });

      const design = await this.aiService.generateStructured({
        operation: "system_design.generation",
        systemInstruction: this.buildDesignGenerationSystemInstruction(),
        prompt: this.buildDesignGenerationPrompt({
          session,
          analysis,
          clarificationAnswers,
          capacityCalculation,
          retrievedKnowledge: retrievalResponse.results,
          retrievedSourceReferences
        }),
        schema: generatedSystemDesignSchema,
        modelClass: "reasoning",
        temperature: 0.2
      });
      const updatedSession = await this.designSessionsRepository.saveGeneratedDesign(
        session.id,
        design
      );

      this.logger.log({
        event: "design_generation_completed",
        designSessionId: session.id,
        componentCount: design.majorComponents.length,
        sourceReferenceCount: design.retrievedSourceReferences.length
      });

      return {
        designSessionId: updatedSession.id,
        status: updatedSession.status,
        design,
        generatedAt: updatedSession.designGeneratedAt
      };
    } catch (error: unknown) {
      if (this.shouldUseQuickCreateFallback(existingSession)) {
        const design = this.buildFallbackGeneratedDesign(session, analysis, capacityCalculation);
        const updatedSession = await this.designSessionsRepository.saveGeneratedDesign(
          session.id,
          design
        );

        this.logger.warn({
          event: "design_generation_fallback_used",
          designSessionId: session.id,
          reason: error instanceof Error ? error.name : "UnknownError"
        });

        return {
          designSessionId: updatedSession.id,
          status: updatedSession.status,
          design,
          generatedAt: updatedSession.designGeneratedAt
        };
      }

      await this.storeDesignGenerationFailure(session.id, error);

      throw new ServiceUnavailableException({
        code: "DESIGN_GENERATION_FAILED",
        message: "System design generation failed",
        details: {
          designSessionId: session.id
        }
      });
    }
  }

  async getDesign(id: string, ownerId?: string): Promise<GeneratedDesignResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    return {
      designSessionId: session.id,
      status: session.status,
      design: this.parseStoredGeneratedDesign(session.generatedDesign),
      generatedAt: session.designGeneratedAt
    };
  }

  private async getExistingDesignSession(id: string, ownerId?: string): Promise<DesignSession> {
    const session = await this.designSessionsRepository.findById(id, ownerId);

    if (!session) {
      throw new NotFoundErrorException("DESIGN_SESSION_NOT_FOUND", "Design session not found", {
        designSessionId: id
      });
    }

    return session;
  }

  private async beginRequirementAnalysis(
    id: string,
    expectedStatus: DesignSessionStatus | DesignSessionStatus[],
    clarificationAnswers?: StoredClarificationAnswer[]
  ): Promise<DesignSession> {
    const session = await this.designSessionsRepository.beginRequirementAnalysis(
      id,
      expectedStatus,
      clarificationAnswers
    );

    if (session) {
      return session;
    }

    const existingSession = await this.getExistingDesignSession(id);

    if (
      existingSession.status === DesignSessionStatus.GENERATING &&
      existingSession.currentStep === "requirements_analysis"
    ) {
      throw new ConflictErrorException(
        "REQUIREMENT_ANALYSIS_IN_PROGRESS",
        "Requirement analysis is already in progress for this design session",
        { designSessionId: id }
      );
    }

    if (this.isInitialRequirementAnalysisClaim(expectedStatus)) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_REQUIREMENTS_NOT_ANALYZABLE",
        "Only draft sessions or failed sessions without requirement analysis can be analyzed",
        { designSessionId: id, status: existingSession.status }
      );
    }

    throw new ConflictErrorException(
      "CLARIFICATIONS_NOT_ACCEPTED",
      "Clarifications can only be submitted for sessions pending requirements clarification",
      { designSessionId: id, status: existingSession.status }
    );
  }

  private isInitialRequirementAnalysisClaim(
    expectedStatus: DesignSessionStatus | DesignSessionStatus[]
  ): boolean {
    return Array.isArray(expectedStatus)
      ? expectedStatus.includes(DesignSessionStatus.DRAFT)
      : expectedStatus === DesignSessionStatus.DRAFT;
  }

  private async beginDesignGeneration(id: string): Promise<DesignSession> {
    const session = await this.designSessionsRepository.beginDesignGeneration(id);

    if (session) {
      return session;
    }

    const existingSession = await this.getExistingDesignSession(id);

    if (
      existingSession.status === DesignSessionStatus.GENERATING &&
      existingSession.currentStep === "design_generation"
    ) {
      throw new ConflictErrorException(
        "DESIGN_GENERATION_IN_PROGRESS",
        "System design generation is already in progress for this design session",
        { designSessionId: id }
      );
    }

    throw new ConflictErrorException(
      "DESIGN_SESSION_NOT_GENERATABLE",
      "Only sessions ready for design or failed sessions can generate a system design",
      { designSessionId: id, status: existingSession.status }
    );
  }

  private async runRequirementAnalysis(
    session: DesignSession,
    clarificationAnswers: StoredClarificationAnswer[]
  ): Promise<RequirementsResponse> {
    try {
      this.logger.log({
        event: "requirements_analysis_started",
        designSessionId: session.id,
        problemStatementLength: session.problemStatement.length,
        clarificationAnswerCount: clarificationAnswers.length
      });

      const generatedAnalysis = await this.aiService.generateStructured({
        operation: "requirements.analysis",
        systemInstruction: this.buildRequirementAnalysisSystemInstruction(),
        prompt: this.buildRequirementAnalysisPrompt(session, clarificationAnswers),
        schema: requirementAnalysisSchema,
        modelClass: "reasoning",
        temperature: 0.2
      });
      const analysis = this.limitClarificationQuestions(generatedAnalysis);
      const nextStatus = this.requiresClarification(analysis)
        ? DesignSessionStatus.REQUIREMENTS_PENDING
        : DesignSessionStatus.READY_FOR_DESIGN;
      const updatedSession = await this.designSessionsRepository.saveRequirementAnalysis(
        session.id,
        analysis,
        nextStatus
      );

      this.logger.log({
        event: "requirements_analysis_completed",
        designSessionId: session.id,
        nextStatus,
        functionalRequirementCount: analysis.functionalRequirements.length,
        nonFunctionalRequirementCount: analysis.nonFunctionalRequirements.length,
        clarificationQuestionCount: analysis.clarificationQuestions.length,
        missingInformationCount: analysis.missingInformation.length
      });

      return {
        designSessionId: updatedSession.id,
        status: updatedSession.status,
        analysis,
        clarificationAnswers,
        analyzedAt: updatedSession.requirementsAnalyzedAt
      };
    } catch (error: unknown) {
      if (this.shouldUseQuickCreateFallback(session)) {
        const analysis = this.buildFallbackRequirementAnalysis(session);
        const updatedSession = await this.designSessionsRepository.saveRequirementAnalysis(
          session.id,
          analysis,
          DesignSessionStatus.READY_FOR_DESIGN
        );

        this.logger.warn({
          event: "requirements_analysis_fallback_used",
          designSessionId: session.id,
          reason: error instanceof Error ? error.name : "UnknownError"
        });

        return {
          designSessionId: updatedSession.id,
          status: updatedSession.status,
          analysis,
          clarificationAnswers,
          analyzedAt: updatedSession.requirementsAnalyzedAt
        };
      }

      await this.storeRequirementAnalysisFailure(session.id, error);

      throw new ServiceUnavailableException({
        code: "REQUIREMENT_ANALYSIS_FAILED",
        message: "Requirement analysis failed",
        details: {
          designSessionId: session.id
        }
      });
    }
  }

  private buildRequirementAnalysisSystemInstruction(): string {
    return [
      "You analyze software system design problem statements.",
      "Return only structured data matching the provided schema.",
      "Do not invent precise scale numbers when the prompt does not provide enough evidence.",
      "Prefer reasonable assumptions over clarification questions for details that do not materially change the architecture.",
      "If the problem statement explicitly asks to generate immediately or avoid clarification questions, choose reasonable defaults and list them as assumptions instead of asking follow-up questions.",
      "Ask zero to three clarification questions only for missing details that materially affect design decisions.",
      "Each clarification question should be answerable by selecting one of two to four concise options.",
      "When asking a clarification question, include practical answer options in the options field."
    ].join(" ");
  }

  private buildRequirementAnalysisPrompt(
    session: DesignSession,
    clarificationAnswers: StoredClarificationAnswer[]
  ): string {
    return JSON.stringify({
      title: session.title,
      problemStatement: session.problemStatement,
      clarificationAnswers
    });
  }

  private shouldUseQuickCreateFallback(session: DesignSession): boolean {
    return /Requirement behavior: do not ask clarification questions/i.test(session.problemStatement);
  }

  private buildFallbackRequirementAnalysis(session: DesignSession): RequirementAnalysis {
    const template = this.extractQuickCreateValue(session.problemStatement, "Starting point");
    const scale = this.extractQuickCreateValue(session.problemStatement, "Expected scale") ?? "Medium";
    const priority =
      this.extractQuickCreateValue(session.problemStatement, "Design priority") ?? "Reliability";
    const domain = this.extractQuickCreateValue(session.problemStatement, "Product domain") ?? "Enterprise";
    const summary = this.extractProblemSummary(session.problemStatement, template ?? session.title);
    const lowerSummary = `${summary} ${template ?? ""}`.toLowerCase();
    const isMonitoring = /monitor|metric|observability|alert|dashboard|telemetry/.test(lowerSummary);
    const isPayment = /payment|checkout|ledger|invoice|razorpay|stripe/.test(lowerSummary);
    const isNotification = /notification|email|sms|push|fanout/.test(lowerSummary);
    const isUrlShortener = /url|short|redirect|link/.test(lowerSummary);

    return {
      productSummary: summary,
      functionalRequirements: this.buildFallbackFunctionalRequirements({
        isMonitoring,
        isPayment,
        isNotification,
        isUrlShortener
      }),
      nonFunctionalRequirements: [
        {
          id: "NFR-1",
          category: "Reliability",
          requirement: `Prioritize ${priority.toLowerCase()} with graceful degradation and clear failure handling.`,
          target: priority.toLowerCase() === "reliability" ? "99.9% availability baseline" : null
        },
        {
          id: "NFR-2",
          category: "Scalability",
          requirement: `Support ${scale.toLowerCase()} scale with room for horizontal growth.`,
          target: null
        },
        {
          id: "NFR-3",
          category: "Security",
          requirement: `Protect ${domain.toLowerCase()} workflows with authentication, authorization, and audit trails.`,
          target: null
        }
      ],
      assumptions: [
        "Helix used deterministic defaults because quick-create requested immediate generation.",
        `Starting template: ${template ?? "Custom system"}.`,
        `Expected scale: ${scale}.`,
        `Design priority: ${priority}.`,
        `Product domain: ${domain}.`
      ],
      scaleInputs: {
        expectedUsers: this.scaleToExpectedUsers(scale),
        requestRate: this.scaleToRequestRate(scale),
        storage: this.scaleToStorage(scale, isMonitoring),
        regions: scale.toLowerCase() === "global" ? "Multi-region" : "Single region with multi-AZ",
        availabilityTarget: priority.toLowerCase() === "reliability" ? "99.9%" : "99.5%",
        latencyTarget: priority.toLowerCase() === "speed" ? "p95 under 300ms" : "p95 under 1 second",
        notes: ["Generated from quick-create defaults."]
      },
      constraints: ["Exact traffic, retention, and compliance requirements can be refined later."],
      missingInformation: [],
      clarificationQuestions: []
    };
  }

  private buildFallbackFunctionalRequirements(input: {
    isMonitoring: boolean;
    isPayment: boolean;
    isNotification: boolean;
    isUrlShortener: boolean;
  }): RequirementAnalysis["functionalRequirements"] {
    if (input.isMonitoring) {
      return [
        {
          id: "FR-1",
          requirement: "Ingest telemetry from services, agents, and external producers.",
          priority: "MUST"
        },
        {
          id: "FR-2",
          requirement: "Store and query time-series data for dashboards and investigations.",
          priority: "MUST"
        },
        {
          id: "FR-3",
          requirement: "Evaluate alerts and route notifications to operators.",
          priority: "SHOULD"
        }
      ];
    }

    if (input.isPayment) {
      return [
        {
          id: "FR-1",
          requirement: "Create payment orders and verify provider callbacks idempotently.",
          priority: "MUST"
        },
        {
          id: "FR-2",
          requirement: "Maintain durable transaction state for reconciliation and refunds.",
          priority: "MUST"
        },
        {
          id: "FR-3",
          requirement: "Expose operational views for payment failures and settlement status.",
          priority: "SHOULD"
        }
      ];
    }

    if (input.isNotification) {
      return [
        {
          id: "FR-1",
          requirement: "Accept notification requests and validate recipient preferences.",
          priority: "MUST"
        },
        {
          id: "FR-2",
          requirement: "Fan out delivery jobs across channels with retry and backoff.",
          priority: "MUST"
        },
        {
          id: "FR-3",
          requirement: "Track delivery status, failures, and provider responses.",
          priority: "SHOULD"
        }
      ];
    }

    if (input.isUrlShortener) {
      return [
        {
          id: "FR-1",
          requirement: "Create short links and resolve redirects with low latency.",
          priority: "MUST"
        },
        {
          id: "FR-2",
          requirement: "Track link analytics and abuse signals.",
          priority: "SHOULD"
        },
        {
          id: "FR-3",
          requirement: "Support link expiry, ownership, and metadata updates.",
          priority: "SHOULD"
        }
      ];
    }

    return [
      {
        id: "FR-1",
        requirement: "Expose the core user workflow through a reliable API surface.",
        priority: "MUST"
      },
      {
        id: "FR-2",
        requirement: "Persist business state with clear ownership and consistency boundaries.",
        priority: "MUST"
      },
      {
        id: "FR-3",
        requirement: "Provide operational visibility into health, failures, and usage.",
        priority: "SHOULD"
      }
    ];
  }

  private extractQuickCreateValue(problemStatement: string, label: string): string | null {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`- ${escapedLabel}:\\s*(.+)`, "i").exec(problemStatement);
    return match?.[1]?.trim() ?? null;
  }

  private extractProblemSummary(problemStatement: string, fallback: string): string {
    const firstParagraph = problemStatement.split("Helix quick design setup:")[0]?.trim();

    if (firstParagraph) {
      return firstParagraph;
    }

    return `A practical ${fallback.toLowerCase()} architecture generated from quick-create defaults.`;
  }

  private scaleToExpectedUsers(scale: string): string {
    if (/small/i.test(scale)) return "10,000 monthly active users";
    if (/large/i.test(scale)) return "1,000,000 monthly active users";
    if (/global/i.test(scale)) return "5,000,000 monthly active users";
    return "100,000 monthly active users";
  }

  private scaleToRequestRate(scale: string): string {
    if (/small/i.test(scale)) return "12 requests per active user per day";
    if (/large/i.test(scale)) return "60 requests per active user per day";
    if (/global/i.test(scale)) return "100 requests per active user per day";
    return "30 requests per active user per day";
  }

  private scaleToStorage(scale: string, isMonitoring: boolean): string {
    if (isMonitoring) {
      if (/small/i.test(scale)) return "30 days retention, 100 MB per active source per month";
      if (/large|global/i.test(scale)) return "90 days retention, 1 GB per active source per month";
      return "60 days retention, 500 MB per active source per month";
    }

    if (/small/i.test(scale)) return "30 days retention, 5 KB per active user";
    if (/large|global/i.test(scale)) return "180 days retention, 25 KB per active user";
    return "90 days retention, 10 KB per active user";
  }

  private requiresClarification(analysis: RequirementAnalysis): boolean {
    return analysis.clarificationQuestions.length > 0;
  }

  private limitClarificationQuestions(analysis: RequirementAnalysis): RequirementAnalysis {
    return {
      ...analysis,
      clarificationQuestions: analysis.clarificationQuestions.slice(0, MAX_CLARIFICATION_QUESTIONS)
    };
  }

  private async storeRequirementAnalysisFailure(id: string, error: unknown): Promise<void> {
    const failureCode =
      error instanceof AiProviderException ? error.code : "REQUIREMENT_ANALYSIS_FAILED";
    const failureMessage =
      error instanceof AiProviderException
        ? "AI provider failed while analyzing requirements"
        : "Requirement analysis failed";

    this.logger.warn({
      event: "requirements_analysis_failed",
      designSessionId: id,
      failureCode
    });

    await this.designSessionsRepository.saveRequirementAnalysisFailure(
      id,
      failureCode,
      failureMessage
    );
  }

  private assertDesignGenerationAllowed(session: DesignSession): void {
    if (
      session.status === DesignSessionStatus.GENERATING &&
      session.currentStep === "design_generation"
    ) {
      throw new ConflictErrorException(
        "DESIGN_GENERATION_IN_PROGRESS",
        "System design generation is already in progress for this design session",
        { designSessionId: session.id }
      );
    }

    if (
      session.status !== DesignSessionStatus.READY_FOR_DESIGN &&
      session.status !== DesignSessionStatus.FAILED
    ) {
      throw new ConflictErrorException(
        "DESIGN_SESSION_NOT_GENERATABLE",
        "Only sessions ready for design or failed sessions can generate a system design",
        { designSessionId: session.id, status: session.status }
      );
    }
  }

  private requireStoredRequirementAnalysis(session: DesignSession): RequirementAnalysis {
    const analysis = this.parseStoredRequirementAnalysis(session.requirementAnalysis);

    if (!analysis) {
      throw new ConflictErrorException(
        "REQUIREMENTS_NOT_ANALYZED",
        "Requirement analysis must exist before system design generation",
        { designSessionId: session.id }
      );
    }

    return analysis;
  }

  private requireStoredCapacityCalculation(session: DesignSession): CapacityCalculatorOutput {
    const calculation = this.parseStoredCapacityCalculation(session.capacityCalculation);

    if (!calculation) {
      throw new ConflictErrorException(
        "CAPACITY_NOT_CALCULATED",
        "Capacity calculation must exist before system design generation",
        { designSessionId: session.id }
      );
    }

    return calculation;
  }

  private async storeDesignGenerationFailure(id: string, error: unknown): Promise<void> {
    const failureCode =
      error instanceof AiProviderException ? error.code : "DESIGN_GENERATION_FAILED";
    const failureMessage =
      error instanceof AiProviderException
        ? "AI provider failed while generating the system design"
        : "System design generation failed";

    this.logger.warn({
      event: "design_generation_failed",
      designSessionId: id,
      failureCode
    });

    await this.designSessionsRepository.saveDesignGenerationFailure(
      id,
      failureCode,
      failureMessage
    );
  }

  private buildFallbackGeneratedDesign(
    session: DesignSession,
    analysis: RequirementAnalysis,
    capacityCalculation: CapacityCalculatorOutput
  ): GeneratedSystemDesign {
    const template =
      this.extractQuickCreateValue(session.problemStatement, "Starting point") ?? session.title;
    const scale = this.extractQuickCreateValue(session.problemStatement, "Expected scale") ?? "Medium";
    const priority =
      this.extractQuickCreateValue(session.problemStatement, "Design priority") ?? "Reliability";
    const domain =
      this.extractQuickCreateValue(session.problemStatement, "Product domain") ?? "Enterprise";
    const normalizedContext = `${analysis.productSummary} ${template}`.toLowerCase();
    const isMonitoring = /monitor|metric|observability|alert|dashboard|telemetry/.test(
      normalizedContext
    );
    const isPayment = /payment|checkout|ledger|invoice|razorpay|stripe/.test(normalizedContext);
    const isNotification = /notification|email|sms|push|fanout/.test(normalizedContext);
    const isUrlShortener = /url|short|redirect|link/.test(normalizedContext);
    const peakQps = capacityCalculation.results.peakRequestsPerSecond.display;
    const storage = capacityCalculation.results.retainedStorageEstimate.display;

    return {
      architectureSummary: [
        `Helix generated a practical ${template.toLowerCase()} architecture using deterministic defaults because the AI design provider was unavailable.`,
        `The design targets ${scale.toLowerCase()} scale, prioritizes ${priority.toLowerCase()}, and assumes a ${domain.toLowerCase()} operating model.`,
        `Capacity baseline: ${peakQps} peak requests per second and ${storage} retained storage estimate.`
      ].join(" "),
      majorComponents: this.buildFallbackComponents({
        isMonitoring,
        isPayment,
        isNotification,
        isUrlShortener
      }),
      apiRecommendations: [
        {
          name: "Public API Gateway",
          recommendation:
            "Expose a versioned API boundary for client, service, and integration traffic with authentication, request validation, and rate limits.",
          reasoning:
            "A stable edge contract keeps internal services independent while protecting expensive downstream paths."
        },
        {
          name: "Internal Service APIs",
          recommendation:
            "Use typed internal APIs between core services and workers, with idempotency keys for mutating operations.",
          reasoning:
            "Typed contracts and idempotency make retries safer during provider, queue, or network failures."
        }
      ],
      databaseChoices: [
        {
          name: this.fallbackPrimaryStoreName({ isMonitoring, isPayment, isUrlShortener }),
          recommendation:
            "Use a durable primary data store for the system of record, partitioned around the highest-volume access path.",
          reasoning:
            "The generated requirements need a clear ownership boundary for reads, writes, recovery, and audits."
        }
      ],
      cachingStrategy: [
        {
          name: "Hot-path cache",
          recommendation:
            "Cache frequently read objects and computed views with explicit TTLs and cache-invalidation ownership.",
          reasoning:
            "A cache protects the primary store and keeps user-facing read latency predictable under traffic spikes."
        }
      ],
      messagingAndAsyncProcessing: [
        {
          name: "Durable async queue",
          recommendation:
            "Buffer non-critical and high-volume work through a durable queue with retries, dead-letter handling, and replay tooling.",
          reasoning:
            "Async buffering decouples ingestion from processing and gives the system time to recover from downstream slowdown."
        }
      ],
      storageStrategy: [
        {
          name: "Tiered object storage",
          recommendation:
            "Move historical artifacts, logs, exports, or retained records into cheaper object storage tiers.",
          reasoning:
            "Tiering keeps retained storage manageable as usage grows beyond the initial capacity estimate."
        }
      ],
      scalabilityApproach: [
        {
          name: "Horizontal service scaling",
          description:
            "Run stateless API and worker services behind autoscaling policies driven by QPS, CPU, and queue depth."
        },
        {
          name: "Partitioned data paths",
          description:
            "Partition high-volume data by tenant, workspace, entity, or time range depending on the dominant query pattern."
        }
      ],
      reliabilityAndFailureHandling: [
        {
          name: "Graceful degradation",
          description:
            "Serve cached reads where possible and shed low-priority work when downstream systems are degraded."
        },
        {
          name: "Retry and dead-letter policy",
          description:
            "Use bounded retries with jitter, idempotency keys, and dead-letter queues for manual or automated replay."
        }
      ],
      security: [
        {
          name: "Auth at the edge",
          description:
            "Authenticate every external request and enforce authorization before executing business logic."
        },
        {
          name: "Audit trail",
          description:
            "Record sensitive state transitions and administrative actions with actor, timestamp, and request context."
        }
      ],
      observability: [
        {
          name: "Service health dashboard",
          description:
            "Track request rate, latency percentiles, error rate, saturation, queue depth, and dependency health."
        },
        {
          name: "Incident alerts",
          description:
            "Alert on user-visible errors, SLO burn, backlog growth, failed jobs, and database latency."
        }
      ],
      deploymentApproach: [
        {
          name: "Containerized services",
          description:
            "Deploy APIs, workers, and scheduled jobs separately so each can scale and roll back independently."
        },
        {
          name: "Progressive rollout",
          description:
            "Use health checks, canaries, and automated rollback for risky service or schema changes."
        }
      ],
      technologyChoices: [
        {
          category: "API",
          choice: "REST or GraphQL API gateway",
          reasoning:
            "Provides a clear external integration layer and allows internal services to evolve.",
          alternativesConsidered: ["Direct service exposure", "gRPC-only edge"]
        },
        {
          category: "Async processing",
          choice: "Queue-backed workers",
          reasoning: "Protects core workflows from downstream spikes and provider failures.",
          alternativesConsidered: ["Synchronous fanout", "Cron-only batch processing"]
        },
        {
          category: "Data",
          choice: this.fallbackPrimaryStoreName({ isMonitoring, isPayment, isUrlShortener }),
          reasoning: "Matches the most important persistence pattern inferred from the project template.",
          alternativesConsidered: ["Single generic document store", "In-memory-only state"]
        }
      ],
      assumptions: [
        ...analysis.assumptions,
        "Fallback design was generated deterministically because the AI design provider failed.",
        `Peak traffic baseline: ${peakQps}.`,
        `Retained storage baseline: ${storage}.`
      ],
      tradeOffs: [
        {
          name: "Practical default over bespoke optimization",
          description:
            "The fallback favors proven architecture patterns and may need refinement once exact traffic and compliance targets are known."
        },
        {
          name: "Async resilience adds operational work",
          description:
            "Queues improve reliability but require backlog monitoring, replay tooling, and dead-letter ownership."
        }
      ],
      risks: [
        {
          name: "Unvalidated scale assumptions",
          description:
            "Capacity numbers are based on quick-create defaults and should be replaced with product-specific traffic data."
        },
        {
          name: "Hot partition risk",
          description:
            "A small number of tenants, users, dashboards, or entities may dominate load without careful partitioning."
        }
      ],
      retrievedSourceReferences: []
    };
  }

  private buildFallbackComponents(input: {
    isMonitoring: boolean;
    isPayment: boolean;
    isNotification: boolean;
    isUrlShortener: boolean;
  }): GeneratedSystemDesign["majorComponents"] {
    if (input.isMonitoring) {
      return [
        {
          name: "Ingestion Gateway",
          responsibilities: ["Accept telemetry writes", "Authenticate producers", "Apply rate limits"]
        },
        {
          name: "Telemetry Buffer",
          responsibilities: ["Absorb ingest spikes", "Persist events for replay"]
        },
        {
          name: "Stream Processing Workers",
          responsibilities: ["Aggregate metrics", "Evaluate alert windows", "Prepare rollups"]
        },
        {
          name: "Time-Series Store",
          responsibilities: ["Store metrics by time and label", "Serve range queries"]
        },
        {
          name: "Dashboard Query API",
          responsibilities: ["Read cached query results", "Serve dashboard panels"]
        },
        {
          name: "Alert Manager",
          responsibilities: ["Route notifications", "Deduplicate alert instances"]
        }
      ];
    }

    if (input.isPayment) {
      return [
        {
          name: "Checkout API",
          responsibilities: ["Create payment orders", "Validate checkout sessions"]
        },
        {
          name: "Payment Provider Adapter",
          responsibilities: ["Call external payment providers", "Normalize provider responses"]
        },
        {
          name: "Webhook Processor",
          responsibilities: ["Verify callbacks", "Apply idempotent state transitions"]
        },
        {
          name: "Ledger Service",
          responsibilities: ["Persist transaction records", "Support reconciliation"]
        },
        {
          name: "Risk and Audit Service",
          responsibilities: ["Track suspicious activity", "Store auditable events"]
        }
      ];
    }

    if (input.isNotification) {
      return [
        {
          name: "Notification API",
          responsibilities: [
            "Accept notification requests",
            "Validate sender and recipient policy"
          ]
        },
        {
          name: "Preference Service",
          responsibilities: ["Resolve user preferences", "Apply quiet hours and opt-outs"]
        },
        {
          name: "Fanout Queue",
          responsibilities: ["Buffer channel jobs", "Enable retry and replay"]
        },
        {
          name: "Delivery Workers",
          responsibilities: ["Send channel messages", "Handle provider failures"]
        },
        {
          name: "Delivery Tracker",
          responsibilities: ["Store delivery state", "Expose analytics and failure reasons"]
        }
      ];
    }

    if (input.isUrlShortener) {
      return [
        {
          name: "Link Management API",
          responsibilities: ["Create short links", "Manage expiry and ownership"]
        },
        {
          name: "Redirect Edge Service",
          responsibilities: ["Resolve short codes", "Return low-latency redirects"]
        },
        {
          name: "Abuse Detection Service",
          responsibilities: ["Score suspicious links", "Block unsafe destinations"]
        },
        {
          name: "Analytics Pipeline",
          responsibilities: ["Capture click events", "Aggregate reporting views"]
        },
        {
          name: "Link Metadata Store",
          responsibilities: ["Persist link records", "Serve redirect lookups"]
        }
      ];
    }

    return [
      {
        name: "API Gateway",
        responsibilities: ["Accept external requests", "Authenticate clients", "Route traffic"]
      },
      {
        name: "Application Service",
        responsibilities: ["Execute core workflow", "Own business rules"]
      },
      {
        name: "Worker Service",
        responsibilities: ["Process asynchronous jobs", "Handle retries"]
      },
      {
        name: "Primary Data Store",
        responsibilities: ["Persist business state", "Serve transactional reads"]
      },
      {
        name: "Operations Layer",
        responsibilities: ["Expose health metrics", "Support alerts and runbooks"]
      }
    ];
  }

  private fallbackPrimaryStoreName(input: {
    isMonitoring: boolean;
    isPayment: boolean;
    isUrlShortener: boolean;
  }): string {
    if (input.isMonitoring) return "Time-series database";
    if (input.isPayment) return "Transactional ledger database";
    if (input.isUrlShortener) return "Key-value metadata store";
    return "Primary relational database";
  }

  private buildDesignRetrievalQuery(session: DesignSession, analysis: RequirementAnalysis): string {
    const functionalRequirements = analysis.functionalRequirements
      .map((requirement) => requirement.requirement)
      .join(" ");
    const nonFunctionalRequirements = analysis.nonFunctionalRequirements
      .map((requirement) => `${requirement.category}: ${requirement.requirement}`)
      .join(" ");

    return [
      session.problemStatement,
      analysis.productSummary,
      functionalRequirements,
      nonFunctionalRequirements,
      analysis.constraints.join(" ")
    ]
      .filter((part) => part.length > 0)
      .join("\n");
  }

  private buildRetrievedSourceReferences(
    results: RetrievalSearchResult[]
  ): RetrievedSourceReference[] {
    return results.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      sourceUrl: result.sourceUrl,
      similarity: result.similarity,
      usedFor: "Retrieved context for system design generation"
    }));
  }

  private buildDesignGenerationSystemInstruction(): string {
    return [
      "You generate practical software system designs from structured requirements.",
      "Return only structured data matching the provided schema.",
      "Use retrieved knowledge only as supporting context, and reference the retrieved source chunks you used.",
      "Do not include Mermaid diagrams, final reports, chat follow-ups, or validation commentary.",
      "Make trade-offs and risks explicit."
    ].join(" ");
  }

  private buildDesignGenerationPrompt(input: {
    session: DesignSession;
    analysis: RequirementAnalysis;
    clarificationAnswers: StoredClarificationAnswer[];
    capacityCalculation: CapacityCalculatorOutput;
    retrievedKnowledge: RetrievalSearchResult[];
    retrievedSourceReferences: RetrievedSourceReference[];
  }): string {
    return JSON.stringify({
      title: input.session.title,
      problemStatement: input.session.problemStatement,
      requirementAnalysis: input.analysis,
      clarificationAnswers: input.clarificationAnswers,
      capacityCalculation: input.capacityCalculation,
      retrievedKnowledge: input.retrievedKnowledge.map((result) => ({
        chunkId: result.chunkId,
        documentId: result.documentId,
        documentTitle: result.documentTitle,
        sourceType: result.sourceType,
        sourceUrl: result.sourceUrl,
        similarity: result.similarity,
        metadata: result.metadata,
        content: result.content
      })),
      retrievedSourceReferences: input.retrievedSourceReferences
    });
  }

  private parseStoredRequirementAnalysis(value: unknown): RequirementAnalysis | null {
    if (value === null) {
      return null;
    }

    const result = requirementAnalysisSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private parseStoredClarificationAnswers(value: unknown): StoredClarificationAnswer[] {
    if (value === null) {
      return [];
    }

    const result = storedClarificationAnswersSchema.safeParse(value);
    return result.success ? result.data : [];
  }

  private parseStoredCapacityCalculation(value: unknown): CapacityCalculatorOutput | null {
    if (value === null) {
      return null;
    }

    const result = capacityCalculatorOutputSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private parseStoredGeneratedDesign(value: unknown): GeneratedSystemDesign | null {
    if (value === null) {
      return null;
    }

    const result = generatedSystemDesignSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private normalizeCapacityOverrides(overrides: unknown): Record<string, unknown> {
    if (overrides === undefined || overrides === null) {
      return {};
    }

    if (!isRecord(overrides)) {
      throw new BadRequestErrorException(
        "CAPACITY_OVERRIDES_INVALID",
        "Capacity calculation overrides must be an object"
      );
    }

    return overrides;
  }

  private buildCapacityDefaults(analysis: RequirementAnalysis | null): Record<string, unknown> {
    if (!analysis) {
      return {};
    }

    const defaults: Record<string, unknown> = {};
    const monthlyActiveUsers =
      this.parseNumberFromText(analysis.scaleInputs.expectedUsers) ??
      this.inferMonthlyActiveUsers(analysis.scaleInputs.expectedUsers);
    const requestsPerActiveUserPerDay = this.parseNumberFromText(analysis.scaleInputs.requestRate);
    const dataCreatedPerUserBytes = this.parseStorageBytesFromText(analysis.scaleInputs.storage);
    const retentionPeriodDays = this.parseRetentionDaysFromText(analysis.scaleInputs.storage);

    if (monthlyActiveUsers !== undefined) {
      defaults.monthlyActiveUsers = monthlyActiveUsers;
    }

    if (requestsPerActiveUserPerDay !== undefined) {
      defaults.requestsPerActiveUserPerDay = requestsPerActiveUserPerDay;
    }

    if (dataCreatedPerUserBytes !== undefined) {
      defaults.dataCreatedPerUserBytes = dataCreatedPerUserBytes;
    }

    if (retentionPeriodDays !== undefined) {
      defaults.retentionPeriodDays = retentionPeriodDays;
    }

    return defaults;
  }

  private inferMonthlyActiveUsers(value: string | null): number {
    if (!value) {
      return 100_000;
    }

    if (/large|high-scale|enterprise/i.test(value)) {
      return 1_000_000;
    }

    if (/small|prototype|pilot/i.test(value)) {
      return 10_000;
    }

    return 100_000;
  }

  private parseNumberFromText(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = /(\d[\d,]*(?:\.\d+)?)/.exec(value);

    if (!match) {
      return undefined;
    }

    const matchedNumber = match[1];

    if (!matchedNumber) {
      return undefined;
    }

    return Number(matchedNumber.replace(/,/g, ""));
  }

  private parseStorageBytesFromText(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = /(\d[\d,]*(?:\.\d+)?)\s*(bytes?|b|kb|mb|gb|tb)\b/i.exec(value);

    if (!match) {
      return undefined;
    }

    const matchedNumber = match[1];

    if (!matchedNumber) {
      return undefined;
    }

    const amount = Number(matchedNumber.replace(/,/g, ""));
    const unit = (match[2] ?? "bytes").toLowerCase();
    const multipliers: Record<string, number> = {
      byte: 1,
      bytes: 1,
      b: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4
    };

    return amount * (multipliers[unit] ?? 1);
  }

  private parseRetentionDaysFromText(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = /(\d[\d,]*(?:\.\d+)?)\s*(days?|weeks?|months?|years?)\b/i.exec(value);

    if (!match?.[1] || !match[2]) {
      return undefined;
    }

    const amount = Number(match[1].replace(/,/g, ""));
    const unit = match[2].toLowerCase();

    if (unit.startsWith("week")) {
      return amount * 7;
    }

    if (unit.startsWith("month")) {
      return amount * 30;
    }

    if (unit.startsWith("year")) {
      return amount * 365;
    }

    return amount;
  }

  private mergeClarificationAnswers(
    analysis: RequirementAnalysis,
    existingAnswers: StoredClarificationAnswer[],
    data: SubmitClarificationsDto
  ): StoredClarificationAnswer[] {
    const questionsById = new Map(
      analysis.clarificationQuestions.map((question) => [question.id, question.question])
    );
    const submittedQuestionIds = new Set<string>();
    const relevantAnswers = data.answers.filter((answer) => questionsById.has(answer.questionId));

    for (const answer of data.answers) {
      if (submittedQuestionIds.has(answer.questionId)) {
        throw new BadRequestErrorException(
          "DUPLICATE_CLARIFICATION_ANSWER",
          "Clarification answers must not contain duplicate question IDs",
          { questionId: answer.questionId }
        );
      }

      submittedQuestionIds.add(answer.questionId);
    }

    const answersById = new Map(existingAnswers.map((answer) => [answer.questionId, answer]));

    for (const answer of relevantAnswers) {
      const question = questionsById.get(answer.questionId);

      if (!question) {
        continue;
      }

      answersById.set(answer.questionId, {
        questionId: answer.questionId,
        question,
        answer: answer.answer,
        answeredAt: new Date().toISOString()
      });
    }

    for (const questionId of questionsById.keys()) {
      const submittedAnswer = relevantAnswers.find((answer) => answer.questionId === questionId);
      const existingAnswer = existingAnswers.find((answer) => answer.questionId === questionId);

      if (!submittedAnswer?.answer.trim() && !existingAnswer?.answer.trim()) {
        throw new BadRequestErrorException(
          "MISSING_CLARIFICATION_ANSWER",
          "Clarification answers are required for every pending question",
          { questionId }
        );
      }
    }

    return Array.from(answersById.values());
  }
}
