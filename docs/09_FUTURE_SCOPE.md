# 9. Future scope

Last updated: September 28, 2026

Where Trailgrad goes from here. The near-term queue with checkboxes is in
[REMAINING_WORK.md](REMAINING_WORK.md); this page is the longer view and the reasoning behind the
order.

## Guiding order

Agreed sequence:

1. Fix cost leaks and the expensive paths.
2. Market the free product and get real users.
3. Build payments only if retention shows people come back.
4. Build the mentor marketplace only if people pay.

Nothing below should jump that order without a reason from real usage data.

## Now: ship and measure

| Item | Why | Size |
| --- | --- | --- |
| Commit and deploy the rest of the September 28 work | Onboarding, loader, DSA latency, report copy and docs are still local | Hours |
| Add CI (type check, lint, tests on every push) | Catches breakage without relying on one laptop | Hours |
| Fill the production latency baseline | Replace estimates with p50/p95 from `api.action_timing` in [LATENCY.md](LATENCY.md) | A few days of traffic |
| Raise or plan AI provider quota | 429 at about 16 calls/min will fail under a small launch | Hours plus billing |
| Watch the new logs | `resume_roast.generation`, `help.request.*`, fresh-wait logs | Ongoing |

## Next: measure voice interviews

The audit and its five fix phases are done ([INTERVIEW_AUDIT.md](INTERVIEW_AUDIT.md)). What is
left needs real sessions:

- Measure turn latency end to end: learner stops speaking, decision made, first audio back.
- Cost per session by provider, and where to cut it (shorter instructions, fewer grading calls,
  pre-recorded hand-offs).
- Write Frontend and Data System Design scenarios and data-engineering MCQs.
- Decide the free allowance and the metered unit (see [Monetisation](#monetisation)).

## System Design for Frontend and Data

Decided September 28, 2026; deferred. Today these learners do not see the System Design
interview round (it is hidden, and `/interview/design` redirects) and have no Architecture Practice
track.

**Decisions already made**

- Frontend and Data get the round in both Architecture Practice and the interview, like Backend,
  Full-stack, and AI/ML. The same scenarios power both.
- They reuse the existing architecture: round, canvas, five stages, interviewer, grading, report.
- About 6 scenarios per role (12 total): about 4 on the Practice path and 2 marked interview-only,
  because the interview skips scenarios the learner has practised.
- Ship Frontend first, then Data, each as soon as its content is reviewed.
- Consider hiding the round for freshers in these roles; real interviews rarely ask them.

**Code (1–1.5 days)**

1. Add `frontend` and `data` to `architectureDesignRoleSchema`
   (`src/features/practice/architecture-design/domain/contracts.ts`), the families enum, and
   `systemDesignSupportsRole` (`src/features/interviews/domain/dsa-design-round.ts`).
2. Make the fixed stage prompts and "listen for" lists in `designQuestions`
   (`src/features/interviews/server/dsa-design-round.ts`) and the design rules in the Live
   instruction (`buildDsaDesignSystemInstruction` in the token route) role-specific. They assume
   backend today (storage, async boundaries, partitioning, idempotency).
3. Add an interview-only flag to scenarios and respect it in Practice ranking.
4. Show the Architecture track in Practice home, the track list, and progress for these roles.
5. Tests for both paths and both roles.

**Content (2–3 days including review)**

Each scenario: premise, realism anchors (the pressure tests), four questions with a reference
answer and rubric points, roles, seniorities, and human review approval. Same shape as
`src/features/practice/architecture-design/domain/ai-ml-scenarios.ts`.

- Frontend ideas: news feed with infinite scroll and offline support; instant autocomplete search;
  a collaborative editor's front end; image-heavy product page performance; a design system rollout;
  a real-time dashboard.
- Data ideas: clickstream pipeline into a warehouse; change data capture into a data lake; daily
  revenue with late-arriving data; real-time fraud features; data quality and lineage; a metrics
  layer with backfills.

**Related, larger rounds**

| Round | For | Size | Notes |
| --- | --- | --- | --- |
| SQL | Data | 3–4 days | Reuse the DSA room and Judge0 (SQLite); needs a result-set checker and 20–30 SQL problems with sample tables. Bigger gap for Data than System Design. |
| Machine Coding | Frontend | 5–7 days | Build a UI component in 60–90 minutes, common in Indian product companies. Needs an in-room HTML/CSS/JS preview and a new grading approach. |

## Soon: product gaps

| Item | Detail |
| --- | --- |
| Maya fallback in Trailmate | When no mate is free, Maya explains the next step from her stuck summary and the learner's code (about half a day) |
| Avatar picker | Show on first visit only, or keep as is |
| Trailguide booking | Mentor profiles, availability, booking, payment per session. Only after payments exist |
| Job-description upload | Plan interviews against a specific job, not just the resume and role |
| Hidden DSA tests | Separate visible and hidden cases so passing means correct |
| Test contracts for personalised code tasks | Generate tests alongside each task |
| Eval baselines | Store eval results and compare each prompt or model change against the last run |

## Later: when growth needs it

| Item | Trigger | Approach |
| --- | --- | --- |
| Rebuild Trailmate helper matching | About 1,000–2,000 users | Precompute per-pattern helper evidence; keep the SQL eligibility check for claims |
| Local-timezone days | Before streaks matter to many users | Timezone column on the profile, threaded through streaks, activity, and rollover |
| Push instead of polling | Thousands online at once | Server-sent events or a hosted realtime service for help status and notifications |
| Email or push invites for Trailmate | Only if `help.request.expired` stays high after online-first invites | Resend is already wired; add opt-in |
| Move off Vercel Hobby | Function limit, daily cron, or traffic | Pro plan: more functions, frequent cron, better limits |
| Database region | If most users are in India | Move Neon and functions closer, or add a read replica |

## Monetisation

Principles already agreed:

- **Practice stays free.** Clearing a question is what makes someone eligible to help, so free
  practice is the helper supply.
- **Peer help stays free.** It costs about $0.05 a session, it is the hardest thing for others to
  copy, and a paywall would drain the pool of helpers. If it needs a limit, use credits earned by
  helping.
- **Voice interviews are the thing to meter.** At about $0.68 a session they are the only expensive
  feature. Likely shape: a few free sessions, then a subscription or pack.
- **Mentor sessions are pay-per-use,** never bundled into a subscription.
- **Maya never upsells.** Mentor suggestions are computed in code on the server, never written by
  the model, and never shown at the moment someone fails.

Open decisions: price points for India and elsewhere, the free voice allowance, payment provider,
and whether Resume Roast has a limit.

## Engineering health

- Carry out the [CLEANUP.md](CLEANUP.md) batches in order.
- Drop the legacy models once production has no rows in them.
- Update `INTERVIEW_ENGINE.md` paths and the README to match `src/features/`.
- Split `globals.css` by area where it is page-specific.
- Keep these docs current with each change (see the [index](README.md#keeping-these-current)).

## Ideas worth exploring

Not committed; listed so they are not lost.

- Company-specific interview tracks built from public interview patterns.
- A readiness estimate per target company or level, computed from practice and interview evidence.
- Spaced repetition for questions answered poorly.
- Shareable reports for learners who want feedback from a friend or mentor.
- Group Trailmate sessions for common stuck points.
- A mobile layout pass focused on practice on the go (reading lessons, MCQs, ordering questions).
