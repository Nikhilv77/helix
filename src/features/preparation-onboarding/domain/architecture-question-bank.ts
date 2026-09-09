export type ArchitectureQuestion = {
  title: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
};

const q = (title: string, prompt: string, correct: string, ...wrong: string[]): ArchitectureQuestion => {
  const choices = [{ id: "correct", label: correct }, ...wrong.map((label, index) => ({ id: `wrong-${index + 1}`, label }))];
  let hash = 0;
  for (const character of prompt) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const offset = hash % choices.length;
  return { title, prompt, options: [...choices.slice(offset), ...choices.slice(0, offset)], correctOptionId: "correct" };
};

/** Fifty bounded system-design decisions—one best next architecture choice each. */
export const ARCHITECTURE_QUESTION_BANK: ArchitectureQuestion[] = [
  // Scale and performance
  q("Read-heavy traffic", "A public profile page is read millions of times but changes rarely. What is the first architecture lever?", "Cache read responses close to users with clear invalidation or TTLs", "Write every read into the primary database", "Disable all caching", "Create a new database per visitor"),
  q("Hot key", "One celebrity profile causes a single cache key to receive enormous traffic. What reduces pressure safely?", "Use caching with request coalescing or replication for the hot key", "Route every request to one application server", "Disable the profile endpoint", "Store it only in a local process"),
  q("Upload spike", "Image uploads create CPU-heavy transformations that slow the request path. What is a sound separation?", "Store the upload and process transformations asynchronously through workers", "Transform every image synchronously before responding", "Reject all large files permanently", "Run transformations in the browser only"),
  q("Search workload", "Users need flexible text search over a large catalogue. What should not be the sole long-term strategy?", "Relying only on unindexed substring scans in the primary transactional database", "Using a search index suited to text queries", "Keeping a source-of-truth product store", "Monitoring query latency"),
  q("Fan-out page", "A homepage calls ten independent downstream services. What reduces tail latency?", "Parallelise independent calls and set bounded timeouts for each", "Call every service serially", "Wait forever for the slowest dependency", "Duplicate all calls twice"),
  q("Burst traffic", "Traffic is bursty and average utilization is low, but peaks exhaust workers. What helps absorb bursts?", "Queue non-immediate work and scale consumers against queue depth", "Size only for average traffic", "Remove backpressure", "Make every task synchronous"),
  q("Large feed", "A user feed requires many small lookups per item. What should you examine first?", "Batch or precompute the read path to avoid N+1 dependency calls", "Add more page animations", "Increase log verbosity only", "Move all data to the client"),
  q("Global latency", "Users far from the main region see slow static assets. What is the appropriate first change?", "Serve static assets through a CDN with regional edge caching", "Move the database into every browser", "Disable compression", "Use a larger primary database"),
  q("Capacity headroom", "A service is steadily nearing saturation. What should capacity planning use?", "Demand trend, saturation signals, and explicit headroom targets", "Only the previous outage date", "A random multiplier", "The number of code files"),
  q("Expensive report", "A report scans months of data on every page view. What improves the design?", "Precompute or materialise the report on an appropriate schedule", "Run the full scan more often", "Add client-side retries", "Store the report in browser memory only"),
  // Data and storage
  q("Source of truth", "A system uses a search index and a transactional database. Which should own canonical order state?", "The transactional database, with the index derived from it", "The search index alone", "A browser cache", "A log file on one server"),
  q("Partition key", "Events are partitioned by a key that sends 90% of traffic to one partition. What is the design concern?", "The partition key creates a hot partition and needs a better distribution strategy", "The key is ideal because it is popular", "All partitions should be removed", "Only the UI needs changing"),
  q("Historical retention", "Audit records must be retained for years but are rarely queried. What is a sensible storage tier?", "Cheaper durable archival storage with an indexed retrieval path", "Keep every record in process memory", "Delete them after a week", "Store only screenshots"),
  q("Schema evolution", "A producer adds an optional field consumed by several services. What keeps the rollout safe?", "Use backward-compatible schema evolution and validate consumers", "Make it required immediately everywhere", "Change the field silently", "Remove schema validation"),
  q("Derived read model", "A dashboard needs fast aggregates that do not affect transactions. What is a good pattern?", "Build a derived read model from source events or replicated data", "Run aggregates inside every user request", "Write dashboard data directly from the UI", "Remove the source data"),
  q("Multi-tenant data", "Every query must isolate data by tenant. What should the data model enforce?", "A tenant boundary in keys, queries, and authorization checks", "A client-side filter only", "One shared anonymous account", "A random tenant selection"),
  q("Large object", "A service stores multi-megabyte video files in a relational row and is slowing backups. What is a better boundary?", "Store blobs in object storage and keep metadata/references in the database", "Split the blob across UI components", "Base64 encode it in every API response", "Keep more copies in the same table"),
  q("Write contention", "Many users update the same counter row at once. What should the design consider?", "Sharding, batching, or an append-and-aggregate approach to reduce contention", "A larger CSS cache", "More reads of the same row", "A client-side global lock"),
  q("Data freshness", "A warehouse report is stale. What should its contract expose?", "The latest successful data time and freshness expectation", "Only a green dashboard colour", "The number of dashboard users", "No timestamps"),
  q("Backup recovery", "A database backup exists but recovery has never been exercised. What is missing?", "Regular restore testing against recovery objectives", "A second copy of the backup name", "More production writes", "A longer backup retention alone"),
  // Consistency and distributed workflows
  q("Cross-service order", "Creating an order must eventually reserve inventory in another service. What handles a partial failure?", "A durable workflow with compensating actions or an outbox-driven event", "A single in-memory boolean", "A client-side retry only", "A global database lock across services"),
  q("Read-after-write", "A user updates a profile then immediately sees old data from a replica. What should the design account for?", "Replica lag and a read-after-write consistency strategy", "A font loading issue", "A missing browser tab", "A random retry loop"),
  q("At-least-once events", "A consumer may receive an event more than once. What is essential?", "Idempotent handling keyed by a stable event identifier", "Assuming exactly-once delivery", "Discarding all retries", "Processing events in the UI"),
  q("Out-of-order updates", "State updates can arrive out of order from a device. What should resolve conflicts?", "A version, sequence, or conflict-resolution rule based on domain needs", "Whichever update reaches the server first", "A random tie-breaker only", "No stored timestamps"),
  q("Long-running work", "A workflow takes minutes and must survive server restarts. What should carry its state?", "A durable job/workflow record rather than one in-memory request", "A browser timeout", "A single process variable", "A synchronous HTTP response"),
  q("Event publication", "A database transaction commits but event publication fails. What pattern closes the gap?", "Write the event to an outbox in the same transaction and publish reliably later", "Publish before committing the transaction", "Ignore the missing event", "Ask clients to infer it"),
  q("Duplicate payment", "A payment provider callback and a client response race. What must be shared?", "An idempotent payment state machine keyed by the provider/payment ID", "Two unrelated success flags", "A longer browser timeout", "A fresh payment for every retry"),
  q("Offline edits", "Users edit documents offline and later sync. What architecture concern is central?", "A defined merge/conflict strategy for concurrent changes", "Assuming network order is preserved", "Blocking all local edits", "Deleting the offline copy"),
  q("Command retries", "A command timeout leaves it unclear whether the server applied it. What supports safe retry?", "A client-supplied idempotency key and queryable command status", "A new random command on every retry", "A browser refresh only", "A longer title"),
  q("Exactly-once claim", "A design promises exactly-once side effects over an unreliable network. What is the realistic alternative?", "At-least-once delivery plus idempotent, deduplicated side effects", "Ignoring network failures", "One giant global lock", "No persistence"),
  // Interfaces, queues and boundaries
  q("API versioning", "An API response must change shape while older mobile apps remain active. What is the safe approach?", "Add compatible fields or version the contract with a migration window", "Remove old fields immediately", "Force all users to update instantly", "Hide the change in documentation"),
  q("Webhook delivery", "Your service sends webhooks to unreliable customer endpoints. What should the delivery design include?", "Signed payloads, retries with backoff, and observable delivery status", "One attempt with no record", "Unlimited immediate retries", "Unauthenticated browser redirects"),
  q("Backpressure", "Producers create jobs faster than consumers can process them. What should the queue boundary provide?", "Backpressure, bounded retention, and scaling signals", "Unlimited unbounded memory", "Silent job deletion", "Synchronous work for every producer"),
  q("Poison message", "One malformed message repeatedly fails and blocks useful work. What should the queue support?", "A retry limit and dead-letter path with diagnostics", "Infinite retries on the main queue", "Deletion without a trace", "Stopping all consumers forever"),
  q("Public API quota", "A public API needs to protect itself from abusive clients. What is a good boundary?", "Authentication-aware rate limits and clear quota responses", "A shared anonymous token", "No observability", "A hard global shutdown"),
  q("Request trace", "A request passes through several services and becomes slow. What interface capability helps diagnosis?", "Propagate a correlation/trace ID across service boundaries", "Give each service an unrelated random label", "Log only after errors", "Remove request metadata"),
  q("Async result", "A client starts a long export. What response contract avoids holding the request open?", "Return a job ID and expose status or completion notification", "Keep the HTTP request open for hours", "Ask the client to guess when it is ready", "Store the export only in browser memory"),
  q("Cache contract", "A shared cache sits before an API. What must the API define for safe caching?", "Which responses are cacheable and their invalidation/expiration semantics", "That every response lives forever", "No cache headers or rules", "A different colour per response"),
  q("Bulk endpoint", "A client needs to update hundreds of records. What can avoid excessive chattiness?", "A bounded bulk operation with per-item validation and result reporting", "Hundreds of unbounded parallel requests", "One UI click per record only", "A single enormous URL"),
  q("Tenant webhook", "A webhook must reach each tenant’s endpoint securely. What belongs to the design?", "Per-tenant endpoint configuration, secret rotation, and delivery observability", "One public shared secret forever", "Tenant IDs only in the page title", "No delivery logs"),
  // Security, availability and operational architecture
  q("Secret boundary", "Several services need a third-party credential. What is the safer distribution pattern?", "Retrieve scoped secrets at runtime from managed secret storage", "Commit the credential into every repository", "Put it in client JavaScript", "Share it in a public runbook"),
  q("Least privilege", "A batch worker only needs read access to one dataset. What should its identity have?", "The minimum scoped permission required for that dataset", "Administrator access to every system", "No identity at all", "The same credentials as every developer"),
  q("Single-region outage", "A service has a strict availability target and one region can fail. What architecture requirement follows?", "A tested multi-region or recovery design aligned to the target", "A larger single server", "No backups", "A faster local development environment"),
  q("Health checks", "A load balancer routes to a process that is alive but cannot serve dependencies. What should readiness mean?", "The instance can safely receive the traffic it will be sent", "The process merely exists", "The UI has loaded once", "A random timer elapsed"),
  q("Authentication session", "A user token is stolen from a browser. What limits the blast radius?", "Short-lived credentials, secure storage, and revocation/session controls", "Tokens that never expire", "Putting tokens in URLs", "Sharing tokens between users"),
  q("Disaster objective", "A product can tolerate losing at most five minutes of data. What must the architecture define?", "A recovery point objective and backup/replication design that meets it", "Only a recovery slogan", "No backup tests", "A longer page timeout"),
  q("Dependency isolation", "A non-critical analytics dependency is failing and consuming all worker threads. What architectural guard helps?", "Bulkhead isolation so it cannot exhaust critical resources", "Route all critical traffic through analytics", "Increase retries without limits", "Remove timeouts"),
  q("Audit access", "Administrators can view sensitive records. What should architecture preserve?", "An auditable access trail with actor, purpose, and time", "Only the current admin list", "No logs for privileged access", "A shared generic account"),
  q("DDoS resilience", "A public endpoint is targeted by a sudden traffic flood. What belongs at the edge?", "Rate limiting and traffic filtering before application capacity is exhausted", "Application retries for every request", "No CDN or edge controls", "A larger database schema"),
  q("SLO design", "A service has a user-facing latency objective. What should its architecture expose?", "Measurable latency, availability, and saturation signals tied to user journeys", "Only CPU usage", "A weekly screenshot", "No request metrics")
];

export function architectureQuestion(index: number): ArchitectureQuestion | null {
  return ARCHITECTURE_QUESTION_BANK[index] ?? null;
}
