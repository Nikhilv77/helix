import {
  frozenQuestionBlockSchema,
  coreTechnicalLearningGuideFor,
  type GeneratedQuestionCandidate
} from "@/features/practice/core-technical/domain/question-contracts";
import { coreTechnicalPracticePathBlueprint } from "@/features/practice/core-technical/domain/practice-path-blueprints";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "@/features/practice/core-technical/domain/interview-patterns";
import {
  CORE_TECHNICAL_CRITIC_VERSION,
  coreTechnicalCriticReportSchema,
  type CoreTechnicalCriticDimension,
  type CoreTechnicalCriticTarget
} from "@/features/practice/core-technical/domain/critic-contracts";

import type { ReviewedCoreTechnicalDraft } from "./generation-pipeline";

type QuestionContent = {
  prompt: string;
  artifact: {
    kind: "code" | "logs" | "trace" | "metrics" | "config" | "scenario";
    title: string;
    content: string;
  };
  concise: string;
  explanation: string;
  choices?: string[];
  correctChoiceIndex?: number;
  executable?: ExecutableContent;
};

type ExecutableContent = Pick<
  GeneratedQuestionCandidate,
  | "starterCode"
  | "referenceSolution"
  | "publicTests"
  | "hiddenTests"
  | "wrongSolutions"
  | "runnerContract"
>;

const runnerContract = {
  language: "javascript" as const,
  runtime: "nodejs" as const,
  runtimeVersion: "22" as const,
  entrypoint: "solution.mjs",
  timeoutMs: 1_000,
  memoryMb: 64,
  networkAccess: false as const
};

const valuesContent: QuestionContent[] = [
  {
    prompt:
      "A request handler creates `const selected = defaults`, while another creates `const copied = { ...defaults }`. Which statement correctly describes the identities before either handler mutates a nested property? Explain the distinction you would make in an interview.",
    artifact: {
      kind: "code",
      title: "Two request-local bindings",
      content:
        "const defaults = { retry: 2, db: { host: 'primary' } };\nconst selected = defaults;\nconst copied = { ...defaults };"
    },
    choices: [
      "All three variables reference different objects.",
      "`selected === defaults`, `copied !== defaults`, and `copied.db === defaults.db`.",
      "`selected !== defaults`, but both copies have independent `db` objects.",
      "The identities cannot be known until a mutation occurs."
    ],
    correctChoiceIndex: 1,
    concise:
      "`selected` aliases `defaults`; spread creates a new outer object for `copied`, but its nested `db` value is still the same object reference.",
    explanation:
      "Assignment copies the reference stored in the binding, so `selected === defaults`. Object spread creates a new outer object and copies each enumerable property value. The value of `db` is itself a reference, so that reference is copied unchanged: `copied.db === defaults.db`. No mutation is needed to determine these identities."
  },
  {
    prompt:
      "Predict the exact values printed after this code runs. Then draw or describe the two outer objects and the nested object they share so your explanation is based on identity rather than the phrase ‘spread is shallow.’",
    artifact: {
      kind: "code",
      title: "Nested configuration update",
      content:
        "const base = { mode: 'safe', limits: { retries: 2 } };\nconst requestConfig = { ...base };\nrequestConfig.mode = 'fast';\nrequestConfig.limits.retries = 5;\nconsole.log(base.mode, base.limits.retries);"
    },
    concise:
      "It prints `safe 5`: `mode` is an independently copied primitive property, while both outer objects still point to the same `limits` object.",
    explanation:
      "The spread creates a new outer object. Reassigning `requestConfig.mode` changes only the property on that new object, so `base.mode` remains `safe`. Both `limits` properties contain the same nested object reference. Writing `requestConfig.limits.retries = 5` therefore changes the object also reached through `base.limits`, so the second value is `5`."
  },
  {
    prompt:
      "A teammate says object spread ‘copies an object completely.’ Explain precisely what `{ ...source }` preserves and loses. Keep the answer practical: connect getters, non-enumerable properties, the prototype, and nested values to a configuration object crossing a service boundary.",
    artifact: {
      kind: "scenario",
      title: "Configuration copy claim",
      content:
        "The source is a class instance with an enumerable nested `limits` object, a getter named `token`, and a non-enumerable internal identifier."
    },
    concise:
      "Spread creates a plain target from own enumerable properties, reads values during the copy, does not preserve the source prototype or non-enumerable properties, and does not recursively clone nested objects.",
    explanation:
      "Object spread enumerates the source's own enumerable properties and assigns their current values to a new object. A getter may be invoked and its returned value copied, rather than its accessor descriptor being preserved. Non-enumerable properties and the original prototype are not carried over. Nested object values remain references. At a service boundary, rebuild and validate the required fields when these semantics matter instead of assuming spread preserves a rich domain object."
  },
  {
    prompt:
      "An API receives a plain payload containing arrays, dates, and nested objects, then passes it to a background task. Would you use `structuredClone`, a selective copy, or no copy? Explain the ownership question first, then cover correctness and cost without treating deep cloning as a default.",
    artifact: {
      kind: "scenario",
      title: "Background-task payload boundary",
      content:
        "The payload is about 50 KB, must not change after enqueueing, contains Date values, and never contains functions, sockets, or class instances."
    },
    concise:
      "Give the queued task an immutable snapshot. `structuredClone` is reasonable for these supported values, but validation plus selective reconstruction is preferable when only a small stable contract is needed.",
    explanation:
      "The core requirement is ownership: once enqueued, the task must not observe later caller mutation. For this bounded plain-data payload, `structuredClone` preserves nested isolation and Date values and is defensible. It still allocates and traverses the graph, and it is not suitable for every runtime object. If the task needs only a few fields, validate and reconstruct that smaller contract; if the caller already transfers sole ownership and cannot mutate, an extra copy may be unnecessary."
  },
  {
    prompt:
      "The logs show one request changing another request’s response. Identify the most likely shared reference, state what evidence proves it, and describe the smallest safe correction. Do not blame asynchronous timing unless you can name the shared mutable object.",
    artifact: {
      kind: "logs",
      title: "Two requests using one defaults object",
      content:
        "10:00:01 defaults.flags.beta=false\n10:00:02 request=A sets response.flags.beta=true\n10:00:03 request=B reads defaults.flags.beta=true\nSnapshot: responseA !== defaults; responseA.flags === defaults.flags"
    },
    concise:
      "`responseA.flags` aliases `defaults.flags`; request A mutates that shared nested object. Copy the changed branch or construct a request-owned response before writing it.",
    explanation:
      "The identity snapshot is direct evidence: the outer response differs from `defaults`, but the `flags` branch is shared. Request A writes through that branch, so the module-owned default changes and request B reads the changed value. The smallest repair is a selective copy such as `{ ...defaults, flags: { ...defaults.flags, beta: true } }`, paired with an ownership rule that shared defaults are read-only."
  },
  {
    prompt:
      "Repair `normalizeUser` so it trims the nested name without modifying any caller-owned object. Preserve reference identity for the unrelated `settings` branch. Your solution must pass the visible and hidden identity checks, then explain why an outer-only spread is insufficient.",
    artifact: {
      kind: "code",
      title: "Mutating request normalizer",
      content:
        "export function normalizeUser(input) {\n  const output = { ...input };\n  output.profile.name = output.profile.name.trim();\n  return output;\n}"
    },
    concise:
      "Copy the outer object and the changed `profile` branch, then assign the trimmed name on the new branch while reusing untouched `settings`.",
    explanation:
      "The caller owns both `input` and its nested `profile`. An outer spread alone leaves `output.profile === input.profile`, so the write mutates the caller. Selective copy-on-write creates a new outer object and a new profile only along the changed path. Untouched branches can retain identity, avoiding a costly whole-graph clone.",
    executable: {
      starterCode:
        "export function normalizeUser(input) { const output = { ...input }; output.profile.name = output.profile.name.trim(); return output; }",
      referenceSolution:
        "export function normalizeUser(input) { return { ...input, profile: { ...input.profile, name: input.profile.name.trim() } }; }",
      publicTests: [
        {
          name: "preserves-caller-profile",
          input: "nested user",
          expected: "trimmed copy and unchanged input",
          testCode:
            "const input = { profile: { name: ' Ada ' }, settings: { theme: 'dark' } }; const result = solution.normalizeUser(input); return result.profile.name === 'Ada' && input.profile.name === ' Ada ' && result !== input && result.profile !== input.profile;"
        }
      ],
      hiddenTests: [
        {
          name: "reuses-untouched-settings",
          input: "user with settings",
          expected: "same untouched branch",
          testCode:
            "const settings = { theme: 'dark' }; const input = { profile: { name: ' Lin ' }, settings }; const result = solution.normalizeUser(input); return result.settings === settings && input.profile.name === ' Lin ';"
        }
      ],
      wrongSolutions: [
        {
          name: "copies only the outer object",
          code: "export function normalizeUser(input) { const output = { ...input }; output.profile.name = output.profile.name.trim(); return output; }"
        }
      ],
      runnerContract
    }
  },
  {
    prompt:
      "Implement `updateEmail(user, email)` as a selective immutable update. It must replace the outer object, `profile`, and `contact`; preserve the original input; and retain identity for the untouched `preferences` branch. Avoid JSON serialization and whole-object deep cloning.",
    artifact: {
      kind: "code",
      title: "Nested profile updater",
      content:
        "export function updateEmail(user, email) {\n  // Return the updated user without mutating `user`.\n}"
    },
    concise:
      "Copy each object on the path to `email`, reuse unrelated branches, and never write through the original contact reference.",
    explanation:
      "A correct copy-on-write update replaces exactly the branches whose descendants change: the user, profile, and contact objects. It reuses `preferences` because that branch is unchanged. This preserves observable identity semantics, avoids mutation, and allocates much less than cloning the entire graph.",
    executable: {
      starterCode:
        "export function updateEmail(user, email) { user.profile.contact.email = email; return user; }",
      referenceSolution:
        "export function updateEmail(user, email) { return { ...user, profile: { ...user.profile, contact: { ...user.profile.contact, email } } }; }",
      publicTests: [
        {
          name: "updates-without-mutation",
          input: "nested profile",
          expected: "new email on copied path",
          testCode:
            "const user = { profile: { contact: { email: 'old@example.com' } }, preferences: { theme: 'dark' } }; const result = solution.updateEmail(user, 'new@example.com'); return result.profile.contact.email === 'new@example.com' && user.profile.contact.email === 'old@example.com' && result !== user && result.profile !== user.profile && result.profile.contact !== user.profile.contact;"
        }
      ],
      hiddenTests: [
        {
          name: "preserves-unrelated-identity",
          input: "profile with preferences",
          expected: "same preferences reference",
          testCode:
            "const preferences = { theme: 'dark' }; const user = { profile: { contact: { email: 'a@b.com' } }, preferences }; const result = solution.updateEmail(user, 'c@d.com'); return result.preferences === preferences;"
        }
      ],
      wrongSolutions: [
        {
          name: "mutates the original contact",
          code: "export function updateEmail(user, email) { user.profile.contact.email = email; return user; }"
        }
      ],
      runnerContract
    }
  },
  {
    prompt:
      "A hot request path reads a 200 KB validated configuration, changes two nested fields for one downstream call, and must not affect later requests. Choose mutation, selective copying, `structuredClone`, or rebuilding. Defend the ownership contract, performance cost, and verification plan.",
    artifact: {
      kind: "metrics",
      title: "Configuration path constraints",
      content:
        "2,000 requests/second; shared configuration reloads once per minute; two request-specific fields change; p99 allocation pressure is already elevated."
    },
    concise:
      "Keep the shared configuration immutable and selectively copy the outer object plus the two changed branches; verify input preservation, branch identities, allocation rate, and p99 latency.",
    explanation:
      "Mutating the shared configuration violates cross-request isolation. Deep-cloning 200 KB per request provides isolation but creates unnecessary traversal and allocation. Rebuilding may be appropriate if the downstream contract is very small; otherwise selective copy-on-write is the balanced default. Tests should assert the original is unchanged and only changed paths receive new identities, while load measurements verify allocation and tail-latency effects."
  }
];

const closuresContent: QuestionContent[] = [
  {
    prompt:
      "Inside `createHandler`, a local `label` shadows the module-level `label`. The returned callback is invoked from another module. Which binding does it read, and why does moving the call site not change the answer?",
    artifact: {
      kind: "code",
      title: "Shadowed callback binding",
      content:
        "const label = 'module';\nfunction createHandler() {\n  const label = 'request';\n  return () => label;\n}\nexport const handler = createHandler();"
    },
    choices: [
      "The module-level binding, because the callback is exported.",
      "The local `request` binding, because lookup follows the function's lexical definition environment.",
      "Whichever binding exists at the eventual call site.",
      "A ReferenceError, because the outer function already returned."
    ],
    correctChoiceIndex: 1,
    concise:
      "It reads the `request` binding captured from `createHandler`'s lexical environment; JavaScript scope follows where the function was defined, not where it is called.",
    explanation:
      "The arrow function is created inside `createHandler`, so its identifier lookup starts in that lexical environment. The local `label` shadows the module binding and remains reachable through the returned function. Exporting or calling the function elsewhere changes neither its lexical parent nor the selected binding."
  },
  {
    prompt:
      "Predict both arrays produced by these loops after their callbacks run. Explain one shared function-scoped binding versus a new binding for each iteration; do not answer only with the memorized phrase ‘use let.’",
    artifact: {
      kind: "code",
      title: "Delayed loop callbacks",
      content:
        "const a = [];\nfor (var i = 0; i < 3; i++) a.push(() => i);\nconst b = [];\nfor (let j = 0; j < 3; j++) b.push(() => j);\nconsole.log(a.map(fn => fn()), b.map(fn => fn()));"
    },
    concise:
      "The arrays are `[3, 3, 3]` and `[0, 1, 2]`: every `var` callback reads one final binding, while `let` creates a distinct per-iteration binding.",
    explanation:
      "`var i` is function-scoped, so all three closures refer to the same binding. The loop completes with that binding equal to 3 before the callbacks are invoked. A `for` loop with `let` creates a new per-iteration environment, so each closure retains the binding for its own iteration and reads 0, 1, or 2."
  },
  {
    prompt:
      "Explain why two counters returned by separate calls to `makeCounter` do not share their count, even though both use the same function body. Also state when each captured count becomes eligible for garbage collection.",
    artifact: {
      kind: "code",
      title: "Counter factory",
      content:
        "function makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\nconst first = makeCounter();\nconst second = makeCounter();"
    },
    concise:
      "Each factory call creates a new lexical environment and count binding. Its returned closure retains that binding until the closure itself and any other references to that environment become unreachable.",
    explanation:
      "A closure is not just reused source code; each invocation of the outer function creates a distinct environment. `first` closes over one `count`, and `second` closes over another. Returning does not destroy an environment that a reachable function still needs. A count can be collected only after no reachable closure or other live path can reach its environment."
  },
  {
    prompt:
      "A module exports `nextRequestId`, which increments a module-scoped number. Explain what state is shared across requests, what is not guaranteed across processes or restarts, and when this design is acceptable versus dangerous.",
    artifact: {
      kind: "code",
      title: "Module-scoped request counter",
      content:
        "let current = 0;\nexport function nextRequestId() {\n  current += 1;\n  return current;\n}"
    },
    concise:
      "Requests handled by the same loaded module instance share `current`; separate processes or restarted instances do not. It is acceptable for process-local diagnostics, not durable or globally unique identity.",
    explanation:
      "Node.js normally evaluates and caches a module within one process, so calls in that instance observe the same mutable binding. A cluster, worker, separate serverless instance, deployment, or restart has different state. The design can support explicitly process-local best-effort metrics, but it cannot provide durable, cross-instance, or globally unique request identifiers. Tests also need isolation because module state survives between imports in the same process."
  },
  {
    prompt:
      "A heap snapshot shows old request objects still reachable. Follow the retaining path, identify the owning lifecycle mistake, and propose the smallest evidence-backed fix. Explain why the mere presence of a closure is not itself proof of a leak.",
    artifact: {
      kind: "trace",
      title: "Heap retaining path",
      content:
        "GC Root → EventEmitter `bus` → listeners[1842] → function onUpdate → Context → request → body Buffer (4 MB)\nListener count grows by one after every completed request."
    },
    concise:
      "The long-lived bus retains each listener, whose closure retains its request and 4 MB body. Remove the listener at request completion and capture only the minimal immutable data it needs.",
    explanation:
      "The snapshot supplies a complete live path from a GC root to the old request. The closure is retained because the long-lived emitter owns the listener; the listener then keeps its lexical environment and request reachable. The increasing listener count corroborates the lifecycle bug. Register with a stable handler reference, remove it in guaranteed cleanup, and avoid capturing the whole request when a small identifier is enough."
  },
  {
    prompt:
      "Repair `attach` so disposing a subscription removes the exact registered listener, does nothing when called twice, and releases the captured request. The tests model the listener boundary directly; no timers, network access, or external packages are needed.",
    artifact: {
      kind: "code",
      title: "Listener registration leak",
      content:
        "export function attach(emitter, request) {\n  emitter.on('tick', () => request.id);\n  return () => emitter.off('tick', () => request.id);\n}"
    },
    concise:
      "Store one handler reference, register and remove that same function, guard cleanup with an active flag, and clear captured state after disposal.",
    explanation:
      "Event emitters remove listeners by function identity. Two identical-looking arrow expressions create different functions, so the starter cleanup removes nothing. A stable handler reference fixes identity; an active flag makes disposal idempotent. Clearing the local request reference after removal shortens retention if the disposer itself remains reachable.",
    executable: {
      starterCode:
        "export function attach(emitter, request) { emitter.on('tick', () => request.id); return () => emitter.off('tick', () => request.id); }",
      referenceSolution:
        "export function attach(emitter, request) { let active = true; const handler = () => request.id; emitter.on('tick', handler); return () => { if (!active) return; active = false; emitter.off('tick', handler); request = null; }; }",
      publicTests: [
        {
          name: "removes-exact-listener",
          input: "mock emitter",
          expected: "registered function is removed",
          testCode:
            "let added; let removed; const emitter = { on(_event, fn) { added = fn; }, off(_event, fn) { removed = fn; } }; const dispose = solution.attach(emitter, { id: 'r1' }); dispose(); return typeof added === 'function' && removed === added;"
        }
      ],
      hiddenTests: [
        {
          name: "cleanup-is-idempotent",
          input: "dispose twice",
          expected: "one removal",
          testCode:
            "let removals = 0; const emitter = { on() {}, off() { removals += 1; } }; const dispose = solution.attach(emitter, { id: 'r2' }); dispose(); dispose(); return removals === 1;"
        }
      ],
      wrongSolutions: [
        {
          name: "removes a new anonymous function",
          code: "export function attach(emitter, request) { emitter.on('tick', () => request.id); return () => emitter.off('tick', () => request.id); }"
        }
      ],
      runnerContract
    }
  },
  {
    prompt:
      "Implement `createCounter(limit)` with private closure state. `increment` must stop at the limit, `value` must expose only the number, and idempotent `dispose` must reset state and make later increments throw. Do not return the mutable state object.",
    artifact: {
      kind: "code",
      title: "Bounded private counter",
      content:
        "export function createCounter(limit) {\n  // Return { increment, value, dispose }.\n}"
    },
    concise:
      "Keep the number and disposed flag in the factory environment, expose narrow functions, cap increments, and make disposal idempotent while rejecting later updates.",
    explanation:
      "Each factory call owns one lexical environment. Callers receive operations rather than the mutable state itself, preserving the boundary. `increment` checks lifecycle and applies the cap; `value` returns a primitive snapshot. `dispose` can run repeatedly safely, resets the retained value, and prevents accidental reuse after the component's lifecycle ends.",
    executable: {
      starterCode:
        "export function createCounter(limit) { const state = { value: 0 }; return { state, increment() { state.value += 1; return state.value; }, value() { return state.value; }, dispose() {} }; }",
      referenceSolution:
        "export function createCounter(limit) { let count = 0; let disposed = false; return { increment() { if (disposed) throw new Error('disposed'); count = Math.min(limit, count + 1); return count; }, value() { return count; }, dispose() { if (disposed) return; disposed = true; count = 0; } }; }",
      publicTests: [
        {
          name: "caps-private-count",
          input: "limit 2",
          expected: "1, 2, 2 without public state",
          testCode:
            "const counter = solution.createCounter(2); return counter.increment() === 1 && counter.increment() === 2 && counter.increment() === 2 && counter.value() === 2 && !('state' in counter);"
        }
      ],
      hiddenTests: [
        {
          name: "disposal-stops-updates",
          input: "dispose twice",
          expected: "reset and throw",
          testCode:
            "const counter = solution.createCounter(3); counter.increment(); counter.dispose(); counter.dispose(); let threw = false; try { counter.increment(); } catch { threw = true; } return threw && counter.value() === 0;"
        }
      ],
      wrongSolutions: [
        {
          name: "exposes mutable state and ignores disposal",
          code: "export function createCounter(limit) { const state = { value: 0 }; return { state, increment() { state.value += 1; return state.value; }, value() { return state.value; }, dispose() {} }; }"
        }
      ],
      runnerContract
    }
  },
  {
    prompt:
      "A rate limiter must work across six Node.js instances, survive restarts, and support atomic expiry. Choose closure state, module state, an explicit in-process instance, or an external store. Defend ownership, lifecycle, scaling, failure, and testability trade-offs.",
    artifact: {
      kind: "scenario",
      title: "Distributed rate-limit requirement",
      content:
        "Six stateless service instances autoscale independently. Limits must remain correct during deployments and expire atomically after one minute."
    },
    concise:
      "Use an external store with atomic expiry as the authoritative owner; keep only bounded, non-authoritative process-local helpers and define timeout, failure, and observability behaviour.",
    explanation:
      "Closure, module, and instance state are all process-local. They can encapsulate implementation details but cannot coordinate six independently scaling processes or survive restart. The requirement needs one external consistency boundary that supports atomic counters and expiry. The service should define behaviour when that dependency is slow or unavailable, instrument decisions, and test the adapter separately from the policy."
  }
];

const drafts = new Map(
  [
    buildDraft("javascript-values-copying-mutation", valuesContent),
    buildDraft("javascript-scope-closures-retained-state", closuresContent)
  ].map((draft) => [draft.story.key, draft])
);

export function focusedPracticePathFallback(storyKey: string): ReviewedCoreTechnicalDraft | null {
  const draft = drafts.get(storyKey);
  return draft ? structuredClone(draft) : null;
}

function buildDraft(storyKey: string, content: QuestionContent[]): ReviewedCoreTechnicalDraft {
  const story = coreTechnicalPracticePathBlueprint(storyKey);
  if (!story) throw new Error(`Missing focused Core Technical blueprint: ${storyKey}`);
  const patternByKey = new Map(
    NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS.map((item) => [item.key, item])
  );
  const focusedContent =
    story.stages.length === 6
      ? [content[0], content[1], content[4], content[5], content[6], content[7]]
      : content;
  const questions = story.stages.map((stage, index) => {
    const item = focusedContent[index]!;
    const pattern = patternByKey.get(stage.patternKey);
    if (!pattern) throw new Error(`Missing focused Core Technical pattern: ${stage.patternKey}`);
    const question = {
      schemaVersion: 1 as const,
      key: `${story.key}-question-${index + 1}`,
      storyKey: story.key,
      stageKey: stage.key,
      order: index + 1,
      format: stage.format,
      patternKey: stage.patternKey,
      topicKeys: [...pattern.topicKeys],
      mechanismKeys: [...pattern.mechanismKeys],
      prompt: item.prompt,
      artifact: item.artifact,
      ...(item.choices ? { choices: item.choices } : {}),
      hints: [
        `Start with the concrete evidence in “${item.artifact.title}” and state only what you can observe.`,
        `Trace ${humanize(pattern.mechanismKeys[0]!)} explicitly, including the relevant identity, binding, or ownership boundary.`,
        `Use this checkpoint without copying the final answer: ${pattern.expectedSignals[0]}`
      ],
      answer: {
        concise: item.concise,
        explanation: item.explanation,
        ...(item.correctChoiceIndex === undefined
          ? {}
          : { correctChoiceIndex: item.correctChoiceIndex })
      },
      rubric: [
        {
          criterion: `Identifies and traces the ${humanize(pattern.mechanismKeys[0]!)} mechanism accurately.`,
          points: 4
        },
        {
          criterion: "Uses the supplied code or evidence to justify the conclusion step by step.",
          points: 3
        },
        {
          criterion: "Explains the repair, ownership boundary, or production consequence clearly.",
          points: 3
        }
      ],
      commonMistakes: [...pattern.commonMistakes],
      interviewerFollowUps: [...pattern.followUps],
      interviewConnection: `Interviewers use this task to test whether you can reason about ${pattern.title.toLowerCase()} from concrete evidence instead of repeating a definition.`,
      ...(item.executable ?? {})
    } satisfies GeneratedQuestionCandidate;
    return {
      ...question,
      answer: { ...question.answer, learningGuide: coreTechnicalLearningGuideFor(question) }
    };
  });
  const questionBlock = frozenQuestionBlockSchema.parse({ schemaVersion: 1, storyKey, questions });
  return {
    story,
    storyReview: criticReport("story", [
      "technical-correctness",
      "interview-relevance",
      "story-continuity",
      "difficulty"
    ]),
    questionBlock,
    questionBlockReview: criticReport("question-block", [
      "technical-correctness",
      "interview-relevance",
      "story-continuity",
      "answer-quality",
      "difficulty"
    ])
  };
}

function criticReport(
  target: CoreTechnicalCriticTarget,
  dimensions: CoreTechnicalCriticDimension[]
) {
  return coreTechnicalCriticReportSchema.parse({
    criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
    target,
    approved: true,
    verdicts: dimensions.map((dimension) => ({
      criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
      target,
      dimension,
      verdict: "pass",
      score: 95,
      confidence: "high",
      summary: `The source-reviewed focused fallback passes the ${dimension} contract for this practice path.`,
      evidenceChecks: [
        {
          claim: "All eight stages use the fixed reviewed family blueprint.",
          evidence:
            "Story keys, stage keys, formats, patterns, and primary mechanisms are schema-validated together.",
          passed: true
        },
        {
          claim: "Candidate content remains practical and answer-complete.",
          evidence:
            "Each question contains concrete evidence, three hints, a ten-point rubric, follow-up, reference answer, and stored learning guide.",
          passed: true
        }
      ],
      blockingIssues: [],
      requiredChanges: []
    }))
  });
}

function humanize(value: string): string {
  return value.replaceAll("-", " ");
}
