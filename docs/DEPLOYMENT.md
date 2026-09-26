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
`PrismaClientInitializationError`. `/api/v1/health` returned 503 with
`database.status: down`. A local `pnpm deploy:production` initially generated 67 function
bundles and Vercel rejected the deployment because the Hobby plan allows 12.

**Cause:** A Prisma Client generated on macOS included the Mac query engine, but the deployed
Vercel Node runtime asked Prisma for `rhel-openssl-3.0.x`. The build output's `arm64`
architecture label was misleading here: adding a Linux ARM64 engine did not fix the runtime
error. Including both development and production engines also made Next.js split the app
into too many functions. Removing the development engine *after* `vercel build` was too late;
Next.js had already grouped the routes.

**Fix:** `prisma/schema.prisma` includes `native` for local development and
`rhel-openssl-3.0.x` for production. During `pnpm deploy:production`, Prisma Client is
generated, then `scripts/prune-prisma-deploy-engines.mjs` removes the development engine
**before** `next build`. Next.js then emits 10 functions. After the build,
`scripts/prepare-vercel-artifact.mjs` excludes local `.env` and `.env.local` files from the
function bundles. `pnpm vercel:verify` checks the function count, the production engine,
and the absence of those local environment files before upload. Vercel's configured
Production environment variables provide runtime secrets.

**Check after deployment:** Open `https://www.trailgrad.com/api/v1/health`; expect HTTP 200,
`status: ok`, and `database.status: up`. If it returns 503, inspect Vercel runtime logs for
`[HealthService] database check failed` and read the runtime target named in the Prisma
error. The successful 2026-09-26 deployment was `dpl_13UGTxNjbGhg9RDkz4qEJ5vad196`,
with 10 functions and a healthy database.

These changes affect deployment packaging and database startup, not the app's UI, questions,
or feature logic. The health check now writes a redacted error to server logs if its database
query fails; its HTTP response shape is unchanged. The Prisma `binaryTargets` change needs
no database migration. A local deployment build temporarily removes the Mac engine from the
generated client; `pnpm prisma:generate` or `pnpm dev` regenerates it for local use.
