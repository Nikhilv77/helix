# New Onboarding and Adaptive Practice

## Core idea

Trailgrad is built around one coaching loop:

> **FIND → FIX → PRACTICE → PROVE**

The candidate’s target defines what matters. Their performance decides what Trailgrad teaches next.

- **Find:** understand the resume, target role, level, timeline, and starting ability.
- **Fix:** identify the highest-value gap against that interview bar.
- **Practice:** assign a small focused block instead of a giant mandatory course.
- **Prove:** verify improvement through working solutions and interviews.

The resume provides context, not proof. The onboarding assessment provides a directional starting point. Verified practice eventually becomes the stronger source of truth.

## Preparation onboarding

After account and resume setup, the candidate provides:

1. Target role and seniority
2. Interview timeline
3. Preparation priorities
4. Optional target company
5. A short baseline covering DSA, core technical knowledge, applied engineering, and architecture

Trailgrad suggests a coding preparation track from the resume: focused frontend, backend, data, and AI/ML evidence selects the matching track, while mixed full-stack or irrelevant non-coding evidence falls back to Full Stack. The candidate confirms or changes that suggestion before the baseline begins.

The baseline does not display a fake readiness score. It records signals such as **familiar**, **needs refresh**, **unknown**, or **needs foundations**. Assigned baseline questions are stored as candidate-specific snapshots so refreshes or question-bank changes cannot alter an assessment in progress.

For DSA placement, the objective checks set the upper and lower bounds. Self-reported familiarity only distinguishes candidates in the middle band, so confidence alone cannot unlock the advanced path and an overly modest self-report cannot erase strong performance. The code-reading signal combines both code-reading checks.

## Dashboard behavior

Immediately after onboarding, the selected teacher summarizes the resume and assessment together: what already looks strong, what needs attention, and why the first recommendation matters.

Before the first verified solve, this is presented as a **starting profile**, not measured readiness. After real practice begins, the same dashboard cards switch to evidence-backed coaching.

- Fresh account: starting strength, priority gap, and first action
- Active work: resume the current problem or interview
- Verified performance: progress, demonstrated weakness, and next action

The layout stays consistent; the evidence and wording evolve.

## Adaptive DSA practice

Practice separates a small personalized block from **Explore all DSA**. The full 200-question library remains available, but it is not treated as a mandatory checklist.

The selector considers role, seniority, interview date, onboarding signals, topic familiarity, question status, verified scores, confidence, hints, and retries.

| Starting tier |       Block | Purpose                                      |
| ------------- | ----------: | -------------------------------------------- |
| Foundations   | 8 questions | More easy questions and a broader path       |
| Building      | 8 questions | Mostly medium with guided difficulty growth  |
| Advanced      | 7 questions | Mostly medium/hard verification              |
| Unknown       | 6 questions | Diagnostic block before committing to a path |

The estimated total path can range from a short senior-focused route to most or all of the library. These are adaptive estimates, not permanent curricula.

### Stable block behavior

A recommended block is saved as a cohort and does not reshuffle after every action.

- Solved questions remain visible inside the current block.
- Skipped questions remain visible with **Skipped · Learn & retry**.
- Completing every saved question makes that block's assessment available; it does not immediately replace the block.
- The next block is selected only after that block's assessment is completed.
- Opening a question outside the curated roadmap enrolls it only when needed.

This keeps the experience predictable while still allowing future blocks to react to performance.

## End-of-block assessment

Every saved recommended DSA block owns exactly one teacher-led assessment. The assessment is part of the block lifecycle, not a separate generic DSA interview. Completing the assessment—not reaching a passing threshold—unlocks the next block. Its evidence then determines whether the following block reinforces a pattern, emphasizes efficiency or edge cases, or advances difficulty.

The assessment opens only after every question in its saved cohort is verified complete. It is a 35–40 minute session with four parts:

1. Five or six rapid, grounded candidate-code review questions.
2. One unseen authored transfer coding problem.
3. A second unseen authored transfer coding problem.
4. Brief teacher follow-ups and a wrap-up.

The code-review questions are drawn from the candidate's verified submissions in the current block. They use an exact saved snippet and ask practical interview questions: what a section does, the resulting complexity, an input or edge case that could fail, why a data structure was chosen, or how the implementation could be improved. They should cover several block problems and patterns rather than repeat one issue.

Candidate-specific review questions may be generated only when their answer is grounded in saved execution evidence, an authored reference solution, or deterministic static analysis. Open-ended discussion remains useful, but it is not automatically scored unless it has reliable, snapshotted scoring evidence. The two transfer problems remain authored questions and should normally be unseen by the candidate. The first prioritizes the block's weakest or most important pattern at the appropriate difficulty; the second checks another important pattern or a calibrated stretch. Reusing a completed block problem is a last resort.

At the moment the assessment becomes ready, Trailgrad saves an immutable assessment snapshot: the block and recommendation snapshot, source submission and code snippet for every review question, prompts and answer/rationale where applicable, both coding-question slugs and metadata, selected rubric version, and teacher/session configuration. A later question-bank, recommender, or code change must never change an in-progress or completed assessment.

The completed session reports five separate rubric scores:

- Pattern recognition
- Correctness and edge cases
- Time and space efficiency
- Code quality
- Communication

Correctness must be grounded primarily in hidden-test and submitted-solution evidence; a language-model explanation cannot override failed execution evidence. The assessment can combine review answers, submitted code, execution results, written approach, and transcript evidence, but communication is scored from the conversation rather than MCQ accuracy alone.

No placeholder scores are shown. Scores and the teacher report appear only after the assessment produces evidence. The assessment card has four explicit states:

- **Locked:** the saved block still has questions remaining and shows how many.
- **Ready:** all block questions are complete and the candidate can start the assessment.
- **In progress:** an existing session can be resumed without creating another assessment.
- **Complete:** scores, report, and the next-block action are available.

The preview uses the candidate’s selected teacher, including a matching HD headset portrait for all ten teachers. Until the block is complete, clicking the card nudges it and shows a centered notification explaining why the assessment is unavailable and how many problems remain.

After a completed assessment, the candidate first sees the finished block's real scores and teacher feedback, then chooses **Continue to your next block**. The next block may already be generated, but it must not replace the result before that handoff.

## Block history and assessment reports

The practice area is a block viewer. It defaults to the newest active block, while previous and next navigation render older or newer blocks in the same area rather than moving the candidate to a different experience. The selected block is represented in the URL, for example `/practice/dsa?block=<blockId>`, so browser navigation and saved links behave correctly.

Past blocks are immutable and remain accessible through that pagination/navigation. Their view includes the original recommendation and question cohort, per-question status, assessment date and duration, five scores, teacher summary, strengths and improvement areas, assessment problems, and a link to review the assessment report/transcript. They are historical evidence and must never be recalculated using the current recommendation or question bank.

## Assessment implementation checklist

1. Add durable block and assessment lifecycle records, IDs, statuses, and immutable snapshots.
2. Change stable-block progression so completion makes an assessment ready and only an assessed block can roll forward.
3. Build idempotent assessment creation that selects, grounds, and snapshots the five-to-six review questions and two authored transfer problems.
4. Extend the interview runtime to run the block-specific review and coding rounds in the existing voice, editor, and transcript experience.
5. Finalize sessions atomically, calculate and persist the five rubric scores, and feed the resulting evidence into the next recommendation.
6. Replace the preview-only card with locked, ready, in-progress, and complete states; add same-area block history, URL navigation, reports, and transcript access.
7. Add migrations, regression coverage, and end-to-end verification for lifecycle, resume, snapshot integrity, scoring, adaptation, and historical rendering.

## Evidence loop

```text
Resume + target + baseline
            ↓
Personalized practice block
            ↓
Verified solves and code evidence
            ↓
Teacher block assessment
            ↓
Updated focus, difficulty, and path length
```

Personalization selects and frames authored questions; it does not invent an unreviewed private bank for each candidate.

Core transfer coding problems remain authored. Candidate-specific code-review questions are allowed only when they are grounded in the candidate's verified submission evidence and saved as assessment snapshots.

## Main code

- `src/lib/preparation/preparation-onboarding.ts` — onboarding contracts and skill signals
- `src/server/preparation/preparation-onboarding-state.ts` — baseline transitions and interpretation
- `src/server/preparation/preparation-onboarding.service.ts` — durable onboarding and question snapshots
- `src/lib/dashboard/dashboard-overview.ts` — dashboard state and personalized coaching copy
- `src/lib/practice/dsa-recommendation.ts` — deterministic DSA ranking, tier, and difficulty mix
- `src/server/dsa/stable-dsa-recommendation.ts` — saved block lifecycle
- `src/components/workspace/dsa/dsa-topics.tsx` — recommended block and full library
- `src/components/workspace/dsa/block-assessment-preview.tsx` — assessment preview, criteria, nudge, and notification
- `public/images/teacher-portraits/assessment-headsets/` — teacher-specific assessment portraits

## Current status

Implemented: preparation onboarding, personalized first dashboard, adaptive DSA selection, stable recommended blocks, retained solved/skipped questions, full-library exploration, verified practice evidence, and the assessment preview.

Next: implement the seven assessment phases above: durable lifecycle and snapshots, assessment-specific interview rounds, evidence-backed scoring and adaptation, block-history navigation, then full regression and end-to-end verification.
