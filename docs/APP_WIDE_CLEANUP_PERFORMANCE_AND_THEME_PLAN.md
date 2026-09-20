# App-wide Cleanup, Performance, and Theme Plan

**Status:** Proposed  
**Prepared:** 2026-09-21  
**Companion:** `docs/APPLICATION_CLEANUP_AND_FOLDER_STRUCTURE.md`

## Goal

Clean Trailgrad one product area at a time while preserving existing URLs, data, authentication,
and user flows. Each slice should improve:

- visual quality in dark and light themes;
- page and API performance;
- code and bundle size;
- loading, empty, error, and retry states;
- responsiveness, scrolling, and accessibility; and
- maintainability without unnecessary abstractions.

## Current signals

- 51 page files and 46 API routes.
- Only 2 route-level error boundaries.
- 128 client TSX files.
- `globals.css` is approximately 6,900 lines.
- 633 hard-coded color utilities and 710 arbitrary pixel text sizes in TSX.
- Several UI and service files exceed 1,000 lines.

These are audit signals, not automatic reasons to split or delete code.

## Work order

### 1. Foundations

- Add route/API timing and request correlation without logging private content.
- Record bundle size and important page-load baselines.
- Define semantic color, surface, border, typography, spacing, and state tokens.
- Standardize page headers, buttons, inputs, panels, skeletons, errors, and empty states.

### 2. Shell, authentication, and onboarding

Routes: `/`, `/auth/continue`, `/onboarding`, `/manage`.

Focus on first paint, profile/auth waterfalls, theme persistence, forms, resume upload, progress,
timeouts, and retry behavior.

### 3. Dashboard and discovery

Routes: `/practice`, `/interviews`, `/progress`, `/reports`.

Focus on parallel data loading, partial failures, card consistency, charts, empty states, and
navigation performance.

### 4. Practice

Audit DSA, Core Technical, Applied Engineering, and Architecture & Design, including question and
assessment pages.

Focus on editor/canvas loading, teacher and TTS behavior, quizzes, written prompts, independent
panel scrolling, saved drafts, assessment recovery, and result consistency.

### 5. Interviews

Audit all interview entry pages and the live room.

Focus on setup consistency, connection lifecycle, Gemini Live, LiveKit, polling, reconnect,
permissions, transcript state, canvas/editor loading, and completion recovery.

### 6. Profile, Resume Roast, and reporting

Routes: `/profile`, `/manage`, `/resume-roast`, `/reports`, `/progress`.

Focus on large forms, document previews, AI progress, cancellation, save states, charts, and report
readability.

### 7. Trailguide, Trailmate, marketing, and operations

Focus on polling cost, peer-help room state, notifications, mentor surfaces, public-page
performance, legacy redirects, and administrative authorization.

## Page quality checklist

Every supported page must pass:

- dark and light themes;
- mobile, tablet, desktop, and wide-screen layouts;
- loading, empty, partial, error, and long-content states;
- correct page or panel scrolling without scroll chaining;
- keyboard navigation, visible focus, labels, and readable contrast;
- proper typography—`text-sm` for normal content, with `text-xs` limited to chips and compact
  metadata;
- no hydration, console, image, or failed-request warnings; and
- no unnecessary or duplicated browser requests.

Avoid excessive nested boxes. A border should communicate grouping, ownership, selection, or an
interactive boundary.

## API performance checklist

- Measure total, authentication, database, provider, and serialization time before optimizing.
- Run independent reads concurrently and remove N+1 queries.
- Select only required database fields and add indexes only with query evidence.
- Give external operations bounded timeouts, cancellation, retry, and idempotency rules.
- Show progress for AI, TTS, sandbox, upload, and other long operations.
- Cache only when ownership, isolation, freshness, and invalidation are documented.
- Track warm p50/p95, cold starts, error rate, payload size, and invocation count.

Initial warm targets:

| Request type             |       p50 |       p95 |
| ------------------------ | --------: | --------: |
| Small authenticated read |   ≤300 ms |   ≤800 ms |
| Aggregated page read     |   ≤500 ms | ≤1,200 ms |
| Database mutation        |   ≤600 ms | ≤1,500 ms |
| Interactive decision     | ≤1,000 ms | ≤2,500 ms |

AI, TTS, sandbox, and realtime operations need route-specific budgets.

## Bloat rules

- Keep client components limited to real interaction or browser requirements.
- Load Monaco, Three.js, LiveKit, PDF tools, and other heavy features only where needed.
- Review UI files above 500 lines, route handlers above 200 lines, and services above 800 lines.
- Share a UI abstraction only when multiple real consumers need it.
- Remove code only after proving it is dead; preserve compatibility and persisted-data adapters.
- Reduce global CSS one product slice at a time with visual verification.

## Definition of done for each app slice

1. Capture before measurements and screenshots.
2. Fix the highest-impact visual, performance, and structural issues.
3. Verify dark/light and responsive states in the browser.
4. Run focused tests, ESLint, TypeScript, production build, and `git diff --check`.
5. Record before/after latency, requests, bundle impact, and remaining issues.

Recommended first slice: instrumentation, theme tokens, and the application shell. This prevents
later page work from adding more one-off overrides.
