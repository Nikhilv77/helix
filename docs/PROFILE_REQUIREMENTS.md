# Profile and Resume Update Requirements — Phase 1

## 1. Purpose

Allow an existing user to replace their active resume safely. This phase updates only:

- The active resume and its extracted evidence.
- Resume-derived information displayed in Profile.
- Resume Roast state and history.

This phase must not generate, refresh, supersede, invalidate, or otherwise mutate Practice plans, Interview plans, Practice progress, Interview history, Dashboard progress, or learning recommendations. Those areas will be redesigned separately.

The product must treat a resume as the user's current career context, not as proof of what the user has mastered.

## 2. Product Principles

1. Replacing a resume must never erase user history.
2. No active resume or profile mutation may occur until the user reviews and confirms the update.
3. User-controlled profile fields must not be overwritten by resume-derived suggestions.
4. The user's target role, level, company context, preferences, and teacher must not change silently.
5. Practice and Interview data must remain completely untouched by this phase.
6. Old Resume Roasts must remain historical and must never appear as analysis of the new active resume.

## 3. User Experience

### 3.1 Entry point

- Show an **Update resume** action on the Profile page when a resume already exists.
- Before upload, explain: **Your resume evidence and Resume Roast will use the new file. Your Practice progress, Interview history, plans, reports, scores, and streaks will not change.**
- Keep the existing **Upload resume** action for users without a resume.

### 3.2 Upload and preview

Analyze the uploaded file in preview mode without changing persisted profile state. Show:

- Skills added.
- Skills no longer mentioned.
- Experience entries added, removed, or changed.
- Projects added, removed, or changed.
- Education, certification, achievement, seniority, and leadership-signal changes.
- Any resume-derived headline, bio, role, or level suggestions.

Do not describe Practice or Interview plans as being refreshed in this phase.

The user must have two actions:

- **Confirm update** — saves and activates the resume version.
- **Cancel** — discards the preview and changes nothing.

### 3.3 Target handling

- Preserve the user's existing target role, level, company, and target date by default.
- Do not replace target settings with values inferred from the new resume.
- A different inferred role or level may be shown as a suggestion only.
- Adopting a suggested target must be a separate explicit profile action and is outside the resume-confirmation transaction.
- Resume replacement must not create a new learning track in this phase.

### 3.4 Profile-field handling

After confirmation, update the resume-derived Profile area with:

- Resume file metadata.
- Candidate name extracted from the resume.
- Extracted skills.
- Work experience and project evidence.
- Education, certification, and achievement evidence.
- Resume warnings, confidence, document summary, and evidence summary.

Preserve all user-controlled fields exactly as they were:

- Profile image and cover image.
- Manually edited headline and bio/context.
- Focus areas and stories.
- Target role, level, company, and date.
- Teacher selection, notification settings, workspace appearance, and preferences.

Resume-derived alternatives to manual fields must be presented as suggestions. They may be adopted only through an explicit user action.

## 4. Resume Versioning

- Store each distinct confirmed resume as an immutable version.
- Keep an explicit active-resume-version reference for the user.
- Retain previous resume versions for history and Resume Roast attribution.
- Store a content fingerprint for every version.
- Confirming the already-active file must be an idempotent no-op.
- Re-uploading a file that matches a historical version must reuse that immutable version rather than create a duplicate.
- A failed or cancelled update must leave the previous active version unchanged.
- Resume version records must not be deleted merely because a newer version becomes active.

## 5. Confirmation Transaction

Confirmation must atomically:

1. Create or resolve the immutable resume version by fingerprint.
2. Set it as the active resume version.
3. Update the resume-derived Profile projection.
4. Preserve every user-controlled Profile field.

The transaction must not:

- Clear the current curriculum or roadmap.
- Generate or supersede a Practice plan.
- Generate or supersede an Interview plan.
- Rewrite Practice placements or progress.
- Mark Practice or Interview data stale.
- Delete or rewrite reports, attempts, notes, transcripts, scores, or streaks.

Retrying the same confirmation request must be idempotent.

## 6. Resume Roast Behavior

- Every new roast must reference the active resume version it analyzed.
- The current Resume Roast lookup must filter by both user and active resume version.
- After a different resume becomes active, do not show an older resume's roast as the current result.
- When no roast exists for the active resume, show the fresh empty Roast experience.
- When a roast exists for the active resume, show its saved result and offer **Run fresh analysis**.
- Keep old roasts in history and label them with their resume version, file name, or analysis date.
- Changing resumes must not delete old roasts.
- Roast generation remains persistence-backed; caching must not substitute for saved history.
- A failed roast generation must not replace the latest successful roast for that resume version.

## 7. Practice and Interview Isolation

Resume confirmation must produce no Practice or Interview plan writes.

Specifically, it must not:

- Call plan-generation or plan-reconciliation services.
- Supersede an active personalized Interview plan.
- Rebuild Practice placements.
- Transfer progress between topics.
- Change completed or in-progress work.
- Change Interview sessions, transcripts, reports, scores, or feedback.
- Change Dashboard or Progress calculations.

Whether and how a resume update should influence future Practice and Interview planning will be defined in a later design. This phase must not make that decision implicitly.

## 8. Processing and Failure States

- Resume parsing and preview must not mutate persisted profile data.
- Show a clear analysis-in-progress state during preview generation.
- Disable duplicate confirmation while a confirmation request is active.
- Switch the active resume and current Roast context only after the confirmation transaction commits.
- If parsing, persistence, or confirmation fails, retain the previous active resume and Profile projection.
- A failure must not trigger Practice or Interview work.
- Cancellation must abort pending analysis where possible and discard all preview state.
- Error messages must distinguish invalid files, parsing failures, timeouts, rate limits, and persistence failures.

## 9. Existing-System Considerations

The current implementation has useful foundations:

- `/onboarding?replace=resume` already opens a resume-replacement flow.
- Resume upload already returns a preview before the completion request.
- Candidate profile versions can provide immutable normalized snapshots.
- Resume Roast records already reference candidate profile-version IDs.

The replacement path still requires dedicated handling:

- It currently hard-codes a `fullstack` role instead of retaining the user's target.
- It reuses general onboarding completion, which overwrites manual fields and clears profile and cover images.
- `CandidateProfile` currently stores one mutable resume projection without an explicit active resume-version relation.
- Candidate-profile snapshot creation currently has Interview-plan supersession side effects; Resume Roast and resume replacement must use a side-effect-free versioning path.
- The latest Resume Roast lookup currently filters only by owner, not by the active resume version.
- Users with an existing resume need a reachable **Update resume** action in Profile.
- The preview must compare the active resume with the proposed version instead of showing only the new extraction.

## 10. Non-Goals

This phase will not:

- Generate, refresh, reconcile, or supersede Practice plans.
- Generate, refresh, reconcile, or supersede Interview plans.
- Change Practice or Interview recommendations.
- Create a new learning track.
- Change Dashboard or Progress calculations.
- Transfer, reset, or reinterpret learning progress.
- Treat resume claims as verified mastery.
- Automatically change target settings or manual Profile fields.
- Delete previous resumes or Resume Roasts.

## 11. Acceptance Criteria

1. A user with an existing resume can start an update from Profile.
2. The page clearly states that Practice and Interview data will remain unchanged.
3. Uploading and analyzing a resume changes nothing until confirmation.
4. The preview compares the proposed resume with the active resume.
5. Cancelling or failing the update leaves the active resume and Profile unchanged.
6. Confirmation creates or reuses an immutable resume version and makes it active atomically.
7. Confirming the same file repeatedly does not create duplicate versions.
8. Resume-derived Profile evidence reflects the active resume after confirmation.
9. Images, headline, bio/context, focus areas, stories, targets, teacher, notification settings, and preferences are preserved.
10. Resume replacement performs no Practice-plan, Interview-plan, Practice-progress, Interview-history, Dashboard, or Progress writes.
11. A roast belonging to an older resume is never presented as the current resume's roast.
12. Old Resume Roasts remain available as history with version or date attribution.
13. A fresh roast can be generated and saved against the new active resume version.
14. Automated tests prove manual-field preservation, idempotent confirmation, active-version scoping, Roast isolation, and zero Practice/Interview mutations.
