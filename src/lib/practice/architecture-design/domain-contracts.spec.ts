import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION,
  ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION,
  ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
  ARCHITECTURE_DESIGN_STAGES,
  architectureDesignAssessmentSnapshotSchema,
  architectureDesignDimensionSchema,
  architectureDesignQuestionBlockSchema,
  architectureDesignQuestionSchema,
  architectureDesignScenarioSchema,
  publicArchitectureDesignAssessmentSnapshot,
  publicArchitectureDesignConfirmedFocus,
  toPublicArchitectureDesignQuestionBlock
} from ".";

const FINGERPRINT = `sha256:${"a".repeat(64)}`;

describe("Architecture & Design domain contracts", () => {
  it("validates a coherent four-stage, sixteen-dimension scenario", () => {
    const scenario = architectureDesignScenarioSchema.parse(scenarioFixture());

    expect(scenario.stages.map(({ key }) => key)).toEqual(
      ARCHITECTURE_DESIGN_STAGES.map(({ key }) => key)
    );
    expect(new Set(scenario.dimensionKeys)).toEqual(
      new Set(architectureDesignDimensionSchema.options)
    );
  });

  it("rejects a scenario or question that escapes the fixed stage arc", () => {
    const scenario = scenarioFixture();
    scenario.stages[2]!.format = "production-decision";
    expect(architectureDesignScenarioSchema.safeParse(scenario).success).toBe(false);

    const question = questionFixture(2);
    expect(
      architectureDesignQuestionSchema.safeParse({
        ...question,
        format: "mcq",
        choices: ["one", "two", "three"],
        correctChoiceIndex: 0
      }).success
    ).toBe(false);
    expect(
      architectureDesignQuestionSchema.safeParse({
        ...question,
        runnerContract: { runtime: "nodejs" }
      }).success
    ).toBe(false);
  });

  it("requires exactly four ordered questions, three hints, and a 10-point private rubric", () => {
    const block = architectureDesignQuestionBlockSchema.parse(questionBlockFixture());
    expect(block.questions).toHaveLength(4);
    expect(block.questions.every(({ hints }) => hints.length === 3)).toBe(true);
    expect(
      block.questions.every(
        ({ rubric }) => rubric.reduce((total, item) => total + item.points, 0) === 10
      )
    ).toBe(true);

    const invalid = questionBlockFixture();
    invalid.questions[0]!.rubric[0]!.points = 9;
    expect(architectureDesignQuestionBlockSchema.safeParse(invalid).success).toBe(false);
  });

  it("projects private questions without answers, hints, rubrics, or evaluator material", () => {
    const block = architectureDesignQuestionBlockSchema.parse(questionBlockFixture());
    const publicBlock = toPublicArchitectureDesignQuestionBlock(block, new Set(["question-1"]));
    const keys = allKeys(publicBlock);

    expect(keys).not.toEqual(
      expect.arrayContaining([
        "hints",
        "referenceAnswer",
        "correctChoiceIndex",
        "rubric",
        "commonMistakes",
        "interviewerFollowUps"
      ])
    );
    expect(publicBlock.questions[0]?.transferConnection).toBeDefined();
    expect(publicBlock.questions[1]?.transferConnection).toBeUndefined();
  });

  it("projects confirmed focus without source identity, correctness, or private evidence", () => {
    const publicFocus = publicArchitectureDesignConfirmedFocus(confirmedFocusFixture());
    const keys = allKeys(publicFocus);

    expect(publicFocus.baselineState).toBe("STANDARD");
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "baselineEvidence",
        "sourceFingerprint",
        "questionFingerprint",
        "questionId",
        "correctness",
        "dimensionKeys"
      ])
    );
  });

  it("projects frozen assessment prompts without expected answers or private rubrics", () => {
    const snapshot = architectureDesignAssessmentSnapshotSchema.parse(assessmentFixture());
    const publicSnapshot = publicArchitectureDesignAssessmentSnapshot(snapshot);
    const keys = allKeys(publicSnapshot);

    expect(publicSnapshot.prompts).toHaveLength(5);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "privateEvaluation",
        "expectedAnswer",
        "rubric",
        "sourceQuestionFingerprint",
        "sourceSelection",
        "blockContentFingerprint",
        "responseFingerprint"
      ])
    );
  });
});

function scenarioFixture() {
  return {
    schemaVersion: ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
    key: "webhook-delivery-platform",
    title: "Multi-tenant webhook delivery platform",
    premise: "Design a dependable multi-tenant platform that delivers signed webhooks at scale.",
    candidateRole: "You own the backend architecture and must defend its production trade-offs.",
    functionalRequirements: [
      "Tenants register endpoints and subscribe them to supported event types.",
      "The platform delivers events and exposes queryable delivery status."
    ],
    nonGoals: ["Payload transformation by customer-authored executable code is out of scope."],
    constraints: [
      "Delivery is at least once and duplicate side effects must be safely bounded.",
      "One unhealthy tenant endpoint must not consume capacity reserved for others."
    ],
    scaleProfile: [
      "The platform receives fifty thousand events per second at its daily peak.",
      "Delivery latency should remain under sixty seconds for healthy destinations."
    ],
    roles: ["backend", "fullstack"],
    seniorities: ["junior", "mid", "senior"],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "webhook-delivery",
    secondaryTopicKeys: ["multi-tenancy", "event-platforms"],
    dimensionKeys: [...architectureDesignDimensionSchema.options],
    targetKeywords: ["backend", "distributed systems", "webhooks"],
    expectedMinutes: 50,
    realismAnchors: [
      "Customer endpoints have widely different latency and availability characteristics.",
      "Retries can amplify traffic during regional or customer-side failures.",
      "Tenants need auditable delivery attempts without seeing another tenant's data."
    ],
    targetFitExplanation:
      "The scenario exercises backend boundaries, asynchronous work, and data ownership.",
    coverageExplanation:
      "Its four stages cover the full Architecture dimension registry in one design.",
    stages: ARCHITECTURE_DESIGN_STAGES.map((stage) => ({
      order: stage.order,
      key: stage.key,
      title: stage.title,
      format: stage.formats[0],
      objective: `Make and defend the ${stage.title.toLowerCase()} decisions required by the scenario.`,
      artifactKey: `${stage.key}-artifact`,
      dimensionKeys: [...stage.dimensionKeys],
      scenarioDependency:
        "Use the requirements and decisions established in every earlier interview stage."
    }))
  };
}

function questionFixture(index: number) {
  const stage = ARCHITECTURE_DESIGN_STAGES[index]!;
  const format = index === 0 ? ("mcq" as const) : stage.formats[0];
  return {
    schemaVersion: ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
    key: `question-${index + 1}`,
    scenarioKey: "webhook-delivery-platform",
    stageKey: stage.key,
    order: index + 1,
    format,
    topicKeys: ["webhook-delivery"],
    dimensionKeys: [...stage.dimensionKeys],
    prompt: `Explain the ${stage.title.toLowerCase()} decision and tie it to the frozen scenario constraints.`,
    artifact: {
      key: `${stage.key}-artifact`,
      kind: index === 1 ? "metrics" : index === 5 ? "trace" : "scenario",
      title: `${stage.title} evidence`,
      content: "This artifact provides bounded scenario evidence for the candidate to evaluate."
    },
    ...(format === "mcq"
      ? {
          choices: ["First bounded option", "Second bounded option", "Third bounded option"],
          correctChoiceIndex: 0
        }
      : {}),
    hints: [
      "Start with the user-visible requirement before naming a technology or component.",
      "Connect the proposed boundary to capacity, correctness, and the likely failure path.",
      "State the rejected alternative and explain the measurable trade-off it would create."
    ],
    referenceAnswer: {
      summary: "A strong answer establishes a bounded decision from the supplied constraints.",
      explanation:
        "It explains the request and data flow, preserves correctness, and names an explicit trade-off."
    },
    rubric: [
      {
        criterion: "Makes a constraint-grounded decision and explains its operational consequence.",
        points: 10,
        dimensionKeys: [...stage.dimensionKeys]
      }
    ],
    commonMistakes: [
      "Names infrastructure without connecting it to a requirement, access pattern, or failure mode."
    ],
    interviewerFollowUps: [
      "Which assumption would force you to revisit this decision first, and what would you measure?"
    ],
    transferConnection:
      "The same reasoning transfers to other asynchronous multi-tenant delivery systems."
  };
}

function questionBlockFixture() {
  return {
    schemaVersion: ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
    scenarioKey: "webhook-delivery-platform",
    questions: ARCHITECTURE_DESIGN_STAGES.map((_, index) => questionFixture(index))
  };
}

function confirmedFocusFixture() {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-08T05:00:00.000Z",
    path: "role-aligned",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    excludedScenarioKeys: [],
    resumeEvidence: { architectureSkillKeys: ["distributed-systems"], projectKeywords: ["queues"] },
    planEvidence: { blueprintId: null, topicKeys: [], skillKeys: [] },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: FINGERPRINT,
      questionId: "architecture-0",
      questionFingerprint: FINGERPRINT,
      resolution: "RESOLVED",
      correctness: "CORRECT",
      state: "STANDARD",
      dimensionKeys: ["caching-contention", "cost-efficiency"],
      weakDimensionKeys: [],
      strongDimensionKeys: ["caching-contention", "cost-efficiency"],
      unassessedDimensionKeys: architectureDesignDimensionSchema.options.filter(
        (key) => key !== "caching-contention" && key !== "cost-efficiency"
      ),
      signalConsistency: "CONSISTENT"
    }
  };
}

function assessmentFixture() {
  const ranked = {
    scenarioKey: "webhook-delivery-platform",
    scenarioVersion: 1,
    title: "Multi-tenant webhook delivery platform",
    difficulty: "standard",
    emphasizedDimensionKeys: ["async-work-backpressure"],
    scores: {
      baselineGapTransfer: 25,
      targetRoleJob: 20,
      resumeProjectRelevance: 15,
      dimensionCoverage: 20,
      plannedCoverage: 10,
      novelty: 5,
      total: 95
    }
  };
  return {
    schemaVersion: ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION,
    blueprintVersion: ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION,
    preparedAt: "2026-09-08T05:00:00.000Z",
    blockContentFingerprint: FINGERPRINT,
    sourceSelection: {
      policyVersion: 1,
      focusFingerprint: FINGERPRINT,
      selectedScenario: ranked,
      rankings: [ranked],
      reason: "This reviewed scenario closes a baseline gap while matching the target role."
    },
    prompts: [
      "requirements-scope",
      "api-data-capacity",
      "architecture-tradeoffs",
      "reliability-security-operability",
      "communication-evolution"
    ].map((kind, index) => ({
      id: `assessment-prompt-${index + 1}`,
      order: index + 1,
      kind,
      prompt:
        "Defend one frozen design decision using the scenario constraints and candidate transcript.",
      context: "Use only the facts and assumptions already established in the frozen scenario.",
      privateEvaluation: {
        sourceQuestionId: "11111111-1111-4111-8111-111111111111",
        sourceQuestionFingerprint: FINGERPRINT,
        expectedAnswer:
          "A strong answer identifies the constraint, decision, consequence, and trade-off.",
        rubric: [
          {
            criterion: "Grounds the answer in frozen evidence and defends a coherent trade-off.",
            points: 10,
            dimensionKeys: ["tradeoff-communication"]
          }
        ],
        dimensionKeys: ["tradeoff-communication"]
      }
    }))
  };
}

function allKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
}
