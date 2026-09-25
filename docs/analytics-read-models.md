# Page read models

Practice attempts, interview sessions and assessments, Resume Roast records, and Trailmate requests and sessions are the source of truth. The rows below are owner-scoped projections for navigation. They can be rebuilt from those records; they are not independent analytics truth.

| Page               | Prepared row                                     | Data read on a normal visit                                                           |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Overview, Progress | `CandidateAnalyticsSnapshot.payload`             | One owner-scoped snapshot (plus the small workspace shell/profile state for Overview) |
| Practice           | `PracticeHomeSnapshot.payload`                   | One owner-scoped Practice view                                                        |
| Interviews         | `WorkspacePageSnapshot` with page `interviews`   | One interview view; rolling quota is recalculated from saved start times              |
| Roastumé           | `WorkspacePageSnapshot` with page `resume-roast` | One resume and roast view; its state API is for explicit refresh and fallback         |
| Trailmate          | `WorkspacePageSnapshot` with page `trailmate`    | One history and recognition view, plus a current active-conversation lookup           |
| Reports            | `WorkspacePageSnapshot` with page `reports`      | One Reports view; rolling quota is recalculated from saved start times                |
| Profile, Manage    | No page snapshot                                 | Direct reads of the fields those pages need                                           |

`CandidateActivityDaily` holds UTC activity totals for future charts. It is maintained after analytics publication. It does not serve the pages above. The older `CandidateAnalyticsSnapshot.reportsPayload` column remains in the database for compatibility but is no longer read or written. Reports now has its own projection and cannot trigger a Practice or Progress rebuild just to show report history.

## Freshness and failures

Database triggers increment a projection's dirty version when its source records change. A successful build publishes only if that version has not changed during the build. A normal GET returns an existing valid-schema payload immediately, even when it is dirty or has reached its refresh time, and schedules a rebuild after the response. This prevents a stale projection from turning navigation into a multi-query rebuild. Explicit refresh work after writes requests a fresh build. If a source read fails, the incomplete result is not published. A later request or the maintenance recovery can retry.

A missing or incompatible projection still builds on the first request. New candidates are prepared after onboarding. Existing candidates need a one-time backfill after deployment, before judging cold-route latency. The daily maintenance function also recovers a bounded number of dirty rows. It leaves routine UTC-day rollover to on-visit refresh, and the one-time backfill handles missing rows. It is a fallback; high-volume deployments should monitor its backlog and move that work to a dedicated queue/worker if it grows. A page can briefly show its last saved data after an action until the background rebuild finishes. Trailmate's active conversation is read directly to avoid stale call state.

The existing client router cache can avoid a new navigation request on short return visits. Source changes still need server invalidation and fresh projections; client caching alone does not replace either. Reading a prepared row makes no AI request. A cold Interviews rebuild can generate a personalized plan and call AI; onboarding preparation runs that work after the response. Clerk authentication, remote database latency for even one row, server rendering, and browser hydration can still contribute to page load time.

All server reads use one Prisma client and connection pool per running instance. Page builders must use that shared client; constructing a client on each request can exhaust the database pool under load.

## Development migration and backfill

Apply the migrations before running this code:

```sh
pnpm db:init:dev
```

For existing development accounts, run the authenticated maintenance endpoint while the Next server is running. Use its `snapshotsOnly=1` option repeatedly until `attempted` is zero. Each call processes at most four projections, so it stays within the configured function duration. The endpoint requires the existing `CRON_SECRET` bearer token. The analytics-only CLI (`pnpm analytics:backfill:dev`) remains available for rebuilding `CandidateAnalyticsSnapshot` and daily rows; it cannot build Practice or Interviews because their cached builders require a Next request context.

For production, apply migrations to the verified production database first. Then invoke the same secured endpoint in bounded batches until there is no backlog. New candidates get their initial rows from onboarding preparation. The regular daily `/api/cron/maintenance` invocation processes up to four dirty recovery jobs after help and interview maintenance. Snapshot version counters and rebuilds are idempotent, so interrupted backfills can be resumed.

## Diagnosing latency

`candidate.analytics_snapshot_read_slow`, `practice.home_snapshot_read_slow`, and `workspace_page_snapshot_read_slow` mean the prepared row itself took over one second. `*_rebuild_slow` and `*_snapshot_publish_slow` identify source reads and writes. If an existing row is dirty, those rebuilds occur after the response; the Next development server may still print their logs near a GET. Check browser navigation timing or time to first byte before attributing that work to the visible page load. `candidate.analytics_source_slow` names the slow source, and `*_changed_during_build` shows a source-write race. Profile and Manage use direct reads and have their own query timing logs.
