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
    key: "browser-runtime",
    title: "Reason about the browser runtime",
    description: "Explain task ordering, rendering work, and memory from evidence.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "frontend-core-1",
        pathKey: "browser-runtime",
        title: "Predict the order before you run it",
        format: "predict-explain",
        prompt:
          "Predict the console output of this snippet and explain why each line appears where it does.",
        artifact: {
          kind: "code",
          language: "javascript",
          title: "ordering.js",
          content:
            "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nqueueMicrotask(() => console.log('D'));\nconsole.log('E');"
        },
        topicKeys: ["event-loop", "microtasks"],
        hints: [
          "Synchronous code finishes before anything queued runs.",
          "Promise callbacks and queueMicrotask share the microtask queue.",
          "The microtask queue drains completely before the next timer task."
        ],
        answer: {
          concise:
            "A, E, C, D, B: synchronous logs first, then microtasks in order, then the timer.",
          explanation:
            "A and E run on the current task. C and D are microtasks queued in that order and drain before the event loop takes the next task, so the setTimeout callback B runs last even with a 0 ms delay."
        },
        rubric: [
          "State the correct order A, E, C, D, B.",
          "Explain that microtasks drain before the next task.",
          "Explain why a 0 ms timer still runs after microtasks."
        ],
        commonMistakes: ["Treating setTimeout(fn, 0) as immediate."],
        interviewerFollowUps: ["What happens if a microtask keeps queueing more microtasks?"],
        interviewConnection:
          "Interviewers use ordering puzzles to check whether you understand why UI updates can be delayed."
      }),
      choice({
        id: "frontend-core-2",
        pathKey: "browser-runtime",
        title: "Stop forcing layout in a loop",
        format: "mcq",
        prompt:
          "This loop makes scrolling janky on long lists. Which change removes the forced synchronous layout?",
        artifact: {
          kind: "code",
          language: "javascript",
          title: "resize-rows.js",
          content:
            "for (const row of rows) {\n  const width = container.offsetWidth; // read\n  row.style.width = `${width / 2}px`; // write\n}"
        },
        topicKeys: ["rendering", "layout-thrashing"],
        choices: [
          "Read container.offsetWidth once before the loop, then apply all writes.",
          "Wrap the loop in setTimeout so it runs later.",
          "Replace style.width with a CSS class added in the same loop.",
          "Use a for...of loop instead of forEach."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Reading a layout property after a style write forces the browser to recalculate layout.",
          "Look for a read and a write alternating inside the loop.",
          "Batch all reads first, then all writes."
        ],
        answer: {
          concise:
            "Read the width once, then perform the writes, so layout is calculated a single time.",
          explanation:
            "Each offsetWidth read after a style write forces a synchronous layout. Hoisting the read out of the loop batches reads before writes, which removes the repeated layout work."
        },
        commonMistakes: ["Deferring the loop without separating reads from writes."],
        interviewerFollowUps: ["How would you confirm layout thrashing in the Performance panel?"],
        interviewConnection:
          "Rendering questions test whether you can connect jank to the work the browser is forced to do."
      }),
      text({
        id: "frontend-core-3",
        pathKey: "browser-runtime",
        title: "Find what keeps the old page alive",
        format: "artifact-diagnosis",
        prompt:
          "Memory grows every time a user opens and closes the settings panel in this single-page app. What is retaining memory, and how would you fix and verify it?",
        artifact: {
          kind: "metrics",
          title: "Heap snapshots after repeated panel opens",
          content:
            "open/close 1x: JS heap 38 MB\nopen/close 10x: JS heap 71 MB\nopen/close 20x: JS heap 104 MB\nDetached HTMLDivElement count: 0 → 20\nRetainer: window 'resize' listener → closure → panelRoot"
        },
        topicKeys: ["memory-leaks", "event-listeners"],
        hints: [
          "Detached DOM nodes are still referenced from somewhere.",
          "The retainer path starts at a global listener.",
          "Cleanup must run when the panel unmounts."
        ],
        answer: {
          concise:
            "A window resize listener registered on open is never removed, so its closure keeps each closed panel's DOM alive.",
          explanation:
            "Remove the listener on unmount (or use an AbortController signal), then repeat the open/close cycle and confirm the detached node count and heap return to baseline."
        },
        rubric: [
          "Identify the global listener closure as the retainer.",
          "Remove it during teardown with a stable reference or AbortController.",
          "Verify with repeated heap snapshots and detached node counts."
        ],
        commonMistakes: ["Blaming garbage collection timing instead of a live reference."],
        interviewerFollowUps: ["How does React's effect cleanup help prevent this?"],
        interviewConnection:
          "Leak questions check that you can read a retainer path instead of guessing."
      }),
      text({
        id: "frontend-core-4",
        pathKey: "browser-runtime",
        title: "Explain the frozen counter",
        format: "predict-explain",
        prompt: "The counter shows 1 and never increases. Explain why, and give two correct fixes.",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "Counter.tsx",
          content:
            "function Counter() {\n  const [count, setCount] = useState(0);\n  useEffect(() => {\n    const id = setInterval(() => setCount(count + 1), 1000);\n    return () => clearInterval(id);\n  }, []);\n  return <span>{count}</span>;\n}"
        },
        topicKeys: ["react-hooks", "closures"],
        hints: [
          "The effect runs once, so its callback captures the first render's values.",
          "count inside the interval is always the value from that first render.",
          "Either avoid reading count or let the effect see new values."
        ],
        answer: {
          concise:
            "The interval closes over count = 0 from the first render, so it keeps setting 0 + 1.",
          explanation:
            "Use the functional update setCount(c => c + 1), which does not depend on the captured value, or include count in the dependency array so the interval is recreated with the current value."
        },
        rubric: [
          "Explain the stale closure over the first render.",
          "Offer the functional state update.",
          "Offer a dependency-based fix and its trade-off."
        ],
        commonMistakes: [
          "Adding count to dependencies without understanding the interval restarts."
        ],
        interviewerFollowUps: ["When would you reach for useRef here instead?"],
        interviewConnection: "Stale closures are one of the most common React interview bugs."
      }),
      text({
        id: "frontend-core-5",
        pathKey: "browser-runtime",
        title: "Protect the search API from keystrokes",
        format: "production-decision",
        prompt:
          "A search box calls the API on every keystroke and is hitting the rate limit. Choose between debounce and throttle, and describe how you would also prevent out-of-date results from showing.",
        artifact: {
          kind: "scenario",
          title: "Search constraints",
          content:
            "Users type ~6 characters per second\nAPI limit: 5 requests/second per user\nResults must match the latest query\nSlow responses: p95 900 ms"
        },
        topicKeys: ["debounce", "race-conditions"],
        hints: [
          "Search wants the result for the final input, not a sample of intermediate inputs.",
          "A slow earlier response can arrive after a newer one.",
          "Cancel or ignore responses that no longer match the input."
        ],
        answer: {
          concise:
            "Debounce the query (for example 250–300 ms) and abort or ignore stale requests so only the latest query renders.",
          explanation:
            "Debounce sends one request after typing pauses, which fits search. Use AbortController or a request id to discard responses for older queries, and consider caching recent queries."
        },
        rubric: [
          "Choose debounce and justify it for search input.",
          "Handle out-of-order responses with cancellation or request ids.",
          "Mention a sensible delay and user-perceived latency trade-off."
        ],
        commonMistakes: ["Debouncing but still rendering whichever response arrives last."],
        interviewerFollowUps: ["When would throttle be the better choice?"],
        interviewConnection:
          "This combines API protection with correctness, which interviewers expect together."
      })
    ]
  },
  {
    key: "component-correctness",
    title: "Build components that stay correct",
    description: "Keep state, effects, and accessibility correct as the UI changes.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "frontend-core-6",
        pathKey: "component-correctness",
        title: "Find why the wrong row is checked",
        format: "artifact-diagnosis",
        prompt:
          "After deleting the first todo, the checkbox state appears on the wrong item. What causes this, and how do you fix it?",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "TodoList.tsx",
          content:
            "{todos.map((todo, index) => (\n  <TodoRow key={index} todo={todo} />\n))}\n\n// TodoRow keeps `checked` in local useState"
        },
        topicKeys: ["react-keys", "reconciliation"],
        hints: [
          "React matches children between renders by key.",
          "After a deletion, indexes shift to different todos.",
          "Local state stays with the key, not with the todo."
        ],
        answer: {
          concise:
            "Using the index as key makes React reuse rows by position, so local checked state moves to a different todo.",
          explanation:
            "Use a stable identity such as todo.id as the key so each row's state follows its data, or lift checked state into the todo data itself."
        },
        rubric: [
          "Explain key-based reconciliation by position.",
          "Use a stable id as the key.",
          "Mention lifting state as an alternative."
        ],
        commonMistakes: ["Assuming keys only affect performance."],
        interviewerFollowUps: ["When is an index key actually safe?"],
        interviewConnection:
          "Key questions reveal whether you understand how React preserves state."
      }),
      choice({
        id: "frontend-core-7",
        pathKey: "component-correctness",
        title: "Make memoization actually work",
        format: "mcq",
        prompt:
          "ExpensiveChart is wrapped in React.memo but still re-renders whenever the parent's unrelated state changes. What is the most likely cause?",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "Dashboard.tsx",
          content:
            "<ExpensiveChart\n  data={rows}\n  options={{ stacked: true }}\n  onSelect={(id) => setSelected(id)}\n/>"
        },
        topicKeys: ["memoization", "referential-equality"],
        choices: [
          "The inline options object and onSelect function get new identities every render.",
          "React.memo only works on class components.",
          "rows must be converted to a Map first.",
          "The chart needs a key prop to be memoized."
        ],
        correctChoiceIndex: 0,
        hints: [
          "React.memo compares props by reference.",
          "Look for props created during render.",
          "useMemo and useCallback keep identities stable."
        ],
        answer: {
          concise:
            "The inline object and callback are new on each render, so the shallow prop comparison always fails.",
          explanation:
            "Stabilize options with useMemo (or a module constant) and onSelect with useCallback so React.memo can skip renders when nothing meaningful changed."
        },
        commonMistakes: ["Adding useMemo everywhere without checking which prop changes."],
        interviewerFollowUps: ["How would you prove the fix with the React Profiler?"],
        interviewConnection:
          "Performance questions check that you can explain why a memo boundary is broken."
      }),
      text({
        id: "frontend-core-8",
        pathKey: "component-correctness",
        title: "Show the profile the user asked for",
        format: "predict-explain",
        prompt:
          "Switching quickly from user 1 to user 2 sometimes shows user 1's profile. Explain the race and fix it.",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "Profile.tsx",
          content:
            "useEffect(() => {\n  fetch(`/api/users/${userId}`)\n    .then((r) => r.json())\n    .then(setProfile);\n}, [userId]);\n\n// user 1 response: 1.2 s, user 2 response: 0.3 s"
        },
        topicKeys: ["effects", "race-conditions"],
        hints: [
          "Both requests are in flight at the same time.",
          "The slower response arrives last and overwrites the newer one.",
          "Cancel or ignore the effect's work when userId changes."
        ],
        answer: {
          concise:
            "The slow user 1 response resolves after user 2's and overwrites it because nothing ignores stale requests.",
          explanation:
            "Return a cleanup that aborts the fetch with AbortController or sets an ignore flag, so only the response for the current userId updates state. A data library with keyed caching also solves this."
        },
        rubric: [
          "Identify the out-of-order response race.",
          "Use effect cleanup with abort or an ignore flag.",
          "Mention keyed server-state caching as an option."
        ],
        commonMistakes: ["Adding a loading flag, which does not stop the stale write."],
        interviewerFollowUps: ["What changes under React Strict Mode's double effect run?"],
        interviewConnection: "Effect races are a favourite follow-up once you mention useEffect."
      }),
      text({
        id: "frontend-core-9",
        pathKey: "component-correctness",
        title: "Make the custom button usable",
        format: "written",
        prompt:
          "Keyboard and screen-reader users cannot use this control. List the problems and the smallest correct fix.",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "SaveButton.tsx",
          content: '<div className="btn" onClick={save}>\n  <svg>…</svg>\n</div>'
        },
        topicKeys: ["accessibility", "semantics"],
        hints: [
          "A div is not focusable and has no role.",
          "Keyboard users expect Enter and Space to activate buttons.",
          "An icon-only control needs an accessible name."
        ],
        answer: {
          concise:
            'Use a real <button type="button"> with an accessible label such as aria-label="Save".',
          explanation:
            "A native button provides focus, Enter/Space activation, and the button role. Add an accessible name for the icon, keep a visible focus style, and hide the decorative svg from assistive technology."
        },
        rubric: [
          "Identify missing focus, role, and keyboard activation.",
          "Replace the div with a native button.",
          "Provide an accessible name and visible focus."
        ],
        commonMistakes: ['Adding role="button" and tabIndex but forgetting keyboard handlers.'],
        interviewerFollowUps: ["How would you test this without a screen reader?"],
        interviewConnection: "Accessibility is increasingly a pass/fail signal in frontend loops."
      }),
      text({
        id: "frontend-core-10",
        pathKey: "component-correctness",
        title: "Decide where server data should live",
        format: "production-decision",
        prompt:
          "The team stores every API response in a global Redux store, and data is often stale after edits. Propose where server data should live and why.",
        artifact: {
          kind: "scenario",
          title: "Current state management",
          content:
            "Global store holds users, orders, and settings from the API\nManual refetch after mutations is often forgotten\nSame order list fetched by 3 components\nUI-only state (modals, tabs) also in the global store"
        },
        topicKeys: ["state-management", "server-state"],
        hints: [
          "Server data and UI state have different lifecycles.",
          "Server data needs caching, deduplication, and invalidation.",
          "UI state can stay local or in a small client store."
        ],
        answer: {
          concise:
            "Move server data to a server-state cache (for example React Query or SWR) with mutation-driven invalidation; keep UI state local.",
          explanation:
            "A server-state cache deduplicates requests, tracks freshness, and invalidates keys after mutations, which fixes stale data. The global store shrinks to genuinely shared client state."
        },
        rubric: [
          "Separate server state from client UI state.",
          "Use caching with invalidation after mutations.",
          "Explain the migration trade-off or risk."
        ],
        commonMistakes: ["Adding more manual refetch calls instead of fixing ownership."],
        interviewerFollowUps: ["How would you migrate one screen at a time safely?"],
        interviewConnection:
          "Architecture-lite questions like this appear in senior frontend rounds."
      })
    ]
  }
];

const applied: AiMlStoryPath[] = [
  {
    key: "page-performance",
    title: "Diagnose a slow product page",
    description: "Use field and lab evidence to fix loading, stability, and responsiveness.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "frontend-applied-1",
        pathKey: "page-performance",
        title: "Find what delays the hero image",
        format: "artifact-diagnosis",
        prompt:
          "Largest Contentful Paint regressed after a redesign. Using the waterfall, explain the cause and your fix.",
        artifact: {
          kind: "waterfall",
          title: "Product page load (4G, mid-range phone)",
          content:
            '0 ms    HTML\n180 ms  app.js (410 KB)\n180 ms  styles.css\n1900 ms app.js executed → renders <img loading="lazy" src=hero.jpg>\n2100 ms hero.jpg requested (620 KB)\n3400 ms LCP: hero.jpg'
        },
        topicKeys: ["core-web-vitals", "lcp"],
        hints: [
          "The LCP image is only discovered after JavaScript runs.",
          'loading="lazy" delays an above-the-fold image.',
          "The image itself is also heavy."
        ],
        answer: {
          concise:
            "The hero image is rendered by JavaScript and lazy-loaded, so it starts downloading late; it is also too large.",
          explanation:
            'Put the hero in server-rendered HTML, remove lazy loading and add fetchpriority="high" or a preload, and serve a responsive, compressed image. Then confirm LCP in field data.'
        },
        rubric: [
          "Identify late discovery caused by client rendering and lazy loading.",
          "Prioritize the LCP image in HTML with preload or fetchpriority.",
          "Reduce image weight with responsive formats."
        ],
        commonMistakes: ["Only compressing the image while it is still discovered late."],
        interviewerFollowUps: ["How would you catch this regression before release?"],
        interviewConnection:
          "Web Vitals questions expect evidence-driven reasoning, not a checklist."
      }),
      text({
        id: "frontend-applied-2",
        pathKey: "page-performance",
        title: "Stop the page from jumping",
        format: "artifact-diagnosis",
        prompt:
          "Users report the buy button moves while they tap it. Explain the layout shifts and how to prevent them.",
        artifact: {
          kind: "metrics",
          title: "Layout shift attribution",
          content:
            "CLS (p75): 0.31\nShift 1: promo banner inserted above content after API response (0.18)\nShift 2: web font swap changes heading height (0.09)\nShift 3: product image without width/height (0.04)"
        },
        topicKeys: ["core-web-vitals", "cls"],
        hints: [
          "Content that appears late must have reserved space.",
          "Font swaps change text metrics.",
          "Images need intrinsic dimensions."
        ],
        answer: {
          concise:
            "Reserve space for the late banner, set image dimensions, and reduce font-swap shifts with matched fallback metrics.",
          explanation:
            "Render a fixed-height placeholder for the banner (or insert it below the fold), give images width and height or aspect-ratio, and use size-adjusted fallback fonts or preloaded fonts so the swap does not move content."
        },
        rubric: [
          "Address the largest shift, the late banner, first.",
          "Reserve image space with dimensions or aspect-ratio.",
          "Reduce font-driven shifts with metric overrides or preloading."
        ],
        commonMistakes: ["Hiding the banner entirely instead of reserving space."],
        interviewerFollowUps: ["Why does the field CLS differ from your local Lighthouse score?"],
        interviewConnection: "Interviewers look for prioritizing the biggest measured contributor."
      }),
      choice({
        id: "frontend-applied-3",
        pathKey: "page-performance",
        title: "Make the filter click feel instant",
        format: "mcq",
        prompt:
          "Clicking a filter freezes the page for ~600 ms and INP is poor. What should you do first?",
        artifact: {
          kind: "trace",
          title: "Interaction trace for 'Apply filter'",
          content:
            "click handler: 20 ms\nJSON.parse of cached 4 MB payload: 190 ms\nfilter + sort 18k rows: 150 ms\nReact render of 18k rows: 240 ms\nnext paint: 620 ms after click"
        },
        topicKeys: ["inp", "long-tasks"],
        choices: [
          "Virtualize the list and move parsing/filtering off the interaction path, then yield before rendering.",
          "Add a CSS transition so the change looks smoother.",
          "Increase the server cache TTL.",
          "Switch the button to an anchor element."
        ],
        correctChoiceIndex: 0,
        hints: [
          "INP measures time until the next paint after the interaction.",
          "Rendering 18k rows is the single largest cost.",
          "Break or remove long tasks on the click path."
        ],
        answer: {
          concise:
            "Render only visible rows and take parsing and filtering off the click path so the next paint happens quickly.",
          explanation:
            "Virtualization removes most render cost; pre-parse the payload, use a worker or incremental processing for filtering, and show immediate feedback before heavy work so the interaction paints fast."
        },
        commonMistakes: ["Masking the delay with animation instead of shortening long tasks."],
        interviewerFollowUps: ["How would useTransition or scheduler.yield help here?"],
        interviewConnection:
          "Responsiveness questions test whether you can read a long-task breakdown."
      }),
      text({
        id: "frontend-applied-4",
        pathKey: "page-performance",
        title: "Decide what to do about a heavier bundle",
        format: "production-decision",
        prompt:
          "Adding a charting library grew the main bundle by 400 KB, but charts only appear on one reports tab. What would you do, and how would you stop this from happening again?",
        artifact: {
          kind: "metrics",
          title: "Bundle analysis",
          content:
            "main.js: 310 KB → 710 KB (gzip 96 → 212 KB)\nchart-lib: 380 KB, imported in shared/utils/format.ts for one helper\nReports tab visits: 7% of sessions\nMobile TTI p75: 4.1 s → 6.3 s"
        },
        topicKeys: ["code-splitting", "bundle-size"],
        hints: [
          "Most users never open the reports tab.",
          "A shared utility pulls the whole library into the main bundle.",
          "Guard the budget in CI."
        ],
        answer: {
          concise:
            "Move the chart import behind a dynamic import on the reports tab, remove it from the shared utility, and add a bundle-size budget in CI.",
          explanation:
            "Lazy-load the chart component so 93% of sessions skip it, replace the helper that imported the library, and fail CI when the main bundle exceeds its budget."
        },
        rubric: [
          "Code-split the charts to the route or tab that uses them.",
          "Fix the accidental import from a shared module.",
          "Add an automated bundle budget or check."
        ],
        commonMistakes: ["Replacing the library without fixing the import path."],
        interviewerFollowUps: ["How would you keep the reports tab itself fast?"],
        interviewConnection: "Bundle questions test cost awareness as well as tooling."
      }),
      text({
        id: "frontend-applied-5",
        pathKey: "page-performance",
        title: "Prove the fix worked for real users",
        format: "written",
        prompt:
          "Your lab scores improved but the product manager asks whether users actually benefit. How do you measure the improvement in production?",
        artifact: {
          kind: "scenario",
          title: "Measurement options",
          content:
            "Lighthouse lab score: 62 → 91\nNo RUM (real-user monitoring) in place\nTraffic: 70% mobile, many low-end Android devices\nRelease is behind a feature flag"
        },
        topicKeys: ["rum", "measurement"],
        hints: [
          "Lab tests use one device and network.",
          "Field data reflects real devices and networks.",
          "A flag lets you compare cohorts."
        ],
        answer: {
          concise:
            "Collect real-user Web Vitals and compare flagged and unflagged cohorts at p75, segmented by device.",
          explanation:
            "Add web-vitals RUM reporting, run the flag as an experiment, compare p75 LCP/INP/CLS and a business metric such as conversion, and check low-end mobile separately."
        },
        rubric: [
          "Distinguish lab from field data.",
          "Use RUM with p75 and device segmentation.",
          "Compare cohorts with the flag and tie to a user outcome."
        ],
        commonMistakes: ["Reporting the Lighthouse score as the user outcome."],
        interviewerFollowUps: ["Why p75 rather than the average?"],
        interviewConnection: "Senior candidates are expected to close the loop with real-user data."
      })
    ]
  },
  {
    key: "release-recovery",
    title: "Recover from a broken release",
    description: "Diagnose production-only failures and choose the safest recovery.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "frontend-applied-6",
        pathKey: "release-recovery",
        title: "Explain the hydration warning",
        format: "artifact-diagnosis",
        prompt:
          "After a release, server-rendered pages log hydration mismatches and some content flickers. What causes the mismatch and how do you fix it?",
        artifact: {
          kind: "logs",
          title: "Browser console",
          content:
            'Warning: Text content did not match. Server: "Sep 26, 04:00" Client: "Sep 26, 09:30"\nComponent: <OrderTime> renders new Date(order.createdAt).toLocaleString()\nServer region: UTC · User timezone: Asia/Kolkata'
        },
        topicKeys: ["ssr", "hydration"],
        hints: [
          "The server and browser render different text.",
          "Time zone and locale differ between them.",
          "Render the same output on both, or format only on the client."
        ],
        answer: {
          concise:
            "Formatting the date with the environment's time zone produces different text on the server and client.",
          explanation:
            "Format with an explicit time zone and locale on both sides, or render a stable value on the server and format after mount. Avoid suppressing the warning unless the difference is intentional."
        },
        rubric: [
          "Identify environment-dependent rendering as the mismatch cause.",
          "Make output deterministic or format on the client after mount.",
          "Explain why suppressing the warning is a last resort."
        ],
        commonMistakes: ["Disabling SSR for the whole page."],
        interviewerFollowUps: ["What other values commonly cause hydration mismatches?"],
        interviewConnection: "SSR frameworks make hydration a common production-debugging topic."
      }),
      text({
        id: "frontend-applied-7",
        pathKey: "release-recovery",
        title: "Fix the missing chunk after deploy",
        format: "artifact-diagnosis",
        prompt:
          "Right after each deploy, some users see a blank screen when they navigate. Explain what is happening and how you would fix it.",
        artifact: {
          kind: "logs",
          title: "Error monitoring",
          content:
            "ChunkLoadError: Loading chunk 812 failed (GET /_next/static/chunks/812.a1b2.js → 404)\nSpikes for ~30 min after each deploy\nAffected users had the app open before the deploy\nOld assets are deleted on deploy"
        },
        topicKeys: ["deployments", "caching"],
        hints: [
          "Users with an open tab still run the old build.",
          "The old build requests chunks that no longer exist.",
          "Keep old assets or recover gracefully."
        ],
        answer: {
          concise:
            "Open tabs run the old build and request chunk files the deploy deleted, so lazy navigation fails.",
          explanation:
            "Keep previous build assets available for a grace period, and catch chunk load failures to reload into the new version. Long-lived immutable caching of hashed assets is safe only if old files remain."
        },
        rubric: [
          "Explain the old-client, new-server version skew.",
          "Retain old assets for a grace period.",
          "Add graceful recovery such as a controlled reload."
        ],
        commonMistakes: ["Disabling caching, which slows every user without fixing skew."],
        interviewerFollowUps: ["How would you detect version skew in monitoring?"],
        interviewConnection: "Deployment-skew bugs show whether you think beyond the local build."
      }),
      choice({
        id: "frontend-applied-8",
        pathKey: "release-recovery",
        title: "Choose the fastest safe rollback",
        format: "mcq",
        prompt:
          "A new checkout form, released behind a feature flag, has doubled payment errors. What is the safest first action?",
        artifact: {
          kind: "metrics",
          title: "Checkout monitoring",
          content:
            "Payment error rate: 1.1% → 2.4% since 10:05\nFlag new_checkout: 50% of users\nErrors only in the new_checkout cohort\nFull redeploy takes ~20 minutes"
        },
        topicKeys: ["feature-flags", "incident-response"],
        choices: [
          "Turn the flag off for everyone, then investigate with the cohort data.",
          "Ship a hotfix after reproducing the bug locally.",
          "Roll back the whole release with a redeploy.",
          "Wait an hour to confirm the trend."
        ],
        correctChoiceIndex: 0,
        hints: [
          "The errors are isolated to the flagged cohort.",
          "Flags change behavior in seconds.",
          "Stop the harm first, then diagnose."
        ],
        answer: {
          concise:
            "Disable the flag immediately because it stops the impact in seconds without a redeploy.",
          explanation:
            "The flag isolates the change, so turning it off is the fastest safe mitigation. Then use cohort data and logs to find the defect before re-enabling gradually."
        },
        commonMistakes: ["Debugging while customers keep failing payments."],
        interviewerFollowUps: ["What would you add so the flag turns itself off next time?"],
        interviewConnection: "Incident questions reward mitigating first and diagnosing second."
      }),
      text({
        id: "frontend-applied-9",
        pathKey: "release-recovery",
        title: "Handle an error that only Safari sees",
        format: "production-decision",
        prompt:
          "Error monitoring shows a spike only on Safari 16 after a release. How do you narrow it down and decide whether to roll back?",
        artifact: {
          kind: "logs",
          title: "Error group",
          content:
            "TypeError: array.findLast is not a function\nBrowser: Safari 16.3 (4% of traffic)\nIntroduced in release 2026.09.24\nAffected pages: cart, checkout"
        },
        topicKeys: ["browser-compatibility", "incident-response"],
        hints: [
          "The error names a specific API.",
          "Check whether that browser version supports it.",
          "Weigh the revenue impact of the affected pages."
        ],
        answer: {
          concise:
            "The release uses Array.prototype.findLast, which Safari 16.3 lacks; checkout impact justifies an immediate fix or rollback.",
          explanation:
            "Confirm support with compatibility data, ship a polyfill or replace the call, and align the build's browserslist targets with supported browsers. Because checkout is affected, mitigate quickly rather than waiting."
        },
        rubric: [
          "Identify the unsupported API from the error.",
          "Choose mitigation proportional to checkout impact.",
          "Prevent recurrence with browser targets or lint rules."
        ],
        commonMistakes: ["Ignoring it because the browser share is small."],
        interviewerFollowUps: ["How would your build catch this before release?"],
        interviewConnection: "Compatibility incidents test impact judgment as well as debugging."
      }),
      text({
        id: "frontend-applied-10",
        pathKey: "release-recovery",
        title: "Recover the blocked analytics script",
        format: "written",
        prompt:
          "After a security header change, the analytics script stopped loading and the console shows CSP errors. Explain the cause and a fix that keeps the security benefit.",
        artifact: {
          kind: "logs",
          title: "Console",
          content:
            "Refused to load the script 'https://cdn.analytics.example/a.js' because it violates the Content Security Policy directive: \"script-src 'self'\".\nHeader change: added Content-Security-Policy in 2026.09.24"
        },
        topicKeys: ["security", "csp"],
        hints: [
          "The new policy only allows scripts from the same origin.",
          "Allow the specific host, not everything.",
          "Report-only mode helps you roll out safely."
        ],
        answer: {
          concise:
            "The new CSP allows only same-origin scripts; add the specific analytics host to script-src rather than weakening the whole policy.",
          explanation:
            "Allow the exact origin (or use nonces/hashes), avoid 'unsafe-inline' and wildcards, and roll policy changes out with Content-Security-Policy-Report-Only first to catch other blocked resources."
        },
        rubric: [
          "Explain the script-src restriction.",
          "Allow the specific source or use nonces without weakening the policy.",
          "Use report-only rollout to find other violations."
        ],
        commonMistakes: ["Adding a wildcard that defeats the purpose of CSP."],
        interviewerFollowUps: ["What does CSP protect against?"],
        interviewConnection: "Security basics are expected even in UI-focused interviews."
      })
    ]
  }
];

// Paths 3-4 of each Frontend track, added so each track has four paths.
const coreMore: AiMlStoryPath[] = [
  {
    key: "css-and-layout",
    title: "Make layouts behave under pressure",
    description:
      "Explain stacking, overflow, the cascade, and responsive images from real UI bugs.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "frontend-core-11",
        pathKey: "css-and-layout",
        title: "Bring the modal above the header",
        format: "artifact-diagnosis",
        prompt:
          "The modal has z-index: 9999 but still renders underneath the sticky header. Explain why raising the number does not help, and fix it.",
        artifact: {
          kind: "code",
          language: "css",
          title: "layout.css",
          content:
            '.page { transform: translateZ(0); } /* added for smoother scrolling */\n.page .modal { position: fixed; z-index: 9999; }\n.header { position: sticky; top: 0; z-index: 10; }\n/* DOM: <header class="header"> is a sibling of <main class="page"> */'
        },
        topicKeys: ["stacking-context", "z-index"],
        hints: [
          "z-index only competes inside the same stacking context.",
          "A transform on an ancestor creates a new stacking context.",
          "The modal can never escape .page while .page itself sits below the header."
        ],
        answer: {
          concise:
            "The transform on .page creates a stacking context, so the modal's 9999 only ranks inside .page, and .page sits below the header.",
          explanation:
            "Render the modal outside .page (for example through a portal at the end of body) or remove the transform. Then its z-index is compared with the header in the root stacking context and wins."
        },
        rubric: [
          "Identify the transform as creating a new stacking context.",
          "Explain that z-index cannot escape its stacking context.",
          "Fix it with a portal or by removing the stacking-context trigger."
        ],
        commonMistakes: ["Raising z-index further without changing where the modal lives."],
        interviewerFollowUps: ["Name three other CSS properties that create a stacking context."],
        interviewConnection:
          "Stacking-context bugs are a classic way to test whether you know how the browser layers content."
      }),
      choice({
        id: "frontend-core-12",
        pathKey: "css-and-layout",
        title: "Stop the long file name breaking the row",
        format: "mcq",
        prompt:
          "A long file name pushes the delete button out of this flex row instead of being truncated. What is the smallest correct fix?",
        artifact: {
          kind: "code",
          language: "css",
          title: "file-row.css",
          content:
            ".row { display: flex; gap: 8px; }\n.name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.delete { flex-shrink: 0; }"
        },
        topicKeys: ["flexbox", "overflow"],
        choices: [
          "Add min-width: 0 to .name so the flex item is allowed to shrink below its content width.",
          "Give .row overflow: hidden.",
          "Set .delete to position: absolute.",
          "Replace flex: 1 with width: 100% on .name."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Flex items have an automatic minimum size.",
          "By default a flex item will not shrink smaller than its content.",
          "Lowering that minimum lets overflow and ellipsis take effect."
        ],
        answer: {
          concise:
            "Flex items default to min-width: auto, so .name refuses to shrink; min-width: 0 lets the ellipsis work.",
          explanation:
            "Because min-width: auto keeps the item at least as wide as its content, overflow: hidden never gets a chance to clip. Setting min-width: 0 removes that floor so the text truncates and the button keeps its place."
        },
        commonMistakes: ["Clipping the whole row, which hides the delete button instead."],
        interviewerFollowUps: ["Why does the same problem appear with nested flex containers?"],
        interviewConnection:
          "Interviewers use this to see whether you understand flexbox sizing rather than trial-and-error CSS."
      }),
      text({
        id: "frontend-core-13",
        pathKey: "css-and-layout",
        title: "Predict which color wins",
        format: "predict-explain",
        prompt:
          "What color is the link inside the card? Explain how the browser decides, step by step.",
        artifact: {
          kind: "code",
          language: "css",
          title: "theme.css",
          content:
            '/* <div id="promo" class="card"><a class="cta" href="#">Buy</a></div> */\n#promo a { color: blue; }\n.card .cta { color: green; }\na.cta { color: red !important; }\n.card a.cta { color: purple; }'
        },
        topicKeys: ["cascade", "specificity"],
        hints: [
          "!important declarations are compared before specificity.",
          "Only one rule here is marked !important.",
          "Without it, an ID selector would beat any number of classes."
        ],
        answer: {
          concise:
            "Red, because the only !important declaration wins before specificity is compared.",
          explanation:
            "The cascade first sorts by importance, so a.cta { color: red !important } beats the normal rules. Without it, #promo a would win because one ID outranks any number of classes, making the link blue."
        },
        rubric: [
          "State that the link is red.",
          "Explain that importance is compared before specificity.",
          "Explain what would win without !important and why."
        ],
        commonMistakes: ["Assuming the last rule in the file always wins."],
        interviewerFollowUps: ["How do cascade layers change this ordering?"],
        interviewConnection:
          "Cascade questions check that you can predict CSS instead of adding !important until it works."
      }),
      text({
        id: "frontend-core-14",
        pathKey: "css-and-layout",
        title: "Find why the sticky header scrolls away",
        format: "artifact-diagnosis",
        prompt:
          "position: sticky works on one page but not on the settings page. Using the computed styles, explain the cause and the fix.",
        artifact: {
          kind: "logs",
          title: "Computed styles on the settings page",
          content:
            "nav.settings-header   position: sticky; top: 0\nparent section.panel  overflow: hidden; height: auto\ngrandparent main      overflow: visible\nScrolling container: window\nObserved: header scrolls out of view with the page"
        },
        topicKeys: ["sticky-positioning", "overflow"],
        hints: [
          "A sticky element sticks relative to its nearest scrolling ancestor.",
          "overflow: hidden makes an element a scroll container even if it never scrolls.",
          "The panel is only as tall as its content, so there is nowhere to stick."
        ],
        answer: {
          concise:
            "overflow: hidden on section.panel makes it the sticky element's scroll container, and that container never scrolls, so the header cannot stick.",
          explanation:
            "Remove overflow: hidden from the ancestor (use overflow: clip if you only need clipping) so the window becomes the scroll container again, then confirm the header sticks while the page scrolls."
        },
        rubric: [
          "Identify the ancestor overflow as the cause.",
          "Explain that sticky is relative to the nearest scroll container.",
          "Fix it by removing the overflow or using overflow: clip."
        ],
        commonMistakes: ["Switching to position: fixed and breaking the layout flow."],
        interviewerFollowUps: [
          "What is the difference between overflow: hidden and overflow: clip?"
        ],
        interviewConnection:
          "Sticky bugs show whether you can reason from computed styles instead of guessing."
      }),
      text({
        id: "frontend-core-15",
        pathKey: "css-and-layout",
        title: "Choose images that fit every screen",
        format: "production-decision",
        prompt:
          "The product grid serves one 1600 px image to every device and mobile data usage complaints are rising. Decide how you would serve images and how you would confirm the improvement.",
        artifact: {
          kind: "metrics",
          title: "Product grid image delivery",
          content:
            "Image source: 1600x1600 JPEG, ~420 KB each\nGrid cell on phones: ~170 CSS px wide (DPR 3)\nImages per page: 24\nMobile LCP p75: 3.9 s\n62% of traffic on mobile"
        },
        topicKeys: ["responsive-images", "performance"],
        hints: [
          "The browser can choose the right file if you describe the options.",
          "sizes tells the browser how wide the image will be displayed.",
          "Modern formats and lazy loading below the fold add more savings."
        ],
        answer: {
          concise:
            "Serve several widths with srcset and an accurate sizes attribute, use a modern format like AVIF or WebP, and lazy-load images below the fold.",
          explanation:
            "A 170 px cell at DPR 3 needs roughly a 510 px image, not 1600 px. With srcset and sizes the browser downloads the smallest adequate file. Keep the first visible images eager, then confirm with field LCP and bytes transferred per page."
        },
        rubric: [
          "Use srcset with sizes so the browser picks an appropriate width.",
          "Add modern formats and lazy loading, keeping above-the-fold images eager.",
          "Verify with field LCP and transferred bytes."
        ],
        commonMistakes: ["Lazy-loading the LCP image, which makes it slower."],
        interviewerFollowUps: ["When would you use the picture element instead of srcset alone?"],
        interviewConnection:
          "Image delivery is one of the most common real performance wins interviewers ask about."
      })
    ]
  },
  {
    key: "typescript-and-async",
    title: "Write TypeScript and async code that holds up",
    description:
      "Reason about promises, types, and state shapes that prevent whole classes of bugs.",
    expectedMinutes: 40,
    questions: [
      text({
        id: "frontend-core-16",
        pathKey: "typescript-and-async",
        title: "Explain why 'saved' prints first",
        format: "predict-explain",
        prompt:
          "The log shows 'All saved' before any item finishes saving. Explain why, and rewrite the loop so it waits.",
        artifact: {
          kind: "code",
          language: "typescript",
          title: "save-all.ts",
          content:
            "async function saveAll(items: Item[]) {\n  items.forEach(async (item) => {\n    await api.save(item);\n    console.log('saved', item.id);\n  });\n  console.log('All saved');\n}"
        },
        topicKeys: ["promises", "async-iteration"],
        hints: [
          "forEach ignores the promise each callback returns.",
          "saveAll never awaits anything itself.",
          "Collect the promises, or loop with for...of."
        ],
        answer: {
          concise:
            "forEach does not await the async callbacks, so saveAll logs 'All saved' immediately; use for...of with await or Promise.all.",
          explanation:
            "Use for (const item of items) await api.save(item) to save in order, or await Promise.all(items.map((item) => api.save(item))) to save in parallel. Choose based on whether order and rate limits matter."
        },
        rubric: [
          "Explain that forEach discards the returned promises.",
          "Give a correct sequential or parallel rewrite.",
          "Explain when to choose sequential versus parallel."
        ],
        commonMistakes: ["Adding await before items.forEach, which still does not wait."],
        interviewerFollowUps: ["How would you limit it to three saves at a time?"],
        interviewConnection:
          "This bug appears constantly in real code reviews and interview live-coding."
      }),
      choice({
        id: "frontend-core-17",
        pathKey: "typescript-and-async",
        title: "Keep one failing widget from blanking the page",
        format: "mcq",
        prompt:
          "The dashboard loads four independent widgets with Promise.all. When one API fails, the whole dashboard shows an error. What should change?",
        artifact: {
          kind: "code",
          language: "typescript",
          title: "dashboard.ts",
          content:
            "const [sales, traffic, alerts, tasks] = await Promise.all([\n  getSales(), getTraffic(), getAlerts(), getTasks()\n]);\nrender({ sales, traffic, alerts, tasks });"
        },
        topicKeys: ["promises", "error-handling"],
        choices: [
          "Use Promise.allSettled and render each widget from its own result, showing an error only where it failed.",
          "Use Promise.race so the fastest widget renders first.",
          "Wrap Promise.all in a retry loop until every call succeeds.",
          "Await each call one after another inside a single try/catch."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Promise.all rejects as soon as any promise rejects.",
          "The widgets do not depend on each other.",
          "You need every result, successful or not."
        ],
        answer: {
          concise:
            "Promise.allSettled waits for every request and reports each outcome, so one failure only affects its own widget.",
          explanation:
            "Promise.all fails fast, which suits dependent work. For independent widgets, allSettled returns fulfilled and rejected results together, so the page renders what succeeded and shows a local error state for the rest."
        },
        commonMistakes: ["Retrying everything, which delays the widgets that already succeeded."],
        interviewerFollowUps: ["When is failing fast with Promise.all the right choice?"],
        interviewConnection:
          "Interviewers use this to check you can match error handling to how data is actually used."
      }),
      text({
        id: "frontend-core-18",
        pathKey: "typescript-and-async",
        title: "Find the crash the type checker missed",
        format: "artifact-diagnosis",
        prompt:
          "TypeScript compiles cleanly, yet users see this crash. Explain how the type system was bypassed and how to make the compiler catch it.",
        artifact: {
          kind: "logs",
          title: "Production error and source",
          content:
            "TypeError: Cannot read properties of undefined (reading 'name')\n  at ProfileCard (ProfileCard.tsx:12)\n\n// profile.ts\nconst user = (await res.json()) as User;\n// ProfileCard.tsx:12\nreturn <h2>{user.team.name}</h2>; // team is missing for new users"
        },
        topicKeys: ["typescript", "runtime-validation"],
        hints: [
          "`as User` tells the compiler to trust you, not the data.",
          "The API sometimes omits team.",
          "Validate at the boundary and model optional fields honestly."
        ],
        answer: {
          concise:
            "The `as User` assertion trusted the API response, but team can be missing, so the compiler never saw the undefined case.",
          explanation:
            "Parse the response at the boundary with a runtime schema (for example zod), mark team as optional in the type, and handle the missing case in the component. The compiler then forces every use of team to deal with undefined."
        },
        rubric: [
          "Identify the type assertion as the bypass.",
          "Validate external data at runtime at the boundary.",
          "Model the optional field so the compiler enforces handling it."
        ],
        commonMistakes: ["Adding a non-null assertion (!) to silence the error again."],
        interviewerFollowUps: ["What does strictNullChecks change here?"],
        interviewConnection:
          "Interviewers look for the difference between compile-time types and runtime data."
      }),
      text({
        id: "frontend-core-19",
        pathKey: "typescript-and-async",
        title: "Model request state so impossible states cannot happen",
        format: "written",
        prompt:
          "This component tracks a request with three booleans and occasionally shows a spinner and an error together. Redesign the state type and explain why it prevents the bug.",
        artifact: {
          kind: "code",
          language: "typescript",
          title: "useOrders.ts",
          content:
            "const [isLoading, setIsLoading] = useState(false);\nconst [isError, setIsError] = useState(false);\nconst [data, setData] = useState<Order[] | null>(null);\n// a retry sets isLoading = true but forgets to reset isError"
        },
        topicKeys: ["typescript", "discriminated-unions"],
        hints: [
          "Three booleans allow eight combinations, but only a few are valid.",
          "A single status field can carry only one state at a time.",
          "Attach data only to the state where it exists."
        ],
        answer: {
          concise:
            "Use one discriminated union, such as idle | loading | success with data | error with message, so only valid combinations can exist.",
          explanation:
            "type State = { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: Order[] } | { status: 'error'; message: string }. Every transition replaces the whole state, so loading and error can never be true together, and TypeScript narrows data only in the success branch."
        },
        rubric: [
          "Explain why independent booleans allow invalid combinations.",
          "Propose a discriminated union with one status field.",
          "Show how narrowing makes data available only when it exists."
        ],
        commonMistakes: ["Adding another boolean to patch the invalid combination."],
        interviewerFollowUps: ["How would you handle a refetch while keeping old data visible?"],
        interviewConnection:
          "Modelling state with unions is a strong senior-level signal in frontend interviews."
      }),
      text({
        id: "frontend-core-20",
        pathKey: "typescript-and-async",
        title: "Decide where form validation belongs",
        format: "production-decision",
        prompt:
          "A teammate wants to drop server-side validation because the React form already validates every field. Decide what to do and explain the risks.",
        artifact: {
          kind: "scenario",
          title: "Signup form",
          content:
            "Client: validates email format, password length, age >= 18\nServer: currently re-validates the same rules\nProposal: remove server checks to 'avoid duplication'\nPublic API also used by the mobile app"
        },
        topicKeys: ["validation", "security"],
        hints: [
          "Anyone can send a request without using your form.",
          "The mobile app and scripts reach the same API.",
          "Duplication can be removed by sharing rules, not by deleting checks."
        ],
        answer: {
          concise:
            "Keep server validation as the source of truth; client validation is only for fast feedback. Share one schema to remove the duplication.",
          explanation:
            "Requests can bypass the form entirely, so only the server can enforce rules. Define the rules once (for example a shared zod schema) and use it on both sides, so the client gives instant feedback and the server still rejects bad input."
        },
        rubric: [
          "State that the server must still validate.",
          "Explain that clients can be bypassed by other callers.",
          "Remove duplication by sharing one schema."
        ],
        commonMistakes: ["Trusting the UI as a security boundary."],
        interviewerFollowUps: ["How would you show server errors next to the right field?"],
        interviewConnection:
          "This checks whether you understand trust boundaries, not just form libraries."
      })
    ]
  }
];

const appliedMore: AiMlStoryPath[] = [
  {
    key: "data-fetching-incidents",
    title: "Fix data that shows up wrong",
    description:
      "Trace stale caches, CORS failures, pagination bugs, and auth races to their cause.",
    expectedMinutes: 45,
    questions: [
      text({
        id: "frontend-applied-11",
        pathKey: "data-fetching-incidents",
        title: "Explain why the renamed project snaps back",
        format: "artifact-diagnosis",
        prompt:
          "Users rename a project, see the new name, then it reverts a second later. Using the network log, explain what happens and how to fix it.",
        artifact: {
          kind: "logs",
          title: "Network log after renaming",
          content:
            "t=0 ms     optimistic update: 'Q3 Plan' -> 'Q3 Roadmap'\nt=5 ms     PATCH /projects/42 (pending)\nt=40 ms    GET /projects (started by window focus refetch)\nt=380 ms   PATCH /projects/42 200\nt=620 ms   GET /projects 200 -> name: 'Q3 Plan' (read from replica before write)\nUI shows: 'Q3 Plan'"
        },
        topicKeys: ["caching", "optimistic-updates"],
        hints: [
          "A refetch started before the write finished.",
          "Its older response overwrote the optimistic value.",
          "Cancel in-flight reads for that key during a mutation."
        ],
        answer: {
          concise:
            "A refetch that started before the PATCH finished returned the old name and overwrote the optimistic update.",
          explanation:
            "Cancel in-flight queries for the project list when the mutation starts, apply the optimistic update, then invalidate and refetch after the mutation succeeds. Roll back only if the mutation fails."
        },
        rubric: [
          "Identify the stale refetch overwriting the optimistic value.",
          "Cancel in-flight reads when the mutation starts.",
          "Invalidate after success and roll back on failure."
        ],
        commonMistakes: ["Disabling refetch on focus everywhere instead of fixing the ordering."],
        interviewerFollowUps: ["How does read-after-write consistency on the server affect this?"],
        interviewConnection: "Cache ordering bugs are common in apps using React Query or SWR."
      }),
      text({
        id: "frontend-applied-12",
        pathKey: "data-fetching-incidents",
        title: "Fix the CORS error after the API move",
        format: "artifact-diagnosis",
        prompt:
          "After moving the API to a new domain, every authenticated request fails in the browser but works in curl. Explain the cause and the correct server fix.",
        artifact: {
          kind: "logs",
          title: "Browser console and preflight",
          content:
            "Access to fetch at 'https://api.shop.example/cart' from origin 'https://shop.example' has been blocked by CORS policy: Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response.\n\nOPTIONS /cart -> 204\n  Access-Control-Allow-Origin: https://shop.example\n  Access-Control-Allow-Methods: GET, POST"
        },
        topicKeys: ["cors", "http"],
        hints: [
          "curl does not enforce CORS; browsers do.",
          "The Authorization header triggers a preflight.",
          "The preflight response must list every custom header you send."
        ],
        answer: {
          concise:
            "The preflight response does not allow the Authorization header, so the browser blocks the request; the API must add it to Access-Control-Allow-Headers.",
          explanation:
            "Return Access-Control-Allow-Headers: Authorization, Content-Type (and allow any other methods used) for the exact origin. Do not respond with a wildcard origin for credentialed requests. curl works because CORS is a browser rule."
        },
        rubric: [
          "Explain that the preflight rejected the Authorization header.",
          "Fix it on the server with the right allow headers for the exact origin.",
          "Explain why curl succeeds and avoid unsafe wildcards."
        ],
        commonMistakes: ["Trying to fix CORS from the frontend code."],
        interviewerFollowUps: ["Which requests skip the preflight entirely?"],
        interviewConnection:
          "Almost every frontend engineer meets CORS; interviewers check you know who must fix it."
      }),
      choice({
        id: "frontend-applied-13",
        pathKey: "data-fetching-incidents",
        title: "Stop duplicate items in the infinite feed",
        format: "mcq",
        prompt:
          "The activity feed sometimes shows the same item twice while scrolling during busy hours. The API uses ?offset=20&limit=20. What is the best fix?",
        artifact: {
          kind: "scenario",
          title: "Feed behaviour",
          content:
            "Feed sorted newest first\nNew items arrive every few seconds\nPage 1: offset 0, page 2: offset 20\nDuplicates appear at page boundaries only during busy periods"
        },
        topicKeys: ["pagination", "api-design"],
        choices: [
          "Switch to cursor pagination that continues after the last item's id and timestamp.",
          "Deduplicate items by id on the client and keep offsets.",
          "Increase the page size to 100.",
          "Poll the first page more often."
        ],
        correctChoiceIndex: 0,
        hints: [
          "New items shift every later item down by one position.",
          "Offsets describe positions, not items.",
          "A cursor anchors the next page to a specific item."
        ],
        answer: {
          concise:
            "Use cursor pagination so each page starts after a specific item, which new inserts cannot shift.",
          explanation:
            "With offsets, every new item pushes older ones down, so the next page repeats items (and deletions skip them). A cursor based on the last seen item's sort key returns the next items regardless of inserts."
        },
        commonMistakes: [
          "Deduplicating on the client, which still skips items when rows are deleted."
        ],
        interviewerFollowUps: ["What makes a good cursor when timestamps can tie?"],
        interviewConnection:
          "Pagination questions show whether you understand data changing under the UI."
      }),
      text({
        id: "frontend-applied-14",
        pathKey: "data-fetching-incidents",
        title: "Speed up the dashboard request chain",
        format: "production-decision",
        prompt:
          "The dashboard takes 3 seconds to show anything. Using the waterfall, decide what to change first and what trade-offs you accept.",
        artifact: {
          kind: "waterfall",
          title: "Dashboard data requests",
          content:
            "0 ms     GET /me            (320 ms)\n320 ms   GET /teams?user=7  (410 ms)\n730 ms   GET /projects?team=3 (650 ms)\n1380 ms  GET /stats?project=12 (900 ms)\n2280 ms  render\nEach request only needs an id from the previous one"
        },
        topicKeys: ["request-waterfalls", "performance"],
        hints: [
          "Each request waits for the previous one to finish.",
          "Some ids may already be known from the session or URL.",
          "The server can combine dependent reads in one round trip."
        ],
        answer: {
          concise:
            "Remove the sequential chain: fetch independent data in parallel and move dependent lookups to one server endpoint or server component.",
          explanation:
            "Start requests whose ids are already known (from the session or URL) immediately and in parallel. Resolve the dependent chain on the server, close to the database, so the browser makes one request. Show a skeleton for slower widgets instead of blocking the whole page."
        },
        rubric: [
          "Identify the sequential dependency as the cause.",
          "Parallelize independent requests and move dependent ones server-side.",
          "Discuss the trade-off, such as a new endpoint or partial rendering."
        ],
        commonMistakes: ["Adding a global spinner without shortening the chain."],
        interviewerFollowUps: ["How would you prefetch this data on hover of the dashboard link?"],
        interviewConnection:
          "Request waterfalls are one of the most common real-world frontend performance problems."
      }),
      ordering({
        id: "frontend-applied-15",
        pathKey: "data-fetching-incidents",
        title: "Stop the logout storm on token expiry",
        format: "production-decision",
        prompt:
          "When the access token expires, several requests fail at once, each tries to refresh the token, and users are randomly logged out. The refresh token is single-use and rotates. Order what the client should do so every request recovers and nobody is logged out by mistake.",
        artifact: {
          kind: "logs",
          title: "Requests at token expiry",
          content:
            "10:00:00.010 GET /orders   401\n10:00:00.012 GET /profile  401\n10:00:00.015 GET /alerts   401\n10:00:00.020 POST /auth/refresh 200 (refresh token rotated)\n10:00:00.022 POST /auth/refresh 401 (old refresh token reused)\n10:00:00.030 client: logout()"
        },
        topicKeys: ["authentication", "concurrency"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            { id: "retry", label: "Retry each failed request once with the new access token." },
            { id: "start", label: "On the first 401, start one refresh request." },
            { id: "store", label: "Store the new access token and the rotated refresh token." },
            {
              id: "wait",
              label:
                "Make every later 401 wait for that same in-flight refresh instead of starting its own."
            },
            { id: "logout", label: "Log out only if that single refresh itself fails." }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "start",
            second: "wait",
            label: "One refresh starts before others wait on it",
            points: 3,
            explanation:
              "Later failures must join the refresh that is already running, not start a new one."
          },
          {
            type: "before",
            first: "store",
            second: "retry",
            label: "Store the new tokens before retrying",
            points: 3,
            explanation:
              "Retries need the new access token, and the rotated refresh token must replace the old one."
          },
          {
            type: "before",
            first: "wait",
            second: "retry",
            label: "Wait for the refresh before retrying",
            points: 2,
            explanation: "Retrying before the refresh finishes sends the expired token again."
          },
          {
            type: "before",
            first: "retry",
            second: "logout",
            label: "Log out only as the last resort",
            points: 2,
            explanation: "Logging out is for a failed refresh, not for the normal expiry path."
          }
        ],
        hints: [
          "The refresh token can be used only once.",
          "Three requests starting three refreshes is the bug.",
          "One refresh, everyone waits for it, then retry."
        ],
        answer: {
          concise:
            "Start one refresh, make later 401s wait for it, store the new tokens, retry once, and log out only if the refresh fails.",
          explanation:
            "A single shared in-flight refresh prevents the rotated refresh token from being reused. Every failed request waits for it, then retries once with the new access token; only a failed refresh should end the session."
        },
        commonMistakes: ["Retrying each request with its own refresh, which repeats the race."],
        interviewerFollowUps: ["How would you share the refresh across two open browser tabs?"],
        interviewConnection:
          "Auth races test whether you can reason about concurrency in the browser."
      })
    ]
  },
  {
    key: "accessibility-incidents",
    title: "Ship a UI everyone can use",
    description:
      "Fix focus, labelling, contrast, and announcements, then keep them from regressing.",
    expectedMinutes: 40,
    questions: [
      ordering({
        id: "frontend-applied-16",
        pathKey: "accessibility-incidents",
        title: "Keep keyboard focus inside the dialog",
        format: "artifact-diagnosis",
        prompt:
          "A keyboard user can tab behind the open 'Delete account' dialog and loses their place when it closes. Order what an accessible dialog does from opening to closing.",
        artifact: {
          kind: "logs",
          title: "Keyboard walkthrough",
          content:
            "1. Focus on 'Delete account' button, press Enter -> dialog opens\n2. Focus stays on the 'Delete account' button behind the dialog\n3. Tab moves through page links under the overlay\n4. Escape does nothing\n5. Clicking 'Cancel' closes the dialog; focus jumps to <body>"
        },
        topicKeys: ["accessibility", "focus-management"],
        interaction: {
          type: "sequence",
          instruction:
            "Add all five steps, then move them earlier or later. Scoring checks what must happen before what.",
          items: [
            { id: "restore", label: "Return focus to the 'Delete account' button that opened it." },
            { id: "remember", label: "Remember which element had focus before opening." },
            { id: "trap", label: "Keep Tab and Shift+Tab inside the dialog while it is open." },
            { id: "move", label: "Move focus to the first control inside the dialog." },
            { id: "close", label: "Close the dialog on Escape or Cancel." }
          ]
        },
        interactionRubric: [
          {
            type: "before",
            first: "remember",
            second: "move",
            label: "Remember the trigger before moving focus",
            points: 3,
            explanation: "Once focus moves, you can no longer tell which element opened the dialog."
          },
          {
            type: "before",
            first: "move",
            second: "trap",
            label: "Move focus in before keeping it there",
            points: 2,
            explanation: "Focus must be inside the dialog before Tab can be contained."
          },
          {
            type: "before",
            first: "trap",
            second: "close",
            label: "Contain focus while the dialog is open",
            points: 2,
            explanation: "The background must stay unreachable until the dialog closes."
          },
          {
            type: "before",
            first: "close",
            second: "restore",
            label: "Restore focus after closing",
            points: 3,
            explanation: "Returning focus to the trigger is what keeps the user's place."
          }
        ],
        hints: [
          "Focus should move into the dialog when it opens.",
          "Content behind a modal should not be reachable.",
          "When it closes, focus should return to what opened it."
        ],
        answer: {
          concise:
            "Remember the trigger, move focus in, keep it inside while open, close on Escape or Cancel, then return focus to the trigger.",
          explanation:
            "The native <dialog> with showModal() handles most of this: it makes the background inert and supports Escape. You still remember and restore focus so the keyboard user continues from the 'Delete account' button."
        },
        commonMistakes: ["Only adding aria-modal without actually managing focus."],
        interviewerFollowUps: ["What does the inert attribute do?"],
        interviewConnection:
          "Dialog focus management is the most common accessibility question in frontend interviews."
      }),
      choice({
        id: "frontend-applied-17",
        pathKey: "accessibility-incidents",
        title: "Fix the unreadable disabled button text",
        format: "mcq",
        prompt:
          "An audit flags low contrast on the primary button's secondary text. Which change fixes it without hiding information?",
        artifact: {
          kind: "metrics",
          title: "Contrast audit",
          content:
            "Element: .btn-primary .subtext (14px, regular)\nForeground: #9aa4b2  Background: #ffffff\nContrast ratio: 2.6:1\nRequired (WCAG AA, normal text): 4.5:1"
        },
        topicKeys: ["accessibility", "color-contrast"],
        choices: [
          "Darken the text color until the ratio is at least 4.5:1 and re-check it.",
          "Increase the font weight slightly and keep the color.",
          "Add a tooltip with the same text.",
          "Lower the background opacity."
        ],
        correctChoiceIndex: 0,
        hints: [
          "Normal-size text needs 4.5:1 for WCAG AA.",
          "Weight changes do not change the measured ratio.",
          "The fix must change the colors themselves."
        ],
        answer: {
          concise:
            "Darken the foreground color to reach at least 4.5:1, then verify with a contrast checker.",
          explanation:
            "14 px regular text needs 4.5:1. A slightly bolder font does not count as large text, so the colors must change. Update the design token so every use is fixed, not just this button."
        },
        commonMistakes: ["Fixing one element instead of the shared color token."],
        interviewerFollowUps: ["When does the lower 3:1 requirement apply?"],
        interviewConnection:
          "Interviewers expect you to know the basic WCAG thresholds and how to fix them."
      }),
      text({
        id: "frontend-applied-18",
        pathKey: "accessibility-incidents",
        title: "Announce new results to screen reader users",
        format: "written",
        prompt:
          "After filtering, sighted users see '12 results', but screen reader users hear nothing. Explain how you would announce the change without being noisy.",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "Results.tsx",
          content:
            '<input aria-label="Filter products" onChange={onFilter} />\n<p>{results.length} results</p>\n<ul>{results.map(renderItem)}</ul>'
        },
        topicKeys: ["accessibility", "aria-live"],
        hints: [
          "Screen readers only read changes in live regions automatically.",
          "The region must exist before its text changes.",
          "Avoid announcing on every keystroke."
        ],
        answer: {
          concise:
            "Put the count in a polite live region that is always rendered, and update it after filtering settles.",
          explanation:
            'Render <p aria-live="polite" role="status">{count} results</p> from the start so screen readers notice updates. Debounce the update so it announces the final count once typing pauses rather than every keystroke.'
        },
        rubric: [
          "Use an always-present polite live region or status role.",
          "Update it with a concise message such as the result count.",
          "Avoid noisy announcements by debouncing updates."
        ],
        commonMistakes: ["Using aria-live='assertive', which interrupts the user constantly."],
        interviewerFollowUps: ["Why must the live region exist before the content changes?"],
        interviewConnection:
          "Live regions show you can build dynamic UIs that still work with assistive technology."
      }),
      text({
        id: "frontend-applied-19",
        pathKey: "accessibility-incidents",
        title: "Fix the unnamed icon buttons",
        format: "artifact-diagnosis",
        prompt:
          "A screen reader announces the toolbar as 'button, button, button'. Explain why and fix it.",
        artifact: {
          kind: "code",
          language: "tsx",
          title: "Toolbar.tsx",
          content:
            '<div className="toolbar">\n  <button onClick={bold}><BoldIcon /></button>\n  <button onClick={italic}><ItalicIcon /></button>\n  <div className="icon-btn" onClick={link}><LinkIcon /></div>\n</div>'
        },
        topicKeys: ["accessibility", "semantics"],
        hints: [
          "An icon alone gives the button no accessible name.",
          "The third control is not a button at all.",
          "Name each control and use real buttons."
        ],
        answer: {
          concise:
            "The icon buttons have no accessible name, and the link control is a div; add names and use a real button.",
          explanation:
            "Give each button a name with aria-label (for example 'Bold') or visually hidden text, mark the SVGs aria-hidden, and replace the div with <button> so it is focusable and works with Enter and Space."
        },
        rubric: [
          "Explain the missing accessible names.",
          "Replace the clickable div with a real button.",
          "Add labels and hide decorative icons from assistive technology."
        ],
        commonMistakes: ["Adding role='button' to the div without keyboard support."],
        interviewerFollowUps: ["How would you expose the pressed state of the Bold button?"],
        interviewConnection:
          "Semantic HTML questions are a quick way for interviewers to gauge accessibility basics."
      }),
      text({
        id: "frontend-applied-20",
        pathKey: "accessibility-incidents",
        title: "Stop accessibility regressions reaching production",
        format: "production-decision",
        prompt:
          "Accessibility bugs keep coming back after being fixed. Propose a practical process that catches them before release without slowing every PR.",
        artifact: {
          kind: "metrics",
          title: "Last quarter",
          content:
            "Accessibility bugs reported: 23\nRegressions of previously fixed bugs: 9\nAutomated checks in CI: none\nManual screen reader testing: only before major launches"
        },
        topicKeys: ["accessibility", "testing"],
        hints: [
          "Automated tools catch some issues quickly.",
          "Tools cannot judge everything, such as focus order or meaning.",
          "Protect fixed bugs with tests so they cannot return."
        ],
        answer: {
          concise:
            "Add automated axe checks in CI and component tests, write regression tests for fixed bugs, and keep short manual keyboard and screen reader checks for key flows.",
          explanation:
            "Automated checks catch labels, contrast, and roles cheaply on every PR. Tests using accessible queries (getByRole) protect fixed behaviour. A short manual checklist for critical flows covers what tools miss, such as focus order and announcements."
        },
        rubric: [
          "Add automated accessibility checks in CI.",
          "Protect fixed bugs with regression tests.",
          "Keep targeted manual testing for what tools cannot catch."
        ],
        commonMistakes: ["Relying only on automated tools, which catch a minority of issues."],
        interviewerFollowUps: ["Which issues can automated tools never detect?"],
        interviewConnection:
          "Senior candidates are expected to prevent classes of bugs, not just fix individual ones."
      })
    ]
  }
];

export function frontendStoryPaths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[] {
  return track === "core-technical" ? [...core, ...coreMore] : [...applied, ...appliedMore];
}
