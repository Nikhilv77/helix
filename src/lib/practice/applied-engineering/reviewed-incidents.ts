import type { AppliedEngineeringProductionSignal } from "./contracts";
import type { AppliedEngineeringQuestion } from "./question-contracts";
import {
  APPLIED_ENGINEERING_CONTENT_AUDIT_VERSION,
  APPLIED_ENGINEERING_REVIEW_ARTIFACT_VERSION,
  appliedEngineeringReviewArtifactSchema,
  type AppliedEngineeringReviewArtifact
} from "./review-artifact-contracts";

type QuestionSeed = {
  order: number;
  format: AppliedEngineeringQuestion["format"];
  stageTitle: string;
  patternKey: string;
  objective: string;
  dependency: string;
  topicKeys: string[];
  signals: AppliedEngineeringProductionSignal[];
  prompt: string;
  artifact: AppliedEngineeringQuestion["artifact"];
  choices?: string[];
  answer: AppliedEngineeringQuestion["answer"];
  hints: [string, string, string];
  rubric: AppliedEngineeringQuestion["rubric"];
  commonMistakes: string[];
  interviewerFollowUps: string[];
  interviewConnection: string;
  executable?: Pick<
    AppliedEngineeringQuestion,
    | "starterCode"
    | "referenceSolution"
    | "publicTests"
    | "hiddenTests"
    | "wrongSolutions"
    | "runnerContract"
  >;
};

type IncidentSeed = {
  key: string;
  title: string;
  premise: string;
  incident: string;
  customerImpact: string;
  candidateRole: string;
  constraints: string[];
  primaryTopicKey: string;
  secondaryTopicKeys: string[];
  productionSignalKeys: AppliedEngineeringProductionSignal[];
  difficulty: "guided" | "standard" | "stretch";
  realismAnchors: string[];
  targetFitExplanation: string;
  coverageExplanation: string;
  selectionReason: string;
  score: AppliedEngineeringReviewArtifact["incident"]["score"];
  questions: QuestionSeed[];
};

const RUNNER = {
  language: "javascript",
  runtime: "nodejs",
  runtimeVersion: "22",
  entrypoint: "submission.js",
  timeoutMs: 1_500,
  memoryMb: 64,
  networkAccess: false
} as const;

function candidateArtifact(seed: IncidentSeed): AppliedEngineeringReviewArtifact {
  const questions = seed.questions.map((question) => questionFrom(seed.key, question));
  return appliedEngineeringReviewArtifactSchema.parse({
    artifactVersion: APPLIED_ENGINEERING_REVIEW_ARTIFACT_VERSION,
    auditVersion: APPLIED_ENGINEERING_CONTENT_AUDIT_VERSION,
    caseKey: seed.key,
    authoredAt: "2026-09-08T00:00:00.000Z",
    incident: {
      schemaVersion: 1,
      key: seed.key,
      title: seed.title,
      premise: seed.premise,
      incident: seed.incident,
      customerImpact: seed.customerImpact,
      candidateRole: seed.candidateRole,
      constraints: seed.constraints,
      primaryTopicKey: seed.primaryTopicKey,
      secondaryTopicKeys: seed.secondaryTopicKeys,
      productionSignalKeys: seed.productionSignalKeys,
      difficulty: seed.difficulty,
      prerequisiteIncidentKeys: [],
      expectedMinutes: 45,
      realismAnchors: seed.realismAnchors,
      targetFitExplanation: seed.targetFitExplanation,
      coverageExplanation: seed.coverageExplanation,
      stages: seed.questions.map((question) => ({
        order: question.order,
        key: `${seed.key}-stage-${question.order}`,
        title: question.stageTitle,
        format: question.format,
        patternKey: question.patternKey,
        objective: question.objective,
        artifactKey: question.artifact.key,
        productionSignalKeys: question.signals,
        incidentDependency: question.dependency
      })),
      score: seed.score,
      selectionReason: seed.selectionReason
    },
    questionBlock: {
      schemaVersion: 1,
      incidentKey: seed.key,
      questions
    },
    humanReview: {
      status: "approved",
      reviewerId: "nikhilverma",
      reviewedAt: "2026-09-08",
      notes: [
        "Project owner reviewed the complete incident, private answers, executable repairs, and rollout evidence; automated release audits pass."
      ]
    }
  });
}

function questionFrom(incidentKey: string, seed: QuestionSeed): AppliedEngineeringQuestion {
  return {
    schemaVersion: 1,
    key: `${incidentKey}-question-${seed.order}`,
    incidentKey,
    stageKey: `${incidentKey}-stage-${seed.order}`,
    order: seed.order,
    format: seed.format,
    patternKey: seed.patternKey,
    topicKeys: seed.topicKeys,
    productionSignalKeys: seed.signals,
    prompt: seed.prompt,
    artifact: seed.artifact,
    choices: seed.choices,
    hints: seed.hints,
    answer: seed.answer,
    rubric: seed.rubric,
    commonMistakes: seed.commonMistakes,
    interviewerFollowUps: seed.interviewerFollowUps,
    interviewConnection: seed.interviewConnection,
    ...seed.executable
  };
}

export const DUPLICATE_WORK_AFTER_RETRY = candidateArtifact({
  key: "duplicate-work-after-retry",
  title: "Duplicate work after a retry",
  premise:
    "A Node.js checkout API returns occasional gateway timeouts even though its database write often succeeds, and clients automatically retry the same request.",
  incident:
    "Support reports duplicate orders after a routine release. Application logs show two request IDs carrying the same client idempotency key, while both workers believe they created the order successfully.",
  customerImpact:
    "A small but growing group of customers receives duplicate order confirmations and may be charged or fulfilled twice, making correctness more urgent than raw request throughput.",
  candidateRole:
    "You own the checkout handler and worker boundary. Diagnose the evidence, repair duplicate side effects, prove the repair under races and retries, and plan a reversible rollout.",
  constraints: [
    "Existing clients already retry gateway timeouts and cannot all be upgraded before the server-side repair is deployed.",
    "The API runs on multiple Node.js instances, so an in-memory process lock cannot provide a correctness boundary.",
    "Previously created orders and legitimate follow-up operations must remain readable throughout the rollout."
  ],
  primaryTopicKey: "idempotent-request-processing",
  secondaryTopicKeys: ["transaction-boundaries", "concurrent-writes", "safe-delivery"],
  productionSignalKeys: [
    "customer-impact",
    "evidence-selection",
    "root-cause-reasoning",
    "data-integrity",
    "concurrency-control",
    "idempotency",
    "retry-safety",
    "testing-verification",
    "observability",
    "rollout-safety",
    "rollback-readiness"
  ],
  difficulty: "guided",
  realismAnchors: [
    "The timeline distinguishes a gateway timeout from the durable database commit that completed just before it.",
    "Two application instances race on one stable idempotency key, so process-local deduplication is deliberately insufficient.",
    "The repair requires a durable uniqueness boundary, deterministic race tests, monitoring, and a compatible rollout."
  ],
  targetFitExplanation:
    "Backend and full-stack Node.js candidates commonly own retrying request boundaries, database writes, and the operational evidence needed to deploy correctness fixes safely.",
  coverageExplanation:
    "The incident progresses from customer impact and log correlation through the durable race, executable repair, retry tests, observability, and a reversible production rollout.",
  selectionReason:
    "This guided incident turns weak production-reasoning evidence into a concrete retry and data-integrity investigation with executable proof.",
  score: {
    baselineGapTransfer: 25,
    targetRoleJob: 20,
    resumeProjectRelevance: 15,
    productionEvidenceCoverage: 20,
    realism: 10,
    novelty: 10,
    total: 100
  },
  questions: [
    {
      order: 1,
      format: "mcq",
      stageTitle: "Protect the customer first",
      patternKey: "retry-incident-first-response",
      objective:
        "Prioritize the first action using confirmed customer impact and the evidence already available instead of making a blind infrastructure change.",
      dependency:
        "This establishes the incident scope and preserves the request evidence needed by every later diagnosis stage.",
      topicKeys: ["incident-triage", "idempotent-request-processing"],
      signals: ["customer-impact", "evidence-selection"],
      prompt:
        "Duplicate orders are increasing, but only after gateway timeouts. Which first action best reduces further customer harm while preserving the evidence needed to diagnose the defect?",
      artifact: {
        key: "duplicate-retry-impact-summary",
        kind: "metrics",
        title: "Checkout impact summary",
        content:
          "14:00–14:15 UTC: 18,240 checkout attempts; 93 gateway timeouts; 27 repeated idempotency keys; 27 duplicate order rows; normal database CPU and connection saturation. Duplicates appear only when a timed-out client retries within 30 seconds.",
        caption: "The duplicate count follows retried timeout requests, not general traffic."
      },
      choices: [
        "Temporarily stop automatic server retries for this write path, preserve correlated request evidence, and investigate the repeated keys",
        "Add more API instances because duplicate writes must indicate insufficient compute capacity",
        "Delete the duplicate rows immediately before recording which requests created them",
        "Increase the gateway timeout globally without checking whether the original write committed"
      ],
      hints: [
        "Separate immediate harm reduction from the permanent code repair, and preserve the data that can join both attempts.",
        "The capacity signals are healthy, while duplicate rows correlate exactly with repeated keys after timeouts.",
        "The best first move limits additional retries on the unsafe path and keeps request and idempotency evidence intact."
      ],
      answer: {
        concise:
          "Limit retries on the unsafe write path and preserve correlated evidence for each repeated idempotency key.",
        explanation:
          "The strongest known link is between timed-out requests, repeated stable keys, and duplicate durable rows. A targeted mitigation reduces additional duplicates while retaining the evidence needed to find the broken write boundary.",
        correctChoiceIndex: 0
      },
      rubric: [
        { criterion: "Prioritizes customer harm and a targeted mitigation", points: 5 },
        { criterion: "Preserves request and idempotency evidence for diagnosis", points: 5 }
      ],
      commonMistakes: [
        "Scaling the API treats a healthy capacity signal and can increase the number of concurrent writers without repairing correctness."
      ],
      interviewerFollowUps: [
        "What customer and business signals would determine whether checkout must be paused entirely?"
      ],
      interviewConnection:
        "Interviewers use this opening to distinguish calm evidence-led incident ownership from premature rollback, scaling, or data deletion."
    },
    {
      order: 2,
      format: "artifact-diagnosis",
      stageTitle: "Reconstruct the retry timeline",
      patternKey: "correlate-retry-request-evidence",
      objective:
        "Correlate gateway, application, and database evidence by idempotency key and identify what happened before the client retried.",
      dependency:
        "The timeline must show whether the first attempt committed before the code-level race and repair can be reasoned about correctly.",
      topicKeys: ["observability", "request-correlation"],
      signals: ["evidence-selection", "observability", "root-cause-reasoning"],
      prompt:
        "Read the correlated timeline. What conclusion is supported, and what misleading conclusion should the team avoid? Cite at least two timestamps or identifiers.",
      artifact: {
        key: "duplicate-retry-correlated-timeline",
        kind: "logs",
        title: "Correlated request timeline",
        content:
          "14:07:10.102 gateway request=req-a key=checkout-784 upstream-start\n14:07:11.886 api instance=api-2 request=req-a key=checkout-784 db-insert-start\n14:07:11.934 db tx=tx-91 key=checkout-784 COMMIT order=ord-551\n14:07:12.104 gateway request=req-a upstream-timeout status=504\n14:07:12.351 gateway request=req-b key=checkout-784 upstream-start retry=1\n14:07:12.390 api instance=api-5 request=req-b key=checkout-784 db-insert-start\n14:07:12.431 db tx=tx-94 key=checkout-784 COMMIT order=ord-552",
        caption: "Gateway, API, and database clocks are synchronized to UTC."
      },
      hints: [
        "Compare the first database commit with the first gateway timeout rather than relying on the HTTP response alone.",
        "Track the stable checkout key separately from the two gateway request IDs and API instances.",
        "The client did not know the first write committed; the second instance nevertheless inserted another row for the same logical operation."
      ],
      answer: {
        concise:
          "The first write committed before its 504, then a second instance committed another order for the same idempotency key.",
        explanation:
          "Transaction tx-91 committed ord-551 at 14:07:11.934, before req-a timed out at 14:07:12.104. Req-b then reused checkout-784 on api-5 and tx-94 committed ord-552. The team should not conclude that a 504 means the original durable write failed."
      },
      rubric: [
        { criterion: "Uses the commit-before-timeout evidence correctly", points: 4 },
        { criterion: "Connects both request IDs through the stable key", points: 4 },
        { criterion: "Rejects the assumption that the first write failed", points: 2 }
      ],
      commonMistakes: [
        "Treating request IDs as operation identity misses that both requests intentionally carry the same stable idempotency key."
      ],
      interviewerFollowUps: [
        "Which correlation fields must be structured and propagated to make this timeline reliable during a real incident?"
      ],
      interviewConnection:
        "This tests whether the candidate can build a causal timeline from multiple systems rather than infer database state from an HTTP outcome."
    },
    {
      order: 3,
      format: "written",
      stageTitle: "Name the broken guarantee",
      patternKey: "model-at-least-once-write-failure",
      objective:
        "Explain why timeout ambiguity plus at-least-once delivery creates duplicate effects when operation identity is not enforced durably.",
      dependency:
        "The causal model turns the observed timeline into a precise correctness requirement for the repair stage.",
      topicKeys: ["retry-semantics", "data-integrity"],
      signals: ["root-cause-reasoning", "data-integrity", "retry-safety"],
      prompt:
        "Explain the failure model in this incident. Why are a process-local cache and a pre-insert lookup both insufficient guarantees when two Node.js instances race?",
      artifact: {
        key: "duplicate-retry-current-flow",
        kind: "scenario",
        title: "Current write flow",
        content:
          "Each API instance checks its own 60-second Map for the idempotency key. On a miss it queries SELECT order_id WHERE idempotency_key = ?, then performs a separate INSERT. The database has a normal non-unique index on idempotency_key. Both instances may execute the lookup before either INSERT commits."
      },
      hints: [
        "Identify which state is shared across all instances and which check-and-write operation is not atomic.",
        "Two successful pre-insert reads can both truthfully observe no row before either writer commits.",
        "A correctness guarantee needs durable uniqueness plus transactional conflict handling, not only faster lookup or process memory."
      ],
      answer: {
        concise:
          "The operation is delivered at least once, while its stable identity is not enforced by one durable atomic write boundary.",
        explanation:
          "The local Map cannot coordinate api-2 and api-5. A separate lookup is a time-of-check/time-of-use race because both writers can observe absence. The database must enforce uniqueness for the idempotency scope, and the handler must treat a uniqueness conflict as a replay that returns the previously committed order."
      },
      rubric: [
        { criterion: "Explains timeout ambiguity and at-least-once delivery", points: 3 },
        { criterion: "Explains both cross-process and check-then-write races", points: 4 },
        { criterion: "Names durable uniqueness and conflict handling", points: 3 }
      ],
      commonMistakes: [
        "Describing idempotency as a performance cache ignores the durable operation-identity guarantee required under concurrency."
      ],
      interviewerFollowUps: [
        "How would you scope the uniqueness key if the same client key may legitimately be reused by different accounts?"
      ],
      interviewConnection:
        "Strong candidates identify the exact durable invariant and the race window instead of suggesting a larger cache or longer timeout."
    },
    {
      order: 4,
      format: "artifact-diagnosis",
      stageTitle: "Find the unsafe boundary",
      patternKey: "locate-check-then-insert-race",
      objective:
        "Locate the planted check-then-insert defect and connect it to the missing database constraint and cross-instance race.",
      dependency:
        "This narrows the repair to the smallest unsafe boundary before candidate code is executed in the next stage.",
      topicKeys: ["concurrent-writes", "transaction-boundaries"],
      signals: ["data-integrity", "concurrency-control", "idempotency"],
      prompt:
        "Identify the unsafe assumption in this handler and schema. Describe the specific interleaving that produces ord-551 and ord-552.",
      artifact: {
        key: "duplicate-retry-handler-and-schema",
        kind: "code",
        title: "Checkout handler and order index",
        language: "javascript",
        content:
          "async function checkout(input, repository) {\n  const existing = await repository.findByIdempotencyKey(input.accountId, input.idempotencyKey);\n  if (existing) return existing;\n  return repository.insert(input);\n}\n\nCREATE INDEX orders_idempotency_idx\n  ON orders(account_id, idempotency_key);"
      },
      hints: [
        "A normal index can speed up the lookup without rejecting a second row carrying the same logical identity.",
        "Interleave both calls so that each lookup finishes before either insert is visible to the other.",
        "The fix must move the guarantee into a shared durable constraint and handle the losing writer explicitly."
      ],
      answer: {
        concise:
          "The handler assumes a separate read proves the later insert is safe, but the non-unique index cannot enforce that assumption.",
        explanation:
          "api-2 and api-5 both complete findByIdempotencyKey before either transaction commits, so both receive null and insert. The index only accelerates reads. A unique constraint on the correctly scoped key makes one insert win and forces the other handler to resolve the conflict as a replay."
      },
      rubric: [
        { criterion: "Identifies the check-then-insert race", points: 4 },
        { criterion: "Explains why the normal index is insufficient", points: 3 },
        { criterion: "Provides the two-writer interleaving", points: 3 }
      ],
      commonMistakes: [
        "Wrapping only the SELECT in a transaction still permits a second writer unless the isolation strategy or unique constraint enforces the invariant."
      ],
      interviewerFollowUps: [
        "What response should the losing request receive if the winning transaction has not become visible yet?"
      ],
      interviewConnection:
        "This is a common code-review exercise: find code that looks defensive but does not own the concurrent database invariant."
    },
    {
      order: 5,
      format: "debug-repair",
      stageTitle: "Repair the write boundary",
      patternKey: "implement-idempotent-write-repair",
      objective:
        "Implement replay-safe conflict handling around a repository that atomically enforces the idempotency key.",
      dependency:
        "The executable repair applies the durable invariant identified from the incident evidence and becomes input to verification.",
      topicKeys: ["idempotent-request-processing", "concurrent-writes"],
      signals: ["concurrency-control", "idempotency", "retry-safety"],
      prompt:
        "Repair placeOrder. The repository guarantees insertUnique throws an error with code IDEMPOTENCY_CONFLICT when another request wins. Return the existing order for replays, but do not hide unrelated database errors.",
      artifact: {
        key: "duplicate-retry-place-order-module",
        kind: "code",
        title: "Unsafe order creation module",
        language: "javascript",
        content:
          "The repository exposes findByIdempotencyKey(accountId, key) and insertUnique(input). Uniqueness is scoped to accountId plus idempotencyKey. The returned object must include replayed: true for an existing order and replayed: false for a newly inserted order."
      },
      hints: [
        "A fast lookup is useful for normal replays, but the insert conflict remains the authoritative race boundary.",
        "Catch only IDEMPOTENCY_CONFLICT; after that conflict, read the order created by the winning request.",
        "Rethrow unrelated errors so an availability failure never masquerades as a successful replay."
      ],
      answer: {
        concise:
          "Read for the normal replay path, insert through the unique boundary, and resolve only the known uniqueness conflict.",
        explanation:
          "The pre-read avoids unnecessary inserts but does not guarantee correctness. insertUnique provides the durable winner. The losing call catches only the idempotency conflict, loads the committed winner, and returns it as a replay while all other errors propagate."
      },
      rubric: [
        { criterion: "Returns an existing order on the normal replay path", points: 2 },
        { criterion: "Uses insertUnique as the authoritative write", points: 3 },
        { criterion: "Resolves only the known conflict to the winner", points: 3 },
        { criterion: "Propagates unrelated failures", points: 2 }
      ],
      commonMistakes: [
        "Catching every repository error and returning an assumed replay converts real database failures into false success."
      ],
      interviewerFollowUps: [
        "How would you handle the brief interval where the conflict is known but the winning row is not yet visible?"
      ],
      interviewConnection:
        "The task tests a production repair whose correctness comes from the durable boundary, not from a happy-path unit test.",
      executable: {
        starterCode:
          "async function placeOrder(input, repository) {\n  const existing = await repository.findByIdempotencyKey(input.accountId, input.idempotencyKey);\n  if (existing) return { order: existing, replayed: true };\n  const order = await repository.insertUnique(input);\n  return { order, replayed: false };\n}\n\nmodule.exports = { placeOrder };",
        referenceSolution:
          "async function placeOrder(input, repository) {\n  const existing = await repository.findByIdempotencyKey(input.accountId, input.idempotencyKey);\n  if (existing) return { order: existing, replayed: true };\n  try {\n    const order = await repository.insertUnique(input);\n    return { order, replayed: false };\n  } catch (error) {\n    if (!error || error.code !== 'IDEMPOTENCY_CONFLICT') throw error;\n    const winner = await repository.findByIdempotencyKey(input.accountId, input.idempotencyKey);\n    if (!winner) throw error;\n    return { order: winner, replayed: true };\n  }\n}\n\nmodule.exports = { placeOrder };",
        publicTests: [
          {
            name: "returns a previously created order",
            input: "existing order",
            expected: "existing order marked replayed",
            testCode:
              "const existing = { id: 'ord-1' }; const repository = { findByIdempotencyKey: async () => existing, insertUnique: async () => { throw new Error('should not insert'); } }; const result = await solution.placeOrder({ accountId: 'a', idempotencyKey: 'k' }, repository); if (result.order !== existing || !result.replayed) throw new Error('existing replay failed');"
          },
          {
            name: "returns a newly inserted order",
            input: "new order",
            expected: "new order not marked replayed",
            testCode:
              "const created = { id: 'ord-2' }; const repository = { findByIdempotencyKey: async () => null, insertUnique: async () => created }; const result = await solution.placeOrder({ accountId: 'a', idempotencyKey: 'k' }, repository); if (result.order !== created || result.replayed) throw new Error('new insert failed');"
          }
        ],
        hiddenTests: [
          {
            name: "resolves a concurrent uniqueness conflict",
            input: "racing request",
            expected: "winning order marked replayed",
            testCode:
              "const winner = { id: 'ord-win' }; let reads = 0; const repository = { findByIdempotencyKey: async () => (++reads === 1 ? null : winner), insertUnique: async () => { const error = new Error('conflict'); error.code = 'IDEMPOTENCY_CONFLICT'; throw error; } }; const result = await solution.placeOrder({ accountId: 'a', idempotencyKey: 'k' }, repository); if (result.order !== winner || !result.replayed) throw new Error('race was not resolved');"
          },
          {
            name: "does not hide unrelated storage errors",
            input: "database unavailable",
            expected: "original error is thrown",
            testCode:
              "const failure = new Error('database unavailable'); const repository = { findByIdempotencyKey: async () => null, insertUnique: async () => { throw failure; } }; let thrown; try { await solution.placeOrder({ accountId: 'a', idempotencyKey: 'k' }, repository); } catch (error) { thrown = error; } if (thrown !== failure) throw new Error('unrelated failure was hidden');"
          }
        ],
        wrongSolutions: [
          {
            name: "process-local replay only",
            code: "const seen = new Map(); async function placeOrder(input, repository) { if (seen.has(input.idempotencyKey)) return { order: seen.get(input.idempotencyKey), replayed: true }; const order = await repository.insertUnique(input); seen.set(input.idempotencyKey, order); return { order, replayed: false }; } module.exports = { placeOrder };"
          },
          {
            name: "swallows every database failure",
            code: "async function placeOrder(input, repository) { try { const order = await repository.insertUnique(input); return { order, replayed: false }; } catch { return { order: await repository.findByIdempotencyKey(input.accountId, input.idempotencyKey), replayed: true }; } } module.exports = { placeOrder };"
          }
        ],
        runnerContract: RUNNER
      }
    },
    {
      order: 6,
      format: "micro-implementation",
      stageTitle: "Prove duplicate delivery safety",
      patternKey: "implement-retry-verification",
      objective:
        "Implement deterministic event deduplication that demonstrates repeated delivery does not repeat the downstream side effect.",
      dependency:
        "Verification extends the request-level repair to the downstream delivery boundary where the same order event may arrive again.",
      topicKeys: ["event-delivery", "verification"],
      signals: ["retry-safety", "testing-verification", "idempotency"],
      prompt:
        "Implement uniqueDeliveries so only the first event for each stable eventId is returned, original order is preserved, and different events for the same order are not collapsed.",
      artifact: {
        key: "duplicate-retry-delivery-fixture",
        kind: "code",
        title: "At-least-once delivery fixture",
        language: "javascript",
        content:
          "A queue can redeliver an event after a worker loses its acknowledgement. eventId identifies one effect; orderId identifies the aggregate and may legitimately have created, paid, and shipped events."
      },
      hints: [
        "Deduplicate by eventId rather than orderId because one order can produce several legitimate event types.",
        "A Set can track stable event IDs while one pass preserves the arrival order of first deliveries.",
        "Do not mutate or sort the input array; return a new list containing only each event ID's first occurrence."
      ],
      answer: {
        concise:
          "Track eventId values in a Set and keep only the first occurrence in one stable pass.",
        explanation:
          "At-least-once delivery permits repeats of the same event, not the removal of distinct events for one order. A Set keyed by eventId makes the fixture deterministic and preserves first-delivery order without changing the input."
      },
      rubric: [
        { criterion: "Deduplicates by stable eventId", points: 5 },
        { criterion: "Preserves distinct events and original order", points: 3 },
        { criterion: "Does not mutate the input", points: 2 }
      ],
      commonMistakes: [
        "Deduplicating by orderId drops legitimate state transitions such as paid and shipped for the same order."
      ],
      interviewerFollowUps: [
        "Where must the deduplication record live when multiple worker processes can receive the same event?"
      ],
      interviewConnection:
        "This small implementation verifies that the candidate can turn retry semantics into a precise, testable identity rule.",
      executable: {
        starterCode:
          "function uniqueDeliveries(events) {\n  return events;\n}\n\nmodule.exports = { uniqueDeliveries };",
        referenceSolution:
          "function uniqueDeliveries(events) {\n  const seen = new Set();\n  const unique = [];\n  for (const event of events) {\n    if (seen.has(event.eventId)) continue;\n    seen.add(event.eventId);\n    unique.push(event);\n  }\n  return unique;\n}\n\nmodule.exports = { uniqueDeliveries };",
        publicTests: [
          {
            name: "removes a repeated event delivery",
            input: "created, created retry, paid",
            expected: "created, paid",
            testCode:
              "const events = [{ eventId: 'e1', orderId: 'o1', type: 'created' }, { eventId: 'e1', orderId: 'o1', type: 'created' }, { eventId: 'e2', orderId: 'o1', type: 'paid' }]; const result = solution.uniqueDeliveries(events); if (result.length !== 2 || result[0] !== events[0] || result[1] !== events[2]) throw new Error('deduplication failed');"
          }
        ],
        hiddenTests: [
          {
            name: "preserves separate events for one order",
            input: "created, paid, shipped",
            expected: "all three events",
            testCode:
              "const events = [{ eventId: 'e1', orderId: 'o1' }, { eventId: 'e2', orderId: 'o1' }, { eventId: 'e3', orderId: 'o1' }]; const result = solution.uniqueDeliveries(events); if (result.length !== 3) throw new Error('distinct events were collapsed');"
          },
          {
            name: "does not mutate the delivery input",
            input: "frozen delivery array",
            expected: "new stable output",
            testCode:
              "const events = Object.freeze([Object.freeze({ eventId: 'e1' }), Object.freeze({ eventId: 'e1' })]); const result = solution.uniqueDeliveries(events); if (result.length !== 1 || result === events) throw new Error('input handling failed');"
          }
        ],
        wrongSolutions: [
          {
            name: "deduplicates by aggregate",
            code: "function uniqueDeliveries(events) { const seen = new Set(); return events.filter((event) => !seen.has(event.orderId) && seen.add(event.orderId)); } module.exports = { uniqueDeliveries };"
          }
        ],
        runnerContract: RUNNER
      }
    },
    {
      order: 7,
      format: "production-decision",
      stageTitle: "Instrument the guarantee",
      patternKey: "observe-idempotency-outcomes",
      objective:
        "Define low-cardinality metrics and structured correlation fields that prove replay handling without leaking keys or customer data.",
      dependency:
        "The repaired behavior needs operational evidence before a canary can safely expand in the final delivery stage.",
      topicKeys: ["observability", "data-integrity"],
      signals: ["observability", "customer-impact", "retry-safety"],
      prompt:
        "Choose the production signals for the repaired path. Explain what should be counted, what should be correlated in logs, and what must not become a high-cardinality metric label.",
      artifact: {
        key: "duplicate-retry-proposed-telemetry",
        kind: "config",
        title: "Proposed checkout telemetry",
        content:
          "Candidate counters: checkout_attempt_total, checkout_replay_total, checkout_idempotency_conflict_total, checkout_failure_total. Candidate log fields: request_id, account_scope_hash, idempotency_key_hash, order_id, outcome, deployment_version. Proposed metric labels: deployment_version, outcome, raw_idempotency_key, raw_account_id."
      },
      hints: [
        "Metrics should show rates and outcomes without creating one time series per customer or operation.",
        "Hashed or protected correlation values can belong in access-controlled structured logs, while raw keys and account IDs should not be metric labels.",
        "Compare conflicts, successful replays, failures, duplicate rows, and customer reports by deployment version."
      ],
      answer: {
        concise:
          "Count attempts, replays, conflicts, failures, and duplicates by bounded labels; correlate protected identifiers only in structured logs.",
        explanation:
          "Outcome and deployment version are bounded metric dimensions. Raw account and idempotency values create unbounded cardinality and can expose customer data. Access-controlled logs can carry protected correlation fields so an operator can join attempts to one order while dashboards track replay success and residual duplicates."
      },
      rubric: [
        { criterion: "Defines outcome counters that verify the repair", points: 4 },
        { criterion: "Separates bounded metrics from correlation logs", points: 3 },
        { criterion: "Rejects raw customer and operation labels", points: 3 }
      ],
      commonMistakes: [
        "Adding the raw idempotency key as a metric label creates unbounded series cardinality and may expose sensitive request identifiers."
      ],
      interviewerFollowUps: [
        "Which alert would detect that conflicts are rising but replay resolution is failing?"
      ],
      interviewConnection:
        "This tests whether the candidate can make a correctness guarantee observable without making telemetry unsafe or unaffordable."
    },
    {
      order: 8,
      format: "production-decision",
      stageTitle: "Roll out without breaking replays",
      patternKey: "deliver-idempotency-repair-safely",
      objective:
        "Sequence the schema, application, canary, monitoring, reconciliation, and rollback work without creating a mixed-version correctness gap.",
      dependency:
        "The final plan combines every earlier finding into a reversible change with explicit success and rollback criteria.",
      topicKeys: ["safe-delivery", "schema-migrations"],
      signals: ["rollout-safety", "rollback-readiness", "data-integrity", "observability"],
      prompt:
        "Propose the rollout sequence for the uniqueness boundary and handler repair. Include duplicate cleanup, mixed-version compatibility, canary signals, success criteria, and rollback behavior.",
      artifact: {
        key: "duplicate-retry-rollout-constraints",
        kind: "scenario",
        title: "Deployment constraints",
        content:
          "The orders table already contains 27 duplicate key groups. Old servers do not catch uniqueness conflicts. Deployments run mixed versions for up to 12 minutes. A unique index cannot be created until duplicate groups are reconciled. The current feature flag can route 1%, 10%, 50%, or 100% of accounts to the repaired handler."
      },
      hints: [
        "A database constraint will make old handlers surface errors, so sequence compatibility before enforcing it.",
        "Reconcile duplicate groups with an auditable business decision, then create the unique constraint using the safest supported migration path.",
        "Define canary expansion and rollback using replay success, conflict resolution, failure rate, latency, and zero new duplicate rows."
      ],
      answer: {
        concise:
          "Deploy conflict-compatible code, reconcile duplicates, enforce uniqueness, then canary the repaired path with explicit rollback criteria.",
        explanation:
          "First deploy code that can tolerate the future constraint while the old path still works. Reconcile existing duplicates with an audit trail, create the scoped unique index, and enable the full repair for a small cohort. Expand only when conflicts resolve to one order, no new duplicates appear, and failure/latency/customer signals stay within limits. Roll back routing, not the integrity constraint, unless a separately tested schema rollback is safe."
      },
      rubric: [
        { criterion: "Sequences compatible code before the constraint", points: 3 },
        { criterion: "Handles existing duplicate data explicitly", points: 2 },
        { criterion: "Defines canary success and rollback signals", points: 3 },
        { criterion: "Preserves the durable invariant during rollback", points: 2 }
      ],
      commonMistakes: [
        "Creating the unique constraint before compatible handlers are deployed can turn safe replays into unexpected server errors during mixed-version operation."
      ],
      interviewerFollowUps: [
        "How would you reconcile two duplicate orders if one has already triggered an external fulfillment side effect?"
      ],
      interviewConnection:
        "The final stage tests ownership beyond the code change: data repair, compatibility, canary evidence, and a rollback that does not remove correctness."
    }
  ]
});

export const LATENCY_CASCADE_UNDER_LOAD = candidateArtifact({
  key: "latency-cascade-under-load",
  title: "Latency cascade under load",
  premise:
    "A Node.js order-history endpoint is healthy at normal traffic but crosses its latency objective and begins timing out during a predictable lunchtime peak.",
  incident:
    "Traces show repeated item lookups, database pool wait, and synchronized retries. A recently added cache lowers average latency in development but creates a burst of identical misses when its short TTL expires.",
  customerImpact:
    "Customers cannot reliably open recent orders during peak traffic, support volume rises, and retries add load to a database that is already waiting on connections.",
  candidateRole:
    "You own the endpoint and its rollout. Use the supplied evidence to find the amplification path, repair query and concurrency behavior, verify bounded work, and deploy with measurable safeguards.",
  constraints: [
    "The response contract and authorization boundary cannot change during the incident repair.",
    "Database capacity cannot be increased before the next peak, so the application must remove avoidable work and bound concurrency.",
    "The cache is optional and may be bypassed or degraded, but stale cross-account data is never acceptable."
  ],
  primaryTopicKey: "latency-amplification",
  secondaryTopicKeys: ["database-performance", "bounded-concurrency", "cache-safety"],
  productionSignalKeys: [
    "customer-impact",
    "evidence-selection",
    "root-cause-reasoning",
    "database-performance",
    "bounded-work",
    "caching",
    "retry-safety",
    "failure-isolation",
    "testing-verification",
    "observability",
    "rollout-safety"
  ],
  difficulty: "standard",
  realismAnchors: [
    "The evidence separates application CPU from database pool wait and shows work growing with every order item.",
    "A short shared TTL aligns cache misses and client retries, creating a repeatable amplification wave rather than random slowness.",
    "The repair combines query batching, bounded concurrency, cache failure isolation, load verification, and canary delivery."
  ],
  targetFitExplanation:
    "Production Node.js roles require candidates to connect traces, query behavior, concurrency, caching, retries, and customer impact instead of optimizing one function in isolation.",
  coverageExplanation:
    "Eight stages move from segmented evidence to a causal model, query-plan diagnosis, executable batching and concurrency controls, cache safety, and a measured peak-traffic rollout.",
  selectionReason:
    "This standard incident evaluates whether the candidate can turn a multi-signal latency symptom into bounded, tested, and safely deployed production work.",
  score: {
    baselineGapTransfer: 25,
    targetRoleJob: 20,
    resumeProjectRelevance: 15,
    productionEvidenceCoverage: 20,
    realism: 10,
    novelty: 10,
    total: 100
  },
  questions: [
    {
      order: 1,
      format: "mcq",
      stageTitle: "Choose the first useful slice",
      patternKey: "latency-incident-first-evidence",
      objective:
        "Choose evidence that separates customer impact and dependency wait by endpoint, cohort, and deployment before changing capacity or timeouts.",
      dependency:
        "The first evidence slice determines whether later investigation should focus on compute, database work, cache behavior, or an unrelated service.",
      topicKeys: ["incident-triage", "latency-amplification"],
      signals: ["customer-impact", "evidence-selection", "observability"],
      prompt:
        "The order-history endpoint times out only during the peak. Which first evidence best narrows the cause without adding more load or hiding customer impact?",
      artifact: {
        key: "latency-peak-service-summary",
        kind: "metrics",
        title: "Peak service summary",
        content:
          "12:00–12:10 UTC: order-history p95 rises from 310 ms to 4.8 s; timeout rate reaches 8.2%; application CPU remains 46%; event-loop lag remains 18 ms; database pool wait p95 rises from 12 ms to 2.9 s; only accounts with more than 20 recent order items are affected.",
        caption: "The service has CPU headroom while large histories wait for database connections."
      },
      choices: [
        "Compare segmented traces for large and small histories, including database calls and pool wait",
        "Double every downstream timeout so requests have more time to occupy the connection pool",
        "Add Node.js instances immediately even though application CPU and event-loop lag are healthy",
        "Disable endpoint-level alerts so the aggregate service dashboard remains green"
      ],
      hints: [
        "Use the customer cohort clue and the dependency wait signal instead of the healthy application CPU.",
        "A trace comparison can show whether work grows with the number of order items and where each request waits.",
        "The best slice compares large and small histories across database calls and pool acquisition time."
      ],
      answer: {
        concise:
          "Compare large-history and small-history traces, including database call count and connection-pool wait.",
        explanation:
          "The affected cohort scales with order-item count while CPU and event-loop lag remain healthy. Segmented traces can expose repeated queries and pool wait without prolonging resource occupation or assuming the application tier lacks capacity.",
        correctChoiceIndex: 0
      },
      rubric: [
        { criterion: "Uses the affected cohort to segment evidence", points: 4 },
        { criterion: "Prioritizes database calls and pool wait", points: 4 },
        { criterion: "Avoids timeout or capacity changes without evidence", points: 2 }
      ],
      commonMistakes: [
        "Increasing timeouts can keep more requests and connections in flight, worsening the queue while only delaying the visible failure."
      ],
      interviewerFollowUps: [
        "Which user-impact signal would you use to decide whether the endpoint needs temporary load shedding?"
      ],
      interviewConnection:
        "This opening tests whether the candidate reads saturation and cohort evidence before reaching for generic scaling advice."
    },
    {
      order: 2,
      format: "artifact-diagnosis",
      stageTitle: "Read the amplification trace",
      patternKey: "correlate-latency-waterfall",
      objective:
        "Use a request waterfall to distinguish sequential query work, connection-pool waiting, and retry overlap from application computation.",
      dependency:
        "The waterfall supplies the quantitative causal path needed to explain why peak traffic crosses a nonlinear saturation point.",
      topicKeys: ["distributed-tracing", "bounded-concurrency"],
      signals: ["evidence-selection", "bounded-work", "observability"],
      prompt:
        "Diagnose the waterfall for one large account. Which work scales with item count, where does the request spend most of its time, and how do retries worsen it?",
      artifact: {
        key: "latency-large-account-waterfall",
        kind: "waterfall",
        title: "Large-account request waterfall",
        content:
          "request req-91 total=4820ms account_items=32\n  auth-check 18ms\n  orders-query 74ms rows=8 pool_wait=8ms\n  item-query x32 total=1960ms pool_wait=1210ms sequential=true\n  cache-get x32 total=96ms hits=0 ttl_boundary=true\n  response-assembly 21ms\n  unaccounted request wait=2651ms\nclient retry req-92 starts at +2000ms while req-91 remains active and repeats the same 32 item queries",
        caption: "The client timeout is shorter than the original request duration."
      },
      hints: [
        "Count item-query spans and compare their total with response assembly and application CPU evidence.",
        "Pool wait is queueing time; it grows as repeated requests hold or compete for a fixed number of connections.",
        "The retry begins before the original request completes, duplicating all 32 misses and queries."
      ],
      answer: {
        concise:
          "Thirty-two sequential item queries and pool waiting dominate, while an overlapping retry duplicates the same unbounded work.",
        explanation:
          "The endpoint performs one item query per item, producing 32 sequential calls and 1.21 seconds of pool wait before broader request queueing. Assembly is only 21 ms. Because req-92 starts while req-91 is alive, retries multiply the same cache misses and database work at the saturation point."
      },
      rubric: [
        { criterion: "Identifies the item-count-dependent query pattern", points: 4 },
        { criterion: "Separates pool and request wait from CPU work", points: 3 },
        { criterion: "Explains overlapping retry amplification", points: 3 }
      ],
      commonMistakes: [
        "Calling the entire 4.8 seconds database execution ignores that much of it is queueing created by repeated and overlapping work."
      ],
      interviewerFollowUps: [
        "What additional span attributes would prove whether the cache miss wave is synchronized across instances?"
      ],
      interviewConnection:
        "The candidate must translate a trace into a workload model instead of merely repeating that the database is slow."
    },
    {
      order: 3,
      format: "written",
      stageTitle: "Explain the cascade",
      patternKey: "model-latency-positive-feedback",
      objective:
        "Explain the positive feedback loop connecting N+1 work, pool saturation, aligned cache expiry, timeouts, and overlapping retries.",
      dependency:
        "The model identifies which links must be broken and prevents a local optimization from leaving the production cascade intact.",
      topicKeys: ["latency-amplification", "retry-semantics"],
      signals: ["root-cause-reasoning", "database-performance", "retry-safety"],
      prompt:
        "Describe the full positive-feedback loop. Why might adding a few API instances or extending the client timeout make the database symptom worse?",
      artifact: {
        key: "latency-cascade-operating-points",
        kind: "metrics",
        title: "Operating points by traffic",
        content:
          "600 rpm: pool utilization 48%, p95 310 ms, retries 0.2%\n900 rpm: pool utilization 76%, p95 780 ms, retries 1.1%\n1050 rpm at TTL boundary: pool utilization 100%, p95 4.8 s, retries 8.2%, database query rate 4.1x request-rate increase\nApplication instances: 6 throughout; database pool: 20 connections per instance."
      },
      hints: [
        "Connect each request's item-count-dependent work to the finite database pool before adding client behavior.",
        "Aligned expiry creates a miss wave, and a timeout does not cancel the original server work automatically.",
        "More application instances can create more database connections and contenders; longer timeouts retain work longer unless it is bounded or cancelled."
      ],
      answer: {
        concise:
          "N+1 misses saturate the pool, waiting causes timeouts, retries duplicate live work, and the added work deepens saturation.",
        explanation:
          "At the TTL boundary many requests miss together and each large history fans into repeated item queries. Pool utilization reaches 100%, queueing stretches latency beyond the client timeout, and retries arrive before original work stops. More API instances can increase database contenders, while longer timeouts retain queued work. The repair must reduce query count, bound concurrency, isolate cache failure, and control retries/cancellation."
      },
      rubric: [
        { criterion: "Connects N+1 and synchronized misses to saturation", points: 4 },
        { criterion: "Explains timeout and retry overlap", points: 3 },
        { criterion: "Explains why generic scaling or timeouts can worsen load", points: 3 }
      ],
      commonMistakes: [
        "Treating retry traffic as independent demand misses that it is caused by latency and feeds back into the same constrained dependency."
      ],
      interviewerFollowUps: [
        "Where would cancellation or a retry budget break this loop if the client contract cannot change immediately?"
      ],
      interviewConnection:
        "This tests production reasoning across coupled components rather than a single isolated performance trick."
    },
    {
      order: 4,
      format: "artifact-diagnosis",
      stageTitle: "Use the query plan correctly",
      patternKey: "diagnose-batch-query-plan",
      objective:
        "Read a frozen query plan and distinguish the missing composite access path from the larger N+1 request pattern.",
      dependency:
        "The query-plan evidence defines the database-side change while keeping the application batching repair in scope for execution.",
      topicKeys: ["database-performance", "query-plans"],
      signals: ["database-performance", "evidence-selection", "root-cause-reasoning"],
      prompt:
        "What does this plan prove, what index shape is justified, and why would that index alone not fix the endpoint under peak load?",
      artifact: {
        key: "latency-item-query-plan",
        kind: "query-plan",
        title: "EXPLAIN for the proposed batch lookup",
        content:
          "Seq Scan on order_items  (cost=0.00..18420.00 rows=32 width=96) (actual time=1.4..61.8 rows=32 loops=1)\n  Filter: ((account_id = 'acct-7') AND (order_id = ANY ('{o1,o2,o3,o4,o5,o6,o7,o8}')))\n  Rows Removed by Filter: 612440\nPlanning Time: 0.3 ms\nExecution Time: 62.1 ms\nExisting indexes: PRIMARY KEY(id), INDEX(order_id)."
      },
      hints: [
        "The filter includes both the authorization scope and a set of order IDs, while the existing index covers only one part.",
        "Rows Removed by Filter shows that the plan scans far more data than the 32 returned rows.",
        "A better access path improves one batch query, but the current application still sends one query per item and overlapping retries repeat them."
      ],
      answer: {
        concise:
          "A composite account_id/order_id access path is justified, but batching and retry/concurrency controls are still required.",
        explanation:
          "The sequential scan filters over 612k rows to return 32 because no index supports the account-scoped order lookup. A composite index beginning with account_id and order_id matches this access pattern while preserving authorization scope. It improves the proposed batch query but cannot eliminate the current 32 calls, aligned misses, or overlapping retries by itself."
      },
      rubric: [
        { criterion: "Uses rows removed and filter shape as evidence", points: 3 },
        { criterion: "Proposes the account-scoped composite access path", points: 4 },
        { criterion: "Keeps batching and amplification work in scope", points: 3 }
      ],
      commonMistakes: [
        "Suggesting an index only on order_id ignores the account authorization scope present in the query contract."
      ],
      interviewerFollowUps: [
        "What write and storage costs would you check before adding the composite index?"
      ],
      interviewConnection:
        "Interviewers expect candidates to read the supplied plan without claiming that one index solves every layer of the incident."
    },
    {
      order: 5,
      format: "debug-repair",
      stageTitle: "Remove the N+1 query",
      patternKey: "implement-batched-related-load",
      objective:
        "Replace repeated per-order repository calls with one account-scoped batch call while preserving response order and empty-item behavior.",
      dependency:
        "This executable repair removes the largest avoidable database multiplier identified by the trace and query-plan stages.",
      topicKeys: ["database-performance", "application-batching"],
      signals: ["database-performance", "bounded-work", "testing-verification"],
      prompt:
        "Repair attachItems. Use one repository.findItemsByOrderIds(accountId, orderIds) call, preserve the original order list, and attach an empty items array when an order has no items.",
      artifact: {
        key: "latency-attach-items-module",
        kind: "code",
        title: "N+1 order-item loader",
        language: "javascript",
        content:
          "findItemsByOrderIds returns an unordered flat array of items containing orderId. The accountId argument is required at the repository boundary so a batch cannot cross the authorization scope."
      },
      hints: [
        "Collect all order IDs first and call the batch repository method exactly once.",
        "Group the returned flat items by orderId, then map the original orders instead of returning database order.",
        "Create a new order object with items: [] when its group is absent, including the empty-input case."
      ],
      answer: {
        concise:
          "Fetch all authorized items once, group them by orderId, and map the original orders with stable empty arrays.",
        explanation:
          "One account-scoped batch call removes request-count growth with item count. Grouping the unordered result in memory preserves the original order response and gives missing groups an explicit empty list without mutating inputs."
      },
      rubric: [
        { criterion: "Makes at most one account-scoped batch call", points: 4 },
        { criterion: "Groups items under the correct order", points: 3 },
        { criterion: "Preserves order and empty-item behavior", points: 3 }
      ],
      commonMistakes: [
        "Batching only by order IDs without account scope can weaken the existing authorization boundary even if the result is faster."
      ],
      interviewerFollowUps: [
        "How would you bound or paginate this batch if an account can contain thousands of recent orders?"
      ],
      interviewConnection:
        "The candidate must make the performance repair without breaking response or authorization contracts.",
      executable: {
        starterCode:
          "async function attachItems(accountId, orders, repository) {\n  const result = [];\n  for (const order of orders) {\n    const items = await repository.findItemsByOrderId(accountId, order.id);\n    result.push({ ...order, items });\n  }\n  return result;\n}\n\nmodule.exports = { attachItems };",
        referenceSolution:
          "async function attachItems(accountId, orders, repository) {\n  if (orders.length === 0) return [];\n  const items = await repository.findItemsByOrderIds(accountId, orders.map((order) => order.id));\n  const byOrder = new Map();\n  for (const item of items) {\n    const group = byOrder.get(item.orderId) || [];\n    group.push(item);\n    byOrder.set(item.orderId, group);\n  }\n  return orders.map((order) => ({ ...order, items: byOrder.get(order.id) || [] }));\n}\n\nmodule.exports = { attachItems };",
        publicTests: [
          {
            name: "loads all items in one batch",
            input: "two orders with unordered items",
            expected: "one call and stable order output",
            testCode:
              "const calls = []; const repository = { findItemsByOrderIds: async (...args) => { calls.push(args); return [{ id: 'i2', orderId: 'o2' }, { id: 'i1', orderId: 'o1' }]; } }; const orders = [{ id: 'o1' }, { id: 'o2' }]; const result = await solution.attachItems('acct-1', orders, repository); if (calls.length !== 1 || calls[0][0] !== 'acct-1' || result[0].items[0].id !== 'i1' || result[1].items[0].id !== 'i2') throw new Error('batching failed');"
          }
        ],
        hiddenTests: [
          {
            name: "preserves an order with no items",
            input: "one empty order",
            expected: "empty items array",
            testCode:
              "const repository = { findItemsByOrderIds: async () => [] }; const result = await solution.attachItems('acct-1', [{ id: 'o1' }], repository); if (!Array.isArray(result[0].items) || result[0].items.length !== 0) throw new Error('empty items were not preserved');"
          },
          {
            name: "does no database work for empty input",
            input: "no orders",
            expected: "empty result and no call",
            testCode:
              "let called = false; const repository = { findItemsByOrderIds: async () => { called = true; return []; } }; const result = await solution.attachItems('acct-1', [], repository); if (called || result.length !== 0) throw new Error('empty input did unnecessary work');"
          }
        ],
        wrongSolutions: [
          {
            name: "keeps the per-order query loop",
            code: "async function attachItems(accountId, orders, repository) { return Promise.all(orders.map(async (order) => ({ ...order, items: await repository.findItemsByOrderId(accountId, order.id) }))); } module.exports = { attachItems };"
          },
          {
            name: "drops account authorization scope",
            code: "async function attachItems(accountId, orders, repository) { const items = await repository.findItemsByOrderIds(orders.map((order) => order.id)); return orders.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) })); } module.exports = { attachItems };"
          }
        ],
        runnerContract: RUNNER
      }
    },
    {
      order: 6,
      format: "micro-implementation",
      stageTitle: "Bound concurrent work",
      patternKey: "implement-concurrency-limit",
      objective:
        "Implement a deterministic promise worker pool that preserves output order and never exceeds the requested concurrency limit.",
      dependency:
        "After query batching removes avoidable calls, bounded parallel work prevents remaining dependency operations from recreating saturation.",
      topicKeys: ["bounded-concurrency", "resource-saturation"],
      signals: ["bounded-work", "testing-verification", "failure-isolation"],
      prompt:
        "Implement mapWithConcurrency(items, limit, work). Preserve result order, reject invalid limits, and ensure no more than limit work calls are active at once.",
      artifact: {
        key: "latency-concurrency-fixture",
        kind: "code",
        title: "Unbounded enrichment helper",
        language: "javascript",
        content:
          "The current helper uses Promise.all over every item. The replacement is used for a remaining downstream enrichment call whose safe concurrency is configured per instance."
      },
      hints: [
        "Preallocate the result array so workers can write by index while completion order varies.",
        "Share one next-index counter among at most Math.min(limit, items.length) async workers.",
        "Reject non-positive or non-integer limits before starting any work and let work failures reject the operation."
      ],
      answer: {
        concise:
          "Run a fixed number of workers over a shared index and store each result at its original position.",
        explanation:
          "A fixed worker pool bounds active dependency calls independently of input size. Assigning indices from one counter and writing to a preallocated array preserves result order, while normal promise rejection propagates a failed unit of work."
      },
      rubric: [
        { criterion: "Never exceeds the requested concurrency", points: 4 },
        { criterion: "Preserves result ordering", points: 3 },
        { criterion: "Handles invalid limits and empty input", points: 3 }
      ],
      commonMistakes: [
        "Chunking with Promise.all can be bounded but creates batch barriers; using Promise.all on every item remains unbounded."
      ],
      interviewerFollowUps: [
        "How would you add cancellation so queued work stops after the request is no longer useful?"
      ],
      interviewConnection:
        "This implementation tests whether the candidate can convert a resource limit into deterministic application behavior.",
      executable: {
        starterCode:
          "async function mapWithConcurrency(items, limit, work) {\n  return Promise.all(items.map((item, index) => work(item, index)));\n}\n\nmodule.exports = { mapWithConcurrency };",
        referenceSolution:
          "async function mapWithConcurrency(items, limit, work) {\n  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');\n  const results = new Array(items.length);\n  let nextIndex = 0;\n  async function worker() {\n    while (nextIndex < items.length) {\n      const index = nextIndex++;\n      results[index] = await work(items[index], index);\n    }\n  }\n  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));\n  return results;\n}\n\nmodule.exports = { mapWithConcurrency };",
        publicTests: [
          {
            name: "preserves result order under varied completion",
            input: "three differently delayed values",
            expected: "results in input order",
            testCode:
              "const result = await solution.mapWithConcurrency([3, 1, 2], 2, async (value) => { await new Promise((resolve) => setTimeout(resolve, value)); return value * 2; }); if (result.join(',') !== '6,2,4') throw new Error('result order changed');"
          }
        ],
        hiddenTests: [
          {
            name: "never exceeds configured concurrency",
            input: "eight work items at limit three",
            expected: "peak active work equals three",
            testCode:
              "let active = 0; let peak = 0; const result = await solution.mapWithConcurrency([1,2,3,4,5,6,7,8], 3, async (value) => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 1)); active -= 1; return value; }); if (peak > 3 || result.length !== 8) throw new Error('concurrency limit failed');"
          },
          {
            name: "rejects an invalid limit",
            input: "zero concurrency",
            expected: "RangeError",
            testCode:
              "let error; try { await solution.mapWithConcurrency([1], 0, async (value) => value); } catch (cause) { error = cause; } if (!(error instanceof RangeError)) throw new Error('invalid limit was accepted');"
          }
        ],
        wrongSolutions: [
          {
            name: "unbounded promise fanout",
            code: "async function mapWithConcurrency(items, limit, work) { return Promise.all(items.map((item, index) => work(item, index))); } module.exports = { mapWithConcurrency };"
          }
        ],
        runnerContract: RUNNER
      }
    },
    {
      order: 7,
      format: "production-decision",
      stageTitle: "Make the cache fail safely",
      patternKey: "prevent-cache-stampede",
      objective:
        "Choose cache key, expiry, request-coalescing, and failure-isolation behavior that reduces synchronized misses without weakening account isolation.",
      dependency:
        "Cache behavior is addressed only after the primary query and concurrency repairs so it remains an optimization rather than the correctness boundary.",
      topicKeys: ["cache-safety", "failure-isolation"],
      signals: ["caching", "failure-isolation", "bounded-work", "security"],
      prompt:
        "Review the cache proposal and replace it with a safe design. Cover tenant scoping, TTL synchronization, concurrent misses, cache failure, and stale-data limits.",
      artifact: {
        key: "latency-unsafe-cache-config",
        kind: "config",
        title: "Current order-history cache proposal",
        content:
          "key = `order-history:${userId}`\nttl = 30 seconds for every entry\non miss = every request loads from the database\non cache timeout = retry cache get three times, then fail the request\ninvalidation = none; rely only on TTL\nobserved at 12:00 = 4,200 keys expire within the same two-second window"
      },
      hints: [
        "The key must include the durable account/authorization scope used by the database query, not an ambiguous presentation identifier.",
        "Jitter and request coalescing reduce synchronized expiry and duplicate fills; bounds stop one hot key from creating unlimited waiters.",
        "Cache availability should not be required for correctness, and staleness must respect the product's order-update contract."
      ],
      answer: {
        concise:
          "Use account-scoped keys, bounded coalescing, jittered expiry, explicit invalidation/staleness limits, and a controlled database fallback.",
        explanation:
          "Keys must preserve tenant scope. Jitter spreads expiry, and one bounded in-flight fill per key prevents a stampede. Cache errors should degrade to a protected, rate-limited database path rather than fail or retry indefinitely. Explicit invalidation or an accepted staleness bound is required for order changes, with metrics for hit, fill, coalescing, and fallback outcomes."
      },
      rubric: [
        { criterion: "Preserves account isolation in cache keys", points: 3 },
        { criterion: "Prevents synchronized and concurrent miss amplification", points: 3 },
        { criterion: "Defines bounded failure and staleness behavior", points: 3 },
        { criterion: "Makes cache outcomes observable", points: 1 }
      ],
      commonMistakes: [
        "Treating the cache as mandatory makes an optional optimization another availability dependency and can bypass the intended database authorization scope."
      ],
      interviewerFollowUps: [
        "How would you prevent one hot account from consuming every coalesced-fill slot?"
      ],
      interviewConnection:
        "The question distinguishes a production cache design from simply placing a TTL in front of an inefficient query."
    },
    {
      order: 8,
      format: "production-decision",
      stageTitle: "Prove and release the repair",
      patternKey: "verify-latency-repair-rollout",
      objective:
        "Define load verification, canary comparison, success thresholds, overload protection, and rollback for the complete latency repair.",
      dependency:
        "The final stage combines database, concurrency, cache, retry, and customer evidence into one measurable delivery decision.",
      topicKeys: ["performance-verification", "safe-delivery"],
      signals: [
        "testing-verification",
        "observability",
        "rollout-safety",
        "customer-impact",
        "retry-safety"
      ],
      prompt:
        "Design the verification and rollout plan for the batch query, concurrency limit, and cache changes before the next peak. Include the workload model, canary signals, expansion criteria, overload behavior, and rollback triggers.",
      artifact: {
        key: "latency-release-objectives",
        kind: "scenario",
        title: "Release objectives and controls",
        content:
          "Order-history SLO: p95 below 900 ms and successful-response rate above 99.5% during peak. Canary routing supports 5%, 20%, 50%, and 100%. The endpoint can temporarily limit very large histories with an explicit retry response. Dashboards expose query count/request, pool wait, cache outcomes, retry overlap, event-loop lag, and response errors by deployment version."
      },
      hints: [
        "Replay a distribution that includes large accounts, aligned cache expiry, slow cache responses, and client retries rather than testing only average traffic.",
        "Compare canary and control on user success, p95/p99, queries per request, pool wait, cache fills, retries, and resource saturation.",
        "Define automatic pause or rollback thresholds and a controlled overload response that sheds work before the database pool collapses."
      ],
      answer: {
        concise:
          "Load-test the actual peak failure shape, then expand a canary only while customer and saturation signals beat control within explicit limits.",
        explanation:
          "The pre-release test must reproduce large histories, TTL waves, cache degradation, and overlapping retries. Canary stages compare p95/p99, success, query count, pool wait, cache fill/coalescing, retries, and event-loop health by version. Expansion requires the SLO and no new authorization/correctness regression. Pause or roll back application changes on threshold breach, while overload protection returns a bounded retry response rather than accepting work until pool collapse."
      },
      rubric: [
        { criterion: "Models the observed peak and failure conditions", points: 3 },
        { criterion: "Defines canary and control success signals", points: 3 },
        { criterion: "Defines expansion and rollback thresholds", points: 2 },
        { criterion: "Includes bounded overload behavior", points: 2 }
      ],
      commonMistakes: [
        "A low-traffic average-latency benchmark cannot prove the repair because it never reaches the aligned misses, pool queueing, or retry overlap that caused the incident."
      ],
      interviewerFollowUps: [
        "Which single signal would make you stop the canary even if average latency improves?"
      ],
      interviewConnection:
        "The final decision tests whether performance work is delivered as an observable reliability change rather than a local benchmark win."
    }
  ]
});

export const APPLIED_ENGINEERING_REVIEW_CANDIDATES = [
  DUPLICATE_WORK_AFTER_RETRY,
  LATENCY_CASCADE_UNDER_LOAD
] as const;
