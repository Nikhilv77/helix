# Production deployment

```bash
pnpm deploy:production
```

Database migrations are not run by this command. Before deploying a release that changes
`prisma/schema.prisma` (including AI/ML Practice persistence), apply the committed Prisma
migrations to the intended production database through the protected database deployment
workflow. Do not point the local development migration command at production.

## Prisma engine and Vercel Hobby function limit (2026-09-26)

**Symptoms:** Production `/onboarding` and `/api/profile` returned 500 with
`PrismaClientInitializationError`. `/api/v1/health` initially returned 503 with
`database.status: down`. A later build made health return 200 while `/auth/continue` still
returned 500, so the health check alone was insufficient. A local `pnpm deploy:production`
also initially generated 67 function bundles, which Vercel rejected because Hobby allows 12.

**Cause:** A Prisma Client generated on macOS included the Mac query engine. In production,
the health API required `rhel-openssl-3.0.x`, while a server-rendered page required
`linux-arm64-openssl-3.0.x`. Neither engine alone covered every function. Including all
engines during `next build` made Next.js split the app into too many functions. Removing an
engine *after* `vercel build` was too late; Next.js had already grouped the routes.

**Fix:** `prisma/schema.prisma` includes `native` for local development and both production
targets. During `pnpm deploy:production`, Prisma Client is generated, then
`scripts/prune-prisma-deploy-engines.mjs` temporarily keeps only the RHEL engine **before**
`next build`, staging the ARM64 engine. Next.js emits 10 functions. After the build,
`scripts/prepare-vercel-artifact.mjs` restores ARM64 and adds it to every Prisma function
bundle. It also excludes local `.env` and `.env.local` files. `pnpm vercel:verify` checks
the function count, both production engines, and the absence of local environment files.
Vercel's configured Production environment variables provide runtime secrets.

**Check after deployment:** Open `https://www.trailgrad.com/api/v1/health`; expect HTTP 200,
`status: ok`, and `database.status: up`. Also open `/auth/continue` with a signed-in browser
session and confirm that it reaches the appropriate app or onboarding page without a 500.
If either route fails, inspect Vercel runtime logs for the Prisma target named in the error.
The successful 2026-09-26 deployment was `dpl_4C276iaVkKpSWdCB88Jr7dwa36B6`, with
10 functions; health, `/auth/continue`, and `/onboarding` returned 200 during verification.

These changes affect deployment packaging and database startup, not the app's UI, questions,
or feature logic. The health check now writes a redacted error to server logs if its database
query fails; its HTTP response shape is unchanged. The Prisma `binaryTargets` change needs
no database migration. A local deployment build temporarily removes the Mac engine from the
generated client; `pnpm prisma:generate` or `pnpm dev` regenerates it for local use.

## Release notes: DSA practice (2026-09-26)

What changed in DSA from end to end is recorded in
[`PRACTICE_LATENCY_OPTIMIZATION.md`](./PRACTICE_LATENCY_OPTIMIZATION.md#dsa-end-to-end-2026-09-26).
Deployment-relevant points:

- No database migration.
- Commit `public/voice/*.mp3` together with `src/lib/avatars/static-voice.generated.ts`
  (152 new block-assessment lines).
- The Core Technical runner is pinned to Node **22.22.2**, the version Vercel's `node22`
  sandbox runs. If Vercel changes the image, code runs fail with "does not provide pinned
  Node.js …"; re-pin `CORE_TECHNICAL_NODE_RUNTIME_VERSION` in `runner-contracts.ts` and the
  `node` dependency in `package.json` to the reported version.
- A deployment build removes the Mac Prisma engine locally. Run `pnpm prisma:generate` before
  local scripts that use the database (`assessments:rescore:production` does this itself).
- `pnpm assessments:rescore:production` rescores completed block assessments (dry run unless
  `-- --apply`, which writes a backup first). Production had none to fix on 2026-09-26.
- Spot checks after deploying: skip a DSA question (instant), solve one (feedback within a few
  seconds, highlighted lines match the praise), open the Review tab (smooth), and run Core
  Technical code (about 2 s).

## Release notes: story-track content and assessments (2026-09-27)

- **Database migration required:** `20260927100000_story_track_assessments` adds the
  `StoryTrackAssessment` table. Apply it to production before or with the deploy; the
  Frontend, Data, and AI/ML track pages read it (a failure only hides the assessment card).
  Applied to development on 2026-09-27.
- Frontend and Data each gain two paths per track (four paths, 20 questions per track).
  Existing learners receive the new questions automatically on their next visit.
- Every authored story path now has an assessment: four frozen prompts (the learner's weakest
  question, two interviewer follow-ups, and a common trap), unlocked when the path is finished.
  It runs in the same typed interview room as the Node.js tracks (assessment kind
  `story-track`), and the interview routes grade the finished room in parallel through the
  Gemini-then-Groq fallback (about 2–5 s).
- Spot checks after deploying: finish a Frontend path, start its assessment, submit, and
  confirm the report and the score on the track overview.

## Release notes: Overview welcome tour (2026-09-27)

- **Database migration required:** `20260927110000_overview_introduction` adds
  `CandidateProfile.overviewIntroducedAt` and marks everyone who already finished onboarding,
  so only new learners hear the tour. Applied to development on 2026-09-27.
- The first Overview after onboarding plays a short spoken tour (live TTS, once per learner);
  the claim is one conditional UPDATE, so refreshes and other devices never replay it.

