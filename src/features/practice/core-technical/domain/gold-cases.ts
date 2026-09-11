import {
  CORE_TECHNICAL_GOLD_SET_VERSION,
  coreTechnicalGoldCaseSchema
} from "./gold-evaluation-contracts";

export const NODEJS_CORE_TECHNICAL_GOLD_CASES = coreTechnicalGoldCaseSchema.array().parse([
  {
    goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
    key: "javascript-values-copying-mutation-guided-benchmark",
    title: "JavaScript values, copying, and mutation — guided benchmark",
    purpose:
      "Prove that a foundation path teaches the JavaScript value, reference, copying, and mutation decisions candidates repeatedly explain in practical interviews.",
    candidateContext: {
      role: "backend",
      seniority: "mid",
      language: "javascript",
      runtime: "nodejs",
      targetJob: "Backend Engineer",
      baselineState: "GUIDED",
      weakMechanismKeys: ["reference-identity", "shallow-copy"],
      unassessedMechanismKeys: ["structured-clone", "copy-on-write"],
      recentTopicKeys: [],
      excludedTopicKeys: []
    },
    expected: {
      storyTitle: "Trace and fix shared JavaScript state",
      difficulty: "guided",
      stagePatternKeys: [
        "javascript-reference-identity",
        "javascript-shallow-copy-aliasing",
        "javascript-shared-state-mutation",
        "javascript-mutation-boundary-repair",
        "javascript-immutable-nested-update",
        "javascript-copy-strategy-decision"
      ],
      requiredStoryTopicKeys: ["javascript-values-and-mutation"],
      requiredPrimaryMechanismKeys: [
        "reference-identity",
        "shallow-copy",
        "shared-mutation",
        "mutation-boundary",
        "copy-on-write",
        "defensive-copy"
      ],
      minimumConnectedStages: 5,
      minimumUniqueArtifacts: 5,
      expectedMinutes: { minimum: 30, maximum: 40 },
      rationale: [
        "The opening stages establish value and identity reasoning before introducing copy boundaries and nested mutation.",
        "The path uses six distinct source-backed patterns inside one family rather than mixing unrelated Node.js mechanisms.",
        "The final stages require diagnosis, executable repair, implementation, and a defensible production copying decision."
      ]
    },
    review: {
      status: "approved",
      reviewerId: "nikhilverma",
      reviewedAt: "2026-09-07",
      notes: [
        "Approved under the project owner's explicit direction to replace the legacy paths with the first focused family; pattern order and technical claims remain source-audited."
      ]
    }
  },
  {
    goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
    key: "javascript-scope-closures-retained-state-standard-benchmark",
    title: "JavaScript scope, closures, and retained state — standard benchmark",
    purpose:
      "Prove that an intermediate path tests lexical lookup, closure behaviour, state ownership, retention evidence, cleanup, and production lifecycle decisions.",
    candidateContext: {
      role: "backend",
      seniority: "senior",
      language: "javascript",
      runtime: "nodejs",
      targetJob: "Senior Backend Engineer",
      baselineState: "STANDARD",
      weakMechanismKeys: ["lexical-scope", "closure", "garbage-collection-roots"],
      unassessedMechanismKeys: ["listener-cleanup", "state-ownership"],
      recentTopicKeys: ["javascript-values-and-mutation"],
      excludedTopicKeys: []
    },
    expected: {
      storyTitle: "Trace and fix retained JavaScript state",
      difficulty: "standard",
      stagePatternKeys: [
        "javascript-lexical-scope-resolution",
        "javascript-loop-closure-binding",
        "javascript-closure-retention-diagnosis",
        "javascript-listener-closure-cleanup",
        "javascript-closure-state-implementation",
        "javascript-state-ownership-decision"
      ],
      requiredStoryTopicKeys: ["javascript-scope-and-closures"],
      requiredPrimaryMechanismKeys: [
        "lexical-scope",
        "loop-binding",
        "garbage-collection-roots",
        "listener-cleanup",
        "encapsulated-state",
        "state-ownership"
      ],
      minimumConnectedStages: 5,
      minimumUniqueArtifacts: 5,
      expectedMinutes: { minimum: 30, maximum: 40 },
      rationale: [
        "The stage sequence moves from lexical lookup and loop binding into closure lifetime, retained data, cleanup, and ownership.",
        "Every question stays inside the scope-and-closures family while using a distinct practical interview mechanism.",
        "The benchmark requires evidence-led diagnosis, executable repair, implementation, and a production lifecycle decision."
      ]
    },
    review: {
      status: "approved",
      reviewerId: "nikhilverma",
      reviewedAt: "2026-09-07",
      notes: [
        "Approved under the project owner's explicit direction to replace the legacy paths with the second focused family; pattern order and technical claims remain source-audited."
      ]
    }
  }
]);
