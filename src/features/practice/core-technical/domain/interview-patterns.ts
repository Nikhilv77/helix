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
>;

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
  pattern({
    key: "javascript-identity-mutation-copy",
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
