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

export function frontendStoryPaths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[] {
  return track === "core-technical" ? core : applied;
}
