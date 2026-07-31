import {
  DesignValidationCategory,
  DesignValidationFinding,
  DeterministicDesignValidation
} from "./design-validation.schema";
import { RequirementAnalysis } from "./requirement-analysis.schema";
import { GeneratedSystemDesign } from "./system-design.schema";

interface CategoryEvaluation {
  category: DesignValidationCategory;
  score: number;
  summary: string;
  passed: boolean;
  message: string;
  criticalIssues?: DesignValidationFinding[];
  warnings?: DesignValidationFinding[];
  missingAreas?: DesignValidationFinding[];
  improvementSuggestions?: DesignValidationFinding[];
  strengths?: DesignValidationFinding[];
}

const VALIDATION_CATEGORIES: DesignValidationCategory[] = [
  "functionalRequirements",
  "scalability",
  "availability",
  "reliability",
  "dataConsistency",
  "security",
  "observability",
  "disasterRecovery",
  "costAwareness",
  "operationalComplexity"
];

export class DeterministicDesignValidatorService {
  validate(input: {
    design: GeneratedSystemDesign;
    requirements: RequirementAnalysis;
  }): DeterministicDesignValidation {
    const evaluations = VALIDATION_CATEGORIES.map((category) =>
      this.evaluateCategory(category, input.design, input.requirements)
    );
    const overallScore = this.average(evaluations.map((evaluation) => evaluation.score));

    return {
      overallScore,
      categoryScores: evaluations.map((evaluation) => ({
        category: evaluation.category,
        score: evaluation.score,
        summary: evaluation.summary
      })),
      criticalIssues: evaluations.flatMap((evaluation) => evaluation.criticalIssues ?? []),
      warnings: evaluations.flatMap((evaluation) => evaluation.warnings ?? []),
      missingAreas: evaluations.flatMap((evaluation) => evaluation.missingAreas ?? []),
      improvementSuggestions: evaluations.flatMap(
        (evaluation) => evaluation.improvementSuggestions ?? []
      ),
      strengths: evaluations.flatMap((evaluation) => evaluation.strengths ?? []),
      unresolvedAssumptions: input.design.assumptions,
      checks: evaluations.map((evaluation) => ({
        category: evaluation.category,
        passed: evaluation.passed,
        message: evaluation.message
      }))
    };
  }

  private evaluateCategory(
    category: DesignValidationCategory,
    design: GeneratedSystemDesign,
    requirements: RequirementAnalysis
  ): CategoryEvaluation {
    switch (category) {
      case "functionalRequirements":
        return this.evaluateFunctionalRequirements(design, requirements);
      case "scalability":
        return this.evaluateSection(
          category,
          design.scalabilityApproach.length,
          "Scalability approach is described.",
          "Scalability approach is missing."
        );
      case "availability":
        return this.evaluateKeywordCoverage(
          category,
          design,
          ["availability", "failover", "redundant", "multi-region", "replica"],
          "Availability strategy is explicit.",
          "Availability strategy is not explicit."
        );
      case "reliability":
        return this.evaluateSection(
          category,
          design.reliabilityAndFailureHandling.length,
          "Reliability and failure handling are described.",
          "Reliability and failure handling are missing."
        );
      case "dataConsistency":
        return this.evaluateKeywordCoverage(
          category,
          design,
          ["consistency", "transaction", "idempotency", "ordering", "deduplication"],
          "Data consistency concerns are addressed.",
          "Data consistency strategy is not explicit."
        );
      case "security":
        return this.evaluateSection(
          category,
          design.security.length,
          "Security controls are described.",
          "Security controls are missing."
        );
      case "observability":
        return this.evaluateSection(
          category,
          design.observability.length,
          "Observability is described.",
          "Observability is missing."
        );
      case "disasterRecovery":
        return this.evaluateKeywordCoverage(
          category,
          design,
          ["backup", "restore", "disaster", "recovery", "rpo", "rto"],
          "Disaster recovery is addressed.",
          "Disaster recovery is not explicit."
        );
      case "costAwareness":
        return this.evaluateKeywordCoverage(
          category,
          design,
          ["cost", "expensive", "budget", "optimize", "right-size"],
          "Cost awareness is addressed.",
          "Cost awareness is not explicit."
        );
      case "operationalComplexity":
        return this.evaluateOperationalComplexity(design);
    }
  }

  private evaluateFunctionalRequirements(
    design: GeneratedSystemDesign,
    requirements: RequirementAnalysis
  ): CategoryEvaluation {
    const hasComponents = design.majorComponents.length > 0;
    const hasApis = design.apiRecommendations.length > 0;
    const hasFunctionalRequirements = requirements.functionalRequirements.length > 0;
    const score = hasComponents && hasApis && hasFunctionalRequirements ? 90 : 50;
    const missingAreas: DesignValidationFinding[] = [];

    if (!hasComponents) {
      missingAreas.push(
        this.finding(
          "functionalRequirements",
          "Major components are missing.",
          "Add components that map to core functional requirements."
        )
      );
    }

    if (!hasApis) {
      missingAreas.push(
        this.finding(
          "functionalRequirements",
          "API recommendations are missing.",
          "Add API recommendations that support the required user workflows."
        )
      );
    }

    return {
      category: "functionalRequirements",
      score,
      summary: hasComponents && hasApis ? "Functional surface is represented." : "Functional surface has gaps.",
      passed: score >= 70,
      message: hasComponents && hasApis ? "Functional checks passed." : "Functional checks found gaps.",
      missingAreas,
      strengths:
        score >= 70
          ? [
              this.finding(
                "functionalRequirements",
                "Design includes components and APIs.",
                "Keep tracing requirements to implementation surfaces as the design evolves."
              )
            ]
          : []
    };
  }

  private evaluateSection(
    category: DesignValidationCategory,
    itemCount: number,
    successMessage: string,
    missingMessage: string
  ): CategoryEvaluation {
    const passed = itemCount > 0;

    return {
      category,
      score: passed ? 85 : 35,
      summary: passed ? successMessage : missingMessage,
      passed,
      message: passed ? successMessage : missingMessage,
      missingAreas: passed
        ? []
        : [
            this.finding(
              category,
              missingMessage,
              `Add a concrete ${this.humanizeCategory(category)} section to the design.`
            )
          ],
      strengths: passed
        ? [
            this.finding(
              category,
              successMessage,
              `Keep ${this.humanizeCategory(category)} guidance actionable and measurable.`
            )
          ]
        : []
    };
  }

  private evaluateKeywordCoverage(
    category: DesignValidationCategory,
    design: GeneratedSystemDesign,
    keywords: string[],
    successMessage: string,
    missingMessage: string
  ): CategoryEvaluation {
    const text = JSON.stringify(design).toLowerCase();
    const matched = keywords.some((keyword) => text.includes(keyword));

    return {
      category,
      score: matched ? 80 : 40,
      summary: matched ? successMessage : missingMessage,
      passed: matched,
      message: matched ? successMessage : missingMessage,
      missingAreas: matched
        ? []
        : [
            this.finding(
              category,
              missingMessage,
              `Add explicit ${this.humanizeCategory(category)} decisions and trade-offs.`
            )
          ],
      improvementSuggestions: matched
        ? []
        : [
            this.finding(
              category,
              `${this.humanizeCategory(category)} needs more detail.`,
              `Describe concrete mechanisms for ${this.humanizeCategory(category)}.`
            )
          ]
    };
  }

  private evaluateOperationalComplexity(design: GeneratedSystemDesign): CategoryEvaluation {
    const hasDeployment = design.deploymentApproach.length > 0;
    const hasTradeOffs = design.tradeOffs.length > 0;
    const hasRisks = design.risks.length > 0;
    const score = this.average([hasDeployment ? 85 : 35, hasTradeOffs ? 80 : 40, hasRisks ? 80 : 40]);
    const passed = score >= 70;

    return {
      category: "operationalComplexity",
      score,
      summary: passed
        ? "Operational complexity is acknowledged."
        : "Operational complexity needs more explicit treatment.",
      passed,
      message: passed
        ? "Operational complexity checks passed."
        : "Operational complexity checks found gaps.",
      missingAreas: passed
        ? []
        : [
            this.finding(
              "operationalComplexity",
              "Deployment, trade-offs, or risks are incomplete.",
              "Document deployment ownership, operational trade-offs, and run-time risks."
            )
          ]
    };
  }

  private finding(
    category: DesignValidationCategory,
    message: string,
    recommendation: string
  ): DesignValidationFinding {
    return {
      category,
      message,
      recommendation
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private humanizeCategory(category: DesignValidationCategory): string {
    return category.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  }
}

