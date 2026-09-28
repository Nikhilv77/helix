# 8. Known issues

Last reviewed: September 28, 2026

Everything known to be broken, thin, or likely to hurt later. Severity:

- **High:** will hurt real users or cost money at launch.
- **Medium:** noticeable, or will hurt at moderate scale.
- **Low:** debt or polish.

When an item is fixed, remove it here and note it in that release's [CHANGELOG](CHANGELOG.md) entry.

## Release state

| Severity | Issue | Detail |
| --- | --- | --- |
| Medium | No CI | There is no `.github` workflow. Type check, lint, and tests run only when someone runs them locally. |
| Medium | Manual deploys only | Git deployments are off because of a Vercel `patchBuild` bug. A deploy depends on one machine having the right local setup. |

## Scale and performance

| Severity | Issue | Detail | When it matters |
| --- | --- | --- | --- |
| High | Voice interviews not audited | The most latency-sensitive and expensive feature (about $0.68 a session). Turn latency, reconnects, and cost per session have not been measured. | Before any launch or paid tier |
| High | AI provider quota | The Gemini key hit 429 at about 16 calls per minute in the roast eval. A small burst of real users could hit it. Fallbacks help but Groq also rate-limits. | Before any launch |
| Medium | No production latency baseline | `api.action_timing` exists, but the p50/p95 table in [LATENCY.md](LATENCY.md) is empty. All latency claims so far come from code reading and local runs. | Now, once there is traffic |
| Medium | Helper matching scans every profile | Each Trailmate request scores every candidate profile (about 1.3 ms per profile on dev). | Around 1,000–2,000 users |
| Medium | Polling for Trailmate status | Every open tab calls `/api/help/status` every 15 s. Each call is indexed and cheap, but the count grows with open tabs. | Thousands online at once |
| Low | Neon cold starts | The database suspends when idle; the first request after a pause can time out the pool. | Low-traffic periods |
| Low | Daily cron only | Vercel Hobby allows one run a day, so recovery (stuck evaluations, dirty snapshots) can lag by up to 24 h when on-request paths miss it. | Moving off Hobby fixes it |
| Low | 12-function limit | New route files can break the deploy. Everything must go through existing routers. | Every new API |

## Product and UX

| Severity | Issue | Detail |
| --- | --- | --- |
| Medium | Days are UTC days | Streaks, "today", and day rollover use UTC midnight (5:30 am in India) in about 20 files. No user timezone is stored. Someone practising at 1 am IST gets the wrong day. Fix needs a profile timezone column threaded through; do not hard-code IST. |
| Medium | Trailmate "no mate free" fallback is thin | When nobody accepts, the learner gets the written hints. The planned version has Maya explain the next step from her stuck summary and the learner's code. |
| Medium | No email for help invitations | Invitations are in-app only, so an offline helper never hears about them. Wait for `help.request.expired` data before adding email. |
| Low | Avatar picker opens every visit | On Profile it opens until an avatar is chosen. Decide whether to show it only on the first visit. |
| Low | Trailguide is a landing page | Booking shows "Coming soon" and an email link. |
| Low | No job-description flow | Interviews are planned from the resume and target role only. |
| Low | Old resumes lack technology recovery | Raw resume text is not kept, so resumes uploaded before the deterministic detector need re-uploading to benefit. |
| Low | Performance refresh is lazy | Demonstrated performance updates the plan only when the plan is next requested. |

## Assessment quality

| Severity | Issue | Detail |
| --- | --- | --- |
| Medium | DSA uses authored cases, no hidden tests | Solutions that pass the visible cases can still be wrong. |
| Medium | Personalised code tasks lack test contracts | Code tasks generated for a learner's interview do not come with generated tests, so correctness rests on the evaluator. |
| Low | Evals are manual | `interview:quality` and `resume-roast:eval` run on demand against live models. There is no stored baseline to compare runs against. |

## Technical debt

| Severity | Issue | Detail |
| --- | --- | --- |
| Low | Dead code | [CLEANUP.md](CLEANUP.md) lists about 2,450 lines that can safely go, plus about 1,170 more that need a decision or visual check. None of it is removed yet. |
| Low | Legacy models | `Project`, `DesignSession`, `KnowledgeDocument`, `KnowledgeChunk` (and the retrieval settings in the environment schema) belong to an earlier product. Check production rows before dropping. |
| Low | Large `globals.css` | Many rules are page-specific and some are unused (see the CSS section of CLEANUP.md). |

## Documentation

| Severity | Issue | Detail |
| --- | --- | --- |
| Low | `INTERVIEW_ENGINE.md` paths are stale | Its "Key files" list points at `src/server/interview/…` and `src/lib/interviews/…`; most of that code now lives in `src/features/interviews/`. |
| Low | README is dated | It says Groq is "for low-latency turn decisions" only. The docs in this folder are more current. |
| Low | Root-level requirement docs | `HELP_AND_NOTIFICATIONS_REQUIREMENTS.md` and `trailgrad-contextual-peer-help.md` describe plans, parts of which are built. Treat them as history, not a spec. |
