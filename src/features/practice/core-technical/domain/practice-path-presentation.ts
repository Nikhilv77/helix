import type { SelectedCoreTechnicalStory } from "./story-contracts";

type PracticePathPresentation = Pick<
  SelectedCoreTechnicalStory,
  "title" | "premise" | "incident" | "candidateRole"
> & { legacyTitle: string };

const LEGACY_PATH_PRESENTATIONS: Readonly<Record<string, PracticePathPresentation>> = {
  "follow-the-operation": {
    legacyTitle: "Follow the operation",
    title: "Fix common JavaScript and Node.js runtime bugs",
    premise:
      "Work through eight common interview tasks using short code samples, logs, and request-lifecycle evidence.",
    incident:
      "Start with concrete Node.js behaviour: unexpected values, execution order, retained state, async errors, flaky tests, module loading, streams, and cancellation. Explain or fix one mechanism at a time.",
    candidateRole:
      "For each task, read the evidence, explain the JavaScript or Node.js mechanism, and give the smallest safe fix."
  },
  "the-operation-fails-halfway": {
    legacyTitle: "The operation fails halfway",
    title: "Fix failures in a Node.js request pipeline",
    premise:
      "Debug eight interview-ready Node.js problems involving modules, async errors, cancellation, memory, streams, concurrency, and event-loop health.",
    incident:
      "A request fails during database and downstream work: errors lose context, cancelled calls keep running, memory grows, and slow consumers create backpressure. Use the supplied code, logs, and constraints to identify and fix each cause.",
    candidateRole:
      "Treat each question like a real interview task: identify the evidence, name the mechanism, and defend a practical production fix."
  }
};

const INTERVIEW_TASK_TITLES: Readonly<Record<string, string>> = {
  "javascript-identity-mutation-copy": "Trace and fix accidental object mutation",
  "javascript-event-loop-order": "Predict Node.js event-loop output",
  "javascript-closure-lifetime": "Explain what this closure keeps in memory",
  "javascript-async-error-propagation": "Preserve an error across async boundaries",
  "nodejs-deterministic-async-testing": "Make this async test deterministic",
  "nodejs-commonjs-esm-boundary": "Fix a CommonJS and ESM import error",
  "nodejs-stream-backpressure": "Fix a stream that keeps consuming memory",
  "nodejs-request-cancellation": "Stop work when a request is cancelled",
  "nodejs-resource-leak-diagnosis": "Find what is retaining memory",
  "javascript-promise-concurrency": "Build a bounded concurrency pool",
  "nodejs-event-loop-blocking": "Move CPU-heavy work off the event loop"
};

const LEGACY_QUESTION_PROMPTS: Readonly<Record<string, string>> = {
  "module-boundary-diagnosis-mcq-exports":
    "Your Node.js service throws ERR_MODULE_NOT_FOUND when an ES module imports the supplied utility package. Inspect its package export manifest, choose the change that fixes resolution, and explain why Node.js rejects the current path.",
  "event-loop-ordering-analysis-candidate-two":
    "You are given the supplied Node.js scheduling snippet. Predict the exact output order, then explain where nextTick callbacks, promise microtasks, timers, and immediates run before you suggest any code change.",
  "async-error-propagation-repair-candidate-two":
    "A request wraps database work in a Promise, and failures either disappear or lose useful stack context. Use the supplied code to explain what is wrong and show how you would rewrite the boundary with async and await.",
  "abort-signal-propagation-design":
    "A user closes an HTTP request, but the database query and downstream fetch continue running. Using the supplied sequence, explain how you would propagate one AbortSignal and remove listeners without hiding the original failure.",
  "heap-snapshot-event-listener-leak":
    "This Node.js process gains about 50 MB every hour. Read the supplied heap and active-handle evidence, identify what retains the objects, and explain the smallest cleanup change you would verify first.",
  "stream-backpressure-debug-primary":
    "A Transform stream reads a large file faster than a slow database destination can consume it, so memory keeps growing. Diagnose the supplied pipeline and repair it so backpressure bounds buffering and errors still propagate.",
  "concurrency-limiter-batch-processor":
    "A batch job sends hundreds of requests at once and receives 429 responses. Implement the supplied pool function with a strict concurrency limit while preserving input order and returning both fulfilled and rejected results.",
  "event-loop-health-defense-written":
    "CPU-heavy validation makes this Node.js API unresponsive under load. Explain why setImmediate chunking is insufficient here, then choose and defend a bounded worker-thread design using the supplied event-loop evidence.",
  "trace-identity-mutation-mcq":
    "You are given a JavaScript object-copying example whose nested value changes unexpectedly. Predict the visible result, identify which references are shared, and choose the smallest copy strategy that prevents one update from mutating another request's state.",
  "predict-event-loop-ordering-v1":
    "You are given a short Node.js program that mixes synchronous code, promises, nextTick, timers, and immediates. Predict the exact output order and explain each transition using the event-loop and microtask rules.",
  "diagnose-closure-retention-written":
    "A request completes, but a large object remains in memory because a returned callback still references it. Use the supplied code to trace the closure, explain the retaining path, and propose a safe way to release unnecessary state.",
  "preserve-async-errors-spoken":
    "An async request fails, but the caller receives no useful error and local try-catch never runs. Explain how the supplied promise chain loses the rejection and where you would await, rethrow, or recover.",
  "deterministic-async-test-artifact-diagnosis":
    "This async test passes locally and fails in CI depending on timing. Inspect the supplied test, identify the uncontrolled scheduler or clock assumption, and explain how you would make the assertion deterministic without adding longer sleeps.",
  "debug-module-boundary-esm-repair":
    "A Node.js package works through require but fails when imported as an ES module. Debug the supplied package boundary and repair its exports or import usage without depending on transpiler-only behavior.",
  "repair-stream-pipeline-implementation-one":
    "A slow writable destination causes this stream pipeline to buffer until the process runs out of memory. Repair the supplied implementation so it respects backpressure, propagates errors, and cleans up every stream on failure.",
  "propagate-cancellation-written":
    "A client disconnects, but its database and HTTP work continue in the background. Explain how you would carry an AbortSignal through the supplied request path, stop owned work, and clean up cancellation listeners."
};

/** Keeps legacy internal story keys while presenting concrete interview tasks to candidates. */
export function coreTechnicalPracticePathPresentation(
  story: SelectedCoreTechnicalStory
): SelectedCoreTechnicalStory {
  const presentation = LEGACY_PATH_PRESENTATIONS[story.key];
  if (!presentation || story.title !== presentation.legacyTitle) return story;
  return {
    ...story,
    title: presentation.title,
    premise: presentation.premise,
    incident: presentation.incident,
    candidateRole: presentation.candidateRole,
    stages: story.stages.map((stage) => ({
      ...stage,
      title: INTERVIEW_TASK_TITLES[stage.patternKey] ?? stage.title
    }))
  };
}

export function coreTechnicalPracticePathTitle(storyKey: string, storedTitle: string): string {
  const presentation = LEGACY_PATH_PRESENTATIONS[storyKey];
  return presentation?.legacyTitle === storedTitle ? presentation.title : storedTitle;
}

export function coreTechnicalPracticeQuestionPrompt(question: {
  questionKey: string;
  prompt: string;
}): string {
  return LEGACY_QUESTION_PROMPTS[question.questionKey] ?? question.prompt;
}

export function coreTechnicalPracticePathReason(
  reason: string,
  storyKey: string,
  storedTitle: string
): string {
  return reason
    .replaceAll(storedTitle, coreTechnicalPracticePathTitle(storyKey, storedTitle))
    .replace(/\bstory\b/gi, "practice path");
}
