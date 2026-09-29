import type {
  AiMlStoryPath,
  AiMlStoryQuestion
} from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import type { InteractionCriterion } from "@/features/practice/shared/domain/interactive-response";

/*
 * Backend fundamentals: the language-independent half of backend interviews.
 * Code is SQL, HTTP, or plain pseudocode so a Java, Python, Go, or Node
 * engineer can answer every question in their own stack.
 */

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

/** An interactive question; the rubric comes from its ordering or assignment rules. */
const interactive = (
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
    key: "databases-sql",
    title: "Make the database fast and correct",
    description: "Read query plans, fix N+1 queries, and keep writes correct under load.",
    expectedMinutes: 45,
    questions: [
      choice({
        id: "backend-core-1",
        pathKey: "databases-sql",
        title: "Find why the index is ignored",
        format: "mcq",
        prompt:
          "Login got slow after the users table passed 20 million rows. There is an index on email. Why is the database not using it?",
        artifact: {
          kind: "query-plan",
          title: "EXPLAIN ANALYZE for the login query",
          content:
            "SELECT id, password_hash FROM users WHERE LOWER(email) = 'priya@example.com';\n\nSeq Scan on users  (rows=20412339)\n  Filter: (lower(email) = 'priya@example.com')\n  Rows Removed by Filter: 20412338\nExecution Time: 4180 ms\n\nIndexes: users_email_idx ON users (email)"
        },
        topicKeys: ["indexes", "query-plans"],
        choices: [
          "The table is too large for an index to help; partition the users table.",
          "The index is corrupt and needs to be rebuilt.",
          "The query applies LOWER() to the column, so the plain index on email cannot be used. Add an index on LOWER(email) or store emails already lower-cased.",
          "The database ignores indexes on text columns; switch email to a fixed-length type."
        ],
        correctChoiceIndex: 2,
        hints: [
          "Compare the expression in the WHERE clause with the column the index covers.",
          "An index on email stores email values, not LOWER(email) values.",
          "Either index the same expression or change the data so no function is needed."
        ],
        answer: {
          concise:
            "Wrapping email in LOWER() means the index on the raw column cannot match, so the database scans every row.",
          explanation:
            "Create an expression index on LOWER(email), or normalise emails to lower case on write and query the column directly. Then rerun EXPLAIN and confirm an Index Scan with a single row read."
        },
        commonMistakes: ["Adding more hardware instead of reading the query plan."],
        interviewerFollowUps: [
          "Which other operations in a WHERE clause stop an index from being used?"
        ],
        interviewConnection:
          "Reading a query plan is the first thing interviewers expect when a query is slow."
      }),
      text({
        id: "backend-core-2",
        pathKey: "databases-sql",
        title: "Count the queries behind one page",
        format: "artifact-diagnosis",
        prompt:
          "The order history endpoint takes 2 seconds for a customer with 50 orders. Using the query log, explain what is happening and how you would fix it.",
        artifact: {
          kind: "logs",
          title: "Queries for GET /customers/42/orders",
          content:
            "SELECT * FROM orders WHERE customer_id = 42;            -- 50 rows, 6 ms\nSELECT * FROM products WHERE id = 901;                 -- 3 ms\nSELECT * FROM products WHERE id = 377;                 -- 3 ms\nSELECT * FROM products WHERE id = 901;                 -- 3 ms\n... 47 more single-product queries ...\nTotal: 51 queries, 1.9 s including network round trips"
        },
        topicKeys: ["n-plus-one", "orm"],
        hints: [
          "Count how many queries run for one request.",
          "Each product is fetched separately, and some are fetched twice.",
          "Load all the products the page needs in one query."
        ],
        answer: {
          concise:
            "This is an N+1 query problem: one query for the orders, then one query per order for its product.",
          explanation:
            "Fetch the products in one query with a JOIN or WHERE id IN (...), or use the ORM's eager loading. That turns 51 round trips into 1 or 2. Add a test or query-count check so the pattern does not come back."
        },
        rubric: [
          "Identify the N+1 pattern from the log.",
          "Replace per-row queries with a join, IN query, or eager loading.",
          "Explain how to verify and prevent it, such as a query-count assertion."
        ],
        commonMistakes: [
          "Adding a cache in front of each single-product query instead of batching."
        ],
        interviewerFollowUps: ["When can eager loading make things worse?"],
        interviewConnection:
          "N+1 queries are the most common ORM performance bug, and interviewers ask about them in almost every backend loop."
      }),
      text({
        id: "backend-core-3",
        pathKey: "databases-sql",
        title: "Explain the missing withdrawal",
        format: "predict-explain",
        prompt:
          "Two withdrawals of 30 run at the same moment on an account holding 100. Predict the final balance, explain why, and fix it.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "withdraw (pseudocode, runs in two requests at once)",
          content:
            "BEGIN TRANSACTION   -- default isolation: READ COMMITTED\n  balance = SELECT balance FROM accounts WHERE id = 7   -- both read 100\n  if balance < 30: ROLLBACK and fail\n  UPDATE accounts SET balance = <balance - 30> WHERE id = 7\nCOMMIT"
        },
        topicKeys: ["transactions", "isolation-levels", "lost-update"],
        hints: [
          "Both requests read the balance before either one writes.",
          "Each request writes the value it calculated from its own stale read.",
          "Make the database do the arithmetic, or lock the row before reading."
        ],
        answer: {
          concise:
            "The final balance is 70, not 40: both requests read 100 and each writes 70, so one withdrawal is lost.",
          explanation:
            "Use an atomic update such as UPDATE accounts SET balance = balance - 30 WHERE id = 7 AND balance >= 30 and check the affected row count. Alternatives are SELECT ... FOR UPDATE to lock the row, or optimistic locking with a version column."
        },
        rubric: [
          "Predict 70 and explain the lost update.",
          "Fix it with an atomic conditional update or a row lock.",
          "Explain why a transaction alone at READ COMMITTED does not prevent this."
        ],
        commonMistakes: ["Assuming that wrapping code in a transaction makes it safe."],
        interviewerFollowUps: ["Would SERIALIZABLE isolation fix this, and at what cost?"],
        interviewConnection:
          "Interviewers use the lost-update problem to see whether you understand what a transaction does and does not protect."
      }),
      text({
        id: "backend-core-4",
        pathKey: "databases-sql",
        title: "Choose indexes for two queries",
        format: "written",
        prompt:
          "The support dashboard runs these two queries thousands of times an hour. Which indexes would you add, in what column order, and what do they cost?",
        artifact: {
          kind: "code",
          language: "sql",
          title: "tickets queries",
          content:
            "-- Q1: a customer's open tickets\nSELECT * FROM tickets WHERE customer_id = ? AND status = 'open';\n\n-- Q2: newest open tickets across all customers\nSELECT * FROM tickets WHERE status = 'open' ORDER BY created_at DESC LIMIT 50;\n\n-- tickets: 30 million rows; about 2% are open"
        },
        topicKeys: ["composite-indexes", "index-design"],
        hints: [
          "A composite index is used from its leftmost column.",
          "Q2 filters on one column and sorts by another.",
          "Every index speeds up reads and slows down writes."
        ],
        answer: {
          concise:
            "Add (customer_id, status) for Q1 and (status, created_at) for Q2; each costs extra write time and storage.",
          explanation:
            "For Q1, customer_id is the selective column, so it leads. For Q2, (status, created_at) lets the database find open tickets already in date order and stop after 50 rows, with no sort. A partial index WHERE status = 'open' is smaller still. Every index adds work to each insert and update, so add only the ones the workload needs."
        },
        rubric: [
          "Propose a correct composite index for each query.",
          "Justify the column order with the leftmost-prefix rule and the sort.",
          "Name the write and storage cost, or suggest a partial index."
        ],
        commonMistakes: [
          "Adding one index per column and expecting the database to combine them well."
        ],
        interviewerFollowUps: ["What is a covering index, and when would you use one here?"],
        interviewConnection:
          "Index design questions check whether you can reason from the query to the index instead of guessing."
      }),
      interactive({
        id: "backend-core-5",
        pathKey: "databases-sql",
        title: "Add a required column without downtime",
        format: "production-decision",
        prompt:
          "The orders table has 80 million rows and is written to constantly. You need a new required column, currency, on every row. Order the steps so the app never goes down and no write fails.",
        artifact: {
          kind: "scenario",
          title: "Migration constraints",
          content:
            "orders: 80 million rows, about 400 writes per second\nApp servers deploy one at a time; old and new code run together for 10 minutes\nALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT on this database version rewrites the whole table and locks it"
        },
        topicKeys: ["migrations", "zero-downtime"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            { id: "backfill", label: "Backfill existing rows in small batches." },
            { id: "constraint", label: "Add the NOT NULL constraint once no row is null." },
            { id: "add", label: "Add currency as a nullable column with no default." },
            { id: "read", label: "Deploy code that relies on currency always being present." },
            { id: "write", label: "Deploy code that writes currency on every new or updated row." }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "add",
            second: "write",
            label: "Add the column before any code writes it",
            points: 2,
            explanation: "Code that writes a missing column fails every write."
          },
          {
            type: "before",
            first: "write",
            second: "backfill",
            label: "Start writing new rows before backfilling",
            points: 3,
            explanation:
              "If you backfill first, rows written by old code during the backfill are left null."
          },
          {
            type: "before",
            first: "backfill",
            second: "constraint",
            label: "Backfill before enforcing NOT NULL",
            points: 3,
            explanation: "The constraint fails, or locks the table, while null rows remain."
          },
          {
            type: "before",
            first: "constraint",
            second: "read",
            label: "Enforce the constraint before relying on it",
            points: 2,
            explanation: "Code can only assume the value exists once the database guarantees it."
          }
        ],
        hints: [
          "Old and new code run together, so every step must work with both.",
          "New rows need the value before you fill in old rows.",
          "Enforce the rule only after every row already follows it."
        ],
        answer: {
          concise:
            "Add a nullable column, write it from new code, backfill in batches, then add NOT NULL, then rely on it.",
          explanation:
            "This is the expand and contract pattern. Each step works with the code running before and after it, the backfill runs in small batches to avoid long locks, and the constraint is added only when it can already be satisfied."
        },
        commonMistakes: ["Running one ALTER TABLE with NOT NULL DEFAULT on a large, busy table."],
        interviewerFollowUps: ["How would you rename a column the same way?"],
        interviewConnection:
          "Interviewers ask about live migrations to see whether you have changed a schema under real traffic."
      }),
      text({
        id: "backend-core-6",
        pathKey: "databases-sql",
        title: "Decide on the move to a document store",
        format: "production-decision",
        prompt:
          "A teammate wants to move orders from PostgreSQL to MongoDB because product keeps adding fields. Decide what you would do and explain the trade-offs.",
        artifact: {
          kind: "scenario",
          title: "Orders today",
          content:
            "orders, order_items, payments, refunds: joined in most reports\nFinance needs totals that always match payments\nNew optional fields each month: gift_message, delivery_slot, marketplace_metadata\nTraffic: 150 orders per minute at peak"
        },
        topicKeys: ["sql-vs-nosql", "data-modeling"],
        hints: [
          "Ask what the data needs, not what is easy to change this week.",
          "Money that must reconcile needs transactions and joins.",
          "Relational databases can store flexible fields too."
        ],
        answer: {
          concise:
            "Keep orders in PostgreSQL and put the changing optional fields in a JSONB column instead of migrating.",
          explanation:
            "Orders, payments, and refunds are related data that must stay consistent, which relational transactions and joins handle well. 150 orders per minute is small for PostgreSQL. A JSONB column absorbs new optional fields without schema changes and can still be indexed. A document store fits better when data is read as one self-contained document and cross-record consistency matters less."
        },
        rubric: [
          "Make a clear decision grounded in the evidence.",
          "Explain the consistency and join needs of financial data.",
          "Offer a way to handle flexible fields, such as JSONB, and say when a document store would fit."
        ],
        commonMistakes: ["Choosing a database because its schema is easier to change."],
        interviewerFollowUps: [
          "What would make you pick a document store for a different feature?"
        ],
        interviewConnection:
          "SQL versus NoSQL questions test judgement: interviewers want a reasoned choice, not a favourite tool."
      })
    ]
  },
  {
    key: "api-design",
    title: "Design APIs clients can rely on",
    description:
      "Pick status codes, paginate safely, handle retries, and change APIs without breaking clients.",
    expectedMinutes: 45,
    questions: [
      interactive({
        id: "backend-core-7",
        pathKey: "api-design",
        title: "Return the right status code",
        format: "written",
        prompt:
          "Each case below comes from the same orders API. Assign the status code a well-behaved API returns.",
        artifact: {
          kind: "scenario",
          title: "Requests to /orders",
          content:
            "The orders API is used by a web app, two mobile apps, and partner integrations.\nClients retry on some status codes and show the error message on others, so the code has to be right."
        },
        topicKeys: ["http-status-codes", "rest"],
        interaction: {
          type: "classification",
          instruction: "Connect each request to a status code. A code can be used more than once.",
          items: [
            { id: "no-token", label: "The request has no access token." },
            { id: "other-user", label: "A logged-in user asks to cancel someone else's order." },
            { id: "bad-quantity", label: "The body has quantity: -3." },
            {
              id: "already-shipped",
              label: "The user tries to cancel an order that has already shipped."
            },
            { id: "created", label: "A new order was created successfully." }
          ],
          categories: [
            { id: "201", label: "201 Created" },
            { id: "400", label: "400 Bad Request" },
            { id: "401", label: "401 Unauthorized" },
            { id: "403", label: "403 Forbidden" },
            { id: "409", label: "409 Conflict" }
          ]
        },
        interactionRubric: [
          {
            type: "assignment",
            itemId: "no-token",
            categoryId: "401",
            points: 2,
            label: "Missing credentials",
            explanation: "401 means the client is not authenticated."
          },
          {
            type: "assignment",
            itemId: "other-user",
            categoryId: "403",
            points: 2,
            label: "Authenticated but not allowed",
            explanation:
              "403 means the user is known but lacks permission. Many APIs return 404 instead to avoid revealing that the order exists."
          },
          {
            type: "assignment",
            itemId: "bad-quantity",
            categoryId: "400",
            points: 2,
            label: "Invalid input",
            explanation: "The request itself is invalid; retrying it unchanged will never work."
          },
          {
            type: "assignment",
            itemId: "already-shipped",
            categoryId: "409",
            points: 2,
            label: "Conflicts with current state",
            explanation: "The request is valid, but the order's current state does not allow it."
          },
          {
            type: "assignment",
            itemId: "created",
            categoryId: "201",
            points: 2,
            label: "Resource created",
            explanation: "201 tells the client a new resource exists, usually with its location."
          }
        ],
        hints: [
          "401 is about who you are; 403 is about what you are allowed to do.",
          "Separate a malformed request from a valid request the current state rejects.",
          "Creating something has its own success code."
        ],
        answer: {
          concise:
            "No token 401, someone else's order 403 (or 404), bad quantity 400, already shipped 409, created 201.",
          explanation:
            "Clients decide what to do from the status code: re-authenticate on 401, stop on 403 and 400, show a state message on 409, and read the new resource on 201. Using 200 for everything forces clients to parse error bodies."
        },
        commonMistakes: ["Returning 200 with an error field in the body."],
        interviewerFollowUps: ["When would you return 404 instead of 403?"],
        interviewConnection:
          "Status code questions are quick checks that you have designed an API other people consume."
      }),
      text({
        id: "backend-core-8",
        pathKey: "api-design",
        title: "Make a payment safe to retry",
        format: "production-decision",
        prompt:
          "Mobile clients retry POST /payments when the network times out, and customers are sometimes charged twice. Design an idempotency key mechanism for this endpoint.",
        artifact: {
          kind: "logs",
          title: "One customer, one tap",
          content:
            "12:01:03.100 POST /payments {amount: 1299}  -> charge ch_811 created\n12:01:13.100 client timeout after 10 s (response lost on a weak network)\n12:01:13.400 POST /payments {amount: 1299}  -> charge ch_812 created\n12:01:13.900 200 OK"
        },
        topicKeys: ["idempotency", "retries"],
        hints: [
          "The client needs a way to say 'this is the same request as before'.",
          "The server must remember what it did the first time.",
          "Two retries can arrive at the same moment."
        ],
        answer: {
          concise:
            "The client sends an Idempotency-Key per payment; the server stores the key with the result and returns the stored result on any retry.",
          explanation:
            "Save the key, a hash of the request body, and the response under a unique constraint, in the same transaction as the charge. A retry with the same key returns the saved response. The same key with a different body returns 422 or 409. A retry that arrives while the first is still running waits or gets 409. Keys expire after about 24 hours."
        },
        rubric: [
          "Use a client-generated key stored with the result under a unique constraint.",
          "Return the original response on retries and reject a reused key with a different body.",
          "Handle concurrent retries and key expiry."
        ],
        commonMistakes: [
          "Deduplicating by amount and customer, which blocks two genuine payments."
        ],
        interviewerFollowUps: ["Why must the key be stored in the same transaction as the charge?"],
        interviewConnection:
          "Idempotency is asked in almost every payments or checkout interview, often as a follow-up to 'what happens on retry?'."
      }),
      text({
        id: "backend-core-9",
        pathKey: "api-design",
        title: "Design pagination that holds up",
        format: "artifact-diagnosis",
        prompt:
          "Partners export all transactions with ?page=N, and they report missing and duplicated rows during busy hours. Explain why, and design a better pagination contract.",
        artifact: {
          kind: "code",
          language: "sql",
          title: "GET /transactions?page=N&size=100",
          content:
            "SELECT * FROM transactions\nORDER BY created_at DESC\nLIMIT 100 OFFSET (N - 1) * 100;\n\n-- about 40 new transactions per second at peak\n-- the full export is around 3 million rows"
        },
        topicKeys: ["pagination", "cursor-pagination"],
        hints: [
          "New rows are inserted at the top while the partner is paging.",
          "An offset counts rows; it does not remember which row you stopped at.",
          "Large offsets also force the database to walk past every skipped row."
        ],
        answer: {
          concise:
            "Offsets shift as new rows arrive, so pages overlap or skip rows; use cursor pagination on a stable, unique sort key.",
          explanation:
            "Sort by (created_at, id) and return an opaque next_cursor that encodes the last row seen. The next request asks for rows after that cursor with WHERE (created_at, id) < (?, ?). Results stay consistent while data changes, and every page costs the same because the database seeks by index instead of skipping rows."
        },
        rubric: [
          "Explain how inserts shift offset pages.",
          "Design a cursor on a unique, stable sort key with an opaque token.",
          "Mention the performance cost of large offsets."
        ],
        commonMistakes: [
          "Using a cursor on created_at alone, which breaks when two rows share a timestamp."
        ],
        interviewerFollowUps: ["What does a cursor API give up compared with page numbers?"],
        interviewConnection:
          "Pagination comes up whenever you design a list endpoint, and interviewers look for the cursor answer."
      }),
      text({
        id: "backend-core-10",
        pathKey: "api-design",
        title: "Change a field without breaking apps",
        format: "production-decision",
        prompt:
          "You need to change price from a number of rupees to an integer amount in paise with a currency. Old mobile app versions stay in use for months. How do you ship this?",
        artifact: {
          kind: "code",
          language: "json",
          title: "GET /products/88 today",
          content: '{\n  "id": 88,\n  "name": "Desk lamp",\n  "price": 1299.5\n}'
        },
        topicKeys: ["api-versioning", "backward-compatibility"],
        hints: [
          "Old clients will keep reading price as it is today.",
          "Adding a field is safe; changing the meaning of one is not.",
          "You need a way to know when old clients are gone."
        ],
        answer: {
          concise:
            "Add new fields (amount_minor: 129950, currency: 'INR') next to price, move clients over, and remove price only when usage drops to zero.",
          explanation:
            "Additive changes are backward compatible, so both old and new apps work. Mark price as deprecated in the docs and with a Deprecation or Sunset header, and log which clients still read it. Remove it only when that traffic is gone. A new API version is only needed when a change cannot be made additively."
        },
        rubric: [
          "Make the change additive instead of changing the field's meaning.",
          "Plan deprecation with a signal and usage tracking before removal.",
          "Explain when a new API version is actually needed."
        ],
        commonMistakes: [
          "Changing price in place and releasing a new app version at the same time."
        ],
        interviewerFollowUps: [
          "URL versioning or header versioning: which would you choose and why?"
        ],
        interviewConnection:
          "Interviewers ask this to see whether you design for the clients you cannot update."
      }),
      text({
        id: "backend-core-11",
        pathKey: "api-design",
        title: "Fix the inconsistent errors",
        format: "artifact-diagnosis",
        prompt:
          "Client developers say every endpoint reports errors differently. Using these responses, list the problems and propose one error format for the whole API.",
        artifact: {
          kind: "logs",
          title: "Error responses from three endpoints",
          content:
            'POST /orders      200 {"success": false, "msg": "Invalid quantity"}\nGET  /orders/99   500 {"error": "NullPointerException at OrderService.java:212"}\nPOST /coupons     400 "coupon expired"'
        },
        topicKeys: ["error-handling", "api-design"],
        hints: [
          "Check the status codes before the bodies.",
          "One response leaks internal details to the caller.",
          "Clients need a stable code they can branch on, separate from the message."
        ],
        answer: {
          concise:
            "Use real status codes, never expose stack traces, and return one JSON error shape with a stable code, a message, field details, and a request id.",
          explanation:
            'For example {"error": {"code": "INVALID_QUANTITY", "message": "Quantity must be at least 1", "fields": {"quantity": "must be >= 1"}, "requestId": "req_7f3"}}. The code is for programs, the message is for people, and the request id links the response to server logs. Unexpected failures return a generic 500 message; the details stay in the logs.'
        },
        rubric: [
          "Identify the wrong status code, the leaked stack trace, and the inconsistent shapes.",
          "Propose one error format with a machine-readable code and a human message.",
          "Include a request id and keep internal details in server logs."
        ],
        commonMistakes: ["Returning the exception message directly to clients."],
        interviewerFollowUps: [
          "How would you return validation errors for several fields at once?"
        ],
        interviewConnection:
          "Error design shows whether you think about the developers who call your API."
      }),
      text({
        id: "backend-core-12",
        pathKey: "api-design",
        title: "Rate limit a public API",
        format: "written",
        prompt:
          "One partner's script sent 3,000 requests per second and slowed the API for everyone. Design a rate limit for the public API and say what clients see when they hit it.",
        artifact: {
          kind: "metrics",
          title: "Traffic during the incident",
          content:
            "Normal partner traffic: 5 to 50 requests per second each\nPartner p_77: 3,000 requests per second for 12 minutes\nAPI p95 latency for all partners: 120 ms -> 2.4 s\nAPI servers: 6 instances behind a load balancer"
        },
        topicKeys: ["rate-limiting", "api-design"],
        hints: [
          "Limit per API key, not per server.",
          "Six servers means the counter has to be shared.",
          "Tell clients when they can try again."
        ],
        answer: {
          concise:
            "Use a token bucket per API key with shared counters (for example in Redis), and return 429 with a Retry-After header when a client is over the limit.",
          explanation:
            "A token bucket allows short bursts but caps the sustained rate, for example 100 requests per second with a burst of 200. The counter lives in a shared store so all six servers enforce the same limit. Rejected requests get 429 plus Retry-After, and every response includes remaining-quota headers so well-behaved clients can slow down before they hit the limit."
        },
        rubric: [
          "Choose an algorithm such as token bucket or sliding window, keyed per client.",
          "Share limit state across instances.",
          "Return 429 with Retry-After and quota headers."
        ],
        commonMistakes: [
          "Counting requests in each server's memory, which multiplies the real limit by six."
        ],
        interviewerFollowUps: ["What happens to rate limiting if Redis goes down?"],
        interviewConnection:
          "Rate limiting is both a common API question and one of the most asked system design problems."
      })
    ]
  },
  {
    key: "auth-security",
    title: "Keep users and their data safe",
    description:
      "Fix access checks, store passwords properly, and choose sessions or tokens deliberately.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "backend-core-13",
        pathKey: "auth-security",
        title: "Stop users reading each other's invoices",
        format: "artifact-diagnosis",
        prompt:
          "A security researcher downloaded other customers' invoices by changing the number in the URL. Explain the bug and how you would fix it across the whole API, not just this endpoint.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "GET /invoices/:id (pseudocode)",
          content:
            "handler getInvoice(request):\n  requireLoggedIn(request)\n  invoice = db.query('SELECT * FROM invoices WHERE id = ?', request.params.id)\n  if invoice is null: return 404\n  return 200, invoice"
        },
        topicKeys: ["authorization", "idor"],
        hints: [
          "The handler checks who the user is, but not whether the invoice is theirs.",
          "Sequential ids make it easy to guess other records.",
          "Make ownership part of how data is loaded, everywhere."
        ],
        answer: {
          concise:
            "This is an insecure direct object reference: the code authenticates the user but never checks that the invoice belongs to them.",
          explanation:
            "Scope the query by owner (WHERE id = ? AND customer_id = ?) and return 404 when there is no match, so the response does not reveal that the invoice exists. Apply the same rule across the API with a shared data-access layer or policy check, and add tests that request another user's resources. Random ids help, but they are not an access control."
        },
        rubric: [
          "Identify the missing ownership check (IDOR).",
          "Fix it by scoping queries or checking policy on every access.",
          "Prevent recurrence with a shared layer and tests, not just this endpoint."
        ],
        commonMistakes: ["Switching to UUIDs and calling the problem solved."],
        interviewerFollowUps: ["Would you return 403 or 404 here, and why?"],
        interviewConnection:
          "Broken access control is the most common real-world API vulnerability, so interviewers ask about it often."
      }),
      choice({
        id: "backend-core-14",
        pathKey: "auth-security",
        title: "Store passwords the right way",
        format: "mcq",
        prompt:
          "You are building sign-up for a new service. How should the database store passwords?",
        artifact: {
          kind: "scenario",
          title: "Requirements",
          content:
            "Users sign up with an email and password.\nIf the database leaks, attackers should not be able to recover passwords quickly.\nLogin should take under 300 ms."
        },
        topicKeys: ["password-hashing", "security"],
        choices: [
          "Hash each password with SHA-256 and a random salt.",
          "Hash each password with a slow, salted algorithm built for passwords, such as Argon2id or bcrypt.",
          "Encrypt passwords with AES and keep the key in an environment variable.",
          "Hash passwords with MD5 so logins stay fast."
        ],
        correctChoiceIndex: 1,
        hints: [
          "Fast hashes are good for files, and bad for passwords.",
          "Anything you can decrypt, an attacker with the key can decrypt too.",
          "Password hashing should be deliberately slow and salted."
        ],
        answer: {
          concise:
            "Use Argon2id or bcrypt: they are salted and deliberately slow, so leaked hashes are expensive to crack.",
          explanation:
            "SHA-256 is fast, so attackers can try billions of guesses per second even with a salt. Encryption is reversible, so a leaked key exposes every password. Argon2id and bcrypt have a tunable cost; set it so one hash takes roughly 100 ms on your servers, which fits the login budget."
        },
        commonMistakes: ["Believing a salt alone makes a fast hash safe."],
        interviewerFollowUps: ["How would you move existing users from SHA-256 to Argon2id?"],
        interviewConnection:
          "Password storage is a classic security question where the only good answer is a password hashing function."
      }),
      text({
        id: "backend-core-15",
        pathKey: "auth-security",
        title: "Break into the search endpoint",
        format: "predict-explain",
        prompt:
          "Predict what this search returns when name is ' OR '1'='1, explain why, and show the fix.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "GET /customers/search?name=... (pseudocode)",
          content:
            'sql = "SELECT id, name, email FROM customers WHERE name = \'" + request.query.name + "\'"\nrows = db.execute(sql)\nreturn rows'
        },
        topicKeys: ["sql-injection", "security"],
        hints: [
          "Write out the full SQL string after the input is joined in.",
          "The input closes the quote and adds a condition that is always true.",
          "Keep user input out of the SQL text entirely."
        ],
        answer: {
          concise:
            "It returns every customer: the query becomes WHERE name = '' OR '1'='1', which is always true.",
          explanation:
            "String concatenation lets input change the query itself. Use parameterised queries (WHERE name = ?) so the database treats input only as a value. Also run the app with a database user that has only the permissions it needs, which limits the damage of any mistake."
        },
        rubric: [
          "Predict that all rows are returned and show the resulting SQL.",
          "Fix it with parameterised queries or prepared statements.",
          "Add defence in depth, such as least-privilege database users."
        ],
        commonMistakes: ["Escaping quotes by hand instead of using parameters."],
        interviewerFollowUps: ["Can an ORM still be vulnerable to SQL injection?"],
        interviewConnection:
          "SQL injection is the security question almost every backend interviewer includes."
      }),
      text({
        id: "backend-core-16",
        pathKey: "auth-security",
        title: "Choose sessions or tokens",
        format: "production-decision",
        prompt:
          "Product wants a 'log out of all devices' button, and security wants a stolen login to stop working within minutes. The team currently issues JWTs that last 30 days. What would you change?",
        artifact: {
          kind: "config",
          title: "Current login",
          content:
            "Login returns a JWT signed with HS256\nExpiry: 30 days\nStored by the web app in localStorage\nThe server checks only the signature and expiry; nothing is stored server-side"
        },
        topicKeys: ["jwt", "sessions", "authentication"],
        hints: [
          "A server cannot take back a self-contained token before it expires.",
          "Shorten what a stolen token is worth.",
          "Somewhere, the server must be able to say 'no longer valid'."
        ],
        answer: {
          concise:
            "Issue short-lived access tokens (about 5 to 15 minutes) with rotating refresh tokens stored server-side, so logout can revoke them.",
          explanation:
            "A 30-day JWT cannot be revoked without a server-side check, so logout-all is impossible. Keep access tokens short and store refresh tokens in the database; logout-all deletes them, and a reused old refresh token revokes the whole family. For a browser app, a server-side session in an HttpOnly, Secure cookie is often simpler and also keeps tokens out of reach of JavaScript."
        },
        rubric: [
          "Explain why long-lived stateless JWTs cannot be revoked.",
          "Propose short access tokens with revocable, rotating refresh tokens or server-side sessions.",
          "Address token storage in the browser, such as HttpOnly cookies instead of localStorage."
        ],
        commonMistakes: ["Keeping a blocklist of every JWT, which rebuilds sessions the hard way."],
        interviewerFollowUps: ["What does refresh token rotation protect against?"],
        interviewConnection:
          "Sessions versus JWT is one of the most common authentication questions, and interviewers expect trade-offs, not a slogan."
      }),
      interactive({
        id: "backend-core-17",
        pathKey: "auth-security",
        title: "Walk through 'Sign in with Google'",
        format: "written",
        prompt:
          "Your web app adds 'Sign in with Google' using the OAuth authorization code flow with PKCE. Order what happens from the click to a logged-in user.",
        artifact: {
          kind: "scenario",
          title: "Parties involved",
          content:
            "Browser (the user)\nYour backend (the client)\nGoogle (the authorization server)\nYour backend holds the client secret; the browser never sees it."
        },
        topicKeys: ["oauth", "pkce", "authentication"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            {
              id: "exchange",
              label:
                "Your backend checks state, then exchanges the code plus the PKCE verifier and client secret for tokens."
            },
            { id: "consent", label: "The user signs in to Google and approves access." },
            {
              id: "session",
              label: "Your backend verifies the ID token and creates the user's session."
            },
            {
              id: "redirect",
              label:
                "Your backend creates a state value and a PKCE code challenge, then redirects the browser to Google."
            },
            {
              id: "callback",
              label: "Google redirects back with a one-time code and the same state value."
            }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "redirect",
            second: "consent",
            label: "Start from your backend",
            points: 2,
            explanation: "State and the PKCE challenge must exist before the user leaves your site."
          },
          {
            type: "before",
            first: "consent",
            second: "callback",
            label: "Consent before the code",
            points: 2,
            explanation: "Google only issues a code after the user approves."
          },
          {
            type: "before",
            first: "callback",
            second: "exchange",
            label: "Exchange the code on the server",
            points: 3,
            explanation:
              "The code is worthless alone; the backend redeems it with the verifier and secret."
          },
          {
            type: "before",
            first: "exchange",
            second: "session",
            label: "Verify tokens before logging in",
            points: 3,
            explanation:
              "Create a session only after validating the ID token's signature, issuer, and audience."
          }
        ],
        hints: [
          "The user leaves your site and comes back.",
          "What comes back in the URL is not a token yet.",
          "Only your backend can redeem the code."
        ],
        answer: {
          concise:
            "Redirect with state and PKCE, user consents, Google returns a code, the backend exchanges it for tokens, then verifies the ID token and creates a session.",
          explanation:
            "State protects against forged callbacks, and PKCE makes a stolen code useless without the verifier. Tokens are exchanged server-to-server, so they never pass through the browser URL."
        },
        commonMistakes: [
          "Treating the access token as proof of who the user is instead of verifying the ID token."
        ],
        interviewerFollowUps: ["What attack does the state parameter prevent?"],
        interviewConnection:
          "Interviewers ask candidates to walk through OAuth to see whether they understand it or have only used a library."
      }),
      text({
        id: "backend-core-18",
        pathKey: "auth-security",
        title: "Respond to a leaked secret",
        format: "production-decision",
        prompt:
          "A developer pushed a commit to a public repository that contains the production payment API key. It was public for 40 minutes. What do you do, in order, and how do you stop it happening again?",
        artifact: {
          kind: "logs",
          title: "Timeline",
          content:
            "14:02 commit a91f pushed to a public repo, includes config/prod.env with PAYMENT_API_KEY\n14:30 automated scanner bot forks the repository\n14:42 developer notices and deletes the file in a new commit\nThe key is still in git history"
        },
        topicKeys: ["secrets-management", "incident-response"],
        hints: [
          "Deleting the file does not remove it from history or from forks.",
          "Assume the key has already been copied.",
          "Fix the process, not just this key."
        ],
        answer: {
          concise:
            "Revoke and rotate the key immediately, check the payment provider's logs for misuse, then move secrets out of the repo and add secret scanning.",
          explanation:
            "Treat the key as compromised: rotate it first, because forks and scanners already have it. Review usage logs from 14:02 onward and involve the provider if needed. Rewriting git history is secondary. To prevent it, load secrets from a secret manager or the deploy environment, add pre-commit and CI secret scanning, and keep production keys out of developer machines."
        },
        rubric: [
          "Rotate or revoke the key first and treat it as compromised.",
          "Investigate misuse during the exposure window.",
          "Prevent recurrence with a secret manager and automated scanning."
        ],
        commonMistakes: ["Deleting the file and assuming nobody saw it."],
        interviewerFollowUps: ["How would you rotate a key without downtime?"],
        interviewConnection:
          "Incident questions like this show whether you act in the right order under pressure."
      })
    ]
  },
  {
    key: "concurrency",
    title: "Handle requests that race",
    description:
      "Find race conditions, choose locking strategies, and keep hot rows from becoming bottlenecks.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "backend-core-19",
        pathKey: "concurrency",
        title: "Explain the double-booked seat",
        format: "predict-explain",
        prompt:
          "One seat was left and two users booked it at the same second. Both got a confirmation. Explain exactly how, and fix it.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "bookSeat (pseudocode)",
          content:
            "handler bookSeat(showId, seatId, userId):\n  taken = db.query('SELECT 1 FROM bookings WHERE show_id = ? AND seat_id = ?', showId, seatId)\n  if taken: return 409 'Seat taken'\n  db.execute('INSERT INTO bookings (show_id, seat_id, user_id) VALUES (?, ?, ?)', showId, seatId, userId)\n  return 201"
        },
        topicKeys: ["race-conditions", "check-then-act"],
        hints: [
          "Write the steps of both requests side by side.",
          "Both checks can run before either insert.",
          "Let the database enforce the rule instead of the application."
        ],
        answer: {
          concise:
            "Both requests ran the check before either inserted, so both saw the seat as free: a check-then-act race.",
          explanation:
            "Add a unique constraint on (show_id, seat_id) and treat a duplicate-key error as 'seat taken'. The database then guarantees one winner, whatever the timing. Locking the seat row with SELECT ... FOR UPDATE also works, but the constraint is simpler and cannot be forgotten by other code paths."
        },
        rubric: [
          "Show the interleaving where both checks pass.",
          "Fix it with a unique constraint or an atomic, locked operation.",
          "Explain why the check in application code cannot be made safe on its own."
        ],
        commonMistakes: ["Adding a sleep or retry instead of making the operation atomic."],
        interviewerFollowUps: ["How would you hold a seat for 10 minutes during checkout?"],
        interviewConnection:
          "Booking and inventory races are the classic concurrency question in backend interviews."
      }),
      choice({
        id: "backend-core-20",
        pathKey: "concurrency",
        title: "Pick a locking strategy for edits",
        format: "mcq",
        prompt:
          "Two editors sometimes save the same help article minutes apart, and the second save silently overwrites the first. Conflicts are rare. What should you do?",
        artifact: {
          kind: "scenario",
          title: "Editing pattern",
          content:
            "Editors open an article, work on it for 5 to 30 minutes, then save.\nAbout 1 save in 500 conflicts with another editor.\nThe article is saved with UPDATE articles SET body = ? WHERE id = ?"
        },
        topicKeys: ["optimistic-locking", "concurrency"],
        choices: [
          "Lock the article row with SELECT ... FOR UPDATE when an editor opens it.",
          "Wrap each save in a SERIALIZABLE transaction.",
          "Save only the fields that changed and let the last save win.",
          "Add a version column; save with WHERE id = ? AND version = ?, and show a conflict to the editor when no row is updated."
        ],
        correctChoiceIndex: 3,
        hints: [
          "Editors hold the article for minutes, not milliseconds.",
          "Conflicts are rare, so blocking everyone to prevent them is costly.",
          "Detect the conflict at save time instead of preventing it upfront."
        ],
        answer: {
          concise:
            "Use optimistic locking with a version column and tell the editor when their save conflicts.",
          explanation:
            "Holding a database lock for 30 minutes would block other editors and leak locks when browsers close. With a version check, the save fails only in the rare conflict, and the app can show both versions. SERIALIZABLE does not help because the conflict spans two separate transactions minutes apart."
        },
        commonMistakes: ["Holding database locks across user think time."],
        interviewerFollowUps: ["When is pessimistic locking the better choice?"],
        interviewConnection:
          "Optimistic versus pessimistic locking is a standard question; the answer depends on how often conflicts happen."
      }),
      text({
        id: "backend-core-21",
        pathKey: "concurrency",
        title: "Read the deadlock report",
        format: "artifact-diagnosis",
        prompt:
          "Transfers between accounts occasionally fail with a deadlock error. Using the report, explain the cause and fix it.",
        artifact: {
          kind: "logs",
          title: "Database deadlock report",
          content:
            "Transaction 1: transfer from account 5 to account 9\n  UPDATE accounts ... WHERE id = 5   -- lock on 5 granted\n  UPDATE accounts ... WHERE id = 9   -- waiting for lock on 9\nTransaction 2: transfer from account 9 to account 5\n  UPDATE accounts ... WHERE id = 9   -- lock on 9 granted\n  UPDATE accounts ... WHERE id = 5   -- waiting for lock on 5\nDEADLOCK DETECTED: transaction 2 rolled back"
        },
        topicKeys: ["deadlocks", "locking"],
        hints: [
          "Each transaction holds one lock and waits for the other's.",
          "The order of locking depends on the transfer's direction.",
          "Make every transaction take locks in the same order."
        ],
        answer: {
          concise:
            "The two transfers lock the same accounts in opposite order, so each waits for the other forever.",
          explanation:
            "Always lock accounts in a fixed order, for example by ascending id, whichever direction the money moves. Keep transactions short, and retry a transaction the database aborts for a deadlock, because a retry will then succeed."
        },
        rubric: [
          "Explain the circular wait from the opposite lock order.",
          "Fix it by locking in a consistent order.",
          "Add retries for deadlock errors and keep transactions short."
        ],
        commonMistakes: ["Increasing the lock timeout, which only makes deadlocks slower."],
        interviewerFollowUps: ["Can a deadlock happen with a single row?"],
        interviewConnection:
          "Deadlock questions test whether you can read what the database is telling you."
      }),
      text({
        id: "backend-core-22",
        pathKey: "concurrency",
        title: "Run the nightly job exactly once",
        format: "written",
        prompt:
          "A nightly billing job runs on all 3 app servers, so customers are billed three times. A teammate proposes a Redis lock with a 60-second expiry. What can still go wrong, and what would you do?",
        artifact: {
          kind: "scenario",
          title: "Billing job",
          content:
            "Scheduled at 02:00 on every app server\nUsually runs for 40 seconds; took 3 minutes on the last day of the month\nProposed: SET billing-lock <server> NX EX 60 before starting"
        },
        topicKeys: ["distributed-locks", "scheduled-jobs"],
        hints: [
          "Compare the lock's expiry with the job's worst-case run time.",
          "A lock that expires lets a second server start while the first is still running.",
          "Make the work itself safe to run twice."
        ],
        answer: {
          concise:
            "If the job outlives the 60-second lock, another server takes the lock and bills again; make billing idempotent and use one scheduler.",
          explanation:
            "Record each invoice under a unique key such as (customer_id, billing_month), so a second run cannot bill twice. Run the schedule from one place, such as a scheduler service or a single job queue, instead of every server. If you keep a lock, renew it while the job runs, or use a database advisory lock tied to the connection."
        },
        rubric: [
          "Explain lock expiry during a long run and the second runner it allows.",
          "Make the billing operation idempotent with a unique key.",
          "Move scheduling to one place or use a lock that cannot expire mid-run."
        ],
        commonMistakes: [
          "Trusting a distributed lock as the only protection against double charging."
        ],
        interviewerFollowUps: ["What is a fencing token, and when does it matter?"],
        interviewConnection:
          "Distributed locks come up often, and interviewers look for the 'what if the lock expires' reasoning."
      }),
      text({
        id: "backend-core-23",
        pathKey: "concurrency",
        title: "Unblock the viral post's like counter",
        format: "production-decision",
        prompt:
          "A post went viral and its like button started timing out. Every like updates one row. What would you change, and what does each option give up?",
        artifact: {
          kind: "metrics",
          title: "During the spike",
          content:
            "Likes on post 5521: 2,500 per second\nUPDATE posts SET like_count = like_count + 1 WHERE id = 5521\nAverage lock wait on that row: 1.8 s; request timeout: 2 s\nOther posts: normal"
        },
        topicKeys: ["hot-rows", "contention"],
        hints: [
          "Every request waits for the same row lock.",
          "Does the count need to be exact at every instant?",
          "Spread the writes out, or batch them."
        ],
        answer: {
          concise:
            "Stop updating one row per like: record likes separately and update the count in batches, or split it across several counter rows.",
          explanation:
            "Insert each like into a likes table (which also prevents double likes) and update like_count asynchronously every second or so, or keep the count in Redis and flush it periodically. Sharded counters (N rows summed on read) also spread lock contention. Each option makes the displayed count slightly stale, which is fine for likes but not for money."
        },
        rubric: [
          "Identify row-lock contention on a single hot row.",
          "Propose batching, asynchronous aggregation, or sharded counters.",
          "State the freshness or accuracy trade-off."
        ],
        commonMistakes: [
          "Scaling the database up, which does not remove the single-row bottleneck."
        ],
        interviewerFollowUps: ["How would you stop one user from liking twice?"],
        interviewConnection:
          "Hot-row questions check whether you can find the real bottleneck instead of adding hardware."
      })
    ]
  },
  {
    key: "caching",
    title: "Cache without serving wrong data",
    description: "Invalidate correctly, survive stampedes, and decide what is safe to cache.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "backend-core-24",
        pathKey: "caching",
        title: "Explain the old price",
        format: "artifact-diagnosis",
        prompt:
          "After a price change, some customers see the old price for up to an hour. Using the code and log, explain why and fix it.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "product reads and writes (pseudocode)",
          content:
            "getProduct(id):\n  cached = cache.get('product:' + id)\n  if cached: return cached\n  product = db.load(id)\n  cache.set('product:' + id, product, ttl = 3600)\n  return product\n\nupdatePrice(id, price):\n  db.execute('UPDATE products SET price = ? WHERE id = ?', price, id)\n\n# log: 10:00 price changed 999 -> 799; cache still returns 999 until 10:58"
        },
        topicKeys: ["cache-invalidation", "cache-aside"],
        hints: [
          "The write path never touches the cache.",
          "Stale data lives until the TTL runs out.",
          "Change the cache when the data changes."
        ],
        answer: {
          concise:
            "Updates change the database but not the cache, so the old price lives until the one-hour TTL expires.",
          explanation:
            "Delete the cache key after the database update commits, so the next read loads the new price. Deleting is safer than writing the new value, because two concurrent updates can leave the cache holding the older one. Keep a shorter TTL as a safety net, and never let checkout rely on the cached price."
        },
        rubric: [
          "Identify the missing invalidation on write.",
          "Invalidate the key after the database commit.",
          "Keep a TTL as a safety net and protect critical paths such as checkout."
        ],
        commonMistakes: ["Only lowering the TTL, which shrinks the problem but keeps it."],
        interviewerFollowUps: ["Why delete the key instead of setting the new value?"],
        interviewConnection:
          "Cache invalidation is the caching question interviewers ask most, because it is where real bugs happen."
      }),
      choice({
        id: "backend-core-25",
        pathKey: "caching",
        title: "Survive a hot key expiring",
        format: "mcq",
        prompt:
          "Every day at 09:00 the home page cache key expires and the database CPU hits 100%. What is the best fix?",
        artifact: {
          kind: "metrics",
          title: "09:00 every day",
          content:
            "Key home:feed: TTL 24 h, set at 09:00 daily\n09:00:00 key expires\n09:00:01 1,800 requests miss the cache at once\n09:00:01 1,800 identical 400 ms queries hit the database\nDatabase CPU: 25% -> 100% for 40 s"
        },
        topicKeys: ["cache-stampede", "caching"],
        choices: [
          "Let one request rebuild the key while the others wait for it or get the old value, and add random jitter to expiry times.",
          "Increase the TTL from 24 hours to 7 days.",
          "Add database read replicas to absorb the 09:00 spike.",
          "Remove the TTL and never let the key expire."
        ],
        correctChoiceIndex: 0,
        hints: [
          "The problem is many requests rebuilding the same value at once.",
          "Only one rebuild is needed.",
          "Keys that all expire together make it worse."
        ],
        answer: {
          concise:
            "Coalesce the rebuild so one request refreshes the key, serve the old value meanwhile, and add jitter so keys do not expire together.",
          explanation:
            "This is a cache stampede. A short rebuild lock (or single-flight) lets one request query the database while the others wait briefly or use the stale value. Refreshing slightly before expiry and adding TTL jitter prevents a synchronised wave. Longer TTLs or replicas only move the problem."
        },
        commonMistakes: ["Scaling the database for a spike the cache should absorb."],
        interviewerFollowUps: ["How would you refresh a key before it expires?"],
        interviewConnection:
          "Stampedes are a common follow-up once you mention caching in an interview."
      }),
      text({
        id: "backend-core-26",
        pathKey: "caching",
        title: "Find the stale value that never leaves",
        format: "predict-explain",
        prompt:
          "The team invalidates the cache on every write, yet a product occasionally shows an old name for hours. Walk through the timeline and explain how it happens.",
        artifact: {
          kind: "trace",
          title: "Two requests on product 12",
          content:
            "t=0 ms   Reader: cache miss for product:12\nt=5 ms   Reader: reads name='Lamp' from the database\nt=10 ms  Writer: updates name to 'Desk lamp' and commits\nt=11 ms  Writer: deletes cache key product:12\nt=40 ms  Reader: sets product:12 = 'Lamp' with TTL 6 h"
        },
        topicKeys: ["cache-races", "cache-aside"],
        hints: [
          "The reader loaded the value before the write.",
          "The delete happened before the reader wrote to the cache.",
          "The TTL decides how long the wrong value survives."
        ],
        answer: {
          concise:
            "The slow reader writes the old name into the cache after the writer's delete, so the stale value stays for the whole 6-hour TTL.",
          explanation:
            "Cache-aside has this read-write race. Keep TTLs short enough that a stale value cannot last long; delete the key again shortly after the write; or store a version with each value and refuse to cache a version older than the one the database holds."
        },
        rubric: [
          "Explain that the reader's stale write lands after the delete.",
          "Connect the long TTL to how long the error lasts.",
          "Propose mitigations such as short TTLs, delayed second delete, or versioned values."
        ],
        commonMistakes: ["Assuming delete-on-write makes cache-aside fully consistent."],
        interviewerFollowUps: ["How would write-through caching change this?"],
        interviewConnection:
          "This race separates candidates who have run caches in production from those who have only read about them."
      }),
      text({
        id: "backend-core-27",
        pathKey: "caching",
        title: "Decide what to cache on the dashboard",
        format: "production-decision",
        prompt:
          "The dashboard is slow. It shows the user's own orders, a global leaderboard, and whether the user can see the admin menu. Decide what to cache, how to key it, and for how long.",
        artifact: {
          kind: "scenario",
          title: "Dashboard parts",
          content:
            "Your recent orders: 120 ms query, changes when you order\nGlobal leaderboard: 900 ms query, same for everyone, fine if 1 minute old\nAdmin menu visibility: permission check, 15 ms, must update as soon as access is revoked\nIncident last year: a cached page showed one user's orders to another"
        },
        topicKeys: ["cache-design", "security"],
        hints: [
          "Shared data and per-user data need different keys.",
          "Some decisions must never be stale.",
          "Think about last year's incident when you design keys."
        ],
        answer: {
          concise:
            "Cache the leaderboard globally for about a minute, cache orders per user with the user id in the key and invalidate on new orders, and do not cache the permission check.",
          explanation:
            "The leaderboard is the expensive, shared part and tolerates staleness, so it gains the most. Per-user data must include the user id in the cache key, which is exactly what caused last year's leak. The permission check is cheap and must reflect revoked access immediately, so caching it adds risk for little gain."
        },
        rubric: [
          "Cache the expensive shared data with a TTL that fits its freshness needs.",
          "Key per-user data by user and invalidate it on change.",
          "Refuse to cache security decisions that must be current."
        ],
        commonMistakes: ["Caching whole responses with a key that ignores the user."],
        interviewerFollowUps: [
          "Would you cache at the CDN, in the app, or in Redis for each part?"
        ],
        interviewConnection:
          "Interviewers want to hear what you would not cache, not just what you would."
      }),
      text({
        id: "backend-core-28",
        pathKey: "caching",
        title: "Explain the Redis slowdown",
        format: "artifact-diagnosis",
        prompt:
          "Redis latency jumped and the hit rate fell overnight. Using the metrics, explain what happened and what you would change.",
        artifact: {
          kind: "metrics",
          title: "Redis overnight",
          content:
            "used_memory: 7.9 GB of maxmemory 8 GB\nevicted_keys: 0/min -> 45,000/min\nkeyspace hit rate: 94% -> 61%\nkeys without TTL: 71% (new 'session-v2' keys added yesterday)\nlargest key: report:all-orders, 380 MB\nmaxmemory-policy: allkeys-lru"
        },
        topicKeys: ["redis", "eviction"],
        hints: [
          "Memory is full, so Redis is evicting keys.",
          "Yesterday's release added keys that never expire.",
          "One key is huge."
        ],
        answer: {
          concise:
            "Memory filled up with new keys that never expire and one huge key, so Redis evicts useful keys and the hit rate drops.",
          explanation:
            "Give session-v2 keys a TTL, and remove or split the 380 MB key, which is also slow to read and delete. Then check whether 8 GB fits the real working set. With allkeys-lru, Redis evicts anything; if sessions must not be evicted, keep them in a separate instance with a different policy."
        },
        rubric: [
          "Connect full memory and evictions to the falling hit rate.",
          "Identify the missing TTLs and the oversized key as causes.",
          "Propose fixes such as TTLs, splitting big keys, sizing, or separate instances."
        ],
        commonMistakes: ["Doubling the Redis memory without fixing the keys that never expire."],
        interviewerFollowUps: ["What does the noeviction policy do when memory is full?"],
        interviewConnection:
          "Reading cache metrics shows you can operate a cache, not just add one."
      })
    ]
  },
  {
    key: "messaging",
    title: "Move work off the request safely",
    description: "Use queues without losing, duplicating, or reordering the work that matters.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "backend-core-29",
        pathKey: "messaging",
        title: "Find the lost confirmation emails",
        format: "artifact-diagnosis",
        prompt:
          "A few orders a day are saved but never get a confirmation email. Using the code and log, explain why and design a fix that cannot lose the event.",
        artifact: {
          kind: "code",
          language: "plaintext",
          title: "placeOrder (pseudocode) and log",
          content:
            "placeOrder(order):\n  db.transaction:\n    insert order\n  queue.publish('order.created', order.id)   # after commit\n\n# log\n11:42:07 order 8812 committed\n11:42:07 app instance restarted during deploy\n# no 'order.created' message for 8812"
        },
        topicKeys: ["outbox-pattern", "dual-writes"],
        hints: [
          "The database write and the queue publish are two separate operations.",
          "A crash between them keeps one and loses the other.",
          "Store the event in the same transaction as the order."
        ],
        answer: {
          concise:
            "The order commits, then the app dies before publishing, so the event is lost; use the transactional outbox pattern.",
          explanation:
            "Insert an outbox row with the event in the same transaction as the order. A separate relay reads unsent outbox rows, publishes them, and marks them sent. The event now exists if and only if the order does. The relay may publish twice after a crash, so the email consumer must deduplicate by event id."
        },
        rubric: [
          "Identify the dual-write problem between the database and the queue.",
          "Propose a transactional outbox with a relay.",
          "Note that consumers must handle duplicate delivery."
        ],
        commonMistakes: [
          "Publishing before commit, which can send emails for orders that roll back."
        ],
        interviewerFollowUps: ["How is change data capture related to the outbox pattern?"],
        interviewConnection:
          "The outbox pattern is a favourite interview topic because it tests whether you see failures between systems."
      }),
      choice({
        id: "backend-core-30",
        pathKey: "messaging",
        title: "Handle messages that arrive twice",
        format: "mcq",
        prompt:
          "The queue guarantees at-least-once delivery, and some customers receive two 'payment received' SMS messages. What is the right fix?",
        artifact: {
          kind: "logs",
          title: "Consumer log",
          content:
            "09:15:02 received msg m-4471 (payment p-90) -> SMS sent\n09:15:32 visibility timeout expired before ack (consumer was slow)\n09:15:33 received msg m-4471 (payment p-90) again -> SMS sent"
        },
        topicKeys: ["idempotent-consumers", "delivery-guarantees"],
        choices: [
          "Switch the queue to exactly-once delivery mode and remove duplicate handling.",
          "Acknowledge the message before sending the SMS.",
          "Make the consumer idempotent: record processed message or payment ids and skip duplicates before sending.",
          "Lower the visibility timeout so messages are redelivered faster."
        ],
        correctChoiceIndex: 2,
        hints: [
          "At-least-once means duplicates will happen; plan for them.",
          "Acknowledging early trades duplicates for lost messages.",
          "The consumer needs to remember what it has already done."
        ],
        answer: {
          concise:
            "Accept that duplicates happen and make the consumer idempotent by recording which payments already got an SMS.",
          explanation:
            "Store the payment id (or message id) with a unique constraint when the SMS is sent, and skip the send if it already exists. Acknowledging before processing loses messages when the consumer crashes, and 'exactly once' across a queue and an external SMS provider is not something the queue alone can guarantee."
        },
        commonMistakes: [
          "Relying on the broker's exactly-once feature for side effects in other systems."
        ],
        interviewerFollowUps: ["Why did the slow consumer cause a redelivery?"],
        interviewConnection:
          "Delivery guarantees are a core messaging question; the expected answer is idempotent consumers."
      }),
      interactive({
        id: "backend-core-31",
        pathKey: "messaging",
        title: "Handle a message that keeps failing",
        format: "production-decision",
        prompt:
          "Invoice generation fails for one message because a downstream service is down, and the consumer retries it instantly in a loop. Order what the consumer should do so the queue keeps moving and nothing is silently lost.",
        artifact: {
          kind: "metrics",
          title: "Invoice consumer",
          content:
            "Message inv-2210: failed 14,000 times in 10 minutes\nOther messages waiting behind it: 3,900\nDownstream PDF service: returning 503\nNo dead-letter queue configured"
        },
        topicKeys: ["retries", "dead-letter-queues"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            {
              id: "dlq",
              label: "Move the message to a dead-letter queue with the error attached."
            },
            { id: "replay", label: "Replay the dead-lettered messages after the cause is fixed." },
            { id: "backoff", label: "Retry with exponential backoff and jitter." },
            { id: "alert", label: "Alert the owning team when the dead-letter queue grows." },
            { id: "cap", label: "Stop after a maximum number of attempts." }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "backoff",
            second: "cap",
            label: "Retry with backoff before giving up",
            points: 2,
            explanation: "Transient failures often recover if you wait a little longer each time."
          },
          {
            type: "before",
            first: "cap",
            second: "dlq",
            label: "Give up only after the attempt limit",
            points: 3,
            explanation: "A cap stops one bad message from blocking the queue forever."
          },
          {
            type: "before",
            first: "dlq",
            second: "alert",
            label: "Park the message, then alert",
            points: 2,
            explanation: "The message is kept safely and a person knows it needs attention."
          },
          {
            type: "before",
            first: "alert",
            second: "replay",
            label: "Fix before replaying",
            points: 3,
            explanation: "Replaying before the cause is fixed only fails the same way again."
          }
        ],
        hints: [
          "Retrying instantly makes an outage worse.",
          "At some point the message must step aside for the others.",
          "Parked messages need a person and a way back."
        ],
        answer: {
          concise:
            "Back off with jitter, cap the attempts, move the message to a dead-letter queue, alert, then replay after the fix.",
          explanation:
            "Backoff gives the downstream service room to recover, and the cap keeps one message from blocking thousands behind it. The dead-letter queue keeps the failed work with its error so it is not lost, and replay returns it to normal processing once the cause is fixed."
        },
        commonMistakes: ["Dropping the message after a few failures so the queue keeps moving."],
        interviewerFollowUps: [
          "Which errors should skip retries and go straight to the dead-letter queue?"
        ],
        interviewConnection:
          "Retry and dead-letter design is a standard question for anyone who has run queue consumers."
      }),
      text({
        id: "backend-core-32",
        pathKey: "messaging",
        title: "Explain the order shipped before it was paid",
        format: "predict-explain",
        prompt:
          "Order events are processed by 4 consumers, and one order's status history shows 'shipped' before 'paid'. Explain how this can happen and how you would keep each order's events in order.",
        artifact: {
          kind: "logs",
          title: "Order o-331 events",
          content:
            "Topic: order-events, 8 partitions, message key: random UUID\n10:00:01.200 paid     published -> partition 2 (consumer B, backlog 40 s)\n10:00:03.900 shipped  published -> partition 6 (consumer D, no backlog)\n10:00:04.100 status history: shipped\n10:00:41.500 status history: paid"
        },
        topicKeys: ["message-ordering", "partitioning"],
        hints: [
          "Order is only guaranteed within one partition.",
          "The two events for the same order landed on different partitions.",
          "Choose the message key so related events share a partition."
        ],
        answer: {
          concise:
            "A random message key sent the order's events to different partitions, and the slower partition delivered 'paid' later.",
          explanation:
            "Use the order id as the message key, so every event for one order goes to the same partition and is consumed in order. As a safeguard, store a version or sequence number on the order and ignore events older than what is already applied."
        },
        rubric: [
          "Explain that ordering holds only within a partition.",
          "Key messages by order id so an order's events stay together.",
          "Add a version or sequence check for events that still arrive late."
        ],
        commonMistakes: ["Using one partition for everything, which removes all parallelism."],
        interviewerFollowUps: ["What happens to ordering when you add partitions later?"],
        interviewConnection:
          "Ordering questions check that you know what a queue actually guarantees."
      }),
      text({
        id: "backend-core-33",
        pathKey: "messaging",
        title: "Take the slow report off the request",
        format: "production-decision",
        prompt:
          "The 'Download annual statement' button takes 25 seconds and often hits the gateway's 30-second timeout. How would you redesign it, and what does the user see?",
        artifact: {
          kind: "metrics",
          title: "GET /statements/annual",
          content:
            "p50: 18 s, p95: 27 s, gateway timeout: 30 s\n4% of requests time out, and users click again\nEach click starts a new 25-second PDF build\nPeak: 300 requests per minute in the first week of April"
        },
        topicKeys: ["async-jobs", "queues"],
        hints: [
          "The user does not need the PDF inside the same HTTP request.",
          "Repeated clicks multiply the work.",
          "The client needs a way to know when the file is ready."
        ],
        answer: {
          concise:
            "Accept the request, return 202 with a job id, build the PDF in a background worker, and let the client poll or get notified when it is ready.",
          explanation:
            "POST /statements returns 202 Accepted with a job id at once. A worker builds the PDF from a queue and stores it; GET /statements/jobs/{id} returns the status and a download link. Reuse an existing job for the same user and year so repeated clicks do not start new builds, and notify the user by email when a build finishes."
        },
        rubric: [
          "Move the work to a background job and return 202 with a job id.",
          "Give the client a status endpoint or notification.",
          "Deduplicate repeated requests for the same statement."
        ],
        commonMistakes: ["Raising the gateway timeout to 60 seconds."],
        interviewerFollowUps: ["How would you size the workers for the April peak?"],
        interviewConnection:
          "Knowing when to move work to a queue is one of the most practical backend judgement calls."
      })
    ]
  }
];

/** Backend fundamentals are one track; Applied Engineering stays with the Node.js incidents. */
export function backendStoryPaths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[] {
  return track === "core-technical" ? core : [];
}
