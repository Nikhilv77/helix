# Application Cleanup and Folder Structure Plan

**Status:** Proposed  
**Last reviewed:** 2026-09-09  
**Scope:** Trailgrad Next.js application, supporting TypeScript code, assets, scripts, and the Python
voice worker  
**Primary rule:** Delete code only after proving that no current route, runtime entry point,
persisted record, scheduled job, or supported saved link still needs it.

## 1. Goal

Clean the application one product area at a time, remove code that is genuinely obsolete, and move
the remaining code toward a predictable feature-first structure.

The cleanup should leave the repository with:

- thin Next.js route files;
- one obvious home for each product capability;
- explicit boundaries between browser, server, domain, content, and infrastructure code;
- shared code only when it has multiple real consumers;
- no generated caches or local environment artifacts committed to Git;
- compatibility code with an owner and a planned removal condition; and
- small, independently reviewable pull requests that preserve behavior.

This is a structural cleanup, not a product redesign. URLs, API contracts, database history,
analytics identities, authentication gates, and user-visible behavior remain stable unless a
separate change explicitly approves a migration.

## 2. What “unused” means

A file is not safe to remove merely because no static import points to it. In this repository,
Next.js routes, cron handlers, Prisma migrations, dynamic imports, CLI scripts, webhook-style entry
points, persisted snapshots, and old saved URLs can all be live without an ordinary TypeScript
import.

Classify every cleanup candidate before changing it:

| Class         | Meaning                                                               | Required action                                                             |
| ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Active        | Used by a supported product flow                                      | Keep and place in the owning feature                                        |
| Shared        | Used by two or more independent features                              | Keep in a narrowly named shared package                                     |
| Duplicate     | Two implementations serve the same current responsibility             | Select a canonical implementation, migrate consumers, then delete the other |
| Compatibility | Needed only for old URLs, clients, or persisted records               | Keep behind a documented boundary until its exit condition is met           |
| Generated     | Re-created by build, test, code generation, or local tooling          | Remove from Git and ignore it                                               |
| Dead          | No supported runtime, data, test, script, or documentation dependency | Delete with evidence in the same PR                                         |
| Unknown       | Ownership or reachability has not been proved                         | Do not delete; add it to the investigation ledger                           |

## 3. Current repository observations

The application is already partly organized by capability, but each capability is split across
several top-level trees:

```text
src/app/**                         route entry points
src/components/workspace/**        product UI
src/lib/**                         browser-safe domain contracts and helpers
src/server/**                      services and persistence
src/data/**                        static question/content data
```

That split makes one feature difficult to understand or remove as a unit. Practice is the clearest
example: Core Technical, Applied Engineering, and Architecture & Design each span `app`,
`components`, `lib`, and `server`, while also depending on the shared Story Practice lifecycle.

Some similar names are intentional and must not be merged based on naming alone:

- `/interviews` is the collection/history experience; `/interview/*` starts or hosts an active
  interview.
- Trailguide is the mentor product; Trailmate is peer help.
- `architecture-design` is the Practice identity, while `architecture-system-design` remains a
  persisted interview-plan identity.
- DSA Practice and DSA Interview share editor capabilities but have different lifecycles.

### 3.1 Initial cleanup ledger

This is a starting inventory, not authorization to delete every item.

| Candidate                                                                 | Current evidence                                                                                            | Classification                    | Next decision                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tsconfig.seed.tsbuildinfo`, `tsconfig.verify.tsbuildinfo`                | Tracked compiler caches; TypeScript can recreate them                                                       | Generated                         | Remove from Git and ignore `*.tsbuildinfo`                                                            |
| `src/components/workspace/story-practice/story-practice-artifact.tsx`     | Re-exports the implementation from `workspace/shared`; no repository import currently targets the re-export | Duplicate/compatibility candidate | Make `story-practice` the canonical home, update the current direct imports, then remove the old path |
| `src/app/mentors/page.tsx`                                                | Explicit redirect from an older URL to `/trailguide`                                                        | Compatibility                     | Keep until old-route traffic is below the agreed threshold and saved-link support expires             |
| `src/app/interview/text/page.tsx`                                         | Explicit redirect to the voice room or interview setup                                                      | Compatibility                     | Measure traffic before assigning a removal date                                                       |
| `src/app/interview/dsa/[slug]/page.tsx`                                   | Explicit redirect for old per-question interview links                                                      | Compatibility                     | Keep until traffic and external-link checks prove it is safe to remove                                |
| DSA legacy snapshot readers and onboarding legacy-stage conversion        | Tests and comments show that they adapt old persisted records                                               | Compatibility                     | Remove only after a production data audit/backfill and a full retention window                        |
| `output/pdf/trailgrad-report-sample.pdf`                                  | Tracked binary with no source-code reference found in the initial scan                                      | Unknown                           | Decide whether it is a maintained product fixture, documentation artifact, or generated output        |
| Empty local directories under `src/app`, `src/components`, and `src/data` | Empty directories are not represented in Git                                                                | Local hygiene                     | Remove locally when convenient; they have no repository effect                                        |

Do not delete anything under `prisma/migrations` as part of ordinary dead-code cleanup. Applied
migrations are historical database artifacts even when the current schema no longer exposes the
original feature.

## 4. Target structure

Use a feature-first layout. Keep the Next.js App Router in `src/app`, but make its files adapters
that authenticate, parse route input, call a feature entry point, and return a response or view.

```text
src/
  app/                              # Next.js pages, layouts, route handlers, metadata

  features/
    onboarding/
      domain/                       # Pure types, invariants, state transitions
      application/                  # Use cases and orchestration
      infrastructure/               # Prisma/provider implementations
      ui/                            # Components and client hooks
      index.ts                      # Small public feature API

    interviews/
      domain/
      application/
      infrastructure/
      ui/
      index.ts

    practice/
      shared/
        domain/                     # Shared lifecycle contracts only
        application/                # Reusable Story Practice orchestration
        ui/                          # Shared Story Practice presentation
      dsa/
        domain/
        application/
        infrastructure/
        content/
        ui/
      core-technical/
        domain/
        application/
        infrastructure/
        content/
        ui/
      applied-engineering/
        domain/
        application/
        infrastructure/
        content/
        ui/
      architecture-design/
        domain/
        application/
        infrastructure/
        content/
        ui/

    peer-help/
    profile/
    reports/
    roadmap/
    notifications/
    search/
    resume-roast/
    marketing/

  shared/
    ui/                              # Generic primitives: button, card, loading/error states
    lib/                             # Generic formatting and other side-effect-free helpers
    server/                          # Auth, HTTP errors, logging, rate limiting

  infrastructure/
    ai/                              # AI provider adapters and configuration
    database/                        # Prisma client and database bootstrap
    realtime/                        # LiveKit integration boundaries
    config/

  content/                           # Truly cross-feature authored content, if any
```

Not every feature needs every subdirectory. Create a folder only when it has content. A small
feature can start with `domain.ts`, `service.ts`, and `ui.tsx` and split later.

### 4.1 Dependency direction

The intended dependency flow is:

```text
src/app
  -> feature UI / feature application
       -> feature domain
       -> feature infrastructure
            -> shared server / global infrastructure

feature domain -> no React, Next.js, Prisma, provider SDK, or environment access
shared code    -> never imports a product feature
```

Additional rules:

1. Server-only modules must not be re-exported from browser-safe barrels.
2. A feature may use `practice/shared`; it must not import another Practice track's concrete
   implementation.
3. UI components receive view models or feature contracts, not Prisma rows.
4. Route handlers own HTTP translation; services should not construct `NextResponse`.
5. Infrastructure implements a port owned by the feature/domain, not the reverse.
6. Avoid catch-all barrel files. Each feature `index.ts` should expose only its deliberate public
   surface.
7. If code has one consumer, keep it inside that feature. Promote it to `shared` only after a
   second independent consumer exists and the abstraction is stable.

## 5. Canonical ownership map

Use this map while relocating code. It prevents a cleanup PR from inventing a second shared area.

| Existing area                                                              | Target owner                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/components/ui`                                                        | `src/shared/ui`                                          |
| `src/components/workspace/<feature>`                                       | `src/features/<feature>/ui`                              |
| `src/lib/<feature>`                                                        | `src/features/<feature>/domain` or `application`         |
| `src/server/<feature>`                                                     | `src/features/<feature>/application` or `infrastructure` |
| `src/server/common`, `auth`, `http`, `rate-limit`                          | `src/shared/server`                                      |
| `src/server/ai`, `database`, `config`                                      | `src/infrastructure`                                     |
| `src/data/dsa` and reviewed Practice catalogues                            | Owning feature's `content` folder                        |
| `src/components/workspace/story-practice` and Story Practice orchestration | `src/features/practice/shared`                           |
| `src/app/**`                                                               | Remains in place as thin framework adapters              |

Do not perform this as a single repository-wide move. The target structure is reached through
vertical, feature-sized changes.

## 6. Cleanup sequence

### Phase 0 — Freeze a trustworthy baseline

Before deleting or moving application code:

1. Record the current production routes, API routes, cron routes, and scripts.
2. Run the complete verification suite and record any pre-existing failures.
3. Capture a small authenticated smoke-test checklist for onboarding, Practice, interviews,
   reports, profile, Trailguide, and Trailmate.
4. Export production counts for legacy record shapes before touching compatibility readers.
5. Confirm the working tree is clean or explicitly list unrelated user changes that must be
   preserved.

Baseline commands:

```bash
git status --short
pnpm lint
pnpm test
pnpm build
(cd agent && .venv/bin/python -m compileall .)
```

### Phase 1 — Repository hygiene

Start with changes that do not alter application behavior:

- untrack generated TypeScript build caches and ignore `*.tsbuildinfo`;
- decide whether the sample report PDF is a maintained fixture or generated output;
- remove abandoned empty local directories;
- remove stale commented-out implementations and debug logging after verifying no diagnostic
  contract depends on them;
- inventory dependencies, scripts, public assets, and environment variables, but remove each only
  with a usage check; and
- do not mix broad formatting with file moves or deletions.

### Phase 2 — Establish boundaries without changing behavior

Create `src/features`, `src/shared`, and `src/infrastructure` incrementally. Move one low-coupling
feature first to validate aliases, tests, mocking, server/client boundaries, and build behavior.

The selected first slice is Marketing. It is narrower than Practice, Interview, and peer help, and
its public routes give the new boundary an immediate production build check. A successful pilot
should demonstrate:

- routes remaining thin;
- tests moving with the feature;
- no import from the old location;
- no accidental client import of a server module; and
- no compatibility re-export left behind unless it has a named removal issue.

### Phase 3 — Consolidate shared Story Practice

Move Story Practice before moving all three story-driven tracks. It already represents the shared
lifecycle used by Core Technical, Applied Engineering, and Architecture & Design.

The shared layer may own:

- lifecycle/orchestrator contracts;
- route-kit helpers;
- reusable history/continuation mechanics;
- shared assessment and preparation views; and
- the canonical artifact renderer.

Each track must continue to own:

- its vocabulary and domain contracts;
- content catalogue and release gates;
- ranking dimensions and compatibility rules;
- evaluation logic;
- persistence adapter; and
- the small UI adapter that maps its domain into the shared view model.

Do not solve duplication by casting one track's records to another track's types.

### Phase 4 — Move product areas one at a time

Suggested order, from lower to higher coupling:

1. Search and resume roast.
2. Profile and account management.
3. Reports and progress.
4. Notifications.
5. Onboarding and preparation onboarding.
6. Trailguide.
7. Trailmate/peer help.
8. Interviews and realtime voice integration.
9. DSA Practice.
10. Story-driven Practice tracks.

For every product area, complete the entire slice—domain, application, infrastructure, UI, tests,
and routes—before starting another. Temporary import aliases are acceptable inside one PR; long-
lived mirror trees are not.

### Phase 5 — Retire compatibility code

Compatibility cleanup is a separate operational task, not a side effect of reorganizing folders.
For each legacy route or data adapter:

1. Identify the historical producer and current consumer.
2. Add or inspect telemetry for requests/records that still use it.
3. Backfill persisted data where appropriate.
4. Wait through the agreed link/data retention window.
5. Remove the reader or redirect and its focused tests together.
6. Verify production after release.

Suggested default URL rule: retain old redirects until they have had zero legitimate requests for
at least 30 days and no public page, email, documentation, or client release still emits the old
URL. Bots and synthetic probes should be filtered from this decision.

## 7. Proving a deletion is safe

Every deletion PR should include a short evidence block in its description:

```text
Candidate:
Owner/product area:
Why it appears obsolete:
Static references checked:
Framework/runtime entry points checked:
Persisted-data dependency checked:
Traffic or job usage checked:
Replacement, if any:
Tests removed or updated:
Rollback plan:
```

Use repository searches as evidence, not as the only proof:

```bash
# File names and import paths
rg -n "OldExport|old/path|old-route" src test docs scripts

# Runtime string references, redirects, fetch calls, and links
rg -n 'fetch\(|href=|redirect\(|dynamic\(|import\(' src

# Explicit compatibility markers
rg -n 'legacy|deprecated|compatibility|older clients|saved links' src docs

# Confirm what is actually tracked
git ls-files | sort
```

An unused-export tool can supplement this review, but it must be configured with all Next.js
pages/route handlers, cron endpoints, build scripts, Prisma configuration, Vitest setup, and the
Python worker as entry points. Treat its output as candidates, not an automatic delete list.

## 8. Pull request rules

Keep cleanup changes reversible and easy to review:

- one feature or one cleanup class per PR;
- separate pure moves from behavior changes whenever possible;
- use `git mv` semantics so history remains reviewable;
- preserve existing public exports only when an active migration needs them;
- attach an issue and removal condition to every new compatibility shim;
- update tests and documentation in the same PR;
- do not rename persisted enum values, database columns, analytics keys, or URL slugs just to match
  a new folder name; and
- never combine a database backfill, compatibility removal, and large folder move in one release.

### Per-PR verification

Run checks proportional to the touched area, followed by the full gates before merging:

```bash
pnpm lint
pnpm test
pnpm build
```

Also smoke-test the affected authenticated route and at least one adjacent flow. For changes to the
Python agent, run its tests or compilation separately. For changes to migrations or persisted
compatibility, test against a database containing representative old and current records.

## 9. Cleanup tracker

Maintain this table as work proceeds. A candidate is not “Done” until both code and operational
exit conditions are satisfied.

| Area           | Candidate                               | Class         | Evidence owner | Status      | Exit condition                                                        |
| -------------- | --------------------------------------- | ------------- | -------------- | ----------- | --------------------------------------------------------------------- |
| Repository     | Tracked `*.tsbuildinfo`                 | Generated     | Engineering    | Ready       | Removed from Git; wildcard ignore added; build passes                 |
| Marketing      | UI/content split across top-level trees | Active move   | Engineering    | Implemented | Old Marketing import paths absent; lint, tests, and build pass        |
| Story Practice | Artifact renderer re-export/path split  | Duplicate     | Practice       | Investigate | One canonical implementation and no imports from retired path         |
| Routes         | `/mentors` redirect                     | Compatibility | Trailguide     | Measure     | Traffic/link retention rule satisfied                                 |
| Routes         | `/interview/text` redirect              | Compatibility | Interviews     | Measure     | Traffic/link retention rule satisfied                                 |
| Routes         | `/interview/dsa/[slug]` redirect        | Compatibility | Interviews     | Measure     | Traffic/link retention rule satisfied                                 |
| DSA            | Legacy practice block/snapshot adapters | Compatibility | Practice       | Data audit  | Old records backfilled or outside supported retention window          |
| Onboarding     | Legacy stage conversion                 | Compatibility | Onboarding     | Data audit  | No stored legacy stages remain                                        |
| Reports        | Sample PDF in `output/`                 | Unknown       | Reports        | Decide      | Classified as maintained fixture or moved to ignored generated output |

### Marketing pilot record

The first feature-first migration established these ownership decisions:

- Marketing UI lives in `src/features/marketing/ui`.
- Blog and legal authored content live in `src/features/marketing/content`.
- Marketing pages, metadata entry points, and the sitemap remain in `src/app` as Next.js adapters.
- The reveal/motion utilities live in `src/shared/ui/motion` because both Marketing and Trailguide
  consume them.
- The unreferenced `Counter` and `TypeOut` animation exports were removed instead of carrying dead
  helpers into the shared layer.
- The `/` route still contains the authenticated Dashboard branch. That branch belongs to the
  future Dashboard migration and should not be pulled into Marketing merely because the two
  surfaces currently share a route.

## 10. Definition of done

The application cleanup is complete when:

- each supported product capability has one documented owner and one obvious feature home;
- App Router pages and handlers contain framework adaptation rather than business logic;
- no feature reaches into another feature's private directories;
- shared folders contain only demonstrated cross-feature abstractions;
- generated artifacts are not tracked;
- the cleanup tracker has no `Unknown` items;
- every remaining compatibility path states why it exists and when it can be removed;
- lint, unit/integration tests, build, and the Python worker checks pass;
- authenticated smoke tests cover all primary product areas; and
- production telemetry shows no regression after each migration batch.

The desired end state is not the smallest possible file count. It is a repository where a future
engineer can find, change, test, or remove a product area without searching four unrelated trees or
guessing whether an “old” path still protects real users.
