import { describe, expect, it } from "vitest";
import {
  APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
  APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION,
  REQUIRED_APPLIED_ENGINEERING_STAGE_FORMATS,
  appliedEngineeringAssessmentSnapshotSchema,
  appliedEngineeringBaselineEvidenceSchema,
  appliedEngineeringConfirmedFocusSchema,
  appliedEngineeringIncidentSchema,
  appliedEngineeringQuestionBlockSchema,
  appliedEngineeringQuestionSchema,
  appliedEngineeringAttemptInputSchema,
  publicAppliedEngineeringAssessmentSnapshot,
  publicAppliedEngineeringConfirmedFocus,
  toPublicAppliedEngineeringQuestion,
  type AppliedEngineeringQuestion,
  type AppliedEngineeringQuestionFormat
} from "./index";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_UUID = "123e4567-e89b-42d3-a456-426614174001";
const FINGERPRINT = `sha256:${"a".repeat(64)}`;
const LONG_TEXT =
  "This is complete production evidence with enough detail for contract validation.";

function question(
  order: number,
  format: AppliedEngineeringQuestionFormat
): AppliedEngineeringQuestion {
  const executable = format === "debug-repair" || format === "micro-implementation";
  return appliedEngineeringQuestionSchema.parse({
    schemaVersion: APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION,
    key: `incident-question-${order}`,
    incidentKey: "duplicate-work-after-retry",
    stageKey: `incident-stage-${order}`,
    order,
    format,
    patternKey: `production-pattern-${order}`,
    topicKeys: ["reliable-request-processing"],
    productionSignalKeys: ["retry-safety"],
    prompt: LONG_TEXT,
    artifact: {
      key: `incident-artifact-${order}`,
      kind: executable ? "code" : "logs",
      title: "Production evidence",
      content: LONG_TEXT,
      language: executable ? "javascript" : undefined
    },
    choices: format === "mcq" ? ["Inspect traces", "Restart everything", "Ignore it"] : undefined,
    hints: [LONG_TEXT, LONG_TEXT, LONG_TEXT],
    answer: {
      concise: "Inspect the evidence before changing the system.",
      explanation: LONG_TEXT,
      correctChoiceIndex: format === "mcq" ? 0 : undefined
    },
    rubric: [{ criterion: "Uses the supplied production evidence", points: 10 }],
    commonMistakes: [LONG_TEXT],
    interviewerFollowUps: [LONG_TEXT],
    interviewConnection: LONG_TEXT,
    starterCode: executable ? "export function repair(value) { return value; }" : undefined,
    referenceSolution: executable
      ? "export function repair(value) { return String(value); }"
      : undefined,
    publicTests: executable
      ? [
          {
            name: "handles a normal request",
            input: "normal",
            expected: "normal",
            testCode: "if (solution.repair('normal') !== 'normal') throw new Error('failed');"
          }
        ]
      : undefined,
    hiddenTests: executable
      ? [
          {
            name: "handles a retry safely",
            input: "retry",
            expected: "retry",
            testCode: "if (solution.repair('retry') !== 'retry') throw new Error('failed');"
          }
        ]
      : undefined,
    wrongSolutions: executable
      ? [{ name: "duplicates retry work", code: "export const repair = () => 'duplicate';" }]
      : undefined,
    runnerContract: executable
      ? {
          language: "javascript",
          runtime: "nodejs",
          runtimeVersion: "22",
          entrypoint: "submission.js",
          timeoutMs: 1_000,
          memoryMb: 64,
          networkAccess: false
        }
      : undefined
  });
}

function incident() {
  return {
    schemaVersion: APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION,
    key: "duplicate-work-after-retry",
    title: "Duplicate work after a retry",
    premise: LONG_TEXT,
    incident: LONG_TEXT,
    customerImpact: LONG_TEXT,
    candidateRole: LONG_TEXT,
    constraints: [LONG_TEXT, `${LONG_TEXT} The rollout must remain reversible.`],
    primaryTopicKey: "reliable-request-processing",
    secondaryTopicKeys: ["database-write-safety"],
    productionSignalKeys: [
      "evidence-selection",
      "root-cause-reasoning",
      "idempotency",
      "retry-safety",
      "testing-verification",
      "observability",
      "rollout-safety"
    ],
    difficulty: "standard",
    prerequisiteIncidentKeys: [],
    expectedMinutes: 45,
    realismAnchors: [LONG_TEXT, `${LONG_TEXT} Logs show two writes.`, `${LONG_TEXT} Users retry.`],
    targetFitExplanation: LONG_TEXT,
    coverageExplanation: LONG_TEXT,
    stages: REQUIRED_APPLIED_ENGINEERING_STAGE_FORMATS.map((formats, index) => ({
      order: index + 1,
      key: `incident-stage-${index + 1}`,
      title: `Incident stage ${index + 1}`,
      format: formats[0],
      patternKey: `production-pattern-${index + 1}`,
      objective: LONG_TEXT,
      artifactKey: `incident-artifact-${index + 1}`,
      productionSignalKeys: ["evidence-selection"],
      incidentDependency: LONG_TEXT
    }))
  };
}

function baselineEvidence() {
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    source: "initial-baseline",
    state: "GUIDED",
    evidence: "baseline",
    confidence: 0.24,
    questionId: "engineering-4",
    familiarity: "needs-refresh",
    weakSignalKeys: ["evidence-selection"],
    strongSignalKeys: [],
    unassessedSignalKeys: ["retry-safety"],
    sourceTopicLabels: ["Production reasoning"],
    sourceAreaId: "applied-engineering"
  };
}

function firstIncidentSelection() {
  const ranked = {
    incidentKey: "duplicate-work-after-retry",
    incidentVersion: 1,
    title: "Duplicate work after a retry",
    difficulty: "guided",
    emphasizedSignalKeys: ["retry-safety"],
    scores: {
      baselineGapTransfer: 30,
      targetRoleJob: 20,
      resumeProjectRelevance: 15,
      productionEvidenceCoverage: 20,
      plannedCoverage: 10,
      novelty: 5,
      total: 100
    }
  };
  return {
    policyVersion: 1,
    focusFingerprint: FINGERPRINT,
    selectedIncident: ranked,
    rankings: [ranked],
    reason: "This incident directly exercises the candidate's weakest production evidence signal."
  };
}

describe("Applied Engineering contracts", () => {
  it("accepts the fixed eight-stage production incident and rejects a reordered stage", () => {
    expect(appliedEngineeringIncidentSchema.parse(incident()).stages).toHaveLength(8);

    const reordered = incident();
    reordered.stages[1]!.order = 1;
    expect(() => appliedEngineeringIncidentSchema.parse(reordered)).toThrow(
      "Incident stages must be ordered from 1 through 8"
    );
  });

  it("requires complete runner evidence only for executable questions", () => {
    expect(question(5, "debug-repair").runnerContract?.networkAccess).toBe(false);

    const invalid = { ...question(5, "debug-repair"), hiddenTests: undefined };
    expect(() => appliedEngineeringQuestionSchema.parse(invalid)).toThrow(
      "Executable questions require"
    );

    const nonExecutable = {
      ...question(3, "written"),
      starterCode: "export const unsafe = true;"
    };
    expect(() => appliedEngineeringQuestionSchema.parse(nonExecutable)).toThrow(
      "Non-executable questions cannot contain runner-only fields"
    );
  });

  it("freezes exactly eight ordered questions for one incident", () => {
    const formats: AppliedEngineeringQuestionFormat[] = [
      "mcq",
      "artifact-diagnosis",
      "written",
      "artifact-diagnosis",
      "debug-repair",
      "micro-implementation",
      "production-decision",
      "production-decision"
    ];
    const block = appliedEngineeringQuestionBlockSchema.parse({
      schemaVersion: 1,
      incidentKey: "duplicate-work-after-retry",
      questions: formats.map((format, index) => question(index + 1, format))
    });
    expect(block.questions).toHaveLength(8);

    expect(() =>
      appliedEngineeringQuestionBlockSchema.parse({
        ...block,
        questions: block.questions.map((item, index) =>
          index === 7 ? { ...item, incidentKey: "another-incident" } : item
        )
      })
    ).toThrow("Every question must belong to the frozen incident");
  });

  it("never exposes answers, hints, hidden tests, mutants, or reference repairs", () => {
    const privateQuestion = question(5, "debug-repair");
    const beforeAttempt = toPublicAppliedEngineeringQuestion(privateQuestion, false);
    const afterAttempt = toPublicAppliedEngineeringQuestion(privateQuestion, true);

    expect(beforeAttempt).not.toHaveProperty("answer");
    expect(beforeAttempt).not.toHaveProperty("hints");
    expect(beforeAttempt).not.toHaveProperty("hiddenTests");
    expect(beforeAttempt).not.toHaveProperty("wrongSolutions");
    expect(beforeAttempt).not.toHaveProperty("referenceSolution");
    expect(beforeAttempt).not.toHaveProperty("interviewConnection");
    expect(afterAttempt.interviewConnection).toBe(LONG_TEXT);
  });

  it("keeps onboarding and resume evidence out of the public focus", () => {
    expect(() =>
      appliedEngineeringBaselineEvidenceSchema.parse({
        ...baselineEvidence(),
        evidence: "not-enough-evidence",
        confidence: 0.24
      })
    ).toThrow("Missing baseline evidence must have zero confidence");

    const focus = appliedEngineeringConfirmedFocusSchema.parse({
      schemaVersion: 1,
      focusFingerprint: FINGERPRINT,
      confirmedAt: "2026-09-08T10:00:00.000Z",
      role: "backend",
      seniority: "mid",
      targetJob: "Backend Engineer",
      targetCompany: "Trailgrad",
      targetDate: "2026-12-01",
      stack: {
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        framework: "nextjs"
      },
      excludedIncidentKeys: [],
      resumeEvidence: {
        technologyKeys: ["postgresql"],
        projectKeywords: ["payment processing"],
        productionSignalKeys: ["retry-safety"]
      },
      baselineEvidence: baselineEvidence()
    });
    const publicFocus = publicAppliedEngineeringConfirmedFocus(focus);

    expect(publicFocus.baselineState).toBe("GUIDED");
    expect(publicFocus).not.toHaveProperty("resumeEvidence");
    expect(publicFocus).not.toHaveProperty("focusFingerprint");
    expect(publicFocus).not.toHaveProperty("baselineEvidence");
  });

  it("strips assessment evaluation and rejects stale code attempts without a run id", () => {
    const prompts = Array.from({ length: 5 }, (_, index) => ({
      id: `assessment-prompt-${index + 1}`,
      order: index + 1,
      kind: [
        "evidence-defence",
        "repair-defence",
        "unseen-diagnosis-transfer",
        "verification-transfer",
        "rollout-defence"
      ][index],
      prompt: LONG_TEXT,
      context: LONG_TEXT,
      privateEvaluation: {
        sourceQuestionId: UUID,
        sourceQuestionFingerprint: FINGERPRINT,
        expectedAnswer: LONG_TEXT,
        rubric: [{ criterion: "Uses production evidence", points: 10 }],
        deterministicEvidence: "practice-evidence"
      }
    }));
    const snapshot = appliedEngineeringAssessmentSnapshotSchema.parse({
      schemaVersion: 1,
      blueprintVersion: APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
      preparedAt: "2026-09-08T10:00:00.000Z",
      blockContentFingerprint: FINGERPRINT,
      sourceSelection: firstIncidentSelection(),
      prompts
    });
    const publicSnapshot = publicAppliedEngineeringAssessmentSnapshot(snapshot);

    expect(publicSnapshot.prompts[0]).not.toHaveProperty("privateEvaluation");
    expect(publicSnapshot).not.toHaveProperty("sourceSelection");
    expect(() =>
      appliedEngineeringAttemptInputSchema.parse({
        questionId: UUID,
        requestId: SECOND_UUID,
        work: { kind: "code", code: "export const value = 'submitted';" }
      })
    ).toThrow();
  });
});
