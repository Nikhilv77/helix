# Core Technical UI contract and DSA parity baseline

This is the source-anchored baseline for Step 14.1. The later screenshot and browser audit in Step
14.6 compares rendered desktop and mobile pages; this inventory prevents Step 14 implementation
from inventing a second visual system or client-owned lifecycle.

## DSA source of truth

| Surface              | Source                                                       | Required treatment                                                                                                 |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Practice card        | `src/features/practice/shared/ui/practice-sessions-view.tsx` | `max-w-[92rem]` page, `rounded-[2rem]` session card, shared icon tile, pills, action alignment, focus ring         |
| Practice page        | `src/app/practice/dsa/page.tsx`                              | `max-w-[86rem]`, `px-4/sm:px-7/lg:px-8`, back control, dynamic server read                                         |
| Story/path shell     | `src/features/practice/dsa/ui/dsa-topics.tsx`                | main + `17rem` sticky coach grid, `gap-7`, `xl:gap-x-14`, `#141619` hero, `#17181b` path, `#111214` rows           |
| Progress and history | `src/features/practice/dsa/ui/dsa-topics.tsx`                | thin accent progress, URL-selected block, previous/next controls, explicit current/completed label                 |
| Question page        | `src/app/dsa-questions/[slug]/page.tsx`                      | responsive question/workspace composition, back navigation, server-owned question selection                        |
| Question workspace   | `src/features/practice/dsa/ui/dsa-question-workspace.tsx`    | `#101214` bordered workspace, `#141619` toolbars, 9–11px radii, 36–44px controls, pending/error/test-result states |
| Code editor          | `src/features/interviews/ui/dsa/dsa-code-editor.tsx`         | shared Monaco theme, keyboard Run action, visible selection/cursor, responsive automatic layout, read-only mode    |
| Assessment preview   | `src/features/practice/dsa/ui/block-assessment-preview.tsx`  | `rounded-[1.15rem]`, subtle white border and inset highlight, locked/ready/completed semantics                     |
| Loading              | `src/features/practice/shared/ui/practice-skeleton.tsx`      | page-shaped DSA skeleton at both breakpoints                                                                       |

Core Technical reuses these existing values and states directly. New Tailwind values or shared
primitive extraction require a DSA regression check. DSA files must not be changed merely to make
Core Technical easier to style.

## Server-owned view-state map

| Server state                                         | View                                           | Allowed primary action                         |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| No block + unsupported role/level                    | Unavailable                                    | Return to Practice                             |
| No block + runner unavailable                        | Unavailable                                    | Retry by refresh after infrastructure recovery |
| No block + fewer than two published reviewed stories | Hidden Practice card; direct route unavailable | None                                           |
| No block + eligible stack/content/runner             | Centered first-entry language modal            | Select language and prepare one atomic block   |
| Preparation request pending                          | Preparing                                      | None; duplicate submit disabled                |
| Preparation failure                                  | Retry                                          | Replay the same request ID                     |
| `PRACTISING`                                         | Story overview                                 | Resume first `ACTIVE` question                 |
| Question `ACTIVE`                                    | Question workspace                             | Draft, hint, run/attempt, or confirmed Learn   |
| Question `COMPLETED`                                 | Read-only completed question                   | Navigate                                       |
| Question `LEARNED`                                   | Read-only learned question                     | Navigate; zero mastery is explicit             |
| `ASSESSMENT_READY` / assessment `READY`              | Ready assessment shell                         | Start/resume assessment                        |
| `ASSESSMENT_IN_PROGRESS`                             | Assessment shell                               | Resume frozen assessment                       |
| Assessment `FINALIZING`                              | Recoverable finalizing state                   | Retry finalization only                        |
| `ASSESSED` + report                                  | Current report                                 | Explicit Continue or history navigation        |
| Continue failure                                     | Current report with Retry                      | Replay continuation request                    |
| Historical block                                     | Snapshot-only story/report                     | Navigate history; no mutations                 |

The exhaustive mapping lives in `src/features/practice/core-technical/domain/ui-state.ts`. Components do not
calculate scores, unlock assessments, complete code questions, select stories, or infer publication
eligibility.

## Route and ownership boundary

- `/practice` receives only an eligible or already-resumable Core Technical display entry.
- `/practice/core-technical?block=<owned-id>` selects current or historical frozen story data.
- `/practice/core-technical/questions/<owned-id>` resolves the question by owner and returns the
  same not-found result for missing and foreign IDs.
- Server pages call Core Technical services directly. Client components use authenticated mutation
  APIs and never receive private story/question/evaluator snapshots.
- A current or historical owned block remains readable after catalogue retirement. New preparation
  remains fail-closed unless two compatible story versions and the pinned runner are available.

## Step 14.1 parity checklist

- Page width, responsive padding, two-column breakpoint, sticky coach offset, borders, radii,
  background tones, typography, progress bar, question rows, status pills, and focus rings trace to
  the DSA sources above.
- Mobile remains the single-column base layout; `sm` widens padding and controls, `lg` introduces
  two-column question lists, and `xl` enables the `17rem` sticky coach column.
- `COMPLETED` and `LEARNED` remain visibly and semantically distinct.
- History selection is URL-owned and ordered by immutable block ordinal.
- The Practice card does not appear for unsupported or unreleased paths.
- DSA implementation files remain unchanged.
- First entry uses a focus-trapped, staggered modal with one custom language listbox. The confirm
  request contains only `language`; role, seniority, target job, runtime, framework, exclusions,
  and resume evidence remain server-owned.
- The Core Technical overview reuses the DSA hierarchy: heading/progress, teacher-led story hero,
  sticky three-step coach, two-column path rows, and portrait-led assessment card.
- Teacher speech stays concise even when the visible incident/recommendation copy is long. Question
  rows include difficulty and a format-weighted duration beside the DSA clock icon.
- The assessment card mirrors DSA's ready treatment and Measures chips. Development-only early
  start is explicit and converts unfinished questions to zero-mastery `LEARNED`; production keeps
  the normal lock.
