import {
  reviewedArchitectureDesignArtifact,
  type ArchitectureDesignScenarioSeed
} from "./reviewed-scenario-builder";

type StageSeed = ArchitectureDesignScenarioSeed["questions"][number];

function stage(input: StageSeed): StageSeed {
  return input;
}

/**
 * Frontend system design: the browser client is the system under design.
 * The same sixteen dimensions apply, read from the client's side: capacity is
 * payload, DOM, memory, and Web Vitals budgets; contracts are the API the
 * client consumes; partitioning and hotspots are rendering and main-thread
 * work; consistency is optimistic updates and races between requests.
 */
const FRONTEND_REVIEW = {
  roles: ["frontend"],
  reviewStatus: "approved",
  reviewerId: "project-owner",
  reviewedAt: "2026-09-28",
  authoredAt: "2026-09-28T09:00:00.000Z",
  authoring: {
    provider: "anthropic",
    model: "claude",
    promptVersion: "architecture-design-frontend-content-v1"
  }
} satisfies Partial<ArchitectureDesignScenarioSeed>;

/** Scenarios kept out of Practice so the interview always has unseen ones. */
export const FRONTEND_INTERVIEW_ONLY_SCENARIO_KEYS = [
  "realtime-chat-web-client",
  "product-page-web-performance"
] as const;

export const FRONTEND_ARCHITECTURE_SCENARIOS = Object.freeze([
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "infinite-social-feed-client",
    title: "Infinite social feed web client",
    premise:
      "Design the web client for a social feed that loads posts endlessly, shows images and video previews, supports likes and comments, and stays smooth on mid-range phones and slow networks.",
    candidateRole:
      "You own the feed page on the client: component structure, data fetching and caching, list rendering, optimistic interactions, accessibility, performance budgets, and a safe rollout.",
    functionalRequirements: [
      "Show a personalised feed that loads more posts as the reader scrolls, including text, images, and muted autoplay video previews.",
      "Let readers like, comment, and hide posts with immediate feedback, and show new posts that arrived since the page opened without moving the reader's position."
    ],
    nonGoals: [
      "The first release will not build the ranking algorithm, the post composer, or a native mobile app."
    ],
    constraints: [
      "The feed API is ranked and can return a post that was already shown if ranking changes between two page requests.",
      "The page must stay usable with a keyboard and a screen reader, and must not shift content while the reader is looking at it."
    ],
    scaleProfile: [
      "Peak 1.2 million concurrent readers; a session scrolls through 150 posts on average and 600 posts at the 99th percentile.",
      "40 percent of sessions are on mid-range Android phones over 4G with 150 ms round trips; targets at p75 are LCP under 2.5 s and INP under 200 ms."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "feed-rendering",
    secondaryTopicKeys: ["client-caching", "optimistic-updates", "web-performance"],
    targetKeywords: [
      "frontend",
      "react",
      "infinite scroll",
      "virtualization",
      "web performance",
      "core web vitals",
      "accessibility",
      "optimistic ui"
    ],
    realismAnchors: [
      "A ranking change between two page requests returns five posts the reader has already seen.",
      "After 400 posts the tab holds 11,000 DOM nodes and INP climbs above 500 ms on mid-range phones.",
      "The like endpoint starts failing 8 percent of requests during a traffic spike while readers keep tapping like."
    ],
    targetFitExplanation:
      "An endless feed is the classic frontend system design question: it tests list rendering, client data modelling, optimistic interactions, and performance on real devices.",
    coverageExplanation:
      "Four connected decisions cover scope and budgets, the API and client store, rendering and failure handling, and a measured rollout across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn the feed experience into measurable scope, device and network assumptions, and performance and accessibility targets.",
        dependency:
          "The page size, memory, and latency budgets set here constrain the data contract and list architecture that follow.",
        topicKeys: ["feed-rendering", "web-performance"],
        prompt:
          "Define what the first release must do and what it will not. Using the brief, estimate how much data and how many DOM nodes a long session accumulates, choose a page size, and set measurable targets for loading, interaction, layout stability, and accessibility.",
        artifact: {
          key: "feed-session-brief",
          kind: "metrics",
          title: "Feed session brief",
          content:
            "Median post: 1.8 KB of JSON, one image (thumbnail 35 KB, full size 180 KB), about 25 DOM nodes when rendered. p99 session: 600 posts.\nMid-range phone: 4 GB RAM, a CPU about four times slower than a laptop.\n4G: 150 ms round trip, 6 Mbps.\nProduct asks for 'instant scrolling that never runs out of posts' and says the feed should 'work for everyone'.",
          caption: "Product wording has to become budgets that can be measured."
        },
        hints: [
          "Multiply posts per session by payload and DOM nodes per post to see what a long session keeps in memory.",
          "A page of posts should arrive in one round trip and fill more than one screen, so the reader never waits at the bottom.",
          "'Works for everyone' needs concrete keyboard, screen-reader, and fallback behavior, not just a speed target."
        ],
        referenceAnswer: {
          summary:
            "Scope a cursor-paginated feed with optimistic reactions, derive the page size from network and memory budgets, and commit to p75 Core Web Vitals and accessibility targets.",
          explanation:
            "The first release covers reading, liking, commenting, hiding, and a 'new posts' notice; the composer and ranking are out. A p99 session of 600 posts is about 1.1 MB of post JSON and roughly 15,000 DOM nodes if everything stays mounted, which a mid-range phone cannot keep interactive, so the list must be virtualized. A page of 20 posts is about 36 KB: one round trip on 4G and enough for two screens, so prefetch the next page when the reader is about one screen from the end. The feed loads thumbnails, not full images. Targets at p75 on mid-range Android: LCP under 2.5 s, INP under 200 ms, CLS under 0.1, and no content jumps when new posts arrive. Accessibility: every post is reachable by keyboard, the list uses feed and article semantics, focus is never lost when items unmount, and a visible 'load more' button is the fallback when automatic loading fails."
        },
        rubric: [
          {
            criterion:
              "Defines first-release scope, explicit non-goals, and how new posts appear without moving the reader.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates payload, DOM, and memory growth, and derives the page size and measurable Web Vitals targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Keeping every loaded post mounted in the DOM and discovering the memory and INP problem only in production.",
          "Setting a vague target such as 'fast scrolling' instead of p75 LCP, INP, and CLS on the devices most readers use.",
          "Treating accessibility as later polish, so infinite loading traps keyboard and screen-reader users."
        ],
        interviewerFollowUps: [
          "How would the page size change if most readers were on 3G with 400 ms round trips?"
        ],
        transferConnection:
          "Deriving page size and rendering strategy from payload and device budgets applies to any long list: tables, logs, search results, and chat history."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair the feed API contract and the client data model so pagination, duplicates, and interactions stay correct.",
        dependency:
          "The normalized post store and cursor contract become the source of truth the list, cache, and optimistic updates rely on.",
        topicKeys: ["client-caching", "optimistic-updates"],
        prompt:
          "Diagnose this proposed feed contract and client store. Specify the pagination contract, how the client stores and de-duplicates posts, how a like is recorded without double counting on retry, and what the client does when its local state and the server disagree.",
        artifact: {
          key: "feed-contract-draft",
          kind: "config",
          title: "Proposed feed contract and store",
          content:
            '```ts\n// GET /feed?page=3&limit=20\ntype FeedResponse = { posts: Post[] };\n\ntype Post = {\n  id: string;\n  author: Author; // the full author object\n  likeCount: number;\n  likedByMe: boolean;\n  comments: Comment[]; // every comment, on every post\n};\n\n// Client store: one array, every page appended\nlet posts: Post[] = [];\nfunction onPage(page: FeedResponse) {\n  posts = [...posts, ...page.posts];\n}\n\n// Like button\nasync function like(post: Post) {\n  await fetch("/posts/" + post.id + "/like", { method: "POST" });\n  post.likeCount += 1;\n}\n// After a timeout, the client sends the same POST again.\n```',
          caption:
            "Offset pages, an append-only array, and non-idempotent likes break as soon as ranking or the network misbehaves."
        },
        hints: [
          "Offset pages shift when ranking inserts or removes posts; think about what a cursor tells the server.",
          "Store posts by ID and keep the feed as an ordered list of IDs, so a duplicate or an update touches one record.",
          "Make the like request describe the desired state instead of an increment, and decide who wins when the server response disagrees."
        ],
        referenceAnswer: {
          summary:
            "Use an opaque cursor, a normalized ID-keyed store with an ordered list of IDs, idempotent set-state reactions, and server-authoritative reconciliation.",
          explanation:
            "The API returns { items, nextCursor }, where the cursor encodes the ranking snapshot, so pages do not skip or repeat when the feed changes; the client still de-duplicates by post ID because ranking can legitimately resurface a post. The client store is normalized: posts by ID, authors by ID, and the feed as an ordered list of post IDs with its cursor and loading state. Comments load separately with their own cursor instead of inflating every post. A like is PUT /posts/:id/reaction { liked: true } with an idempotency key, so a retry cannot double count; the client applies the change optimistically, remembers the previous value, and rolls back with a visible message on failure. The server response carries the authoritative likeCount and likedByMe and replaces the optimistic value, except that a newer local action wins over an older in-flight response, which the client tracks with a per-post sequence number."
        },
        rubric: [
          {
            criterion:
              "Defines a cursor-based page contract and idempotent, state-setting reaction requests.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Normalizes posts and authors by ID, with the feed as an ordered list of IDs.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Separates feed pages from comments and loads each with its own cursor and cache entry.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Reconciles optimistic state with server responses and ignores stale in-flight results.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Using offset pagination on a ranked feed, so posts are skipped or repeated when ranking changes between requests.",
          "Incrementing a counter locally and replaying the same POST on retry, which double counts likes.",
          "Appending raw pages into one array, so a duplicate or an edit has to be found and patched in several places."
        ],
        interviewerFollowUps: [
          "If the reader likes, unlikes, and likes again within a second, which response should the UI trust?"
        ],
        transferConnection:
          "Cursor pagination, normalized stores, and idempotent state-setting requests apply to any client that shows shared, changing data."
      }),
      stage({
        format: "written",
        objective:
          "Design the component and rendering architecture, then contain the slowdowns and failures shown in the trace.",
        dependency:
          "The list, cache, and optimistic flows must respect the normalized store and cursor contract from the previous stage.",
        topicKeys: ["feed-rendering", "web-performance"],
        prompt:
          "Sketch the client architecture: server versus client rendering for the first screen, the component tree and where state lives, list virtualization, image and video loading, request de-duplication, and error handling. Then use the trace to explain what went wrong and how your design prevents each problem.",
        artifact: {
          key: "feed-performance-trace",
          kind: "trace",
          title: "Feed session trace",
          content:
            "```log\nt=0: server-rendered HTML with the first 10 posts; hydration takes 1.9 s on a mid-range phone.\nt=45 s: the reader reaches post 420; 11,000 DOM nodes; INP 540 ms. Every like re-renders the whole feed. Two scroll events fire the same next-page request twice.\nt=60 s: the like API returns 503 for 8 percent of requests; the heart stays filled and never reverts. A failed image leaves a collapsed card and the content below jumps 300 px.\n```",
          caption: "Rendering, request, and failure problems appear together in one long session."
        },
        hints: [
          "Keep only the visible window plus a small buffer mounted, and reserve each card's height so recycling does not shift the layout.",
          "Subscribe each card to its own post record so a like re-renders one card, and de-duplicate in-flight page requests by cursor.",
          "Give every failure a defined, visible state: rollback with a message, retry with backoff, or a placeholder of fixed size."
        ],
        referenceAnswer: {
          summary:
            "Server-render the first screen, virtualize the list with reserved sizes, subscribe cards to their own records, de-duplicate requests, and give every failure a visible, bounded state.",
          explanation:
            "Render the first screen on the server with the first page embedded, and hydrate progressively so the feed shell is interactive before below-the-fold posts. The feed container owns the cursor and ID list; each PostCard subscribes to its own record, so a like re-renders one card. A virtualized list keeps the visible posts plus about one screen of buffer mounted, with measured or reserved heights and aspect-ratio boxes for media, so recycling and late images cause no layout shift. A request layer de-duplicates in-flight page requests by cursor, cancels requests for pages scrolled past, and prefetches one page ahead. Images use responsive sizes and lazy loading; video previews play only when mostly visible and pause off screen. Failures: a failed like rolls back with a short message and a retry reuses the same idempotency key; a failed page shows an inline retry button instead of an endless spinner; a failed image keeps its reserved box with a placeholder; an error boundary around each card stops one bad post from breaking the feed. Retries use exponential backoff with jitter, and repeated 503s pause optimistic reactions instead of piling up requests."
        },
        rubric: [
          {
            criterion:
              "Separates the feed container, post cards, and request layer with clear state ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Caches page requests by cursor and scopes re-renders to the post that changed.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Cancels, de-duplicates, and backs off network work instead of queuing unbounded requests.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Virtualizes the long list and keeps main-thread work off the scroll and input path.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Defines rollback, retry, placeholder, and error-boundary behavior for each failure in the trace.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Adding a virtualization library without reserving item sizes, which trades memory problems for constant layout shift.",
          "Letting one global store update re-render the whole feed on every like.",
          "Showing an optimistic like that never reverts when the request fails."
        ],
        interviewerFollowUps: [
          "How would the reader's scroll position survive opening a post and pressing back?"
        ],
        transferConnection:
          "Virtualization with reserved sizes and per-record subscriptions apply to dashboards, tables, and chat timelines."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide how to measure, secure, and roll out the new feed without risking the current one.",
        dependency:
          "The rollout compares the new client against the current feed using the budgets set in the first stage.",
        topicKeys: ["web-performance", "feed-rendering"],
        prompt:
          "Decide whether this rollout plan can go ahead. Define what you measure in real users, the security and privacy checks, the cost of the new client, how you roll out and roll back, and what you would change in the plan.",
        artifact: {
          key: "feed-rollout-plan",
          kind: "config",
          title: "Proposed feed rollout",
          content:
            "Plan: ship the new feed to 100 percent of readers on Friday with no feature flag.\nThe lab Lighthouse score went from 62 to 91 on a laptop.\nThe bundle grew from 180 KB to 310 KB gzipped (a new video player and an animation library).\nPost text from users is rendered with dangerouslySetInnerHTML to keep links clickable.\nError tracking logs the full post payload, including private comments.\nThere is no real-user monitoring for INP.",
          caption:
            "A good lab score is not evidence that real readers on mid-range phones are better off."
        },
        hints: [
          "Lab scores on a laptop do not predict p75 INP on mid-range phones; measure real users by device and network.",
          "User-generated text rendered as raw HTML is a cross-site scripting risk, even when links need to work.",
          "An extra 130 KB of JavaScript costs parse and execution time on slow CPUs; decide what loads only when needed."
        ],
        referenceAnswer: {
          summary:
            "Do not ship to everyone: add real-user monitoring, fix the XSS and logging risks, cut the bundle, and roll out behind a flag with stop rules and instant rollback.",
          explanation:
            "Block the Friday launch. Add real-user monitoring of LCP, INP, CLS, long tasks, and error rates by device class and network, with the current feed as the control. Replace dangerouslySetInnerHTML with a sanitizer or a safe link renderer and add a Content Security Policy; stop logging full payloads and private comments, and scrub personal data from error reports. Cut the bundle: load the video player only when a video enters the viewport, replace the animation library with CSS transitions, and enforce a per-route budget in CI. Roll out behind a flag to 1, 10, and 50 percent with stop rules such as p75 INP regressing by more than 20 ms or JavaScript errors rising by 0.2 percentage points, and keep the old feed deployable so the flag is an instant rollback. The trade-off to state: autoplay previews raise engagement but cost data and CPU, so respect reduced-data and reduced-motion preferences."
        },
        rubric: [
          {
            criterion:
              "Measures real-user Web Vitals and errors by device and network against the current feed.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Removes the XSS risk and keeps private content out of logs and error reports.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Budgets bundle size and data cost, loading heavy features only when needed.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains the engagement versus performance trade-off of autoplay and animation.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Rolls out behind a flag with stop rules and a tested rollback to the old feed.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Treating a laptop Lighthouse score as proof that real readers on mid-range phones are faster.",
          "Rendering user-generated HTML directly because links need to be clickable.",
          "Launching to everyone at once with no flag, so the only rollback is a new deploy."
        ],
        interviewerFollowUps: [
          "Which single metric would make you stop the rollout at 10 percent, and why that one?"
        ],
        transferConnection:
          "Flagged rollouts measured with real-user monitoring apply to every large client change, not only feeds."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "typeahead-search-client",
    title: "Typeahead search box",
    premise:
      "Design the search box for a large online store that suggests products, categories, and recent searches as the shopper types, and feels instant on phones and desktops.",
    candidateRole:
      "You own the search box on the client: input handling, request scheduling, caching, result rendering, keyboard and screen-reader behavior, and how its quality is measured.",
    functionalRequirements: [
      "Show up to eight suggestions (products, categories, and the shopper's recent searches) as the shopper types, with the matching part highlighted.",
      "Let shoppers pick a suggestion with mouse, touch, or keyboard, and go to the full search results page when they press Enter."
    ],
    nonGoals: [
      "The first release will not build the search ranking service, spelling correction models, or voice search."
    ],
    constraints: [
      "Suggestions for an older query must never replace suggestions for a newer query the shopper has already typed.",
      "The suggestion list must follow the ARIA combobox pattern and must not take focus away from the input."
    ],
    scaleProfile: [
      "Peak 45,000 new queries per second across all shoppers; a typical query is typed with 7 keystrokes about 120 ms apart.",
      "The suggestion API has p50 60 ms and p99 450 ms server time; the target is suggestions visible within 150 ms of a pause at p75."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "typeahead-ux",
    secondaryTopicKeys: ["request-scheduling", "client-caching", "accessibility"],
    targetKeywords: [
      "frontend",
      "autocomplete",
      "typeahead",
      "debounce",
      "accessibility",
      "aria",
      "search",
      "caching"
    ],
    realismAnchors: [
      "A slow response for 'iph' arrives after the response for 'iphone 15' and overwrites the newer suggestions.",
      "A marketing email brings three times normal traffic in five minutes, and the suggestion API starts returning 429 to the client.",
      "A screen-reader user reports that arrowing through suggestions reads nothing and Enter submits the wrong item."
    ],
    targetFitExplanation:
      "Typeahead is a compact frontend system design problem that tests request scheduling, race conditions, caching, and accessible interaction on real devices.",
    coverageExplanation:
      "Four connected decisions cover request volume, the suggestion contract and races, the component architecture under failure, and a privacy-aware experiment across all sixteen dimensions.",
    questions: [
      stage({
        format: "mcq",
        objective:
          "Choose a trigger and caching plan that keeps suggestions fast without multiplying request volume.",
        dependency:
          "The trigger, cancellation, and latency target chosen here shape the contract, scheduler, and metrics that follow.",
        topicKeys: ["typeahead-ux", "request-scheduling"],
        prompt:
          "Given the brief, which plan best balances responsiveness and request volume for the first release?",
        artifact: {
          key: "typeahead-load-brief",
          kind: "metrics",
          title: "Typeahead load brief",
          content:
            "7 keystrokes per query, about 120 ms apart; 45,000 new queries per second at peak.\nA request on every keystroke: about 315,000 requests per second.\nA 150 ms pause trigger: about 1.4 requests per query.\nServer time p50 60 ms, p99 450 ms.\nProduct wants suggestions 'on every keystroke'.",
          caption: "Request volume depends far more on the trigger than on server speed."
        },
        choices: [
          "Send a request on every keystroke so suggestions are always current, and scale the API to 315,000 requests per second.",
          "Wait about 150 ms after the last keystroke, cancel superseded requests, cache recent prefixes, and target suggestions within 150 ms of a pause at p75.",
          "Wait until the shopper has typed at least five characters, then send one request, so the API sees the fewest calls.",
          "Load the whole product catalogue into the browser when the page opens and filter it locally."
        ],
        correctChoiceIndex: 1,
        hints: [
          "Multiply keystrokes per query by query volume to see the load of per-keystroke requests.",
          "A short pause after typing is a better trigger than every keystroke or a long minimum length.",
          "Measure the time the shopper waits for suggestions, not only the server's response time."
        ],
        referenceAnswer: {
          summary:
            "Trigger on a short pause of about 150 ms, cancel superseded requests, cache prefixes, show recent searches instantly, and measure time from pause to visible suggestions.",
          explanation:
            "Per-keystroke requests multiply load by about seven, to roughly 315,000 requests per second at peak, and mostly fetch results the shopper never sees. A 150 ms pause trigger with cancellation brings this to about 1.4 requests per query while keeping suggestions inside the 150 ms target at p75. A minimum length of one or two characters, not five, keeps short common queries useful, and recent searches come from local storage instantly, before the network answers. Loading the whole catalogue is impossible at this size. Scope: products, categories, and recent searches with highlighting, full keyboard and screen-reader support, and Enter going to the results page. Measure time from pause to visible suggestions, suggestion click-through, zero-result rate, and error rate."
        },
        rubric: [
          {
            criterion:
              "Defines scope, the Enter fallback, recent searches, and explicit non-goals.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Quantifies request volume under different triggers and sets a pause-to-suggestion target.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Requesting on every keystroke and paying about seven times the load for results nobody sees.",
          "Setting a long minimum query length that makes short, common queries useless.",
          "Measuring API latency instead of the time the shopper waits for suggestions to appear."
        ],
        interviewerFollowUps: ["How would you change the pause trigger on a slow 3G connection?"],
        transferConnection:
          "Pause triggers, cancellation, and pause-to-feedback metrics apply to filters, validation as you type, and address lookups."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Define a suggestion contract and client state that make out-of-order responses and caching safe.",
        dependency:
          "The structured response, prefix cache, and latest-query rule become the inputs to the component architecture.",
        topicKeys: ["request-scheduling", "client-caching"],
        prompt:
          "Diagnose this suggestion contract and client state. Specify the request and response contract, how the client stores and reuses results, and how it guarantees that only the newest query's suggestions are shown.",
        artifact: {
          key: "typeahead-contract-draft",
          kind: "config",
          title: "Proposed suggestion contract",
          content:
            '```ts\n// GET /suggest?q=<raw text>  ->  string[]\nlet currentSuggestions: string[] = [];\n\nasync function onInput(query: string) {\n  const response = await fetch("/suggest?q=" + query);\n  // Replaced whenever any response arrives\n  currentSuggestions = await response.json();\n\n  // Every raw query typed, with no limit\n  const recent = JSON.parse(localStorage.getItem("recent") ?? "[]");\n  localStorage.setItem("recent", JSON.stringify([...recent, query]));\n}\n\n// Highlighting: the server returns an HTML string with <b> tags inserted\nsuggestionEl.innerHTML = suggestion;\n```',
          caption: "Untagged responses, unbounded storage, and server HTML each create a real bug."
        },
        hints: [
          "Responses can arrive out of order; the client needs a way to know which query a response belongs to.",
          "Return structured suggestions with type, ID, display text, and match ranges instead of HTML.",
          "Decide what is stored locally, how much, for how long, and how a shopper clears it."
        ],
        referenceAnswer: {
          summary:
            "Return typed, structured suggestions with match ranges and an echoed normalized query, cache by prefix, apply only the latest query's response, and store bounded, clearable recent searches.",
          explanation:
            "The contract is GET /suggest?q=<normalized>&limit=8&locale=... returning { query, items: [{ type, id, text, matchRanges, url }] }; the echoed query lets the client match a response to its request. The client normalizes input (trimmed, lower-cased, single spaces) and keeps a small in-memory LRU cache keyed by normalized prefix, so backspacing and retyping are instant. Each request carries an increasing sequence number and an AbortController; a response is applied only if it belongs to the latest query, and superseded requests are aborted. Highlighting is rendered from matchRanges as text nodes, never from server HTML. Recent searches are only the last ten submitted queries, not every keystroke, with a clear option, and they are not kept for signed-out shared devices if policy requires it."
        },
        rubric: [
          {
            criterion:
              "Defines a structured, locale-aware response with match ranges and an echoed query.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models suggestions, recent searches, and the prefix cache as explicit client data.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Bounds the in-memory cache and local storage and defines how each is read and cleared.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Applies only the newest query's response using sequence numbers or cancellation.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Letting any response overwrite the suggestions, so slow old results replace newer ones.",
          "Rendering server-supplied HTML for highlighting, which opens a cross-site scripting hole.",
          "Saving every keystroke to local storage with no limit and no way to clear it."
        ],
        interviewerFollowUps: [
          "What happens if the cached suggestions for a prefix are ten minutes old and a product has been removed?"
        ],
        transferConnection:
          "Tagging each response with the request it answers is the general fix for races between overlapping async requests."
      }),
      stage({
        format: "written",
        objective:
          "Design the search box's components and behavior so typing stays fast and every failure has a defined state.",
        dependency:
          "The scheduler and list must enforce the latest-query rule and the prefix cache defined in the contract.",
        topicKeys: ["typeahead-ux", "accessibility"],
        prompt:
          "Sketch the components and data flow for the search box: input handling, the request scheduler, cache, result list, and keyboard model. Then explain how your design behaves in each situation in the incident notes.",
        artifact: {
          key: "typeahead-incident-notes",
          kind: "logs",
          title: "Search box incident notes",
          content:
            "```log\n1) The result list re-renders on every keystroke even when the response is cached; typing lags on low-end phones.\n2) During a traffic spike the API returns 429 with Retry-After: 2; the client keeps sending requests.\n3) When the API is down the dropdown shows a spinner forever.\n4) On mobile the on-screen keyboard covers half the suggestions.\n5) Arrow keys scroll the page instead of moving the highlighted suggestion.\n```",
          caption: "Performance, overload, outage, layout, and accessibility failures in one box."
        },
        hints: [
          "Keep the input responsive: typing should never wait for rendering suggestions or for the network.",
          "Treat 429 and Retry-After as instructions: pause, then resume with the latest query only.",
          "Define what the dropdown shows when the network is slow, failing, or empty, and keep keyboard focus in the input."
        ],
        referenceAnswer: {
          summary:
            "Keep typing on a fast path, schedule and cancel requests in one place, honour Retry-After, fall back to recent searches, and implement the combobox keyboard model with suggestions that stay visible.",
          explanation:
            "SearchBox owns the input value; a request scheduler owns the pause trigger, cancellation, sequence numbers, and the prefix cache; SuggestionList renders items and the highlighted index from state. Input updates are never blocked: list rendering is deferred (for example with a transition) and memoized per item, so cached results render without re-rendering the input. On 429 the scheduler stops sending, waits for Retry-After, then sends only the latest query; repeated failures open a short circuit breaker and the dropdown falls back to recent searches with a quiet 'suggestions unavailable' note, while Enter still goes to the results page. A timeout of about 2 s replaces the endless spinner. The combobox follows the ARIA pattern: focus stays in the input, aria-activedescendant points at the highlighted option, arrows move the highlight and prevent page scrolling, Escape closes, and Enter selects the highlighted item or submits the query. On mobile the list sizes itself to the visual viewport above the on-screen keyboard."
        },
        rubric: [
          {
            criterion: "Separates input, request scheduler, cache, and list with clear ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Serves cached prefixes without refetching and without re-rendering the input.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Uses a pause trigger, cancellation, and Retry-After instead of retrying blindly.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Keeps the typing path free of expensive rendering work on low-end devices.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Defines timeout, fallback, and circuit-breaker behavior while Enter always works.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Retrying immediately on 429, which turns a traffic spike into an outage for everyone.",
          "Moving browser focus onto the suggestions, which breaks typing and confuses screen readers.",
          "Letting the dropdown spin forever when the API is down instead of falling back."
        ],
        interviewerFollowUps: [
          "How would you keep the highlighted suggestion stable when new results arrive while the shopper is arrowing down?"
        ],
        transferConnection:
          "Separating a fast input path from slower rendering and network work applies to editors, forms, and command palettes."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide which improvement to ship first, with real-user measurement, privacy safeguards, and a safe rollout.",
        dependency:
          "The experiment is judged against the latency and quality targets set in the first stage.",
        topicKeys: ["typeahead-ux", "client-caching"],
        prompt:
          "Decide which of these two improvements to ship first and how. Define how you measure success in real users, the privacy and security checks, the cost, and how you roll out and roll back.",
        artifact: {
          key: "typeahead-release-options",
          kind: "config",
          title: "Proposed search box improvements",
          content:
            "Option A: prefetch suggestions for each first letter on page load for all shoppers (26 requests per page view, about 2 percent of all API cost).\nOption B: personalised suggestions from browsing history (sends the last 20 viewed product IDs with every suggest request).\nA lab study with 40 employees shows B raising click-through from 21 to 25 percent.\nNo A/B testing is wired to the search box.\nSuggest requests are logged with the full query and user ID for 13 months.",
          caption: "Neither option has been measured with real shoppers."
        },
        hints: [
          "A lab study with 40 employees does not show how real shoppers respond; plan a controlled experiment.",
          "Sending browsing history with every request and logging queries with user IDs are privacy decisions, not only engineering ones.",
          "Prefetching on every page view costs money whether or not the shopper searches; target it."
        ],
        referenceAnswer: {
          summary:
            "Ship neither blindly: run B as a flagged A/B test with privacy safeguards, replace blanket prefetching with warm-up on focus, and measure latency, click-through, and zero-result rate.",
          explanation:
            "Wire the search box to the experiment system first. Test personalization behind a flag with a control group, measuring click-through, searches that lead to a product view, zero-result rate, and pause-to-suggestion latency by device; the 40-person lab result is only a hypothesis. For privacy, send a short-lived server-side personalization token instead of raw browsing history, respect consent and signed-out states, and cut query logs to what analytics needs, with user IDs removed or pseudonymized and a shorter retention. Replace Option A's 26 blanket requests with warming the cache when the input receives focus, which targets shoppers who are about to search. Roll out to 5, 25, and 50 percent with stop rules on latency and error rate and a flag for instant rollback. The trade-off: personalization can raise relevance but adds payload, privacy obligations, and a new failure path, so non-personalised suggestions stay as the fallback."
        },
        rubric: [
          {
            criterion:
              "Measures pause-to-suggestion time, click-through, and zero-result rate in real users by device.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Replaces raw history and identifiable logs with consented, minimized data and shorter retention.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Targets prefetching to shoppers who focus the search box instead of every page view.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Weighs relevance gains against latency, privacy, and failure costs with evidence.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Rolls out behind a flag with a control group, stop rules, and rollback.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Treating a small internal lab study as proof that a feature helps real shoppers.",
          "Sending raw browsing history with every request triggered while typing.",
          "Prefetching on every page view and paying for requests that never become searches."
        ],
        interviewerFollowUps: [
          "What would you do if personalised suggestions raise click-through but also raise p75 latency by 60 ms?"
        ],
        transferConnection:
          "Targeted prefetching and flagged experiments with minimized personal data apply to recommendations and any predictive UI."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "offline-field-inspection-app",
    title: "Offline-first field inspection app",
    premise:
      "Design a web app that building inspectors use on tablets to fill in checklists, take photos, and submit reports from basements and rural sites with no signal, syncing everything when they reconnect.",
    candidateRole:
      "You own the installable web client: offline storage, the sync engine, conflict handling, photo uploads, sign-in while offline, and safe updates of the app itself.",
    functionalRequirements: [
      "Let inspectors open assigned inspections, fill checklists, add notes and photos, and submit reports while completely offline.",
      "Sync all offline work when the device reconnects, show exactly what is still pending, and never silently lose an inspector's edits."
    ],
    nonGoals: [
      "The first release will not support editing the same inspection from two devices at once, or building a native app."
    ],
    constraints: [
      "A supervisor can reassign or edit an inspection on the server while the inspector is offline.",
      "Tablets are shared between shifts, and inspection data includes personal details of building occupants."
    ],
    scaleProfile: [
      "8,000 inspectors; each works up to 10 hours offline and captures about 60 photos of 3 MB and 400 checklist edits per shift.",
      "Mid-range tablets with 32 GB of storage; browsers may evict site data under storage pressure unless persistent storage is granted."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "offline-sync",
    secondaryTopicKeys: ["client-storage", "conflict-resolution", "service-workers"],
    targetKeywords: [
      "frontend",
      "pwa",
      "offline",
      "service worker",
      "indexeddb",
      "sync",
      "conflict resolution",
      "uploads"
    ],
    realismAnchors: [
      "An inspector's sign-in expires after 8 hours while she is still offline with 300 unsynced edits.",
      "A supervisor changes two checklist answers on the server while the inspector changes the same answers offline.",
      "Reconnection happens on a weak signal: 60 photos start uploading at once, the connection drops at 40 percent, and the browser is closed."
    ],
    targetFitExplanation:
      "Offline-first clients test storage limits, sync protocols, conflict handling, and app updates, which frontend engineers increasingly own end to end.",
    coverageExplanation:
      "Four connected decisions cover storage and durability budgets, the sync contract, the service worker and sync engine under failure, and fleet operations across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Define offline scope and turn 'never lose data' into storage, durability, and sync targets.",
        dependency:
          "The storage budget and durability definition shape the local data model and sync contract that follow.",
        topicKeys: ["offline-sync", "client-storage"],
        prompt:
          "Define the first-release offline behavior and non-goals. Estimate how much the device must store for a full offline shift, and set measurable targets for data safety, sync time, and starting the app offline.",
        artifact: {
          key: "offline-shift-brief",
          kind: "metrics",
          title: "Offline shift brief",
          content:
            "Per shift: 60 photos of 3 MB, 400 checklist edits of about 0.5 KB, and 15 inspections with forms and reference PDFs of about 2 MB each.\nUpload bandwidth on reconnection: 2 to 5 Mbps.\nBrowser storage is best-effort by default and can be evicted; persistent storage must be requested.\nProduct asks for 'works offline, syncs automatically, never loses data'.",
          caption: "'Never loses data' needs a definition before it can be designed."
        },
        hints: [
          "Add up photos, edits, and cached reference files, then compare with what the browser keeps without eviction.",
          "Photos dominate; estimate how long they take to upload on the stated bandwidth.",
          "Define when an edit counts as safe on the device and when it counts as safe on the server."
        ],
        referenceAnswer: {
          summary:
            "Scope offline capture and submission with a visible pending queue, request persistent storage for about 250 MB per shift, and set targets for durable local saves, sync completion, and offline start-up.",
          explanation:
            "The first release lets inspectors open assigned inspections offline, edit checklists, take photos, and submit; editing from two devices and a native app are out. Storage per shift: photos 180 MB, reference files about 30 MB, and edits about 0.2 MB, so roughly 210 to 250 MB with headroom. That fits easily on 32 GB, but only survives if the app requests persistent storage and warns the inspector when it is denied. Uploading 180 MB at 2 to 5 Mbps takes about 5 to 12 minutes, so sync must be resumable and visible. Targets: every edit written to IndexedDB within 100 ms of the change, which is when data counts as safe on the device; zero lost edits across app restarts; the app shell starting offline in under 3 seconds; 99 percent of pending work synced within 15 minutes of a stable connection; and a pending count that is always accurate."
        },
        rubric: [
          {
            criterion: "Defines offline scope, a visible pending state, and explicit non-goals.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates storage and upload time per shift and sets durability, sync, and start-up targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Assuming browser storage is permanent, so data is evicted under storage pressure.",
          "Promising 'never loses data' without saying when an edit counts as safely stored.",
          "Ignoring that photo uploads take minutes on field connections."
        ],
        interviewerFollowUps: [
          "What would you do if the browser refuses the persistent storage request?"
        ],
        transferConnection:
          "Budgeting local storage and defining when data is durable apply to any offline-capable or local-first client."
      }),
      stage({
        format: "production-decision",
        objective:
          "Choose a sync contract and local data model that survive retries, conflicts, and large uploads.",
        dependency:
          "The outbox, change IDs, and upload records become what the sync engine and service worker operate on.",
        topicKeys: ["offline-sync", "conflict-resolution"],
        prompt:
          "Choose the sync contract and local data model from these two designs. Specify identities, the outbox format, how the server accepts or rejects changes, and what happens to changes made against an inspection that changed on the server.",
        artifact: {
          key: "offline-sync-options",
          kind: "config",
          title: "Sync design options",
          content:
            'Design 1: when online, PUT the whole inspection; last write wins by server arrival time; photos go in the same request as base64.\n\n```json\nPUT /inspections/insp_4821\n{\n  "id": "insp_4821",\n  "fields": { "roofCondition": "cracked", "notes": "..." },\n  "photos": ["data:image/jpeg;base64,/9j/4AAQ..."]\n}\n```\n\nDesign 2: each change is an outbox entry; photos upload separately in chunks with an upload ID; the server answers accepted, rejected, or conflict for each change.\n\n```json\n{\n  "changeId": "chg_01H9Z...",\n  "inspectionId": "insp_4821",\n  "field": "roofCondition",\n  "value": "cracked",\n  "baseVersion": 7,\n  "createdAt": "2026-09-27T10:42:11Z"\n}\n```',
          caption: "Only one design survives a retry, a supervisor edit, and a dropped upload."
        },
        hints: [
          "Client-generated IDs let the server recognise a retried change instead of applying it twice.",
          "Sending the version a change was based on lets the server detect that someone else changed the same field.",
          "Large photos need their own resumable upload path, separate from small checklist changes."
        ],
        referenceAnswer: {
          summary:
            "Choose Design 2: an IndexedDB outbox of field-level changes with client IDs and base versions, a verdict per change from the server, and separate resumable photo uploads.",
          explanation:
            "Design 1 overwrites supervisor edits through whole-document last-write-wins by arrival time, re-sends megabytes of base64 photos on every retry, and cannot recover from partial failure. With Design 2, IndexedDB stores each inspection with its server version, a local working copy, an outbox of changes with UUID change IDs, and photo records with upload state. The sync API accepts a batch of changes and returns a verdict for each: accepted with the new version, rejected with a reason such as 'reassigned', or conflict with the server's current value. Replaying a change ID is a no-op, so retries after a dropped connection are safe. Photos use a separate chunked, resumable upload (create, send chunks, finalize) keyed by a client photo ID and attached to the inspection by reference only after finalize. Changes against a newer server version apply when they touch different fields; conflicting fields go to the inspector to resolve instead of being silently overwritten."
        },
        rubric: [
          {
            criterion:
              "Defines a batched change contract with a verdict per change and separate resumable uploads.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models inspections, working copies, the outbox, and photo upload state with stable client IDs.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Uses IndexedDB access patterns for the outbox and working copy, and keeps photos out of the change stream.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Uses base versions and idempotent change IDs to detect conflicts and survive retries.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Uploading the whole document with last-write-wins, which silently erases supervisor edits.",
          "Sending photos in the same request as small edits, so one failed upload re-sends everything.",
          "Generating new IDs on retry, so the server applies the same change twice."
        ],
        interviewerFollowUps: [
          "Which fields would you allow to merge automatically, and which must always go to the inspector?"
        ],
        transferConnection:
          "Outboxes with idempotent change IDs and base versions apply to any client that edits shared data while offline."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Design the service worker and sync engine so updates, uploads, sign-in expiry, and multiple tabs never lose work.",
        dependency:
          "The sync engine drains the outbox and upload records defined in the contract without changing their identities.",
        topicKeys: ["service-workers", "offline-sync"],
        prompt:
          "Diagnose this field report. Explain the architecture of the service worker, local store, and sync engine, and describe exactly how your design handles each failure.",
        artifact: {
          key: "offline-field-report",
          kind: "logs",
          title: "Field incident report",
          content:
            "```log\n1) After an app update, inspectors who were offline all day see a blank screen: the new service worker deleted the old cache before the new files had downloaded.\n2) On reconnect, 60 photo uploads start at once; the connection drops; all restart from zero.\n3) Sign-in expired while offline; sync fails with 401 and the app deletes the outbox 'to reset state'.\n4) Two browser tabs both run sync and send the same changes.\n5) A sync error shows 'Something went wrong' and the pending count reads 0.\n```",
          caption: "Each failure either loses work, duplicates it, or hides it."
        },
        hints: [
          "App-shell caching and updates need an order that never leaves the device without a complete working version.",
          "One sync coordinator should own the outbox, with bounded concurrency and resumable uploads.",
          "An authentication failure is a reason to pause and ask for sign-in, never a reason to delete unsynced work."
        ],
        referenceAnswer: {
          summary:
            "Version the app shell and swap caches only after the new one is complete, run one coordinated sync with bounded resumable uploads, pause on sign-in failure without touching the outbox, and keep the pending state truthful.",
          explanation:
            "The service worker pre-caches a versioned app shell; a new version installs into a new cache and activates only when that cache is complete, the old cache is removed only after activation, and the app shows an 'update ready' prompt instead of reloading in the middle of an inspection. The sync engine is a single coordinator chosen with a Web Lock (or BroadcastChannel), so only one tab syncs; it drains the outbox in order per inspection with bounded concurrency (for example two photo uploads at a time) and exponential backoff with jitter. Photo uploads are chunked and resumable, recording confirmed chunks in IndexedDB, so a dropped connection resumes where it stopped. On 401 the engine pauses, leaves the outbox untouched, and asks the inspector to sign in; sync resumes afterwards. The UI reads the pending count from the outbox itself, shows errors per item with a retry, and presents 'rejected' and 'conflict' verdicts as tasks for the inspector rather than as a generic error."
        },
        rubric: [
          {
            criterion:
              "Separates service worker, local store, sync coordinator, and UI status with clear ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Versions and swaps app-shell caches without ever leaving a device without a working app.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Bounds upload concurrency and resumes chunked uploads with backoff.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Coordinates a single sync owner across tabs and orders work per inspection.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Pauses on sign-in and network failures without losing or duplicating outbox entries.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Deleting the old service worker cache before the new version has fully downloaded.",
          "Clearing unsynced work to recover from a sign-in or sync error.",
          "Letting every open tab run its own sync loop."
        ],
        interviewerFollowUps: [
          "How would the inspector know which of her 300 edits were rejected, and why?"
        ],
        transferConnection:
          "Single-owner coordination, resumable transfers, and never discarding user work apply to any sync or upload client."
      }),
      stage({
        format: "written",
        objective:
          "Plan monitoring, privacy on shared devices, cost, and schema evolution for clients that are offline for days.",
        dependency:
          "Evolution must keep the outbox and sync contract working for inspectors who have not updated yet.",
        topicKeys: ["offline-sync", "client-storage"],
        prompt:
          "Plan how you would monitor this app in the field, protect occupants' personal data on shared tablets, keep costs sensible, and change the local data format and sync API without breaking inspectors who are offline for days.",
        artifact: {
          key: "offline-fleet-snapshot",
          kind: "metrics",
          title: "Fleet snapshot",
          content:
            "8,000 tablets; 12 percent run an app version older than 30 days; 3 percent have outboxes older than 72 hours.\nError tracking receives nothing from offline devices.\nShared tablets keep the previous inspector's data after sign-out.\n1.4 TB of photos are uploaded per day.\nA new checklist schema (v3) renames 40 fields next month.",
          caption: "Offline clients break the usual assumptions about monitoring and releases."
        },
        hints: [
          "Offline devices cannot report errors live; decide what is buffered locally and sent later.",
          "Shared devices need data cleared on sign-out, but only once unsynced work is safe.",
          "Old app versions will send old-format changes for days after a schema change; plan for both formats."
        ],
        referenceAnswer: {
          summary:
            "Buffer telemetry offline, protect shared-device data at sign-out, compress photos on the device, and version the local schema and sync API with a compatibility window.",
          explanation:
            "Monitoring: record sync outcomes, outbox age, storage use, and errors in a local telemetry buffer sent on reconnect; alert on outbox age over 48 hours and app versions older than 30 days, and track sync completion time against the 15-minute target. Privacy: sign-out is blocked while unsynced work exists, and otherwise clears IndexedDB, caches, and photos; the app requests only the occupant data needed for assigned inspections and never logs personal details. Cost: resize and compress photos on the device (for example to about 1.5 MB) before upload, and download reference PDFs once per version. Evolution: version the IndexedDB schema with upgrade migrations; the sync API accepts both v2 and v3 field names during a migration window and maps old names on the server; the client sends its schema version with every sync; a minimum supported app version forces an update only once the outbox is empty. The trade-off: supporting two schemas costs server work but avoids stranding inspectors who are offline."
        },
        rubric: [
          {
            criterion:
              "Buffers telemetry offline and monitors outbox age, sync time, and version spread.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Clears shared-device data only once unsynced work is safe, and minimizes personal data.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Reduces photo and reference download cost on the device.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains the cost of supporting two schemas against stranding offline users.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Versions local storage and the sync API with a compatibility window and safe forced updates.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Relying on live error tracking for devices that are offline most of the day.",
          "Clearing shared-device data on sign-out even when edits have not synced yet.",
          "Renaming fields in one release and rejecting changes from clients that have been offline since."
        ],
        interviewerFollowUps: [
          "How long would you keep accepting the old schema, and what evidence would let you stop?"
        ],
        transferConnection:
          "Offline telemetry buffers and compatibility windows apply to any client that can go days without talking to the server."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "design-system-rollout",
    title: "Design system for twelve product teams",
    premise:
      "Design a shared component library and design tokens that twelve product teams use across three web apps, so the products look and behave consistently, stay accessible, and can be updated without breaking each other.",
    candidateRole:
      "You own the design system as a platform: component APIs, theming, packaging and versioning, accessibility, performance budgets, and how teams adopt and upgrade it.",
    functionalRequirements: [
      "Provide accessible components (buttons, inputs, dialogs, menus, tables) and design tokens for colour, spacing, and typography, in light and dark themes.",
      "Let teams upgrade at their own pace with clear release notes, and let designers change a token once and see it everywhere."
    ],
    nonGoals: [
      "The first release will not rebuild existing product pages or provide a visual page builder."
    ],
    constraints: [
      "The three apps use React 17, 18, and 19, and one of them is mostly server-rendered pages with very little client JavaScript.",
      "Brand colours must meet WCAG AA contrast in both themes, and using the library correctly must never produce an inaccessible dialog."
    ],
    scaleProfile: [
      "12 teams and 3 apps with about 4,000 component usages today, spread across four copies of similar components.",
      "The largest app's route bundles must stay under 170 KB of JavaScript; designers ship about two token changes a week."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "component-library",
    secondaryTopicKeys: ["design-tokens", "accessibility", "release-management"],
    targetKeywords: [
      "frontend",
      "design system",
      "component library",
      "design tokens",
      "accessibility",
      "storybook",
      "versioning",
      "theming"
    ],
    realismAnchors: [
      "A patch release changes a Button's default type from 'button' to 'submit', and forms in two apps start submitting unexpectedly.",
      "The dark theme ships and a token change drops body-text contrast below 4.5:1 on three pages.",
      "The mostly server-rendered app imports the library's root entry point and its route bundle grows by 90 KB."
    ],
    targetFitExplanation:
      "Senior frontend interviews often ask how to build and roll out shared UI infrastructure; this case tests API design, packaging, accessibility, and migration at organisation scale.",
    coverageExplanation:
      "Four connected decisions cover scope from usage data, component and token contracts, packaging and release gates, and a measured migration across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Choose the first-release components and tokens from usage and risk, and set measurable targets.",
        dependency:
          "The chosen components and targets define the contracts and release gates designed next.",
        topicKeys: ["component-library", "accessibility"],
        prompt:
          "Define the first release: which components and tokens it includes, who it serves, and what it will not do. Use the inventory to size the work and set measurable targets for adoption, accessibility, performance, and upgrade effort.",
        artifact: {
          key: "design-system-inventory",
          kind: "metrics",
          title: "Component inventory",
          content:
            "Today: 4 button variants, 3 modal implementations (2 fail keyboard focus trapping), 5 date pickers, 38 hard-coded colour values, no shared tokens.\nUsage counts: Button 1,450, Input 980, Modal 310, Menu 260, Table 180.\nTeams report spending 2 to 5 days per quarter redoing visual changes by hand.",
          caption: "Usage and known defects show where a design system pays off first."
        },
        hints: [
          "Usage counts show which components give the most value first.",
          "Accessibility bugs in the existing modals are a strong reason to include dialogs early.",
          "Make targets measurable: adoption by share of usages, accessibility by automated and manual checks, bundle size per component."
        ],
        referenceAnswer: {
          summary:
            "Start with tokens and the most-used, riskiest components, and commit to measurable adoption, accessibility, bundle-size, and upgrade-effort targets.",
          explanation:
            "First release: tokens (colour, spacing, type, radius, motion) in light and dark themes, plus Button, Input, Dialog, Menu, and Table, which cover about 3,180 of roughly 4,000 usages and replace the modals that fail focus trapping. Out of scope for now: rebuilding pages, and date pickers, which are complex and less used, until the core is proven. Targets: 70 percent of usages of these components migrated within two quarters; zero known WCAG AA failures in library components, checked by automated tests plus a manual screen-reader pass before each minor release; each component within a published size budget (for example Button under 3 KB gzipped) with tree-shaking verified; and a minor upgrade taking a team less than half a day, tracked through adoption lag."
        },
        rubric: [
          {
            criterion:
              "Chooses first-release components and tokens from usage and risk, with explicit non-goals.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Sizes the migration from the inventory and sets adoption, accessibility, bundle, and upgrade targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Starting with the most interesting component instead of the most used or riskiest ones.",
          "Promising accessibility without saying how it is tested before each release.",
          "Ignoring bundle size until a product team complains."
        ],
        interviewerFollowUps: ["How would you decide when to add the date picker?"],
        transferConnection:
          "Choosing platform scope from usage data and risk applies to shared APIs, SDKs, and internal tools."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Define component and token contracts that work across React versions, server rendering, and themes.",
        dependency:
          "The contracts and versioning rules decide what the packaging and release pipeline must protect.",
        topicKeys: ["design-tokens", "release-management"],
        prompt:
          "Diagnose this proposed component API and token setup. Specify the component contracts, how tokens are defined and delivered to apps, how theming works across React versions and the server-rendered app, and how consumers know a change is breaking.",
        artifact: {
          key: "design-system-api-draft",
          kind: "config",
          title: "Proposed component API",
          content:
            '```tsx\n// Any CSS colour, numeric sizes\n<Button color="#1a73e8" size={2} onClick={save} />\n\n// Tokens: a JavaScript object imported by components at runtime\nexport const tokens = { primary: "#1a73e8", text: "#1f1f1f" };\n\n// Dark mode swaps the object through React context,\n// which the server-rendered app cannot use.\n<ThemeContext.Provider value={darkTokens}>{children}</ThemeContext.Provider>\n```\n\n```json\n// package.json in every product app\n{ "dependencies": { "@acme/ui": "^4.0.0" } }\n```\n\nThe package is published as one "latest" build. Breaking changes are announced in Slack.',
          caption:
            "Raw values, runtime-only tokens, and chat announcements do not scale to twelve teams."
        },
        hints: [
          "Constrain component props to design decisions such as variants and sizes, not raw values.",
          "Tokens delivered as CSS custom properties work in any framework and on server-rendered pages without JavaScript.",
          "Semantic versioning, a changelog, and automated checks turn 'announced in Slack' into something teams can rely on."
        ],
        referenceAnswer: {
          summary:
            "Expose variant-based component APIs, generate tokens as semantic CSS variables from one source, theme by switching variable sets, and enforce semantic versioning with changelogs and API checks.",
          explanation:
            "Components take variant and size props from a fixed set (variant 'primary', 'secondary', or 'danger'; size 'sm', 'md', or 'lg'), forward refs and native attributes, and default type='button' so they never submit a form by accident. Tokens are authored once in a source format such as JSON, and a build step generates CSS custom properties with semantic names (--color-text-primary, --space-3) plus typed exports; themes are variable sets switched by a data-theme attribute on the root element, which works in React 17 to 19 and in the server-rendered app with no JavaScript. Styles avoid runtime CSS-in-JS, so server rendering and bundle size stay predictable. Releases follow semantic versioning with a generated changelog; an API check fails the build when a public prop or export changes without a major version; deprecated props log a development-only warning for one major version before removal."
        },
        rubric: [
          {
            criterion: "Defines constrained, variant-based component contracts with safe defaults.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models tokens with semantic names generated from one source, and themes as token sets.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Delivers tokens as CSS variables usable without JavaScript, and styles without runtime injection.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Enforces semantic versioning, changelogs, and automated breaking-change detection.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Accepting raw colours and pixel values as props, which undoes the point of shared tokens.",
          "Delivering tokens only through React context, which the server-rendered app cannot use.",
          "Announcing breaking changes in chat instead of versioning them."
        ],
        interviewerFollowUps: ["How would you rename a token that 900 places use today?"],
        transferConnection:
          "Constrained contracts, artifacts generated from one source, and enforced semantic versioning apply to any shared library or API."
      }),
      stage({
        format: "written",
        objective:
          "Design the packaging and release pipeline so regressions are caught in the library, not in product apps.",
        dependency:
          "The pipeline must enforce the contracts, tokens, and versioning rules defined in the previous stage.",
        topicKeys: ["component-library", "release-management"],
        prompt:
          "Sketch the architecture of the library and its delivery pipeline: packages, build outputs, documentation, tests, and how apps consume it. Then explain how your design would have prevented or contained each incident.",
        artifact: {
          key: "design-system-incidents",
          kind: "logs",
          title: "Design system incidents",
          content:
            "```log\n1) A patch release changed Button's default type to 'submit'; forms in two apps submitted on every click.\n2) A token change dropped dark-theme body text to 3.2:1 contrast; nobody noticed for a week.\n3) The server-rendered app imported from the package root and pulled in the Table and charting code (+90 KB).\n4) Two teams pinned different major versions; a shared header rendered two different Button styles on one page.\n5) Dialog broke focus return in React 19 only.\n```",
          caption:
            "Each incident reached users because the library's own pipeline did not catch it."
        },
        hints: [
          "Automated checks in the library's own pipeline are cheaper than finding problems in product apps.",
          "Package boundaries and module exports decide what tree-shaking can remove.",
          "Test each component against every React version and rendering mode the consumers use."
        ],
        referenceAnswer: {
          summary:
            "Package tokens, primitives, and heavy components separately with per-component entry points, and gate every release on behavior, accessibility, contrast, visual, bundle, and cross-version tests.",
          explanation:
            "Structure: a tokens package (generated CSS variables and types), a core package (primitives such as Button and Input), and separate entry points for heavy components (Table, charts), each with ES module builds, per-component exports, and side effects declared so bundlers can tree-shake; the server-rendered app imports individual components only. Documentation and examples live in a component workshop that doubles as the test harness. Every pull request runs unit tests, interaction tests for keyboard and focus behavior, automated accessibility checks, a contrast check on every text and background token pair in both themes, visual regression snapshots, and bundle-size limits per entry point, and the matrix runs against React 17, 18, and 19 and server rendering. A change of default behavior, such as a button's type, counts as breaking and needs a major version. Each app resolves one version of the library, and a compatibility guide supports at most two majors, so mixed styles on one page are caught in the consumer's CI."
        },
        rubric: [
          {
            criterion:
              "Separates tokens, core primitives, and heavy components into packages with clear ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Uses per-component entry points and side-effect-free builds so apps load and cache only what they use.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion:
              "Keeps heavy components lazily loadable so they never block a route's critical rendering.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Tests across React versions and rendering modes, where component failures concentrate.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Gates releases on behavior, accessibility, contrast, visual, and size checks to contain regressions.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Treating a change of default behavior as a patch because the component's props did not change.",
          "Publishing a single bundle with side effects, so importing one component pulls in the whole library.",
          "Testing components only in the React version the library team uses."
        ],
        interviewerFollowUps: [
          "Which of these checks would you run on every pull request, and which only before a release?"
        ],
        transferConnection:
          "Release gates in the producer's pipeline and packaging per entry point apply to SDKs and shared services."
      }),
      stage({
        format: "production-decision",
        objective:
          "Choose a migration plan that ships the brand refresh on time without freezing product work.",
        dependency:
          "The migration relies on the tokens, versioning, and release gates designed in the earlier stages.",
        topicKeys: ["component-library", "design-tokens"],
        prompt:
          "Choose how to move the three apps onto the design system and retire the old components. Define how you measure adoption and quality, how you keep accessibility and security intact, what it costs teams, and how you roll back.",
        artifact: {
          key: "design-system-migration-options",
          kind: "config",
          title: "Migration options",
          content:
            "Option A: freeze all product work for two sprints and migrate everything at once.\nOption B: codemods for Button and Input, adapters that render old components with the new tokens, per-team migration tracked on a dashboard, and old components deprecated then removed after two major versions.\nLeadership wants the brand refresh live in one month.\nOne app injects third-party HTML into Modal content.",
          caption: "The deadline is about the look; the migration is about the code."
        },
        hints: [
          "Adapters and codemods let the new look ship before every usage is rewritten.",
          "Measure adoption from the code (usage counts) and quality from real pages (accessibility and UI errors).",
          "Third-party HTML injected into a library dialog is still a cross-site scripting risk."
        ],
        referenceAnswer: {
          summary:
            "Choose Option B: ship the refresh through tokens and adapters, migrate usages with codemods behind flags, track adoption and accessibility per app, sanitize injected HTML, and remove old components only when usage reaches zero.",
          explanation:
            "Freezing product work for two sprints is expensive, risky, and still misses usages. With Option B the brand refresh ships within the month by pointing the old components at the new tokens through adapters, while codemods migrate Button and Input usages team by team. A dashboard tracks old versus new usage per app from static analysis, automated accessibility violations per page, and UI error rates; each app turns new components on behind a flag and can roll back per page. Third-party dialog content is sanitized or rendered in an isolated frame, and the library never accepts raw HTML props by default. Old components are deprecated with warnings and removed after two major versions, once usage reaches zero. The trade-off: adapters add temporary code and bundle weight but let product teams keep shipping, so that cost is tracked and its removal scheduled."
        },
        rubric: [
          {
            criterion: "Tracks adoption from code and quality from real pages, per app.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Sanitizes or isolates injected third-party HTML and avoids raw HTML props.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Minimizes team effort with codemods and adapters instead of a product freeze.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Weighs temporary adapter weight against a big-bang migration.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion:
              "Migrates behind per-app flags with deprecation warnings and a removal plan.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Freezing product work to migrate everything at once.",
          "Measuring adoption by how many teams say they use the library instead of by usages in the code.",
          "Allowing raw HTML inside library components to support one integration."
        ],
        interviewerFollowUps: [
          "What would make you delay removing the old Modal after the second major version?"
        ],
        transferConnection:
          "Adapters, codemods, and usage-tracked deprecation apply to migrating any widely used internal API."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "realtime-chat-web-client",
    title: "Real-time team chat web client",
    premise:
      "Design the web client for a team chat app with channels, direct messages, typing indicators, unread counts, and message history, used all day in several browser tabs.",
    candidateRole:
      "You own the chat client: the real-time connection, message ordering and delivery states, history loading, unread and notification state across tabs, performance, and accessibility.",
    functionalRequirements: [
      "Send and receive messages in real time with clear sending, sent, and failed states, and load older history as the user scrolls up.",
      "Keep unread counts, mentions, and typing indicators correct across channels and across several open tabs."
    ],
    nonGoals: [
      "The first release will not include voice or video calls, end-to-end encryption, or message search."
    ],
    constraints: [
      "The connection drops regularly on laptops that sleep and on flaky Wi-Fi, and events can be missed while disconnected.",
      "Messages must appear in the same order for everyone in a channel, even when two people send at the same moment."
    ],
    scaleProfile: [
      "Busy users belong to 200 channels; the busiest channel receives 30 messages per second during incidents.",
      "The client stays open for 9 hours a day in up to 4 tabs; memory must stay under 300 MB and typing must never lag."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "realtime-messaging",
    secondaryTopicKeys: ["client-state", "connection-management", "web-performance"],
    targetKeywords: [
      "frontend",
      "websocket",
      "realtime",
      "chat",
      "optimistic ui",
      "multi-tab",
      "notifications",
      "virtualization"
    ],
    realismAnchors: [
      "A laptop wakes from sleep after 40 minutes; the socket reconnects, but 1,200 messages and 3 edits were sent in the meantime.",
      "During an incident a channel receives 30 messages per second and the timeline stutters while the user types a reply.",
      "The user has four tabs open and each one plays a notification sound and shows a different unread count."
    ],
    targetFitExplanation:
      "A chat client is a common frontend system design question that tests real-time connections, ordering, optimistic sends, multi-tab state, and long-session performance.",
    coverageExplanation:
      "Four connected decisions cover delivery and memory budgets, the event contract and store, the connection and rendering architecture, and a transport rollout across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn 'instant and never lose a message' into delivery states and measurable latency, correctness, and performance targets.",
        dependency:
          "The event volume and memory budgets set here drive the store design and rendering strategy that follow.",
        topicKeys: ["realtime-messaging", "web-performance"],
        prompt:
          "Define what the first release must do and what it will not. Estimate event volume and memory for a heavy user, and set measurable targets for delivery latency, correctness, and client performance.",
        artifact: {
          key: "chat-usage-brief",
          kind: "metrics",
          title: "Chat usage brief",
          content:
            "Heavy user: 200 channels, 12,000 messages received per day, peak 30 messages per second in one channel.\nAverage message 0.6 KB of JSON; a rendered row is about 40 DOM nodes.\nSessions last 9 hours in up to 4 tabs.\nProduct asks for messages that are 'instant', 'never lost', and 'work in every tab'.",
          caption:
            "Long sessions and busy channels decide the architecture more than average traffic."
        },
        hints: [
          "Multiply message volume by payload and DOM size to see what a nine-hour session accumulates.",
          "Separate the active channel's timeline from summaries of all the other channels.",
          "'Instant' and 'never lost' need delivery states and measurable latency."
        ],
        referenceAnswer: {
          summary:
            "Scope real-time messaging with explicit delivery states, bound event and memory growth, and commit to delivery-latency, ordering, and performance targets.",
          explanation:
            "First release: channels and direct messages, sends with sending, sent, and failed states, history paging, unread counts, mentions, typing indicators, and consistent state across tabs; no calls, encryption, or search. 12,000 messages a day at 0.6 KB is about 7 MB of events, so the client must not keep every channel's full history in memory: it keeps the active channel's recent window plus a summary (last message, unread count) for the rest. A 30-messages-per-second channel would add 1,200 DOM nodes per second if rendered naively, so the timeline is virtualized and updates are batched per frame. Targets: p95 time from send to 'sent' under 500 ms; p95 time until other members see a message under 1 s; zero lost or duplicated messages after reconnecting; memory under 300 MB after 9 hours; input latency under 50 ms while messages stream in; and one notification per message across all tabs."
        },
        rubric: [
          {
            criterion:
              "Defines scope, delivery states, behavior across tabs, and explicit non-goals.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Estimates event volume, memory, and rendering load, and sets delivery, correctness, and performance targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Keeping every channel's full history in memory for a nine-hour session.",
          "Saying 'instant' and 'never lose a message' without defining delivery states and measurable latency.",
          "Ignoring that the same user has several tabs open."
        ],
        interviewerFollowUps: [
          "Which of your targets would you watch first during an incident in a very busy channel?"
        ],
        transferConnection:
          "Budgeting event volume and memory for long-lived clients applies to dashboards, trading screens, and monitoring tools."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair the message contract and client store so ordering, sends, catch-up, and edits stay correct.",
        dependency:
          "Message identities, sequences, and read state become what the connection layer and timeline rely on.",
        topicKeys: ["realtime-messaging", "client-state"],
        prompt:
          "Diagnose this event contract and client message store. Specify message identities, ordering, how the client catches up after missing events, and how sent, failed, and edited messages stay correct.",
        artifact: {
          key: "chat-event-draft",
          kind: "config",
          title: "Proposed message events",
          content:
            "```ts\n// Pushed by the server over the WebSocket\ntype MessageEvent = { text: string; author: string; time: string /* sender's device clock */ };\n\n// Messages are sorted by the sender's device clock\nmessages.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));\n\n// Sending: append now, and append again when the same event comes back\nfunction send(text: string) {\n  messages.push({ text, author: me, time: new Date().toISOString() });\n  socket.send(JSON.stringify({ text }));\n}\n\n// After a reconnect: fetch the last 50 messages\nsocket.onopen = () => fetchMessages({ limit: 50 });\n\n// Edits push a new event with only the new text: { text }\n// Each tab increments its own unread count\nunread += 1;\n```",
          caption: "Without stable identities and sequences, ordering and catch-up are guesses."
        },
        hints: [
          "Give each message a client ID for the send, and a server ID and per-channel sequence number for ordering.",
          "A per-channel sequence lets the client notice gaps and fetch exactly what it missed.",
          "Edits and deletes need to reference the message they change and carry a version."
        ],
        referenceAnswer: {
          summary:
            "Use client IDs for sends, server-assigned per-channel sequence numbers for ordering and gap detection, versioned edits, and a normalized store with read state from the server.",
          explanation:
            "Every message carries a clientMessageId generated by the sender and, once accepted, a server messageId and a per-channel sequence number assigned by the server; ordering uses that sequence, never device clocks. Sending adds a pending message keyed by clientMessageId; the server's acknowledgement (or the echoed event) replaces it in place, so it never appears twice, and a timeout marks it failed with a retry that reuses the same clientMessageId, which the server de-duplicates. The client tracks the last sequence it holds per channel; a gap, or a reconnect, triggers a request for events after that sequence, paged if large, so it fetches exactly what was missed. Edits and deletes are events that reference the messageId with a version and are applied only if newer. The store is normalized: messages by ID, timelines as ordered ID lists, and read state (last read sequence per channel) from the server, so every tab computes the same unread counts."
        },
        rubric: [
          {
            criterion:
              "Defines message, acknowledgement, catch-up, and edit events with stable IDs.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion: "Normalizes messages, timelines, and per-channel read state.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Fetches gaps by sequence and pages history instead of refetching a fixed window.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion:
              "Orders by server sequence, de-duplicates sends, and applies only newer edits.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Ordering messages by each sender's device clock.",
          "Appending the optimistic message and then appending the echoed copy as a second message.",
          "Refetching the last 50 messages after a reconnect and silently missing the rest."
        ],
        interviewerFollowUps: [
          "How would the client handle a gap of 100,000 messages after a week away?"
        ],
        transferConnection:
          "Client IDs, server sequences, and gap-based catch-up apply to any client driven by events."
      }),
      stage({
        format: "written",
        objective:
          "Design the connection, event pipeline, and rendering so the client survives sleep, busy channels, and many tabs.",
        dependency:
          "The connection layer must preserve the sequences and client IDs defined in the event contract.",
        topicKeys: ["connection-management", "web-performance"],
        prompt:
          "Sketch the client architecture: connection manager, event handling, store, timeline rendering, and how tabs cooperate. Then explain how your design handles the wake-from-sleep, busy-channel, and multi-tab situations in the trace.",
        artifact: {
          key: "chat-session-trace",
          kind: "trace",
          title: "Chat session trace",
          content:
            "```log\n09:02 the laptop sleeps.\n09:42 it wakes; the socket reconnects in 3 s, then the client refetches 50 messages for each of 200 channels (10,000 requests).\n11:15 an incident channel reaches 30 messages per second; every event re-renders the whole timeline; typing lags by 400 ms.\n13:00 four tabs each hold their own socket, and each plays a notification sound.\n15:30 the server restarts and 40,000 clients reconnect in the same second.\n```",
          caption: "Reconnects, bursts, and duplicated tabs all multiply work."
        },
        hints: [
          "One connection per browser, shared across tabs, is cheaper and keeps notifications and unread state consistent.",
          "Batch incoming events per animation frame and virtualize the timeline so typing stays responsive.",
          "Reconnect with backoff and jitter, and catch up only the channels that need it."
        ],
        referenceAnswer: {
          summary:
            "Share one connection across tabs, batch and virtualize rendering, catch up by sequence with limited concurrency, and reconnect with jittered backoff.",
          explanation:
            "A connection manager owns the WebSocket, heartbeats, and reconnection. With a SharedWorker, or a leader tab chosen through BroadcastChannel and Web Locks, there is one socket per browser and events are broadcast to every tab, so unread state and notifications are decided once. Reconnection uses exponential backoff with jitter, so a server restart does not cause a synchronized reconnect storm. After reconnecting, the client asks the server which channels have newer sequences, catches up the active channel first and the others lazily with limited concurrency, instead of sending 10,000 requests. Incoming events are queued and applied to the store in batches once per animation frame; the timeline is virtualized with measured row heights and stays pinned to the bottom only when the user is already there, showing a 'new messages' button otherwise. The composer keeps its own local state, so streaming messages never re-render it. Only the leader tab plays sounds and shows browser notifications, and not for the channel the user is looking at."
        },
        rubric: [
          {
            criterion:
              "Separates connection manager, event pipeline, store, timeline, and composer.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Caches recent timelines and channel summaries and catches up only what changed.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Batches events per frame and limits catch-up concurrency.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Isolates the busy channel's rendering from the composer's typing path.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Uses heartbeats, jittered reconnects, and one socket per browser to stay correct after drops.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Opening one socket per tab, so notifications and unread counts disagree.",
          "Reconnecting every client immediately after a server restart.",
          "Re-rendering the whole timeline for every incoming message."
        ],
        interviewerFollowUps: [
          "How would you keep the user's scroll position when older history loads above what she is reading?"
        ],
        transferConnection:
          "Leader election across tabs and batching updates per frame apply to dashboards and any long-lived real-time client."
      }),
      stage({
        format: "production-decision",
        objective:
          "Decide how to move from long-polling to WebSockets with real-user measurement, security, and a fallback.",
        dependency: "The rollout is judged against the delivery targets from the first stage.",
        topicKeys: ["connection-management", "realtime-messaging"],
        prompt:
          "Decide whether to replace long-polling with WebSockets for everyone next week. Define how you measure delivery in real users, the security and privacy checks, the cost, and how you roll out and roll back.",
        artifact: {
          key: "chat-transport-plan",
          kind: "config",
          title: "Proposed transport switch",
          content:
            "Today: long-polling, p95 delivery 2.8 s.\nNew: WebSockets, p95 delivery 0.4 s in staging with 500 test users.\nPlan: switch 100 percent next Monday.\nCorporate proxies at two large customers block WebSockets.\nThe sign-in token is passed in the WebSocket URL's query string.\nMessage previews appear in browser notifications, including on shared screens.\nSocket servers cost about twice as much as long-polling at current usage.",
          caption: "A big latency win, with gaps in networks, security, and privacy."
        },
        hints: [
          "Some networks block WebSockets; the client needs a fallback transport.",
          "Tokens in URLs end up in logs, and notification previews can leak messages on shared screens.",
          "A staging test with 500 users does not prove behavior on real customer networks."
        ],
        referenceAnswer: {
          summary:
            "Roll out WebSockets gradually with a long-polling fallback, move sign-in out of the URL, protect notification previews, measure delivery per customer network, and keep an instant rollback.",
          explanation:
            "Do not switch everyone on Monday. Measure send-to-sent and send-to-seen latency, reconnect rate, and fallback rate in real clients by customer and network, with long-polling as the control. Keep long-polling as an automatic fallback when the socket cannot connect, so the two customers behind blocking proxies keep working. Authenticate the socket with a short-lived ticket obtained over HTTPS instead of putting the long-lived token in the URL, and check the origin. Let users hide message previews in notifications, and hide them by default for direct messages on shared or managed devices. Roll out by percentage and by customer behind a flag, with stop rules on delivery latency and error rate, and keep the flag as an instant rollback. Cost: sockets cost about twice as much at current usage, which the drop in delivery time from 2.8 s to 0.4 s justifies; track connections per server and the cost of idle connections."
        },
        rubric: [
          {
            criterion:
              "Measures delivery latency, reconnects, and fallback use in real clients by network.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Uses short-lived socket tickets, origin checks, and private notification defaults.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Weighs socket server cost against the measured delivery gain.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion:
              "Explains why a fallback transport and gradual rollout are worth their complexity.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Rolls out by flag and customer with stop rules and an instant rollback.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Assuming every network allows WebSockets.",
          "Putting long-lived tokens in WebSocket URLs, where they end up in logs.",
          "Trusting a 500-user staging test as proof for real customer networks."
        ],
        interviewerFollowUps: [
          "What would you tell a customer whose proxy blocks WebSockets permanently?"
        ],
        transferConnection:
          "Transport fallbacks, short-lived tickets, and flagged rollouts apply to any real-time feature."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    ...FRONTEND_REVIEW,
    key: "product-page-web-performance",
    title: "Fast product detail pages",
    premise:
      "Design the product detail page for an online store with 2 million products, so it loads fast from search engines and ads, shows accurate price and stock, and supports personalised recommendations and A/B tests.",
    candidateRole:
      "You own the product page: rendering strategy, caching at the CDN and in the browser, data loading, third-party scripts, experiments, and its Core Web Vitals.",
    functionalRequirements: [
      "Show product details, images, price, stock, delivery estimate, reviews, and recommendations, with add-to-cart working immediately.",
      "Support A/B tests and personalised recommendations without slowing the first view of the page."
    ],
    nonGoals: [
      "The first release will not build checkout, the recommendation model, or review moderation."
    ],
    constraints: [
      "Price and stock can change at any minute and must never be wrong at the moment of add-to-cart.",
      "60 percent of visits arrive from search and ads on mobile, and marketing requires five third-party scripts: analytics, ads, chat, a reviews widget, and a tag manager."
    ],
    scaleProfile: [
      "2 million products; 300 million page views a month, with peaks of 25,000 page views per second during sales.",
      "Targets at p75 on mobile: LCP under 2.5 s, INP under 200 ms, CLS under 0.1; today LCP is 4.1 s and the main image is 900 KB."
    ],
    difficulties: ["standard", "stretch"],
    primaryTopicKey: "page-rendering",
    secondaryTopicKeys: ["edge-caching", "web-performance", "experimentation"],
    targetKeywords: [
      "frontend",
      "ssr",
      "static generation",
      "core web vitals",
      "cdn",
      "ecommerce",
      "performance",
      "hydration"
    ],
    realismAnchors: [
      "A flash sale changes prices for 50,000 products at noon while pages are cached at the CDN for an hour.",
      "A new A/B test added through the tag manager moves the main image after load and raises CLS to 0.3.",
      "The reviews widget's script blocks the main thread for 700 ms on mid-range phones, and INP fails."
    ],
    targetFitExplanation:
      "Product pages test rendering strategy, caching by freshness, image delivery, third-party governance, and correctness, which are central to frontend performance work.",
    coverageExplanation:
      "Four connected decisions cover diagnosis and budgets, rendering and data by change rate, sale-day failure containment, and long-term governance across all sixteen dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Diagnose why the page is slow today and set Web Vitals, budget, and price-correctness targets.",
        dependency: "The diagnosis and budgets decide the rendering and data strategy chosen next.",
        topicKeys: ["page-rendering", "web-performance"],
        prompt:
          "Define the first release and what it will not do. Using the measurements, identify what makes the page slow today, and set targets for loading, interactivity, layout stability, and data correctness.",
        artifact: {
          key: "product-page-baseline",
          kind: "metrics",
          title: "Product page baseline",
          content:
            "Mobile p75 today: LCP 4.1 s, INP 380 ms, CLS 0.22.\nMain image: 900 KB JPEG, 1600 px wide on 400 px screens.\nThe page renders in the browser after a 480 KB JavaScript bundle loads.\nThird-party scripts: 5, 610 KB in total, all loaded in the document head.\nPrice and stock come from an API with p95 180 ms.",
          caption: "Each slow metric has a dominant, measurable cause."
        },
        hints: [
          "Compare the image's size and width with what a phone actually displays.",
          "Client-side rendering behind a large bundle delays the largest content until the JavaScript has run.",
          "Correctness targets matter as much as speed targets for price and stock."
        ],
        referenceAnswer: {
          summary:
            "Scope the page around fast server-rendered content, name the image and JavaScript causes of slow LCP and INP, and set Web Vitals, budget, and price-correctness targets.",
          explanation:
            "The first release covers the full page, add-to-cart, experiments, and recommendations; checkout and models are out. LCP is slow because the page renders in the browser behind 480 KB of JavaScript and the main image is 900 KB at four times the displayed width; INP suffers from 610 KB of third-party scripts loaded in the head; CLS comes from images and widgets without reserved space. Targets at p75 on mobile: LCP under 2.5 s, INP under 200 ms, and CLS under 0.1; the main image under 120 KB at the displayed size; initial JavaScript under 170 KB. Correctness: the price and stock shown at add-to-cart must match the server at that moment, with zero orders placed at a stale price."
        },
        rubric: [
          {
            criterion:
              "Defines first-release scope and non-goals and names the causes of today's slow metrics.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Sets numeric Web Vitals, image, and JavaScript budgets, plus a price-correctness target.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Trying to fix LCP with caching alone while the page still waits for a large bundle to render.",
          "Serving desktop-sized images to phones.",
          "Setting speed targets but no correctness target for price and stock."
        ],
        interviewerFollowUps: [
          "Which single change would you expect to move LCP the most, and why?"
        ],
        transferConnection:
          "Reading field metrics to find the dominant cause before choosing a fix applies to any page performance problem."
      }),
      stage({
        format: "production-decision",
        objective:
          "Choose a rendering and data strategy that caches each part of the page by how often it changes.",
        dependency:
          "The split between cached content and fresh data becomes what the CDN, hydration, and add-to-cart rely on.",
        topicKeys: ["page-rendering", "edge-caching"],
        prompt:
          "Choose a rendering and data strategy from these options. Specify what is rendered where, how each kind of data is fetched and cached, and how the page stays correct when prices change.",
        artifact: {
          key: "product-page-rendering-options",
          kind: "config",
          title: "Rendering options",
          content:
            "Option A: full client-side rendering, with all data fetched in the browser.\nOption B: server-render every request, with no caching.\nOption C: static generation for product content, revalidated when the catalogue changes; price, stock, and delivery fetched fresh; recommendations streamed in after the first paint; cart and personalization only in the browser.",
          caption: "Different parts of the page change at very different rates."
        },
        hints: [
          "Product descriptions change rarely, prices change often, and recommendations are per user.",
          "Cache each part of the page for as long as it stays true, and no longer.",
          "A price shown from a cached page must be confirmed at add-to-cart."
        ],
        referenceAnswer: {
          summary:
            "Choose Option C: statically generated, CDN-cached product content with revalidation on catalogue events, fresh price and stock from a fast endpoint, streamed recommendations, and server confirmation at add-to-cart.",
          explanation:
            "Option A keeps the slow client-rendered LCP; Option B renders 25,000 pages per second on the server for content that rarely changes. Option C splits the page by change rate: product content (title, description, images, specifications) is statically generated and cached at the CDN, and revalidated by catalogue change events rather than on a fixed hour; price, stock, and delivery estimate come from a separate small endpoint with a cache of a few seconds or edge compute, rendered into reserved space; recommendations and reviews stream in after the main content without blocking it; cart state and personalization live in the browser. The add-to-cart request sends the product ID and the price version the shopper saw; the server confirms the current price and stock, and the UI shows the updated price before completing if it changed. Personalised data never goes into the shared CDN cache, and cache keys never include user-specific values."
        },
        rubric: [
          {
            criterion:
              "Separates product content, price and stock, recommendations, and cart into contracts with the right freshness.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion: "Models page data by change rate and ownership.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Uses CDN static caching with event-driven revalidation and short-lived price caches.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion: "Confirms price and stock at add-to-cart using a price version.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Caching the whole page, including price, for an hour.",
          "Server-rendering every request even though most content rarely changes.",
          "Putting personalised content into a shared CDN cache."
        ],
        interviewerFollowUps: [
          "What happens if a shopper keeps the page open for an hour and then adds to cart?"
        ],
        transferConnection:
          "Splitting a page by how often each part changes applies to news, travel, and any content-heavy site."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Contain sale-day failures in caching, experiments, third-party scripts, and optional sections.",
        dependency:
          "The architecture must keep the fresh-price path and add-to-cart confirmation from the previous stage.",
        topicKeys: ["edge-caching", "experimentation"],
        prompt:
          "Diagnose the sale-day report. Explain the page architecture (rendering, hydration, images, third-party scripts, experiments) and how your design prevents or contains each problem.",
        artifact: {
          key: "sale-day-report",
          kind: "logs",
          title: "Sale-day report",
          content:
            "```log\n12:00 prices change for 50,000 products; the CDN keeps serving old prices for up to an hour.\n12:05 the origin receives 25,000 requests per second after a purge of all products; p95 time to first byte is 3.2 s.\n12:10 an A/B test injected by the tag manager swaps the main image after load; CLS 0.3.\n12:20 the reviews widget blocks the main thread for 700 ms; INP 520 ms.\n12:30 the recommendations API times out; the page shows an empty grey block, and a JavaScript error breaks add-to-cart.\n```",
          caption: "Every failure started in a part of the page that was not the product itself."
        },
        hints: [
          "Purging everything at once sends all traffic to the origin; revalidate the changed products and serve stale content while revalidating.",
          "Run layout-changing experiments on the server or at the edge, not by swapping content after load.",
          "Load third-party scripts after the main content, and isolate optional parts so their failures cannot break add-to-cart."
        ],
        referenceAnswer: {
          summary:
            "Revalidate only changed products with stale-while-revalidate, run layout experiments at the edge, defer and isolate third parties, and wrap optional sections so their failures leave the core page working.",
          explanation:
            "Price changes publish events that revalidate only the affected product pages, while the price itself comes from the short-lived price endpoint, so a stale content cache cannot show a wrong price. The CDN uses stale-while-revalidate and request collapsing, so a purge never sends 25,000 requests per second to the origin at once. Experiments that change layout are assigned at the edge and rendered on the server in the chosen variant, with the variant in the cache key, so nothing swaps after load. Images come from a responsive image CDN (modern formats, correct sizes, high fetch priority for the main image) with reserved aspect ratios. The page hydrates only its interactive islands (gallery, variant picker, add-to-cart); the reviews widget, chat, and ads load after the first interaction or when visible, behind lightweight placeholders, with long tasks broken up. Optional sections (recommendations, reviews) sit in error boundaries with fixed-size placeholders and timeouts, so their failures never break add-to-cart, which works even before the rest of the page hydrates."
        },
        rubric: [
          {
            criterion:
              "Splits the page into server-rendered content and small interactive islands.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion:
              "Uses targeted revalidation, stale-while-revalidate, and request collapsing at the CDN.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Defers third-party and optional work until interaction or visibility.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion:
              "Keeps the main thread free during load and input by isolating heavy scripts.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion:
              "Contains optional-section failures with boundaries, timeouts, and placeholders.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Purging the whole CDN cache at once during peak traffic.",
          "Running layout-changing experiments by swapping content after the page loads.",
          "Letting an optional widget's JavaScript error break add-to-cart."
        ],
        interviewerFollowUps: [
          "How would you convince marketing to load the chat widget only after interaction?"
        ],
        transferConnection:
          "Targeted revalidation and isolating optional parts apply to any high-traffic content page."
      }),
      stage({
        format: "written",
        objective:
          "Keep the page fast and safe as teams add features, and migrate from the old page without breaking partners.",
        dependency:
          "Governance protects the budgets from the first stage and the architecture built in the others.",
        topicKeys: ["web-performance", "page-rendering"],
        prompt:
          "Plan how you would keep this page fast and safe as teams keep adding features. Cover real-user monitoring, security and privacy, cost, and how you would move from the current client-rendered page to the new one.",
        artifact: {
          key: "product-page-governance",
          kind: "metrics",
          title: "Governance snapshot",
          content:
            "Last quarter: 14 new third-party tags, the bundle grew by 22 percent, and customers found two LCP regressions before the team did.\nThe tag manager lets marketing add any script.\nThe consent banner loads after analytics has already fired.\nCDN egress costs $180,000 a month, 55 percent of it images.\nThe current client-rendered page is used by 9 apps and partner embeds.",
          caption: "Speed erodes one tag and one feature at a time."
        },
        hints: [
          "Budgets only hold when something fails a build or raises an alert when they are broken.",
          "Tag managers let anyone add scripts; decide who reviews them and when they may load.",
          "A page used by many apps and partners cannot be replaced for everyone in one step."
        ],
        referenceAnswer: {
          summary:
            "Enforce performance budgets in CI and in real-user monitoring, govern third-party tags with consent and a Content Security Policy, cut image egress, and migrate route by route behind flags.",
          explanation:
            "Monitoring: real-user monitoring of LCP, INP, and CLS by page type, device, and experiment variant, with alerts on p75 regressions, plus lab checks in CI that fail a pull request exceeding the JavaScript or image budget. Security and privacy: tags go through a reviewed allow-list backed by a Content Security Policy, load only after consent, and never receive personal data without a legal basis. Cost: serving images as AVIF or WebP at the right sizes from the image CDN typically cuts image bytes by more than half, which reduces the largest share of egress. Migration: move traffic route by route (for example one category's product pages first) behind a flag, compare conversion and Web Vitals against the old page, keep the old page's embed contract for partners until they move, and delete the old code once its traffic reaches zero. The trade-off: a stricter tag policy slows marketing experiments, so provide an approved fast path with automatic performance checks."
        },
        rubric: [
          {
            criterion:
              "Monitors Web Vitals by page type, device, and variant, with budgets in CI and in the field.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion:
              "Governs third-party tags with an allow-list, a Content Security Policy, and consent-first loading.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Reduces image and egress cost with modern formats and correct sizes.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Balances tag governance against the speed of marketing experiments.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Migrates route by route behind flags while keeping partner contracts.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Relying on lab tests only, so customers find regressions first.",
          "Letting any team add any third-party script without review or consent.",
          "Replacing the page for all traffic at once while partners still depend on the old one."
        ],
        interviewerFollowUps: [
          "What would you do when a tag that marketing needs pushes INP over budget?"
        ],
        transferConnection:
          "Budgets enforced in CI and in the field, plus governed third parties, apply to any site many teams contribute to."
      })
    ]
  })
]);
