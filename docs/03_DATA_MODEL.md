# 3. Data model

The schema is in `prisma/schema.prisma`: 92 models and 101 migrations as of September 28, 2026.
This page groups them by area and lists the rules they follow. For field-level detail, read the
schema.

## Rules the schema follows

- **Versioned, append-only history.** Candidate profiles, interview plans, performance profiles,
  practice evidence, and published content (stories, incidents, scenarios) are stored as new
  versions. Old versions are never overwritten, so a past report always matches the plan it was
  taken against.
- **One active row, enforced in the database.** Where only one thing may be live (one `READY`
  plan per owner, one generating Resume Roast per owner, one live help session per participant),
  a partial unique index enforces it.
- **Owner keys.** Most user data is keyed by an owner string such as `user:<clerkId>`. Emails are
  not stored; look them up in Clerk.
- **Snapshots are caches.** Snapshot tables can be deleted and rebuilt from source rows.
- **Account deletion removes everything.** `profile.service.ts` `deleteAccountData` deletes the
  user's rows, ends a live help session they are in, and anonymises them in other learners'
  help history.

## Profile and onboarding

| Model | Holds |
| --- | --- |
| `CandidateProfile` | The learner's profile: teacher, level, target role, resume-derived fields, avatar and cover |
| `CandidateInterviewProfileVersion` | Structured, versioned evidence compiled from the resume |
| `PreparationBaselineQuestion` | The baseline questions asked during preparation onboarding |

## Interviews

| Model | Holds |
| --- | --- |
| `PersonalizedInterviewPlanVersion` | A plan of five blueprints; one `READY` per owner, older ones `SUPERSEDED` |
| `InterviewSessionBlueprint` | One blueprint: kind, topics, rubric weights (each summing to 100) |
| `InterviewSession` | A live or finished interview: state machine, turns, version, report |
| `InterviewAnswerRequest` | One row per turn ID, for idempotent answers |
| `InterviewEvaluationJob` | Post-interview evaluation work; recovered by cron if it stalls |
| `InterviewDesignCanvas` | The drawing canvas in design rounds |
| `CandidatePerformanceProfileVersion` | What interviews showed (schema version 3); feeds plan adaptation |

The planner is described fully in [INTERVIEW_ENGINE.md](../INTERVIEW_ENGINE.md).

## Practice

Each practice track has the same shape: published content with versions, the learner's progress,
per-question state and attempts, code runs, and checkpoint assessments with reports.

| Track | Models |
| --- | --- |
| Core Technical | `CoreTechnicalStoryDefinition`, `…StoryVersion`, `…StoryProgress`, `…Block`, `…BlockQuestion`, `…QuestionState`, `…QuestionAttempt`, `…CodeRun`, `…Assessment`, `…AssessmentReport`, `…PreparationAttempt`, `…FocusRevision`, `CoreTechnicalTrackVersion` |
| Applied Engineering | `AppliedEngineeringIncidentDefinition`, `…IncidentVersion`, `…IncidentProgress`, then the same block, question, code-run, and assessment models |
| Architecture & Design | `ArchitectureScenarioDefinition`, `…ScenarioVersion`, `…ScenarioProgress`, then the same block, question, and assessment models (no code runs) |
| AI/ML, Frontend, Data (story tracks) | `AiMlPracticeSession`, `AiMlPracticeQuestion`, `AiMlPracticeAttempt`, `StoryTrackAssessment` |
| DSA | `DsaPhase`, `DsaQuestion`, `UserDsaQuestionNote`, `DsaPracticeBlock`, `DsaBlockAssessment` |
| Shared prep blocks | `PrepQuestionTemplate`, `PrepPracticeBlock`, `PrepPracticeBlockQuestion`, `PrepPracticeBlockQuestionState`, `PrepPracticeCodeRun`, `PrepBlockAssessment`, `PrepBlockAssessmentReport`, `UserPrepQuestionNote` |
| Evidence | `CandidatePracticeEvidenceVersion`: practice results summarised for planning |

## Roadmap

Templates are authored content; user rows are progress through them.

| Model | Holds |
| --- | --- |
| `RoadmapTemplate`, `RoadmapSessionTemplate`, `RoadmapChapterTemplate`, `RoadmapQuestionTemplate` | The curriculum |
| `UserRoadmap`, `UserSessionProgress`, `UserChapterProgress`, `UserQuestionProgress` | A learner's progress |
| `UserQuestionAttempt` | Individual question attempts |
| `PracticeQuestionPlacement` | Where a question sits in a roadmap |
| `UserMayaInsight` | Maya's saved observations for the frontend roadmap |

## Resume Roast

| Model | Holds |
| --- | --- |
| `ResumeRoastTarget` | The role a roast is aimed at |
| `ResumeRoast` | One roast: status (`GENERATING`, done, failed), scorecard, roast text, rubric version. A partial unique index allows one `GENERATING` row per owner |

## Trailmate and notifications

| Model | Holds |
| --- | --- |
| `HelpRequest` | A learner asking for help on one question; status, invited helpers, expiry |
| `HelpRequestDecline` | A helper declining an invitation |
| `HelpSession` | The live call: LiveKit room, timings, rating |
| `HelpPresence` | Last time each person was seen online (drives online-first invites) |
| `HelpBlock`, `HelpReport` | Safety: blocking and reporting another user |
| `Notification` | In-app notifications (teacher-led messages, help invitations) |

Indexes added September 28: `(learnerId, updatedAt)` and `(helperId, updatedAt)` for the
15-second status check, partial "live" indexes per participant, and `HelpPresence.lastSeenAt`.

## Read models

| Model | Holds |
| --- | --- |
| `CandidateAnalyticsSnapshot` | Progress data per learner |
| `CandidateActivityDaily` | One row per learner per day (UTC) of activity |
| `PracticeHomeSnapshot` | Practice home data |
| `WorkspacePageSnapshot` | Per-page snapshots for interviews, resume-roast, trailmate, reports |

See [Architecture: read models](02_ARCHITECTURE.md#read-models-snapshots) for how they refresh.

## Legacy models

`Project`, `DesignSession`, `KnowledgeDocument`, and `KnowledgeChunk` come from an earlier version
of the product (project uploads and a retrieval index). Today they are only touched by the seed,
the user-reset script, account deletion, and one read in the performance aggregator. They are
candidates for removal; check production for rows before writing a drop migration. See
[Known issues](08_KNOWN_ISSUES.md#technical-debt).

## Working with migrations

- Create migrations against the development database only (`pnpm prisma:migrate:dev`).
- Production migrations are applied deliberately with `pnpm db:migrate:production`, never by the
  deploy command. See [Operations](07_OPERATIONS.md#database-migrations).
- A running `pnpm dev` keeps the old Prisma client after a schema change. Restart it.
