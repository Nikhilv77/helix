import type {
  AiMlStoryPath,
  AiMlStoryQuestion
} from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import type { InteractionCriterion } from "@/features/practice/shared/domain/interactive-response";

const text = (
  value: Omit<AiMlStoryQuestion, "rubric"> & { rubric: [string, string, string] }
): AiMlStoryQuestion => ({
  ...value,
  rubric: [
    { criterion: value.rubric[0], points: 4 },
    { criterion: value.rubric[1], points: 3 },
    { criterion: value.rubric[2], points: 3 }
  ]
});

const choice = (value: Omit<AiMlStoryQuestion, "rubric">): AiMlStoryQuestion => ({
  ...value,
  rubric: [{ criterion: "Select the best answer for the evidence shown.", points: 10 }]
});

/** An interactive ordering question; the rubric comes from its ordering rules. */
const ordering = (
  value: Omit<AiMlStoryQuestion, "rubric"> & {
    interaction: NonNullable<AiMlStoryQuestion["interaction"]>;
    interactionRubric: InteractionCriterion[];
  }
): AiMlStoryQuestion => ({
  ...value,
  rubric: value.interactionRubric.map(({ label, points }) => ({ criterion: label, points }))
});

const core: AiMlStoryPath[] = [
  {
    key: "trustworthy-models",
    title: "Model data you can trust",
    description: "Define grain, joins, and history so numbers stay correct.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "data-core-1",
        pathKey: "trustworthy-models",
        title: "Find why revenue doubled",
        format: "artifact-diagnosis",
        prompt:
          "Revenue in this query is higher than finance reports. Explain the cause and write the corrected approach.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "revenue_by_day.sql",
          content:
            "SELECT o.order_date, SUM(o.order_total) AS revenue\nFROM orders o\nJOIN order_items i ON i.order_id = o.id\nGROUP BY o.order_date;\n\n-- orders: one row per order\n-- order_items: many rows per order"
        },
        topicKeys: ["joins", "grain"],
        hints: [
          "Compare the grain of the two tables.",
          "Each order row repeats once per item after the join.",
          "Aggregate at the right grain before joining, or avoid the join."
        ],
        answer: {
          concise:
            "Joining orders to items fans out each order, so order_total is summed once per item.",
          explanation:
            "Sum order_total from orders alone, or aggregate items to the order grain first. Add a test that revenue equals the sum over distinct orders."
        },
        rubric: [
          "Identify the one-to-many fan-out.",
          "Aggregate at the correct grain before or without the join.",
          "Propose a reconciliation test."
        ],
        commonMistakes: ["Using SUM(DISTINCT order_total), which drops orders with equal totals."],
        interviewerFollowUps: ["How would you detect fan-out automatically in a model?"],
        interviewConnection: "Fan-out joins are the most common source of inflated metrics."
      }),
      choice({
        id: "data-core-2",
        pathKey: "trustworthy-models",
        title: "Keep history when a customer moves",
        format: "mcq",
        prompt:
          "Sales must be reported by the customer's region at the time of each sale, even after customers move. Which dimension design fits?",
        artifact: {
          kind: "scenario",
          title: "Requirement",
          content:
            "Customers change region a few times per year\nReports: revenue by region at time of sale\nAlso needed: current region for marketing lists"
        },
        topicKeys: ["dimensional-modeling", "scd"],
        choices: [
          "A type 2 slowly changing dimension with validity ranges and a current-row flag.",
          "Overwrite the region in place (type 1).",
          "Store only the latest region in the fact table.",
          "Rebuild the dimension from scratch every night."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Overwriting loses the historical value.",
          "Each change needs its own row with a time range.",
          "A current flag still supports 'latest' queries."
        ],
        answer: {
          concise:
            "Use type 2: a new dimension row per change with valid_from/valid_to, joined to facts by the surrogate key at sale time.",
          explanation:
            "Type 2 preserves history for point-in-time reporting while an is_current flag serves current-state queries. Facts reference the surrogate key valid when the sale happened."
        },
        commonMistakes: ["Joining facts to the current region, which rewrites history."],
        interviewerFollowUps: ["How do you handle a late correction to a past region?"],
        interviewConnection: "SCD questions check whether you design for how the data will be read."
      }),
      text({
        id: "data-core-3",
        pathKey: "trustworthy-models",
        title: "Explain the empty result",
        format: "predict-explain",
        prompt:
          "This query should list customers without orders, but it returns zero rows. Explain why and fix it.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "customers_without_orders.sql",
          content:
            "SELECT c.id\nFROM customers c\nWHERE c.id NOT IN (SELECT o.customer_id FROM orders o);\n\n-- orders.customer_id contains some NULL values (guest checkouts)"
        },
        topicKeys: ["sql-semantics", "null"],
        hints: [
          "NOT IN compares against every value in the list.",
          "Any comparison with NULL is unknown, not false.",
          "NOT EXISTS behaves differently with NULLs."
        ],
        answer: {
          concise:
            "One NULL in the subquery makes every NOT IN comparison unknown, so no row qualifies.",
          explanation:
            "Use NOT EXISTS with a correlated subquery, or filter NULLs out of the subquery. NOT EXISTS is the safer default for anti-joins."
        },
        rubric: [
          "Explain three-valued logic with NULL in NOT IN.",
          "Rewrite with NOT EXISTS or a LEFT JOIN anti-join.",
          "Mention filtering NULLs as an alternative."
        ],
        commonMistakes: ["Assuming NULLs are simply ignored."],
        interviewerFollowUps: ["Would a LEFT JOIN ... WHERE o.id IS NULL behave the same?"],
        interviewConnection: "NULL semantics questions separate careful SQL writers from guessers."
      }),
      text({
        id: "data-core-4",
        pathKey: "trustworthy-models",
        title: "Declare the grain of a fact table",
        format: "written",
        prompt:
          "Design the fact table for this requirement. State its grain, the keys, and which measures belong there.",
        artifact: {
          kind: "scenario",
          title: "Requirement",
          content:
            "Analysts need: units and revenue by product, day, and store\nAlso: discount amount and number of orders\nSource: orders with multiple line items; returns arrive later as separate events"
        },
        topicKeys: ["dimensional-modeling", "grain"],
        hints: [
          "Start by naming one row of the table in plain words.",
          "Line items carry product-level units and revenue.",
          "Order counts need care at a line-item grain."
        ],
        answer: {
          concise:
            "One row per order line item, keyed by order, product, store, and date, with units, revenue, and discount as additive measures.",
          explanation:
            "Line-item grain supports product analysis. Count orders with COUNT(DISTINCT order_id) or a separate order-grain fact, and model returns as their own fact or signed rows."
        },
        rubric: [
          "State an explicit line-item grain.",
          "Identify dimension keys and additive measures.",
          "Handle order counts and returns without double counting."
        ],
        commonMistakes: ["Mixing order-level and item-level measures in one table."],
        interviewerFollowUps: ["When would you add an order-grain fact as well?"],
        interviewConnection: "Declaring the grain first is the core habit interviewers look for."
      }),
      text({
        id: "data-core-5",
        pathKey: "trustworthy-models",
        title: "Partition late-arriving events",
        format: "production-decision",
        prompt:
          "Mobile events can arrive up to three days late. Should the table be partitioned by event time or ingestion time, and how do daily reports stay correct?",
        artifact: {
          kind: "metrics",
          title: "Arrival delay distribution",
          content:
            "Arrive within 1 hour: 91%\nArrive within 1 day: 97%\nArrive within 3 days: 99.8%\nReports: daily active users by event date"
        },
        topicKeys: ["partitioning", "late-data"],
        hints: [
          "Reports are defined by event date.",
          "Late rows land in partitions that were already processed.",
          "Reprocess a trailing window."
        ],
        answer: {
          concise:
            "Partition by event date and reprocess a trailing three-day window each run so late events are included.",
          explanation:
            "Event-date partitions match how reports are queried. An incremental job that rebuilds the last three days (idempotently) captures late arrivals; mark recent days as provisional in dashboards."
        },
        rubric: [
          "Choose event-time partitioning aligned with reporting.",
          "Reprocess a trailing lookback window idempotently.",
          "Communicate freshness or provisional recent data."
        ],
        commonMistakes: ["Only processing today's partition and silently losing late events."],
        interviewerFollowUps: ["What changes if events can arrive a month late?"],
        interviewConnection:
          "Late data is a standard design question for streaming and batch pipelines."
      })
    ]
  },
  {
    key: "query-reasoning",
    title: "Reason about SQL at scale",
    description: "Write queries that stay correct and fast as data grows.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "data-core-6",
        pathKey: "query-reasoning",
        title: "Keep only the latest record",
        format: "predict-explain",
        prompt:
          "The users table receives an updated row on every profile change. Write a query that returns the latest row per user and explain how ties are handled.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "user_updates.sql",
          content:
            "-- user_updates(user_id, email, plan, updated_at, ingested_at)\n-- several rows per user_id\n-- two rows can share the same updated_at"
        },
        topicKeys: ["window-functions", "deduplication"],
        hints: [
          "Number the rows within each user.",
          "Order by recency.",
          "Add a tie-breaker so the result is deterministic."
        ],
        answer: {
          concise:
            "Use ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, ingested_at DESC) and keep row 1.",
          explanation:
            "Partition by the entity, order by recency, and include a deterministic tie-breaker so reruns return the same row. Filter to rn = 1 in an outer query or with QUALIFY."
        },
        rubric: [
          "Use a window function partitioned by user_id.",
          "Order by recency and keep the first row.",
          "Add a deterministic tie-breaker."
        ],
        commonMistakes: ["Using MAX(updated_at) and joining back, which duplicates ties."],
        interviewerFollowUps: ["Why is RANK() riskier than ROW_NUMBER() here?"],
        interviewConnection: "Deduplication with window functions appears in most data interviews."
      }),
      text({
        id: "data-core-7",
        pathKey: "query-reasoning",
        title: "Explain the full scan",
        format: "artifact-diagnosis",
        prompt:
          "This query scans the entire table even though it is partitioned by event_date. Explain why and fix it.",
        artifact: {
          kind: "query-plan",
          title: "Query and plan",
          content:
            "SELECT COUNT(*) FROM events\nWHERE DATE(CONVERT_TZ(event_ts, 'UTC', 'Asia/Kolkata')) = '2026-09-25';\n\nPlan: Full scan events (2,190 partitions), rows read 8.4B\nPartition column: event_date (UTC)"
        },
        topicKeys: ["partition-pruning", "query-performance"],
        hints: [
          "The filter is on a transformed timestamp, not the partition column.",
          "The engine cannot map that expression to partitions.",
          "Add a filter on the partition column itself."
        ],
        answer: {
          concise:
            "Filtering on a function of event_ts prevents partition pruning; add a range filter on event_date covering the local day.",
          explanation:
            "Keep the timezone logic but add event_date BETWEEN '2026-09-24' AND '2026-09-25' (the UTC dates that overlap the local day) so only two partitions are read."
        },
        rubric: [
          "Explain that functions on columns block pruning.",
          "Add a direct predicate on the partition column.",
          "Handle the timezone boundary correctly."
        ],
        commonMistakes: [
          "Filtering only event_date = '2026-09-25' and losing part of the local day."
        ],
        interviewerFollowUps: ["How would you store data to make local-day queries cheap?"],
        interviewConnection: "Reading a plan and fixing pruning is a practical cost question."
      }),
      choice({
        id: "data-core-8",
        pathKey: "query-reasoning",
        title: "Rescue the skewed join",
        format: "mcq",
        prompt:
          "A Spark join runs for hours because one task processes most of the data. What is the best first mitigation?",
        artifact: {
          kind: "metrics",
          title: "Stage metrics",
          content:
            "Join key: country_code\nTask p50 input: 40 MB · max input: 38 GB\n62% of rows have country_code = 'US'\nOther side: countries dimension, 250 rows"
        },
        topicKeys: ["spark", "data-skew"],
        choices: [
          "Broadcast the small countries table so the large side is not shuffled by key.",
          "Increase the number of shuffle partitions only.",
          "Sort the large table by country_code first.",
          "Add more executor memory to the slow task."
        ],
        correctChoiceIndex: 0,
        hints: [
          "One side of the join is tiny.",
          "Shuffling by a skewed key sends most rows to one task.",
          "Avoid the shuffle entirely if possible."
        ],
        answer: {
          concise:
            "Broadcast the 250-row dimension so each executor joins locally without shuffling the skewed key.",
          explanation:
            "A broadcast join removes the shuffle, so skew on country_code no longer concentrates work. Salting is the fallback when both sides are large."
        },
        commonMistakes: ["Adding partitions, which cannot split a single hot key."],
        interviewerFollowUps: ["How would you handle skew when both sides are large?"],
        interviewConnection:
          "Skew questions test whether you understand how the shuffle distributes work."
      }),
      text({
        id: "data-core-9",
        pathKey: "query-reasoning",
        title: "Count unique users affordably",
        format: "written",
        prompt:
          "A dashboard computes COUNT(DISTINCT user_id) across a year of events and costs too much. What are your options and trade-offs?",
        artifact: {
          kind: "metrics",
          title: "Dashboard query",
          content:
            "Events per day: 1.2B\nQuery: yearly unique users by country\nRuntime: 11 min · cost per run: $38\nDashboard refreshed hourly"
        },
        topicKeys: ["approximation", "cost"],
        hints: [
          "Exact distinct counts need all IDs in memory.",
          "Sketches trade a small error for large savings.",
          "Precomputed aggregates can be combined."
        ],
        answer: {
          concise:
            "Use HyperLogLog-style approximate counts or precomputed daily sketches that merge into yearly totals, and reduce refresh frequency.",
          explanation:
            "Store daily HLL sketches per country and merge them for any range with about 1–2% error. Keep exact counts only where required, such as billing, and refresh the dashboard less often."
        },
        rubric: [
          "Explain why exact distinct is expensive at scale.",
          "Propose sketches or mergeable pre-aggregation.",
          "State the accuracy trade-off and where exactness matters."
        ],
        commonMistakes: ["Summing daily distinct counts, which double-counts returning users."],
        interviewerFollowUps: ["Why can't you add daily distinct counts together?"],
        interviewConnection: "Cost-aware analytics design is expected in senior data roles."
      }),
      text({
        id: "data-core-10",
        pathKey: "query-reasoning",
        title: "Make the incremental load safe to rerun",
        format: "production-decision",
        prompt:
          "An incremental job appends new orders each hour. After a retry, some orders appear twice. How would you make the load idempotent?",
        artifact: {
          kind: "code",
          language: "sql",
          title: "load_orders.sql",
          content:
            "INSERT INTO warehouse.orders\nSELECT * FROM staging.orders\nWHERE updated_at > (SELECT MAX(updated_at) FROM warehouse.orders);\n\n-- source updates existing orders when status changes"
        },
        topicKeys: ["idempotency", "incremental-models"],
        hints: [
          "Appending cannot handle a retry or an updated row.",
          "The table needs a unique business key.",
          "Merge on that key instead of inserting."
        ],
        answer: {
          concise:
            "MERGE on order_id with a small lookback window instead of appending, so retries and updates overwrite rather than duplicate.",
          explanation:
            "Upsert by the business key, reprocess a lookback window to catch late updates, and add a uniqueness test on order_id so duplicates fail the run."
        },
        rubric: [
          "Explain why append plus MAX watermark duplicates on retry.",
          "Use MERGE/upsert on a unique key with a lookback.",
          "Add a uniqueness test to catch regressions."
        ],
        commonMistakes: ["Deduplicating in every downstream query instead of at load."],
        interviewerFollowUps: ["How would you handle deletes in the source?"],
        interviewConnection: "Idempotent loads are the foundation of reliable pipelines."
      })
    ]
  }
];

const applied: AiMlStoryPath[] = [
  {
    key: "pipeline-reliability",
    title: "Keep a pipeline correct under failure",
    description: "Diagnose reruns, schema changes, and backfills without corrupting data.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "data-applied-1",
        pathKey: "pipeline-reliability",
        title: "Explain the doubled daily totals",
        format: "artifact-diagnosis",
        prompt:
          "Yesterday's totals doubled after an on-call engineer reran a failed job. Explain the cause and how to repair and prevent it.",
        artifact: {
          kind: "logs",
          title: "Orchestrator log",
          content:
            "02:00 daily_sales started (partition 2026-09-25)\n02:14 task write_sales: inserted 1,204,332 rows\n02:15 task publish failed: timeout\n03:02 manual rerun of daily_sales\n03:16 task write_sales: inserted 1,204,332 rows\n03:17 publish succeeded"
        },
        topicKeys: ["idempotency", "reruns"],
        hints: [
          "The write succeeded before the failure.",
          "The rerun appended the same rows again.",
          "Writes should replace a partition, not append to it."
        ],
        answer: {
          concise:
            "The rerun appended the partition a second time because the write step is not idempotent.",
          explanation:
            "Repair by overwriting the 2026-09-25 partition from source. Prevent it by making writes replace the partition (or MERGE on a key) and by adding a row-count or uniqueness check before publish."
        },
        rubric: [
          "Identify the non-idempotent append on rerun.",
          "Repair by rebuilding the affected partition.",
          "Prevent with partition overwrite or merge plus checks."
        ],
        commonMistakes: ["Deleting duplicates by hand without fixing the write mode."],
        interviewerFollowUps: ["How would you design every task so reruns are always safe?"],
        interviewConnection: "Rerun safety is the first reliability property interviewers probe."
      }),
      text({
        id: "data-applied-2",
        pathKey: "pipeline-reliability",
        title: "Find why a column went empty",
        format: "artifact-diagnosis",
        prompt:
          "The marketing_channel column became NULL for all new rows, but no job failed. Explain what happened and how you would catch it next time.",
        artifact: {
          kind: "metrics",
          title: "Column health",
          content:
            "marketing_channel NULL rate: 0.4% → 100% since 2026-09-23 06:00\nUpstream API release on 2026-09-23: field renamed to acquisition_channel\nIngestion uses schema-on-read with missing fields defaulting to NULL"
        },
        topicKeys: ["schema-evolution", "data-quality"],
        hints: [
          "The source renamed a field.",
          "The loader treats missing fields as NULL instead of failing.",
          "Monitor contracts and distributions, not only job status."
        ],
        answer: {
          concise:
            "An upstream rename made the old field missing, and the loader silently wrote NULLs.",
          explanation:
            "Map the new field and backfill affected days. Add a data contract or schema check with the producer, plus NULL-rate and freshness tests that alert on sudden changes."
        },
        rubric: [
          "Connect the NULL spike to the upstream rename.",
          "Fix the mapping and backfill the affected range.",
          "Add contract and distribution checks that alert."
        ],
        commonMistakes: ["Treating a green job run as proof the data is correct."],
        interviewerFollowUps: ["Who should own the contract between producer and consumer?"],
        interviewConnection: "Silent schema drift is a classic data-quality interview scenario."
      }),
      choice({
        id: "data-applied-3",
        pathKey: "pipeline-reliability",
        title: "Choose a safe backfill plan",
        format: "mcq",
        prompt:
          "A bug in a transformation affected the last 90 days. Downstream dashboards are used daily. What backfill plan is safest?",
        artifact: {
          kind: "scenario",
          title: "Backfill constraints",
          content:
            "90 daily partitions affected\nFull rebuild: ~9 hours, heavy warehouse load\nDashboards read the table directly\nJob is idempotent per partition"
        },
        topicKeys: ["backfills", "operations"],
        choices: [
          "Rebuild into a staging table in batches, validate, then swap partitions into production.",
          "Truncate the production table and rerun all 90 days at once.",
          "Only fix data going forward.",
          "Edit the affected rows manually in production."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Dashboards should not see half-rebuilt data.",
          "Validate before exposing the result.",
          "Batching limits load on the warehouse."
        ],
        answer: {
          concise:
            "Rebuild in staging in batches, validate against expectations, then atomically swap partitions into production.",
          explanation:
            "This keeps dashboards consistent during the backfill, lets you compare old and new numbers, and controls warehouse load. Communicate the correction to stakeholders."
        },
        commonMistakes: ["Truncating production and leaving dashboards empty for hours."],
        interviewerFollowUps: ["How would you explain the changed historical numbers to finance?"],
        interviewConnection: "Backfill planning shows operational maturity."
      }),
      text({
        id: "data-applied-4",
        pathKey: "pipeline-reliability",
        title: "Decide whether a failed check blocks publishing",
        format: "production-decision",
        prompt:
          "A data-quality check fails on the orders table before the morning executive report. Should publishing be blocked? Describe how you decide and what you communicate.",
        artifact: {
          kind: "metrics",
          title: "Quality checks",
          content:
            "orders.row_count vs 7-day median: -38% (threshold -20%) FAILED\norders.order_id unique: PASSED\norders.freshness: 40 min (SLA 2 h) PASSED\nUpstream: payments region eu-west had a 3-hour outage"
        },
        topicKeys: ["data-quality", "incident-response"],
        hints: [
          "Is the drop a real business event or missing data?",
          "The upstream outage explains incomplete data.",
          "Stale-but-labeled can be better than wrong."
        ],
        answer: {
          concise:
            "Block publishing the new orders data (keep yesterday's) because the drop matches an upstream outage, and tell report owners why.",
          explanation:
            "Severity-tiered checks should block on likely incomplete data. Publish with a clear stale notice, backfill after the upstream recovers, and document the decision."
        },
        rubric: [
          "Decide using evidence that the drop is missing data.",
          "Prefer labeled stale data to publishing wrong numbers.",
          "Communicate status and backfill plan to consumers."
        ],
        commonMistakes: ["Publishing because freshness passed while completeness failed."],
        interviewerFollowUps: ["Which checks should warn instead of block?"],
        interviewConnection: "Interviewers want judgment about when data is 'wrong enough' to stop."
      }),
      text({
        id: "data-applied-5",
        pathKey: "pipeline-reliability",
        title: "Deliver each event once to the warehouse",
        format: "written",
        prompt:
          "The team claims their Kafka-to-warehouse pipeline is 'exactly once', but duplicates still appear. Explain where duplicates come from and how to make the end result correct.",
        artifact: {
          kind: "logs",
          title: "Consumer behavior",
          content:
            "Consumer commits offsets after writing a batch to the warehouse\nConsumer crashed after write, before commit\nOn restart: batch re-read and written again\nEach event has event_id (UUID)"
        },
        topicKeys: ["streaming", "exactly-once"],
        hints: [
          "The write and the offset commit are not atomic.",
          "At-least-once delivery produces replays.",
          "Use the event's own ID to deduplicate."
        ],
        answer: {
          concise:
            "Delivery is at-least-once because write and commit are separate; make the sink idempotent by deduplicating on event_id.",
          explanation:
            "Accept replays and MERGE on event_id (or dedupe in a staging step with a window), which gives effectively-once results. Transactional sinks can help, but idempotency is the simpler guarantee."
        },
        rubric: [
          "Explain the crash window between write and commit.",
          "Use idempotent writes keyed by event_id.",
          "Distinguish delivery guarantees from end-to-end correctness."
        ],
        commonMistakes: ["Trusting a platform 'exactly once' setting without an idempotent sink."],
        interviewerFollowUps: ["How long must you remember event IDs to deduplicate?"],
        interviewConnection: "Delivery semantics come up in nearly every streaming interview."
      })
    ]
  },
  {
    key: "metric-incidents",
    title: "Explain a dashboard that looks wrong",
    description: "Trace surprising numbers back to definitions, time, and cost.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "data-applied-6",
        pathKey: "metric-incidents",
        title: "Explain the midnight drop",
        format: "artifact-diagnosis",
        prompt:
          "Daily active users for India dropped 22% on the new dashboard compared with the old one. Explain why.",
        artifact: {
          kind: "metrics",
          title: "DAU comparison",
          content:
            "Old dashboard: day boundary in Asia/Kolkata\nNew dashboard: DATE(event_ts) in UTC\nIndia evening peak: 19:00–23:30 IST (13:30–18:00 UTC)\nNew DAU lower on every day by 18–24%"
        },
        topicKeys: ["time-zones", "metric-definitions"],
        hints: [
          "The two dashboards define 'a day' differently.",
          "UTC midnight falls at 05:30 in India.",
          "Users active across the boundary split between days."
        ],
        answer: {
          concise:
            "The new dashboard uses UTC days, which cut Indian users' local day in two and change who counts as active each day.",
          explanation:
            "Define DAU in the audience's reporting time zone (or make the zone explicit), document it in the metric definition, and reconcile both dashboards before retiring the old one."
        },
        rubric: [
          "Identify the day-boundary time zone difference.",
          "Explain how it changes daily distinct counts.",
          "Fix with an explicit, documented metric definition."
        ],
        commonMistakes: ["Assuming a tracking outage without checking definitions."],
        interviewerFollowUps: ["How would you report DAU for a global product?"],
        interviewConnection: "Metric discrepancies usually come from definitions, not code bugs."
      }),
      text({
        id: "data-applied-7",
        pathKey: "metric-incidents",
        title: "Reconcile revenue with finance",
        format: "artifact-diagnosis",
        prompt:
          "The analytics dashboard shows 6% more revenue than finance for last month. List the likely causes from the evidence and how you would reconcile.",
        artifact: {
          kind: "scenario",
          title: "Definitions",
          content:
            "Dashboard: SUM(order_total) at order time, in order currency converted at month-end rate\nFinance: recognized revenue net of refunds, converted at transaction-date rate\nRefunds last month: 4.1% of order value"
        },
        topicKeys: ["reconciliation", "metric-definitions"],
        hints: [
          "One definition subtracts refunds.",
          "Exchange rates differ in timing.",
          "Bridge the numbers step by step."
        ],
        answer: {
          concise:
            "The dashboard counts gross order value and uses a different exchange-rate date; refunds explain most of the gap.",
          explanation:
            "Build a bridge: gross order value, minus refunds, adjusted for FX timing and recognition timing, to reach finance's figure. Then align the dashboard label or definition with finance."
        },
        rubric: [
          "Identify refunds and FX timing as definition differences.",
          "Reconcile with a step-by-step bridge.",
          "Align or clearly label the metric definition."
        ],
        commonMistakes: ["Forcing the numbers to match without explaining the difference."],
        interviewerFollowUps: ["Who should own the official revenue definition?"],
        interviewConnection: "Reconciliation shows you can speak both data and business."
      }),
      choice({
        id: "data-applied-8",
        pathKey: "metric-incidents",
        title: "Find why the dashboard is stale",
        format: "mcq",
        prompt:
          "The executive dashboard missed its 08:00 freshness SLA. Where should you look first?",
        artifact: {
          kind: "logs",
          title: "Lineage status at 08:10",
          content:
            "exec_dashboard ← mart_revenue (last success 2026-09-25 07:05)\nmart_revenue ← stg_payments (waiting on upstream sensor)\nstg_payments ← raw_payments (last file landed 2026-09-24 23:50)"
        },
        topicKeys: ["orchestration", "lineage"],
        choices: [
          "Walk lineage upstream to the first stale input: raw_payments has not landed new data.",
          "Rerun the dashboard refresh.",
          "Increase warehouse compute for mart_revenue.",
          "Rebuild all marts from scratch."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Downstream jobs wait on their inputs.",
          "Find the earliest node that is behind.",
          "Rerunning downstream cannot create missing data."
        ],
        answer: {
          concise:
            "Trace lineage to the root: raw payment files stopped landing, which blocks everything downstream.",
          explanation:
            "Freshness incidents are solved at the earliest stale dependency. Contact the payments data producer, and add freshness alerts on raw sources so you learn before the SLA breaches."
        },
        commonMistakes: ["Rerunning downstream jobs that are correctly waiting."],
        interviewerFollowUps: ["What freshness alerting would have caught this at midnight?"],
        interviewConnection: "Lineage reasoning is how data engineers debug efficiently."
      }),
      text({
        id: "data-applied-9",
        pathKey: "metric-incidents",
        title: "Cut the surprise warehouse bill",
        format: "production-decision",
        prompt:
          "Warehouse cost doubled this month. Using the evidence, decide what to change first and what trade-offs you accept.",
        artifact: {
          kind: "metrics",
          title: "Top cost drivers",
          content:
            "fct_events full refresh hourly: 58% of compute (table: 14 TB)\nAd-hoc queries without partition filters: 17%\nDashboard auto-refresh every 5 min: 9%\nNew model added 2026-09-02 switched fct_events to full refresh"
        },
        topicKeys: ["cost", "incremental-models"],
        hints: [
          "One change dominates the cost.",
          "Rebuilding 14 TB hourly is rarely necessary.",
          "Incremental processing with a lookback preserves correctness."
        ],
        answer: {
          concise:
            "Switch fct_events back to incremental with a lookback window, then add partition-filter guards and slower dashboard refreshes.",
          explanation:
            "The full refresh drives most of the cost; incremental merges on recent partitions keep data correct at a fraction of the compute. Add query guardrails and budget alerts to catch the next regression."
        },
        rubric: [
          "Prioritize the largest measured cost driver.",
          "Restore incremental processing with correctness safeguards.",
          "Add guardrails and cost monitoring."
        ],
        commonMistakes: ["Negotiating a bigger budget without fixing the full refresh."],
        interviewerFollowUps: ["When is a full refresh still the right choice?"],
        interviewConnection: "Cost ownership is increasingly part of data engineering interviews."
      }),
      text({
        id: "data-applied-10",
        pathKey: "metric-incidents",
        title: "Stop teams defining 'active user' differently",
        format: "written",
        prompt:
          "Three teams report different 'active user' numbers for the same week. Propose how to make one trusted definition without blocking every team.",
        artifact: {
          kind: "scenario",
          title: "Current definitions",
          content:
            "Growth: any event in 7 days\nProduct: at least one core action in 7 days\nFinance: paying accounts with a login in the calendar week\nEach team computes it in its own SQL"
        },
        topicKeys: ["semantic-layer", "governance"],
        hints: [
          "Different questions may need different, named metrics.",
          "Definitions should live in one governed place.",
          "Ownership and documentation matter as much as code."
        ],
        answer: {
          concise:
            "Define named, owned metrics in a shared semantic layer (for example weekly_active_users and weekly_core_active_users) and have dashboards read from it.",
          explanation:
            "Agree on which definition is the company KPI, give each variant a distinct name and owner, implement them once in a metrics layer with tests, and deprecate duplicated team SQL."
        },
        rubric: [
          "Separate legitimately different metrics with distinct names.",
          "Centralize definitions with clear ownership.",
          "Plan migration away from duplicated SQL."
        ],
        commonMistakes: ["Forcing one definition that no longer answers each team's question."],
        interviewerFollowUps: ["How would you roll this out without breaking existing dashboards?"],
        interviewConnection: "Metric governance questions test senior-level data judgment."
      })
    ]
  }
];

// Paths 3-4 of each Data track, added so each track has four paths.
const coreMore: AiMlStoryPath[] = [
  {
    key: "sql-correctness",
    title: "Write SQL that stays correct",
    description: "Catch the joins, NULLs, types, and date ranges that silently change answers.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "data-core-11",
        pathKey: "sql-correctness",
        title: "Find the customers who disappeared",
        format: "predict-explain",
        prompt:
          "This report should list every customer with their 2026 order count, including customers with no orders. It returns only customers who ordered. Explain why and fix it.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "customer_orders.sql",
          content:
            "SELECT c.id, COUNT(o.id) AS orders_2026\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= '2026-01-01'\nGROUP BY c.id;"
        },
        topicKeys: ["joins", "sql-semantics"],
        hints: [
          "Customers without orders have NULL in every o column.",
          "The WHERE clause runs after the join.",
          "A filter on the right table can move into the ON clause."
        ],
        answer: {
          concise:
            "The WHERE filter on o.created_at removes rows where o is NULL, turning the LEFT JOIN into an inner join; move the date condition into the ON clause.",
          explanation:
            "Write LEFT JOIN orders o ON o.customer_id = c.id AND o.created_at >= '2026-01-01'. Customers with no 2026 orders keep one row with NULLs, and COUNT(o.id) returns 0 for them."
        },
        rubric: [
          "Explain that the WHERE filter discards the NULL rows.",
          "Move the condition into the ON clause.",
          "Explain why COUNT(o.id) then returns 0 for those customers."
        ],
        commonMistakes: ["Adding OR o.created_at IS NULL, which is harder to reason about."],
        interviewerFollowUps: ["When is a filter in WHERE on a left-joined table intended?"],
        interviewConnection: "This is one of the most common SQL interview traps."
      }),
      choice({
        id: "data-core-12",
        pathKey: "sql-correctness",
        title: "Fix the conversion rate that is always zero",
        format: "mcq",
        prompt: "The conversion rate column returns 0 for every campaign. What is the cause?",
        artifact: {
          kind: "code",
          language: "sql",
          title: "conversion.sql",
          content:
            "SELECT campaign_id,\n       SUM(converted) / COUNT(*) AS conversion_rate\nFROM visits -- converted is INTEGER 0 or 1\nGROUP BY campaign_id;"
        },
        topicKeys: ["sql-semantics", "types"],
        choices: [
          "Integer divided by integer truncates to 0; cast one side to a decimal first.",
          "COUNT(*) counts NULL rows, which inflates the denominator.",
          "SUM ignores zero values.",
          "GROUP BY must include converted."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Both SUM(converted) and COUNT(*) are integers here.",
          "Many databases keep integer division as an integer.",
          "A rate below 1 truncates to 0."
        ],
        answer: {
          concise: "Integer division truncates the fraction, so any rate below 1 becomes 0.",
          explanation:
            "Cast before dividing, for example SUM(converted)::numeric / COUNT(*) or AVG(converted::numeric). Check the database's division rules, since some engines return decimals and others do not."
        },
        commonMistakes: ["Multiplying by 100 after the division, which is still 0."],
        interviewerFollowUps: ["How would you avoid dividing by zero for an empty campaign?"],
        interviewConnection: "Type-related SQL bugs are cheap to test and common in interviews."
      }),
      text({
        id: "data-core-13",
        pathKey: "sql-correctness",
        title: "Explain the missing last day",
        format: "artifact-diagnosis",
        prompt:
          "The monthly revenue for September is lower than finance's number, and every missing order is from September 30. Explain why.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "september_revenue.sql",
          content:
            "-- created_at is TIMESTAMP\nSELECT SUM(amount)\nFROM orders\nWHERE created_at BETWEEN '2026-09-01' AND '2026-09-30';\n-- Finance total: 1,284,300   Query total: 1,241,900"
        },
        topicKeys: ["dates", "sql-semantics"],
        hints: [
          "A date literal compared with a timestamp means midnight.",
          "BETWEEN includes both ends, but the end is 2026-09-30 00:00:00.",
          "Use a half-open range."
        ],
        answer: {
          concise:
            "'2026-09-30' becomes 2026-09-30 00:00:00, so almost all of the last day is excluded.",
          explanation:
            "Use created_at >= '2026-09-01' AND created_at < '2026-10-01'. Half-open ranges include the full last day, avoid double counting at boundaries, and work for any timestamp precision."
        },
        rubric: [
          "Explain that the end date is midnight at the start of the day.",
          "Use a half-open range ending at the next month.",
          "Mention time zones or precision as a further check."
        ],
        commonMistakes: ["Changing the end to '23:59:59', which still misses fractional seconds."],
        interviewerFollowUps: ["Which time zone should define 'September'?"],
        interviewConnection:
          "Date boundary bugs cause real reconciliation incidents, so interviewers like them."
      }),
      text({
        id: "data-core-14",
        pathKey: "sql-correctness",
        title: "Pick the top products when prices tie",
        format: "predict-explain",
        prompt:
          "Product wants 'the top 3 products by revenue in each category, including ties'. Predict what this query returns for the sample and fix it if needed.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "top_products.sql",
          content:
            "SELECT * FROM (\n  SELECT category, product, revenue,\n         ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) AS rn\n  FROM product_revenue\n) t WHERE rn <= 3;\n-- Books: A 900, B 700, C 500, D 500"
        },
        topicKeys: ["window-functions", "ranking"],
        hints: [
          "ROW_NUMBER never repeats a number.",
          "C and D tie at 500.",
          "Other ranking functions give ties the same rank."
        ],
        answer: {
          concise:
            "ROW_NUMBER returns only one of C or D, chosen arbitrarily; use RANK (or DENSE_RANK) to include ties.",
          explanation:
            "RANK gives C and D both rank 3, so rn <= 3 returns A, B, C, and D. DENSE_RANK would also do that and never skip numbers. Add a tiebreaker to ORDER BY only when ties must be broken deterministically."
        },
        rubric: [
          "Predict that only one tied product is returned, arbitrarily.",
          "Use RANK or DENSE_RANK to include ties.",
          "Explain the difference between RANK and DENSE_RANK."
        ],
        commonMistakes: ["Assuming ROW_NUMBER is deterministic for ties."],
        interviewerFollowUps: ["How would you make ROW_NUMBER deterministic?"],
        interviewConnection:
          "Window functions with ties are a favourite analytics interview question."
      }),
      text({
        id: "data-core-15",
        pathKey: "sql-correctness",
        title: "Decide how to test a critical metric query",
        format: "production-decision",
        prompt:
          "The weekly revenue query feeds the board report and has broken twice this year. Decide how you would test it before every change.",
        artifact: {
          kind: "scenario",
          title: "Weekly revenue model",
          content:
            "Model: 180 lines of SQL across 4 CTEs\nPast bugs: a join fan-out (double counting) and a timezone boundary\nRuns daily in the warehouse via dbt\nNo tests today"
        },
        topicKeys: ["testing", "data-quality"],
        hints: [
          "Test the specific ways it has broken before.",
          "Small fixed inputs make expected outputs easy to check.",
          "Add checks that run on real data too."
        ],
        answer: {
          concise:
            "Add unit tests on small fixed datasets for known edge cases, plus data tests (uniqueness, not null, reconciliation) on real runs.",
          explanation:
            "Unit tests with tiny inputs catch fan-out and date boundaries before merge. dbt tests on the output (unique grain, accepted ranges) and a reconciliation against a trusted total catch surprises in production data."
        },
        rubric: [
          "Add unit tests with fixed inputs for known failure modes.",
          "Add data tests on the real output, such as uniqueness of the grain.",
          "Reconcile against a trusted source."
        ],
        commonMistakes: ["Only checking that the query runs without error."],
        interviewerFollowUps: ["Which test would have caught the join fan-out?"],
        interviewConnection:
          "Testing SQL shows the engineering discipline interviewers look for in data roles."
      })
    ]
  },
  {
    key: "storage-and-formats",
    title: "Choose storage that fits the workload",
    description: "Match file formats, layouts, and systems to how the data is actually read.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "data-core-16",
        pathKey: "storage-and-formats",
        title: "Explain why the lake query got slow",
        format: "artifact-diagnosis",
        prompt:
          "A daily table in the data lake went from 40 seconds to 12 minutes to query, although the data only doubled. Using the listing, explain the cause and the fix.",
        artifact: {
          kind: "metrics",
          title: "Table storage listing",
          content:
            "events/date=2026-09-26/\n  files: 18,400 parquet files\n  median file size: 48 KB\n  written by: streaming job, one file per micro-batch per task\nQuery planning time: 9.5 min   Scan time: 2.1 min"
        },
        topicKeys: ["small-files", "storage-layout"],
        hints: [
          "Most of the time is spent planning, not scanning.",
          "Each file adds metadata and open overhead.",
          "Combine files into fewer, larger ones."
        ],
        answer: {
          concise:
            "Thousands of tiny files make planning and file opening dominate; compact them into files of roughly 128 MB–1 GB.",
          explanation:
            "Schedule compaction (for example OPTIMIZE or a rewrite job) after the streaming writes, and reduce file count at write time by batching larger micro-batches or fewer output tasks."
        },
        rubric: [
          "Identify the small-files problem from the planning time.",
          "Compact files to a sensible target size.",
          "Reduce file creation at write time too."
        ],
        commonMistakes: ["Adding more compute, which barely helps planning overhead."],
        interviewerFollowUps: ["How do table formats like Delta or Iceberg help here?"],
        interviewConnection: "Small files are a classic data lake performance question."
      }),
      choice({
        id: "data-core-17",
        pathKey: "storage-and-formats",
        title: "Pick a format for wide analytics tables",
        format: "mcq",
        prompt:
          "Analysts query 3 of 80 columns in a 2 TB events table, stored as CSV. Which change most reduces scan cost?",
        artifact: {
          kind: "scenario",
          title: "Events table",
          content:
            "Size: 2 TB CSV, 80 columns\nTypical query: SELECT date, country, SUM(revenue) ... GROUP BY 1, 2\nFilters on date\nBilled by bytes scanned"
        },
        topicKeys: ["columnar-formats", "cost"],
        choices: [
          "Store it as Parquet partitioned by date, so queries read only the needed columns and days.",
          "Compress the CSV with gzip.",
          "Split the CSV into more files.",
          "Store it as JSON so the schema is flexible."
        ],
        correctChoiceIndex: 0,
        hints: [
          "CSV must be read row by row, every column.",
          "Columnar formats can skip unused columns.",
          "Partitioning can skip unneeded days."
        ],
        answer: {
          concise:
            "Columnar Parquet reads only the 3 needed columns, and date partitioning skips irrelevant days.",
          explanation:
            "Row formats force reading all 80 columns. Parquet stores columns separately with statistics, so the engine reads a small fraction of bytes, and partition pruning on date cuts it further."
        },
        commonMistakes: ["Gzipping CSV, which is not even splittable for parallel reads."],
        interviewerFollowUps: ["When would a row-oriented format be the better choice?"],
        interviewConnection: "Storage format choice shows you understand how scans are billed."
      }),
      text({
        id: "data-core-18",
        pathKey: "storage-and-formats",
        title: "Choose a clustering key",
        format: "written",
        prompt:
          "Given these query patterns, choose how you would partition and cluster the table, and explain the trade-off.",
        artifact: {
          kind: "metrics",
          title: "Query log summary (orders table, 4 TB)",
          content:
            "85% of queries: WHERE order_date BETWEEN ... AND ...\n60% of queries also filter: WHERE customer_id = ?\n10% of queries: full scans for monthly reports\ncustomer_id cardinality: 12 million\norder_date range: 5 years"
        },
        topicKeys: ["partitioning", "clustering"],
        hints: [
          "Partition on a low-cardinality column that most queries filter by.",
          "High-cardinality columns make too many partitions.",
          "Clustering orders data inside partitions."
        ],
        answer: {
          concise:
            "Partition by order_date (for example by day or month) and cluster by customer_id within partitions.",
          explanation:
            "Date is filtered in most queries and has manageable cardinality, so partitions prune well. customer_id has 12 million values, which would create far too many partitions, but clustering on it lets the engine skip blocks within each date partition."
        },
        rubric: [
          "Partition on the common low-cardinality filter, the date.",
          "Cluster on the high-cardinality filter, customer_id.",
          "Explain why partitioning on customer_id would backfire."
        ],
        commonMistakes: ["Partitioning by customer_id and creating millions of tiny partitions."],
        interviewerFollowUps: ["How would you check whether pruning actually happens?"],
        interviewConnection:
          "Partitioning questions test whether you design for real query patterns."
      }),
      text({
        id: "data-core-19",
        pathKey: "storage-and-formats",
        title: "Stop analytics from slowing the app database",
        format: "production-decision",
        prompt:
          "Analysts run heavy queries on the production Postgres read replica and the app's latency spikes. Decide what to change and explain the trade-offs.",
        artifact: {
          kind: "metrics",
          title: "Replica during business hours",
          content:
            "Analyst queries: 40/hour, many full scans over orders (900 M rows)\nReplica CPU: 95% at peaks\nReplication lag: up to 8 min\nApp reads from the same replica: p95 latency 120 ms -> 1.4 s"
        },
        topicKeys: ["oltp-vs-olap", "architecture"],
        hints: [
          "The app and the analysts share the same machine.",
          "Transactional databases are not built for large scans.",
          "Move analytics to a system designed for it."
        ],
        answer: {
          concise:
            "Move analytics to a warehouse fed by change data capture or scheduled loads, and keep the replica for the app.",
          explanation:
            "A columnar warehouse handles large scans cheaply and isolates analysts from app traffic. As a short-term step, give analysts a separate replica with query timeouts. Accept slightly delayed data in exchange for stable app latency."
        },
        rubric: [
          "Separate analytical workloads from the app's database.",
          "Choose a warehouse fed by CDC or batch loads.",
          "Mention a short-term mitigation and the freshness trade-off."
        ],
        commonMistakes: ["Scaling up the replica, which only postpones the problem."],
        interviewerFollowUps: ["How fresh does analytics data really need to be?"],
        interviewConnection: "OLTP versus OLAP is a core data-engineering design question."
      }),
      text({
        id: "data-core-20",
        pathKey: "storage-and-formats",
        title: "Explain the failing casts in the JSON column",
        format: "artifact-diagnosis",
        prompt:
          "A model that reads a JSON payload column started failing with cast errors. Explain the cause and how to make the pipeline resilient.",
        artifact: {
          kind: "logs",
          title: "Model run",
          content:
            'ERROR: invalid input syntax for type integer: "12.5"\n  in: CAST(payload->>\'quantity\' AS INTEGER)\nSample payloads:\n  {"quantity": 3}\n  {"quantity": "4"}\n  {"quantity": 12.5}   <- new mobile app release'
        },
        topicKeys: ["schema-evolution", "data-contracts"],
        hints: [
          "JSON does not enforce a type for each field.",
          "Different producers send different shapes.",
          "Validate and quarantine instead of failing the whole run."
        ],
        answer: {
          concise:
            "Producers send quantity as an integer, a string, and a decimal, so the strict integer cast fails on the new decimal values.",
          explanation:
            "Cast safely (for example TRY_CAST or NUMERIC), route rows that fail validation to a quarantine table with alerts, and agree a data contract with producers so types are checked where events are created."
        },
        rubric: [
          "Identify inconsistent types from different producers.",
          "Cast safely and quarantine bad rows instead of failing everything.",
          "Add a contract or validation at the source."
        ],
        commonMistakes: ["Silently converting bad values to 0."],
        interviewerFollowUps: ["Should a decimal quantity be rejected or accepted?"],
        interviewConnection: "Schema drift questions show you can build pipelines that fail safely."
      })
    ]
  }
];

const appliedMore: AiMlStoryPath[] = [
  {
    key: "streaming-incidents",
    title: "Keep a streaming pipeline healthy",
    description: "Diagnose lag, late data, poison messages, and schema changes in event streams.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "data-applied-11",
        pathKey: "streaming-incidents",
        title: "Find why one consumer falls behind",
        format: "artifact-diagnosis",
        prompt:
          "Consumer lag keeps growing even after adding consumers. Using the metrics, explain the cause and the fix.",
        artifact: {
          kind: "metrics",
          title: "Topic: page_views (12 partitions)",
          content:
            "Consumers: 12 (was 6)\nPartition 7 lag: 4.2 M messages (growing)\nOther partitions lag: < 2,000\nPartition key: tenant_id\nTenant 'bigco' = 71% of traffic"
        },
        topicKeys: ["kafka", "partition-skew"],
        hints: [
          "Each partition is read by only one consumer in a group.",
          "One partition holds most of the traffic.",
          "The key sends one huge tenant to one partition."
        ],
        answer: {
          concise:
            "Keying by tenant_id sends the biggest tenant to one partition, and only one consumer can read it, so adding consumers cannot help.",
          explanation:
            "Choose a key that spreads the load, such as tenant_id plus a user or session id when per-tenant ordering is not required. If ordering per tenant is required, split hot tenants into sub-keys and keep ordering within each sub-key."
        },
        rubric: [
          "Identify the hot partition caused by the key choice.",
          "Explain why more consumers cannot help one partition.",
          "Propose a better key and discuss the ordering trade-off."
        ],
        commonMistakes: ["Adding partitions without changing the key."],
        interviewerFollowUps: ["What ordering guarantees does Kafka give?"],
        interviewConnection: "Partition skew is a common streaming interview scenario."
      }),
      choice({
        id: "data-applied-12",
        pathKey: "streaming-incidents",
        title: "Count the events that arrive late",
        format: "mcq",
        prompt:
          "Mobile events can arrive up to 20 minutes late when phones reconnect. Hourly counts are consistently low. What is the best fix?",
        artifact: {
          kind: "config",
          title: "Streaming window config",
          content:
            "window: tumbling 1 hour on event_time\nwatermark: event_time - 2 minutes\nlate events: dropped\nobserved: ~6% of mobile events dropped as late"
        },
        topicKeys: ["watermarks", "late-data"],
        choices: [
          "Allow lateness (for example a 30-minute watermark) and update the hourly results when late events arrive.",
          "Switch the window to processing time.",
          "Drop mobile events from the hourly report.",
          "Shorten the window to 5 minutes."
        ],
        correctChoiceIndex: 0,
        hints: [
          "The watermark decides when a window is considered complete.",
          "Two minutes is much shorter than the real delay.",
          "Processing time would put events in the wrong hour."
        ],
        answer: {
          concise:
            "Widen the watermark or allowed lateness to cover real delays and update results as late events arrive.",
          explanation:
            "A 2-minute watermark closes windows before late mobile events arrive. Allowing about 30 minutes keeps windows open long enough, at the cost of later final numbers and more state. Emit early results and correct them as late data lands."
        },
        commonMistakes: ["Using processing time, which assigns late events to the wrong hour."],
        interviewerFollowUps: ["What happens to state size when you allow more lateness?"],
        interviewConnection: "Event time versus processing time is a core streaming concept."
      }),
      ordering({
        id: "data-applied-13",
        pathKey: "streaming-incidents",
        title: "Stop one bad message from blocking everything",
        format: "artifact-diagnosis",
        prompt:
          "The consumer keeps crashing on the same malformed message and no events are processed. Order how the consumer should handle a message that fails to parse so the stream keeps moving and nothing is silently lost.",
        artifact: {
          kind: "logs",
          title: "Consumer logs",
          content:
            "10:02:01 consuming partition 3 offset 88213\n10:02:01 ERROR JSON parse failed: Unexpected token < at position 0\n10:02:01 consumer crashed, restarting\n10:02:07 consuming partition 3 offset 88213\n10:02:07 ERROR JSON parse failed: Unexpected token < at position 0\n(repeats for 45 minutes)"
        },
        topicKeys: ["poison-messages", "dead-letter-queues"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            { id: "commit", label: "Commit the offset so the consumer moves past the message." },
            {
              id: "catch",
              label: "Catch the parse error for this one message instead of crashing."
            },
            {
              id: "alert",
              label: "Alert on dead-letter volume and replay the fixed messages later."
            },
            {
              id: "deadletter",
              label: "Send the raw message and the error details to a dead-letter topic."
            },
            { id: "continue", label: "Continue processing the next message." }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "catch",
            second: "deadletter",
            label: "Catch the error before routing the message",
            points: 2,
            explanation: "Handle the failure per message so the consumer does not crash."
          },
          {
            type: "before",
            first: "deadletter",
            second: "commit",
            label: "Save the message before committing past it",
            points: 4,
            explanation: "Committing first would lose the message if the dead-letter write fails."
          },
          {
            type: "before",
            first: "commit",
            second: "continue",
            label: "Commit before moving on",
            points: 2,
            explanation: "Without the commit, a restart reads the same poison message again."
          },
          {
            type: "before",
            first: "deadletter",
            second: "alert",
            label: "Alert and replay from the dead-letter topic",
            points: 2,
            explanation:
              "Parked messages need someone to notice and replay them, or they are lost in practice."
          }
        ],
        hints: [
          "The offset never advances.",
          "The same malformed message is read again after each restart.",
          "Bad messages need somewhere safe to go before you move on."
        ],
        answer: {
          concise:
            "Catch the error, send the message to a dead-letter topic, commit the offset, continue, and alert and replay later.",
          explanation:
            "Writing the message to the dead-letter topic before committing means nothing is lost; committing then lets the consumer move on. Alerting on dead-letter volume makes sure parked messages are fixed and replayed."
        },
        commonMistakes: ["Skipping the message silently, which loses data without anyone knowing."],
        interviewerFollowUps: ["How would you replay messages from the dead-letter topic?"],
        interviewConnection:
          "Handling poison messages shows you can keep streaming systems available."
      }),
      ordering({
        id: "data-applied-14",
        pathKey: "streaming-incidents",
        title: "Change an event schema without breaking consumers",
        format: "production-decision",
        prompt:
          "The checkout team wants to rename amount to amount_cents and change it from a decimal to an integer. Mobile apps take weeks to update. Order the rollout so no producer or consumer breaks.",
        artifact: {
          kind: "scenario",
          title: "checkout_completed event",
          content:
            "Producers: web, iOS, Android (mobile updates take weeks)\nConsumers: warehouse loader, fraud service, email service\nSchema registry: backward compatibility enforced\nProposed: rename amount -> amount_cents, type decimal -> integer"
        },
        topicKeys: ["schema-evolution", "data-contracts"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            { id: "remove", label: "Remove amount from the schema." },
            { id: "add", label: "Add amount_cents to the schema as an optional field." },
            {
              id: "consumers",
              label:
                "Update consumers to read amount_cents, falling back to amount when it is missing."
            },
            { id: "producers", label: "Update producers to send both amount and amount_cents." },
            {
              id: "watch",
              label: "Watch metrics until no events arrive with only amount."
            }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "add",
            second: "producers",
            label: "Add the field before anyone sends it",
            points: 2,
            explanation: "The registry must accept amount_cents before producers can publish it."
          },
          {
            type: "before",
            first: "add",
            second: "consumers",
            label: "Add the field before consumers read it",
            points: 2,
            explanation: "Consumers can only read a field the schema defines."
          },
          {
            type: "before",
            first: "watch",
            second: "remove",
            label: "Confirm nobody sends the old field before removing it",
            points: 4,
            explanation:
              "Old mobile apps keep sending amount for weeks; removing it early breaks them."
          },
          {
            type: "before",
            first: "consumers",
            second: "remove",
            label: "Move consumers before removing the old field",
            points: 2,
            explanation: "A consumer still reading amount would break the moment it disappears."
          }
        ],
        hints: [
          "A rename is a removal plus an addition.",
          "Old mobile apps will keep sending the old field for weeks.",
          "Add first, migrate everyone, remove last."
        ],
        answer: {
          concise:
            "Add amount_cents, move producers and consumers to it, wait until no event carries only amount, then remove amount.",
          explanation:
            "This expand-migrate-contract rollout keeps every version compatible. Producers and consumers can move in either order once the field exists; the old field is removed only when metrics prove nothing still depends on it."
        },
        commonMistakes: ["Renaming in place and relying on everyone deploying at once."],
        interviewerFollowUps: [
          "What is the difference between backward and forward compatibility?"
        ],
        interviewConnection: "Schema evolution is a key production-readiness topic for data roles."
      }),
      text({
        id: "data-applied-15",
        pathKey: "streaming-incidents",
        title: "Handle a sink that cannot keep up",
        format: "written",
        prompt:
          "During a sale, events arrive faster than the warehouse sink can write them, memory grows, and workers are killed. Explain what is happening and how you would handle it.",
        artifact: {
          kind: "metrics",
          title: "Sale peak",
          content:
            "Incoming: 45,000 events/s\nSink throughput: 18,000 events/s (warehouse insert limit)\nWorker buffer: grows ~1.6 GB/min\nWorkers OOM-killed after ~6 minutes\nData lost: events buffered in memory at crash"
        },
        topicKeys: ["backpressure", "reliability"],
        hints: [
          "The buffer grows because output is slower than input.",
          "Memory is a poor place to hold the backlog.",
          "The stream itself can hold the backlog if you stop pulling."
        ],
        answer: {
          concise:
            "The sink is slower than the source and the workers buffer the difference in memory; apply backpressure and let the durable stream hold the backlog.",
          explanation:
            "Bound the in-memory buffer and pause consumption when it fills, so unread events stay in the broker instead of in RAM. Commit offsets only after writes succeed so nothing is lost. Then raise sink throughput with larger batches or parallel writers."
        },
        rubric: [
          "Explain the rate mismatch and unbounded buffering.",
          "Apply backpressure so the broker holds the backlog.",
          "Commit only after successful writes and improve sink throughput."
        ],
        commonMistakes: ["Giving workers more memory, which only delays the crash."],
        interviewerFollowUps: ["How would you size batches for the warehouse loader?"],
        interviewConnection:
          "Backpressure questions test whether you understand flow in real systems."
      })
    ]
  },
  {
    key: "privacy-governance",
    title: "Handle sensitive data safely",
    description: "Find leaked personal data, honour deletion, and limit who can see what.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "data-applied-16",
        pathKey: "privacy-governance",
        title: "Find the personal data that leaked into analytics",
        format: "artifact-diagnosis",
        prompt:
          "A privacy review found email addresses in an analytics table that should hold none. Using the sample, explain how they got there and how you would clean up and prevent it.",
        artifact: {
          kind: "logs",
          title: "analytics.page_events sample",
          content:
            'event: search   properties: {"query": "invoice for jane.doe@example.com"}\nevent: signup   properties: {"referrer": "https://app.example/invite?email=sam@example.com"}\nRows affected: ~38,000 over 14 months\nAccess: 140 analysts'
        },
        topicKeys: ["privacy", "pii"],
        hints: [
          "Free-text fields and URLs often carry personal data.",
          "The data is already copied into many places.",
          "Prevention belongs at collection time."
        ],
        answer: {
          concise:
            "Emails entered in free-text search and embedded in URL query strings were captured as event properties.",
          explanation:
            "Restrict access, purge or redact the affected rows and derived tables, and check downstream copies. Prevent recurrence by stripping query strings and scanning free-text properties for personal data before events are stored, with an allowlist of collected properties."
        },
        rubric: [
          "Identify free text and URLs as the leak sources.",
          "Contain and clean up the existing data, including copies.",
          "Prevent it at collection with allowlists or redaction."
        ],
        commonMistakes: ["Deleting the table rows but forgetting downstream copies."],
        interviewerFollowUps: ["Who should you notify when this is discovered?"],
        interviewConnection: "Privacy awareness is increasingly expected of every data engineer."
      }),
      choice({
        id: "data-applied-17",
        pathKey: "privacy-governance",
        title: "Honour a deletion request",
        format: "mcq",
        prompt:
          "A user asks to have their data deleted. Their data exists in the app database, the warehouse, and nightly backups kept for 35 days. What is the most defensible approach?",
        artifact: {
          kind: "scenario",
          title: "Where the user's data lives",
          content:
            "App database: profile, orders\nWarehouse: raw events, 14 derived tables\nBackups: nightly, retained 35 days, immutable\nPolicy: deletion within 30 days"
        },
        topicKeys: ["privacy", "data-deletion"],
        choices: [
          "Delete from the app and warehouse (including derived tables), and let backups expire, documenting that restores re-apply deletions.",
          "Delete only from the app database, since the warehouse is internal.",
          "Restore and rewrite every backup immediately.",
          "Anonymize the user's name but keep all their events."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Derived tables are copies too.",
          "Immutable backups usually expire rather than being edited.",
          "A restore must not bring deleted data back."
        ],
        answer: {
          concise:
            "Delete everywhere you can, including derived data, let immutable backups age out, and make restores re-apply deletions.",
          explanation:
            "Keep a deletion log keyed by user so any restore or rebuild replays the deletions. This meets the deadline without the risk of rewriting backups, and is a common, documented approach."
        },
        commonMistakes: ["Forgetting derived tables and caches."],
        interviewerFollowUps: ["How would you find every table containing a given user's data?"],
        interviewConnection:
          "Deletion requests test whether you understand where data really flows."
      }),
      text({
        id: "data-applied-18",
        pathKey: "privacy-governance",
        title: "Limit who can see salaries",
        format: "production-decision",
        prompt:
          "HR data in the warehouse includes salaries, and currently every analyst can query it. Decide how to restrict access while keeping headcount reporting working.",
        artifact: {
          kind: "scenario",
          title: "hr.employees",
          content:
            "Columns: employee_id, department, level, start_date, salary, bonus\nUsers: 140 analysts need headcount by department\n6 HR partners need salaries\nWarehouse supports column masking and row policies"
        },
        topicKeys: ["access-control", "governance"],
        hints: [
          "Most users need counts, not salaries.",
          "Grant the least access each group needs.",
          "Masking can hide columns without separate copies."
        ],
        answer: {
          concise:
            "Mask salary and bonus for everyone except the HR role, or expose an aggregated view for analysts, following least privilege.",
          explanation:
            "Give analysts a view or masked columns that support headcount reporting, and grant raw salaries only to the HR role. Audit access to the sensitive columns and review grants regularly."
        },
        rubric: [
          "Apply least privilege based on what each group needs.",
          "Use masking or aggregated views instead of full access.",
          "Audit and review access to sensitive columns."
        ],
        commonMistakes: ["Copying the table without salaries and letting the copies drift."],
        interviewerFollowUps: ["Can small groups in aggregates still reveal individual salaries?"],
        interviewConnection: "Governance questions show you can protect data without blocking work."
      }),
      text({
        id: "data-applied-19",
        pathKey: "privacy-governance",
        title: "Share data with a research partner",
        format: "written",
        prompt:
          "A research partner wants user-level activity data. Explain the difference between pseudonymization and anonymization, and what you would share.",
        artifact: {
          kind: "scenario",
          title: "Requested dataset",
          content:
            "Fields requested: user_id, age, postcode, signup_date, daily activity\nPurpose: study usage patterns\nUsers: 2.1 M\nPartner is outside the company"
        },
        topicKeys: ["privacy", "anonymization"],
        hints: [
          "Replacing user_id with a token still lets records be linked.",
          "Combinations like age, postcode, and date can identify people.",
          "Share only what the purpose needs, at a coarser level."
        ],
        answer: {
          concise:
            "Pseudonymized data is still personal data because it can be re-linked; share a minimized, generalized dataset instead.",
          explanation:
            "Replace user_id with a random token, generalize quasi-identifiers (age bands, postcode areas, signup month), drop fields the study does not need, and check that no small groups remain. Put a data-sharing agreement in place."
        },
        rubric: [
          "Explain the difference between pseudonymization and anonymization.",
          "Identify quasi-identifiers that allow re-identification.",
          "Minimize and generalize the shared data under an agreement."
        ],
        commonMistakes: ["Assuming hashing user_id makes the data anonymous."],
        interviewerFollowUps: ["What is k-anonymity?"],
        interviewConnection: "Interviewers use this to check your judgement with sensitive data."
      }),
      text({
        id: "data-applied-20",
        pathKey: "privacy-governance",
        title: "Explain the retention job that deleted too much",
        format: "artifact-diagnosis",
        prompt:
          "A retention job meant to delete events older than 400 days deleted recent partitions too. Explain the bug and how you would make such jobs safe.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "retention.sql",
          content:
            "-- partition column dt is STRING like '9/26/2026'\nDELETE FROM events\nWHERE dt < '8/22/2025';\n-- deleted: '10/1/2026', '11/5/2026' ... (string comparison)"
        },
        topicKeys: ["data-retention", "types"],
        hints: [
          "The dates are stored as strings, not dates.",
          "Strings compare character by character.",
          "'10/1/2026' is less than '8/22/2025' as text."
        ],
        answer: {
          concise:
            "dt is a string in M/D/YYYY format, so the comparison is alphabetical and many recent dates sort before '8/22/2025'.",
          explanation:
            "Parse the partition value to a DATE (or store ISO dates like 2026-09-26) before comparing. Make destructive jobs safe with a dry run that lists affected partitions, a sanity limit on how much can be deleted, and recoverable deletes such as time travel or a soft-delete window."
        },
        rubric: [
          "Explain the alphabetical string comparison.",
          "Compare real dates or use ISO format.",
          "Add safeguards such as dry runs, limits, and recoverability."
        ],
        commonMistakes: ["Fixing the date format but keeping no safeguard for the next bug."],
        interviewerFollowUps: ["How would you recover the deleted partitions?"],
        interviewConnection: "Destructive-job safety is a strong seniority signal in data roles."
      })
    ]
  }
];

export function dataStoryPaths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[] {
  return track === "core-technical" ? [...core, ...coreMore] : [...applied, ...appliedMore];
}
