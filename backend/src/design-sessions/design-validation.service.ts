import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { DesignSession } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import {
  DesignValidationCategory,
  DesignValidationFinding,
  DesignValidationReview,
  PersistedDesignValidation,
  designValidationCategorySchema,
  designValidationReviewSchema,
  persistedDesignValidationSchema
} from "./design-validation.schema";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { DeterministicDesignValidatorService } from "./deterministic-design-validator.service";
import { RequirementAnalysis, requirementAnalysisSchema } from "./requirement-analysis.schema";
import { GeneratedSystemDesign, generatedSystemDesignSchema } from "./system-design.schema";

interface ValidationResponse {
  designSessionId: string;
  validation: PersistedDesignValidation | null;
  validatedAt: Date | null;
}

@Injectable()
export class DesignValidationService {
  private readonly logger = new Logger(DesignValidationService.name);

  constructor(
    private readonly designSessionsRepository: DesignSessionsRepository,
    private readonly deterministicValidator: DeterministicDesignValidatorService,
    private readonly aiService: AiService
  ) {}

  async validateDesign(id: string, ownerId?: string): Promise<ValidationResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);
    const design = this.requireGeneratedDesign(session);
    const requirements = this.requireRequirementAnalysis(session);
    const deterministicReview = this.deterministicValidator.validate({
      design,
      requirements
    });

    try {
      this.logger.log({
        event: "design_validation_started",
        designSessionId: session.id,
        deterministicScore: deterministicReview.overallScore
      });

      const aiReview = await this.aiService.generateStructured({
        operation: "design_validation.review",
        systemInstruction: this.buildValidationSystemInstruction(),
        prompt: this.buildValidationPrompt({
          design,
          requirements,
          deterministicReview
        }),
        schema: designValidationReviewSchema,
        modelClass: "reasoning",
        temperature: 0.1
      });
      const validation = this.mergeReviews(deterministicReview, aiReview);
      const updatedSession = await this.designSessionsRepository.saveDesignValidation(
        session.id,
        validation
      );

      this.logger.log({
        event: "design_validation_completed",
        designSessionId: session.id,
        overallScore: validation.overallScore,
        criticalIssueCount: validation.criticalIssues.length
      });

      return {
        designSessionId: updatedSession.id,
        validation,
        validatedAt: updatedSession.designValidatedAt
      };
    } catch (error: unknown) {
      if (error instanceof AiProviderException) {
        this.logger.warn({
          event: "design_validation_failed",
          designSessionId: session.id,
          failureCode: error.code
        });

        throw new ServiceUnavailableException({
          code: "DESIGN_VALIDATION_FAILED",
          message: "Design validation failed",
          details: {
            designSessionId: session.id
          }
        });
      }

      throw error;
    }
  }

  async getValidation(id: string, ownerId?: string): Promise<ValidationResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    return {
      designSessionId: session.id,
      validation: this.parseStoredValidation(session.designValidation),
      validatedAt: session.designValidatedAt
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

  private requireGeneratedDesign(session: DesignSession): GeneratedSystemDesign {
    const result = generatedSystemDesignSchema.safeParse(session.generatedDesign);

    if (!result.success) {
      throw new ConflictErrorException(
        "GENERATED_DESIGN_REQUIRED",
        "A completed generated design is required before validation",
        { designSessionId: session.id }
      );
    }

    return result.data;
  }

  private requireRequirementAnalysis(session: DesignSession): RequirementAnalysis {
    const result = requirementAnalysisSchema.safeParse(session.requirementAnalysis);

    if (!result.success) {
      throw new ConflictErrorException(
        "REQUIREMENTS_NOT_ANALYZED",
        "Requirement analysis is required before design validation",
        { designSessionId: session.id }
      );
    }

    return result.data;
  }

  private parseStoredValidation(value: unknown): PersistedDesignValidation | null {
    if (value === null) {
      return null;
    }

    const result = persistedDesignValidationSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private mergeReviews(
    deterministicReview: PersistedDesignValidation["deterministicReview"],
    aiReview: DesignValidationReview
  ): PersistedDesignValidation {
    const categoryScores = designValidationCategorySchema.options.map((category) => {
      const deterministicScore = this.findCategoryScore(deterministicReview, category);
      const aiScore = this.findCategoryScore(aiReview, category);
      const score = Math.round((deterministicScore.score + aiScore.score) / 2);

      return {
        category,
        score,
        summary: `${deterministicScore.summary} AI review: ${aiScore.summary}`
      };
    });
    const overallScore = this.average(categoryScores.map((categoryScore) => categoryScore.score));

    return {
      overallScore,
      categoryScores,
      criticalIssues: this.mergeFindings(
        deterministicReview.criticalIssues,
        aiReview.criticalIssues
      ),
      warnings: this.mergeFindings(deterministicReview.warnings, aiReview.warnings),
      missingAreas: this.mergeFindings(deterministicReview.missingAreas, aiReview.missingAreas),
      improvementSuggestions: this.mergeFindings(
        deterministicReview.improvementSuggestions,
        aiReview.improvementSuggestions
      ),
      strengths: this.mergeFindings(deterministicReview.strengths, aiReview.strengths),
      unresolvedAssumptions: Array.from(
        new Set([...deterministicReview.unresolvedAssumptions, ...aiReview.unresolvedAssumptions])
      ),
      deterministicReview,
      aiReview,
      validatedAt: new Date().toISOString()
    };
  }

  private findCategoryScore(
    review: DesignValidationReview,
    category: DesignValidationCategory
  ): DesignValidationReview["categoryScores"][number] {
    return (
      review.categoryScores.find((categoryScore) => categoryScore.category === category) ?? {
        category,
        score: review.overallScore,
        summary: "No category-specific review was provided."
      }
    );
  }

  private mergeFindings(
    left: DesignValidationFinding[],
    right: DesignValidationFinding[]
  ): DesignValidationFinding[] {
    const seen = new Set<string>();
    const merged: DesignValidationFinding[] = [];

    for (const finding of [...left, ...right]) {
      const key = `${finding.category}:${finding.message}:${finding.recommendation}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(finding);
    }

    return merged;
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private buildValidationSystemInstruction(): string {
    return [
      "Review a generated software system design against its analyzed requirements.",
      "Return only structured JSON matching the schema.",
      "Score every category from 0 to 100.",
      "Identify critical issues, warnings, missing areas, improvement suggestions, strengths, and unresolved assumptions.",
      "Do not include internal prompt text or hidden reasoning."
    ].join(" ");
  }

  private buildValidationPrompt(input: {
    design: GeneratedSystemDesign;
    requirements: RequirementAnalysis;
    deterministicReview: PersistedDesignValidation["deterministicReview"];
  }): string {
    return JSON.stringify({
      requirements: input.requirements,
      design: input.design,
      deterministicReview: input.deterministicReview,
      categories: designValidationCategorySchema.options
    });
  }
}
