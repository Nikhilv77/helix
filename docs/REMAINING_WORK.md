# Remaining Work

Last updated: September 28, 2026

What is left after the Resume Roast, Progress, Reports, Trailmate and Profile work, in the
order it should be done. Tick items off as they land and move finished ones to the log at
the end.

## 1. Ship what's done

Everything from the September 28 session is tested (2,001 tests passing) but uncommitted. Both
new migrations are already on production, so deploy soon: until the new code is live, a crashed
roast can leave a user unable to start another one.

- [ ] Review in the browser, dark and light, desktop and phone: Resume Roast, Progress,
      Reports, Trailmate, Profile.
- [ ] Commit the changes.
- [x] Apply production migration `20260928100000_resume_roast_single_generation` (applied September 28).
- [x] Apply production migration `20260928120000_trailmate_presence_and_status_indexes` (applied September 28).
- [ ] Deploy with `pnpm deploy:production`, including the 4 new `public/voice/james-*.mp3`
      files.

No new environment variables are needed.

## 2. Small follow-ups

Each is under an hour unless noted.

- [ ] **Single-report page copy.** "Strongest signal" and raw evaluator text such as "Failed
      to provide a career story..." are still shown. Only the Reports overview was cleaned up.
- [ ] **Avatar picker on Profile.** It opens on every visit until an avatar is chosen. Decide
      whether it should open only on the first visit.
- [ ] **Trailmate "no mate free" fallback.** It currently offers the question's written hints.
      The original idea was Maya explaining the next step from her stuck summary and the
      learner's code (about half a day).

## 3. Next areas to audit

- [ ] **Live voice interviews.** Not audited yet, and the most latency-sensitive part of the
      app: turn latency, TTS, reconnects, cost per session.
- [ ] **Onboarding.** A baseline-results bug and transaction timeouts were fixed earlier, but
      the flow has not been audited end to end. First impressions matter most here.
- [ ] **DSA latency items** 1.1, 1.2, 1.4, 1.6, 1.7 and story first-open items 5.1, 5.2 in
      `docs/PRACTICE_LATENCY_OPTIMIZATION.md`.
- [ ] **Pricing.**

## 4. Later, when growth needs it

| Item | Why it waits | When to do it |
| --- | --- | --- |
| Rebuild Trailmate helper matching | Each request checks every profile (about 1.3 ms per profile on dev). Fine now, slow at scale. | Around 1,000–2,000 users. Precompute per-pattern helper evidence; keep the SQL eligibility function for the claim check. |
| Local-timezone days | Streaks, "today" and day rollover use UTC midnight (5:30am IST) in about 20 files. No user timezone is stored. | Before streaks matter to many users. Needs a profile timezone column threaded through. Do not hard-code IST. |
| Push instead of 15-second polling | Every open tab polls `/api/help/status`. Each check is cheap, but the count grows with open tabs. | Thousands of people online at once. Use a hosted realtime service or server-sent events. |
| Trailmate email invites | Invitations appear in-app only. | Only if the `help.request.*` logs show requests still expiring after online-first invites. |

## Reference

### What changed on September 28

| Area | Main changes |
| --- | --- |
| Resume Roast | Rubric scoring out of 10 (five recruiter-style areas, computed in code, cached per resume and target, fixed seed); sharper v7 roast prompt with grounded rewrites; one running roast per user (second tab joins); generation survives refresh; fresh page reads; pre-recorded James lines; in-page resume update; one `resume_roast.generation` log line per roast. |
| Progress | Waits up to 2 s for fresh data after practice; one roadmap read instead of two; cross-track streaks no longer capped at 7 days; plainer copy. |
| Reports | Real rounds no longer crowded out by practice checkpoints; waits up to 2 s for fresh data; expired rounds stop showing as in progress; strength never shows the weakest skill; honest PDF labels and copy. |
| Trailmate | Indexed 15-second status check; online presence with online-first invites; "N online now" for learners; expiry notice with a hint fallback; `help.request.*` lifecycle logs; polished empty states; top 5 plus a "View all" top-100 leaderboard. |
| Profile | `PUT /api/profile` saves only the cover and avatar; no copy asking for edits that are not possible. |
| Manage | Account deletion now also removes Trailmate blocks and reports, ends a live session they were helping in, and anonymises them as helper in learners' history; turning Trailmate requests off withdraws pending invitations. |

### Logs to watch after deploy

- `resume_roast.generation`: duration, provider per pass, fallback use, failure code.
- `help.request.*`: opened (eligible, invited, online), claimed (wait), resolved (session
  length), cancelled, expired, rated.
- `candidate.analytics_fresh_wait_exceeded` and `workspace_page_fresh_wait_exceeded`: how often
  Progress and Reports fall back to saved data.

### Dev-only demo data

Trailmate demo data lives only in the dev database and only involves the demo account
(vermanikhilwork@gmail.com). Other accounts see empty personal history and the global Top
Trailmates list.

- Seed: `npx tsx scratch/trailmate-demo-seed.ts`
- Remove: `npx tsx scratch/trailmate-demo-seed.ts --undo`

### Useful commands

- Resume Roast quality eval: `pnpm resume-roast:eval`
- Regenerate static voice lines: `pnpm voice:lines --provider deepgram`
- Checks: `npx tsc --noEmit -p .`, `npx eslint <dirs>`, `npx vitest run`

## Log

| Date | Item | Result |
| --- | --- | --- |
| 2026-09-28 | Production migrations | Both applied: Resume Roast single generation, Trailmate presence and status indexes. Production now has 101 migrations. |
| 2026-09-28 | File created | — |
