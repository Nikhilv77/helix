# Cleanup plan

Audited September 28, 2026, against local working files based on commit `0127a164`.
This is an audit, not a deletion. Application files were not changed. Other worktree edits were present and continued during the audit; the CSV records a SHA-256 for every candidate file so later edits can be detected.

## What to remove

Work through these batches in order. This document records planned work; none of the removal tasks below have been performed.

- [ ] **Batch 1 — delete the six whole files** listed under “Confirmed orphaned source files” (1,340 lines).
- [ ] **Batch 2 — remove only the named declarations** in the detailed checklist at the end of this document (1,113 lines). Keep the containing files and all other live exports. Remove imports left unused by these deletions after checking their side effects.
- [x] **Batch 3 — remove orphaned configuration.** Done September 28: the whole `agent/` directory was deleted, including `agent/.dockerignore` (73 non-code lines) and the local virtual environment.
- [ ] **Batch 4 — decide whether to retire the four dormant feature groups.** If retiring them, delete their implementations and dedicated tests together using the exact paths below (687 additional lines after overlap adjustment). Otherwise keep and integrate them.
- [ ] **Batch 5 — remove the listed CSS candidates only after checking dynamic class construction and browser appearance** (486 candidate lines). Do this after the dead JSX removal.
- [x] **Documentation — consolidate the four historical documents.** Done September 28: the old documents were deleted and replaced by the numbered series in [README.md](README.md). Their 3,467 lines were never counted as code savings.

Before implementing, compare the current files with the audit snapshot and recheck references. Line numbers below are locations from the September 28 audit, not instructions to blindly delete those numbered lines after other edits. Locate declarations by name and CSS by selector. The CSV contains file hashes for this purpose.

After each code batch, run TypeScript, lint on affected files, and relevant existing tests. Before merging the complete cleanup, run the full test suite and production build. For CSS, verify affected pages in light/dark themes and desktop/mobile layouts. The previous isolated TypeScript pass is evidence for the audited snapshot, not a substitute for checking the actual cleanup.

## Result

| Classification | Physical lines | Decision |
| --- | ---: | --- |
| Six orphaned source files | 1,340 | Strong removal candidates |
| 108 unused top-level declarations and their private helpers | 1,113 | Strong removal candidates |
| **Conservative code removal total** | **2,453** | Isolated removal passes TypeScript |
| Dormant implementations and their own tests | 687 additional | Retire or integrate deliberately |
| Unreferenced CSS rules and animations | 486 additional | Visual verification required |
| **Expanded code cleanup candidate total** | **3,626** | Includes the two conditional categories above |
| Orphaned agent Docker ignore file | 73 | Non-code housekeeping, separate |

The conservative code total is about 1.0% of the earlier 245,734-line source count; the expanded total is about 1.5%. These are physical lines: comments/blanks inside removed files or declaration ranges count. No unused-export warning is counted as deletion of a still-used implementation. Ranges do not overlap. Removing whole unused imports, adjacent comments, or blank separators may save a few additional lines; those are not estimated here.

This is a defensible static-analysis floor and a larger review list, not proof that every possible dead branch, public class method, runtime feature flag, database column, external consumer, or persisted URL has been exhausted. Current production traffic/data were not queried. Age alone is not evidence of non-use.

The complete removal ledger is [CLEANUP_LEDGER.csv](CLEANUP_LEDGER.csv): each file, original line range, symbol/selector, category, evidence, and file hash.

## Confirmed orphaned source files

| File | Lines | Finding |
| --- | ---: | --- |
| [src/features/interviews/domain/interview-templates.ts](../src/features/interviews/domain/interview-templates.ts) | 215 | Old template catalogue; only the orphaned setup screen imports it. |
| [src/features/interviews/ui/interview-setup-client.tsx](../src/features/interviews/ui/interview-setup-client.tsx) | 903 | Old setup flow; no route or other consumer imports it. Current interview routes launch their own flows. |
| [src/features/dashboard/ui/overview/dashboard-skeleton.tsx](../src/features/dashboard/ui/overview/dashboard-skeleton.tsx) | 203 | Old overview skeleton with no caller. |
| [src/features/practice/architecture-design/ui/architecture-design-preparation.tsx](../src/features/practice/architecture-design/ui/architecture-design-preparation.tsx) | 8 | Unused wrapper around shared preparation UI. |
| [src/features/practice/applied-engineering/ui/applied-engineering-preparation.tsx](../src/features/practice/applied-engineering/ui/applied-engineering-preparation.tsx) | 8 | Unused wrapper around shared preparation UI. |
| [src/features/practice/core-technical/ui/core-technical-learning-guide.tsx](../src/features/practice/core-technical/ui/core-technical-learning-guide.tsx) | 3 | Unused re-export wrapper. |

## Dead declarations inside files that remain live

The 1,113-line total includes these larger groups:

| Area | Lines | Examples |
| --- | ---: | --- |
| Reports UI | 338 | `ReportBriefingStage`, its unused download/finding/loading helpers, and old opening timers; keep the live exports in the file |
| Shared practice | 146 | Unused route factories, unused port interfaces, UI contract helpers, fixed voice-line constant |
| Profile UI | 122 | `SectionUiTexture` |
| Brand artwork | 90 | `WaveStrip`, `ExchangeCard`, and private supporting types/config |
| Preparation onboarding | 75 | `baselineQuestionTeacherCue`, `isCorrectBaselineAnswer`, duration label |
| Core Technical | 61 | Unused schema/type/helper declarations; keep the content coverage tests |
| Clerk theme | 39 | `userProfileAppearance` |
| Other locations | 242 | Old API wrappers, label formatters, small types, constants and helpers; itemized in CSV |

Knip reported 247 unused value exports and 138 unused type exports. Those are **not** 385 dead implementations: many Zod schemas, constants, and functions are used inside their defining file. A TypeScript symbol graph retained internally used declarations and followed helper dependencies. Shorthand object-property references are included. Tests and CLI entry points count as uses.

## Dormant features: 687 additional lines

These implementations have no current application consumer, but tests keep them reachable to a normal unused-code scan. Retiring these features permits removing their dedicated tests; alternatively, wire the feature into the application. Merely deleting tests is not cleanup.

| Group | Source lines | Dedicated test lines | Net additional lines |
| --- | ---: | ---: | ---: |
| Old interruption watchdog | 69 | 48 | 116: one constant line is already in the conservative total |
| `LearnerWorkspaceView` | 184 | 39 | 223 |
| Old `CoreTechnicalPreparation` component | 29 | 118 | 147 |
| DSA normalized-question adapter and its contracts | 163 | 38 | 201 |
| **Total** | **445** | **243** | **687** |

A further 25-line `core-technical-assessment-dialogue.ts` wrapper is used only by tests in this repository, but explicitly claims compatibility with saved Core integrations. Do not add it to the total until that contract is checked. Its tests also exercise shared dialogue behavior and should be retargeted rather than simply deleted.

Test-only does not always mean dormant product code. `dsa-bank-audit.ts` and Core Technical `coverage.ts` are useful content-quality checks run by the test suite; retain them. `gold-case-audit.ts` and architecture `content-publisher.ts` are used by publication scripts; retain them.

## CSS: 486 candidate lines

`src/app/globals.css` has 66 candidate rule blocks covering 381 lines and 11 unreferenced keyframe blocks covering 105 lines. The CSV includes every selector and range. This count assumes the confirmed dead JSX is removed first.

Examples include the retired dashboard skeleton, old microphone menu styling, blueprint rails/grid, old report signal/ring/bar effects, chapter/editor shells, note pins, and typing-caret animation.

The active dynamic classes `dsa-library-stat-dot-${tone}` were explicitly excluded even though their complete names have no literal source occurrence. Dynamically constructed asset paths were checked too. Remaining CSS candidates still need representative light/dark desktop/mobile browser checks; CSS is therefore outside the conservative total. No global custom property was counted, because framework-generated consumers such as `--tw-ring-color` can be invisible to source searches.

## Old or unpublished content, not automatic deletion

- **535 lines:** `ai-ml-scenario-candidates.ts` contains two unpublished AI/ML scenarios. The (now deleted) review documents and `docs/issues.md` tracked these drafts as pending work. They are unused at runtime, but they are not abandoned. Discarding them is a content decision and is outside both totals.
- **492 lines:** screenshot capture/comparison scripts have no package-script entry, and the deleted `docs/temp.md` was the only place that described them. They were excluded from the orphan count; either document them in [06_DEVELOPMENT.md](06_DEVELOPMENT.md) or remove them.
- **73 lines:** `agent/.dockerignore` is the only tracked file in `agent/`; there is no corresponding tracked agent Dockerfile or worker source, and Compose only starts Postgres. This is an orphaned configuration file, counted separately from code.
- **25 lines:** compatibility dialogue wrapper, discussed above.

Historical documentation (four handoff and planning documents, 3,467 lines) was flagged here for consolidation. It was deleted on September 28 and replaced by the numbered documentation series; see [README.md](README.md).

## Things deliberately retained

- All 101 SQL migration files: historical database reconstruction and deployment state, not dead code because the schema evolved.
- Legacy DSA blocks, recommendation/report snapshots, preparation stages and persisted round identities: reachable compatibility readers still serve saved data. The earlier cleanup document recorded recommendation v0 rows and explicitly retained readers. That historical audit is not evidence of today's production counts.
- Next.js pages, API routes, metadata handlers, redirect routes and the maintenance cron: framework/external entry points do not require an ordinary import. `/help` redirects also protect saved notification links.
- All source JSON files have a filename/path reference. Every tracked voice MP3 has a manifest reference. Reference presence is not proof that every authored question or cached voice line is requested today; content-level retirement needs a separate usage decision.
- Teacher headset portraits are reached through `${teacher.id}` paths. They are not orphaned assets.
- Google ownership verification, avatar licenses/README and legacy brand assets are intentionally retained by the existing cleanup record for externally addressable consumers. The three brand files with no current source URL reference total 37,540 bytes; no safe deletion claim is made.
- No byte-identical public assets were found. No unused package dependency was reported by the normal Knip scan. Production-only scans misleadingly mark development/publication tooling as unused, so those results were cross-checked against package scripts.
- Active test coverage, seed/publish/evaluation/maintenance scripts, generated voice manifests and authored/generated content used by the app.

## Local generated files and caches

These are disk usage, not repository code-removal lines:

| Local directory | Approximate disk usage | Treatment |
| --- | ---: | --- |
| `.next` | 13 GB | Regenerable build/dev cache; remove only when the running dev/build process is stopped |
| `node_modules` | 1.6 GB | Installed dependencies; reinstallable, not obsolete source |
| `agent` | 353 MB | Deleted September 28 |
| `.vercel` | 88 MB | Local deployment metadata/artifacts; retain project linkage as needed |
| `scratch` | 29 MB | Deleted September 28; the Trailmate demo seed moved to `scripts/`. Still the output folder for `capture-screens` and `compare-screens` (ignored by git) |
| `output` / `tmp` | 124 KB / 160 KB | Local outputs; excluded from source totals |

No tracked `.tsbuildinfo`, `.log` or `.pyc` files were found. No cache, local environment, or personal-data export was deleted or added to the code count.

## Validation and limits

1. Enumerated tracked/nonignored source and assets, inspected package commands, Next.js/Prisma/Vitest config and the maintenance cron.
2. Ran Knip 6.38.0 in normal and production modes. Reviewed orphan candidates against docs, dynamic references and tools.
3. Built a TypeScript top-level symbol/reference graph for unused exported and private declarations, preserving local references and tests.
4. Removed the six orphan files and 108 declarations only in `/tmp/trailgrad-audit/check`, then ran TypeScript with `--noEmit --incremental false`: **passed**. No production source was deleted.
5. Ran a baseline `--noUnusedLocals --noUnusedParameters` check: it reported only two unused parameters (`item` in a DSA finalization test and `report` in the report dashboard). They are not whole removable lines and are excluded.
6. Parsed CSS with PostCSS, checked literal consumers and known dynamic classes, audited asset references and exact duplicate hashes.

No deployment, production database audit, traffic-log audit, full runtime test suite, or browser visual pass was performed for this report. The conditional lists require those relevant checks before a cleanup is merged. The isolated typecheck establishes static consistency, not runtime equivalence or proof that all unreferenced initializers have no side effects.

## Detailed Batch 2 checklist: remove these declarations

Each row is a removal task within a file that must remain. Delete only the listed declarations and their bodies. The full original ranges and hashes are in [CLEANUP_LEDGER.csv](CLEANUP_LEDGER.csv). Total: **108 declarations, 1,113 lines**.

| Done | File to edit | Declarations to remove (original start line) | Lines |
| --- | --- | --- | ---: |
| [ ] | [src/components/brand/blueprint-art.tsx](../src/components/brand/blueprint-art.tsx) | `WaveStrip` (L76); `ExchangeAction` (L109); `actionMeta` (L111); `Exchange` (L118); `ExchangeCard` (L131) | 90 |
| [ ] | [src/components/workspace/shared/loading/primitives.tsx](../src/components/workspace/shared/loading/primitives.tsx) | `waveHeights` (L12); `Waveform` (L18) | 21 |
| [ ] | [src/features/interviews/domain/evaluation-profile.ts](../src/features/interviews/domain/evaluation-profile.ts) | `evaluationProfileForFamily` (L287) | 5 |
| [ ] | [src/features/interviews/domain/interruption.ts](../src/features/interviews/domain/interruption.ts) | `INTERRUPT_COOLDOWN_MS` (L13) | 1 |
| [ ] | [src/features/interviews/domain/personalized-plan.ts](../src/features/interviews/domain/personalized-plan.ts) | `DEFAULT_RELEVANCE_PRIORITY` (L84); `SkillEvidenceSourceKind` (L116); `RelevanceSignalKind` (L117); `CandidateInterviewProject` (L375) | 12 |
| [ ] | [src/features/interviews/domain/technical-deep-dive.ts](../src/features/interviews/domain/technical-deep-dive.ts) | `TECHNICAL_DEEP_DIVE_QUESTION_COUNT` (L6); `technicalDeepDiveAgenda` (L50) | 11 |
| [ ] | [src/features/interviews/server/decider.ts](../src/features/interviews/server/decider.ts) | `isDecisionAction` (L378) | 9 |
| [ ] | [src/features/interviews/server/fundamentals-round.ts](../src/features/interviews/server/fundamentals-round.ts) | `isFundamentalsRoundSetup` (L145) | 3 |
| [ ] | [src/features/interviews/server/prompt-context.ts](../src/features/interviews/server/prompt-context.ts) | `describeSetup` (L72) | 3 |
| [ ] | [src/features/interviews/server/resume-round.ts](../src/features/interviews/server/resume-round.ts) | `isResumeRoundSetup` (L347) | 3 |
| [ ] | [src/features/interviews/server/technical-answer-evaluator.ts](../src/features/interviews/server/technical-answer-evaluator.ts) | `shouldEvaluateAnswer` (L178) | 1 |
| [ ] | [src/features/interviews/ui/voice/components/fundamentals-live-workspace.tsx](../src/features/interviews/ui/voice/components/fundamentals-live-workspace.tsx) | `FUNDAMENTALS_STAGE_ORDER` (L135) | 1 |
| [ ] | [src/features/interviews/ui/voice/utils/voice-interview.ts](../src/features/interviews/ui/voice/utils/voice-interview.ts) | `isAgentState` (L64); `updateLiveTranscript` (L68) | 27 |
| [ ] | [src/features/practice/ai-ml/domain/ai-ml-story-catalog.ts](../src/features/practice/ai-ml/domain/ai-ml-story-catalog.ts) | `aiMlStoryQuestionById` (L1438) | 10 |
| [ ] | [src/features/practice/applied-engineering/domain/assessment-contracts.ts](../src/features/practice/applied-engineering/domain/assessment-contracts.ts) | `AppliedEngineeringAssessmentEvaluation` (L222) | 3 |
| [ ] | [src/features/practice/applied-engineering/domain/contracts.ts](../src/features/practice/applied-engineering/domain/contracts.ts) | `appliedEngineeringPublicationStatusSchema` (L15); `AppliedEngineeringDifficulty` (L61); `AppliedEngineeringArtifactKind` (L65) | 8 |
| [ ] | [src/features/practice/applied-engineering/domain/incident-contracts.ts](../src/features/practice/applied-engineering/domain/incident-contracts.ts) | `AppliedEngineeringIncidentStage` (L127); `AppliedEngineeringIncident` (L128); `SelectedAppliedEngineeringIncident` (L129) | 5 |
| [ ] | [src/features/practice/applied-engineering/domain/practice-contracts.ts](../src/features/practice/applied-engineering/domain/practice-contracts.ts) | `AppliedEngineeringAttemptFeedback` (L148); `AppliedEngineeringAuthorizedAnswer` (L151) | 6 |
| [ ] | [src/features/practice/applied-engineering/domain/question-contracts.ts](../src/features/practice/applied-engineering/domain/question-contracts.ts) | `AppliedEngineeringArtifact` (L204); `AppliedEngineeringQuestionBlock` (L206) | 2 |
| [ ] | [src/features/practice/applied-engineering/domain/review-artifact-contracts.ts](../src/features/practice/applied-engineering/domain/review-artifact-contracts.ts) | `AppliedEngineeringHumanReview` (L50) | 1 |
| [ ] | [src/features/practice/applied-engineering/ui/applied-engineering-experience.ts](../src/features/practice/applied-engineering/ui/applied-engineering-experience.ts) | `APPLIED_ENGINEERING_PREPARATION_EXPERIENCE` (L13) | 12 |
| [ ] | [src/features/practice/architecture-design/domain/assessment-contracts.ts](../src/features/practice/architecture-design/domain/assessment-contracts.ts) | `ArchitectureDesignAssessmentEvaluation` (L313) | 3 |
| [ ] | [src/features/practice/architecture-design/domain/baseline-evidence-contracts.ts](../src/features/practice/architecture-design/domain/baseline-evidence-contracts.ts) | `ARCHITECTURE_DESIGN_BASELINE_SECTION` (L9) | 1 |
| [ ] | [src/features/practice/architecture-design/domain/contracts.ts](../src/features/practice/architecture-design/domain/contracts.ts) | `ARCHITECTURE_DESIGN_LABEL` (L4); `architectureDesignPublicationStatusSchema` (L18); `ArchitectureDesignPublicationStatus` (L71); `ArchitectureDesignRole` (L74); `ArchitectureDesignSeniority` (L75); `ArchitectureDesignArtifactKind` (L80) | 13 |
| [ ] | [src/features/practice/architecture-design/domain/practice-contracts.ts](../src/features/practice/architecture-design/domain/practice-contracts.ts) | `architectureDesignAttemptIdentitySchema` (L109); `ArchitectureDesignAttemptFeedback` (L118); `ArchitectureDesignAuthorizedAnswer` (L121) | 12 |
| [ ] | [src/features/practice/architecture-design/domain/question-contracts.ts](../src/features/practice/architecture-design/domain/question-contracts.ts) | `ArchitectureDesignArtifact` (L168) | 1 |
| [ ] | [src/features/practice/architecture-design/domain/review-artifact-contracts.ts](../src/features/practice/architecture-design/domain/review-artifact-contracts.ts) | `ArchitectureDesignHumanReview` (L59) | 1 |
| [ ] | [src/features/practice/architecture-design/domain/scenario-briefs.ts](../src/features/practice/architecture-design/domain/scenario-briefs.ts) | `ArchitectureDesignScenarioBrief` (L63) | 1 |
| [ ] | [src/features/practice/architecture-design/domain/scenario-contracts.ts](../src/features/practice/architecture-design/domain/scenario-contracts.ts) | `ArchitectureDesignScenarioStage` (L98); `ArchitectureDesignScenario` (L99) | 2 |
| [ ] | [src/features/practice/core-technical/domain/assessment-contracts.ts](../src/features/practice/core-technical/domain/assessment-contracts.ts) | `CoreTechnicalAssessmentEvaluation` (L257) | 3 |
| [ ] | [src/features/practice/core-technical/domain/contracts.ts](../src/features/practice/core-technical/domain/contracts.ts) | `CoreTechnicalImportance` (L98); `CoreTechnicalDomainTopic` (L103) | 2 |
| [ ] | [src/features/practice/core-technical/domain/coverage.ts](../src/features/practice/core-technical/domain/coverage.ts) | `assertCoreTechnicalCoverage` (L214) | 6 |
| [ ] | [src/features/practice/core-technical/domain/practice-contracts.ts](../src/features/practice/core-technical/domain/practice-contracts.ts) | `CoreTechnicalAuthorizedAnswer` (L109) | 1 |
| [ ] | [src/features/practice/core-technical/domain/question-contracts.ts](../src/features/practice/core-technical/domain/question-contracts.ts) | `generatedStageQuestionCandidatesSchema` (L253) | 3 |
| [ ] | [src/features/practice/core-technical/domain/technology-focus.ts](../src/features/practice/core-technical/domain/technology-focus.ts) | `coreTechnicalTechnologyLabel` (L102) | 3 |
| [ ] | [src/features/practice/core-technical/domain/ui-state.ts](../src/features/practice/core-technical/domain/ui-state.ts) | `CoreTechnicalQuestionWorkKind` (L34); `coreTechnicalQuestionWorkKind` (L65); `humanizeCoreTechnicalKey` (L160) | 23 |
| [ ] | [src/features/practice/core-technical/server/runner.service.ts](../src/features/practice/core-technical/server/runner.service.ts) | `isExecutableCoreTechnicalQuestion` (L433) | 12 |
| [ ] | [src/features/practice/core-technical/ui/core-technical-intro.tsx](../src/features/practice/core-technical/ui/core-technical-intro.tsx) | `CoreTechnicalIntro` (L18) | 8 |
| [ ] | [src/features/practice/dsa/domain/dsa.ts](../src/features/practice/dsa/domain/dsa.ts) | `allQuestionSlugs` (L260) | 3 |
| [ ] | [src/features/practice/dsa/server/dsa-block-assessment-runtime.service.ts](../src/features/practice/dsa/server/dsa-block-assessment-runtime.service.ts) | `isPreparationError` (L542) | 3 |
| [ ] | [src/features/practice/shared/domain/teacher-voice-lines.ts](../src/features/practice/shared/domain/teacher-voice-lines.ts) | `FIXED_TEACHER_LINES` (L33) | 3 |
| [ ] | [src/features/practice/shared/server/contracts.ts](../src/features/practice/shared/server/contracts.ts) | `STORY_PRACTICE_BLOCK_STATUSES` (L1); `STORY_PRACTICE_QUESTION_STATUSES` (L8); `StoryPracticeBlockStatus` (L18); `StoryPracticeQuestionStatus` (L19); `StoryPracticeContinuationDecision` (L42); `StoryPracticePreparationPort` (L115); `StoryPracticeQuestionPort` (L123); `StoryPracticeExecutablePort` (L137); `StoryPracticeAssessmentPort` (L141); `StoryPracticeContinuationPort` (L150); `StoryPracticeHistoryPort` (L161) | 59 |
| [ ] | [src/features/practice/shared/server/route-kit.ts](../src/features/practice/shared/server/route-kit.ts) | `RouteErrorResponder` (L44); `createStoryPracticeReadHandler` (L114); `createStoryPracticeMutationHandler` (L131) | 59 |
| [ ] | [src/features/practice/shared/ui/contracts.ts](../src/features/practice/shared/ui/contracts.ts) | `StoryPracticeQuestionCapability` (L8); `StoryPracticeExperience` (L137); `defineStoryPracticeExperience` (L152) | 25 |
| [ ] | [src/features/practice/story-tracks/domain/story-assessment.ts](../src/features/practice/story-tracks/domain/story-assessment.ts) | `storyAssessmentResponsesSchema` (L74) | 4 |
| [ ] | [src/features/preparation-onboarding/domain/preparation-onboarding.ts](../src/features/preparation-onboarding/domain/preparation-onboarding.ts) | `BASELINE_DURATION_LABEL` (L119); `baselineQuestionTeacherCue` (L122); `isCorrectBaselineAnswer` (L413) | 75 |
| [ ] | [src/features/profile/ui/candidate-profile-editor-resume-anchors.tsx](../src/features/profile/ui/candidate-profile-editor-resume-anchors.tsx) | `SectionUiTexture` (L286) | 122 |
| [ ] | [src/features/reports/ui/report-briefing-stage.tsx](../src/features/reports/ui/report-briefing-stage.tsx) | `openingPhaseTimers` (L19); `ReportBriefingStage` (L220); `DownloadReportButton` (L609); `InlineWaveLoader` (L634); `downloadReportPdf` (L648); `ReportFinding` (L659) | 338 |
| [ ] | [src/features/resume-roast/contracts/resume-roast.ts](../src/features/resume-roast/contracts/resume-roast.ts) | `ResumeRoastDimensionScore` (L315) | 1 |
| [ ] | [src/features/resume-roast/server/resume-roast.generator.ts](../src/features/resume-roast/server/resume-roast.generator.ts) | `validateResumeRoastResult` (L406) | 5 |
| [ ] | [src/lib/api/api-client.ts](../src/lib/api/api-client.ts) | `startInterview` (L97); `getPersonalizedInterviewPlan` (L154) | 6 |
| [ ] | [src/lib/auth/clerk-theme.ts](../src/lib/auth/clerk-theme.ts) | `userProfileAppearance` (L79) | 39 |
| [ ] | [src/lib/curriculum/curriculum.ts](../src/lib/curriculum/curriculum.ts) | `ROUND_LABEL` (L40) | 5 |
| [ ] | [src/lib/shared/labels.ts](../src/lib/shared/labels.ts) | `roleLabel` (L9); `roleInitials` (L32); `roundLabel` (L38); `levelLabel` (L55); `formatDate` (L61); `formatClock` (L80) | 37 |

## Detailed Batch 4 checklist: dormant feature retirement

Delete these files only when retiring their corresponding dormant feature. The interruption constant already counted in Batch 2 explains the one-line overlap adjustment; do not add 688 to the conservative total.

| Done | File to delete when retiring the feature | Additional audited lines |
| --- | --- | ---: |
| [ ] | [src/features/interviews/domain/interruption.test.ts](../src/features/interviews/domain/interruption.test.ts) | 48 |
| [ ] | [src/features/interviews/domain/interruption.ts](../src/features/interviews/domain/interruption.ts) | 68 |
| [ ] | [src/features/peer-help/ui/learner-workspace-view.test.tsx](../src/features/peer-help/ui/learner-workspace-view.test.tsx) | 39 |
| [ ] | [src/features/peer-help/ui/learner-workspace-view.tsx](../src/features/peer-help/ui/learner-workspace-view.tsx) | 184 |
| [ ] | [src/features/practice/core-technical/ui/core-technical-preparation.test.tsx](../src/features/practice/core-technical/ui/core-technical-preparation.test.tsx) | 118 |
| [ ] | [src/features/practice/core-technical/ui/core-technical-preparation.tsx](../src/features/practice/core-technical/ui/core-technical-preparation.tsx) | 29 |
| [ ] | [src/features/practice/shared/server/questions/contracts.ts](../src/features/practice/shared/server/questions/contracts.ts) | 76 |
| [ ] | [src/features/practice/shared/server/questions/dsa-question-adapter.spec.ts](../src/features/practice/shared/server/questions/dsa-question-adapter.spec.ts) | 38 |
| [ ] | [src/features/practice/shared/server/questions/dsa-question-adapter.ts](../src/features/practice/shared/server/questions/dsa-question-adapter.ts) | 87 |

## Detailed Batch 5 checklist: CSS candidates

Edit `src/app/globals.css`; keep the file. Remove only the verified rule/keyframe blocks below, preserving other selectors and media-query contents. These are candidates pending visual checks, not confirmed runtime-safe removals.

| Done | Original lines | Selector or keyframe name | Lines |
| --- | --- | --- | ---: |
| [ ] | 329–331 | `.page-enter` | 3 |
| [ ] | 367–373 | `.interactive-card` | 7 |
| [ ] | 375–381 | `.interactive-card:hover` | 7 |
| [ ] | 433–445 | `.blueprint-grid` | 13 |
| [ ] | 851–855 | `.teacher-carousel-label` | 5 |
| [ ] | 921–923 | `.interview-loading-bar` | 3 |
| [ ] | 938–942 | `.surface-raised` | 5 |
| [ ] | 1115–1117 | `.workspace-black .workspace-accent-ring` | 3 |
| [ ] | 1119–1123 | `.workspace-black .workspace-accent-orbit` | 5 |
| [ ] | 1161–1163 | `.workspace-black .workspace-accent-blur` | 3 |
| [ ] | 1165–1173 | `.workspace-black .workspace-accent-progress-wash` | 9 |
| [ ] | 1175–1184 | `.workspace-black .workspace-accent-progress-overlay` | 10 |
| [ ] | 1186–1193 | `.workspace-black .workspace-accent-progress-card-overlay` | 8 |
| [ ] | 1195–1198 | `.workspace-black .workspace-chart-dot` | 4 |
| [ ] | 1205–1210 | `.surface-interactive` | 6 |
| [ ] | 1212–1216 | `.surface-interactive:hover` | 5 |
| [ ] | 1268–1270 | `.shadow-soft-inset` | 3 |
| [ ] | 1457–1473 | `.practice-chapter-card` | 17 |
| [ ] | 1475–1486 | `.practice-chapter-card:hover, .practice-chapter-card[open]` | 12 |
| [ ] | 1488–1490 | `.practice-chapter-card[open]` | 3 |
| [ ] | 1507–1518 | `.practice-editor-shell` | 12 |
| [ ] | 1520–1523 | `.practice-editor-header` | 4 |
| [ ] | 2390–2394 | `html.light .resume-roast-page .resume-roast-resume-stage .progress-maya-bubble, html[data-theme="light"] .resume-roast-page .resume-roast-resume-stage .progress-maya-bubble` | 5 |
| [ ] | 3052–3055 | `.fade-top` | 4 |
| [ ] | 3086–3088 | `.typing-dot` | 3 |
| [ ] | 3090–3098 | `.typing-caret` | 9 |
| [ ] | 3369–3371 | `.report-signal-core` | 3 |
| [ ] | 3387–3392 | `.report-signal-ring` | 6 |
| [ ] | 3394–3397 | `.report-briefing-line` | 4 |
| [ ] | 3407–3409 | `.report-scan-line` | 3 |
| [ ] | 3422–3424 | `.report-signal-insight` | 3 |
| [ ] | 3753–3757 | `.maya-welcome-card` | 5 |
| [ ] | 3780–3785 | `.blueprint-rails` | 6 |
| [ ] | 3787–3795 | `.blueprint-rails::before, .blueprint-rails::after` | 9 |
| [ ] | 3797–3799 | `.blueprint-rails::before` | 3 |
| [ ] | 3801–3803 | `.blueprint-rails::after` | 3 |
| [ ] | 4190–4192 | `.accent-zone` | 3 |
| [ ] | 4308–4312 | `.marketing-theme-section .report-row-fill, .marketing-theme-section .report-evidence-bar` | 5 |
| [ ] | 4314–4317 | `.marketing-theme-section .report-score-ring` | 4 |
| [ ] | 4338–4342 | `.marketing-theme-section .report-score-ring, .marketing-theme-section .report-row-fill, .marketing-theme-section .report-evidence-bar` | 5 |
| [ ] | 4582–4587 | `html.light .blueprint-grid, html[data-theme="light"] .blueprint-grid` | 6 |
| [ ] | 4679–4685 | `.onboarding-story-title` | 7 |
| [ ] | 4687–4693 | `.onboarding-section-title` | 7 |
| [ ] | 4695–4700 | `.onboarding-card-title` | 6 |
| [ ] | 5014–5020 | `.note-card` | 7 |
| [ ] | 5022–5024 | `.note-card:hover` | 3 |
| [ ] | 5026–5043 | `.note-pin` | 18 |
| [ ] | 5073–5075 | `.ring-pulse` | 3 |
| [ ] | 5106–5108 | `.report-score-ring` | 3 |
| [ ] | 5168–5171 | `.report-evidence-bar` | 4 |
| [ ] | 5173–5176 | `.report-row-fill` | 4 |
| [ ] | 5547–5550 | `.mentor-program-stage` | 4 |
| [ ] | 6235–6240 | `html.light .interview-workspace-page .interview-microphone-trigger, html[data-theme="light"] .interview-workspace-page .interview-microphone-trigger` | 6 |
| [ ] | 6242–6249 | `html.light .interview-workspace-page .interview-microphone-trigger:hover, html[data-theme="light"] .interview-workspace-page .interview-microphone-trigger:hover, html.light .interview-workspace-page .interview-microphone-trigger:focus-visible, html[data-theme="light"] .interview-workspace-page .interview-microphone-trigger:focus-visible` | 8 |
| [ ] | 6251–6257 | `html.light .interview-workspace-page .interview-microphone-menu, html[data-theme="light"] .interview-workspace-page .interview-microphone-menu` | 7 |
| [ ] | 6259–6262 | `html.light .interview-workspace-page .interview-microphone-option, html[data-theme="light"] .interview-workspace-page .interview-microphone-option` | 4 |
| [ ] | 6264–6270 | `html.light .interview-workspace-page .interview-microphone-option:hover, html[data-theme="light"] .interview-workspace-page .interview-microphone-option:hover, html.light .interview-workspace-page .interview-microphone-option[aria-selected="true"], html[data-theme="light"] .interview-workspace-page .interview-microphone-option[aria-selected="true"]` | 7 |
| [ ] | 6801–6808 | `html.light .dsa-practice-page .dsa-question-step-tooltip, html[data-theme="light"] .dsa-practice-page .dsa-question-step-tooltip` | 8 |
| [ ] | 6810–6813 | `html.light .dsa-practice-page .dsa-question-step-tooltip strong, html[data-theme="light"] .dsa-practice-page .dsa-question-step-tooltip strong` | 4 |
| [ ] | 6879–6882 | `html.light .practice-page .story-assessment-portrait-label, html[data-theme="light"] .practice-page .story-assessment-portrait-label` | 4 |
| [ ] | 7218–7225 | `html.light .dashboard-skeleton [class*="bg-[#17181b]"], html[data-theme="light"] .dashboard-skeleton [class*="bg-[#17181b]"], html.light .dashboard-skeleton [class*="bg-[#151619]"], html[data-theme="light"] .dashboard-skeleton [class*="bg-[#151619]"], html.light .dashboard-skeleton [class*="bg-black/"], html[data-theme="light"] .dashboard-skeleton [class*="bg-black/"]` | 8 |
| [ ] | 7292–7294 | `.dashboard-skeleton .skeleton` | 3 |
| [ ] | 7296–7303 | `html.light .dashboard-skeleton [class*="bg-[#17181b]"], html[data-theme="light"] .dashboard-skeleton [class*="bg-[#17181b]"], html.light .dashboard-skeleton [class*="bg-[#151619]"], html[data-theme="light"] .dashboard-skeleton [class*="bg-[#151619]"]` | 8 |
| [ ] | 7305–7308 | `html.light .dashboard-skeleton [class*="bg-black/"], html[data-theme="light"] .dashboard-skeleton [class*="bg-black/"]` | 4 |
| [ ] | 7310–7313 | `html.light .dashboard-skeleton .skeleton, html[data-theme="light"] .dashboard-skeleton .skeleton` | 4 |
| [ ] | 7315–7318 | `html.light .dashboard-skeleton .skeleton::after, html[data-theme="light"] .dashboard-skeleton .skeleton::after` | 4 |
| [ ] | 270–279 | `float-in` | 10 |
| [ ] | 912–919 | `interview-loading` | 8 |
| [ ] | 3073–3084 | `dot-bounce` | 12 |
| [ ] | 3100–3104 | `caret-blink` | 5 |
| [ ] | 3249–3258 | `report-signal-core` | 10 |
| [ ] | 3291–3303 | `report-signal-ring` | 13 |
| [ ] | 4875–4884 | `hero-ember-breathe-mobile` | 10 |
| [ ] | 5061–5071 | `ring-pulse` | 11 |
| [ ] | 5077–5084 | `report-ring` | 8 |
| [ ] | 5086–5095 | `report-grow-y` | 10 |
| [ ] | 5097–5104 | `report-grow-x` | 8 |
