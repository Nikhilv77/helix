# AI/ML Architecture scenario review packet

These are **drafts**, not live questions. The full prompts, evidence, hints, private answers,
and rubrics are in [`ai-ml-scenario-candidates.ts`](../src/features/practice/architecture-design/domain/ai-ml-scenario-candidates.ts).
Both cases have `reviewStatus: "candidate"`; neither is in the approved catalogue or the
database publication payload. Review can happen without changing a candidate session.
If approved, their questions use the existing Architecture & Design Practice and System
Design interview screens. No new question UI is needed.

## Personalized feed ranking platform

Candidate task: design a feed for 30 million active users and 20 million eligible items at a
12,000 requests/s peak. It must preserve eligibility, handle cold starts, make new items
available within ten minutes, and keep p95 latency below 180 ms. The rate is 720,000
requests/minute.

| Stage                    | Evidence shown to candidate                                                                                                            | What a strong answer must cover                                                                                                                                                      |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scale   | A product request to maximize clicks without safety or long-term value targets                                                         | User outcomes, mandatory eligibility, cold-start fallback, 720,000 requests/minute, latency and freshness budgets.                                                                   |
| Events and data          | Click-only logs, latest-value offline joins, duplicate retries, stale deleted items                                                    | Impression and outcome identities, experiment assignment, point-in-time features, consent, idempotency, deletion. Exposure logging alone does not remove position or selection bias. |
| Architecture and failure | A creator uploads 500,000 items; indexing lags 18 minutes; one feature shard reaches 220 ms                                            | Separate ingestion from serving, bound fan-out and hot creators, invalidate policy-sensitive caches, serve an eligible fallback.                                                     |
| Rollout                  | Clicks rise 4%, but satisfied sessions fall 2%, cold-start retention falls 5%, new-creator exposure falls 18%, and p95 rises to 205 ms | Stop expansion, inspect user and creator slices, control data and feature costs, keep compatible model and feature rollback.                                                         |

Review decision: confirm the feed outcome and safety rules, the treatment of exposure bias,
and whether the supplied regression should clearly stop the canary.

## Document vision intake platform

Candidate task: design tenant-isolated form extraction with field evidence, calibrated
uncertainty, human review, corrections, and deletion. Four million pages/day average about
46 pages/s; a stated 20-fold burst is about 926 pages/s. Standard pages target p95 extraction
within two minutes.

| Stage                    | Evidence shown to candidate                                                                                   | What a strong answer must cover                                                                                                                    |
| :----------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scale   | A proposed raw confidence threshold of 0.8 for automatic acceptance                                           | Capacity, calibrated field quality by risk and layout, review limits, unreadable-field handling, privacy.                                          |
| Events and data          | Filename-keyed mutable output; retries overwrite reviewer changes; images retained forever                    | Tenant-scoped IDs, immutable model output, versioned reviewer corrections, idempotent retries, deletion through derived data.                      |
| Architecture and failure | A 300,000-page customer burst, 25% GPU errors, seven-minute extraction queue age, three-hour review queue age | Tenant isolation, bounded retries and review work, durable jobs, truthful pending and review states.                                               |
| Rollout                  | Character accuracy rises 3%, but high-risk false accepts rise from 0.2% to 0.8%; unseen-layout errors double  | Stop expansion, compare risk slices on labeled/shadow data, account for delayed corrections, protect private data, roll back the processing route. |

Review decision: confirm that high-risk false accepts are a hard gate, that reviewer
corrections cannot be overwritten, and that the deletion and retention rules are realistic.

## Approval boundary

Each case has four linked stages and private scoring criteria across the 16 Architecture
dimensions. The project owner should inspect the source artifact's complete `prompt`,
`artifact`, `hints`, `referenceAnswer`, and `rubric` fields before approving either case.
Approval requires an explicit reviewer and review date in the approved source catalogue,
followed by publication to the intended database. A draft will not appear in practice or
interviews until those steps are complete.
