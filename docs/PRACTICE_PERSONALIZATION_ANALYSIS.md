# Practice Generation and Personalization Analysis

## Executive Summary

Trailgrad does not generate a completely new question bank for each candidate. It uses a hybrid model:

1. Resume and onboarding data are converted into a versioned candidate profile.
2. That profile is combined with interview performance and verified Practice evidence.
3. A personalized interview blueprint is generated.
4. Practice projects four drillable sessions from that blueprint.
5. DSA uses a shared curated path, while non-DSA questions are selected from shared authored banks for each candidate.
6. Some question prompts are reframed using resume details.
7. Every verified attempt feeds back into future plans and recommendations.

This is a strong overall architecture because the questions and answer keys remain consistent and auditable. However, the current level of personalization is more limited than the UI may imply, and there are important template-migration and data-consistency issues to address.

## End-to-End Flow

```text
Resume + target role + level + editor language
                         |
                         v
             Versioned candidate profile
                         |
                         v
       Interview performance + verified Practice evidence
                         |
                         v
           Personalized interview blueprint
                         |
                         v
              Four Practice sessions
                         |
             +-----------+-----------+
             |                       |
             v                       v
      Shared DSA path       48 selected Prep questions
       with user state       from shared authored banks
             |                       |
             +-----------+-----------+
                         |
                         v
          Prompt framing + next-question ranking
                         |
                         v
        Attempts, scores, hints, retries and progress
                         |
                         v
          New evidence and future plan revisions
```

## What Is Actually Generated

The system generates a personalized plan, not personalized question content.

Resume extraction may use AI to convert the uploaded document into structured evidence. After that, the candidate profile, relevance ranking, interview blueprint, Practice placements, and recommendations are produced by deterministic application logic.

The personalized plan establishes topics, difficulty, rationale, and session policy. It does not write new interview or Practice questions. Practice selects from questions already present in the shared DSA and Prep banks.

This separation has useful properties:

- Two candidates can receive different selections without changing the underlying answer keys.
- Selection can be reproduced from the same evidence.
- Attempts remain comparable across candidates.
- Question quality can be reviewed before publication.
- A model cannot silently alter the grading standard for an individual candidate.

## Candidate Inputs and Their Effects

| Candidate signal | Current effect on Practice |
| --- | --- |
| Target role | Changes blueprint topics and filters Prep questions when enough role-matched questions exist |
| Resume skills and domains | Influence relevance ranking and blueprint topics |
| Resume projects and employers | Supply values for supported prompt-personalization slots |
| Experience level | Influences blueprint difficulty and gives matching Prep questions a ranking bonus |
| Editor language | Acts as a hard eligibility gate for language-specific runtime questions |
| Verified Practice performance | Influences future plans, placement ranking, adaptive difficulty, and recommendations |
| Interview performance | Influences blueprint topics and next-question recommendations |
| Previous question attempts | Affects retries, saved-work continuation, review scheduling, and placement scores |
| Prerequisites | Strongly influence whether a question should be recommended next |
| Target company | Used only by prompts containing a supported target-company placeholder |
| Focus areas and stories | Stored with the profile but do not currently affect Practice selection |
| Resume-generated practice questions | Stored during onboarding but are not the canonical Practice question source |
| Job description | Supported by the relevance engine, but not currently passed into the active-plan pipeline |

## Candidate Profile and Plan Generation

When a resume is uploaded, the application extracts structured evidence such as:

- Skills
- Work experience
- Projects
- Education
- Achievements
- Stories
- Resume confidence

The profile compiler normalizes this data into skills, domains, an inferred role family, an experience band, and important projects. The result is stored as a versioned candidate profile tied to a resume fingerprint.

The active interview plan then combines:

- Candidate profile
- Target role
- Aggregated interview performance
- Aggregated verified Practice evidence

If these inputs match the active plan's source snapshots, the existing plan is reused. When an input revision changes, a new immutable plan revision is generated and saved.

The plan generator is deterministic. It uses ranked candidate relevance to construct interview session blueprints and their topics; it does not generate questions.

## Practice Session Projection

Practice currently exposes four sessions:

1. DSA
2. Core Technical
3. Applied Engineering
4. Architecture and System Design

Resume and behavioral defense, along with the final mock, remain interview-only experiences. They are intentionally filtered out because Practice does not provide the live follow-up or continuous-loop behavior those sessions require.

The visible session titles, purposes, covered topics, difficulty, and estimated duration come from the candidate's active interview plan. Attempt history and completion state remain owned by Practice.

## DSA Generation

The DSA question bank is shared global content. A deterministic curation algorithm selects a frontend/full-stack learning path from that bank using chapter limits, difficulty distribution, and teaching order.

The selected DSA path is currently identical for every candidate. What differs per candidate is:

- Question progress
- Attempts
- Completion state
- Saved code
- Test results
- Verified scores
- Coaching and recommendation context

Therefore, DSA state is personalized, but DSA question selection and ordering are not currently personalized by resume, role, level, or weak patterns.

## Prep Question Placement

For non-DSA Practice, each candidate currently receives up to:

- 12 Core Technical questions
- 24 Applied Engineering questions
- 12 Architecture and System Design questions

Selection occurs in several stages.

### 1. Language Eligibility

A question with no language restriction is available to everyone. A language-bound question is only eligible when its language matches the candidate's selected editor language.

This is implemented as a strict gate because a runtime prediction question in one language is not meaningful for a candidate using another language.

### 2. Role Eligibility with Fallback

The selector first looks for questions tagged for the candidate's target role. If enough matching questions exist to fill the session, only those questions are used.

If there are not enough role-matched questions, the algorithm falls back to the broader session bank. Consequently, role is not always a strict eligibility requirement.

### 3. Candidate-Specific Ranking

Eligible questions are scored using:

- Token overlap with personalized blueprint topics
- Question format quality
- Candidate-level match
- Prerequisite readiness
- Whether the question is new
- The candidate's previous best score
- In-progress status
- Completed status

Mechanically verifiable formats receive a quality boost. `predict-run` receives the largest boost, followed by `find-the-flaw` and `diagnose`. Open prose formats receive no format bonus, and MCQs receive a penalty.

### 4. Chapter Balancing

Questions are selected with chapter round-robin balancing after they are ranked. This prevents a large topic or question bank from crowding every other topic out of a session.

### 5. Placement Persistence

The resulting per-user selection is stored as Practice placements. If the desired placement set changes because the plan or evidence changes, the placement index is recreated. The canonical progress rows and attempt history remain intact.

## Prompt Personalization

Some shared questions have an optional personalized prompt template. Supported slots are:

- `{{primaryLanguage}}`
- `{{framework}}`
- `{{projectName}}`
- `{{employer}}`
- `{{targetCompany}}`
- `{{level}}`

Prompt rendering follows an all-or-nothing rule. If the resume confidence is too low, a required slot cannot be resolved, or the template uses unsupported syntax, the generic prompt is shown instead.

Only the framing changes. The answer key and grading rules remain identical for every candidate.

There are two current limitations:

1. Only a small portion of the active Practice bank uses the supported slot syntax.
2. The `framework` value is the most frequently occurring skill across experience and projects, rather than a value semantically confirmed to be a framework.

This means it could choose a language, database, or platform for a placeholder named `framework`.

## Next-Question Recommendation

Question placement determines the candidate's session set. A separate recommendation algorithm decides which placed question should be attempted next.

The ranking generally prioritizes:

1. Weak verified attempts
2. Completed questions without verified evidence
3. Saved or in-progress work
4. Spaced reviews that are due
5. Questions connected to interview skill gaps
6. Questions matching the current adaptive difficulty
7. New roadmap questions

Unmet prerequisites receive a large penalty. Questions needed as prerequisites for other placed questions receive an additional boost.

Adaptive difficulty uses recent verified scores:

- No verified evidence starts at easy.
- Weak recent scores keep the target at easy.
- Consistently strong scores can raise the target to hard.
- Other cases target medium.

The recommendation output includes evidence codes and human-readable reasons, making the recommendation more explainable.

## Evaluation and Feedback Loop

Practice attempts are stored with source, verification status, score, content version, and evaluator version.

Evaluation differs by question format:

- DSA code runs use server-side judge results.
- Multiple-choice and runtime-prediction formats can be evaluated deterministically.
- Diagnose, flaw, and open-answer formats may use structured AI evaluation.
- Evaluation failures produce unverified evidence rather than mastery.
- A verified score at or above the passing threshold completes a Prep question.

The Practice evidence store only consumes attempts that satisfy its verification and version requirements. Those attempts are aggregated by competency, tags, or DSA pattern into skill-level evidence.

The aggregator accounts for factors including:

- Evidence volume
- Evidence age
- Difficulty
- Repeated attempts
- Hints
- Test pass rate
- Verification status

That evidence becomes a source snapshot for the next interview-plan revision. On the next Practice home load, the revised plan can cause Prep placements and recommendations to change.

This creates the adaptive loop:

```text
Attempt -> verified evidence -> skill profile -> new plan revision
        -> revised Practice placement -> next recommendation
```

## Current Seeded-State Findings

The inspected development database contained:

- 179 published Prep templates
- 11 Prep banks
- 123 questions in the curated DSA roadmap
- 48 visible Prep placements per existing candidate
- 230 provisioned progress rows per existing candidate
- 260 question templates in the current roadmap template

The existing candidate roadmaps were missing 30 newer C++, Java, and Python runtime questions. Because Prep placement candidates are read from the user's already-provisioned progress rows, those questions could not be selected for those users even though they were published.

The inspected seeded candidates had similar full-stack profiles. Their Prep placement overlap ranged from approximately 78% to 96%. Some overlap is expected for similar candidates, but these numbers show that effective differentiation is currently modest.

Each inspected candidate also had only four selected questions with working prompt personalization templates.

## Strengths

The current implementation has several strong foundations:

- Authored, reviewable shared question content
- Stable answer keys across candidates
- Immutable and versioned profile, plan, and evidence snapshots
- Deterministic selection and tie-breaking
- Server-side ownership checks
- Content and evaluator version tracking
- Idempotent attempt writes
- Per-owner database advisory locks
- Verified-evidence boundaries
- Chapter-balanced placement
- Mechanically verifiable formats prioritized over weaker recognition formats
- Placement recomputation without deleting canonical attempt history
- Explainable next-question recommendation reasons

These are valuable qualities for fairness, debugging, replay, and long-term analytics.

## Critical Issues

### 1. Retired Sessions Are Still Provisioned

Practice intentionally exposes only four sessions, but the roadmap seed still provisions questions for `resume-behavioral-defense`.

These hidden questions remain part of canonical user progress and roadmap totals. As the global next-question calculation moves through unfinished progress, it can eventually select a retired resume question and produce a Practice route that the visible Practice application does not support.

This can also prevent the roadmap from reaching a clean completion state.

### 2. Existing Users Do Not Reliably Receive New Questions

Roadmap freshness currently checks the template version and number of sessions. It does not compare the actual question set.

Question progress is provisioned with `createMany({ skipDuplicates: true })` and a global numeric order. Inserted or reordered template questions can conflict with existing order values and be skipped instead of reconciled.

This is the reason existing users can have fewer provisioned questions than the active template and never see newly published language-specific content.

### 3. Resume Confidence Uses Incompatible Scales

Resume extraction stores a rounded confidence value on a 0-100 scale. Prompt personalization compares that value against `0.6`.

As a result, almost every non-zero production confidence passes the personalization threshold. The system should either:

- Store and use confidence consistently on a 0-1 scale, or
- Keep the production 0-100 scale and use a threshold such as `60`.

### 4. The Canonical Roadmap Role Is Always Full Stack

The roadmap service provisions the fixed role `fullstack`. Onboarding eagerly provisions it only for full-stack candidates, but opening Practice can lazily create it for other onboarded roles.

This can produce role-specific session language on top of a frontend/full-stack underlying curriculum.

### 5. Level Is Not an Eligibility Gate

Question templates contain supported levels, but level currently contributes only a ranking bonus. A question outside the candidate's level can still be selected.

If the intended design treats roles and levels as the first personalization tier, level should become an eligibility rule with an explicit fallback policy.

### 6. Prompt Personalization Has Limited Coverage

Only a small number of active Practice templates use the supported `{{slot}}` syntax. Several templates use an older placeholder style and therefore fall back to the generic prompt.

Target company also affects only these templates; it does not affect question selection or plan relevance.

### 7. Candidate Profile Reuse Can Miss Non-Resume Changes

The compiled candidate profile is primarily identified by owner, resume fingerprint, and schema version. If role or experience-level inputs change without the resume changing, some normalized profile data can remain based on the earlier compilation.

Profile identity or invalidation should include every input that materially affects compiled output.

### 8. Documentation Is Stale

`QUESTION_BANK_INVENTORY.md` currently lists only two Prep banks and describes non-DSA sessions as placeholders. The implementation now has 11 Prep banks and substantial active non-DSA content.

Leaving this document unchanged risks future development and agent work being based on an obsolete product state.

## Recommended Implementation Order

### Priority 0: Restore Data Correctness

1. Remove retired Practice sessions from the canonical roadmap template.
2. Migrate existing user totals, session progress, chapter progress, and hidden question progress.
3. Recalculate each affected user's current session, next question, and completion percentage.
4. Add an integration test proving that completing all visible Practice questions completes the roadmap.

### Priority 1: Make Template Evolution Reliable

1. Reconcile progress using stable question-template identity rather than global order.
2. Insert newly published questions for existing users.
3. Update metadata and ordering for existing rows without overwriting attempts.
4. Define a retirement policy for unpublished or removed questions.
5. Increment the roadmap template version whenever session, chapter, or question membership changes.
6. Backfill the missing runtime questions for existing users.

### Priority 2: Correct Personalization Contracts

1. Normalize the resume-confidence scale.
2. Make role and level eligibility rules explicit.
3. Include target role and selected level in candidate-profile invalidation.
4. Decide whether DSA is intentionally shared or should adapt by role and demonstrated pattern weakness.

### Priority 3: Improve Personalization Quality

1. Convert legacy prompt placeholders to the supported syntax.
2. Validate slot semantics so `framework` resolves only to a framework.
3. Select the resume project or employer most relevant to the question rather than always using the first entry.
4. Decide whether target company and job-description evidence should affect selection.
5. Add skill aliases and normalization to improve topic matching beyond exact token overlap.
6. Consider pinning the current question while placements adapt so an in-progress URL cannot disappear.

### Priority 4: Documentation and Tests

1. Update `QUESTION_BANK_INVENTORY.md` from the current seed source.
2. Add tests for template version changes and new-question backfills.
3. Add production-scale resume-confidence tests.
4. Add coverage assertions for valid prompt templates.
5. Add tests for non-full-stack candidates opening Practice.
6. Add a test ensuring hidden interview-only sessions never affect Practice totals or navigation.

## Final Assessment

The Practice system has a good core model: shared high-quality content, candidate-specific selection, immutable evidence, deterministic recommendations, and a closed performance-feedback loop.

The main weakness is not the ranking algorithm. It is the lifecycle around roadmap templates and existing user data. Until that is corrected, newly seeded questions may not reach existing users, retired questions can remain in progress totals, and the UI can present a more personalized experience than the underlying placements deliver.

The intended long-term model should remain:

```text
Shared reviewed questions
        +
Strict candidate eligibility
        +
Evidence-based candidate selection
        +
Safe resume-based framing
        +
Verified adaptive recommendations
```

That provides personalization without sacrificing grading consistency or question quality.

## Relevant Implementation Files

- `src/app/api/onboarding/resume/route.ts`
- `src/app/api/onboarding/complete/route.ts`
- `src/server/interview/candidate-profile-compiler.ts`
- `src/server/interview/personalized-planning-store.ts`
- `src/server/interview/personalized-interview-planning.service.ts`
- `src/server/interview/personalized-plan-generator.ts`
- `src/server/interview/relevance-engine.ts`
- `src/lib/practice/practice-roadmap.ts`
- `src/server/practice/practice-roadmap.service.ts`
- `src/server/practice/practice-question-placement.ts`
- `src/lib/practice/prompt-personalization.ts`
- `src/server/practice/prep-practice-recommendation.ts`
- `src/server/practice/practice-evidence-store.ts`
- `src/server/practice/practice-evidence-aggregator.ts`
- `src/server/roadmap/frontend-roadmap/service.ts`
- `src/server/dsa/dsa.service.ts`
- `src/lib/roadmap/frontend-plan.ts`
- `prisma/seed.ts`
