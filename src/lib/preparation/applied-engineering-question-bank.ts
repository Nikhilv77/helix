export type AppliedEngineeringQuestion = {
  title: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
};

const q = (title: string, prompt: string, correct: string, ...wrong: string[]): AppliedEngineeringQuestion => {
  const choices = [{ id: "correct", label: correct }, ...wrong.map((label, index) => ({ id: `wrong-${index + 1}`, label }))];
  let hash = 0;
  for (const character of prompt) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const offset = hash % choices.length;
  return { title, prompt, options: [...choices.slice(offset), ...choices.slice(0, offset)], correctOptionId: "correct" };
};

/**
 * Fifty production scenarios across observability, reliability, delivery,
 * data integrity and operational judgment. Each has one best first action.
 */
export const APPLIED_ENGINEERING_QUESTION_BANK: AppliedEngineeringQuestion[] = [
  // Observe and diagnose
  q("Investigate before changing things", "A new release doubles API latency for a small group of users. What is the most useful first move?", "Inspect segmented traces and metrics, then isolate what changed", "Roll back immediately without checking telemetry", "Increase capacity for every user first", "Restart every service"),
  q("One region is slow", "Only one region sees elevated error rates after a deploy. Where do you begin?", "Compare regional traces, configuration, and deployment versions", "Scale every region at once", "Disable all alerts", "Change the client UI"),
  q("Slow endpoint", "An endpoint is slow only for requests with a large payload. What is the best first evidence?", "Trace the request path and compare payload size with time spent per dependency", "Rewrite the entire endpoint", "Increase every timeout", "Delete request logs"),
  q("Memory growth", "A service’s memory rises steadily over several hours. What should you collect before changing code?", "Heap or allocation profiles correlated with traffic and releases", "A new colour theme for dashboards", "More CPU cores only", "A random sample of source files"),
  q("Error spike", "Errors jump after a feature flag is enabled for 5% of users. What is the useful first slice?", "Compare flagged and unflagged requests using traces and error details", "Enable the flag for everyone", "Ignore the sample because it is small", "Clear the database cache"),
  q("Database pressure", "Database CPU is high but only during one report job. What should you inspect first?", "The job’s queries, query plans, and execution schedule", "The homepage font files", "All database tables without a hypothesis", "The user’s browser version"),
  q("Queue delay", "A worker queue is backing up while workers appear healthy. What is the first operational question?", "Whether arrival rate, processing time, or a downstream dependency changed", "Whether to delete queued jobs", "Whether to hide the queue metric", "Whether to restart the UI"),
  q("Cache misses", "Cache hit rate drops sharply after a release. What should you compare?", "Key construction, TTLs, and invalidation behaviour before and after the release", "Only the cache server’s colour", "The number of frontend routes", "Whether all cache entries can be removed"),
  q("Partial failure", "A payment integration fails for one card issuer. What should the first investigation use?", "Provider response codes and a slice by issuer, region, and request path", "A global payment retry loop with no limit", "A rollback of unrelated features", "A manual retry for every payment"),
  q("Noisy alert", "An alert fires often but usually resolves without user impact. What improves it?", "Tune it around a user-impact signal and a sustained threshold", "Disable all monitoring", "Page more people immediately", "Lower every threshold to zero"),
  // Reliability and resilience
  q("Downstream timeout", "A dependency is intermittently slow. What protects your endpoint first?", "A bounded timeout with a clear fallback or failure path", "Wait forever for the response", "Retry immediately without limits", "Increase the client font size"),
  q("Retry storm", "A downstream outage causes clients to retry in sync. What reduces the retry storm?", "Exponential backoff with jitter and a retry budget", "Infinite immediate retries", "A longer success message", "Removing all timeouts"),
  q("Duplicate event", "A webhook provider may deliver the same event twice. What makes processing safe?", "Deduplicate using the provider’s stable event ID", "Use only the current timestamp", "Process every delivery twice", "Ask the client to avoid retries"),
  q("Circuit breaker", "A dependency is failing fast and repeated calls are harming your own service. What pattern helps?", "Open a circuit temporarily and fail fast with a controlled fallback", "Keep calling until the dependency recovers", "Restart the database", "Cache the error forever"),
  q("Graceful degradation", "A non-essential recommendations service is unavailable. What should the product do?", "Serve the core page without recommendations and record the degradation", "Block all users from the core page", "Retry the service forever in the browser", "Hide the outage from logs"),
  q("Idempotent write", "A client times out after submitting an order and retries. What protects against two orders?", "An idempotency key checked at the write boundary", "A longer page animation", "A new endpoint name", "Clearing the user’s cookies"),
  q("Rate limit", "One client is exhausting a shared API resource. What is the targeted response?", "Apply a scoped rate limit and return a clear retry signal", "Take the API offline for everyone", "Increase every client’s quota", "Silently drop all logs"),
  q("Dead-letter queue", "A message repeatedly fails after safe retries. What should happen next?", "Move it to a dead-letter path with context for investigation", "Retry it forever on the hot queue", "Delete it without a record", "Block all unrelated messages"),
  q("Config fallback", "A remote configuration service is unavailable at startup. What reduces the blast radius?", "Use a validated last-known-good or conservative default configuration", "Start with random configuration", "Refuse every request permanently", "Fetch configuration on every render"),
  q("Overload", "Traffic suddenly exceeds capacity. Which response preserves service best?", "Shed non-critical work and protect the most important requests", "Accept unlimited work until every process crashes", "Disable all caching", "Add expensive logging to every request"),
  // Safe delivery and change management
  q("Risky deploy", "A schema change may not be compatible with old application servers. What is the safest rollout?", "Deploy a backward-compatible schema change before code that depends on it", "Deploy the breaking code and schema simultaneously everywhere", "Delete the old column first", "Skip testing because it is a small change"),
  q("Feature rollout", "A new feature has uncertain performance impact. What delivery approach is best?", "Roll out gradually with metrics and a quick rollback path", "Enable it for all users at once", "Ship it without telemetry", "Wait for a customer complaint"),
  q("Rollback readiness", "Before a high-risk release, what makes rollback trustworthy?", "A tested rollback or forward-fix plan with compatible data changes", "A promise to decide later", "A copy of the release notes only", "Disabling all alerts"),
  q("Migration backfill", "A backfill will touch millions of rows in production. What lowers risk?", "Run it in small resumable batches with progress and impact monitoring", "Lock the entire table for the full run", "Execute it unmonitored at peak traffic", "Skip a checkpoint"),
  q("Flag cleanup", "A feature flag has been fully rolled out for months. What is the right maintenance step?", "Remove the obsolete flag path after verifying no rollback need remains", "Keep every old branch forever", "Reuse the flag name for unrelated behaviour", "Hide it from the codebase"),
  q("Canary signals", "A canary release is live. Which signal should decide whether to expand it?", "A predefined comparison of error, latency, and user-impact metrics against control", "How exciting the release announcement sounds", "Only the number of deploys today", "One developer’s intuition"),
  q("Secrets rotation", "A credential is suspected to be exposed. What is the immediate operational response?", "Rotate and revoke it, then audit use of the old credential", "Rename the credential only", "Wait until the next release", "Publish it so everyone can check it"),
  q("Version mismatch", "Workers and API servers may run different versions during deploy. What should their contract support?", "Backward and forward compatibility during the transition", "A requirement that every process restarts simultaneously", "Undocumented message fields", "A shared mutable local file"),
  q("Dependency upgrade", "A library upgrade changes behaviour in a critical path. What reduces release risk?", "Test the specific behaviour and deploy behind a monitored rollout", "Upgrade every dependency at once", "Ignore the changelog", "Disable integration tests"),
  q("Incident change freeze", "An incident is ongoing and an unrelated deploy is scheduled. What is prudent?", "Pause non-essential changes until system state is understood", "Deploy more unrelated changes to save time", "Turn off the incident channel", "Delete the deployment history"),
  // Data integrity and concurrency
  q("Lost update", "Two users edit the same record and the later save silently overwrites the first. What protects the write?", "Optimistic concurrency using a version or conditional update", "A longer UI refresh interval", "A client-only timestamp", "A second submit button"),
  q("Exactly-once myth", "A message consumer can receive events at least once. What should its design assume?", "Idempotent processing and observable retries", "Exactly-once delivery without safeguards", "No need for a stable event ID", "A single global lock for all events"),
  q("Safe deletion", "A cleanup job may delete records that became active again. What should the delete query include?", "A condition that revalidates the current eligible state at deletion time", "Only the state from yesterday’s report", "No condition, for speed", "A random sample"),
  q("Transactional boundary", "Creating a subscription must also reserve a quota or neither should persist. What is the correct boundary?", "A transaction or compensating workflow covering both durable changes", "Two independent best-effort requests", "A client-side modal", "A longer timeout"),
  q("Out-of-order event", "Events can arrive out of order for the same entity. What should the consumer track?", "A sequence/version rule or event time to reject stale updates", "Only arrival order", "A global counter for all users", "The browser tab order"),
  q("Backfill duplicate", "A data backfill may be restarted after a partial failure. What makes reruns safe?", "A deterministic key or merge/checkpoint for each write", "Append all rows again", "Disable validation", "Run it only once and hope"),
  q("Read replica lag", "A user saves data then immediately reads an old value from a replica. What explains it?", "Replication lag; route read-after-write appropriately", "A CSS caching issue", "A missing browser refresh only", "A queue with no messages"),
  q("Audit trail", "A sensitive permission changes unexpectedly. What data makes the incident explainable?", "An immutable audit record with actor, before/after values, and time", "Only the current permission value", "A screenshot of the settings page", "A deleted application log"),
  q("Partial batch", "A batch writes half its records then crashes. What should the next run be able to do?", "Resume or safely retry from a recorded checkpoint", "Start over by duplicating everything", "Ignore the partial output", "Disable failure alerts"),
  q("Data contract", "A producer adds a field with a new meaning. What prevents downstream breakage?", "A versioned contract and compatibility validation with consumers", "Changing it silently", "Removing all schema checks", "Only updating a dashboard title"),
  // Operational judgment and customer impact
  q("Customer impact", "A bug affects a small number of high-value transactions. How should priority be assessed?", "By user/business impact and reversibility, not raw affected count alone", "Only by the number of log lines", "Only by who noticed first", "By the easiest fix"),
  q("Unclear incident", "An alert and user report conflict. What should the incident lead do first?", "Establish a shared timeline and verify evidence from both sources", "Choose the alert automatically", "Close the report without checking", "Ask everyone to guess the root cause"),
  q("Manual mitigation", "A manual workaround restores service but risks inconsistent data. What should accompany it?", "A recorded scope, owner, expiry plan, and follow-up reconciliation", "No documentation so it stays fast", "Permanent use without review", "Deletion of the incident notes"),
  q("Support escalation", "Support reports a reproducible customer issue with no matching alert. What is the best response?", "Capture the request context and add targeted observability while investigating", "Dismiss it because dashboards are green", "Ask support to stop reporting it", "Restart all services"),
  q("Post-incident", "An incident is resolved. What makes the follow-up useful?", "Document contributing factors, corrective actions, owners, and due dates", "Find one person to blame", "Only write a celebratory message", "Delete the timeline"),
  q("Capacity planning", "Usage is growing steadily and latency is nearing its SLO. What is a sound planning input?", "Trend demand, saturation, and headroom before capacity is exhausted", "Wait for an outage to reveal the limit", "Double capacity without measurements", "Ignore the SLO"),
  q("SLO breach", "Latency exceeds its SLO but error rate is normal. What should guide the response?", "The user impact and error budget policy, alongside the latency evidence", "Only whether the servers are online", "The number of open browser tabs", "A random restart"),
  q("Runbook", "A repeated operational task depends on one engineer’s memory. What reduces risk?", "A tested runbook with clear preconditions, steps, and verification", "Keep it undocumented for flexibility", "Ask a different person to guess each time", "Automate it without understanding it"),
  q("Escalation", "An on-call engineer lacks access needed to mitigate an incident. What should the system provide?", "A defined escalation path and least-privilege emergency access process", "A shared root password in chat", "No access process", "A request to wait until business hours"),
  q("Cost spike", "Cloud cost rises suddenly after a release. What is the right first investigation?", "Compare cost by service, workload, and deployment change before optimising", "Delete billing data", "Scale everything down blindly", "Assume it is a reporting error")
];

export function appliedEngineeringQuestion(index: number): AppliedEngineeringQuestion | null {
  return APPLIED_ENGINEERING_QUESTION_BANK[index] ?? null;
}
