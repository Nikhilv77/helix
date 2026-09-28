import {
  reviewedArchitectureDesignArtifact,
  type ArchitectureDesignScenarioSeed
} from "./reviewed-scenario-builder";

type StageSeed = ArchitectureDesignScenarioSeed["questions"][number];

function stage(input: StageSeed): StageSeed {
  return input;
}

/**
 * Data system design: the pipeline and its tables are the system under
 * design. The same sixteen dimensions apply, read from the data side:
 * contracts are event schemas and data contracts; storage is table layout and
 * partitioning; consistency is deduplication, idempotent writes, and late
 * data; hotspots are skewed keys and joins.
 */
const DATA_REVIEW = {
  roles: ["data"],
  reviewStatus: "approved",
  reviewerId: "project-owner",
  reviewedAt: "2026-09-28",
  authoredAt: "2026-09-28T12:00:00.000Z",
  authoring: {
    provider: "anthropic",
    model: "claude",
    promptVersion: "architecture-design-data-content-v1"
  }
} satisfies Partial<ArchitectureDesignScenarioSeed>;

/** Scenarios kept out of Practice so the interview always has unseen ones. */
export const DATA_INTERVIEW_ONLY_SCENARIO_KEYS = [
  "realtime-fraud-feature-pipeline",
  "experiment-metrics-pipeline"
] as const;

export const DATA_ARCHITECTURE_SCENARIOS = Object.freeze([
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "clickstream-analytics-pipeline",
    title: "Clickstream events into a warehouse",
    premise:
      "Design the pipeline that collects web and app clickstream events for a large shopping app and makes them queryable in the warehouse, with product funnel dashboards no more than 15 minutes behind and a daily sessions table every morning.",
    candidateRole:
      "You own the pipeline from event collection to warehouse tables: the event contract, ingestion, stream and batch processing, table design, data quality, privacy, cost, and schema changes.",
    functionalRequirements: [
      "Collect page views, searches, add-to-cart, and purchase events from web, Android, and iOS, and land them in raw and cleaned warehouse tables.",
      "Publish hourly product funnel tables and a daily sessions table that analysts and dashboards query."
    ],
    nonGoals: [
      "The first release will not build real-time personalisation, a BI tool, or ad attribution models."
    ],
    constraints: [
      "Mobile apps buffer events offline and can send them up to 72 hours late, and retries can send the same event more than once.",
      "Events contain user IDs and IP addresses, which fall under the company's privacy policy and deletion requests."
    ],
    scaleProfile: [
      "2.5 billion events per day, peaking at 90,000 events per second during sales; the average event is 1.2 KB of JSON.",
      "Dashboards must show funnel data no older than 15 minutes at p95; the daily sessions table must be ready by 06:00."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "event-ingestion",
    secondaryTopicKeys: ["stream-processing", "warehouse-modeling", "data-quality"],
    targetKeywords: [
      "data engineering",
      "kafka",
      "clickstream",
      "warehouse",
      "spark",
      "sessionization",
      "dbt",
      "event schema"
    ],
    realismAnchors: [
      "A sale doubles traffic to 180,000 events per second and consumer lag reaches 40 minutes.",
      "An app release renames product_id to productId, and the funnel table shows a 30 percent drop in add-to-cart.",
      "3 percent of Android events arrive more than 24 hours late after an offline-sync bug fix."
    ],
    targetFitExplanation:
      "A clickstream pipeline is the most common data engineering system design question: it tests event contracts, streaming ingestion, late data, warehouse modelling, and cost at scale.",
    coverageExplanation:
      "Four connected decisions cover volume and targets, the event contract and tables, the pipeline under failure, and a safe migration across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn the analytics request into consumers, output tables, volume estimates, and freshness and completeness targets.",
        dependency:
          "The volume, late-arrival, and freshness figures set here size the contract, pipeline, and checks that follow.",
        topicKeys: ["event-ingestion", "warehouse-modeling"],
        prompt:
          "Define the consumers, what the first release delivers, and what it will not. Estimate daily and peak volume and raw storage per day and per year, and set freshness, completeness, and correctness targets for each output table.",
        artifact: {
          key: "clickstream-volume-brief",
          kind: "metrics",
          title: "Clickstream volume brief",
          content:
            "2.5 billion events per day; average 1.2 KB of JSON; peak 90,000 events per second, up to 180,000 on sale days.\nLate arrivals: 97 percent within 5 minutes, 99.5 percent within 24 hours, the rest up to 72 hours.\nConsumers: product dashboards (15-minute freshness), analysts (daily sessions by 06:00), and finance, who ask for 'the same purchase numbers as the orders database'.\nRetention request: 'keep everything forever'.",
          caption: "Freshness, completeness, and ownership of the numbers are separate promises."
        },
        hints: [
          "Work out bytes per day from events per day and event size, then think about how much a compressed columnar format saves.",
          "Late events mean every table needs a stated completeness point, not only a freshness target.",
          "Finance's request is a correctness boundary: decide whether clickstream purchases are the source of truth for revenue."
        ],
        referenceAnswer: {
          summary:
            "Scope raw, cleaned, hourly funnel, and daily session tables; size about 3 TB of raw JSON a day; set freshness and completeness targets per table; and keep revenue owned by the orders database.",
          explanation:
            "2.5 billion events at 1.2 KB is about 3 TB of raw JSON a day, roughly 1.1 PB a year; as compressed Parquet it is usually 5 to 10 times smaller, about 300 to 600 GB a day. Peak ingestion is 90,000 events per second, about 108 MB/s, and capacity is planned for the 180,000 sales peak with headroom. First release: raw events (immutable, as received), cleaned events (validated, deduplicated, typed), hourly funnel tables, and a daily sessions table; personalisation, attribution, and a BI tool are out. Targets: funnel data within 15 minutes at p95, marked provisional for 24 hours because 0.5 percent of events arrive later; the daily sessions table published by 06:00 and restated for the previous three days as late data arrives; cleaned events with at most 0.1 percent duplicates. Clickstream purchases are for funnels only; revenue stays with the orders database, and the gap between them is monitored rather than forced to zero. Retention: raw events 90 days, cleaned events two years, aggregates longer, with deletion requests applied to every copy."
        },
        rubric: [
          {
            criterion:
              "Names consumers, output tables, and non-goals, and keeps revenue owned by the orders database.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates daily and peak volume and storage, and sets freshness and completeness targets that account for late events.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Promising exact, final numbers within 15 minutes even though some events arrive up to 72 hours late.",
          "Treating clickstream purchases as the revenue source of truth and chasing an exact match with the orders database.",
          "Sizing for the average rate instead of the sales peak, so the pipeline falls behind on the days that matter most."
        ],
        interviewerFollowUps: [
          "If product wanted 1-minute freshness for one dashboard, what would you change and what would it cost?"
        ],
        transferConnection:
          "Separating freshness from completeness and naming a source of truth applies to every analytics pipeline."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair the event contract and table design so events are typed, identifiable, deduplicated, and stored for how they are queried.",
        dependency:
          "The event ID, timestamps, and raw and cleaned layers become the basis for the pipeline's idempotent writes and replays.",
        topicKeys: ["event-ingestion", "warehouse-modeling"],
        prompt:
          "Diagnose this event contract and storage plan. Specify the event schema and how it is versioned, how events are identified and deduplicated, how the raw and cleaned tables are modelled and partitioned, and which timestamp each table uses.",
        artifact: {
          key: "clickstream-contract-draft",
          kind: "config",
          title: "Proposed event contract and table",
          content:
            'Clients POST free-form JSON. There is no event ID.\n\n```json\n{\n  "event": "add_to_cart",\n  "ts": "2026-09-27T20:14:03+05:30",\n  "user": { "id": "u_9142", "email": "...", "address": "...", "segments": ["..."] },\n  "props": { "product_id": "p_2231", "price": 1299 }\n}\n```\n\nThe collector writes each request straight into one table, and dashboards parse the JSON at query time.\n\n```sql\nCREATE TABLE events (\n  payload   STRING,   -- the raw JSON above\n  ingest_ts TIMESTAMP\n)\nPARTITION BY DATE(ingest_ts);\n```\n\nApp teams rename fields without notice. There is no deduplication.',
          caption: "Untyped events with no ID and no schema make every downstream number fragile."
        },
        hints: [
          "Every event needs an ID generated on the device so retries and replays can be detected.",
          "Device clocks are often wrong; decide which times you record and which one analysts should use.",
          "Decide what is stored exactly as received and what is modelled for queries, and how each is partitioned."
        ],
        referenceAnswer: {
          summary:
            "Use a versioned, registry-checked event schema with a client event ID and several timestamps, keep raw events immutable, and build deduplicated cleaned tables partitioned by event date.",
          explanation:
            "Each event carries event_id (a UUID generated on the device), event_name, schema_version, user_id or anonymous_id, session_id, device_time, sent_time, and a server-added received_time, plus typed properties per event type; the user profile is not embedded but kept in a user dimension. Schemas live in a registry and the collector validates against them: additive fields are allowed, while renames and type changes need a new version, and invalid events go to a quarantine table with the reason instead of being dropped. The collector writes to a Kafka topic keyed by user or anonymous ID. Raw events land unchanged in an append-only table partitioned by received date, so they can always be replayed. The cleaned events table is typed, deduplicated on event_id with a MERGE over a lookback window that covers the 72-hour late window, partitioned by event date from corrected event time (device time adjusted by the gap between sent_time and received_time), and clustered by event name and user. Funnel and session models are built from cleaned events as a fact table joined to product and user dimensions. Because late merges rewrite recent partitions, downstream models reprocess the affected event dates."
        },
        rubric: [
          {
            criterion:
              "Defines a typed, versioned, registry-validated event schema with a client event ID and a quarantine for invalid events.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Separates immutable raw events, typed cleaned events, and fact and dimension models instead of embedding profiles.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Partitions and clusters each table for how it is written and queried, using event date for analysis.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Deduplicates on event ID with an idempotent merge that covers the late-arrival window.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Deduplicating by comparing whole rows, which fails as soon as a retry changes sent_time.",
          "Partitioning analysis tables by ingestion date, so late events land in the wrong day and daily numbers drift.",
          "Letting app teams rename fields freely and fixing dashboards only after the numbers drop."
        ],
        interviewerFollowUps: [
          "An iOS release sends price as a string instead of a number. What happens to those events in your design?"
        ],
        transferConnection:
          "Client-generated IDs, schema registries, and raw-plus-cleaned layers apply to any event pipeline, including logs and IoT telemetry."
      }),
      stage({
        format: "written",
        objective:
          "Design the pipeline from collector to dashboards and contain the lag, replay, small-file, and bad-record failures in the log.",
        dependency:
          "The pipeline must write with the event ID and partitioning chosen in the previous stage so replays stay idempotent.",
        topicKeys: ["stream-processing", "event-ingestion"],
        prompt:
          "Sketch the pipeline architecture from collector to dashboards: ingestion, stream and batch processing, how data is written to the warehouse, and orchestration. Then use the log to explain what failed and how your design contains each failure.",
        artifact: {
          key: "clickstream-incident-log",
          kind: "logs",
          title: "Sale day incident log",
          content:
            "```log\n20:00 180,000 events/s; 24 Kafka partitions; stream job lag reaches 40 minutes; one partition holds 18 percent of traffic (a load-testing bot account).\n20:25 the job restarts after an out-of-memory error and re-emits the last 10 minutes to the warehouse.\n21:10 the events table has 1.4 million small files; dashboard queries take 90 s.\n23:00 the nightly session job fails on one malformed event, and the 06:00 table is late.\n```",
          caption:
            "Hot keys, replays, small files, and one bad record all surfaced on the same night."
        },
        hints: [
          "Think about how events are keyed onto partitions and what one very hot key does to a single consumer.",
          "A restart that re-emits data must not double count; think about checkpoints and idempotent writes.",
          "Small files and one bad record are both design problems; decide where compaction and quarantine happen."
        ],
        referenceAnswer: {
          summary:
            "Collectors to Kafka to a checkpointed stream job with idempotent micro-batch merges, scheduled compaction, and batch session jobs that quarantine bad records, with hot keys spread and lag-driven scaling.",
          explanation:
            "Stateless collectors behind a load balancer validate events and write to Kafka; when Kafka is unavailable they buffer briefly and return 503 with retry-after, and clients retry with the same event_id. Kafka has enough partitions for the peak (for example 96, about 2,000 events per second each), keyed by user ID, with known bot and test accounts filtered or their keys salted so one key cannot own a partition; consumers scale on lag, not CPU. A Spark Structured Streaming or Flink job with checkpoints validates, enriches, and writes five-minute micro-batches to an Iceberg or Delta table with a MERGE on event_id, so a restart that replays recent batches writes each event once. Compaction runs hourly on recent partitions to merge small files towards about 256 MB. Batch jobs orchestrated by Airflow or Dagster build hourly funnels and the daily sessions table from cleaned events; they read by event date, reprocess the last three days for late data, and route malformed records to a quarantine table instead of failing the run. Dashboards read aggregate tables, not raw events. Failure isolation: stream and batch paths are separate, a bad record fails one row rather than one job, and Kafka keeps seven days so any stage can be replayed."
        },
        rubric: [
          {
            criterion:
              "Separates collectors, Kafka, stream processing, batch models, and serving tables with clear ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Serves dashboards from aggregate tables and handles small-file and concurrent-write contention with compaction.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Scales consumers on lag and has collectors apply backpressure instead of dropping events.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Sizes partitions for the peak and stops one hot key from overloading a single consumer.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Uses checkpoints, idempotent merges, quarantine, and replay so restarts and bad records neither corrupt nor block data.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Adding consumers without adding partitions, so the extra consumers sit idle while one partition lags.",
          "Appending each micro-batch without a merge key, so every restart double counts the replayed window.",
          "Letting one malformed event fail the whole nightly job instead of quarantining it."
        ],
        interviewerFollowUps: [
          "The warehouse is down for two hours. Where do events wait, and how does the pipeline catch up without overwhelming it?"
        ],
        transferConnection:
          "Idempotent sinks, lag-based scaling, and quarantine tables apply to every streaming and batch pipeline."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide how to measure, protect, pay for, and migrate to the new pipeline without breaking dashboards.",
        dependency:
          "The migration is judged against the freshness and completeness targets from the first stage.",
        topicKeys: ["data-quality", "warehouse-modeling"],
        prompt:
          "Decide whether this migration can go ahead. Define how you measure freshness and correctness, how personal data and deletion requests are handled, how you bring cost down, how you migrate and backfill without breaking dashboards, and what you would change in the plan.",
        artifact: {
          key: "clickstream-migration-plan",
          kind: "config",
          title: "Proposed migration plan",
          content:
            "Plan: move dashboards from the old JSON table to the new cleaned events model next Monday and delete the old table the same day.\nData quality: none beyond job success.\nIP addresses and emails are stored in plain text in every table, and 40 analysts have access.\nThe warehouse bill is three times the budget because dashboards scan raw JSON.\nDeletion requests are handled by hand once a quarter.",
          caption: "A green job run is not evidence that the numbers are right."
        },
        hints: [
          "A successful job says nothing about whether the numbers are right; decide which checks prove it.",
          "Run old and new side by side and compare key metrics before anything is deleted.",
          "Personal data needs minimisation, access control, and a deletion process that reaches every copy."
        ],
        referenceAnswer: {
          summary:
            "Do not cut over on Monday: add freshness and quality checks, run old and new in parallel with metric reconciliation, protect and delete personal data properly, and cut cost by querying modelled tables.",
          explanation:
            "Block the cutover. Add freshness SLOs per table (funnels within 15 minutes at p95, sessions by 06:00) and quality checks on every run: row counts against collector counts, duplicate rate, null and type checks on key fields, and funnel ratios within expected ranges, each alerting the owning team. Backfill the new model from raw history, run old and new in parallel for two weeks, and compare daily events, sessions, and funnel conversion per platform; move dashboards one at a time and keep the old table read-only for 30 days as a rollback. Privacy: hash or truncate IP addresses at ingestion, drop emails from events, restrict raw tables to the data team, and process deletion requests within the policy's deadline with a job that removes the user's rows from raw, cleaned, and derived tables and rewrites the affected files. Cost: dashboards read aggregates, scanning raw JSON is blocked, tables are partitioned and clustered, raw data moves to cheaper storage after 90 days, and each team sees its query spend. The trade-off to state: 15-minute provisional numbers help operations, but finance and weekly reporting should use the restated daily tables."
        },
        rubric: [
          {
            criterion:
              "Defines freshness SLOs and data quality checks with owners, not just job success.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Minimises personal data, restricts access, and deletes users from every copy.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Cuts warehouse cost with aggregates, partition pruning, and storage tiers.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains provisional versus restated numbers and who should use which.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Backfills, runs in parallel with reconciliation, and keeps a rollback before deleting the old table.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Treating a green job run as proof that the data is correct.",
          "Deleting the old table on cutover day, so a wrong number can be neither compared nor rolled back.",
          "Applying deletion requests to the cleaned table only, while raw copies and derived tables keep the data."
        ],
        interviewerFollowUps: [
          "Parallel runs show 2 percent fewer sessions in the new model. How do you decide which one is right?"
        ],
        transferConnection:
          "Parallel runs with reconciliation, and quality checks as release gates, apply to every data migration."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "cdc-lakehouse-replication",
    title: "Change data capture into a lakehouse",
    premise:
      "Replicate the orders, payments, and customers tables from a production PostgreSQL database into a lakehouse so analytics and finance can query data at most 10 minutes behind, without slowing the production database.",
    candidateRole:
      "You own replication from the source database to lakehouse tables: the capture method, the change event contract, table layout, upserts and deletes, schema changes, monitoring, and recovery.",
    functionalRequirements: [
      "Replicate inserts, updates, and deletes from 40 source tables into lakehouse tables that match the source within 10 minutes.",
      "Keep a history of changes for orders and payments so analysts can see an order's state at any point in time."
    ],
    nonGoals: [
      "The first release will not write back into production, build reverse ETL, or replace the finance ledger."
    ],
    constraints: [
      "The production database runs at 70 percent CPU at peak, and the DBA team will not accept full-table exports during business hours.",
      "Customers can ask for their data to be deleted, and deletions must reach the lakehouse within 30 days."
    ],
    scaleProfile: [
      "The largest table, order_items, has 4 billion rows (1.6 TB); the peak change rate across all tables is 25,000 row changes per second.",
      "Updates are 60 percent of changes; during a flash sale one product's inventory row receives 3,000 updates per second."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "change-data-capture",
    secondaryTopicKeys: ["lakehouse-tables", "schema-evolution", "data-quality"],
    targetKeywords: [
      "data engineering",
      "cdc",
      "debezium",
      "kafka",
      "postgres",
      "iceberg",
      "delta lake",
      "upsert"
    ],
    realismAnchors: [
      "A developer adds a column to orders during peak and the connector stops on the unexpected schema.",
      "The connector falls 6 hours behind and the database's write-ahead log grows until disk usage reaches 85 percent.",
      "A replayed hour of changes applies an older update after a newer one, and 1,200 orders show the wrong status."
    ],
    targetFitExplanation:
      "CDC into a lakehouse is a core data engineering design problem: it tests log-based capture, ordering, upserts and deletes, schema evolution, and safe recovery.",
    coverageExplanation:
      "Four connected decisions cover the capture method and targets, the change contract and tables, the pipeline under failure, and correctness, privacy, and upgrades across all sixteen dimensions.",
    questions: [
      stage({
        format: "mcq",
        objective:
          "Choose a capture approach and targets that meet freshness and delete requirements without loading the source database.",
        dependency:
          "The capture method and log-retention budget chosen here decide the change contract and recovery options that follow.",
        topicKeys: ["change-data-capture", "lakehouse-tables"],
        prompt: "Given the brief, which capture approach and targets fit the first release?",
        artifact: {
          key: "cdc-source-brief",
          kind: "metrics",
          title: "Source database brief",
          content:
            "40 tables, 6 TB in total; order_items has 4 billion rows.\nPeak 25,000 changes per second, 60 percent updates.\nProduction CPU is 70 percent at peak.\nOptions discussed: a nightly full export, a query every 5 minutes for rows with a newer updated_at, and log-based capture from the write-ahead log.\n12 of the 40 tables have no updated_at column, and carts and customers use hard deletes.",
          caption: "What each approach can see matters as much as what it costs the source."
        },
        choices: [
          "Export all 40 tables every night with full-table queries and accept data that is up to 24 hours old.",
          "Query each table every 5 minutes for rows with a newer updated_at, which is simple and needs no extra infrastructure.",
          "Take one consistent snapshot, then stream inserts, updates, and deletes from the write-ahead log, targeting 10-minute lag at p95 with a hard limit on retained log.",
          "Ask every application team to publish its own change events to Kafka and stop reading the database."
        ],
        correctChoiceIndex: 2,
        hints: [
          "Check which approaches can see hard deletes and tables without an updated_at column.",
          "Full exports and frequent polling both add query load to a database already at 70 percent CPU.",
          "Log-based capture needs a plan for the initial copy and for how much log the database keeps if capture falls behind."
        ],
        referenceAnswer: {
          summary:
            "Snapshot once, then stream changes from the write-ahead log with a 10-minute p95 lag target, deletes included, and a hard limit on how much log the source keeps.",
          explanation:
            "Nightly exports miss the 10-minute target and add heavy load; polling on updated_at misses hard deletes and the 12 tables without the column, and keeps scanning large tables; application-published events would take months and would never match the database exactly. Log-based capture (for example Debezium reading a PostgreSQL replication slot) sees every insert, update, and delete in commit order with little extra load. The initial copy is an incremental, chunked snapshot run off-peak or from a read replica, so it does not block the change stream. Targets: p95 lag under 10 minutes; daily row counts and checksums matching the source; and a log-retention limit, for example alert when the slot holds more than 50 GB and drop and re-snapshot before the source disk passes a safe level. Scale: 25,000 changes per second at roughly 1 KB per change event is about 25 MB/s, about 2 TB of change events a day before compaction."
        },
        rubric: [
          {
            criterion:
              "Explains why log-based capture meets freshness, delete, and source-load requirements when the other options do not.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion: "Sizes change volume and sets lag, correctness, and log-retention targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Polling on updated_at, which misses hard deletes and every table that does not have the column.",
          "Running full-table exports against a production database that is already at 70 percent CPU.",
          "Starting log-based capture with no limit on how much write-ahead log the source keeps when capture falls behind."
        ],
        interviewerFollowUps: [
          "The DBA asks what happens to production if your pipeline is down for a whole weekend. What do you tell them?"
        ],
        transferConnection:
          "Choosing a capture method by what it can observe and what it costs the source applies to every replication design."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide on a change contract and table design that apply updates and deletes correctly and serve analysts efficiently.",
        dependency:
          "The log position carried on each change is what the pipeline uses to make replays and restarts safe.",
        topicKeys: ["change-data-capture", "lakehouse-tables"],
        prompt:
          "Decide whether this table design can go ahead. Specify the change event contract, how current and historical tables are modelled, how changes are ordered and applied, how deletes are handled, and how the tables are partitioned.",
        artifact: {
          key: "cdc-table-design-proposal",
          kind: "config",
          title: "Proposed lakehouse table design",
          content:
            "Each change event is written as a new row; analysts get the latest row per order with a window function.\n\n```sql\nCREATE TABLE orders_changes (\n  order_id     BIGINT,\n  status       STRING,\n  amount       DECIMAL(12, 2),\n  processed_at TIMESTAMP   -- the consumer's processing time, used for ordering\n)\nPARTITION BY BUCKET(10000, order_id);\n\n-- How analysts read current state\nSELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY processed_at DESC) AS rn\n  FROM orders_changes\n)\nWHERE rn = 1;\n```\n\nDeletes are ignored so that history is not lost. customers is replicated with email, phone, and address in plain text.",
          caption: "Change order, deletes, and table layout each have a correctness cost here."
        },
        hints: [
          "Each change needs its position in the source log so the apply step can tell which change is newer.",
          "Analysts need a current table and, for some tables, a history table; they are written differently.",
          "Ignoring deletes breaks both correctness and the deletion policy."
        ],
        referenceAnswer: {
          summary:
            "Carry the source log position on every change, MERGE into current-state tables by primary key applying only newer positions, keep history tables for orders and payments, apply deletes, and partition for query patterns.",
          explanation:
            "Each change event carries the table, primary key, operation (insert, update, delete), before and after images, source commit time, transaction ID, and log sequence number (LSN). The apply job MERGEs micro-batches into a current-state Iceberg or Delta table per source table, keyed by primary key, and applies a change only if its LSN is greater than the stored one, so replays and out-of-order batches cannot overwrite newer data; within a batch, changes collapse to the last one per key by LSN. Deletes remove the row from the current table, or set a deleted flag where analysts need it. A separate history table for orders and payments stores each version with valid_from and valid_to (a type 2 slowly changing dimension), built from the same change stream. Partitioning follows queries: orders by order month, clustered by customer_id, rather than 10,000 hash partitions that create tiny files and slow merges. Customer contact fields are masked or tokenised, with clear values only in a restricted table. Consumers are told tables are consistent per table; cross-table reads that must agree use a common LSN watermark."
        },
        rubric: [
          {
            criterion:
              "Defines a change event with operation, keys, before and after images, and the source log position.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models current-state tables and history tables with valid_from and valid_to where history is needed.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Partitions and clusters tables for query patterns and merge efficiency rather than by key hash.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Applies changes by log position, collapses batches per key, and handles deletes and cross-table consistency.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Ordering changes by processing time, so a replayed older update overwrites a newer one.",
          "Ignoring deletes, which leaves removed rows in reports and breaks the deletion policy.",
          "Making analysts rebuild current state with a window function over every change in every query."
        ],
        interviewerFollowUps: [
          "An order and its payment are written in one source transaction. When can a report see the order but not the payment?"
        ],
        transferConnection:
          "Applying changes by source position with idempotent merges applies to any replication, including search indexes and caches."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Diagnose the lag incident and design a pipeline that handles hot rows, schema changes, long outages, and restarts safely.",
        dependency:
          "Recovery relies on the log-position merges from the previous stage to make re-snapshots and replays safe.",
        topicKeys: ["change-data-capture", "schema-evolution"],
        prompt:
          "Diagnose this incident. Explain the pipeline architecture you would use from the source database to the lakehouse, and how it would have handled the hot row, the schema change, the long outage, and the restart.",
        artifact: {
          key: "cdc-lag-incident-trace",
          kind: "trace",
          title: "Replication incident trace",
          content:
            "```log\n09:00 flash sale: one product's inventory row receives 3,000 updates per second. All tables share one Kafka topic with 1 partition; apply lag reaches 2 hours.\n10:30 a developer adds a gift_note column to orders; the connector stops on the schema change.\n11:00 to 16:00 the connector is down; the replication slot retains 310 GB of write-ahead log and the primary's disk reaches 85 percent.\n16:10 the team restarts the connector from the latest offset; 5 hours of changes are skipped.\n```",
          caption: "A hot row, a schema change, and a bad restart turned lag into data loss."
        },
        hints: [
          "One heavily updated row should not delay every other table; think about topic layout and collapsing updates.",
          "Schema changes need a path through the registry that additive changes can take automatically.",
          "Restarting from the latest offset loses data; decide when to resume and when to re-snapshot."
        ],
        referenceAnswer: {
          summary:
            "Use per-table topics partitioned by key, collapse hot-row updates in each batch, let additive schema changes flow through the registry, cap retained log with alerts, and recover by resuming or re-snapshotting, never skipping.",
          explanation:
            "Architecture: Debezium connectors on Kafka Connect read the replication slot and publish one topic per table, partitioned by primary key, with Avro or Protobuf schemas in a registry; apply jobs consume per table group and MERGE into lakehouse tables every few minutes; an orchestrator runs compaction, snapshot, and reconciliation jobs. Hot row: 3,000 updates per second to one key stay ordered on one partition, but the apply job collapses them to the latest LSN per key in each batch, so one merged row replaces thousands of updates, and large tables get more partitions so one hot table does not delay the rest. Schema change: additive changes (new nullable or defaulted columns) are published as a compatible schema version and the apply job adds the column; incompatible changes (drops, type changes) are routed to a quarantine topic and page the owning team without stopping other tables. Outage: alert when lag passes 15 minutes and when the slot's retained log passes 50 GB; if it approaches the disk limit, drop the slot to protect production and re-snapshot the affected tables. Restart: connectors resume from committed offsets, never from latest; if the slot was lost, an incremental snapshot of the affected tables plus LSN-based merges reconciles duplicates. One table's failure pauses only that table's apply job."
        },
        rubric: [
          {
            criterion:
              "Separates capture, per-table topics, apply jobs, and maintenance jobs with clear ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Collapses hot-row updates per batch and avoids write contention between merges and compaction.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Alerts on lag and retained log, and protects the source when capture falls behind.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Partitions topics by primary key per table so a hot table or row does not block the others.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Handles schema changes, restarts from committed offsets, and re-snapshots instead of skipping data.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Restarting a stopped connector from the latest offset and silently losing every change in between.",
          "Letting the replication slot grow without limit until production runs out of disk.",
          "Putting every table on one topic, so one hot table delays all the others."
        ],
        interviewerFollowUps: [
          "Re-snapshotting order_items will take 8 hours. What do analysts see during that time?"
        ],
        transferConnection:
          "Protecting the source, resuming from committed positions, and quarantining incompatible changes apply to every CDC pipeline."
      }),
      stage({
        format: "written",
        objective:
          "Prove correctness, protect customer data, control cost, and plan the source upgrade without breaking replication.",
        dependency:
          "Reconciliation checks the targets from the first stage, and the upgrade reuses the recovery path from the third.",
        topicKeys: ["data-quality", "lakehouse-tables"],
        prompt:
          "Using the report, describe how you would monitor correctness and freshness, protect personal data and apply deletions, control cost, and handle the source database upgrade without breaking the pipeline. Say whether finance should use these tables for month-end close.",
        artifact: {
          key: "cdc-reconciliation-report",
          kind: "metrics",
          title: "First week reconciliation report",
          content:
            "orders row count differs from the source by 0.04 percent; payments amounts differ by 12,400 in currency units; customers contains 380 rows the source has deleted.\nFinance asks to use lakehouse payments for month-end close. orders gains 11,000 files a day and storage cost is growing 18 percent a month.\nSecurity review: 25 analysts can read customer phone numbers.\nThe source moves to a new PostgreSQL major version next quarter.",
          caption: "Fresh data is not yet proven data."
        },
        hints: [
          "Reconciliation needs counts and checksums per table and per day, with an owner for every difference.",
          "Deleted customers still in the lakehouse are both a correctness bug and a privacy problem.",
          "A major-version upgrade usually means a new replication slot, so plan the switchover and the gap."
        ],
        referenceAnswer: {
          summary:
            "Reconcile counts and checksums daily with owners, fix deletes and mask personal data, compact and tier storage, rehearse the upgrade with a new slot and a checked switchover, and keep finance on the ledger until reconciliation holds.",
          explanation:
            "Monitor lag per table (p95 under 10 minutes), retained log, and apply failures, plus daily reconciliation: row counts and sums or hashes of key columns per day, compared with a read replica of the source. The 380 deleted customers point to missed deletes, so replay those tables' deletes and add a regression check. Payment differences go to a finance-owned investigation; until reconciliation is clean for a full month, finance keeps closing from the ledger and uses the lakehouse for analysis only. Privacy: mask or tokenise phone, email, and address, give clear values to a small approved group, and run deletion requests through a job that removes the customer from current and history tables and rewrites the files, with a check that the customer is gone within 30 days. Cost: compact files daily towards 256 MB, expire old table snapshots, cluster by common filters, and move history older than a year to cheaper storage. Upgrade: rehearse on staging; on the upgraded database create a new slot, then run an incremental snapshot or start from a known LSN, compare counts across the switch, and keep the old pipeline until the new one reconciles. The trade-off: 10-minute freshness suits analytics, but month-end close needs proven correctness more than speed."
        },
        rubric: [
          {
            criterion:
              "Monitors lag, retained log, and daily count and checksum reconciliation with owners for differences.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Masks personal data, restricts access, and applies deletions to current and history tables within the deadline.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Controls storage growth with compaction, snapshot expiry, clustering, and tiering.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains why month-end close should wait for proven reconciliation instead of using fresh data.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Plans the source upgrade with a new slot, a snapshot or known start position, and a checked switchover.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Reporting lag only and never checking that row counts and amounts match the source.",
          "Letting finance close the month from replicated tables before reconciliation has held for a full period.",
          "Upgrading the source database without planning how replication resumes on the new version."
        ],
        interviewerFollowUps: [
          "Reconciliation fails by 0.01 percent every night at midnight and clears by 01:00. What is probably happening?"
        ],
        transferConnection:
          "Daily reconciliation against the source and staged switchovers apply to any system that copies data between stores."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "daily-revenue-reporting",
    title: "Daily revenue reporting with late data",
    premise:
      "Design the batch pipeline that produces daily revenue, refunds, and net revenue by country and product for a subscription and marketplace business, correct enough for the CFO's morning report and for monthly financial close.",
    candidateRole:
      "You own the revenue models from source tables to the published report: definitions, orchestration, incremental builds, late data, backfills, quality checks, access, and cost.",
    functionalRequirements: [
      "Publish daily gross revenue, refunds, and net revenue by country, product, and currency, converted to the reporting currency, by 07:00 UTC.",
      "Restate past days when late orders, refunds, or exchange-rate corrections arrive, and keep a record of what was published each day."
    ],
    nonGoals: [
      "The first release will not build forecasting, a company-wide semantic layer, or real-time revenue."
    ],
    constraints: [
      "Payments from one provider arrive up to 3 days late, and refunds can arrive up to 120 days after the order.",
      "Once a month is closed, its numbers must not change without an approved adjustment."
    ],
    scaleProfile: [
      "12 million orders and 900,000 refunds a day across 60 countries and 25 currencies; order history is 8 billion rows.",
      "A full rebuild of the revenue models takes 9 hours; the daily incremental build must finish within 45 minutes."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "batch-orchestration",
    secondaryTopicKeys: ["metric-definitions", "late-data", "data-quality"],
    targetKeywords: [
      "data engineering",
      "airflow",
      "dbt",
      "batch",
      "incremental models",
      "backfill",
      "finance",
      "revenue"
    ],
    realismAnchors: [
      "A payment provider sends 3 days of files at once, and yesterday's revenue jumps 4 percent after the CFO has seen it.",
      "Exchange rates for one currency are loaded twice, and net revenue for Brazil doubles.",
      "A 90-day backfill runs at the same time as the daily build and both write the same partitions."
    ],
    targetFitExplanation:
      "Daily revenue with late data is a classic data engineering design question: it tests metric definitions, idempotent incremental builds, restatement, backfills, and trust in numbers.",
    coverageExplanation:
      "Four connected decisions cover definitions and targets, the model and its reruns, orchestration under failure, and a trustworthy launch across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn the CFO's request into written definitions, attribution dates, volume estimates, and provisional and final states.",
        dependency:
          "The attribution dates and late-data window set here decide which partitions every later build must rewrite.",
        topicKeys: ["metric-definitions", "late-data"],
        prompt:
          "Define the metrics, the date each one is attributed to, and what the report promises. Estimate daily data volume and the work an incremental build must do, and set targets for timeliness, completeness, and when numbers become final.",
        artifact: {
          key: "revenue-definition-brief",
          kind: "scenario",
          title: "Revenue reporting brief",
          content:
            "CFO: 'I want yesterday's revenue at 7am and it should never change.' Finance: net revenue is gross minus refunds minus chargebacks, but whether it is recognised on the order date or the payment date is undecided.\nLate data: provider B up to 3 days; refunds up to 120 days; exchange rates corrected up to 2 days later.\nVolume: 12 million orders and 900,000 refunds a day, 25 currencies.",
          caption: "'Never changes' and 'arrives late' cannot both be true without clear states."
        },
        hints: [
          "Decide which date revenue and refunds are attributed to; that choice decides which past days change.",
          "'Never changes' conflicts with late data; separate a provisional number from a final one.",
          "Size the incremental build by how many past days late data can touch, not only by one day of orders."
        ],
        referenceAnswer: {
          summary:
            "Agree written, versioned definitions and attribution dates with finance, publish provisional numbers at 07:00 that become final after a stated window, and size incremental builds around the late-data window.",
          explanation:
            "Definitions agreed and versioned with finance: gross revenue is captured payments by order date; refunds and chargebacks are attributed to the date they happen, so a late refund does not rewrite an old day (order-date refunds for cohort analysis become a separate, named metric); net revenue is gross minus refunds and chargebacks; currencies convert at the daily reference rate for the attribution date. The report promises provisional numbers by 07:00 UTC covering about 97 percent of payments, final numbers after three days once late provider files arrive, and a monthly close after which changes are approved adjustment rows, never edits. Volume: about 13 million rows a day, a few GB; an incremental build reprocesses the last four days of orders plus the days touched by new refunds or rate corrections, perhaps 50 to 60 million rows, well inside 45 minutes, while the full rebuild over 8 billion rows is kept for definition changes. Targets: 07:00 publication on 99 percent of days, completeness per provider checked before publishing, and a change log of every restated day with the size of the change."
        },
        rubric: [
          {
            criterion:
              "Defines net revenue, attribution dates, currency handling, and the provisional, final, and closed states of a number.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates daily volume and the rows an incremental build touches given late data, and sets timeliness and completeness targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Promising that yesterday's number will never change while payments arrive up to 3 days late.",
          "Leaving revenue attribution undecided, so different teams compute different totals from the same data.",
          "Rebuilding the whole 8 billion row history every night instead of only the days late data can touch."
        ],
        interviewerFollowUps: [
          "Finance switches refunds to order-date attribution. Which past days change, and how do you tell report readers?"
        ],
        transferConnection:
          "Separating provisional, final, and closed numbers applies to every metric that depends on late data."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair the revenue model so reruns, late data, and exchange rates cannot silently change or multiply totals.",
        dependency:
          "The declared grain and partition rebuilds defined here are what orchestration and backfills rely on.",
        topicKeys: ["metric-definitions", "batch-orchestration"],
        prompt:
          "Diagnose this model. Specify the source contracts it depends on, how facts, dimensions, and the output table are modelled, how the table is partitioned and rebuilt for a date, and how reruns and late data stay correct.",
        artifact: {
          key: "revenue-model-sql",
          kind: "config",
          title: "Current daily revenue model",
          content:
            "```sql\n-- daily_revenue: no key; a failed run is retried by Airflow and inserts the day again\nINSERT INTO daily_revenue\nSELECT order_date, country, SUM(amount * fx_rate) AS revenue\nFROM orders\nJOIN fx_rates USING (currency)\nWHERE order_date = CURRENT_DATE - 1\nGROUP BY order_date, country;\n\n-- fx_rates: one row per currency per load, no date column\nCREATE TABLE fx_rates (currency STRING, fx_rate DECIMAL(18, 8));\n-- A reload inserts the same currencies again.\n```\n\nRefunds are subtracted from the row for the day the job runs.",
          caption: "Each rerun, reload, or late refund changes the total in a different way."
        },
        hints: [
          "A rerun of the same day should replace that day's output, not add to it.",
          "Exchange rates need a date and a unique key, or a join can multiply rows.",
          "Model orders and refunds as separate facts at their own grain before aggregating."
        ],
        referenceAnswer: {
          summary:
            "Model payment and refund facts with a dated, unique exchange-rate dimension, rebuild output partitions by attribution date with overwrite or MERGE, and test uniqueness so reruns and late data are idempotent.",
          explanation:
            "Source contracts: orders and refunds with unique IDs, event timestamps, and load timestamps; provider files with a declared record count; an exchange-rate table with one row per currency per rate date, enforced unique, where corrections are new versions. Model: fct_payments at one row per payment, fct_refunds at one row per refund, dim_fx_rate keyed by (currency, rate_date), plus country and product dimensions. daily_revenue has the grain (attribution_date, country, product, currency) with gross, refunds, net, and net in the reporting currency, plus the definition version and build ID. It is partitioned by attribution date, and each run rebuilds a declared set of dates (yesterday plus any date that received late payments, refunds, or rate corrections) with INSERT OVERWRITE of those partitions or a MERGE on the grain, so retries give the same result. Before publishing, tests check the grain is unique, that there is exactly one rate per currency per date, and that totals reconcile to the facts. Late data is found by load timestamp: the job asks which attribution dates received rows since the last successful run and rebuilds only those."
        },
        rubric: [
          {
            criterion:
              "Defines source contracts: unique IDs, load timestamps, provider record counts, and a dated exchange-rate table.",
            points: 2,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models separate payment and refund facts, a dated exchange-rate dimension, and a declared output grain.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Partitions output by attribution date and rebuilds only the dates affected by new data.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Makes reruns idempotent with partition overwrite or MERGE on the grain, and tests uniqueness before publishing.",
            points: 3,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Using INSERT for a daily build, so every retry adds the same day again.",
          "Joining to an exchange-rate table with no date or unique key, which silently multiplies revenue.",
          "Subtracting refunds from whichever day the job runs instead of their attribution date."
        ],
        interviewerFollowUps: [
          "How does your job find which past dates received late rows since the last successful run?"
        ],
        transferConnection:
          "Declared grains, idempotent partition rebuilds, and uniqueness tests apply to every batch model."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Design orchestration and compute so backfills, skewed data, and missing inputs never corrupt or silently stale the report.",
        dependency:
          "Orchestration schedules the partition rebuilds from the previous stage and must never let two runs write one date.",
        topicKeys: ["batch-orchestration", "late-data"],
        prompt:
          "Diagnose this run. Describe the orchestration and compute architecture for the daily build, backfills, and publishing, and explain how it prevents each problem in the log.",
        artifact: {
          key: "revenue-backfill-run-log",
          kind: "logs",
          title: "Daily build run log",
          content:
            "```log\n02:00 the daily DAG starts and waits for provider B's file with a sensor that polls for 6 hours.\n02:10 an engineer starts a 90-day backfill from a laptop script against the same tables.\n03:40 both jobs write partition 2026-09-26; the daily result is overwritten by the backfill, which uses an older definition.\n05:30 the US holds 45 percent of rows; its task runs 3 hours while other countries finish in 10 minutes.\n06:55 the sensor times out, the DAG fails, and nothing is published.\n08:00 the CFO sees the previous day's report from cache, with no warning.\n```",
          caption: "Concurrent writers, skew, and a missing file ended in a silent stale report."
        },
        hints: [
          "Backfills and daily runs must not write the same partitions at the same time; decide how writes are coordinated.",
          "A country holding almost half the rows needs its work split by something finer than country.",
          "A missing input should produce a clearly labelled partial report or a clear delay, never silently stale numbers."
        ],
        referenceAnswer: {
          summary:
            "Run daily builds and backfills through one orchestrator with partition locks and versioned definitions, split skewed work, publish atomically, and label partial or late reports instead of failing silently.",
          explanation:
            "An orchestrator (Airflow or Dagster) owns every run, including backfills, which are parameterised runs of the same versioned models rather than laptop scripts. Writes are coordinated per partition: a run takes a lock on the dates it rebuilds, so a backfill and the daily job cannot write the same date, and backfills run at lower priority in their own compute pool. Each build writes to staging or a new table snapshot, runs tests, then swaps into the published table atomically, so readers never see half a build. Skew: aggregate by (country, product) or by hashed order-ID buckets and combine, instead of one task per country, so US data spreads across many tasks. Missing inputs: sensors have a deadline that fits the 07:00 target; at the deadline the DAG publishes the report with the missing provider flagged ('provider B missing, about 3 percent of revenue') and alerts the owner, and the late file triggers a restatement. The report shows its build time and completeness status, so a stale or partial report is always labelled. One provider's missing file or one failed task does not block the rest."
        },
        rubric: [
          {
            criterion:
              "Separates ingestion, versioned models, backfills, tests, and publishing inside one orchestrator.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Publishes through staging and atomic swaps and prevents concurrent writes to the same partitions.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Gives input sensors deadlines, runs backfills at lower priority, and queues work instead of competing for it.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Splits skewed work by finer keys so one country does not set the finish time.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Publishes labelled partial reports, isolates failures, and restates when late inputs arrive.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Running backfills from a laptop script outside the orchestrator, so nothing stops them overwriting the daily build.",
          "Splitting work by country when one country holds nearly half the rows.",
          "Letting a stale or partial report reach the CFO with no label."
        ],
        interviewerFollowUps: [
          "The backfill uses a new revenue definition. How do you keep old and new definitions from mixing in one report?"
        ],
        transferConnection:
          "Partition locks, atomic publishing, and labelled partial results apply to every scheduled data product."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide whether the new revenue models can launch, with reconciliation, access control, cost, and definition changes handled.",
        dependency:
          "The launch is judged on the definitions from the first stage and the idempotent builds from the second and third.",
        topicKeys: ["data-quality", "metric-definitions"],
        prompt:
          "Decide whether this launch can go ahead. Define how you monitor timeliness and correctness, who can see what, how you keep cost down, how definitions change safely, and what you would change in the plan.",
        artifact: {
          key: "revenue-launch-plan",
          kind: "config",
          title: "Proposed revenue launch",
          content:
            "Plan: launch the new revenue models to finance next week.\nTests: dbt not_null tests only.\nThe old spreadsheet process is switched off at launch.\nEveryone in the company can query the revenue tables, including revenue per customer.\nCompute: a full rebuild every night because incremental logic is 'risky'.\nDefinition changes are made directly in the production models.",
          caption: "Numbers the CFO relies on need stronger evidence than not-null tests."
        },
        hints: [
          "Correctness checks for revenue compare against independent totals, not only null checks.",
          "Revenue per customer is sensitive; think about who needs row-level access.",
          "A definition change is a migration: version it, compare it, and announce it."
        ],
        referenceAnswer: {
          summary:
            "Do not launch as planned: add reconciliation and anomaly checks, restrict row-level revenue, move to incremental builds with a weekly full comparison, version definitions, and run in parallel with the spreadsheet through a close.",
          explanation:
            "Delay the launch. Monitoring: publication time against the 07:00 SLO, input completeness per provider, reconciliation of daily totals to payment provider settlement reports and the ledger within a tolerance, and anomaly alerts when a country's net revenue moves more than an agreed percentage from its trend, each with an owner. Access: the aggregated report is broadly readable, but revenue per customer and payment details are restricted to finance and audited, using row-level or column-level policies. Cost: nightly incremental builds of affected dates take minutes instead of 9 hours, and a weekly full rebuild in a separate environment must match the incremental output, which also tests the incremental logic. Definitions: definitions live in version control with a version number; a change is built alongside the old one for past months, differences are reviewed with finance, and the switch date is shown in the report. Launch: run in parallel with the spreadsheet through one full monthly close, investigate every difference, then retire the spreadsheet. The trade-off: incremental builds are cheaper and faster, but they stay trustworthy only with the periodic full comparison."
        },
        rubric: [
          {
            criterion:
              "Monitors publication time, completeness, reconciliation to settlement data, and anomalies, each with an owner.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Restricts revenue per customer and payment details to finance, with audited access.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Replaces nightly full rebuilds with incremental builds and a periodic full comparison.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains the speed and cost versus trust trade-off of incremental builds.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Versions definitions, compares old and new, and runs in parallel through a monthly close before retiring the spreadsheet.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Relying on not-null tests while totals are never compared with settlement reports or the ledger.",
          "Switching off the old process at launch, so nobody can check the new numbers against it.",
          "Changing a revenue definition directly in production, which silently changes historical reports."
        ],
        interviewerFollowUps: [
          "Reconciliation to the ledger is off by 0.3 percent for one currency at 06:50. Do you publish at 07:00?"
        ],
        transferConnection:
          "Reconciliation against an independent source and versioned metric definitions apply to any business-critical metric."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "data-quality-lineage-platform",
    title: "Data quality and lineage platform",
    premise:
      "Design a platform that checks data quality across 1,200 warehouse tables, tracks lineage from sources to dashboards, and tells the right owner quickly when a table is late or wrong, before business users notice.",
    candidateRole:
      "You own the shared data quality and lineage service: check definitions, where checks run, lineage collection, alerting and ownership, incident impact, access, cost, and adoption across teams.",
    functionalRequirements: [
      "Let table owners define freshness, volume, schema, and value checks, run them after each load, and block or flag downstream builds when a critical check fails.",
      "Show column-level lineage from source tables to dashboards so an owner can see what a bad table affects and who to tell."
    ],
    nonGoals: [
      "The first release will not fix data automatically, replace the orchestrator, or build a full data catalogue with a business glossary."
    ],
    constraints: [
      "Tables are built by 30 teams using Airflow, dbt, and Spark, and not every team will change its jobs quickly.",
      "Some tables hold personal and financial data, and check results must not copy that data into alerts or logs."
    ],
    scaleProfile: [
      "1,200 tables, 300 of them critical; 9,000 loads a day; a typical critical table needs 8 to 15 checks.",
      "Owners want to hear about a critical failure within 10 minutes of the load finishing; today business users find 60 percent of issues first."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "data-quality",
    secondaryTopicKeys: ["data-lineage", "data-contracts", "alerting"],
    targetKeywords: [
      "data engineering",
      "data quality",
      "lineage",
      "openlineage",
      "dbt tests",
      "great expectations",
      "data contracts",
      "data observability"
    ],
    realismAnchors: [
      "A source team changes a status value from 'paid' to 'PAID', and 14 dashboards show zero revenue for a day.",
      "Volume checks fire 400 alerts in one night after a holiday, and the on-call engineer mutes the channel.",
      "A row-count check scans a 20 TB table after every load and doubles one team's warehouse bill."
    ],
    targetFitExplanation:
      "Data quality and lineage is a common senior data engineering design question: it tests contracts between teams, where checks run, lineage, alerting people trust, and adoption.",
    coverageExplanation:
      "Four connected decisions cover scope and targets, contracts and the platform's data model, check execution and alerting under failure, and a measured rollout across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn the incident review into first-release scope, the checks that matter most, targets, and a check volume estimate.",
        dependency:
          "The check volume and detection target set here decide where checks run and how cheap they must be.",
        topicKeys: ["data-quality", "alerting"],
        prompt:
          "Using the review, define what the first release must do and not do, which checks matter most, and measurable targets. Estimate how many checks run per day and what that means for where they run.",
        artifact: {
          key: "data-incident-review",
          kind: "metrics",
          title: "Last quarter's data incidents",
          content:
            "46 data incidents last quarter; 28 found first by business users; median time to detect 19 hours; median time to find the owner 3 hours.\nCauses: upstream schema or value changes 41 percent, late or missing loads 30 percent, duplicate loads 15 percent, logic bugs 14 percent.\n300 critical tables, 9,000 loads a day.\nLeadership asks for 'zero bad data'.",
          caption: "The causes say which checks pay off first."
        },
        hints: [
          "Start from the causes in the review: most incidents come from upstream changes and late loads.",
          "'Zero bad data' cannot be measured; time to detect and who finds issues first can.",
          "Multiply loads by checks per load, then think about which checks would need full scans."
        ],
        referenceAnswer: {
          summary:
            "Cover critical tables with freshness, volume, schema, and key value checks first, target detection within 10 minutes with owners finding most issues first, and plan for about 50,000 check runs a day, so most checks must be cheap.",
          explanation:
            "First release: owners and on-call rotations for all 300 critical tables; freshness and volume checks on every critical table, which catch late, missing, and duplicate loads (about 45 percent of incidents); schema and allowed-value checks on key columns (about 41 percent); lineage to dashboards for impact; and alerts routed to owners. Automatic fixes and a full catalogue are out. Targets: critical failures detected within 10 minutes of the load; owners, not business users, find at least 80 percent of issues first; median time to reach an owner under 5 minutes; and alert precision high enough that fewer than one in five alerts is dismissed as noise. Scale: 9,000 loads a day at about 5 checks each is roughly 45,000 to 50,000 check runs a day, more than 30 a minute, so most checks must read table metadata or only the newly loaded partition, and heavier statistical checks run only on critical tables."
        },
        rubric: [
          {
            criterion:
              "Prioritises checks and scope from the incident causes and turns 'zero bad data' into detection and ownership targets.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates daily check runs and explains why most checks must be incremental or metadata-based.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Trying to add every kind of check to all 1,200 tables at once instead of starting with critical tables and the main causes.",
          "Setting 'zero bad data' as the goal, which can be neither measured nor achieved.",
          "Assuming checks are free and running full-table scans after every load."
        ],
        interviewerFollowUps: [
          "Which one check would you add first to every critical table, and why?"
        ],
        transferConnection:
          "Choosing checks from incident history and measuring time to detect applies to any monitoring system."
      }),
      stage({
        format: "written",
        objective:
          "Design data contracts and the platform's own data model for checks, lineage, owners, and consumers.",
        dependency:
          "Owners, consumers, and lineage stored here are what alert routing and impact analysis use later.",
        topicKeys: ["data-contracts", "data-lineage"],
        prompt:
          "Design the contract and data model for the platform. Specify how a producer declares a table's contract, how check results and lineage are stored, how consumers and owners are linked, and how contract changes are introduced without breaking consumers.",
        artifact: {
          key: "data-contract-example",
          kind: "config",
          title: "Today's contract for orders_clean",
          content:
            "The only contract for orders_clean is a wiki page:\n\n```text\norders_clean\n- status is a string\n- amount is a number\n- loaded daily\n```\n\nChecks live in 5 tools with different result formats. Lineage is a hand-drawn diagram last updated in March. The payments team renames columns in its source table without telling anyone.",
          caption: "A contract nobody checks is only a description."
        },
        hints: [
          "A contract should be a versioned file next to the code that builds the table, checked in CI.",
          "Store check results and lineage as events in one common format so any tool can report them.",
          "Breaking changes need a version, a notice period, and a list of affected consumers from lineage."
        ],
        referenceAnswer: {
          summary:
            "Put versioned contracts in the producer's repository and check them in CI, store check results and lineage as standard events in one store, link tables to owners and consumers, and roll out breaking changes with versions and notice.",
          explanation:
            "A contract is a YAML file in the producing team's repository: table name, owner team and on-call, schema with types and nullability, allowed values for key columns (status in a fixed set), freshness and volume expectations, sensitivity classification per column, and a version. CI fails a change that breaks the contract (a rename, a type change, a new status value) unless the version is bumped. Every tool reports through one API or OpenLineage-style events: a check run records table, partition, check, status, measured value, threshold, run ID, and time, and never sample rows of sensitive data. Lineage is collected automatically from orchestrator runs, dbt manifests, and query logs as run events with inputs and outputs, down to columns where the tool supports it, and stored as a graph of datasets, jobs, and columns with timestamps. A catalogue record links each dataset to its owner, on-call, criticality, and consumers (dashboards, models, teams). Breaking changes: the producer publishes the new version alongside the old one, as a new column or a versioned view, for an agreed notice period; lineage lists the consumers to notify; the old version is removed only after they move. Each check result is tied to the exact run and partition it tested."
        },
        rubric: [
          {
            criterion:
              "Defines versioned contracts checked in CI and one common event format for check results and lineage.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models datasets, jobs, columns, checks, runs, owners, and consumers as linked records.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Stores check results and lineage for fast owner and impact queries without copying sensitive rows.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Ties results to exact runs and partitions and introduces breaking changes with versions and notice.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Keeping contracts on a wiki page that no build ever checks.",
          "Drawing lineage by hand, so it is wrong the first time a pipeline changes.",
          "Copying sample rows with personal data into check results and alerts."
        ],
        interviewerFollowUps: [
          "The payments team refuses to adopt contracts. What can the platform still do for their consumers?"
        ],
        transferConnection:
          "Versioned, CI-checked contracts between producers and consumers apply to APIs and events as much as to tables."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Diagnose the alert storm and design where checks run and how alerts flow so real failures are caught and outages stay contained.",
        dependency:
          "Alert routing and grouping use the owners and lineage modelled in the previous stage.",
        topicKeys: ["data-quality", "alerting"],
        prompt:
          "Diagnose this night. Describe where checks run and how results flow to alerts, and explain how your design prevents the alert storm, the missed failure, the expensive checks, and the outage.",
        artifact: {
          key: "alert-storm-log",
          kind: "logs",
          title: "Night after a holiday",
          content:
            "```log\n00:00 volume checks on 380 tables fire: row counts fell 60 percent against fixed thresholds.\n00:05 400 alerts land in one shared channel; the on-call engineer mutes it.\n04:10 a real failure: orders_clean is loaded twice, and nobody notices.\nEvery hour: the row-count check on events (20 TB) runs a full COUNT(*) after each of 24 loads.\nAll night: checks run inside each team's DAG; when the quality service is down, 60 DAGs fail.\n```",
          caption: "Noise hid the one alert that mattered."
        },
        hints: [
          "Thresholds should learn from each table's own history, including weekdays and holidays.",
          "Alerts should reach the owner of the failing table and be grouped when one upstream failure causes many downstream ones.",
          "The quality service being down should not stop pipelines; decide which checks block and which only report."
        ],
        referenceAnswer: {
          summary:
            "Run cheap partition-level checks with seasonal thresholds, route and group alerts by owner and lineage, keep blocking checks few and local, and let the platform fail open for non-critical checks.",
          explanation:
            "Checks run in two places. Blocking checks for critical tables (schema, key uniqueness, allowed values) run in the producer's pipeline right after the load and before downstream builds, using a small library that evaluates them locally. Non-blocking monitors (freshness, volume, distributions) run in the platform's own scheduler, triggered by load-completion events. Volume and distribution thresholds are learned per table from recent history with weekday and holiday seasonality, so a holiday drop is expected, and new tables start in a learning period. Checks read table-format statistics or only the new partition, so the 20 TB table is never fully scanned, and expensive checks are sampled or run daily. Alerts go to the owning team's on-call by criticality; when one upstream table fails, lineage groups the downstream failures into one incident naming the root table. Each alert states what failed, measured versus expected values, affected dashboards, and a runbook link, never sensitive rows. When the service is down, the library buffers results and non-critical checks fail open, so an outage delays reporting, not data. A blocking uniqueness check on orders_clean's key catches the duplicate load."
        },
        rubric: [
          {
            criterion:
              "Separates in-pipeline blocking checks, platform-scheduled monitors, result storage, and alert routing.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Uses table statistics and partition-level queries instead of repeated full scans.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Triggers monitors from load events and buffers results when the platform is unavailable.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Groups alerts by upstream root cause and owner so one failure does not flood the channel.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Keeps blocking checks few and local and lets the platform fail open for non-critical checks.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Using fixed thresholds that fire on every holiday and weekend, which teaches people to ignore alerts.",
          "Sending every alert to one shared channel with no owner and no grouping.",
          "Making every pipeline depend on the quality service, so its outage stops data for everyone."
        ],
        interviewerFollowUps: [
          "An owner says a blocking check delayed an important report for a false alarm. How do you respond, and what changes?"
        ],
        transferConnection:
          "Owner-routed, grouped alerts with learned thresholds apply to any monitoring that people must trust."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide how to roll out the platform, measure its success, protect sensitive results, and share its cost.",
        dependency:
          "Success is measured against the detection and ownership targets from the first stage.",
        topicKeys: ["data-quality", "data-contracts"],
        prompt:
          "Decide whether this rollout can go ahead. Define how you measure the platform's success, how sensitive data is protected, how cost is controlled and shared, how teams adopt it, and what you would change.",
        artifact: {
          key: "platform-rollout-plan",
          kind: "config",
          title: "Proposed platform rollout",
          content:
            "Plan: make blocking checks mandatory on all 1,200 tables next month.\nCheck-result dashboards are visible to everyone, including failed-row samples from payroll tables.\nAll platform cost goes to one central budget.\nSuccess metric: the number of checks created.",
          caption: "Counting checks rewards noise, not fewer incidents."
        },
        hints: [
          "Counting checks rewards noise; measure incidents found first and time to detect.",
          "Failed-row samples from sensitive tables should not be visible to everyone.",
          "Mandatory blocking checks on every table at once will be resisted and will cause outages; decide the order."
        ],
        referenceAnswer: {
          summary:
            "Do not mandate everything next month: roll out by criticality, measure detection and issues found first, remove sensitive samples and restrict access, and show each team the cost of its checks.",
          explanation:
            "Change the plan. Measure success by the share of incidents found by owners first (target 80 percent), median time to detect for critical tables (under 10 minutes), median time to reach an owner, and alert precision; the number of checks is not a goal. Privacy: results show aggregates and thresholds only, with no row samples from tables classified as personal or financial; access to results follows access to the underlying table; and the platform's own logs are scrubbed. Cost: check compute is charged to the owning team with a monthly report, expensive checks need a reason, and metadata-based checks are the default. Adoption: start with the 300 critical tables and the teams with the most incidents, run new blocking checks in warning-only mode for two weeks, offer contract templates and CI checks as the easy path, and extend to other tables as reporting-only. The trade-off: blocking checks protect consumers but can delay reports on a false alarm, so each one needs an owner, a tested threshold, and a documented override. Review quarterly and retire checks that never fire or always fire."
        },
        rubric: [
          {
            criterion:
              "Measures success by issues found first, time to detect, and alert precision rather than check counts.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Removes sensitive row samples and ties access to check results to access to the table.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Charges check cost to teams and makes cheap metadata checks the default.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains the protection versus delay trade-off of blocking checks and how overrides work.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Rolls out by criticality with warning-only periods and templates instead of a mandate for all tables.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Measuring success by the number of checks created.",
          "Showing failed-row samples from payroll and payment tables to everyone.",
          "Mandating blocking checks on all tables at once, so false alarms stop reports across the company."
        ],
        interviewerFollowUps: [
          "After three months, business users still find 40 percent of issues first. Where do you look?"
        ],
        transferConnection:
          "Measuring outcomes instead of activity, and rolling out by risk, applies to any internal platform."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "realtime-fraud-feature-pipeline",
    title: "Real-time fraud feature pipeline",
    premise:
      "Design the streaming pipeline that computes card-payment features, such as spend and payment count per card over the last 10 minutes and 24 hours, and serves them to the fraud model within milliseconds of a payment, with the same values available for model training.",
    candidateRole:
      "You own the feature pipeline: the event contract, stream processing and windows, the online and offline feature stores, backfills, freshness and correctness monitoring, and privacy.",
    functionalRequirements: [
      "Compute rolling features per card, merchant, and device (count, sum, distinct merchants, time since last payment) and serve them to the scoring service at payment time.",
      "Produce the same features for historical payments so data scientists can train models on values that match what was served."
    ],
    nonGoals: [
      "The first release will not build the fraud model, the case-management tool, or chargeback dispute rules."
    ],
    constraints: [
      "Payment events can arrive up to 2 minutes out of order, and the gateway's retries create duplicates.",
      "Card numbers must never be stored in clear text; features are keyed by a card token."
    ],
    scaleProfile: [
      "Peak 40,000 payments per second; 300 million active card tokens; 60 features per payment.",
      "The scoring service allows 20 ms for the feature lookup at p99, and features must reflect payments up to 2 seconds old."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "stream-processing",
    secondaryTopicKeys: ["feature-store", "windowing", "data-quality"],
    targetKeywords: [
      "data engineering",
      "streaming",
      "flink",
      "kafka",
      "feature store",
      "fraud",
      "windowing",
      "redis"
    ],
    realismAnchors: [
      "A botnet sends 2,000 payments per second through one merchant, and that merchant's feature key becomes a hotspot.",
      "The stream job restarts and card counts are double counted for the replayed 3 minutes.",
      "Training data computed in the warehouse shows 10-minute counts 12 percent lower than the values served online."
    ],
    targetFitExplanation:
      "A real-time feature pipeline is a classic streaming data engineering question: it tests event time, windows, exactly-once state, online and offline consistency, and hot keys.",
    coverageExplanation:
      "Four connected decisions cover the processing model and budgets, the event and feature contracts, the streaming pipeline under failure, and a safe model switch across all sixteen dimensions.",
    questions: [
      stage({
        format: "mcq",
        objective:
          "Choose a processing approach that meets the lookup latency, freshness, and training-consistency requirements.",
        dependency:
          "The processing model and state size chosen here shape the feature contract, stores, and recovery that follow.",
        topicKeys: ["stream-processing", "feature-store"],
        prompt:
          "Given the brief, which approach meets the latency, freshness, and training requirements?",
        artifact: {
          key: "fraud-feature-brief",
          kind: "metrics",
          title: "Fraud feature brief",
          content:
            "Peak 40,000 payments per second; 300 million card tokens; 60 features; feature lookup budget 20 ms at p99; freshness 2 seconds.\nEvents arrive up to 2 minutes out of order; gateway retries cause about 0.3 percent duplicates.\nData scientists train on last year's payments and need the feature values the model would have seen at the time.",
          caption:
            "Latency, freshness, and training consistency each rule out a different approach."
        },
        choices: [
          "Query the payments database with aggregate SQL at scoring time, so features are always exact.",
          "Compute features in a nightly batch job and load them into a cache for scoring the next day.",
          "Compute features in a stream processor with event-time windows, deduplicate by payment ID, write them to a low-latency key-value store, and build training data from the same definitions.",
          "Keep all counters in the memory of each scoring service instance and rebuild them on restart."
        ],
        correctChoiceIndex: 2,
        hints: [
          "Compare each option with the 20 ms lookup and 2-second freshness limits.",
          "Training data must use the same feature values the model saw online, or the model learns the wrong thing.",
          "Out-of-order and duplicate events affect every option; decide which one handles them by design."
        ],
        referenceAnswer: {
          summary:
            "Stream features with event-time windows and deduplication into a key-value store for fast lookups, and generate training data from the same definitions with point-in-time correctness.",
          explanation:
            "Aggregate SQL over payments at 40,000 per second cannot meet 20 ms and would overload the database; a nightly batch misses the 2-second freshness; per-instance memory loses state on restart and splits counts across instances. A stream processor such as Flink, keyed by card token, merchant, and device, computes sliding or bucketed windows by event time with 2 minutes of allowed lateness, deduplicates on payment ID, and writes feature values to a key-value store such as Redis or a managed online store. Scale: 40,000 payments per second each updating about three entities is roughly 120,000 key updates per second; 300 million cards with 60 features at about 8 bytes each, plus overhead, is on the order of 200 to 300 GB of online state, so the store is partitioned and replicated. The same feature definitions run over historical events to build training data as of each payment's time, and served values are logged so online and offline values can be compared."
        },
        rubric: [
          {
            criterion:
              "Explains why streaming with event-time windows meets latency, freshness, and training needs when the other options do not.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates key updates per second and online state size, and sets freshness and lookup targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Computing aggregates in the payments database at scoring time, which cannot meet 20 ms at 40,000 payments per second.",
          "Building training features with different code from the online features, so the model trains on values it never sees.",
          "Ignoring out-of-order and duplicate payments, which make rolling counts wrong in both directions."
        ],
        interviewerFollowUps: ["If the lookup budget dropped to 5 ms, what would you change?"],
        transferConnection:
          "Matching the processing model to latency and freshness budgets applies to every real-time data product."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair the event contract and feature data model so features are private, time-correct, and identical online and offline.",
        dependency:
          "The payment ID, event time, and feature versions defined here make restarts and training joins correct later.",
        topicKeys: ["feature-store", "windowing"],
        prompt:
          "Diagnose this contract and data model. Specify the payment event contract, how features are keyed and stored online and offline, how windows use time, and how training data stays consistent with served values.",
        artifact: {
          key: "fraud-feature-schema-draft",
          kind: "config",
          title: "Proposed feature contract",
          content:
            '```json\n// Payment event: no payment ID; ts is the gateway\'s processing time\n{ "card_number": "4111111111111111", "amount": 2499, "currency": "INR", "merchant": "M-4410", "ts": "2026-09-27T14:00:02.184Z" }\n```\n\n```json\n// Online store: key = card_number; all 60 features rewritten on every payment\n{ "4111111111111111": { "count_10m": 3, "sum_10m": 7497, "count_24h": 11, "distinct_merchants_24h": 4 } }\n```\n\n```sql\n-- Training table: rebuilt nightly as the latest value per card, joined to old payments\nSELECT p.*, f.*\nFROM payments p\nJOIN latest_card_features f ON f.card_number = p.card_number;\n```\n\nWindows use processing time. Feature logic is written in Java for streaming and again in SQL for training.',
          caption: "Card numbers, processing time, and 'latest value' joins each break something."
        },
        hints: [
          "The event needs a unique ID and an event time from the payment itself.",
          "Joining the latest value per card to old payments leaks future information into training data.",
          "One definition should produce both the online and the offline values."
        ],
        referenceAnswer: {
          summary:
            "Use tokenised, uniquely identified events with event time, key features by entity with versioned definitions, store per-feature values online and time-stamped values offline, and build training data with point-in-time joins from one definition.",
          explanation:
            "Event contract: payment_id (unique, from the gateway, stable across retries), card_token (never the card number), merchant_id, device_id, amount in minor units with currency, event_time from the authorisation, and ingestion time, versioned in a schema registry. Features are defined once (name, entity, window, aggregation, version) in a shared definition that generates both the streaming job and the batch job, or the batch path replays the streaming code over historical events. Online store: key (entity type, entity ID); the value holds each feature with its window end time and definition version, and updates write only the features that changed. Offline store: (entity, feature, value, valid_from) rows written by the same pipeline, partitioned by date. Training uses a point-in-time join: for each payment, the feature values as of just before its event time and never later, which removes the leak. Windows use event time with watermarks and 2 minutes of allowed lateness, and deduplication on payment_id happens before aggregation. Served values are logged with each scoring request so online and offline values can be compared continuously."
        },
        rubric: [
          {
            criterion:
              "Defines a tokenised payment event with a stable payment ID, event time, and a versioned schema.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models features by entity with versioned definitions and time-stamped offline values.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Keys the online store for single-lookup reads and partitions the offline store by date.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Uses event-time windows, deduplication, and point-in-time joins so training matches serving.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Keying features by the raw card number instead of a token.",
          "Joining the latest feature value to historical payments, which leaks future information into training.",
          "Writing the feature logic twice, in streaming code and in SQL, and letting the two drift apart."
        ],
        interviewerFollowUps: [
          "A feature changes from a 10-minute to a 15-minute window. How do the online store and training data move to the new version?"
        ],
        transferConnection:
          "Point-in-time correctness and one shared definition apply to any feature store or metrics layer."
      }),
      stage({
        format: "written",
        objective:
          "Design the streaming pipeline and contain the hot key, restart, store failover, and slow-lookup failures in the log.",
        dependency:
          "Recovery depends on the payment IDs and versioned feature values from the previous stage.",
        topicKeys: ["stream-processing", "feature-store"],
        prompt:
          "Sketch the pipeline architecture from payment events to the scoring lookup. Then use the log to explain how your design handles the hot merchant, the restart, the store failover, and slow feature lookups.",
        artifact: {
          key: "fraud-stream-incident-log",
          kind: "logs",
          title: "Fraud pipeline incident log",
          content:
            "```log\n14:00 a botnet sends 2,000 payments per second through merchant M-4410; the task owning that key runs at 100 percent and backpressure stalls all feature computation; card feature lag grows to 45 s.\n14:20 the job restarts from a checkpoint 3 minutes old; the counters written to Redis during those 3 minutes are incremented again.\n14:40 one Redis shard's primary fails over and 4 seconds of writes are lost. The scoring service times out waiting for features and approves payments by default.\n```",
          caption: "One hot merchant turned into stale, doubled, and missing features."
        },
        hints: [
          "A hot key can be pre-aggregated in sub-keys and combined, and merchant and card features need not share one pipeline.",
          "Writes to the online store must be idempotent, for example by writing the full window value with a version instead of incrementing.",
          "Decide what the scoring service does when features are missing or stale, and make it deliberate."
        ],
        referenceAnswer: {
          summary:
            "Separate per-entity jobs, split hot keys, checkpoint state and write versioned values idempotently, replicate the online store, and give scoring a deliberate fallback for missing or stale features.",
          explanation:
            "Payment events flow from the gateway to a Kafka topic partitioned by card token, with a copy keyed by merchant; separate Flink jobs, or operators in separate slots, compute card, merchant, and device features, so a merchant hotspot cannot stall card features. Hot keys: merchant aggregates are pre-aggregated across salted sub-keys and combined, and a detected hot key gets its own path. Window state is kept in checkpointed state (RocksDB) with exactly-once processing, and writes to the online store set the full current value with its window end time and a sequence number, so a replay after a restart rewrites the same or newer value instead of incrementing twice. The online store is replicated across zones; after a failover, the job re-emits current values for recently updated keys from its state. Lag is monitored per job, and features older than 2 seconds are marked stale. The scoring service looks features up with a 20 ms timeout; on a timeout or stale features it scores with a fallback model that uses request-only features and sends high-risk payments to step-up authentication instead of approving by default. Each entity job, the store, and scoring degrade separately."
        },
        rubric: [
          {
            criterion:
              "Separates ingestion, per-entity feature jobs, the online store, and the scoring lookup.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion: "Uses idempotent, versioned value writes and replicated online-store reads.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Monitors lag and backpressure per job and marks stale features instead of blocking scoring.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Splits hot merchant keys and isolates merchant features from card features.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Handles restarts with exactly-once state, recovers after store failover, and gives scoring a deliberate fallback.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Incrementing counters in the online store, so every replay after a restart double counts.",
          "Running all entity features in one job, so a hot merchant stalls card features.",
          "Approving payments by default whenever features are slow."
        ],
        interviewerFollowUps: [
          "The fallback model is 30 percent less accurate. How long can you run on it before you page someone?"
        ],
        transferConnection:
          "Idempotent value writes, hot-key splitting, and deliberate fallbacks apply to every low-latency streaming system."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide how to switch the fraud model to the new features safely, with monitoring, privacy, and cost handled.",
        dependency:
          "The switch is judged on the latency and freshness targets from the first stage and the online-offline logging from the second.",
        topicKeys: ["feature-store", "data-quality"],
        prompt:
          "Decide whether this launch can go ahead. Define what you monitor, how customer data is protected and retained, whether the cost is justified, how you switch the model to the new features safely, and what you would change.",
        artifact: {
          key: "fraud-feature-launch-plan",
          kind: "config",
          title: "Proposed feature launch",
          content:
            "Plan: switch the fraud model to the new streaming features for all traffic on Monday.\nValidation: features looked 'close' to the old batch ones on a sample of 100 cards.\nMonitoring: job uptime only.\nRaw payment events with card tokens and customer emails are kept forever for backfills.\nThe online store is sized for three times peak in three regions.",
          caption: "Changing a model's inputs changes the model."
        },
        hints: [
          "Compare served features with recomputed offline values continuously, not once on 100 cards.",
          "Backfills need events, but not emails, and not forever.",
          "Switching features changes model behaviour; treat it like a model release."
        ],
        referenceAnswer: {
          summary:
            "Do not switch all traffic on Monday: monitor freshness and online-offline skew, minimise and expire raw data, right-size the store, and shadow-score before a staged switch with rollback.",
          explanation:
            "Block the launch. Monitoring: feature freshness (p99 under 2 seconds), lookup latency (p99 under 20 ms), missing-feature rate, and online-offline skew, measured by recomputing a sample of served features offline every hour and alerting when they differ beyond an agreed tolerance, plus model signals such as approval and decline rates by merchant category. Privacy: events keep only card tokens and the fields features need; emails are removed; raw events are kept for the window the model needs (for example 13 months) and then deleted; access is restricted; and only the tokenisation service can map back to card numbers. Cost: three regions at three times peak is expensive; size for about 1.5 times peak with autoscaling, and use a warm standby region if the availability target allows, and drop features the model does not use. Rollout: run the new features in shadow, scoring every payment with both feature sets without acting on the new score, compare fraud caught and false declines on labelled outcomes for several weeks, then move traffic in stages (5, 25, 100 percent) with stop rules and an instant switch back. The trade-off: fresher features catch fast fraud, but can raise false declines if the model was trained on staler data, so retrain on the new features before the full switch."
        },
        rubric: [
          {
            criterion:
              "Monitors freshness, lookup latency, missing features, and online-offline skew continuously.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Minimises and expires raw payment data and keeps card numbers behind tokenisation.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Sizes the online store and regions to the availability target and drops unused features.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains how fresher features change model behaviour and why retraining is needed.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Shadow-scores, compares outcomes, and switches in stages with rollback.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Validating new features once on a small sample instead of monitoring online and offline values continuously.",
          "Keeping raw payment events with customer emails forever 'for backfills'.",
          "Switching the model's features for all traffic at once without shadow scoring."
        ],
        interviewerFollowUps: [
          "Shadow scoring shows the new features catch 8 percent more fraud but raise false declines by 3 percent. Do you ship?"
        ],
        transferConnection:
          "Shadow runs and continuous skew checks apply whenever a model's inputs change."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...DATA_REVIEW,
    key: "experiment-metrics-pipeline",
    title: "A/B test metrics pipeline",
    premise:
      "Design the pipeline that computes results for hundreds of product experiments every day: who was assigned to which variant, what they did afterwards, and each metric's difference with a confidence interval, so product teams can make launch decisions they trust.",
    candidateRole:
      "You own experiment data from assignment logs to the results page: assignment and exposure events, metric definitions, daily computation, statistical outputs, quality checks, access, cost, and changes to metric definitions.",
    functionalRequirements: [
      "Compute daily results for every running experiment: sample sizes per variant, each metric's mean or rate, the difference, and a confidence interval.",
      "Let teams define metrics once (for example conversion, revenue per user, retention) and reuse them across experiments."
    ],
    nonGoals: [
      "The first release will not build the assignment service, automatic launch decisions, or real-time results."
    ],
    constraints: [
      "Users can be assigned before they see the change, and only users exposed to the change should count.",
      "Revenue and user-level results are sensitive, and some experiments are confidential until launch."
    ],
    scaleProfile: [
      "400 experiments running at once; 80 million daily active users; 3 billion events a day; each experiment uses 5 to 20 metrics.",
      "Results must be ready by 09:00 each day; recomputing every experiment from its start takes about 6 hours of cluster time."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "experiment-metrics",
    secondaryTopicKeys: ["metric-definitions", "batch-orchestration", "data-quality"],
    targetKeywords: [
      "data engineering",
      "a/b testing",
      "experimentation",
      "metrics",
      "spark",
      "batch",
      "statistics",
      "data quality"
    ],
    realismAnchors: [
      "One variant gets 52 percent of users instead of 50 percent, and nobody notices for a week.",
      "A change to the definition of 'active user' shifts every experiment's retention numbers overnight.",
      "A logging bug drops iOS exposure events in one variant."
    ],
    targetFitExplanation:
      "An experiment metrics pipeline is a common data engineering design question at product companies: it tests event joins, metric definitions, incremental computation, and correctness checks that people act on.",
    coverageExplanation:
      "Four connected decisions cover scope and computation, exposure and metric contracts, the daily pipeline under failure, and safe definition changes across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn the request into first-release scope, a computation estimate, and targets for timeliness and consistent results.",
        dependency:
          "The per-user aggregation and running totals sized here shape the data model and daily pipeline that follow.",
        topicKeys: ["experiment-metrics", "metric-definitions"],
        prompt:
          "Define what the first release must deliver and what it will not, estimate the daily computation, and set targets for timeliness, correctness, and consistency of results.",
        artifact: {
          key: "experiment-scale-brief",
          kind: "metrics",
          title: "Experimentation brief",
          content:
            "400 experiments with about 10 metrics each; 80 million daily active users; 3 billion events a day (about 2.4 TB a day as compressed columnar data).\nAn average experiment exposes 4 million users and runs 14 days.\nProduct asks for 'results every morning, and every hour on launch day'.\nToday analysts write one-off SQL per experiment, and last month two analysts got different results for the same test.",
          caption: "Two different answers to one question is the real requirement here."
        },
        hints: [
          "Count the unit of work: experiments times metrics times days, and the users each touches.",
          "The biggest risk in the brief is two people getting different numbers; treat that as a requirement.",
          "Hourly results on launch day change the design; decide whether they belong in the first release."
        ],
        referenceAnswer: {
          summary:
            "Deliver shared metric definitions and daily results for every running experiment by 09:00, estimate about 4,000 experiment-metric results a day over per-user aggregates, and make one definition give one answer.",
          explanation:
            "First release: exposure-based analysis for all running experiments, a shared library of metric definitions, daily results with confidence intervals by 09:00, and automatic health checks; hourly results, automatic decisions, and new statistical methods such as sequential testing are out. Scale: 400 experiments at about 10 metrics each is about 4,000 results a day. Scanning 3 billion events per experiment would be wasteful, so events are aggregated once a day into a per-user, per-day metrics table (80 million users by a few dozen metric columns), and each experiment joins its exposed users to it: 400 experiments at 4 million users is about 1.6 billion user rows a day, which is manageable. Each day adds one day of per-user metrics, and cumulative results update from running totals (sums, sums of squares, counts) instead of recomputing 14 days. Targets: results by 09:00 on 99 percent of days; identical results for the same experiment, metric, and definition version no matter who runs them; and sample-ratio and completeness checks passing before results are shown."
        },
        rubric: [
          {
            criterion:
              "Scopes daily exposure-based results, shared definitions, and health checks, and leaves hourly results out with a reason.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates daily results and data volume, and uses per-user aggregates and running totals to bound computation.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Scanning all raw events separately for every experiment and metric each day.",
          "Treating 'two analysts got different numbers' as a people problem rather than a need for shared definitions.",
          "Adding hourly launch-day results to the first release without asking what decision they support."
        ],
        interviewerFollowUps: [
          "A team wants a metric that needs 28 days of history after exposure. How does that change the computation?"
        ],
        transferConnection:
          "Aggregating once into a per-entity daily table and reusing it applies to any system with many similar reports."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide on assignment, exposure, metric, and results data that make every result correct and reproducible.",
        dependency:
          "The exposure events and versioned definitions defined here are what the daily pipeline joins and checks.",
        topicKeys: ["experiment-metrics", "metric-definitions"],
        prompt:
          "Decide whether this data design can go ahead. Specify the assignment and exposure contracts, how metrics are defined and stored, how results are stored over time, and how joins and consistency are handled.",
        artifact: {
          key: "exposure-model-proposal",
          kind: "config",
          title: "Proposed experiment data model",
          content:
            "```sql\n-- Every assigned user, whether or not they saw the change;\n-- joined by user_id only, so logged-out users are dropped.\n-- The metric definition is copied into each experiment's SQL.\nSELECT a.variant, COUNT(DISTINCT e.user_id) AS converters\nFROM assignments a            -- sampled at 10 percent to save storage\nJOIN events e ON e.user_id = a.user_id\nWHERE a.experiment_id = 'exp_checkout_v2'\n  AND e.event_name = 'purchase'\nGROUP BY a.variant;\n\n-- Results: one row per experiment, overwritten every morning with no history\nINSERT OVERWRITE experiment_results SELECT ...;\n```",
          caption:
            "Diluted, sampled, and unrepeatable results would each mislead a launch decision."
        },
        hints: [
          "Counting users who never saw the change dilutes the effect; exposure needs its own event.",
          "A sampled assignment log cannot give correct sample sizes.",
          "Results should record the definition version and keep history so any number can be explained later."
        ],
        referenceAnswer: {
          summary:
            "Log complete assignments and first exposures with a declared analysis unit, define metrics once with versions, store per-user daily metrics and versioned daily results, and compute each day from one input snapshot.",
          explanation:
            "Contracts: assignment events (experiment_id, variant, unit ID, assignment time) are complete and never sampled; exposure events record the first time a unit actually saw the experiment's surface, with the same unit ID. Each experiment declares its analysis unit (user ID, or a device or anonymous ID for logged-out traffic, with a mapping table when users log in). Metrics are defined once in a versioned library: name, source events, aggregation (count, sum, rate, ratio), time window after exposure, and owner; experiments reference metrics by name and version, never by copied SQL. Storage: a per-unit, per-day metrics table partitioned by date; an exposures table (experiment, variant, unit, first exposure time) partitioned by experiment; and a results table keyed by (experiment, metric, definition version, result date) that keeps every day's result instead of overwriting, so any past number can be reproduced. Only events after a unit's first exposure count. Each day's results are computed from one fixed snapshot of the inputs, recorded with the run ID, so all metrics for an experiment on a day come from the same data."
        },
        rubric: [
          {
            criterion:
              "Defines complete assignment and first-exposure events with a declared analysis unit and identity mapping.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models versioned metric definitions, per-unit daily metrics, exposures, and historical results.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Partitions per-unit metrics by date and exposures by experiment for efficient daily joins.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Counts only post-exposure events and computes each day's results from one input snapshot.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Analysing all assigned users, including those who never saw the change, which hides real effects.",
          "Sampling the assignment log, which makes sample sizes and ratios wrong.",
          "Overwriting results every day, so nobody can explain why a number changed."
        ],
        interviewerFollowUps: [
          "Logged-out users are 30 percent of traffic for one experiment. How do you count them?"
        ],
        transferConnection:
          "Versioned definitions and reproducible, snapshot-based results apply to any metric people use to make decisions."
      }),
      stage({
        format: "written",
        objective:
          "Design the daily pipeline and contain the skewed join, exposure bug, cluster contention, and failing experiment in the log.",
        dependency:
          "The pipeline joins the exposures and per-user metrics from the previous stage and checks them before publishing.",
        topicKeys: ["batch-orchestration", "experiment-metrics"],
        prompt:
          "Sketch the daily pipeline from events to the results page. Then use the log to explain how your design handles the skewed join, the exposure bug, the shared-cluster contention, and the failing experiment.",
        artifact: {
          key: "experiment-pipeline-run-log",
          kind: "logs",
          title: "Daily results run log",
          content:
            "```log\n01:00 the per-user metrics job starts; the 'home page' experiment family covers 60 percent of users, and its join task runs 4 hours while the others finish in 20 minutes.\n03:30 iOS exposure events for variant B are 70 percent lower than for variant A.\n05:00 an analyst's ad-hoc query on the raw events table slows the shared cluster.\n08:40 one experiment's results fail with a divide-by-zero, the whole results job fails, and no experiment publishes.\n```",
          caption: "A skewed join, a logging bug, and one failure put every result at risk."
        },
        hints: [
          "Skewed joins can be split by salting the user key or by bucketing both sides on it.",
          "A sample-ratio check should stop results from being shown when exposure counts are wrong.",
          "One experiment's failure should not stop the others from publishing."
        ],
        referenceAnswer: {
          summary:
            "Build per-user metrics once, join exposures with skew handling, run sample-ratio and completeness checks before publishing, isolate compute, and compute and publish each experiment independently.",
          explanation:
            "Pipeline: events land in partitioned tables; a daily job builds per-user metrics for the previous day; exposures are deduplicated to the first exposure per unit; per-experiment jobs join exposures to per-user metrics, update running totals, and compute differences and confidence intervals; results are written with the definition version and run ID and published to the results page. Skew: large experiment families are joined with a salted key or with tables bucketed on user ID, so the join spreads across many tasks. Before publishing each experiment: a sample-ratio mismatch test comparing exposed counts with the planned split (a chi-squared test with a strict threshold), exposure completeness by platform and variant, and null or zero rates per metric; a failure hides that experiment's results behind a clear warning and alerts its owner. The iOS exposure bug fails the sample-ratio check for that experiment. Compute: scheduled pipelines run in their own pool with guaranteed capacity, analysts query curated tables in a separate pool with limits, and raw-event scans are restricted. Each experiment is its own task with its own failure handling, so a divide-by-zero marks one experiment failed and the rest publish by 09:00."
        },
        rubric: [
          {
            criterion:
              "Separates per-user metric builds, exposure deduplication, per-experiment computation, checks, and publishing.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Reuses per-user daily metrics and running totals and separates analyst queries from scheduled compute.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Orders the daily jobs with deadlines and queues experiment tasks so late work does not block publishing.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Handles the skewed experiment family with salting or bucketing.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Blocks results on sample-ratio and completeness failures and isolates each experiment's failure.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Showing results without a sample-ratio check, so an exposure logging bug looks like a real effect.",
          "Running every experiment in one job, so one failing experiment stops all results.",
          "Letting ad-hoc analyst queries share compute with the daily pipeline."
        ],
        interviewerFollowUps: [
          "The sample-ratio check fails for an experiment that must decide today. What do you tell the team?"
        ],
        transferConnection:
          "Health checks that block results, and per-unit failure isolation, apply to any pipeline that publishes many independent reports."
      }),
      stage({
        format: "written",
        objective:
          "Monitor the pipeline, protect sensitive results, control cost, and roll out a new metric definition without confusing running experiments.",
        dependency:
          "The definition change uses the versioned metric library and result history from the second stage.",
        topicKeys: ["metric-definitions", "data-quality"],
        prompt:
          "Describe how you would monitor the pipeline and the quality of its results, protect confidential and sensitive results, control cost, and roll out the new 'active user' definition without confusing teams in the middle of running experiments.",
        artifact: {
          key: "metric-definition-change-request",
          kind: "scenario",
          title: "Definition change request",
          content:
            "Request: change 'active user' from 'any event' to 'at least one meaningful action' for all experiments from tomorrow.\n120 running experiments use retention metrics based on active users.\nResults pages are visible to the whole company, including confidential experiments and revenue per user.\nCluster cost is up 40 percent since last quarter.\nThere is no dashboard for pipeline freshness or failures.",
          caption: "A definition change in the middle of an experiment changes the experiment."
        },
        hints: [
          "A definition change mid-experiment changes the numbers; decide which experiments use which version.",
          "Confidential experiments need access control on results, not just on raw data.",
          "Cost follows the number of metrics and how much data each reads; decide what to measure and cut."
        ],
        referenceAnswer: {
          summary:
            "Version the new definition and run it alongside the old one for running experiments, monitor freshness and result health, restrict confidential and sensitive results, and attribute and trim compute cost.",
          explanation:
            "Monitoring: publication time against 09:00, job failures and durations, input completeness by platform, sample-ratio failure rates, and the share of experiments with blocked results, on a dashboard with alerts to the pipeline's on-call. Definition change: publish 'active user v2' as a new version; experiments that started before the change keep v1 for their primary metrics and show v2 alongside as a secondary metric; new experiments use v2; the difference between versions is reported on past experiments so teams understand the shift; and the change is announced with an effective date. Nothing is recomputed silently. Access: results pages follow experiment permissions, confidential experiments are visible only to their team and approvers until launch, and revenue per user and user-level exports are restricted and audited. Cost: attribute compute to experiments and metrics, stop computing experiments that have ended, drop metrics nobody views, reuse the per-user table instead of per-experiment scans, and move analysts to curated tables. The trade-off: keeping both definitions costs extra compute and some confusion for a few weeks, but changing metrics mid-experiment would make running results impossible to compare."
        },
        rubric: [
          {
            criterion:
              "Monitors publication time, failures, completeness, and blocked results, with an owner.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Restricts confidential experiments and sensitive per-user results.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Attributes compute to experiments and metrics and removes ended experiments and unused metrics.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains the cost of running two definitions against the risk of changing metrics mid-experiment.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Versions the definition, keeps v1 for running experiments, shows both, and announces the change.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Changing a metric definition for running experiments overnight, so results shift for reasons unrelated to the change being tested.",
          "Making every experiment's results visible to the whole company, including confidential tests.",
          "Computing results forever for experiments that have already ended."
        ],
        interviewerFollowUps: [
          "A team asks to switch its running experiment to v2 because the numbers look better. What do you say?"
        ],
        transferConnection:
          "Versioning a definition and running old and new side by side applies to any metric change in a live system."
      })
    ]
  })
]);
