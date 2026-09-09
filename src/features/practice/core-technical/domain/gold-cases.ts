import {
  CORE_TECHNICAL_GOLD_SET_VERSION,
  coreTechnicalGoldCaseSchema
} from "./gold-evaluation-contracts";

export const NODEJS_CORE_TECHNICAL_GOLD_CASES = coreTechnicalGoldCaseSchema.array().parse([
  {
    goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
    key: "follow-operation-guided-benchmark",
    title: "Follow the operation — guided benchmark",
    purpose:
      "Prove that a foundation block turns weak asynchronous execution evidence into one coherent Node.js production investigation without losing interview depth.",
    candidateContext: {
      role: "backend",
      seniority: "mid",
      language: "javascript",
      runtime: "nodejs",
      targetJob: "Backend Engineer",
      baselineState: "GUIDED",
      weakMechanismKeys: ["event-loop", "resource-cleanup"],
      unassessedMechanismKeys: ["stream", "worker-thread"],
      recentTopicKeys: [],
      excludedTopicKeys: []
    },
    expected: {
      storyTitle: "Follow the operation",
      difficulty: "guided",
      stagePatternKeys: [
        "javascript-identity-mutation-copy",
        "javascript-event-loop-order",
        "javascript-closure-lifetime",
        "javascript-async-error-propagation",
        "nodejs-deterministic-async-testing",
        "nodejs-commonjs-esm-boundary",
        "nodejs-stream-backpressure",
        "nodejs-request-cancellation"
      ],
      requiredStoryTopicKeys: [
        "async-scheduling",
        "javascript-values-and-mutation",
        "javascript-scope-and-closures",
        "errors-and-cancellation"
      ],
      requiredPrimaryMechanismKeys: [
        "reference-identity",
        "event-loop",
        "lexical-scope",
        "promise-rejection",
        "fake-time",
        "commonjs",
        "stream",
        "abort-signal"
      ],
      minimumConnectedStages: 4,
      minimumUniqueArtifacts: 6,
      expectedMinutes: { minimum: 40, maximum: 50 },
      rationale: [
        "The opening stages establish JavaScript state and scheduling before asking for production diagnosis.",
        "The block exercises eight distinct source-backed patterns instead of repeatedly testing event-loop trivia.",
        "The final stages require repair, implementation, and production reasoning after the mechanism has been traced."
      ]
    },
    review: {
      status: "approved",
      reviewerId: "nikhilverma",
      reviewedAt: "2026-09-07",
      notes: [
        "Approved by the project owner after reviewing the eight-pattern order, primary mechanisms, guided difficulty, coverage rationale, and 40–50 minute scope."
      ]
    }
  },
  {
    goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
    key: "operation-fails-halfway-standard-benchmark",
    title: "The operation fails halfway — standard benchmark",
    purpose:
      "Prove that an intermediate block tests partial failure, propagation, cancellation, resource lifetime, and bounded recovery through one realistic Node.js incident.",
    candidateContext: {
      role: "backend",
      seniority: "senior",
      language: "javascript",
      runtime: "nodejs",
      targetJob: "Senior Backend Engineer",
      baselineState: "STANDARD",
      weakMechanismKeys: ["promise-rejection", "abort-signal", "resource-cleanup"],
      unassessedMechanismKeys: ["backpressure", "concurrency-limit"],
      recentTopicKeys: ["javascript-values-and-mutation"],
      excludedTopicKeys: []
    },
    expected: {
      storyTitle: "The operation fails halfway",
      difficulty: "standard",
      stagePatternKeys: [
        "nodejs-commonjs-esm-boundary",
        "javascript-event-loop-order",
        "javascript-async-error-propagation",
        "nodejs-request-cancellation",
        "nodejs-resource-leak-diagnosis",
        "nodejs-stream-backpressure",
        "javascript-promise-concurrency",
        "nodejs-event-loop-blocking"
      ],
      requiredStoryTopicKeys: [
        "errors-and-cancellation",
        "nodejs-streams-and-io",
        "nodejs-event-loop-health",
        "async-scheduling"
      ],
      requiredPrimaryMechanismKeys: [
        "commonjs",
        "event-loop",
        "promise-rejection",
        "abort-signal",
        "heap-retention",
        "stream",
        "promise-concurrency",
        "event-loop-lag"
      ],
      minimumConnectedStages: 6,
      minimumUniqueArtifacts: 7,
      expectedMinutes: { minimum: 40, maximum: 50 },
      rationale: [
        "The stage sequence follows one operation from loading and scheduling through partial failure and cleanup.",
        "Cancellation, backpressure, bounded concurrency, and event-loop health are evaluated as connected production decisions.",
        "The benchmark requires distinct interview mechanisms and rejects a decorative incident wrapped around unrelated questions."
      ]
    },
    review: {
      status: "approved",
      reviewerId: "nikhilverma",
      reviewedAt: "2026-09-07",
      notes: [
        "Approved by the project owner after reviewing the eight-pattern order, primary mechanisms, standard difficulty, coverage rationale, operational realism, and 40–50 minute scope."
      ]
    }
  }
]);
