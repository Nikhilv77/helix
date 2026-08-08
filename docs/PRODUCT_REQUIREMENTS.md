# Trailgrad Frontend Roadmap Requirement

Until this requirement is complete, the product focus is only the frontend interview-prep experience. Do not add new product requirements to this file. Do not expand into backend, full-stack, data, AI/ML, or PM roadmap work until the frontend flow below is working end to end.

## Goal

When a user onboards with `targetRole = frontend`, Trailgrad must create and render a personalized frontend preparation roadmap for that specific user.

The roadmap should not be static UI. It must be based on:

- the user's target role
- the user's experience level
- the user's resume evidence
- the user's current progress
- the user's question attempts and performance signals

Maya should present the plan after onboarding, explain that she prepared the six frontend sessions, and then Home should render the user's current plan and progress.

## Frontend Plan

The base frontend roadmap has six sessions:

1. Frontend DSA
2. JavaScript and React Core
3. Build Real UI Features
4. Production UI Quality
5. Resume and Behavioral Defense
6. Final Frontend Mock

These sessions are templates. A user receives their own roadmap instance generated from these templates.

## Personalization

The content inside the plan must be curated per user.

Experience-level rules:

- Fresher or early-career users should get more fundamentals, guided explanations, warmups, and confidence-building practice.
- Mid-level users should get more production tradeoffs, architecture, debugging, and feature ownership questions.
- Senior users should get more ambiguity, system design, technical leadership, migrations, quality strategy, and cross-team tradeoffs.

Resume-based rules:

- If the resume contains React, dashboards, forms, design systems, accessibility, performance, or frontend-heavy project work, Maya should use that evidence in the plan and insights.
- If the resume has weak frontend evidence, Maya should emphasize evidence-building practice and resume-defense gaps.
- If the resume has specific projects, Maya should prepare questions that ask the user to defend state model, UX states, tradeoffs, performance, validation, and shipped outcomes.

## Dynamic Progress

The whole Home roadmap must render from the user's current progress.

Track:

- active session
- active chapter
- next question
- completed questions
- attempted questions
- question correctness or score
- difficulty progress
- estimated remaining work
- overall roadmap progress
- session-level progress
- chapter-level progress
- streak or practice continuity

When the user solves or attempts questions, the roadmap should update.

Examples:

- If the user completes Arrays & Hashing, the next priority should move to the next unfinished chapter.
- If the user repeatedly misses sliding-window questions, Maya's insights should call out that weakness.
- If the user finishes Frontend DSA, the active session should move to JavaScript and React Core.

## Maya Welcome

After onboarding a frontend user, `/?welcome=maya` should show Maya's welcome screen.

Maya should:

- welcome the user by name when available
- say she prepared the six-session frontend roadmap
- briefly explain why the sessions are ordered that way
- mention the first active session
- send the user back to Home when the welcome is dismissed or the start CTA is clicked

The welcome content should remain role-aware. Frontend users get frontend-specific copy. Other roles can keep the general welcome until their roadmap systems are built later.

## Maya Insights

Maya's insights on Home must be dynamic and user-specific.

Insights should be derived from the user's roadmap progress and attempts, then stored or cached so Home can load quickly.

Maya insights should include:

- next priority
- common trap
- strong answer signal
- streak or continuity state
- recommended next action

These values must change as the user practices.

## Database Requirement

Add persistent data models for:

- global roadmap/session/chapter/question templates
- user roadmap instances
- user session progress
- user chapter progress
- user question attempts
- user Maya insights

The frontend roadmap shown on Home must be loaded from user-specific database state, not hardcoded arrays alone.

## Required Backend Flow

1. User completes onboarding with `targetRole = frontend`.
2. Backend creates or updates the user's frontend roadmap instance.
3. Backend personalizes the roadmap using role, level, resume, and available question templates.
4. Home loads the current user roadmap from the database.
5. User practices questions.
6. Backend records attempts and progress.
7. Backend recalculates the next priority, progress, and Maya insights.
8. Home re-renders with updated roadmap state.

## Implementation Progress

Last updated: 2026-08-07.

Completed:

- Replaced the old broad product notes with this focused frontend roadmap requirement.
- Added Prisma models and enums for roadmap templates, user roadmaps, progress tracking, question attempts, and Maya insights.
- Added migration `20260807000000_user_frontend_roadmap_progress`.
- Generated Prisma client types for the new roadmap schema.
- Seeded the global frontend roadmap template as `frontend-roadmap`.
- Seeded exactly six frontend session templates:
  1. Frontend DSA
  2. JavaScript and React Core
  3. Build Real UI Features
  4. Production UI Quality
  5. Resume and Behavioral Defense
  6. Final Frontend Mock
- Seeded Frontend DSA with 12 chapter templates and 123 curated question mappings from the DSA bank.
- Added `FrontendRoadmapService.ensureFrontendRoadmap(ownerId)`.
- The service now creates or refreshes a frontend user's persisted roadmap from the seeded template.
- The service creates user session, chapter, and question progress rows without duplicating them on repeat calls.
- The initial active path is `frontend-dsa -> arrays-hashing -> contains-duplicate`.
- The service stores basic personalization from level, focus areas, resume evidence, resume file name, and resume confidence.
- The service creates five active Maya insight rows for next priority, common trap, strong answer signal, streak, and recommended action.
- Frontend onboarding now calls `ensureFrontendRoadmap(ownerId)` after `completeOnboarding` when `targetRole = frontend`.
- The onboarding API response now includes a `frontendRoadmap` summary for frontend users.
- The existing client flow still routes successful new onboarding to `/?welcome=maya`.
- Added a Home roadmap read model that loads user-specific roadmap sessions, chapters, progress totals, next CTA, question mix, and active Maya insights from the database.
- Home now requests the persisted frontend roadmap for frontend users instead of loading the static DSA plan directly.
- The Maya welcome modal, Home hero, chapter carousel, session cards, and Maya insights now receive persisted roadmap state.
- Added question attempt recording for Frontend DSA questions.
- Added `/api/roadmap/question-attempt` for `open`, `submit`, `complete`, and `skip` attempt events.
- DSA question pages now record question opens and provide complete/skip controls.
- Completing or skipping a question recalculates question, chapter, session, roadmap progress, next priority, and active Maya insight rows.
- Removed unused generated session-card image assets and kept only images referenced by the six active session cards and analytics UI.
- Removed the unlinked `/plan-preview` visual QA route.
- Maya insights now analyze recent user attempt history instead of only static next-question copy.
- Maya can detect repeated weak/skipped/low-score attempts by question pattern and reflect that in next priority, common trap, and recommended action.
- Maya's streak insight now uses completed-question attempt days and active attempt history.

Added on 2026-08-07 (guided practice and defect fixes):

- Added `/practice/[chapter]`: Maya takes a session as a six-beat briefing, then hands over to the questions.
- Briefing content is derived from the chapter's own questions — concepts, approaches, common mistakes and interview signals are ranked by how many questions share them, not written per chapter.
- Rebuilt `/dsa-questions/[slug]` on the Home design system, split so the problem is readable before attempting and every spoiler sits behind a collapsed panel.
- Maya coaches each question by voice and avatar: she names the pattern without giving the answer, speaks each hint as it unlocks, and keeps the key insight sealed until all hints are used.
- `/practice` now reads the user's persisted roadmap. Its hero previously hardcoded `completed = 0` for everyone.
- Maya's Practice introduction is generated from real progress and changes as the user works.
- Mark-done and skip now persist and survive refresh, applied optimistically with rollback on failure.
- Added loading skeletons for `/practice`, `/practice/[chapter]` and `/dsa-questions/[slug]`.
- Added keyboard navigation to the briefing (arrow keys, Escape).

Fixed on 2026-08-07:

- Concurrent question attempts deadlocked in Postgres (`40P01`) and silently dropped an attempt. Serialised per user with an advisory lock and stopped re-running `ensureFrontendRoadmap` on every write.
- Sessions 2-6 could never unlock: session status was derived only from owning the next unanswered question, so finishing Frontend DSA dead-ended the roadmap. The earliest unfinished session is now promoted when none is live.
- `nextQuestionKey` of `null` matched the first question through a `null === null` comparison, sending finished users back to `contains-duplicate`.
- `AvatarStage` created its WebGL context unguarded. Where WebGL is unavailable the throw escaped the effect and took the page down; it now falls back to the existing "Avatar unavailable" state.
- The workspace shell painted `#0b1740` over `.blueprint`'s `#22409b`, leaving a near-black base that only looked blue where the glow gradient was strong. Page edges read as black.
- Maya's status controls were positioned over the avatar on the question, session, Practice and Interviews surfaces.
- `/interviews` rendered with no sidebar. The workspace shell chose its chrome-free routes with `pathname.startsWith("/interview")`, which is also true for `/interviews`, so the interviews list was rendered bare like the live interview room. Bare routes are now matched exactly (`/interview`, `/interview/*`, `/onboarding`).
- Maya was a silent avatar on `/interviews` while introducing herself on every other surface. She now speaks there too, from real quota, completed-round and focus state.

Verified:

- `pnpm prisma:seed`
- `pnpm exec prisma validate`
- `pnpm exec prisma generate`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- Manual DB smoke test for `ensureFrontendRoadmap(ownerId)`:
  - first call created a user roadmap
  - second call refreshed the same roadmap without duplicates
  - created 6 session progress rows
  - created 12 chapter progress rows
  - created 123 question progress rows
  - created 5 active Maya insight rows
- Manual DB smoke test for the Home roadmap read model:
  - loaded 6 sessions
  - loaded 12 chapters
  - loaded 123 questions
  - loaded 5 active Maya insights
  - returned next CTA `/dsa-questions/contains-duplicate`
- Manual DB smoke test for question attempt tracking:
  - opening `contains-duplicate` changed attempted questions from 0 to 1
  - completing `contains-duplicate` changed completed questions from 0 to 1
  - overall progress changed from 0% to 0.8%
  - first chapter progress changed to 1 of 10 complete
  - next question changed from `contains-duplicate` to `two-sum`
  - persisted 2 attempt rows for the question
- Manual DB smoke test for dynamic Maya insights:
  - skipping `contains-duplicate` and `two-sum` moved the next question to `best-time-to-buy-and-sell-stock`
  - Maya detected 2 weak or skipped Arrays & Hashing attempts
  - next priority, common trap, and recommended action changed from static next-question copy to weakness-aware guidance
- Step 8 frontend flow QA smoke test:
  - simulated frontend onboarding through `ProfileService.completeOnboarding`
  - created the user-specific frontend roadmap from the seeded template
  - Home read 6 sessions, 12 chapters, 123 questions, and 5 active Maya insights from persisted state
  - Home next CTA started at `/dsa-questions/contains-duplicate`
  - opening `contains-duplicate` changed attempted questions to 1 without advancing the next question
  - completing `contains-duplicate` changed completed questions to 1, changed overall progress to 0.8%, and advanced the next question to `two-sum`
  - a new Prisma/service read for the same owner preserved completed questions, attempted questions, and next question state, covering refresh/logout/login-style persistence at the data layer
- Concurrency test on question attempts:
  - 7 simultaneous writes for one user all succeeded, 8 of 8 completions persisted
  - previously one write was rejected with `deadlock detected` and its attempt was lost
- Session advancement test at 100% completion:
  - session 1 COMPLETED, session 2 ACTIVE, current session `javascript-react-core`
  - next CTA `/practice` instead of looping back to `contains-duplicate`
- Rendered verification in headless Chrome at 1920px and 2600px for Home shell, `/interviews`, `/practice`, `/practice/[chapter]` and `/dsa-questions/[slug]`
- Page survives with WebGL disabled (`--disable-webgl`) instead of blanking
- `pnpm test` — 72 tests across 13 suites
- Local HTTP smoke:
  - `GET /` on `localhost:3001` returned `200`
  - unauthenticated curl response correctly returned the signed-out/marketing path with Clerk signed-out headers
- Production integration:
  - `pnpm build` completed successfully and compiled all dynamic Home, onboarding, practice, DSA, and roadmap API routes

Remaining:

- Sessions 2-6 have no seeded questions. The roadmap now advances into JavaScript and React Core correctly, but there is nothing to practise there yet. Needs curriculum, not code.
- Experience level is stored but never applied. `levelStrategy` writes a string into the roadmap's personalization JSON and nothing reads it, so a fresher and a senior receive the identical 123 questions in the identical order. This does not yet meet the experience-level rules above.
- Resume evidence is captured and stored but likewise does not change which questions are selected.
- A single question attempt costs roughly 3.5 seconds because the write recalculates the whole roadmap against a remote database. The UI hides this optimistically; the write itself has not been made faster.

## Step-by-Step Build Plan

Step 1: Add the database foundation.

- Add global roadmap template tables.
- Add user roadmap instance tables.
- Add session, chapter, and question progress tables.
- Add question attempt tracking.
- Add persisted Maya insight records.
- Generate Prisma client types.

Status: Complete on 2026-08-07.

Step 2: Seed the frontend roadmap templates.

- Persist the six frontend sessions as `RoadmapTemplate` and `RoadmapSessionTemplate` records.
- Persist Frontend DSA chapters as `RoadmapChapterTemplate` records.
- Map curated DSA questions into `RoadmapQuestionTemplate` records.
- Keep seeded templates idempotent.

Status: Complete on 2026-08-07.

Step 3: Create the user roadmap service.

- Build `ensureFrontendRoadmap(ownerId)`.
- Personalize from role, level, resume, and template content.
- Create user session, chapter, and question progress rows.
- Calculate initial progress and first next question.

Status: Complete on 2026-08-07.

Step 4: Wire onboarding to roadmap creation.

- After frontend onboarding completes, create or refresh the user's frontend roadmap.
- Keep the welcome flow on Home.

Status: Complete on 2026-08-07.

Step 5: Load Home from user roadmap state.

- Replace static Home plan data with user roadmap data.
- Render progress, active chapter, active session, and next CTA from DB state.

Status: Complete on 2026-08-07.

Step 6: Track question attempts.

- Add attempt recording when a user opens, submits, solves, skips, or completes a question.
- Update question, chapter, session, and roadmap progress.

Status: Complete on 2026-08-07.

Step 7: Recalculate Maya insights.

- Derive next priority, common trap, strong answer signal, streak, and recommended action from progress.
- Persist active insights for fast Home rendering.

Status: Complete on 2026-08-07.

Step 8: Finish frontend flow QA.

- Verify progress survives refresh, logout, and login.
- Verify Home updates after attempts.
- Verify Maya welcome, Home cards, carousel, and insights all read from user state.

Status: Complete on 2026-08-07. Automated service and build QA passed, a real signed-in
onboarding created a persisted roadmap (6 sessions, 12 chapters, 123 questions, 5 insights),
and every workspace surface was rendered and checked in headless Chrome.

## Required UI Flow

Home should render:

- Maya hero/welcome state
- active frontend session
- all six frontend session cards
- current chapter or pattern position
- progress numbers from database state
- Maya insights from database state
- correct next CTA based on the user's current progress

No Home progress value, insight, active chapter, next question, or session state should be fake once this requirement is complete.

## Done Means

This requirement is complete when:

- a frontend user gets a user-specific roadmap after onboarding
- the roadmap is persisted in the database
- Home renders the roadmap from database state
- Maya welcome explains the user's frontend plan
- Maya insights are user-specific and change with practice
- question attempts update progress
- completing questions changes the active chapter/session
- progress survives refresh, logout, and login
- the six frontend sessions remain the main Home experience

## Out Of Scope Until Done

- Backend roadmap specialization
- Full-stack roadmap specialization
- Data roadmap specialization
- AI/ML roadmap specialization
- PM roadmap specialization
- New unrelated dashboards
- New unrelated interview modes
- Non-frontend content expansion beyond what is needed to keep the current app working
