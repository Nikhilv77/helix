# Trailgrad documentation

Last updated: September 28, 2026

Trailgrad is an interview-preparation app for software engineers. A learner uploads a resume,
picks an AI teacher, practises in guided tracks, takes voice and text mock interviews, and gets
reports on how they did. When they get stuck on a question, a peer who has already solved it
can help them.

These documents describe the product as it is built today, how it works, what is broken or
thin, and what should come next. Read them in order the first time.

| # | Document | What it covers |
| --- | --- | --- |
| 1 | [Product overview](01_PRODUCT_OVERVIEW.md) | What Trailgrad is, who it is for, the learner's journey, every page |
| 2 | [Architecture](02_ARCHITECTURE.md) | Stack, folder layout, request flow, read models, concurrency, hosting limits |
| 3 | [Data model](03_DATA_MODEL.md) | The main Prisma models grouped by area, and the rules they follow |
| 4 | [AI, voice and scoring](04_AI_VOICE_AND_SCORING.md) | Which models do what, fallbacks, voice pipeline, how scores are made |
| 5 | [Features](05_FEATURES.md) | Each feature area in detail: onboarding, practice, interviews, reports, Resume Roast, Trailmate, account |
| 6 | [Development](06_DEVELOPMENT.md) | Local setup, environment, scripts, testing, conventions |
| 7 | [Operations](07_OPERATIONS.md) | Deploying, migrations, cron, logs to watch, incident notes |
| 8 | [Known issues](08_KNOWN_ISSUES.md) | Bugs, limits, and technical debt, with severity |
| 9 | [Future scope](09_FUTURE_SCOPE.md) | Product and engineering roadmap |
| 10 | [Design system](10_DESIGN_SYSTEM.md) | The visual language, where each pattern lives, and the fragile pieces not to undo |

## Working documents

These track ongoing work and change often:

- [REMAINING_WORK.md](REMAINING_WORK.md): the short-term to-do list.
- [CHANGELOG.md](CHANGELOG.md): what changed in each release, with deploy notes (migrations,
  files to commit, spot checks).
- [LATENCY.md](LATENCY.md): how to read timings, the production baseline, open latency items,
  and lessons.
- [INTERVIEW_AUDIT.md](INTERVIEW_AUDIT.md): end-to-end audit of the interview rounds, with
  findings by severity and a suggested order.
- [STATIC_VOICE_LINES.md](STATIC_VOICE_LINES.md): the pre-recorded teacher lines and how to
  regenerate them.
- [CLEANUP.md](CLEANUP.md): the dead-code audit and removal plan. Delete it once the cleanup is
  done.

Also in the repository root:

- [INTERVIEW_ENGINE.md](../INTERVIEW_ENGINE.md): the personalised interview planner in depth.
  Its "Key files" paths predate the move to `src/features/`; see
  [Known issues](08_KNOWN_ISSUES.md#documentation).
- [HELP_AND_NOTIFICATIONS_REQUIREMENTS.md](../HELP_AND_NOTIFICATIONS_REQUIREMENTS.md) and
  [trailgrad-contextual-peer-help.md](../trailgrad-contextual-peer-help.md): the original product
  requirements for Trailmate and notifications.

## Keeping these current

When a change alters how something works, update the matching document in the same change.

- Short-lived tasks go in `REMAINING_WORK.md`, not in the numbered docs.
- Every release gets a `CHANGELOG.md` entry.
- A fixed known issue is removed from `08_KNOWN_ISSUES.md` and noted in that release's changelog
  entry.
