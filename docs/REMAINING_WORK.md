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

- [x] **Live voice interviews: audit.** Done September 28, see [INTERVIEW_AUDIT.md](INTERVIEW_AUDIT.md).
- [x] **Interview phase 1** (reconnects, turn retries, grading). Done, uncommitted; test a voice
      round longer than 10 minutes before deploying.
- [x] **Interview phase 2** (fair scoring, instructions locked into the token, card states,
      System Design gate). Done, uncommitted; test with phase 1.
- [x] **Interview phase 3** (less repetition, fresher questions, role-weighted fallbacks, unseen
      DSA problem, background kit). Done, uncommitted; test with phases 1–2.
- [x] **Interview phase 4** (scoring in code, graded once per question, reasoning model for
      grading). Done, uncommitted; test with phases 1–3.
- [ ] **Re-run the interview eval** (`pnpm interview:quality`) once the dev Gemini quota recovers,
      to check shallow answers now land around 30 rather than 15.
- [x] **Interview phase 5** (cleanup). Done, uncommitted.
- [ ] **Test all five interview phases together**, then commit and deploy.
- [ ] **Later: System Design (Practice and Interview) for Frontend and Data** (about 4–5 days).
      Decided September 28, deferred for now. Plan in
      [Future scope](09_FUTURE_SCOPE.md#system-design-for-frontend-and-data).
- [ ] **Later: data-engineering MCQs** for the fundamentals bank (about 15, an afternoon).
- [ ] **Pricing.** Principles in [Future scope](09_FUTURE_SCOPE.md#monetisation).

## 4. Later, when growth needs it

Tracked with triggers in [Future scope](09_FUTURE_SCOPE.md#later-when-growth-needs-it): helper
matching rebuild, local-timezone days, push instead of polling, Trailmate email invites.

## Dev-only demo data

Trailmate demo data lives only in the dev database and only involves the demo account
(vermanikhilwork@gmail.com). Other accounts see empty personal history and the global Top
Trailmates list.

- Seed: `pnpm trailmate:demo` (script: `scripts/trailmate-demo-seed.ts`)
- Remove: `pnpm trailmate:demo --undo`

## Useful commands

- Resume Roast quality eval: `pnpm resume-roast:eval`
- Regenerate static voice lines: `pnpm voice:lines --provider deepgram`
- Checks: `npx tsc --noEmit -p .`, `npx eslint <dirs>`, `npx vitest run`
