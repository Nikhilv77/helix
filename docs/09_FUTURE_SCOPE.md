# 9. Future scope

Last updated: October 2, 2026

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

## Make Practice and Interviews genuinely useful

Written October 2, 2026. The engineering is solid; the product still feels loose because nothing
is anchored to reality. A learner cannot tell whether a question is one real companies ask,
whether "58/100" means they would pass, or whether improving here leads to an offer. The fix is
credibility, focus, and one connected loop, not more features.

| Item | What it means | Why |
| --- | --- | --- |
| Real, curated question bank | 60–80 hand-written or verified backend and full-stack questions, each built on a real artifact (a slow-query log, an incident timeline, a PR diff). AI writes follow-ups, variations, and grading, not the core bank. Retire the weakest generated paths | Generated paths read like rubric checklists; real questions are narrower and messier, and learners can tell |
| Sourced questions | Tag each question with where it comes from ("asked at a fintech, 2026, L2 backend round") | Provenance is what makes a question worth practising |
| User-submitted questions | Learners submit questions they were actually asked, reviewed before publishing, in exchange for credits that unlock peer help | Fits the escalation ladder and builds the one asset competitors cannot copy |
| One audience first | Own the 2–5 years' experience engineer in India targeting product companies end to end (DSA, low-level design, system design, backend fundamentals) before deepening other roles | Five disciplines at once leaves every one thin |
| Hiring-bar verdicts | Replace "58/100" with Strong hire / Hire / Lean no / No, plus three quoted transcript moments as evidence | A score without a bar means nothing; a verdict with evidence reads like a real debrief |
| Calibrated grading | A gold set of about 50 transcripts graded by real senior engineers; track agreement with the AI (extend the existing gold-evaluation runner); later, ask learners how real interviews went and correct against that | "You would likely pass this round" is only valuable if it is believable |
| Interviews that feel real | Strict clock, an interviewer who interrupts and digs into the candidate's own code and resume, real silence instead of encouragement, a few company-style interviewer personas | Pressure is what Practice cannot give; the AI should act as an interviewer, not a teacher |
| Annotated replay | Replay a finished round with weak moments marked | Reviewing your own round is where most of the learning happens |
| One connected loop | Mock round reveals gaps → Practice drills exactly those gaps (spaced repetition on misses, not a fixed path) → the next mock re-tests them | Practice paths and interviews barely talk to each other today |
| Explain out loud | A spoken-answer mode in Practice | Real rounds are spoken; typing answers trains the wrong skill |
| Peer mock interviews as the core | Two learners interview each other with Trailgrad's rubric and timer, built on Trailmate; AI stays the solo warm-up and the scorer | The hardest thing to copy, and what made Pramp and interviewing.io work |

**First four weeks**

1. Talk to 15–20 target users: what did their last real interview ask, and would they trust a
   Trailgrad verdict?
2. Hand-write 20 excellent backend questions with real artifacts; retire the weakest generated
   paths.
3. Ship hiring-bar verdicts with quoted evidence and start the gold set.
4. Build one complete loop (mock round → targeted practice → re-test) for one round type.
5. Track one number: do learners come back within 7 days?

## Next: measure voice interviews

The audit and its five fix phases are done ([INTERVIEW_AUDIT.md](INTERVIEW_AUDIT.md)). What is
left needs real sessions:

- Measure turn latency end to end: learner stops speaking, decision made, first audio back.
- Cost per session by provider, and where to cut it (shorter instructions, fewer grading calls,
  pre-recorded hand-offs).
- Write data-engineering MCQs for the fundamentals bank.
- Decide the free allowance and the metered unit (see [Monetisation](#monetisation)).

## Rounds for Frontend and Data

Frontend and Data System Design shipped on September 28, 2026 (see the changelog). To add another
role or scenarios later: write scenarios in the shape of
`src/features/practice/architecture-design/domain/data-scenarios.ts` (four questions, three
common mistakes each), mark about a third interview-only, and add the role's wording to each
`ArchitectureDesignTrack` table (interview acts, Live rules, report labels, checkpoint prompts).
Consider hiding System Design for Data and Frontend freshers; real interviews rarely ask them.

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
