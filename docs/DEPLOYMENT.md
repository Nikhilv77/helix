# Trailgrad Deployment Cheat Sheet

Trailgrad has two separate deployments:

- The Next.js web app runs on Vercel.
- The Python voice worker runs on LiveKit Cloud Agents.

## Deploy The Web App

Use this when you change the Next.js app, server routes, Prisma schema, UI, or docs.

```bash
git status
git add .
git commit -m "Update Trailgrad app"
git push
```

Vercel auto-deploys after the push if the project is connected to the Git repo.

## Practice Production Alerts

Practice emits structured runtime logs from Vercel Functions. The two release alerts require a
Vercel Log Drain connected to the team's log/alert provider; Vercel's built-in anomaly alerts do
not provide content-specific thresholds for these application signals.

Configure the drain for production `lambda` logs with 100% sampling on
`/api/practice/state` and `/api/practice/attempt`, then create these count alerts:

| Alert | Log field | Window | Fire when |
| --- | --- | ---: | ---: |
| Practice state-save outage | `alertSignal = practice-state-save-outage` | 5 minutes | count >= 10 |
| Practice evaluator outage | `alertSignal = practice-evaluator-outage` | 5 minutes | count >= 5 |

Route both alerts to the production on-call channel. After saving them, exercise each provider's
test-notification function and record the provider, alert IDs, channel, and test time in
`PRACTICE_ENGINE.md`. Never reduce sampling for these two API paths during the initial rollout.

## Vercel Analytics And Google Indexing

Web Analytics is wired into the Next.js root layout with `@vercel/analytics`.
After deploying, enable Web Analytics for the Vercel project in the Vercel
dashboard if it is not already enabled.

For Google Search Console:

1. Add `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel with the `content`
   value from Google's HTML meta tag.
2. Redeploy the web app so the verification meta tag is present on the home
   page.
3. Verify the property in Search Console.
4. Submit `https://trailgrad.com/sitemap.xml` in Search Console.

The app already exposes `robots.txt` with the sitemap URL and allows indexing
for public pages. Private app routes are marked `noindex` and excluded from the
sitemap.

## Deploy The Voice Agent

Use this when you change files in `agent/`, such as:

- `agent/main.py`
- `agent/config.py`
- `agent/trailgrad.py`
- `agent/pyproject.toml`
- `agent/Dockerfile`
- `agent/.dockerignore`

```bash
cd agent
lk agent deploy .
lk agent status
cd ..
```

## Full Deploy Flow

Use this when both the web app and voice agent changed.

```bash
git status
git add .
git commit -m "Update Trailgrad app and voice agent"
git push

cd agent
lk agent deploy .
lk agent status
cd ..
```

## LiveKit Logs

```bash
cd agent
lk agent logs
cd ..
```

Stop the log stream with `Ctrl-C`.

## Required Vercel Env Vars

Vercel needs the root app environment variables, including:

```env
NEXT_PUBLIC_APP_URL=https://trailgrad.com
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
LIVEKIT_URL=wss://trailgrad-km39wyh7.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_AGENT_NAME=helix-interviewer-v2
INTERVIEW_AUTH_SECRET=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

`LIVEKIT_AGENT_NAME` should match the deployed LiveKit worker.
Generate `INTERVIEW_AUTH_SECRET` independently with at least 32 random bytes;
it is never needed by the browser or the LiveKit worker.

Create a small Upstash Redis database in the app's nearest region and copy its REST URL and token
into Vercel. These credentials back cross-instance rate limits, answer/code leases, and the single
LiveKit room per interview. Protected production routes deliberately return
`RATE_LIMIT_UNAVAILABLE` rather than spending provider credits without Redis protection.

## Required LiveKit Agent Secrets

The LiveKit Cloud Agent needs:

```env
DEEPGRAM_API_KEY=...
LIVEKIT_AGENT_NAME=helix-interviewer-v2
TRAILGRAD_API_BASE_URL=https://trailgrad.com
```

LiveKit Cloud stores the agent secrets. Do not commit `.env` or `agent/.env.local`.

## Current Agent

```text
LiveKit project: trailgrad
Agent ID: CA_hrMApqPbq8ns
Region: ap-south
Agent name: helix-interviewer-v2
Production API base: https://trailgrad.com
```

## Quick Rule

```text
Next.js app change  -> git push
Voice agent change  -> cd agent && lk agent deploy .
```
