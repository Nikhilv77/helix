import { selectedStorySchema, type SelectedCoreTechnicalStory } from "./story-contracts";

const sharedScore = {
  domainImportance: 20,
  realism: 15,
  interviewDensity: 20,
  coherence: 15,
  stackFit: 15,
  personalizedCoverage: 15,
  total: 100
} as const;

const valuesPathV1 = selectedStorySchema.parse({
  schemaVersion: 1,
  key: "javascript-values-copying-mutation",
  title: "Trace and fix shared JavaScript state",
  premise:
    "You are reviewing a small Node.js request flow where configuration and response objects unexpectedly affect one another.",
  incident:
    "A request-specific update changes a shared nested object, so later requests observe values that belong to an earlier caller.",
  candidateRole:
    "Trace the object identities, repair the ownership boundary, and explain the production trade-offs clearly.",
  primaryTopicKey: "javascript-values-and-mutation",
  secondaryTopicKeys: [],
  mechanismKeys: [
    "reference-identity",
    "shallow-copy",
    "property-copy",
    "structured-clone",
    "shared-mutation",
    "mutation-boundary",
    "copy-on-write",
    "defensive-copy"
  ],
  difficulty: "guided",
  prerequisiteTopicKeys: [],
  expectedMinutes: 45,
  forbiddenTopicKeys: [],
  realismAnchors: [
    "The path uses ordinary request, configuration, and response objects instead of an invented company incident.",
    "Every prediction can be checked from concrete JavaScript code and explicit reference relationships.",
    "The repair must preserve caller-owned input while avoiding unnecessary whole-graph cloning."
  ],
  targetFitExplanation:
    "Reference identity and mutation boundaries are common JavaScript interview fundamentals and everyday backend debugging skills.",
  coverageExplanation:
    "Eight distinct questions progress from identity and shallow copying to diagnosis, executable repair, implementation, and production choice.",
  stages: [
    stage(
      1,
      "identify-shared-references",
      "Identify shared references",
      "mcq",
      "javascript-reference-identity",
      "identity-map",
      "Identify which values share object identity before any write occurs.",
      "This establishes the reference map used by the remaining questions."
    ),
    stage(
      2,
      "predict-shallow-copy-result",
      "Predict a shallow-copy result",
      "predict-explain",
      "javascript-shallow-copy-aliasing",
      "copy-trace",
      "Predict the exact nested values after copying and mutation, then justify every step.",
      "This applies the identity map from the opening question to a concrete object spread."
    ),
    stage(
      3,
      "explain-property-copy",
      "Explain what the copy preserves",
      "written",
      "javascript-property-copy-semantics",
      "copy-contract",
      "Explain which properties and object behaviours survive an ordinary spread copy.",
      "This turns the observed copy result into an explicit language-level contract."
    ),
    stage(
      4,
      "choose-deep-copy-boundary",
      "Choose a deep-copy boundary",
      "spoken",
      "javascript-structured-clone-boundary",
      "payload-boundary",
      "Explain whether a request payload should be cloned, rebuilt, or left under one clear owner.",
      "This uses the copy contract to reason about a realistic service boundary."
    ),
    stage(
      5,
      "diagnose-cross-request-mutation",
      "Diagnose cross-request mutation",
      "artifact-diagnosis",
      "javascript-shared-state-mutation",
      "request-state-log",
      "Find the shared reference that lets one request change state observed by another.",
      "The earlier ownership decision is tested against logs from repeated requests."
    ),
    stage(
      6,
      "repair-mutation-boundary",
      "Repair the mutation boundary",
      "debug-repair",
      "javascript-mutation-boundary-repair",
      "request-normalizer",
      "Repair executable code so it returns the intended result without mutating caller-owned input.",
      "The diagnosis identifies the exact boundary the executable repair must protect."
    ),
    stage(
      7,
      "implement-nested-update",
      "Implement a nested immutable update",
      "micro-implementation",
      "javascript-immutable-nested-update",
      "profile-updater",
      "Implement a selective nested update and preserve identity for every untouched branch.",
      "This generalizes the repaired boundary into a reusable update technique."
    ),
    stage(
      8,
      "defend-copying-strategy",
      "Defend a production copying strategy",
      "production-decision",
      "javascript-copy-strategy-decision",
      "ownership-decision",
      "Choose a copying strategy for a service boundary and defend correctness and performance trade-offs.",
      "This final decision combines the identity, copying, diagnosis, and repair evidence from the path."
    )
  ],
  score: sharedScore,
  selectionReason:
    "Selected as the first JavaScript foundation because value, identity, copying, and mutation reasoning supports every later Core Technical family."
});

const closuresPathV1 = selectedStorySchema.parse({
  schemaVersion: 1,
  key: "javascript-scope-closures-retained-state",
  title: "Trace and fix retained JavaScript state",
  premise:
    "You are reviewing callbacks and module state in a long-running Node.js service that handles many requests.",
  incident:
    "Callbacks read surprising values, repeated setup adds duplicate listeners, and request objects remain reachable after work completes.",
  candidateRole:
    "Trace lexical bindings and retaining paths, repair lifecycle cleanup, and choose an explicit owner for long-lived state.",
  primaryTopicKey: "javascript-scope-and-closures",
  secondaryTopicKeys: [],
  mechanismKeys: [
    "lexical-scope",
    "loop-binding",
    "closure",
    "module-state",
    "garbage-collection-roots",
    "listener-cleanup",
    "encapsulated-state",
    "state-ownership"
  ],
  difficulty: "standard",
  prerequisiteTopicKeys: ["javascript-values-and-mutation"],
  expectedMinutes: 45,
  forbiddenTopicKeys: [],
  realismAnchors: [
    "The path uses callbacks, request handlers, listeners, and module state found in ordinary Node.js services.",
    "Retention claims must be supported by a reachable root or listener lifecycle rather than memory-growth guesses.",
    "The final design must state ownership, cleanup, process boundaries, and test-isolation consequences."
  ],
  targetFitExplanation:
    "Lexical scope and closure lifetime are common JavaScript interview topics with direct consequences for backend correctness and memory use.",
  coverageExplanation:
    "Eight questions progress from name resolution and loop bindings to retention diagnosis, executable cleanup, encapsulation, and state ownership.",
  stages: [
    stage(
      1,
      "resolve-lexical-binding",
      "Resolve the lexical binding",
      "mcq",
      "javascript-lexical-scope-resolution",
      "scope-map",
      "Identify the binding used by each read in nested and shadowed scopes.",
      "This creates the lexical environment map used throughout the path."
    ),
    stage(
      2,
      "predict-loop-callbacks",
      "Predict loop callback values",
      "predict-explain",
      "javascript-loop-closure-binding",
      "callback-trace",
      "Predict delayed callback values and explain the difference between shared and per-iteration bindings.",
      "This applies lexical lookup to callbacks that execute after the loop ends."
    ),
    stage(
      3,
      "explain-closure-lifetime",
      "Explain closure state lifetime",
      "written",
      "javascript-closure-state-lifetime",
      "counter-factory",
      "Explain why returned functions retain access to bindings and when that state becomes collectible.",
      "This names the closure mechanism behind the callback trace."
    ),
    stage(
      4,
      "explain-module-state",
      "Explain module state across requests",
      "spoken",
      "javascript-module-state-boundary",
      "request-counter",
      "Explain who can observe module-scoped state and what process lifetime means for correctness.",
      "This expands closure lifetime reasoning to a real Node.js request boundary."
    ),
    stage(
      5,
      "diagnose-retaining-path",
      "Diagnose a retaining path",
      "artifact-diagnosis",
      "javascript-closure-retention-diagnosis",
      "retainer-snapshot",
      "Follow evidence from a live root through a callback to the request data it retains.",
      "The module and callback lifetimes identify where the retaining evidence should be inspected."
    ),
    stage(
      6,
      "repair-listener-cleanup",
      "Repair listener cleanup",
      "debug-repair",
      "javascript-listener-closure-cleanup",
      "listener-registration",
      "Repair executable listener code so repeated setup does not duplicate work or retain disposed state.",
      "The retaining path identifies the lifecycle boundary the repair must close."
    ),
    stage(
      7,
      "implement-private-state",
      "Implement bounded private state",
      "micro-implementation",
      "javascript-closure-state-implementation",
      "bounded-counter",
      "Implement closure-backed private state with a small API and idempotent disposal.",
      "This turns the cleanup rules into a deliberately owned closure abstraction."
    ),
    stage(
      8,
      "choose-state-owner",
      "Choose the state owner",
      "production-decision",
      "javascript-state-ownership-decision",
      "state-ownership-record",
      "Choose where long-lived state belongs and defend lifecycle, scaling, and testing trade-offs.",
      "This final decision combines lexical scope, retention evidence, cleanup, and encapsulation from the path."
    )
  ],
  score: sharedScore,
  selectionReason:
    "Selected after the values path because closure reasoning depends on binding and identity fundamentals, then adds lifecycle and retention decisions."
});

const valuesPathV2 = sixQuestionPath(valuesPathV1, {
  mechanismKeys: [
    "reference-identity",
    "shallow-copy",
    "shared-mutation",
    "mutation-boundary",
    "copy-on-write",
    "defensive-copy"
  ],
  coverageExplanation:
    "Six focused questions progress from identity and shallow copying through diagnosis, repair, implementation, and a production copying decision."
});

const closuresPathV2 = sixQuestionPath(closuresPathV1, {
  mechanismKeys: [
    "lexical-scope",
    "loop-binding",
    "garbage-collection-roots",
    "listener-cleanup",
    "encapsulated-state",
    "state-ownership"
  ],
  coverageExplanation:
    "Six focused questions progress from lexical bindings through retention diagnosis, cleanup, encapsulation, and state ownership."
});

const LEGACY_V1_PATHS = deepFreeze([valuesPathV1, closuresPathV1]);

/** Latest reviewed paths used for new candidate snapshots. */
export const NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS: readonly SelectedCoreTechnicalStory[] =
  deepFreeze([valuesPathV2, closuresPathV2]);

export function coreTechnicalPracticePathBlueprint(
  storyKey: string,
  version = 2
): SelectedCoreTechnicalStory | null {
  const paths =
    version === 1
      ? LEGACY_V1_PATHS
      : version === 2
        ? NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS
        : null;
  if (!paths) return null;
  return paths.find((path) => path.key === storyKey) ?? null;
}

function sixQuestionPath(
  path: SelectedCoreTechnicalStory,
  overrides: { mechanismKeys: string[]; coverageExplanation: string }
): SelectedCoreTechnicalStory {
  const selectedStages = [
    path.stages[0],
    path.stages[1],
    path.stages[4],
    path.stages[5],
    path.stages[6],
    path.stages[7]
  ];
  return selectedStorySchema.parse({
    ...path,
    expectedMinutes: 40,
    mechanismKeys: overrides.mechanismKeys,
    coverageExplanation: overrides.coverageExplanation,
    stages: selectedStages.map((item, index) => ({ ...item, order: index + 1 }))
  });
}

function stage(
  order: number,
  key: string,
  title: string,
  format: string,
  patternKey: string,
  artifactKey: string,
  objective: string,
  storyDependency: string
) {
  return { order, key, title, format, patternKey, artifactKey, objective, storyDependency };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
