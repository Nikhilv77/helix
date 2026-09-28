# 7. Operations

## Deploying

Automatic Git deployments are off (Vercel's Git `patchBuild` step wrongly rejects this project).
Deploys are built locally and uploaded:

```bash
pnpm deploy:production
```

What it does:

1. Generates Prisma Client and prunes it to the RHEL engine before `next build`, so Next.js groups
   routes into about 10 functions (the Hobby limit is 12).
2. Builds with Vercel CLI 59.14.0.
3. `scripts/prepare-vercel-artifact.mjs` restores the ARM64 engine into each Prisma bundle and
   removes `.env` and `.env.local` from the artifact.
4. `pnpm vercel:verify` checks the function count, both engines, and the absence of env files.
5. Deploys the prebuilt artifact.
6. Runs `prisma generate` again so local development has its macOS engine back.

### The Prisma engine and function limit

Production needs two Prisma query engines: the health API runs on `rhel-openssl-3.0.x` and
server-rendered pages on `linux-arm64-openssl-3.0.x`. `prisma/schema.prisma` lists `native` plus
both targets. Including every engine during `next build` makes Next.js split the app into too many
functions (67 in the September 26 incident), and removing an engine after `vercel build` is too
late because routes are already grouped. So the build keeps only the RHEL engine
(`scripts/prune-prisma-deploy-engines.mjs`), and `scripts/prepare-vercel-artifact.mjs` adds ARM64
back to each Prisma bundle afterwards.

A deploy build removes the Mac engine locally. The deploy command regenerates it at the end; if a
deploy stops partway, run `pnpm prisma:generate` before local scripts that use the database.

### The Node pin for code runs

The Core Technical and Applied Engineering runner is pinned to Node **22.22.2**, the version
Vercel's `node22` sandbox runs, and fails closed on a mismatch. If Vercel changes the image, every
code run fails with "does not provide pinned Node.js …". Re-pin
`CORE_TECHNICAL_NODE_RUNTIME_VERSION` (and `CORE_TECHNICAL_RUNNER_VERSION`) in
`runner-contracts.ts` and the `node` dependency in `package.json` to the reported version.

### After every deploy

- `https://www.trailgrad.com/api/v1/health` returns 200 with `database.status: up`.
- Signed in, `/auth/continue` reaches the app or onboarding without a 500.
- Spot-check the pages the release touched, in light and dark.
- Health alone is not enough: in the September 26 incident health returned 200 while
  `/auth/continue` still returned 500.
- If a Prisma error appears, the runtime log names the missing engine target.
- Run the spot checks in that release's [CHANGELOG](CHANGELOG.md) entry.

## Database migrations

Migrations are never run by the deploy. When a release changes the schema, migrate first:

```bash
pnpm db:migrate:production
```

This pulls the production environment into a temporary file, checks that both database URLs name
`trailgrad-production`, runs pending migrations, and deletes the file. Do not use `vercel env run`
for this: it can inherit `.env.local` and hit the wrong database.

Rules:

- Migrations must be backward compatible with the code currently live, because the migration lands
  before the deploy.
- Production and the repository both have 101 migrations as of September 28. Check with
  `prisma migrate status` against production before a release.
- Only run production migrations when the owner asks for it.

## Cron

One daily job (`vercel.json`): `GET /api/cron/maintenance` at 04:00 UTC, authorised with
`Bearer $CRON_SECRET`, up to 60 s.

It runs, in parallel:

- `runGlobalHelpMaintenance`: expire stale help requests, reconcile stale help sessions, send
  the related notifications, purge expired invitation notifications, and retry pending emails.
- `interviewEvaluationRecoveryService.runBatch(5)`: finish interview evaluations that stalled.
- `interviewOperationsService.enforceRetention()`: delete interviews past their retention window.

Then `recoverDirtySnapshots(4)` rebuilds snapshots left dirty. `?snapshotsOnly=1` runs only the
snapshot recovery, which is useful for backfills after a deploy.

Hobby allows daily cron only. Anything that needs to happen sooner happens on request or in
`after()`.

## Logs to watch

All server logs go through `src/server/common/logger.ts` into Vercel runtime logs.

| Log | What to look for |
| --- | --- |
| `api.action_timing` | p50/p95 per action; anything at 2 s or more logs as a warning |
| `resume_roast.generation` | Duration, provider per pass, fallback use, failure code |
| `help.request.opened` / `claimed` / `resolved` / `cancelled` / `expired` / `rated` | Eligible, invited, and online counts; wait until claimed; session length; expiry rate |
| `candidate.analytics_fresh_wait_exceeded`, `workspace_page_fresh_wait_exceeded` | How often Progress and Reports fall back to saved data |
| Cron response | `success: false` and the failing job name |

Browser side, each practice response has a `Server-Timing` header.

## Provider quotas

- **Gemini:** hit 429 at about 16 calls per minute during the roast eval. Before a launch, check
  the project's paid-tier limits.
- **Groq:** 429s appeared on the larger model. The 20b model is used for interview paths.
- **Deepgram:** used for live teacher speech; pre-recorded lines avoid most calls.
- **Judge0 (RapidAPI):** code runs are rate limited per user and leased per scope.
- **LiveKit:** tokens rate limited; one room per help session.

## Data and privacy

- Account deletion removes the learner's data (see [Features](05_FEATURES.md#profile-and-manage)).
- Interview retention is enforced daily, with separate windows for signed-in, anonymous, and
  operational data (`INTERVIEW_*_RETENTION_DAYS`).
- Raw resume text is not kept after extraction.
- Never commit `.env`, `.env.local`, or `.vercel/`.

## Incident notes

| Date | Incident | Fix |
| --- | --- | --- |
| 2026-09-26 | Production 500s with `PrismaClientInitializationError`; build over 12 functions | Engine pruning before build, engines restored into bundles after (see [above](#the-prisma-engine-and-function-limit)) |
| 2026-09-26 | Every production code run failed: sandbox Node 22.22.2 did not match the 22.23.2 pin | Re-pinned to 22.22.2 (see [above](#the-node-pin-for-code-runs)) |
| 2026-09-27 | Core Technical "could not prepare the practice path" after 55 s: Gemini 503, then Groq schema failure and 429 | Paths start from the reviewed version without live generation |
| 2026-09-28 | After a deploy, local Prisma had no macOS engine | `deploy:production` now ends with `prisma generate` |
| 2026-09-28 | Onboarding resume analysis failed on the Groq fallback (bad JSON, dropped experience, 429) | Fallback switched to the Gemini reasoning model, hedged at 12 s |
