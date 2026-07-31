import { DeterministicDesignValidatorService } from "./deterministic-design-validator.service";
import { RequirementAnalysis } from "./requirement-analysis.schema";
import { GeneratedSystemDesign } from "./system-design.schema";

describe("DeterministicDesignValidatorService", () => {
  const service = new DeterministicDesignValidatorService();
  const requirements: RequirementAnalysis = {
    productSummary: "A notification platform.",
    functionalRequirements: [
      {
        id: "FR-1",
        requirement: "Users can schedule notifications.",
        priority: "MUST"
      }
    ],
    nonFunctionalRequirements: [
      {
        id: "NFR-1",
        category: "Reliability",
        requirement: "Retries must handle transient delivery failures.",
        target: null
      }
    ],
    assumptions: [],
    scaleInputs: {
      expectedUsers: "1,000,000 monthly active users",
      requestRate: "24 requests per active user per day",
      storage: "10 KB per user",
      regions: null,
      availabilityTarget: null,
      latencyTarget: null,
      notes: []
    },
    constraints: [],
    missingInformation: [],
    clarificationQuestions: []
  };

  it("scores a reasonably complete design across categories", () => {
    const result = service.validate({
      requirements,
      design: createCompleteDesign()
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.categoryScores).toHaveLength(10);
    expect(result.missingAreas).toHaveLength(0);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it("reports missing sections and lowers scores", () => {
    const result = service.validate({
      requirements,
      design: {
        ...createCompleteDesign(),
        majorComponents: [],
        apiRecommendations: [],
        security: [],
        observability: [],
        reliabilityAndFailureHandling: [],
        scalabilityApproach: []
      }
    });

    expect(result.overallScore).toBeLessThan(70);
    expect(result.missingAreas.map((area) => area.category)).toEqual(
      expect.arrayContaining([
        "functionalRequirements",
        "security",
        "observability",
        "reliability",
        "scalability"
      ])
    );
  });
});

export function createCompleteDesign(): GeneratedSystemDesign {
  return {
    architectureSummary:
      "Use an available, reliable notification architecture with replicas, backups, cost controls, and observability.",
    majorComponents: [
      {
        name: "Notification API",
        responsibilities: ["Accept requests", "Validate templates"]
      },
      {
        name: "Worker Pool",
        responsibilities: ["Process queued jobs", "Retry provider failures"]
      }
    ],
    apiRecommendations: [
      {
        name: "Create notification",
        recommendation: "Expose a command API for notifications.",
        reasoning: "Producers need a stable integration surface."
      }
    ],
    databaseChoices: [
      {
        name: "PostgreSQL",
        recommendation: "Use transactions for delivery state.",
        reasoning: "Consistency and auditability matter."
      }
    ],
    cachingStrategy: [
      {
        name: "Cache aside",
        recommendation: "Cache templates and preferences.",
        reasoning: "Reduces database reads."
      }
    ],
    messagingAndAsyncProcessing: [
      {
        name: "Queue",
        recommendation: "Use a durable queue with idempotency keys.",
        reasoning: "Supports retries and deduplication."
      }
    ],
    storageStrategy: [
      {
        name: "Delivery history",
        recommendation: "Store compact delivery attempts.",
        reasoning: "Supports audits and debugging."
      }
    ],
    scalabilityApproach: [
      {
        name: "Horizontal workers",
        description: "Scale workers by queue lag and provider latency."
      }
    ],
    reliabilityAndFailureHandling: [
      {
        name: "Retry and failover",
        description: "Use retries, dead-letter queues, failover replicas, RPO and RTO targets."
      }
    ],
    security: [
      {
        name: "Tenant isolation",
        description: "Authorize access to templates and delivery records."
      }
    ],
    observability: [
      {
        name: "Golden signals",
        description: "Track metrics, logs, traces, queue lag, and provider failures."
      }
    ],
    deploymentApproach: [
      {
        name: "Multi-region deployment",
        description: "Deploy redundant APIs and workers with restore-tested backups."
      }
    ],
    technologyChoices: [
      {
        category: "Messaging",
        choice: "Durable queue",
        reasoning: "Cost-aware scaling smooths bursts without overprovisioning.",
        alternativesConsidered: ["Synchronous calls"]
      }
    ],
    assumptions: ["Provider rate limits are known."],
    tradeOffs: [
      {
        name: "Async delivery",
        description: "Improves reliability but increases operational complexity and cost."
      }
    ],
    risks: [
      {
        name: "Provider outage",
        description: "External outages require backup providers and disaster recovery plans."
      }
    ],
    retrievedSourceReferences: []
  };
}

