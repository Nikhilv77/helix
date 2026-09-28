# Remaining Work

Last updated: September 28, 2026

The short-term to-do list, in order. Tick items off as they land and record them in that
release's [CHANGELOG](CHANGELOG.md) entry. The longer view is in
[Future scope](09_FUTURE_SCOPE.md); known problems are in [Known issues](08_KNOWN_ISSUES.md).

## 1. Ship what's done

Resume Roast, Progress, Reports, Trailmate, Profile and Manage are deployed (commit `0127a164`).
Onboarding, the loader, DSA latency, the single-report copy, the deploy script and the new docs
are tested but not yet committed. What is in it: [CHANGELOG, 2026-09-28](CHANGELOG.md).

- [ ] Review in the browser, dark and light, desktop and phone: Onboarding (including a refresh
      during resume review), the welcome loader, the DSA question page, a single report.
- [ ] Commit and deploy with `pnpm deploy:production`.
- [ ] After deploying, watch the logs listed in
      [Operations](07_OPERATIONS.md#logs-to-watch).

No migrations or new environment variables are needed for this part.

## 2. Small follow-ups

Each is under an hour unless noted.

- [ ] **Avatar picker on Profile.** It opens on every visit until an avatar is chosen. Decide
      whether it should open only on the first visit.
- [ ] **Trailmate "no mate free" fallback.** It currently offers the question's written hints.
      The original idea was Maya explaining the next step from her stuck summary and the
      learner's code (about half a day).
- [ ] **Add CI.** Type check, lint, and tests on every push (a few hours).

## 3. Next areas to audit

- [ ] **Live voice interviews.** The most latency-sensitive part of the app: turn latency, TTS,
      reconnects, cost per session. See [LATENCY.md](LATENCY.md#open-items).
- [ ] **Pricing.** Principles in [Future scope](09_FUTURE_SCOPE.md#monetisation).

## 4. Later, when growth needs it

Tracked with triggers in [Future scope](09_FUTURE_SCOPE.md#later-when-growth-needs-it): helper
matching rebuild, local-timezone days, push instead of polling, Trailmate email invites.

## Dev-only demo data

Trailmate demo data lives only in the dev database and only involves the demo account
(vermanikhilwork@gmail.com). Other accounts see empty personal history and the global Top
Trailmates list.

- Seed: `npx tsx scratch/trailmate-demo-seed.ts`
- Remove: `npx tsx scratch/trailmate-demo-seed.ts --undo`

## Useful commands

- Resume Roast quality eval: `pnpm resume-roast:eval`
- Regenerate static voice lines: `pnpm voice:lines --provider deepgram`
- Checks: `npx tsc --noEmit -p .`, `npx eslint <dirs>`, `npx vitest run`
