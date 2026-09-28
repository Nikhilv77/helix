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

## Next: audit voice interviews

The next major area, and the most expensive one.

- Measure turn latency end to end: learner stops speaking, decision made, first audio back.
- Reconnect behaviour: dropped network, tab switch, second tab.
- Cost per session by provider, and where to cut it (shorter prompts, cached plans, fewer
  evaluator calls, pre-recorded hand-offs).
- Decide the free allowance and the metered unit (see [Monetisation](#monetisation)).

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
