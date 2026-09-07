# Step 14.2–14.7 browser evidence

Captured on 2026-09-07 from the real Practice and Core Technical components using an explicit
development-only fixture route. The route was removed after capture and cannot ship or bypass the
production publication gate.

| Artifact                               | Viewport  | Check                                                                                                                              |
| -------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `14.2-entry-desktop.png`               | 1440×1200 | Existing DSA card and eligible/resumable Core Technical card share the unchanged Practice renderer                                 |
| `14.2-confirm-mobile.png`              | 501×900   | Confirmation facts, fields, exclusions, and launch control remain single-column and usable                                         |
| `14.3-overview-desktop.png`            | 1440×1400 | Current story hero, saved focus, progress, question path, sticky coach, history, and assessment lock                               |
| `14.3-overview-mobile.png`             | 501×1800  | Current story shell collapses without horizontal overflow and retains readable controls and status distinctions                    |
| `14.3-history-desktop.png`             | 1440×1400 | Historical selection is visibly completed and has no current-story Continue control                                                |
| `14.4-question-noncode-desktop.png`    | 1440×1200 | Public artifact, durable response, ordered hint, mutation controls, navigation, and sticky story context                           |
| `14.4-question-noncode-mobile.png`     | 501×900   | Non-code workspace, controls, navigation, and coach collapse without horizontal overflow                                           |
| `14.4-question-code-mobile.png`        | 501×900   | DSA editor treatment, pinned Node.js label, exact saved code, public test detail, and hidden aggregate                             |
| `14.5-assessment-mobile.png`           | 501×900   | All five frozen prompt kinds, labelled textareas, counters, lifecycle status, and submit control                                   |
| `14.5-finalizing-mobile.png`           | 501×900   | Server-checkpointed responses are retained read-only with a retryable finalization control                                         |
| `14.5-report-desktop.png`              | 1440×1200 | Five scores, teacher summary, strengths, improvements, prompt feedback, mastery evidence, transcript, recommendation, and Continue |
| `14.6-offline-finalization-mobile.png` | 501×900   | Unknown offline outcome freezes all five responses/request ID, announces interruption, and retains exact Retry                     |
| `14.7-auth-gate-desktop.png`           | 1440×1200 | The real protected Core Technical route redirects an unauthenticated browser to the public entry page without an error overlay     |
| `14.7-auth-gate-mobile.png`            | 390×844   | The same real authentication boundary remains usable without horizontal overflow on a narrow viewport                              |

The temporary fixture pages returned HTTP 200 with meaningful rendered content and no Next.js
error overlay. They were removed after capture and are absent from the production-build route
manifest. The local Clerk development keys emitted their existing session-key/UI-loader warning;
the fixtures did not depend on Clerk, bypass production authorization, or mutate candidate data.

`agent-browser` checks at 1440px and 501px found no positive horizontal overflow and no interactive
target below 44×44px after hardening. Axe reported zero WCAG A/AA violations on the non-code,
code, assessment, and report surfaces. Monaco left only indeterminate overlap/one-character colour
nodes, not confirmed violations. Core Technical disables only the editor's load-time autofocus;
the shared option defaults on, so existing DSA behavior is unchanged. Tab-order checks covered
entry fields/disclosure/launch, response→Submit→Learn, reset→run→editor, the five assessment
responses→Submit, history links, report transcript, and Continue. The editor remained reachable
and its existing Cmd/Ctrl+Enter action invoked the runner.

An offline finalization was reloaded in the same browser session: all five draft values returned,
the retry used the same UUID, and the error remained bounded. A failed Continue left the 74/100
report mounted and changed only its action to Retry. Server-rendered HTML and hydrated DOM for
question, code, assessment, finalizing, and report fixtures contained none of
`privateEvaluation`, `expectedAnswer`, `correctChoiceIndex`, `responseFingerprint`,
`baselineEvidence`, private diagnostics, common mistakes, or model input. The public
`hiddenTests` value is deliberately only the allowed passed/total aggregate; no hidden assertion
or source was present.

Automated coverage complements the screenshots:

- `src/server/core-technical/ui-integration.spec.ts` covers fail-closed eligibility, direct mutation
  refusal, exhaustive lifecycle mapping, resumable entry, and ordinal history navigation.
- `src/components/workspace/core-technical/core-technical-preparation.test.tsx` covers duplicate
  clicks and stable preparation request IDs across failure/retry.
- `src/components/workspace/core-technical/core-technical-overview.test.tsx` covers public focus,
  story selection, terminal distinctions, progress, current continuation, and historical read-only
  navigation.
- `src/components/workspace/core-technical/core-technical-question-workspace.test.tsx` renders and
  completes all eight formats through the Step 12 paths, then covers draft/hint/attempt/Learn,
  accepted exact-code binding, feedback, evaluator failure, and stable retry identity.
- `src/components/workspace/core-technical/core-technical-assessment.test.tsx` covers lock/readiness,
  all five prompt kinds, accessible validation/focus, start/finalize replay behavior, restored
  `FINALIZING`, every report section, safe transcript, historical read-only mode, and one stable
  Continue failure/success handoff.
- The consolidated practice and assessment lifecycle specs inspect public projections, forbid
  private evaluator/test material, preserve deterministic code evidence and zero-credit Learn,
  and prove atomic/idempotent report and continuation behavior. Candidate-owned checkpointed
  responses are allowlisted for refresh recovery while their private response fingerprint is not.
- Core Technical page tests cover eligible/unavailable entry and owner-safe current/historical
  block and question resolution, including the common not-found boundary for missing/foreign IDs.

Final automated gates for Parts 14.4–14.6: 9 focused files / 38 tests passed; the full suite passed
with 170 files and 1,097 tests (2 files / 8 tests skipped); TypeScript, ESLint, Prisma validation,
and the Next.js production build passed. Step 14.7 remains separate because it requires the
release-equivalent authenticated runner journey.

## Step 14.7 release-gate audit

The 2026-09-07 automated release pass completed 23 focused files / 118 Core Technical tests and
172 files / 1,108 tests repository-wide (2 files / 8 tests skipped). TypeScript, ESLint, Prisma
validation, all 70 database migrations, the production build, and whitespace validation passed.
Focused runner/gold evaluation passed 3 files / 13 tests. Added release-gate coverage proves the
shared authentication/onboarding boundary and explicit no-duplicate replay behavior for code runs,
completed reports, and continuation.

The real protected route was opened at 1440×1200 and 390×844. Both requests redirected to `/`, had
meaningful content, no Next.js overlay, no page errors, and no positive horizontal overflow. Axe
4.12.1 reported zero WCAG A/AA violations; its only incomplete result was indeterminate contrast
caused by the marketing page's animated pseudo-element backgrounds. Console output contained only
development tooling messages and Clerk's expected development-key warning. All eleven anonymous
Core Technical API probes returned `401 AUTH_REQUIRED`, and their bodies contained none of the
audited private-field terms.

A real `Follow the operation` guided preparation first failed when Gemini was unavailable and the
Groq fallback returned HTTP 429. The same durable request then used the exact human-approved frozen
artifact, reran both executable Node.js 22 sandbox audits, and moved from `FAILED` to `SUCCEEDED`
without creating a duplicate. It published block `71d63eab-5388-4cc5-83d9-01fa2e660687` with eight
questions and no retained failure diagnostic. The second approved standard artifact also resolved
with eight questions and two executable audits without a provider call. A public projection scan
of the resulting block found none of the audited private-field terms.

Project owner `nikhilverma` approved both gold cases and generated artifacts on 2026-09-07. The
replay-safe publication command created both immutable version-1 story records in the configured
database and returned the same IDs on replay. The real eligibility service now reports `AVAILABLE`,
requiring 2 stories and finding 2. The local process is not a Vercel/OIDC runtime and has no
authenticated release browser session, so the first-story → assessment → report → second-story
release journey still requires deployment verification. Part 14.7 is therefore **IN PROGRESS**.
