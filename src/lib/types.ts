export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type DesignSessionStatus =
  "DRAFT" | "REQUIREMENTS_PENDING" | "READY_FOR_DESIGN" | "GENERATING" | "COMPLETED" | "FAILED";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

export interface PaginationMeta {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignSession {
  id: string;
  projectId: string;
  title: string;
  problemStatement: string;
  status: DesignSessionStatus;
  currentStep: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  requirementAnalysis: RequirementAnalysis | null;
  clarificationAnswers: ClarificationAnswer[] | null;
  requirementsAnalyzedAt: string | null;
  capacityCalculation: CapacityCalculation | null;
  capacityCalculatedAt: string | null;
  generatedDesign: GeneratedDesign | null;
  designGeneratedAt: string | null;
  architectureDiagram: ArchitectureDiagram | null;
  diagramGeneratedAt: string | null;
  designValidation: DesignValidation | null;
  designValidatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementItem {
  id: string;
  requirement: string;
  priority?: "MUST" | "SHOULD" | "COULD";
}

export interface NonFunctionalRequirement {
  id: string;
  category: string;
  requirement: string;
  target: string | null;
}

export interface ScaleInputs {
  expectedUsers: string | null;
  requestRate: string | null;
  storage: string | null;
  regions: string | null;
  availabilityTarget: string | null;
  latencyTarget: string | null;
  notes: string[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  reason: string;
  options?: string[];
}

export interface RequirementAnalysis {
  productSummary: string;
  functionalRequirements: RequirementItem[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  assumptions: string[];
  scaleInputs: ScaleInputs;
  constraints: string[];
  missingInformation: string[];
  clarificationQuestions: ClarificationQuestion[];
}

export interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
  answeredAt: string;
}

export interface RequirementsResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  analysis: RequirementAnalysis | null;
  clarificationAnswers: ClarificationAnswer[];
  analyzedAt: string | null;
}

export interface MetricValue {
  raw: number;
  display: string;
  unit: string;
}

export interface CapacityCalculation {
  toolName: "capacity-calculator";
  inputs: Record<string, number | string>;
  results: {
    dailyActiveUsers: MetricValue;
    averageRequestsPerSecond: MetricValue;
    peakRequestsPerSecond: MetricValue;
    readQps: MetricValue;
    writeQps: MetricValue;
    dailyBandwidth: MetricValue;
    monthlyBandwidth: MetricValue;
    monthlyStorageGrowth: MetricValue;
    retainedStorageEstimate: MetricValue;
  };
  assumptions: string[];
  warnings: string[];
}

export interface CapacityResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  calculation: CapacityCalculation | null;
  calculatedAt: string | null;
}

export interface NamedRecommendation {
  name: string;
  recommendation: string;
  reasoning: string;
}

export interface DescriptionItem {
  name: string;
  description: string;
}

export interface GeneratedDesign {
  architectureSummary: string;
  majorComponents: Array<{
    name: string;
    responsibilities: string[];
  }>;
  apiRecommendations: NamedRecommendation[];
  databaseChoices: NamedRecommendation[];
  cachingStrategy: NamedRecommendation[];
  messagingAndAsyncProcessing: NamedRecommendation[];
  storageStrategy: NamedRecommendation[];
  scalabilityApproach: DescriptionItem[];
  reliabilityAndFailureHandling: DescriptionItem[];
  security: DescriptionItem[];
  observability: DescriptionItem[];
  deploymentApproach: DescriptionItem[];
  technologyChoices: Array<{
    category: string;
    choice: string;
    reasoning: string;
    alternativesConsidered: string[];
  }>;
  assumptions: string[];
  tradeOffs: DescriptionItem[];
  risks: DescriptionItem[];
  retrievedSourceReferences: Array<{
    chunkId: string;
    documentId: string;
    documentTitle: string;
    sourceUrl: string | null;
    similarity: number;
    usedFor: string;
  }>;
}

export interface GeneratedDesignResponse {
  designSessionId: string;
  status: DesignSessionStatus;
  design: GeneratedDesign | null;
  generatedAt: string | null;
}

export interface ArchitectureDiagram {
  type: "flowchart";
  direction: "TD";
  mermaid: string;
  generatedAt: string;
}

export interface DiagramResponse {
  designSessionId: string;
  diagram: ArchitectureDiagram | null;
  generatedAt: string | null;
}

export interface ValidationFinding {
  category: string;
  message: string;
  recommendation?: string;
}

export interface DesignValidation {
  overallScore: number;
  categoryScores: Array<{
    category: string;
    score: number;
    summary: string;
  }>;
  criticalIssues: ValidationFinding[];
  warnings: ValidationFinding[];
  missingAreas: ValidationFinding[];
  improvementSuggestions: ValidationFinding[];
  strengths: ValidationFinding[];
  unresolvedAssumptions: string[];
  deterministicReview?: JsonValue;
  aiReview?: JsonValue;
  validatedAt: string;
}

export interface ValidationResponse {
  designSessionId: string;
  validation: DesignValidation | null;
  validatedAt: string | null;
}
