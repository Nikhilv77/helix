# 5. Features

One section per product area: what the learner sees, how it works, where the code is, and what
was hardened. Paths are relative to `src/`.

- [Onboarding](#onboarding)
- [Home and Overview](#home-and-overview)
- [Practice](#practice)
- [Interviews](#interviews)
- [Reports](#reports)
- [Progress](#progress)
- [Resume Roast](#resume-roast)
- [Trailmate (peer help)](#trailmate-peer-help)
- [Notifications](#notifications)
- [Profile and Manage](#profile-and-manage)
- [Trailguide](#trailguide)
- [Search, marketing and operations](#search-marketing-and-operations)

---

## Onboarding

**Learner sees:** pick a teacher, pick a level, upload a resume (PDF or DOCX), then review what
was found: identity, evidence, and a readiness screen ("Skills from your resume."). Finishing
lands on the home page with `?welcome=<teacher>` and the teacher's greeting.

**How it works**

- `features/onboarding/server/resume/service.ts` extracts structured data with Gemini, plus a
  deterministic technology detector over the document text (it recovers explicit technologies the
  model missed and normalises aliases such as `React.js` → `React`).
- The analysis has a 52 s budget, is hedged after 12 s, and falls back to the Gemini reasoning
  model.
- The extraction is a **preview** with an expiry. Confirming it creates the candidate profile and
  starts plan generation.
- `ui/flow/onboarding-draft.ts` keeps the unfinished flow in `sessionStorage` for that tab, so a
  refresh during review keeps the step, choices, and preview. A preview close to expiry sends the
  learner back to the upload step with their choices kept.
- `features/preparation-onboarding` runs the baseline questions; its reads run in parallel.
- `app/root-loading-surface.tsx` shows the welcome loader, not the dashboard skeleton, on the
  way to `/?welcome=…`. It follows the theme.

**Routes:** `api/onboarding/resume`, `api/preparation-onboarding`, page `/onboarding`.

---

## Home and Overview

**Learner sees:** the teacher, today's next step, streak, and quick links. The first visit after
onboarding runs a short Overview welcome tour.

**Code:** `features/dashboard`. Data comes from the analytics and practice-home snapshots.

---

## Practice

**Learner sees:** a Practice home with tracks. Each track is a sequence of stories (chapters)
made of short lessons and questions, ending in a checkpoint assessment. Interactive question
types include ordering and sequencing, MCQ, short answer, code, and (Architecture) a design
canvas. Teachers introduce blocks with pre-recorded lines.

| Track | Route | Shape |
| --- | --- | --- |
| DSA | `/practice/dsa`, `/dsa-questions` | Phases of problems, Monaco workspace, Judge0 runs, hints, Daniel's feedback after an accepted run, block assessments |
| Core Technical | `/practice/core-technical` | Stories with questions and code runs (Vercel Sandbox, Node 22.22.2), assessments with reports |
| Applied Engineering | `/practice/applied-engineering` | Incident-based stories: debug and fix real-world failures |
| Architecture & Design | `/practice/architecture-design` | Scenarios with a canvas and design questions |
| AI/ML, Frontend, Data | `/practice/ai-ml`, `/frontend`, `/data` | Story tracks with assessments (`features/practice/story-tracks`) |

**How it works**

- Content is authored and published as versions with scripts
  (`pnpm core-technical:publish`, `applied-engineering:publish`, `architecture-design:publish`).
- All track actions go through `api/practice/[track]/[...action]` and are wrapped by `timeAction`,
  which logs `api.action_timing` and sets a `Server-Timing` header.
- After a practice write, the Practice and Progress snapshots are marked dirty and rebuilt after
  the response.
- DSA: a solved question fires `DSA_QUESTION_SOLVED_EVENT` so the page updates without a
  refresh. Code runs hold a Redis lease that is released exactly once. Block-assessment start uses
  `enforceAndAcquire` (rate limit and lease in one step).
- Clearing a question is what makes a learner eligible to help others on it in Trailmate.

Timings and open latency items: [LATENCY.md](LATENCY.md). History: [CHANGELOG.md](CHANGELOG.md).

---

## Interviews

**Learner sees:** six rounds on `/interviews`:

1. DSA
2. Core Technical
3. Applied Engineering
4. Architecture & System Design
5. Resume & Behavioral Defense (hiring manager)
6. Final Mock

Each round runs in a voice room (Gemini Live) or as text. Finished rounds show
`Completed`, or `Completed · Updated round` if the plan adapted since.

**How it works**

- The planner stores five internal kinds (`problem-solving`, `core-technical`,
  `applied-engineering`, `architecture-system-design`, `final-mock`). The UI replaces
  `problem-solving` with the dedicated DSA round and adds Resume & Behavioral.
- Blueprints come from the candidate profile, target-role relevance, and demonstrated
  performance. Completed interviews adapt the next plan revision.
- A server-side state machine enforces question count, follow-up budget, and time caps.
  Follow-ups stay within the blueprint.
- `INTERVIEW_DAILY_LIMIT` (default 2) limits starts per day.
- Round-specific logic: `features/interviews/server/` (`dsa-design-round.ts`,
  `fundamentals-round.ts`, `hiring-manager-round.ts`, `decider.ts`, `interview.service.ts`,
  `evaluation-recovery.ts`).

Full design: [INTERVIEW_ENGINE.md](../INTERVIEW_ENGINE.md).

**Routes:** `api/interview/*` (start, decide, dsa, design, fundamentals, hiring-manager, resume,
technical-projects, gemini-live/token, operations, quota).

**Status:** not yet audited for latency and cost. This is the next major area. See
[Future scope](09_FUTURE_SCOPE.md).

---

## Reports

**Learner sees:** `/reports` lists finished interview rounds and practice checkpoints. Each report
shows a verdict, the strongest area, scored skills (unscored ones are labelled "Not scored"), what
to practise next, and a PDF export. The teacher reads out a short briefing.

**How it works**

- `features/reports/server/reports-page-data.ts` reads the reports workspace snapshot, waiting up
  to 2 s for fresh data.
- Interview rounds are paginated separately, so practice checkpoints cannot crowd them out.
- Rounds that expired stop showing as in progress (`nextExpiryAt`).
- `features/interviews/server/report.ts` rewrites evaluator gaps into learner steps on read,
  so old saved reports read correctly too.
- The strength shown is never the weakest skill.
- PDF: `features/reports/application/report-pdf.ts` (pdf-lib).

---

## Progress

**Learner sees:** readiness, streaks across tracks, recent activity, strengths and gaps.

**How it works:** `features/progress/server/progress.service.ts` reads the analytics snapshot
(waits up to 2 s for fresh data after practice) and one roadmap read. Cross-track streaks are not
capped. Days are UTC days (see [Known issues](08_KNOWN_ISSUES.md#product-and-ux)).

---

## Resume Roast

**Learner sees:** a score out of 10 across five recruiter-style areas, a blunt roast in James's
voice, and rewrites of their own lines. They can update the resume from the page and roast again.

**How it works**

- Two passes in parallel: a scoring pass (temperature 0, seed 7, cached per resume version,
  target, and rubric version) and a roast pass (prompt v7). See
  [scoring](04_AI_VOICE_AND_SCORING.md#resume-roast).
- Only one roast can be generating per user (partial unique index). A second tab joins it:
  `POST` returns 202 and the page polls `GET ?roastId=`.
- Generation continues after a refresh or disconnect via `after()`.
- Each roast writes one `resume_roast.generation` log line.

**Code:** `features/resume-roast/{contracts,server,ui}`, `api/resume-roast/route.ts`,
`lib/voice/resume-roast-lines.ts`, `scripts/resume-roast-eval.ts`.

---

## Trailmate (peer help)

**Learner sees:** on a stuck question, "Ask someone". Trailmate finds people who have solved that
question, preferring those online now ("3 online now"), and invites them. When one accepts, both
join a LiveKit call with the question in context. Afterwards the learner can rate the session.
`/trailmate` shows people you've supported, people who supported you, the top 5 Trailmates, and a
"View all" leaderboard (top 100).

**Rules and timings**

| Rule | Value |
| --- | --- |
| Request expires if nobody accepts | 10 minutes |
| "Online" means seen within | 3 minutes |
| Session cap | 30 minutes |
| Helper must join after claiming within | 2 minutes |
| Status polling | Every 15 seconds while a tab is open |
| Top Trailmates cache | 45 seconds |

- Matching (`helper-matching.ts`) scores eligible helpers on qualification (40%), recency with a
  21-day half-life (25%), language (15%), pattern experience (12%), and breadth (8%). Online helpers
  come first.
- If nobody accepts, the learner gets an expiry notice and a hint fallback.
- Safety: block and report (`HelpBlock`, `HelpReport`), help invitations can be turned off in
  Manage, and deleted accounts are anonymised in others' history.
- Lifecycle logs: `help.request.opened`, `claimed`, `resolved`, `cancelled`, `expired`, `rated`.

**Code:** `features/peer-help`, `api/help/[...path]` (status, request, leaderboard, and others),
`app/trailmate`, `features/practice/dsa/ui/ask-someone.tsx`.

Original requirements: [trailgrad-contextual-peer-help.md](../trailgrad-contextual-peer-help.md).

---

## Notifications

In-app notifications written in the teacher's voice (help invitations, results, nudges).
`features/notifications/server/notification.service.ts`. Email through Resend exists but is off
unless `NOTIFICATION_EMAIL_ENABLED` is set. Turning Trailmate requests off withdraws pending
invitations.

---

## Profile and Manage

- **Profile (`/profile`):** the resume-derived profile, cover image and avatar. `PUT /api/profile`
  only saves the cover and avatar; profile content changes by uploading a new resume.
- **Manage (`/manage`):** notification and Trailmate settings, and account deletion. Deletion
  removes the learner's data, including Trailmate blocks and reports, ends any live session they
  were helping in, and anonymises them in other learners' history.

**Code:** `features/profile`, `features/account`, `api/profile`, `api/account`.

---

## Trailguide

A landing page for one-to-one sessions with experienced engineers (`/trailguide`,
`/trailguide/mentors`, `/mentors`), with an FAQ. Booking shows "Coming soon" and a contact email.
No backend yet. Planned as pay-per-use; see [Future scope](09_FUTURE_SCOPE.md#monetisation).

---

## Search, marketing and operations

- **Search:** `api/search`, `features/search`: finds questions and content across tracks.
- **Marketing:** home for signed-out visitors, `/blog`, `/privacy`, `/terms`, sitemap, robots,
  Open Graph image.
- **Operations:** `/operations/interviews` (operator-only, `OPERATOR_USER_IDS`) shows interview
  health and metrics.
- **Health:** `GET /api/v1/health` returns database status; use it after every deploy.
