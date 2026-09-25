import type {
  AiMlStoryPath,
  AiMlStoryQuestion
} from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";

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

export function dataStoryPaths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[] {
  return track === "core-technical" ? core : applied;
}
