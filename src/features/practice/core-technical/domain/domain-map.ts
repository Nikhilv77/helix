import { CORE_TECHNICAL_CATALOG_SCHEMA_VERSION, parseCoreTechnicalDomainMap } from "./contracts";

export const NODEJS_CORE_TECHNICAL_DOMAIN_MAP = parseCoreTechnicalDomainMap({
  schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  key: "nodejs-core-technical",
  title: "JavaScript and Node.js Core Technical",
  roles: ["backend", "fullstack"],
  language: "javascript",
  runtime: "nodejs",
  runtimeVersion: "22 LTS",
  lastReviewedAt: "2026-09-06",
  topics: [
    {
      key: "javascript-values-and-mutation",
      title: "Values, identity, copying, and mutation",
      importance: "essential",
      description:
        "Reason about reference identity, shallow copies, nested mutation, and equality without relying on memorized output.",
      mechanismKeys: [
        "reference-identity",
        "shallow-copy",
        "strict-equality",
        "property-copy",
        "structured-clone",
        "shared-mutation",
        "mutation-boundary",
        "copy-on-write",
        "defensive-copy"
      ],
      prerequisiteTopicKeys: [],
      interviewPatternKeys: [
        "javascript-reference-identity",
        "javascript-shallow-copy-aliasing",
        "javascript-property-copy-semantics",
        "javascript-structured-clone-boundary",
        "javascript-shared-state-mutation",
        "javascript-mutation-boundary-repair",
        "javascript-immutable-nested-update",
        "javascript-copy-strategy-decision"
      ]
    },
    {
      key: "javascript-scope-and-closures",
      title: "Scope, closures, and retained state",
      importance: "essential",
      description:
        "Explain lexical scope, closure lifetime, captured variables, and the production consequences of retaining state.",
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
      prerequisiteTopicKeys: ["javascript-values-and-mutation"],
      interviewPatternKeys: [
        "javascript-lexical-scope-resolution",
        "javascript-loop-closure-binding",
        "javascript-closure-state-lifetime",
        "javascript-module-state-boundary",
        "javascript-closure-retention-diagnosis",
        "javascript-listener-closure-cleanup",
        "javascript-closure-state-implementation",
        "javascript-state-ownership-decision"
      ]
    },
    {
      key: "javascript-modules",
      title: "CommonJS and ES module boundaries",
      importance: "high",
      description:
        "Choose and debug module boundaries, package exports, evaluation timing, and CommonJS to ES module interoperability.",
      mechanismKeys: ["commonjs", "esm", "package-exports"],
      prerequisiteTopicKeys: ["javascript-values-and-mutation"],
      interviewPatternKeys: ["nodejs-commonjs-esm-boundary"]
    },
    {
      key: "async-scheduling",
      title: "Asynchronous scheduling and concurrency",
      importance: "essential",
      description:
        "Predict task ordering and design bounded asynchronous work using promises, microtasks, timers, and concurrency controls.",
      mechanismKeys: ["event-loop", "microtask-queue", "promise-concurrency"],
      prerequisiteTopicKeys: ["javascript-scope-and-closures"],
      interviewPatternKeys: ["javascript-event-loop-order", "javascript-promise-concurrency"]
    },
    {
      key: "errors-and-cancellation",
      title: "Errors, timeouts, and cancellation",
      importance: "essential",
      description:
        "Preserve failures across asynchronous boundaries and stop abandoned work with explicit timeout and cancellation ownership.",
      mechanismKeys: ["promise-rejection", "abort-signal", "timeout-budget"],
      prerequisiteTopicKeys: ["async-scheduling"],
      interviewPatternKeys: ["javascript-async-error-propagation", "nodejs-request-cancellation"]
    },
    {
      key: "nodejs-event-loop-health",
      title: "Node.js event-loop health",
      importance: "essential",
      description:
        "Recognize event-loop starvation, distinguish CPU work from asynchronous I/O, and protect service latency under load.",
      mechanismKeys: ["event-loop-lag", "cpu-bound-work", "libuv"],
      prerequisiteTopicKeys: ["async-scheduling"],
      interviewPatternKeys: ["nodejs-event-loop-blocking"]
    },
    {
      key: "nodejs-streams-and-io",
      title: "Streams, buffers, and backpressure",
      importance: "essential",
      description:
        "Build memory-safe data pipelines by respecting stream pressure, buffer limits, error propagation, and cleanup.",
      mechanismKeys: ["stream", "backpressure", "high-water-mark"],
      prerequisiteTopicKeys: ["async-scheduling"],
      interviewPatternKeys: ["nodejs-stream-backpressure"]
    },
    {
      key: "nodejs-resource-lifecycle",
      title: "Resource lifecycle and leak diagnosis",
      importance: "essential",
      description:
        "Find and prevent leaks caused by listeners, timers, caches, handles, closures, and incorrectly scoped application state.",
      mechanismKeys: ["heap-retention", "active-handles", "resource-cleanup"],
      prerequisiteTopicKeys: ["javascript-scope-and-closures", "errors-and-cancellation"],
      interviewPatternKeys: ["nodejs-resource-leak-diagnosis"]
    },
    {
      key: "nodejs-work-isolation",
      title: "CPU work isolation and worker threads",
      importance: "essential",
      description:
        "Decide when CPU-heavy work needs worker isolation and account for message passing, pools, failure, and cancellation.",
      mechanismKeys: ["worker-thread", "message-passing", "worker-pool"],
      prerequisiteTopicKeys: ["nodejs-event-loop-health"],
      interviewPatternKeys: ["nodejs-worker-thread-isolation"]
    },
    {
      key: "nodejs-testing-and-diagnostics",
      title: "Deterministic testing and diagnostics",
      importance: "essential",
      description:
        "Test asynchronous behavior without timing guesses and use runtime evidence to diagnose failures, stalls, and leaks.",
      mechanismKeys: ["fake-time", "test-isolation", "runtime-diagnostics"],
      prerequisiteTopicKeys: ["errors-and-cancellation", "nodejs-resource-lifecycle"],
      interviewPatternKeys: ["nodejs-deterministic-async-testing"]
    }
  ]
});
