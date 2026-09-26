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
