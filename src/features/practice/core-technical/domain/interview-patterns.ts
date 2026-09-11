import {
  CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  interviewEvidenceSourceSchema,
  parseCoreTechnicalInterviewPatterns,
  technicalSourceSchema,
  type CoreTechnicalInterviewPattern
} from "./contracts";

export const CORE_TECHNICAL_INTERVIEW_EVIDENCE = interviewEvidenceSourceSchema.array().parse([
  {
    id: "nodebook-streams-backpressure",
    kind: "interviewer-guide",
    publisher: "The Node Book",
    title: "Node.js Streams and Backpressure Interview Questions",
    url: "https://www.thenodebook.com/raw-mode/questions/streams-backpressure",
    reviewedAt: "2026-09-06"
  },
  {
    id: "tarmac-javascript-interview-questions",
    kind: "reviewed-question-set",
    publisher: "Tarmac",
    title: "JavaScript Interview Questions",
    url: "https://gettarmac.com/interview-questions/javascript-interview-questions",
    reviewedAt: "2026-09-06"
  },
  {
    id: "openreplay-javascript-interview-questions",
    kind: "reviewed-question-set",
    publisher: "OpenReplay",
    title: "JavaScript Interview Questions That Test Real Understanding",
    url: "https://blog.openreplay.com/10-js-interview-questions-testing/",
    reviewedAt: "2026-09-06"
  },
  {
    id: "greatfrontend-senior-nodejs-questions",
    kind: "reviewed-question-set",
    publisher: "GreatFrontEnd",
    title: "Senior Node.js Developer Interview Questions",
    url: "https://www.greatfrontend.com/pt-BR/blog/senior-nodejs-developer-interview-questions-advanced-topics-and-answers",
    reviewedAt: "2026-09-06"
  },
  {
    id: "interviewchamp-nodejs-questions",
    kind: "reviewed-question-set",
    publisher: "Interview Champ",
    title: "Node.js Interview Questions",
    url: "https://interviewchamp.ai/learn/nodejs-interview-questions-2026",
    reviewedAt: "2026-09-06"
  },
  {
    id: "reddit-javascript-interview-report",
    kind: "first-person-report",
    publisher: "Reddit JavaScript Community",
    title: "JavaScript Technical Interview Experience",
    url: "https://www.reddit.com/r/learnjavascript/comments/1vinp5g/",
    reviewedAt: "2026-09-06"
  },
  {
    id: "reddit-nodejs-interview-report",
    kind: "first-person-report",
    publisher: "Reddit Node.js Community",
    title: "Node.js Interview Experience",
    url: "https://www.reddit.com/r/node/comments/1b7wv2f/",
    reviewedAt: "2026-09-06"
  }
]);

export const CORE_TECHNICAL_SOURCES = technicalSourceSchema.array().parse([
  {
    id: "mdn-equality",
    publisher: "MDN Web Docs",
    title: "Equality comparisons and sameness",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness",
    reviewedAt: "2026-09-06"
  },
  {
    id: "mdn-closures",
    publisher: "MDN Web Docs",
    title: "Closures",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures",
    reviewedAt: "2026-09-06"
  },
  {
    id: "mdn-microtasks",
    publisher: "MDN Web Docs",
    title: "Using microtasks in JavaScript",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide",
    reviewedAt: "2026-09-06"
  },
  {
    id: "mdn-async-functions",
    publisher: "MDN Web Docs",
    title: "async function",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function",
    reviewedAt: "2026-09-06"
  },
  {
    id: "mdn-promise-all",
    publisher: "MDN Web Docs",
    title: "Promise.all",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-event-loop",
    publisher: "Node.js",
    title: "The Node.js event loop, timers, and nextTick",
    url: "https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-stream-backpressure",
    publisher: "Node.js",
    title: "Backpressuring in streams",
    url: "https://nodejs.org/en/learn/modules/backpressuring-in-streams",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-abort-controller",
    publisher: "Node.js",
    title: "AbortController",
    url: "https://nodejs.org/api/globals.html#class-abortcontroller",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-memory-diagnostics",
    publisher: "Node.js",
    title: "Understanding and tuning memory",
    url: "https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-worker-threads",
    publisher: "Node.js",
    title: "Worker threads",
    url: "https://nodejs.org/api/worker_threads.html",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-commonjs",
    publisher: "Node.js",
    title: "CommonJS modules",
    url: "https://nodejs.org/api/modules.html",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-esm",
    publisher: "Node.js",
    title: "ECMAScript modules",
    url: "https://nodejs.org/api/esm.html",
    reviewedAt: "2026-09-06"
  },
  {
    id: "nodejs-test-runner",
    publisher: "Node.js",
    title: "Test runner",
    url: "https://nodejs.org/api/test.html",
    reviewedAt: "2026-09-06"
  }
]);

type PatternInput = Omit<
  CoreTechnicalInterviewPattern,
  "schemaVersion" | "roles" | "languages" | "runtimes" | "frameworks" | "status" | "lastReviewedAt"
> & {
  status?: CoreTechnicalInterviewPattern["status"];
};

function pattern(input: PatternInput): CoreTechnicalInterviewPattern {
  return {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    roles: ["backend", "fullstack"],
    languages: ["javascript"],
    runtimes: ["nodejs"],
    frameworks: [],
    status: "published",
    lastReviewedAt: "2026-09-06",
    ...input
  };
}

export const NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS = parseCoreTechnicalInterviewPatterns([
  // Compatibility patterns remain readable for immutable version-one blocks,
  // but no active path blueprint selects them.
  pattern({
    key: "javascript-identity-mutation-copy",
    status: "retired",
    title: "Trace identity, copying, and nested mutation",
    normalizedPrompt:
      "Given objects that are assigned, shallow-copied, and mutated through nested references, predict the final state and explain each identity relationship.",
    mechanismKeys: ["reference-identity", "shallow-copy", "strict-equality"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["mcq", "predict-explain", "debug-repair"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Separates variable binding from object identity and follows every alias explicitly.",
      "Explains why a spread copy is shallow and identifies which nested values remain shared."
    ],
    commonMistakes: ["Treats object assignment or spread syntax as an automatic deep clone."],
    followUps: [
      "Ask for a safe immutable update and the trade-offs of structuredClone or serialization."
    ]
  }),
  pattern({
    key: "javascript-closure-lifetime",
    status: "retired",
    title: "Explain closure state and retention",
    normalizedPrompt:
      "Diagnose a callback factory whose captured state changes over time and may retain more memory than intended in a long-running service.",
    mechanismKeys: ["lexical-scope", "closure", "garbage-collection-roots"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["predict-explain", "written", "artifact-diagnosis"],
    importance: "essential",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "reddit-javascript-interview-report"
    ],
    technicalSourceIds: ["mdn-closures", "nodejs-memory-diagnostics"],
    expectedSignals: [
      "Explains lexical capture using bindings and execution lifetime rather than vague scope terminology.",
      "Connects retained callbacks or listeners to reachable objects and proposes explicit cleanup."
    ],
    commonMistakes: [
      "Assumes a returned inner function receives a frozen copy of every captured value."
    ],
    followUps: [
      "Ask how the answer changes for let versus var inside a loop that creates callbacks."
    ]
  }),
  pattern({
    key: "javascript-reference-identity",
    title: "Distinguish equal values from shared identity",
    normalizedPrompt:
      "Given primitive values and object references used by a request handler, identify which comparisons test value, which test identity, and which assignments create aliases.",
    mechanismKeys: ["reference-identity", "strict-equality"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["mcq"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Separates primitive value comparison from object reference identity.",
      "Traces aliases from each assignment before predicting any mutation."
    ],
    commonMistakes: ["Assumes two objects with the same fields are strictly equal."],
    followUps: ["Ask how Object.is differs from strict equality for NaN and signed zero."]
  }),
  pattern({
    key: "javascript-shallow-copy-aliasing",
    title: "Predict nested state after a shallow copy",
    normalizedPrompt:
      "Predict the exact result after an object is copied with spread syntax and a nested object is mutated, then explain which references remain shared.",
    mechanismKeys: ["shallow-copy", "reference-identity"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["predict-explain"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Draws the outer and nested references before tracing the write.",
      "Explains that spread creates a new outer object while retaining nested references."
    ],
    commonMistakes: ["Calls object spread a deep copy and predicts independent nested state."],
    followUps: ["Ask how the result changes when the nested object is also spread."]
  }),
  pattern({
    key: "javascript-property-copy-semantics",
    title: "Explain what an object copy preserves",
    normalizedPrompt:
      "Explain what object spread copies from a source object and what it does not preserve, using a practical configuration or domain-object example.",
    mechanismKeys: ["property-copy", "shallow-copy"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["written"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions",
      "reddit-javascript-interview-report"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Distinguishes copying own enumerable values from preserving descriptors or prototypes.",
      "Connects the semantics to a concrete risk instead of listing syntax facts."
    ],
    commonMistakes: ["Treats spread, Object.assign, and cloning as equivalent operations."],
    followUps: ["Ask what happens to getters, symbols, and the object's prototype."]
  }),
  pattern({
    key: "javascript-structured-clone-boundary",
    title: "Choose a safe deep-copy boundary",
    normalizedPrompt:
      "Decide whether structuredClone is appropriate for isolating a request payload, explain unsupported or surprising values, and state when copying is the wrong design.",
    mechanismKeys: ["structured-clone", "defensive-copy"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["mid", "senior"],
    formats: ["spoken", "written"],
    importance: "high",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "greatfrontend-senior-nodejs-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Checks the actual data types and ownership boundary before choosing a clone strategy.",
      "Explains correctness and cost trade-offs without presenting deep cloning as a universal fix."
    ],
    commonMistakes: ["Uses JSON serialization as a lossless deep-clone solution for every value."],
    followUps: ["Ask when validation plus reconstruction is safer than cloning an input object."]
  }),
  pattern({
    key: "javascript-shared-state-mutation",
    title: "Diagnose mutation shared across requests",
    normalizedPrompt:
      "Use logs and a small state snapshot to diagnose why one request changes data observed by another request in the same Node.js process.",
    mechanismKeys: ["shared-mutation", "reference-identity"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["mid", "senior"],
    formats: ["artifact-diagnosis"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Identifies the shared reference and its owner from evidence before proposing a fix.",
      "Separates cross-request process state from database or distributed-state concerns."
    ],
    commonMistakes: ["Blames asynchronous timing without identifying the shared mutable object."],
    followUps: ["Ask how the diagnosis changes when several Node.js processes are running."]
  }),
  pattern({
    key: "javascript-mutation-boundary-repair",
    title: "Repair an accidental mutation boundary",
    normalizedPrompt:
      "Repair a function that mutates a caller-owned object, preserve its intended output, and explain the ownership contract the corrected code establishes.",
    mechanismKeys: ["mutation-boundary", "shallow-copy"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["debug-repair"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "States which object the caller owns and which value the function may create or mutate.",
      "Repairs nested writes deliberately and verifies both result and input preservation."
    ],
    commonMistakes: [
      "Copies only the outer object while continuing to mutate a shared nested value."
    ],
    followUps: ["Ask whether documenting mutation would ever be preferable to copying."]
  }),
  pattern({
    key: "javascript-immutable-nested-update",
    title: "Implement an immutable nested update",
    normalizedPrompt:
      "Implement a small nested update that preserves untouched references, replaces every changed branch, and leaves the original input unchanged.",
    mechanismKeys: ["copy-on-write", "reference-identity"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["micro-implementation"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Copies every changed path and preserves identity for unrelated branches.",
      "Uses tests to prove the result and original object have the intended identities."
    ],
    commonMistakes: ["Deep-copies the entire graph or mutates one nested branch in place."],
    followUps: ["Ask how the approach changes for arrays and repeated updates."]
  }),
  pattern({
    key: "javascript-copy-strategy-decision",
    title: "Choose a production copying strategy",
    normalizedPrompt:
      "Choose between mutation, shallow copying, selective immutable updates, and deep cloning for a concrete service boundary with correctness and performance constraints.",
    mechanismKeys: ["defensive-copy", "state-ownership"],
    topicKeys: ["javascript-values-and-mutation"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["production-decision", "spoken", "written"],
    importance: "high",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-equality"],
    expectedSignals: [
      "Defines ownership and mutation guarantees before selecting an implementation.",
      "Balances isolation, allocation cost, object size, and change frequency."
    ],
    commonMistakes: ["Says immutability is always faster or deep cloning is always safer."],
    followUps: ["Ask what metrics or tests would validate the chosen boundary in production."]
  }),
  pattern({
    key: "javascript-lexical-scope-resolution",
    title: "Resolve a name through lexical scope",
    normalizedPrompt:
      "Given nested functions and shadowed bindings in ordinary application code, identify which binding each read uses and explain why call location does not change lexical scope.",
    mechanismKeys: ["lexical-scope"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["mcq"],
    importance: "essential",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "reddit-javascript-interview-report"
    ],
    technicalSourceIds: ["mdn-closures"],
    expectedSignals: [
      "Walks outward through lexical environments from the function definition.",
      "Distinguishes shadowing from mutation of an outer binding."
    ],
    commonMistakes: ["Looks for variables at the function's call site instead of definition site."],
    followUps: ["Ask how the temporal dead zone affects a shadowed let binding."]
  }),
  pattern({
    key: "javascript-loop-closure-binding",
    title: "Predict callbacks created inside a loop",
    normalizedPrompt:
      "Predict what callbacks created in a loop will read later, compare var with let, and explain the result in terms of bindings rather than memorized output.",
    mechanismKeys: ["loop-binding", "closure"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["predict-explain"],
    importance: "essential",
    evidenceSourceIds: [
      "tarmac-javascript-interview-questions",
      "openreplay-javascript-interview-questions"
    ],
    technicalSourceIds: ["mdn-closures"],
    expectedSignals: [
      "Explains one shared var binding versus a per-iteration let binding.",
      "Traces when the callback executes and what binding it closes over."
    ],
    commonMistakes: ["Says asynchronous callbacks copy the current loop value automatically."],
    followUps: ["Ask for a correct repair when the loop must remain written with var."]
  }),
  pattern({
    key: "javascript-closure-state-lifetime",
    title: "Explain state held by a closure",
    normalizedPrompt:
      "Explain how a returned function continues to access and update a private binding after its outer function returns, including when that state becomes collectible.",
    mechanismKeys: ["closure", "lexical-scope"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["written"],
    importance: "essential",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "reddit-javascript-interview-report"
    ],
    technicalSourceIds: ["mdn-closures"],
    expectedSignals: [
      "Describes a closure as a function plus access to its lexical environment.",
      "Explains lifetime through reachability rather than assuming outer locals disappear immediately."
    ],
    commonMistakes: ["Claims a closure freezes a copy of every captured value."],
    followUps: ["Ask whether two counters created by separate factory calls share state."]
  }),
  pattern({
    key: "javascript-module-state-boundary",
    title: "Explain module-scoped state across requests",
    normalizedPrompt:
      "Explain why module-scoped mutable state can be observed by multiple requests in one Node.js process and define a safer ownership boundary.",
    mechanismKeys: ["module-state", "state-ownership"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["mid", "senior"],
    formats: ["spoken", "written"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-closures", "nodejs-commonjs"],
    expectedSignals: [
      "Connects module lifetime to process lifetime and request reuse.",
      "Distinguishes safe immutable configuration from unsafe request-specific mutable state."
    ],
    commonMistakes: ["Assumes every incoming request receives a fresh module instance."],
    followUps: ["Ask how multiple processes or serverless instances change the guarantee."]
  }),
  pattern({
    key: "javascript-closure-retention-diagnosis",
    title: "Find data retained by a callback",
    normalizedPrompt:
      "Inspect a heap or listener snapshot and identify how a long-lived callback keeps a larger object graph reachable than intended.",
    mechanismKeys: ["garbage-collection-roots", "closure"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["artifact-diagnosis"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-closures", "nodejs-memory-diagnostics"],
    expectedSignals: [
      "Follows the retaining path from a live root through the callback environment.",
      "Uses reachability evidence instead of treating every closure as a memory leak."
    ],
    commonMistakes: ["Calls memory growth a closure leak without locating a retaining root."],
    followUps: ["Ask which heap-snapshot comparison would verify the diagnosis."]
  }),
  pattern({
    key: "javascript-listener-closure-cleanup",
    title: "Repair a listener that retains request state",
    normalizedPrompt:
      "Repair code that registers a closure as a long-lived listener, leaks request data, and may run duplicate handlers after repeated setup.",
    mechanismKeys: ["listener-cleanup", "garbage-collection-roots"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["mid", "senior"],
    formats: ["debug-repair"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-closures", "nodejs-memory-diagnostics"],
    expectedSignals: [
      "Keeps a stable handler reference and removes it at the owning lifecycle boundary.",
      "Avoids capturing an entire request object when only a small immutable value is needed."
    ],
    commonMistakes: [
      "Calls removeListener with a new anonymous function that cannot match the registered handler."
    ],
    followUps: ["Ask how the repair behaves when setup fails halfway through."]
  }),
  pattern({
    key: "javascript-closure-state-implementation",
    title: "Implement bounded private state with a closure",
    normalizedPrompt:
      "Implement a small closure-based component with private state, an explicit update API, and a cleanup operation that releases retained resources.",
    mechanismKeys: ["encapsulated-state", "closure"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["micro-implementation"],
    importance: "high",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "reddit-javascript-interview-report"
    ],
    technicalSourceIds: ["mdn-closures"],
    expectedSignals: [
      "Exposes only the operations required by the caller and keeps state inaccessible directly.",
      "Makes disposal idempotent and prevents work after cleanup."
    ],
    commonMistakes: ["Returns the private mutable object and defeats the ownership boundary."],
    followUps: ["Ask when a class or explicit state object would be easier to maintain."]
  }),
  pattern({
    key: "javascript-state-ownership-decision",
    title: "Choose where long-lived state should live",
    normalizedPrompt:
      "Choose between closure state, module state, an explicit instance, and an external store for a concrete service requirement, including lifecycle and scaling trade-offs.",
    mechanismKeys: ["state-ownership", "module-state"],
    topicKeys: ["javascript-scope-and-closures"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["production-decision", "spoken", "written"],
    importance: "high",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-closures", "nodejs-memory-diagnostics"],
    expectedSignals: [
      "Starts from ownership, lifetime, concurrency, and process-boundary requirements.",
      "States cleanup and observability responsibilities for the selected design."
    ],
    commonMistakes: [
      "Chooses global module state without considering process multiplicity or test isolation."
    ],
    followUps: ["Ask how the choice changes when state must survive a process restart."]
  }),
  pattern({
    key: "javascript-event-loop-order",
    title: "Predict event-loop ordering",
    normalizedPrompt:
      "Predict the exact output of code mixing synchronous work, promises, queueMicrotask, timers, and Node.js scheduling, then justify the order.",
    mechanismKeys: ["event-loop", "microtask-queue", "timer-queue"],
    topicKeys: ["async-scheduling"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["mcq", "predict-explain", "spoken"],
    importance: "essential",
    evidenceSourceIds: ["tarmac-javascript-interview-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["mdn-microtasks", "nodejs-event-loop"],
    expectedSignals: [
      "Builds the ordering from synchronous execution, microtask draining, and event-loop phases.",
      "Calls out Node-specific scheduling only when it is relevant to the supplied runtime context."
    ],
    commonMistakes: [
      "Explains all asynchronous callbacks as one FIFO queue and guesses the final output."
    ],
    followUps: ["Add recursive microtasks and ask about starvation and observable service impact."]
  }),
  pattern({
    key: "javascript-promise-concurrency",
    title: "Design bounded promise concurrency",
    normalizedPrompt:
      "Implement or review a batch operation that must run independent tasks concurrently without overwhelming a downstream dependency.",
    mechanismKeys: ["promise-concurrency", "fail-fast", "concurrency-limit"],
    topicKeys: ["async-scheduling"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["written", "micro-implementation", "production-decision"],
    importance: "essential",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "greatfrontend-senior-nodejs-questions"
    ],
    technicalSourceIds: ["mdn-promise-all", "mdn-async-functions"],
    expectedSignals: [
      "Distinguishes sequential awaiting, unbounded concurrency, and deliberately bounded concurrency.",
      "Chooses failure semantics explicitly and preserves result-to-input association."
    ],
    commonMistakes: [
      "Uses Promise.all over an unbounded input and ignores downstream capacity or partial failure."
    ],
    followUps: ["Require retries with jitter while preserving the same global concurrency limit."]
  }),
  pattern({
    key: "javascript-async-error-propagation",
    title: "Preserve errors across async boundaries",
    normalizedPrompt:
      "Trace a failure through async functions and promise chains, repair missing awaits or catches, and define where recovery belongs.",
    mechanismKeys: ["promise-rejection", "async-stack", "error-boundary"],
    topicKeys: ["errors-and-cancellation"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["written", "debug-repair", "spoken"],
    importance: "essential",
    evidenceSourceIds: ["tarmac-javascript-interview-questions", "interviewchamp-nodejs-questions"],
    technicalSourceIds: ["mdn-async-functions"],
    expectedSignals: [
      "Tracks returned and awaited promises precisely and preserves the original failure context.",
      "Places recovery at an ownership boundary instead of catching and silently discarding errors."
    ],
    commonMistakes: [
      "Adds try-catch around a promise that is neither awaited nor returned from the protected block."
    ],
    followUps: [
      "Ask how to represent expected domain failure separately from an unexpected operational fault."
    ]
  }),
  pattern({
    key: "nodejs-event-loop-blocking",
    title: "Diagnose event-loop blocking",
    normalizedPrompt:
      "A Node.js endpoint has acceptable throughput but severe tail latency during CPU-heavy requests; diagnose the mechanism and choose an isolation strategy.",
    mechanismKeys: ["event-loop-lag", "cpu-bound-work", "libuv"],
    topicKeys: ["nodejs-event-loop-health"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["spoken", "artifact-diagnosis", "production-decision"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["nodejs-event-loop"],
    expectedSignals: [
      "Separates asynchronous I/O from JavaScript CPU work and connects blocking to tail latency.",
      "Requests event-loop delay and profiling evidence before selecting workers or another service."
    ],
    commonMistakes: [
      "Claims async syntax automatically moves CPU-heavy JavaScript off the main thread."
    ],
    followUps: ["Ask for overload behavior when the worker pool queue reaches its capacity."]
  }),
  pattern({
    key: "nodejs-stream-backpressure",
    title: "Repair a stream pipeline with backpressure",
    normalizedPrompt:
      "Fix a file or network transformation pipeline whose memory grows under a slow consumer, while preserving errors and cleanup.",
    mechanismKeys: ["stream", "backpressure", "high-water-mark"],
    topicKeys: ["nodejs-streams-and-io"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["artifact-diagnosis", "debug-repair", "micro-implementation"],
    importance: "essential",
    evidenceSourceIds: ["nodebook-streams-backpressure", "greatfrontend-senior-nodejs-questions"],
    technicalSourceIds: ["nodejs-stream-backpressure"],
    expectedSignals: [
      "Explains the writable signal and waits for demand instead of accumulating unbounded buffers.",
      "Uses pipeline-style composition so failures destroy connected resources and reject the operation."
    ],
    commonMistakes: [
      "Continues writing after the destination reports pressure or buffers the entire input first."
    ],
    followUps: [
      "Ask how object mode and highWaterMark change throughput and memory characteristics."
    ]
  }),
  pattern({
    key: "nodejs-request-cancellation",
    title: "Propagate request cancellation",
    normalizedPrompt:
      "Design a request path whose database or network work must stop when the caller disconnects or the latency budget expires.",
    mechanismKeys: ["abort-signal", "timeout-budget", "resource-cleanup"],
    topicKeys: ["errors-and-cancellation"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["written", "production-decision", "micro-implementation"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "interviewchamp-nodejs-questions"],
    technicalSourceIds: ["nodejs-abort-controller"],
    expectedSignals: [
      "Propagates one cancellation signal through every supported dependency and removes listeners afterward.",
      "Distinguishes cancellation from ordinary failure and defines timeout ownership at the boundary."
    ],
    commonMistakes: [
      "Returns early to the client but leaves expensive downstream work running without ownership."
    ],
    followUps: ["Ask how to combine a caller signal with an internal service timeout safely."]
  }),
  pattern({
    key: "nodejs-resource-leak-diagnosis",
    title: "Diagnose a long-running Node.js leak",
    normalizedPrompt:
      "Investigate a service whose memory or active handles increase over hours and identify the retaining lifecycle from runtime evidence.",
    mechanismKeys: ["heap-retention", "active-handles", "resource-cleanup"],
    topicKeys: ["nodejs-resource-lifecycle"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["artifact-diagnosis", "production-decision"],
    importance: "essential",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["nodejs-memory-diagnostics"],
    expectedSignals: [
      "Differentiates heap growth, external memory, and active handles before proposing a cause.",
      "Uses repeatable snapshots or profiles to locate retaining paths and verify cleanup."
    ],
    commonMistakes: [
      "Treats high resident memory as proof of a JavaScript heap leak without trend or retention evidence."
    ],
    followUps: [
      "Introduce an unbounded cache and ask for eviction, observability, and ownership rules."
    ]
  }),
  pattern({
    key: "nodejs-worker-thread-isolation",
    title: "Choose and operate worker-thread isolation",
    normalizedPrompt:
      "Move CPU-heavy transformation work away from the event loop and design a bounded worker pool with failure and shutdown behavior.",
    mechanismKeys: ["worker-thread", "message-passing", "worker-pool"],
    topicKeys: ["nodejs-work-isolation"],
    seniorities: ["mid", "senior", "staff"],
    formats: ["spoken", "production-decision", "micro-implementation"],
    importance: "essential",
    evidenceSourceIds: ["interviewchamp-nodejs-questions", "reddit-nodejs-interview-report"],
    technicalSourceIds: ["nodejs-worker-threads"],
    expectedSignals: [
      "Uses workers for CPU-heavy JavaScript rather than ordinary asynchronous I/O.",
      "Accounts for serialization cost, bounded queues, worker failure, cancellation, and graceful shutdown."
    ],
    commonMistakes: [
      "Creates one new worker per request and ignores startup cost or overload behavior."
    ],
    followUps: ["Ask when a separate service is preferable to worker threads in the same process."]
  }),
  pattern({
    key: "nodejs-commonjs-esm-boundary",
    title: "Debug a CommonJS and ESM boundary",
    normalizedPrompt:
      "Repair a package that behaves differently between require and import, then explain evaluation and package export decisions.",
    mechanismKeys: ["commonjs", "esm", "package-exports"],
    topicKeys: ["javascript-modules"],
    seniorities: ["mid", "senior"],
    formats: ["mcq", "written", "debug-repair", "spoken"],
    importance: "high",
    evidenceSourceIds: ["greatfrontend-senior-nodejs-questions", "interviewchamp-nodejs-questions"],
    technicalSourceIds: ["nodejs-commonjs", "nodejs-esm"],
    expectedSignals: [
      "Uses package type, file extension, exports, and loader rules to explain the observed behavior.",
      "Avoids fragile default-import assumptions and proposes an explicit supported package boundary."
    ],
    commonMistakes: [
      "Treats CommonJS and ES modules as syntax-only choices with identical loading semantics."
    ],
    followUps: [
      "Ask how to publish dual entry points without creating two copies of singleton state."
    ]
  }),
  pattern({
    key: "nodejs-deterministic-async-testing",
    title: "Make an async test deterministic",
    normalizedPrompt:
      "Repair a flaky asynchronous test that relies on sleeps, leaked handles, or shared state and make its completion conditions explicit.",
    mechanismKeys: ["fake-time", "test-isolation", "runtime-diagnostics"],
    topicKeys: ["nodejs-testing-and-diagnostics"],
    seniorities: ["junior", "mid", "senior"],
    formats: ["written", "debug-repair", "artifact-diagnosis"],
    importance: "essential",
    evidenceSourceIds: [
      "openreplay-javascript-interview-questions",
      "greatfrontend-senior-nodejs-questions"
    ],
    technicalSourceIds: ["nodejs-test-runner"],
    expectedSignals: [
      "Waits on observable completion rather than elapsed wall-clock guesses and isolates mutable state.",
      "Finds leaked timers or handles and guarantees teardown even when the assertion fails."
    ],
    commonMistakes: [
      "Increases an arbitrary sleep duration and calls the test stable without removing the race."
    ],
    followUps: [
      "Ask how fake timers can hide integration behavior and where a real-clock test still belongs."
    ]
  })
]);
