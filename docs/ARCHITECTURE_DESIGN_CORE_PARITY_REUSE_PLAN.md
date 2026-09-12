# Architecture & Design — Story Practice Parity and Reuse Plan

Status: Implementation complete through Step 7; authenticated release verification remains pending

Scope: `/practice/architecture-design`

Companion documents:

- `docs/STORY_DRIVEN_ARCHITECTURE_DESIGN.md` remains the source of truth for Architecture content,
  focus, dimensions, persistence, privacy, and reviewed-scenario requirements.
- `docs/APPLIED_ENGINEERING_CORE_PARITY_REUSE_PLAN.md` records the shared UI and live-room
  extraction already completed for Core Technical and Applied Engineering.
- `docs/CORE_TECHNICAL_UI_BASELINE.md` defines the visual and responsive baseline.
- `docs/INTERVIEW_SESSION_ARCHITECTURE.md` defines durable interview-session ownership and history.

## 1. Executive summary

Architecture & Design should become the third domain adapter over the shared Story Practice product.
It must not become a copy of Core Technical or Applied Engineering.

The repository already contains most of the Architecture domain implementation:

- six reviewed four-question scenarios;
- Architecture focus, eligibility, ranking, preparation, practice, assessment, continuation,
  history, and analytics services;
- separate Architecture Prisma records and repository adapter;
- authenticated Architecture API routes and server pages;
- normalized Architecture presentation adapters;
- reuse of the shared preparation, overview, question-workspace, assessment, artifact, and report
  components.

The remaining work is primarily a parity migration:

1. use the polished shared first-entry welcome;
2. give unstarted Architecture scenarios the same question-row materialization behavior;
3. change Architecture assessment delivery from `inline-form` to `shared-voice-room`;
4. add Architecture configuration to the neutral room identity, runtime, dialogue, transcript
   finalization, and recovery paths;
5. add terminal readiness/completion when there is no next reviewed scenario;
6. preserve already-started inline Architecture assessments during the migration;
7. verify Core, Applied, Architecture, DSA, and saved-session compatibility.

Expected reuse for the complete session is approximately:

```text
Direct shared implementation reuse       75–80%
Architecture-owned domain implementation 20–25%
```

Because the Architecture domain and pages already exist, this parity migration should reuse
approximately 85–90% of the current implementation. New production code should be mostly thin
configuration and domain adapters, not another lifecycle implementation.

## 2. Product outcome

From a candidate's point of view, Architecture & Design should feel like the next session in the
same product:

- the same authenticated first-entry teacher stage;
- the same responsive page geometry and history navigation;
- the same expandable library and question-row actions;
- the same question workspace controls, hints, feedback, Learn behavior, and artifacts;
- the same assessment card, media setup, teacher room, typed fallback, transcript, Save & exit,
  resume, completion handoff, report, and continuation interaction;
- the same retry, privacy, owner-isolation, immutable-history, and atomicity guarantees.

Only the domain changes:

- Core Technical explains language and runtime mechanisms.
- Applied Engineering diagnoses and repairs production incidents.
- Architecture & Design frames requirements, quantifies scale, chooses boundaries and data flow,
  plans for failure, and defends trade-offs.

“Same to same” means one shared product implementation with typed configuration. It does not mean
forcing Architecture into code exercises, Node.js terminology, Core schemas, Applied records, or
an eight-question content contract.

## 3. Non-negotiable invariants

### 3.1 Shared presentation ownership

Architecture must use the implementation under `src/features/practice/shared/ui/` for equivalent
states. Architecture wrappers may adapt public domain values and supply configuration, but they
must not duplicate layout or state behavior.

This includes:

- page width, padding, breakpoints, surfaces, typography, borders, radii, and focus rings;
- teacher placement, mobile visibility, alpha feathering, and reduced-motion behavior;
- progress, history, library cards, question rows, sticky coach, and selected-card treatment;
- assessment locked, ready, in-progress, finalizing, completed, retry, and historical states;
- keyboard, screen-reader, touch, and responsive behavior.

### 3.2 Server-owned lifecycle

The lifecycle remains server-owned:

```text
unavailable
  -> role-aligned welcome
  -> confirming
  -> preparing
  -> practising four Architecture questions
  -> assessment ready
  -> shared voice assessment in progress
  -> finalizing
  -> completed report
  -> next scenario, readiness, or preparation complete
```

The browser may display state and request authenticated mutations. It must not choose a scenario,
calculate difficulty, unlock an assessment, grade a response, infer readiness, or promote the next
block.

### 3.3 Architecture domain isolation

Keep these Architecture-owned:

- Architecture Prisma models and rows;
- the sixteen Architecture dimensions;
- focus and baseline-evidence contracts;
- scenario, question, assessment, report, and ranking schemas;
- reviewed scenario content and private evaluation material;
- Architecture error codes, lease namespaces, analytics, and content publication gates.

Do not cast Architecture snapshots to Core or Applied private types. Do not migrate three domains
into a generic persistence table as part of this work.

### 3.4 Non-executable version-one scope

Architecture remains language-independent and non-executable:

- `capabilities.runCode` remains `false`;
- there is no Architecture `/run` route;
- no Node.js runner or sandbox is required for eligibility;
- the shared workspace must not render Run controls for Architecture;
- architecture artifacts use the existing scenario, metrics, trace, config, and related safe
  presentation kinds.

## 4. Current implementation inventory

### 4.1 Already complete and reusable

Architecture already has:

```text
src/features/practice/architecture-design/domain/
  assessment-contracts.ts
  baseline-evidence-contracts.ts
  focus-ranking-contracts.ts
  question-contracts.ts
  reviewed-scenarios.ts
  scenario-contracts.ts
  scenario-ranking-catalogue.ts
  ui-state.ts
  workspace-analytics.ts

src/features/practice/architecture-design/server/
  assessment-blueprint.ts
  assessment-evaluator.ts
  assessment.service.ts
  baseline-evidence.service.ts
  continuation.service.ts
  eligibility.service.ts
  focus.service.ts
  history.service.ts
  persistence.service.ts
  practice.service.ts
  preparation.service.ts
  repository-adapter.ts
  scenario-ranking.service.ts
  workspace-analytics.service.ts

src/features/practice/architecture-design/ui/
  architecture-design-adapter.ts
  architecture-design-experience.ts
  architecture-design-overview.tsx
  architecture-design-preparation.tsx
  architecture-design-question-workspace.tsx
```

The server pages and authenticated API surface also already exist under:

```text
src/app/practice/architecture-design/
src/app/api/practice/architecture-design/
```

The application container registers the complete Architecture service graph under the grouped
`architectureDesign` capability.

### 4.2 Shared implementation now available

Core and Applied have already established these neutral shared boundaries:

```text
src/features/practice/shared/ui/
  contracts.ts
  view-contracts.ts
  story-practice-technology-welcome.tsx
  story-practice-preparation.tsx
  story-practice-intro.tsx
  story-practice-overview.tsx
  story-practice-question-workspace.tsx
  story-practice-assessment.tsx
  story-practice-learning-guide.tsx
  story-practice-artifact.tsx

src/features/practice/shared/server/
  contracts.ts
  assessment-runtime.ts
  assessment-transcript.ts
  continuation-orchestrator.ts
  assessment-orchestrator.ts
  preparation-orchestrator.ts
  practice-orchestrator.ts
  route-kit.ts
```

The shared interview layer already provides:

- a neutral durable story-practice assessment identity;
- a replay-safe room runtime coordinator;
- shared opening, transition, teaching, and closing behavior;
- the same question state machine, follow-up limit, voice and typed answers, transcript, reconnect,
  media setup, Save & exit, and completion screen;
- completion hooks that safely attempt Core and Applied finalization;
- a public serializer that removes server-only answer guides and rubrics.

### 4.3 Exact parity gaps

The current Architecture experience is close, but not exact:

1. `ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE.mode` is `inline-form`, not
   `shared-voice-room`.
2. Architecture assessment start returns an assessment only; it does not create or return a
   durable room session.
3. `StoryPracticeAssessmentKind` currently recognizes Core and Applied, not Architecture.
4. The room dialogue registry contains Core and Applied wording only.
5. Interview completion hooks call Core and Applied finalizers only.
6. Architecture has no transcript-to-five-response room finalizer or overview recovery.
7. Architecture continuation assumes `nextScenario` always exists and can strand the last scenario.
8. Architecture uses the older shared preparation selector rather than the polished teacher-led
   first-entry welcome used by Core and Applied.
9. Architecture library configuration does not currently expose an unstarted-row `start-path`
   endpoint.
10. Existing in-progress inline assessments need an explicit compatibility path during cutover.

## 5. Target architecture

```text
                         Story Practice shared product
       UI + lifecycle invariants + voice-room protocol + transcript helper
                    /                 |                  \
                   /                  |                   \
       Core Technical         Applied Engineering       Architecture & Design
       mechanism adapter      incident adapter          design-scenario adapter
       Core persistence       Applied persistence       Architecture persistence
```

Dependency direction:

```text
Core -----------> shared story-practice <----------- Applied
                         ^
                         |
                    Architecture
```

The shared layer must not import Architecture domain or Prisma contracts. Architecture translates
at the boundary through its existing adapter and runtime configuration.

## 6. Reuse map

| Concern                         | Direct reuse | Architecture configuration            | Architecture ownership             |
| ------------------------------- | -----------: | ------------------------------------- | ---------------------------------- |
| Practice card and page shell    |      95–100% | label, order, route, unavailable copy | eligibility/progress read          |
| First-entry teacher welcome     |          95% | role-aligned option and payload       | focus confirmation                 |
| Overview, progress, history     |          95% | scenario noun, copy, routes           | public block adapter               |
| Scenario library                |          90% | start endpoint, labels                | reviewed scenario lookup           |
| Question workspace              |       85–90% | `runCode: false`, design wording      | question/evaluation contract       |
| Artifacts and learning UI       |       90–95% | safe artifact mapping                 | reviewed Architecture evidence     |
| Assessment/report UI            |          95% | measures and score rows               | report adapter                     |
| Voice-room client/state machine |       90–95% | identity and dialogue                 | frozen Architecture plan           |
| Save/resume/transcript          |       85–90% | return route and evidence label       | owner/session verification         |
| Runtime coordinator             |       85–90% | Architecture runtime port             | record/snapshot adapter            |
| Finalization protocol           |       75–85% | response mapping and recovery         | Architecture evaluator/transaction |
| Continuation orchestration      |       70–80% | scenario result mapping               | Architecture ranker/repository     |
| Auth/rate limit/leases/errors   |       80–90% | namespace and schemas                 | Architecture error vocabulary      |
| Persistence                     |       50–65% | shared transaction invariants         | Architecture tables and queries    |
| Content, rubrics, scoring       |       10–25% | shared shapes only                    | Architecture-owned                 |

The reuse percentage measures direct shared implementation. Reusing an algorithm's shape while
copying it into Architecture does not count as reuse.

## 7. Architecture content contract

Architecture keeps four connected practice questions per scenario:

| Order | Stage                    | Candidate work                                               |
| ----: | ------------------------ | ------------------------------------------------------------ |
|     1 | Requirements and scale   | Scope, constraints, traffic, storage, latency, availability  |
|     2 | Contracts and data       | APIs/events, models, access patterns, indexes, consistency   |
|     3 | Architecture and failure | Components, flow, caching, backpressure, hotspots, isolation |
|     4 | Quality and evolution    | Observability, security, privacy, cost, rollout, migration   |

The shared UI must derive question counts from the frozen block. It must not assume the six/eight
question Core/Applied shape.

Architecture's stable sixteen dimensions remain its ranking and scoring vocabulary. They must not
be renamed to Core mechanisms or Applied production signals merely to satisfy a generic API.

### 7.1 Original reviewed launch paths

The original version-one launch catalogue contained two approved immutable scenarios. Preserve
their keys, questions, fingerprints, and saved snapshots:

1. `multi-tenant-webhook-delivery`
   - requirements and scale: scope at-least-once delivery, calculate fan-out and history volume,
     and define ingestion and healthy-endpoint SLOs;
   - contracts and data: define tenant-scoped event, subscription, logical-delivery, attempt, and
     signing-key-version identities with idempotent ingestion and an outbox boundary;
   - architecture and failure: diagnose unsafe cache scoping, hot tenants, retry amplification,
     shared-worker exhaustion, partitioning, and fair admission;
   - quality and evolution: defend redacted telemetry, secret handling, retention, regional
     recovery, single-authority canary migration, and rollback.
2. `high-volume-notification-platform`
   - requirements and scale: separate transactional and campaign workloads, reserve critical
     capacity, shape fan-out below provider limits, and define distinct SLOs;
   - contracts and data: define request, recipient-channel delivery, provider-attempt, callback,
     template-version, preference, and consent identities;
   - architecture and failure: design paged fan-out, priority isolation, provider routing,
     individual-delivery retries, cache invalidation, and fenced regional ownership;
   - quality and evolution: defend state-specific telemetry, privacy-safe retention, cost-aware
     routing, regional canaries, and state-compatible rollback.

These two paths satisfy the minimum launch requirement, but they exercise similar architecture:
both are high-volume asynchronous fan-out systems with queues, retries, and external destinations.
Do not add another fan-out-delivery scenario as the next catalogue item. The next reviewed paths
should deliberately add transactional, real-time consistency, storage/CDN, and search/indexing
coverage.

### 7.2 Proposed backend/full-stack catalogue expansion

The target reviewed catalogue is six scenario families. Six is the available library, not a
requirement that every candidate complete six scenarios. Ranking and readiness should normally
select only the smallest set needed to address material gaps.

| Curriculum family                  | Stable proposed key                 | Primary architecture contrast                     | Status                 |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------- | ---------------------- |
| Multi-tenant webhook delivery      | `multi-tenant-webhook-delivery`     | asynchronous delivery and tenant isolation        | reviewed and published |
| High-volume notifications          | `high-volume-notification-platform` | priority fan-out and provider routing             | reviewed and published |
| Marketplace checkout and inventory | `marketplace-checkout-inventory`    | transactional workflow and reconciliation         | reviewed and published |
| Collaborative document editing     | `collaborative-document-editing`    | real-time state, ordering, and offline merge      | reviewed and published |
| Global media upload and processing | `global-media-processing`           | large-object storage, pipelines, and CDN delivery | reviewed and published |
| Search and autocomplete            | `search-autocomplete-platform`      | indexing, freshness, relevance, and read scaling  | reviewed and published |

Do not reorder or rewrite existing saved blocks to match this table. It describes catalogue
coverage. The server ranker continues to choose the active scenario from compatibility, evidence,
novelty, and difficulty.

### 7.3 Reviewed path 3 — Marketplace checkout and inventory

**Scenario premise:** Design checkout for a multi-seller marketplace that reserves limited stock,
authorizes payment, creates an order, and recovers safely when inventory, payment, or fulfillment
services fail.

**Why this path exists:** It adds correctness-heavy transactional design that the two launch paths
do not cover deeply: concurrent reservations, money movement, workflow state, compensation, and
reconciliation.

#### Question 1 — Requirements, correctness, and scale

Prompt intent:

> Define the first-release checkout boundary and non-goals. Quantify peak checkout, reservation,
> payment, and inventory-write load. State the oversell, latency, availability, and recovery
> guarantees that the design will defend.

The visible metrics artifact should include normal and flash-sale checkout rates, items per order,
payment-provider latency/error rates, reservation expiry, and a small number of extremely hot SKUs.

Evaluation logic:

- distinguish cart, checkout attempt, order, payment authorization, and fulfillment;
- state whether overselling is forbidden or bounded and what the candidate can actually guarantee;
- calculate peak writes including retries and multi-item orders;
- define measurable checkout latency, order correctness, and recovery objectives;
- reject claims of an atomic transaction across an external payment provider.

#### Question 2 — Order, reservation, and payment contracts

Prompt intent:

> Review a proposed checkout API and schema that uses one mutable order status and decrements stock
> before calling payment. Redesign idempotency, order, reservation, payment-attempt, inventory, and
> state-transition contracts, including the required consistency boundaries and access paths.

The visible config artifact should contain a deliberately unsafe schema: retry-generated order IDs,
inventory counts without versions, callbacks correlated by user ID, and no append-only payment or
state-transition history.

Evaluation logic:

- use a buyer-scoped or merchant-scoped idempotency key with payload-conflict semantics;
- separate logical order/payment identity from append-only attempts;
- use conditional inventory updates or reservation records with explicit expiry;
- make the local order plus dispatch intent atomic through an outbox or equivalent boundary;
- define indexes for buyer history, seller fulfillment, reservation expiry, and reconciliation.

#### Question 3 — Checkout workflow and failure recovery

Prompt intent:

> Design the end-to-end checkout flow and explain how it behaves under duplicate requests,
> concurrent buyers for a hot SKU, payment timeouts, late callbacks, expired reservations, worker
> retries, and a partial regional outage.

The visible trace should show duplicate payment authorization after a timeout, negative inventory
for one hot SKU, an expired reservation later confirmed by a callback, and a growing reconciliation
queue.

Evaluation logic:

- define one explicit workflow owner and legal state transitions;
- serialize or conditionally protect only the contested inventory boundary;
- make every command and callback idempotent;
- distinguish retry, compensation, and reconciliation instead of calling all of them rollback;
- isolate hot SKUs and failing payment providers without blocking unrelated orders;
- show the order, event, and failure path from API acceptance to terminal outcome.

#### Question 4 — Operability, audit, and migration

Prompt intent:

> Defend the production plan: reconciliation invariants, SLOs, payment and personal-data boundaries,
> reservation-expiry operations, regional recovery, cost controls, and a reversible migration from
> the existing synchronous checkout.

Evaluation logic:

- reconcile money, orders, reservations, and inventory through conservation-style invariants;
- keep payment tokens and sensitive buyer data out of routine logs;
- define alerting for stuck states, duplicate authorizations, oversells, and expiry backlog;
- retain one side-effect authority during shadowing and canary rollout;
- require compatible state/schema rollback rather than only redeploying old code.

### 7.4 Reviewed path 4 — Collaborative document editing

**Scenario premise:** Design a multi-device collaborative document editor with live updates,
presence, offline edits, access control, and durable version history.

**Why this path exists:** It tests long-lived connections, operation ordering, concurrent edits,
hot documents, session routing, offline reconciliation, and permission revocation.

#### Question 1 — Collaboration semantics and scale

Prompt intent:

> Define the editing, presence, offline, history, and sharing boundary. Quantify concurrent
> connections, operations per second, hot-document load, snapshot volume, and acceptable local and
> remote edit latency.

Evaluation logic:

- separate durable edits from ephemeral cursor/presence state;
- define ordering and convergence expectations without promising impossible global ordering;
- establish offline and reconnect behavior explicitly;
- calculate both aggregate connection load and worst-case hot-document load;
- define latency, durability, convergence, and recovery SLOs.

#### Question 2 — Operations, revisions, and authorization contracts

Prompt intent:

> Design document, operation, revision, snapshot, membership, and sync-cursor contracts. Explain
> deduplication, optimistic concurrency, permission checks, history reads, and compaction.

Evaluation logic:

- give client operations stable IDs and a base revision or causal context;
- choose and defend an OT, CRDT, or server-ordered model appropriate to stated requirements;
- retain an append-only operation history plus bounded snapshots/compaction;
- ensure document-leading authorization and history access paths;
- define what happens to queued offline edits after access is revoked.

#### Question 3 — Realtime topology and conflict/failure handling

Prompt intent:

> Walk through connect, edit, broadcast, persist, disconnect, and reconnect. Handle a celebrity-hot
> document, duplicated operations, a slow client, gateway failure, region failover, and offline
> conflicts.

Evaluation logic:

- define gateway, session-routing, document-owner/sequencer, persistence, snapshot, and broadcast
  boundaries;
- avoid using one global broker partition or one process-local source of truth;
- use bounded per-client buffers and resynchronization for slow consumers;
- fence competing document owners during failover;
- show how clients detect gaps and recover from a snapshot plus operations.

#### Question 4 — Privacy, observability, and protocol evolution

Prompt intent:

> Define collaboration health signals, content/privacy boundaries, access audit, storage cost,
> deletion and retention, and a reversible migration of the synchronization protocol.

Evaluation logic:

- measure convergence delay, reconnect recovery, rejected operations, gap repair, and hot-document
  saturation;
- avoid logging document bodies or credentials as routine diagnostics;
- preserve auditable sharing and privileged access changes;
- version client/server protocols and support mixed-version clients during rollout;
- use shadow validation and document cohorts with a fencing/rollback control.

### 7.5 Reviewed path 5 — Global media upload and processing

**Scenario premise:** Design a platform that accepts large photos and videos, processes variants,
serves them globally, and enforces tenant access, deletion, and lifecycle policy.

**Why this path exists:** It adds large-object transfer, object storage, workflow orchestration,
derived assets, CDN behavior, malware scanning, lifecycle transitions, and storage/egress economics.

#### Question 1 — Media scope, transfer, and capacity

Prompt intent:

> Define upload, processing, playback/download, deletion, and sharing requirements. Estimate peak
> ingress, stored bytes, derived-asset amplification, processing concurrency, and CDN egress, then
> state measurable upload and availability SLOs.

Evaluation logic:

- bound file types/sizes and distinguish original from derived assets;
- choose resumable/multipart transfer where appropriate;
- show storage and egress arithmetic with retention and replication assumptions;
- separate accepted upload, processed readiness, and global delivery SLOs;
- state malware, moderation, and deletion boundaries without overclaiming synchronous completion.

#### Question 2 — Asset, upload, and processing contracts

Prompt intent:

> Redesign an API that proxies every byte through the application and overwrites one media row.
> Define upload-session, object, asset-version, processing-job, derived-asset, access, and deletion
> contracts with their consistency boundaries.

Evaluation logic:

- authorize short-lived direct object-store uploads without trusting a client-supplied object key;
- use stable asset/version IDs and idempotent finalize/processing requests;
- make metadata state transitions conditional and auditable;
- relate every derived asset to an immutable original/version and transformation version;
- provide owner/tenant-leading reads and cleanup indexes for abandoned sessions and expired data.

#### Question 3 — Processing pipeline and delivery failure

Prompt intent:

> Design upload finalization, scanning, metadata extraction, transcoding, thumbnail generation, CDN
> publication, and deletion. Handle duplicate jobs, poison media, regional processing loss, cache
> invalidation, and a viral asset.

Evaluation logic:

- use event/outbox-driven stages with idempotent transformations and bounded retries;
- isolate formats, tenants, and expensive workloads through queues, quotas, and dead-letter paths;
- use immutable/versioned object keys so cache correctness does not depend on global purges;
- separate metadata authority from blob storage and CDN caches;
- reconcile orphan originals, missing variants, and incomplete deletion.

#### Question 4 — Security, cost, retention, and migration

Prompt intent:

> Defend signed access, tenant isolation, content scanning, privacy deletion, regional recovery,
> storage/compute/egress cost policy, observability, and migration from the legacy upload path.

Evaluation logic:

- scope signed URLs narrowly by asset, operation, lifetime, and owner;
- define deletion propagation and evidence across metadata, object replicas, derivatives, and CDN;
- measure time-to-ready, stage failure, backlog age, cache behavior, and unit cost;
- use storage tiers and derivative policy rather than retaining every output indefinitely;
- canary one asset class or tenant with compatible metadata and a routing kill switch.

### 7.6 Reviewed path 6 — Search and autocomplete

**Scenario premise:** Design product search and autocomplete over a large, frequently changing
catalogue with filters, authorization, relevance, typo tolerance, and regional reads.

**Why this path exists:** It tests derived indexes, change-data capture, freshness, query patterns,
relevance evaluation, reindexing, read scaling, and deletion propagation.

#### Question 1 — Search behavior and capacity

Prompt intent:

> Define searchable entities, query/filter behavior, autocomplete, authorization, freshness, and
> non-goals. Estimate query load, update load, index size, peak hot-query traffic, and latency and
> freshness SLOs.

Evaluation logic:

- distinguish product search, exact identifier lookup, autocomplete, and analytical queries;
- define relevance and freshness in measurable terms;
- calculate read QPS, indexing throughput, replicas, and storage with explicit assumptions;
- specify pagination and result-stability expectations;
- keep the transactional source of truth distinct from the derived search index.

#### Question 2 — Query, document, and indexing contracts

Prompt intent:

> Design query, filter, pagination, document-version, indexing-event, synonym/configuration, and
> authorization contracts. Explain source-to-index consistency and deletion semantics.

Evaluation logic:

- use stable source and document versions to reject stale or duplicate indexing events;
- choose cursor/search-after pagination rather than an unbounded offset contract;
- apply authorization filters without leaking document existence or cross-tenant data;
- version analyzers, mappings, synonyms, and ranking configuration;
- define access paths for incremental updates, backfills, and deletion verification.

#### Question 3 — Ingestion, serving, and hotspot failure

Prompt intent:

> Design CDC/event ingestion, enrichment, indexing, shard/replica placement, query serving, caching,
> overload protection, and reindexing. Diagnose stale results, a hot shard, and a thundering herd on
> a popular query.

Evaluation logic:

- checkpoint and replay changes with idempotent version-aware writes;
- choose shard keys from access/distribution evidence rather than copying tenant ID mechanically;
- isolate indexing from serving and preserve reserved query capacity;
- use bounded cache keys, TTL/invalidation, request coalescing, and load shedding;
- migrate indexes through versioned dual-read/shadow comparison and an alias/routing switch.

#### Question 4 — Relevance, privacy, cost, and index evolution

Prompt intent:

> Define relevance/freshness evaluation, user-facing SLOs, privacy deletion, abuse controls,
> observability, replica and retention cost, and a reversible analyzer/index migration.

Evaluation logic:

- combine offline judged-query sets with guarded online outcome metrics;
- monitor latency, errors, saturation, zero-result rate, freshness lag, and result-quality slices;
- verify privacy deletion through source, event stream, index, cache, and backups under policy;
- make shard/replica and refresh-frequency costs explicit;
- retain a versioned old index until comparison, canary, rollback, and backfill reconciliation pass.

### 7.7 Shared authoring requirements for every new path

The prompt briefs above are not publishable reviewed content by themselves. Each path must be
expanded through the existing reviewed-content pipeline into a complete immutable artifact with:

- one premise, candidate role, functional requirements, non-goals, constraints, scale profile,
  realism anchors, role/seniority/difficulty compatibility, and stable topic keys;
- exactly four ordered connected questions using the canonical stage keys and dimension mappings;
- a distinct safe visible artifact for each question using only `scenario`, `metrics`, `config`,
  `trace`, or `logs` in version one;
- three progressive hints per question;
- a private reference answer, common mistakes, one to four interviewer follow-ups, and a transfer
  connection per question;
- a private rubric totaling exactly 10 points per question and referencing only that stage's
  canonical dimensions;
- answer-free public snapshots and private/public leakage tests;
- deterministic schema/content fingerprints, owner approval, human-review evidence, and published
  database versions.

Question-format guidance:

- prefer `written`, `artifact-diagnosis`, and `production-decision` for compound design reasoning;
- use `mcq` only when one bounded decision is unambiguously strongest and the distractors represent
  realistic architecture mistakes;
- never use `code`, `debugging`, or `micro-implementation` formats;
- never require a particular cloud vendor unless the artifact itself defines that constraint;
- never ask disconnected trivia or allow a question to silently change the scenario's frozen scale,
  requirements, or guarantees.

### 7.8 Scenario selection and curriculum logic

Scenario selection remains server-owned. The browser may open a reviewed question row, but it must
not decide which scenario becomes current, which difficulty applies, or whether the candidate is
ready.

Use this decision order:

1. Filter to human-approved, database-published scenarios compatible with the candidate's role and
   seniority.
2. Exclude scenarios already used by an immutable assessed block unless an explicit future repeat
   policy exists.
3. Score coverage of weak and unassessed Architecture dimensions from baseline and prior reports.
4. Score target-role, resume/project, target-company, plan-topic, and domain-key relevance using
   sanitized evidence only.
5. Add novelty weight for an architecture family not yet practised. After webhook or notification,
   strongly prefer transactional, realtime, storage/CDN, or search/indexing coverage over another
   fan-out system when evidence is otherwise comparable.
6. Apply the bounded difficulty rule: junior gets `guided` or `standard`; mid gets `guided` or
   `standard`; senior may also get `stretch`. One correct onboarding answer never assigns
   `stretch`.
7. Break ties deterministically with stable catalogue order and scenario key. Persist the selection
   reasons and exact reviewed version.
8. After assessment, recommend at most one next material gap. Return `ready` when Architecture-owned
   mastery thresholds are satisfied, or `complete` when compatible reviewed material is exhausted.

An unstarted library-row click may materialize that exact reviewed scenario as a loose non-current
block. It must not replace the current scenario or transfer assessment eligibility. If ranking later
selects the same scenario, promote the loose block and preserve its drafts, hints, attempts, Learn
states, and completions.

Suggested initial catalogue-order fallback for new candidates is:

```text
multi-tenant webhook delivery
  -> marketplace checkout and inventory
  -> high-volume notifications
  -> search and autocomplete
  -> collaborative document editing
  -> global media upload and processing
```

This is only a deterministic tie-break order. Personalization may select a different first or next
scenario when its evidence-based score is higher.

### 7.9 Build the content expansion in independently reviewable parts

The parity migration in Section 16 remains the release-critical implementation sequence. Begin this
content expansion only after the shared parity contracts it depends on are stable, or develop it on
a separate change that does not mark unpublished scenarios as eligible.

#### Content Part 1 — Freeze briefs and catalogue metadata

**Status: Complete (2026-09-12).**

- approve the four proposed keys, premises, role compatibility, seniority/difficulty support, topic
  keys, constraints, and scale profiles;
- add draft/review catalogue entries without publishing them;
- add the architecture-family novelty signal without changing current two-scenario outcomes;
- test that draft/review entries never make a candidate eligible or become selectable.

Implementation notes:

- `scenario-briefs.ts` initially froze four schema-validated draft briefs with no questions or
  private evaluation material; after Part 2 it retains the three briefs that remain drafts;
- the ranking catalogue initially contained two `published` reviewed artifacts and four `draft`
  briefs; after Part 2 it contains three of each;
- every candidate declares an Architecture family, and the existing bounded novelty score prefers
  a family not represented by prior scenario keys;
- eligibility and ranking continue to filter strictly to `published`; introducing family novelty
  did not change selection while only the two original live scenarios existed;
- focused content, ranking, eligibility, preparation, assessment-flow, and continuation tests prove
  the draft publication boundary and family-novelty behavior.

#### Content Part 2 — Marketplace checkout and inventory

**Status: Complete (2026-09-12).**

- author all four questions, visible artifacts, hints, private answers, rubrics, mistakes,
  follow-ups, and transfer connections;
- run schema, dimension-coverage, coherence, fingerprint, and leakage audits;
- obtain owner/human approval and publish the exact version atomically;
- test ranking after webhook/notification and no-next behavior before and after publication.

Implementation notes:

- `MARKETPLACE_CHECKOUT_INVENTORY` is a complete four-question reviewed artifact covering checkout
  scope and capacity, durable contracts, workflow failure recovery, and production migration;
- every question has a distinct candidate-safe artifact, three progressive hints, a private
  reference answer, a 10-point canonical-dimension rubric, common mistakes, follow-ups, and a
  transfer connection;
- the content audit passes schema identity, scenario coherence, all-sixteen-dimension coverage, and
  private/public leakage checks;
- at Part 2 completion the catalogue promoted only `marketplace-checkout-inventory` from `draft` to
  `published`, while the collaboration, media, and search briefs remained non-selectable drafts;
- the Part 2 transition tests proved checkout selection after both original asynchronous-delivery
  scenarios and exhaustion when the then-current three published scenarios were used;
- the replay-safe transactional publisher persisted `marketplace-checkout-inventory@1` with content
  fingerprint `sha256:24185c986e8da4a0eb96478fc923f8fb7196b81931361e003d6f2b291a5eae74`.

#### Content Part 3 — Collaborative document editing

**Status: Complete (2026-09-12).**

- repeat the complete author-review-audit-publish cycle;
- add explicit audit cases for offline edits after permission revocation, mixed client versions,
  slow consumers, hot documents, and fenced failover;
- verify its realtime/consistency family receives novelty preference after fan-out practice.

Implementation notes:

- `COLLABORATIVE_DOCUMENT_EDITING` is a complete four-question reviewed artifact covering
  collaboration semantics and scale, versioned operation contracts, realtime failure recovery, and
  privacy-safe protocol evolution;
- its reviewed evidence explicitly covers offline edits after permission revocation, mixed client
  and protocol versions, bounded slow-consumer recovery, celebrity-hot documents, and fenced
  regional ownership;
- every question has a distinct candidate-safe artifact, three progressive hints, a private
  reference answer, a 10-point canonical-dimension rubric, common mistakes, follow-ups, and a
  transfer connection;
- the content audit passes schema identity, coherence, all-sixteen-dimension coverage, and
  private/public leakage checks;
- at Part 3 completion the catalogue promoted only `collaborative-document-editing` from `draft` to
  `published`, while media and search remained non-selectable drafts;
- adaptive ranking gives the realtime/consistency family full novelty after asynchronous-delivery
  practice and selects it when target evidence is collaboration-aligned;
- the replay-safe transactional publisher persisted `collaborative-document-editing@1` with content
  fingerprint `sha256:4a17e8911764826d18293513806734ed0be9c0b0d101d569eb30c6940648eb90`.

#### Content Part 4 — Global media upload and processing

**Status: Complete (2026-09-12).**

- repeat the complete author-review-audit-publish cycle;
- audit signed-upload authorization, object-key ownership, derivative lineage, deletion propagation,
  and duplicate processing behavior;
- verify storage/CDN evidence can influence ranking without exposing raw resume data.

Implementation notes:

- `GLOBAL_MEDIA_PROCESSING` is a complete four-question reviewed artifact covering lifecycle and
  capacity, ownership-safe upload contracts, idempotent processing and CDN delivery, and secure
  cost-aware migration;
- its reviewed evidence explicitly covers short-lived signed upload authorization, server-owned
  object keys, immutable derivative lineage, multi-target deletion propagation, and duplicate job
  delivery;
- every question has a distinct candidate-safe artifact, three progressive hints, a private
  reference answer, a 10-point canonical-dimension rubric, common mistakes, follow-ups, and a
  transfer connection;
- the content audit passes schema identity, coherence, all-sixteen-dimension coverage, and
  private/public leakage checks;
- at Part 4 completion the catalogue promoted only `global-media-processing` from `draft` to
  `published`, while search remained the sole non-selectable draft;
- sanitized object-storage, media, workflow, and CDN evidence can prioritize this family without
  exposing project keywords in the selection snapshot;
- the replay-safe transactional publisher persisted `global-media-processing@1` with content
  fingerprint `sha256:6fb70e2afc2a8f937c41e92e1b79b5ed9ad657dfa0bfb23a56b63841eef01b47`.

#### Content Part 5 — Search and autocomplete

**Status: Complete (2026-09-12).**

- repeat the complete author-review-audit-publish cycle;
- audit authorization-filter leakage, stale event rejection, pagination stability, reindex rollback,
  and privacy deletion propagation;
- verify search/indexing novelty and weakness scoring against all earlier paths.

Implementation notes:

- `SEARCH_AUTOCOMPLETE_PLATFORM` is a complete four-question reviewed artifact covering search
  requirements and capacity, safe query/index contracts, isolated ingestion and serving, and
  relevance-aware index evolution;
- its reviewed evidence explicitly covers authorization-filter leakage, stale-event rejection,
  signed cursor pagination, end-to-end privacy deletion, and reversible generation/alias rollback;
- every question has a distinct candidate-safe artifact, three progressive hints, a private
  reference answer, a 10-point canonical-dimension rubric, common mistakes, follow-ups, and a
  transfer connection;
- the content audit passes schema identity, coherence, all-sixteen-dimension coverage, and
  private/public leakage checks;
- `search-autocomplete-platform` is published and the six-path catalogue now contains no draft or
  review entries;
- the replay-safe transactional publisher persisted `search-autocomplete-platform@1` with content
  fingerprint `sha256:ae5f5397d53cf284e6f833fb53a628baf81d16c5b0c171d9f6d9f81eb40e96be`.

#### Content Part 6 — Six-path curriculum and release verification

**Status: Automated content and integration gates complete; authenticated browser verification pending.**

- test deterministic first and next selection across junior, mid, and senior backend/full-stack
  profiles;
- test weak-dimension targeting, used-scenario exclusion, loose-block promotion, readiness, and
  exhausted-catalogue completion;
- verify every path renders four questions, never exposes Run, and produces the same five-prompt
  assessment shape;
- perform authenticated desktop/mobile and keyboard checks for the expanded library;
- publish a path only when its full private/public content audit and owner review pass.

Completed automated evidence:

- all six backend/full-stack scenarios are approved, database-published, non-executable immutable
  four-question artifacts with complete sixteen-dimension coverage;
- deterministic first and next selection, used-scenario exclusion, family novelty, evidence-based
  media selection, weak-dimension emphasis, and exhausted-catalogue behavior are covered;
- ranking uses bounded scenario emphasis dimensions instead of treating each scenario's mandatory
  sixteen-dimension rubric coverage as equal relevance to every gap;
- junior and mid-level adaptive selection is now bounded to `guided` or `standard`, while only
  senior profiles may receive `stretch`;
- all six paths build answer-free public snapshots and the same frozen five-prompt assessment
  shape through the shared Architecture contracts;
- the expanded library now materializes exact reviewed loose blocks, permits progress without
  transferring assessment eligibility, and promotes the same block in place during continuation;
- the shared room now supports Architecture identity, dialogue, five-prompt planning, transcript
  finalization, interrupted-report recovery, and terminal readiness/completion;
- the cross-domain automated regression run passes 111 test files and 582 tests, and the optimized
  production build completes successfully.

Still pending before this part can be marked fully complete:

- authenticated desktop/mobile, keyboard, and screen-reader checks for the six-path library remain
  part of parity Step 8;
- authenticated microphone, typed fallback, Save & exit, resume, final-prompt completion, and
  browser-network privacy exercises remain part of parity Step 8.

Do not create all four path files first and plan to add answers, rubrics, or audits later. One path
is complete only when its whole immutable reviewed artifact is safe to publish. This keeps each part
deployable, reviewable, and reversible.

## 8. Shared first-entry and library behavior

### 8.1 Polished welcome

Use `StoryPracticeTechnologyWelcome` as a generic choice-driven welcome even though Architecture is
not choosing a programming technology. Supply an Architecture value such as `role-aligned` through
a typed wrapper:

```ts
type ArchitectureDesignPath = "role-aligned";

const experience = {
  slug: "architecture-design",
  label: "Architecture & Design",
  apiBase: "/api/practice/architecture-design",
  routeBase: "/practice/architecture-design",
  heading: "What do you want to get better at?",
  options: [
    {
      value: "role-aligned",
      label: "Role-aligned system design",
      detail: "Requirements, scale, boundaries, reliability, and trade-offs"
    }
  ],
  buildConfirmation: (path) => ({ path }),
  buildPreparation: (focusRevisionId, requestId) => ({ focusRevisionId, requestId })
};
```

The browser sends only the selected path. Role, seniority, resume evidence, baseline evidence,
target context, plan evidence, exclusions, and difficulty remain server-derived.

Keep the same session-storage request ID behavior so retrying confirmation/preparation cannot
publish another block.

### 8.2 Library parity

Architecture should match the shared question-row-only library behavior:

- current scenario first and expanded;
- all reviewed compatible scenarios in deterministic curriculum order;
- question rows are the only action;
- selecting a question in an unstarted scenario copies the exact reviewed snapshot and opens the
  selected question;
- the prepared scenario remains non-current;
- continuing later promotes the matching loose block without losing drafts, hints, attempts,
  Learn state, or completion;
- current assessment eligibility is not transferred to a loose scenario;
- selected cards use the shared restrained accent border without an Architecture-only surface.

Add an Architecture `start-path` handler only as a thin route into the same neutral row-start
interaction and Architecture repository transaction. Do not introduce live generation.

## 9. Shared live assessment room

### 9.1 Neutral durable identity

Extend the additive shared identity:

```ts
type StoryPracticeAssessmentKind = "core-technical" | "applied-engineering" | "architecture-design";
```

Architecture room identity:

```ts
{
  kind: "story-practice-assessment";
  practice: "architecture-design";
  blockId: string;
  assessmentId: string;
  snapshotVersion: number;
  evaluatorVersion: string;
}
```

This is additive. Existing Core legacy identity compatibility must remain unchanged. Existing Core
and Applied sessions must continue resolving through the same helper.

### 9.2 Architecture runtime adapter

Create a thin `ArchitectureDesignAssessmentRuntimeService` over
`StoryPracticeAssessmentRuntimeCoordinator`. It supplies:

- Architecture start-input parsing;
- the existing Architecture assessment start transaction;
- owner-scoped loading of the frozen Architecture assessment and block;
- Architecture snapshot parsing;
- existing session lookup by the reserved assessment UUID;
- neutral interview setup construction;
- exactly five planned questions;
- Architecture-specific not-found and session-conflict errors.

The durable assessment UUID remains the interview room session ID. Start/resume returns:

```ts
{
  assessment: ArchitectureDesignPublicAssessment;
  sessionId: string;
  created: boolean;
}
```

Opening or resuming a room must never regenerate questions.

### 9.3 Five-prompt mapping

Map the frozen Architecture assessment into the neutral planned-question contract:

| Architecture prompt                 | Room competency    | Evidence expected                                 |
| ----------------------------------- | ------------------ | ------------------------------------------------- |
| Requirements & scope                | Requirements       | assumptions, functional scope, constraints, SLOs  |
| APIs, data & capacity               | Data and contracts | API/event correctness, access patterns, estimates |
| Architecture & trade-offs           | Architecture       | components, flow, boundaries, alternatives        |
| Reliability, security & operability | Resilience         | failure modes, isolation, observability, security |
| Communication & evolution           | Evolution          | trade-offs, migration, rollout, future change     |

Each planned question may contain a server-only interviewer guide with the frozen expected answer
and rubric. The public interview serializer must remove that guide.

### 9.4 Dialogue configuration

Architecture uses the same conversation state machine and one-follow-up limit. Add Architecture
wording to the shared dialogue selector rather than forking it.

The teacher should:

- establish assumptions before accepting a design;
- ask for a number or explicit bound when scale is material;
- ask the candidate to trace one request, event, or data path;
- pressure-test one important failure boundary or trade-off;
- provide a concise teaching point before moving on;
- close after the fifth frozen prompt and direct the candidate to the report.

Architecture wording must not imply that executable tests or a code runner exist.

### 9.5 Voice and typed answers

Voice and typed fallback answers must create the same durable user turns with a frozen question
index. Reconnect and Save & exit preserve:

- room UUID;
- question index;
- follow-up count;
- saved turns;
- question evaluations;
- room phase.

Save & exit disconnects without submitting partial work. Completion is the only event that starts
transcript finalization.

## 10. Transcript finalization and recovery

Reuse `storyPracticeInterviewResponses()` to group durable candidate turns by frozen prompt index.
Architecture remains responsible for:

1. loading the room by assessment UUID;
2. verifying the owner;
3. requiring `practice === "architecture-design"`;
4. verifying block, assessment, snapshot, and evaluator identity;
5. requiring the room phase to be complete;
6. requiring a response for every frozen Architecture prompt;
7. mapping grouped answers to the five Architecture prompt IDs;
8. using the room UUID as the replay-safe finalization request ID;
9. calling the existing Architecture evaluator and atomic report transaction.

Add safe methods equivalent to:

```ts
finalizeInterviewOwned(ownerId, sessionId);
finalizeInterviewBySession(sessionId);
recoverCurrentInterview(ownerId);
```

Each returns `null` unless the room belongs to Architecture. Interview completion APIs may call
Core, Applied, and Architecture finalizers safely; only the matching finalizer acts.

Overview recovery should:

- finalize a completed room whose Architecture assessment is still `IN_PROGRESS`;
- replay an exact checkpointed submission in `FINALIZING`;
- preserve a retryable state when evaluation fails;
- never require the candidate to repeat the room.

## 11. Readiness and continuation

Architecture currently assumes every completed report has a `nextScenario`. That fails after the
last eligible reviewed scenario.

Adopt the shared terminal decision:

```ts
type StoryPracticeContinuationDecision<TNext> =
  | { kind: "continue"; next: TNext }
  | { kind: "ready"; masteredKeys: string[]; summary: string }
  | { kind: "complete"; summary: string };
```

Required behavior:

- the ranker exposes a nullable `findNextScenario()` while retaining a throwing adapter if older
  callers require it;
- evaluation records `continue` when a reviewed compatible scenario exists;
- evaluation records evidence-backed `ready` when the readiness thresholds are satisfied;
- otherwise evaluation records clean `complete` when all eligible material is exhausted;
- old reports containing only `nextScenario` normalize to `continue`;
- terminal reports render no phantom Continue button;
- continuation does not publish or promote a block for `ready` or `complete`;
- historical reports remain immutable and readable.

Architecture readiness thresholds remain Architecture-owned. The shared helper may combine
generic score/evidence inputs, but it must not invent which of the sixteen dimensions constitute
Architecture mastery.

## 12. Legacy inline-assessment compatibility

The cutover must not strand a candidate who already started the form-oriented Architecture
assessment.

Use this compatibility policy:

| Existing assessment at deployment                            | Required behavior                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `LOCKED` or `READY`                                          | Start the new shared voice room                                         |
| `IN_PROGRESS` with an existing Architecture room             | Resume that room                                                        |
| `IN_PROGRESS` without a room and identified as legacy inline | Keep the legacy inline form until completion or explicit restart policy |
| `FINALIZING`                                                 | Replay the checkpointed existing submission                             |
| `COMPLETED`                                                  | Render the saved report unchanged                                       |

The safest implementation is an additive delivery marker on new starts or a server-derived
compatibility projection. Do not rewrite old assessment snapshots.

Browser-only inline drafts cannot be reconstructed by the server. Therefore do not silently open
a blank voice room for a grandfathered in-progress inline assessment. Retain the inline UI only
for that bounded compatibility case. New assessments must never start inline after the cutover.

Document a retention/removal condition before deleting the compatibility path.

## 13. API and application changes

### 13.1 Architecture assessment start

Update:

```text
src/app/api/practice/architecture-design/assessment/start/handler.ts
```

It should call the Architecture runtime adapter and return `{ assessment, sessionId, created }`.
Keep the current owner guard, strict schema, rate-limit policy, distributed lease, development-only
early-start behavior, and Architecture error envelope.

### 13.2 Interview completion hooks

Update both completion paths:

```text
src/app/api/interview/decide/route.ts
src/app/api/interview/[sessionId]/route.ts
```

Schedule the Architecture finalizer beside Core and Applied. A mismatched identity is a safe no-op.
Do not make room completion wait synchronously for semantic report generation.

### 13.3 Application container

Register the Architecture runtime with the existing `InterviewService`. Prefer keeping it inside
the grouped `architectureDesign` container capability:

```ts
architectureDesign: {
  // existing services
  runtime: ArchitectureDesignAssessmentRuntimeService;
}
```

Do not add another interview state machine or LiveKit client.

### 13.4 Overview recovery

Start Architecture recovery before other independent overview reads, then await it before reading
the final current assessment projection. Avoid a serial page-load waterfall.

## 14. Privacy and security boundaries

The following must never enter a public response before authorization:

- expected answers;
- private rubrics;
- hidden evaluation instructions;
- reference answers or repair material;
- baseline answer keys or frozen private onboarding questions;
- model-only context;
- another owner's assessment, room, block, or transcript.

Required checks:

- the room plan stores private guides only in server persistence;
- `GET /api/interview/[sessionId]` omits the guide;
- public Architecture assessment snapshots remain answer-free;
- owner/session/block/assessment identity is checked before finalization;
- foreign IDs use the same bounded not-found/conflict behavior as existing Architecture reads;
- transcript and report snapshots contain only candidate-safe content;
- logs contain IDs and bounded diagnostics, not private guides or candidate answers.

## 15. File-level implementation map

Shared contracts and orchestration to extend:

```text
src/features/practice/shared/server/contracts.ts
src/features/practice/shared/server/assessment-runtime.ts
src/features/practice/shared/server/assessment-transcript.ts
src/features/practice/shared/server/continuation-orchestrator.ts
src/features/practice/shared/ui/contracts.ts
src/features/practice/shared/ui/view-contracts.ts
src/features/practice/shared/ui/story-practice-technology-welcome.tsx
src/features/practice/shared/ui/story-practice-assessment.tsx
```

Shared interview integration:

```text
src/features/interviews/server/types.ts
src/features/interviews/server/story-practice-assessment-dialogue.ts
src/features/interviews/server/interview.service.ts
src/features/interviews/server/decider.ts
src/features/interviews/server/technical-answer-evaluator.ts
src/features/interviews/ui/voice/voice-interview-client.tsx
src/features/interviews/ui/voice/components/session-state.tsx
src/app/api/interview/[sessionId]/route.ts
src/app/api/interview/decide/route.ts
```

Architecture integration points:

```text
src/app/practice/architecture-design/page.tsx
src/app/api/practice/architecture-design/assessment/start/handler.ts
src/app/api/practice/architecture-design/start-path/handler.ts
src/features/practice/architecture-design/domain/assessment-contracts.ts
src/features/practice/architecture-design/server/assessment-runtime.service.ts
src/features/practice/architecture-design/server/assessment.service.ts
src/features/practice/architecture-design/server/assessment-evaluator.ts
src/features/practice/architecture-design/server/scenario-ranking.service.ts
src/features/practice/architecture-design/server/continuation.service.ts
src/features/practice/architecture-design/server/preparation.service.ts
src/features/practice/architecture-design/ui/architecture-design-experience.ts
src/features/practice/architecture-design/ui/architecture-design-technology-welcome.tsx
src/features/practice/architecture-design/ui/architecture-design-adapter.ts
src/server/app-container.ts
```

Create a listed file only when the corresponding step needs it. Keep wrappers small.

## 16. Implementation sequence

Implement one numbered step at a time and keep each step independently testable.

### Step 1 — Freeze Architecture parity contracts

**Status: Complete (2026-09-12).**

- Add `architecture-design` to the neutral assessment identity.
- Change the Architecture experience contract to declare the shared room target.
- Add the continuation union additively while accepting old `nextScenario` reports.
- Define the legacy inline-assessment compatibility rule.
- Do not change rendered behavior yet.

### Step 2 — Match first entry and library behavior

**Status: Complete (2026-09-12).**

- Add the thin Architecture wrapper for the polished shared welcome.
- Send only `{ path: "role-aligned" }` from the browser.
- Preserve replay-safe confirmation and preparation IDs.
- Add exact reviewed scenario row materialization.
- Preserve loose-scenario progress for later promotion.

Verification note: every eligible catalogue entry now derives its four candidate-safe row
descriptors and expected duration from the matching reviewed scenario. Unstarted cards therefore
render the real four stages instead of the shared empty-entry fallback.

### Step 3 — Add Architecture room dialogue and identity support

**Status: Complete (2026-09-12).**

- Configure Architecture opening, transition, teaching, and closing wording.
- Generalize identity checks and resumable-room helpers to the third practice kind.
- Preserve Core legacy identity and existing Core/Applied sessions.
- Prove one grounded follow-up maximum remains shared.

### Step 4 — Add the Architecture assessment runtime

**Status: Complete (2026-09-12).**

- Build five planned questions from the frozen Architecture snapshot.
- Attach private guides only to the server plan.
- Register `ArchitectureDesignAssessmentRuntimeService`.
- Make Architecture assessment start return the durable room session.
- Open the shared room without a second setup form.

### Step 5 — Add transcript finalization and recovery

**Status: Complete (2026-09-12).**

- Map room turns to the five Architecture prompt IDs.
- Trigger deferred Architecture finalization after room completion.
- Recover completed rooms and checkpointed `FINALIZING` submissions on overview load.
- Preserve legacy inline finalization and reports.

### Step 6 — Add terminal readiness and continuation

**Status: Complete (2026-09-12).**

- Return a next scenario or terminal readiness/completion.
- Prevent the final catalogue item from remaining `FINALIZING`.
- Promote a prepared loose scenario without losing progress.
- Keep old reports and historical blocks readable.

### Step 7 — Prove UI, privacy, and lifecycle parity

**Status: Complete by automated gates (2026-09-12).**

- Add Core/Applied/Architecture render-parity tests for equivalent states.
- Test mobile teacher visibility and non-executable workspace behavior.
- Test every assessment state and legacy inline compatibility.
- Test public interview serialization with an Architecture private guide.
- Run shared, Core, Applied, Architecture, interview, and Practice regressions.

### Step 8 — Authenticated release verification

**Status: Pending authenticated manual verification.**

- Compare desktop and mobile screenshots for equivalent Core, Applied, and Architecture states.
- Run keyboard and screen-reader checks.
- Exercise microphone and typed fallback.
- Exercise Save & exit, resume, fifth-prompt completion, report recovery, and continuation.
- Confirm no private material appears in browser network responses.

## 17. Required tests

At minimum, add or update coverage for:

- Architecture inclusion in neutral assessment identity validation;
- Core legacy identity compatibility after adding Architecture;
- Architecture welcome payload and preparation request replay;
- unstarted scenario row materialization and loose progress preservation;
- Architecture five-prompt plan mapping;
- server-only guide omission from interview responses;
- Architecture opening, one follow-up, teaching transition, and closing dialogue;
- voice and typed answers in one durable transcript;
- Save & exit and exact room resume;
- foreign owner/session/block rejection;
- transcript grouping and bounded response mapping;
- finalization request replay;
- completed-room and `FINALIZING` overview recovery;
- legacy inline `IN_PROGRESS`, `FINALIZING`, and completed compatibility;
- no-next-scenario readiness/completion;
- terminal report without a Continue button;
- four-question count-aware UI;
- no Architecture runner button, call, service, or route;
- Core, Applied, DSA, shared UI, shared server, interview, Practice, and saved-session regressions.

Recommended focused commands:

```bash
pnpm exec vitest run src/features/practice/shared
pnpm exec vitest run src/features/practice/core-technical
pnpm exec vitest run src/features/practice/applied-engineering
pnpm exec vitest run src/features/practice/architecture-design
pnpm exec vitest run src/features/interviews/server src/features/interviews/ui/voice
pnpm exec vitest run src/app/practice src/app/api/practice src/app/api/interview
pnpm exec eslint src/features/practice/shared src/features/practice/core-technical \
  src/features/practice/applied-engineering src/features/practice/architecture-design \
  src/features/interviews
pnpm exec tsc --noEmit
pnpm build
```

If repository-wide TypeScript fails in an unrelated existing file, record the exact error and still
run focused type-aware tests, lint, build, and regressions for every changed surface.

## 18. Acceptance criteria

1. Core, Applied, and Architecture render the same shared component implementation for equivalent
   states.
2. Architecture retains its four-question, sixteen-dimension, non-executable domain contract.
3. First entry uses the same polished teacher welcome and sends only the explicit role-aligned path.
4. Library cards and question rows match Core/Applied, including loose-scenario progress.
5. Only the current Architecture scenario unlocks and runs its assessment.
6. Starting or resuming opens the shared DSA/Core/Applied voice room with no second setup form.
7. The teacher speaks five frozen Architecture prompts and asks at most one grounded follow-up.
8. Voice and typed responses persist in one durable transcript.
9. Save & exit resumes the exact room without submitting partial work.
10. Completion produces the Architecture five-score report and returns to the scenario.
11. Interrupted finalization is recoverable without repeating the assessment.
12. A report recommends a next scenario, records readiness, or ends preparation cleanly.
13. Existing inline Architecture assessments and completed reports remain usable through the
    documented compatibility window.
14. No private answer, rubric, reference material, baseline answer key, or model-only context enters
    a public response.
15. Architecture never exposes an executable runner capability.
16. Core, Applied, DSA, and saved interview sessions remain compatible.
17. Authenticated desktop/mobile, keyboard, screen-reader, microphone, typed fallback, save/resume,
    completion, and network privacy verification pass.

## 19. LOC and duplication guardrails

The domain is already implemented. The parity migration should not add another large feature tree.
A reasonable incremental budget is:

| Area                                    | Expected new production LOC |
| --------------------------------------- | --------------------------: |
| Welcome and library adapters            |                     100–180 |
| Runtime and plan adapter                |                     180–280 |
| Finalization/recovery adapter           |                     120–220 |
| Dialogue and continuation configuration |                      80–160 |
| Route/container integration             |                      60–120 |
| Legacy compatibility                    |                      80–180 |
| **Expected production addition**        |               **620–1,140** |

Tests may reasonably add 700–1,300 lines because lifecycle, privacy, compatibility, and browser
boundaries need explicit evidence.

Stop and reassess if the migration introduces:

- an Architecture-specific live-room client;
- copied assessment/report JSX;
- a copied interview state machine;
- copied transcript grouping;
- a second media-permission flow;
- duplicated generic start/resume/finalization orchestration;
- Core/Applied private-domain casts;
- a broad persistence migration.

## 20. Non-goals

- No redesign of Practice, DSA, Core Technical, or Applied Engineering.
- No rename of the persisted `architecture-system-design` interview-session kind.
- No code runner, sandbox, cloud account, live database, queue, or cache simulator.
- No diagram canvas or image-based diagram grading in this migration.
- No live generation of unreviewed Architecture scenarios during candidate start.
- No combined Core/Applied/Architecture persistence tables.
- No frontend-owned focus, ranking, difficulty, grading, readiness, or continuation.
- No removal of legacy inline compatibility until its retention condition is satisfied.

## 21. Implementation handoff checklist

Before editing:

1. Read this document completely.
2. Read `docs/STORY_DRIVEN_ARCHITECTURE_DESIGN.md` completely.
3. Read `docs/APPLIED_ENGINEERING_CORE_PARITY_REUSE_PLAN.md` and the Core UI baseline.
4. Inspect `git status` and preserve all existing user and Applied-parity changes.
5. Identify the one numbered step being implemented.
6. Trace the matching Core/Applied shared behavior and Architecture service/tests.
7. State the narrow tests that prove the step.

While editing:

- implement one numbered step at a time;
- prefer configuration and typed ports over slug conditionals;
- keep Architecture private data behind its own service and serializer;
- make schemas additive and saved data backward compatible;
- keep all server-owned decisions on the server;
- do not mark parity complete based only on unit tests.

When handing off:

- include current `git status`;
- list the files changed for the step;
- list commands and exact test results;
- name the next unfinished numbered step;
- record known failures and whether they predate the work;
- state whether authenticated screenshots and manual voice-room verification were completed.

## 22. Ready-to-use implementation prompt

```text
Implement the next unfinished step from
docs/ARCHITECTURE_DESIGN_CORE_PARITY_REUSE_PLAN.md.

Read that document completely, then read
docs/STORY_DRIVEN_ARCHITECTURE_DESIGN.md,
docs/APPLIED_ENGINEERING_CORE_PARITY_REUSE_PLAN.md, and
docs/CORE_TECHNICAL_UI_BASELINE.md.

Architecture & Design must use the exact shared Story Practice UI and live assessment room used by
Core Technical and Applied Engineering. Differences belong in typed Architecture configuration,
domain adapters, reviewed scenarios, four-question contracts, sixteen-dimension scoring, ranking,
and separate persistence—not in duplicated UI or conversation state machines.

Preserve Architecture's non-executable contract and existing inline-assessment compatibility.
Preserve all existing Core, Applied, DSA, and saved-session behavior. Inspect git status before
editing, implement only the next numbered step, run its focused tests plus affected regressions,
and update the plan only when the step is genuinely complete.
```
