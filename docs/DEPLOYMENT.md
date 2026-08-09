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
```

`LIVEKIT_AGENT_NAME` should match the deployed LiveKit worker.

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
