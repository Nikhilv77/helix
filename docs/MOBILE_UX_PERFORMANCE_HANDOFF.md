# Mobile UX and Performance Handoff

## Purpose

Use this document when continuing the mobile polish pass on Trailgrad pages that have not yet been reviewed.

The goal is not to make the product visually minimal. The goal is to preserve Trailgrad's expressive experience while removing genuine sources of mobile lag and making the typography feel like a mature enterprise application.

Work one route or user journey at a time. Inspect the rendered mobile page when a browser session is available, make the smallest useful changes, and verify the result before moving to the next page.

## Product Direction From the User

- Keep the experience visually rich.
- Do not remove animations or transitions merely because a phone is being used.
- Restore or preserve the original animation when its cost is small and bounded.
- The user prefers larger typography. Supporting text must not become tiny or cramped.
- Headings may be tightened slightly when necessary, but primary supporting copy should remain comfortably readable.
- Preserve the existing dark graphite, cream, and orange visual language.
- Avoid blurry avatar substitutes or visibly degraded assets.
- Performance work should be targeted at a demonstrated or technically credible bottleneck.

## Typography Rules

Treat these as starting points, not universal replacements:

| Role                            | Mobile target | Notes                                                        |
| ------------------------------- | ------------: | ------------------------------------------------------------ |
| Major page heading              |       32–40px | Larger is welcome when the line length still fits naturally. |
| Section heading                 |       28–36px | Prefer compact tracking and balanced wrapping.               |
| Card title                      |       24–28px | Do not reduce important card titles to 18–20px.              |
| Introductory copy               |       18–20px | Use a generous line height around 1.6–1.7.                   |
| Main supporting copy            |       16–18px | This is the minimum readable product layer.                  |
| Buttons and primary actions     |          16px | Use at least a 44–48px touch target.                         |
| Metadata, dates, counts, labels |       12–14px | These may remain compact because they are secondary.         |

Additional guidance:

- Large text should not mean dense text. Maintain comfortable max widths and vertical spacing.
- Supporting text should usually use `text-wrap: pretty`; large headings may use `text-wrap: balance`.
- Avoid extremely light font weights on dark backgrounds.
- Keep text contrast high enough that larger type does not still feel faint.
- Do not globally shrink text to solve a local wrapping problem. Fix the local width, spacing, or copy layout instead.

## Performance Decision Rules

### Usually safe to preserve

These effects are normally inexpensive when used on a modest number of elements:

- One-time opacity and transform entrances.
- Staggered cards or words.
- Short progress fills using `transform: scaleX()`.
- Small waveform bars using `transform: scaleY()`.
- Hover and press transitions.
- A short text shine over a small area.
- Timers that update a few times during a bounded onboarding sequence.
- Browser-native smooth scrolling when it is part of the intended experience.

Do not remove these without evidence that they are contributing to a real problem.

### Inspect carefully

These can be expensive depending on their size, duration, and surrounding content:

- `filter: blur()` animated across many or large elements.
- Large `backdrop-filter` surfaces, especially while the background is moving.
- Infinite `background-position`, gradient, or mask animations that repaint every frame.
- Many simultaneous box shadows over large translucent surfaces.
- Large sticky scenes that update React state continuously while scrolling.
- High-frequency pointer, resize, or scroll handlers that are not throttled with `requestAnimationFrame`.
- Large SVG scenes whose many children animate continuously.

Prefer narrowing the affected area, pausing the animation offscreen, or updating only when a discrete state changes before removing the effect entirely.

### Genuine high-priority risks

- WebGL or 3D render loops running at full device-pixel ratio and 60fps while idle.
- Multiple WebGL canvases mounted at the same time.
- Recreating a renderer, scene, environment, or large model on every selection change.
- Videos or canvases continuing to render while offscreen or while the tab is hidden.
- Unbounded intervals, requestAnimationFrame loops, or event listeners.
- Main-thread work running on every scroll event.
- Large decoded images or models loaded when they are not visible or needed.

For these cases, use adaptive frame rates, renderer reuse, visibility gating, explicit disposal, and low-power lighting/rendering profiles while keeping the visible experience sharp.

## Completed Scope

The following areas have already received a mobile pass. Inspect the current uncommitted diff before touching them; do not redo or revert the work casually.

### Marketing

- Marketing home hero and sections.
- Marketing navigation and footer surfaces.
- Blog index and blog article typography.
- Privacy and Terms typography.
- Mobile animation pausing and cheaper rendering where appropriate.

Main supporting copy currently follows a larger readable scale:

- Marketing descriptions: approximately 18–20px.
- Blog and legal introductions: approximately 18–20px.
- Blog and legal reading copy: approximately 17–18px.

### Authentication

- The decorative wave/ring structure behind the Clerk sign-in and sign-up UI was removed.
- The quiet dark gradient remains.

### Onboarding

- Teacher selection received the important WebGL performance work.
- Experience-level selection retains its larger original typography and staggered experience.
- Resume upload has larger typography and touch targets.
- Resume identity, evidence, and readiness steps have larger headings, card titles, supporting text, and actions.
- The original post-upload motion experience was restored on mobile: shimmer, waveform, blurred word entrances, card blur/lift, action nudge, and smooth automatic scrolling remain.

Do not replace live teacher avatars with blurry static portraits. The center avatar remains live and sharp. Side avatars only mount where the device and pointer context can support them.

### Dashboard welcome

- The post-onboarding teacher walkthrough uses a dedicated `welcome` WebGL profile.
- Touch devices render the live avatar at a 1.5 device-pixel-ratio cap, 30 FPS while speaking, and 15 FPS while idle. Lower-end devices use 24/10 FPS, and touch canvases park on their last sharp frame after eight idle seconds.
- The word-by-word entrance remains, but its highlight shimmer completes once instead of repainting every word indefinitely.
- Touch devices use a static accent wash and opaque modal/card surfaces instead of large ambient blur layers and full-panel backdrop filters.
- Desktop keeps the richer blur treatment and a live avatar profile capped below unrestricted display refresh.

### Reports overview

- PDF generation is imported only after Download is pressed, keeping the PDF/font/compression stack out of the initial `/reports` route bundle.
- The live teacher uses the dedicated `report` WebGL profile: touch devices cap DPR and speaking/idle frame rates, then park after an extended idle period.
- On coarse-pointer devices, the two ambient glows become broad static radial gradients, the teacher speech card is transparent without backdrop blur or shadow, the redundant rectangular avatar-soften overlay is removed, and the CTA sheen stops after three passes. Other report cards retain their opaque graphite surfaces.
- Interview sessions persist a transcript-free report snapshot. `/reports` reads up to 50 compact snapshots rather than 50 complete session-state JSON documents, while older sessions are backfilled on their first report read.
- The latest overview report sent to the browser has no transcript; `/reports` is now the canonical report surface.
- The 390×844 coarse-pointer check had no horizontal overflow or console errors.
- The obsolete `/session/:sessionId` curriculum page and `/sessions/:sessionId` interview-report page were removed. Completed-interview links now resolve to the canonical `/reports` experience.

### Progress

- Opening a question without solving it no longer produces a misleading pace/continuity briefing. The simple starter state remains until the first completed question.
- `/progress` now uses a compact briefing read that selects only the roadmap completion count and 126 days of attempt status/timestamps for streak calculation, then sends just seven daily activity rows to the client. The full roadmap, question metadata, chapter/session rows, analytics buckets, recent-attempt feed, and interview competency map are no longer serialized into a UI that does not render them.
- Interview coaching reads the same transcript-free report snapshots used by `/reports` instead of loading up to 30 complete interview states.
- Returning users no longer execute the full frontend DSA-plan query because starter question cards are only needed before practice begins.
- The live teacher remains sharp and uses the bounded `report` WebGL profile. The existing coarse-pointer glow rules remove large blur filters around it.
- On coarse-pointer devices, the Maya briefing and starter cards use opaque graphite without backdrop blur or layered shadows. The CTA sheen stops after three passes.
- Maya's visible coaching stays detailed, while the automatically spoken summary is compact. In the local 390px trace, its encoded audio response fell from about 212 KB to 57 KB.
- The settled five-second touch trace used about 0.24 seconds of task time and no measurable layout time. The page had no horizontal overflow.
- The old `RoadmapCharts` component is not imported by `/progress`; its large analytics-card images were confirmed absent from the route's network activity.

### Workspace sidebar

- Primary navigation is approximately 15px with 44px rows; section labels and account metadata were raised for clearer hierarchy.
- The Trailguide promotion uses a larger title and approximately 13px supporting copy with a more comfortable line height and contrast.
- The opaque full-height icon rail no longer requests a visually redundant backdrop blur.
- Sidebar behavior, width, collapse state, and navigation structure are unchanged.

## Important Existing Onboarding Optimizations

The most significant work is in:

- `src/components/interview/voice/avatar-stage.tsx`
- `src/components/onboarding/steps/teacher-step.tsx`

The avatar stage now uses adaptive performance profiles, renderer reuse, visibility gating, lower idle frame rates, low-end-device detection, renderer/model disposal, and a parked sharp frame after extended idle on weaker phones.

Preserve these behaviors unless a replacement has been tested and is measurably better.

Other relevant files include:

- `src/components/onboarding/flow/onboarding-flow.tsx`
- `src/components/onboarding/steps/level-step.tsx`
- `src/components/onboarding/steps/resume-upload-step.tsx`
- `src/components/onboarding/resume-review/resume-identity-step.tsx`
- `src/components/onboarding/resume-review/resume-evidence-step.tsx`
- `src/components/onboarding/resume-review/resume-readiness-step.tsx`
- `src/components/onboarding/shared/onboarding-ui.tsx`
- `src/app/globals.css`

## Recommended Next Scope

Continue from the signed-in dashboard and then follow the primary user journey:

1. `/` dashboard overview after the completed post-onboarding teacher welcome pass.
2. `/practice` and chapter overview pages.
3. `/interviews` and interview-mode selection.
4. `/interview/dsa` entry and readiness screens.
5. `/dsa-questions/:slug` practice workspace.
6. `/interview/voice` and other live interview rooms.
7. `/profile`, `/mentors`, and remaining secondary routes.

Do not expand the scope into feature redesigns unless the user asks. This pass is for mobile layout, typography, interaction quality, and credible performance issues.

## Per-Page Workflow

### 1. Establish the original experience

- Open the page at desktop and common phone widths when browser testing is available.
- Identify the intended hierarchy, motion, and interaction sequence.
- Note what must remain recognizable after the mobile pass.

### 2. Audit the source

Check for:

- Continuous render or animation loops.
- Scroll handlers and state updates.
- Large blur/backdrop-filter regions.
- Multiple mounted heavy scenes.
- Images, canvases, videos, and 3D assets.
- Layout overflow at 320px, 375px, 390px, and 430px widths.
- Buttons smaller than a comfortable touch target.
- Supporting text below 16px when it is important to understanding the page.

### 3. Classify each effect

For every animation or transition, decide whether it is:

- Bounded and cheap: preserve it.
- Bounded but paint-heavy: preserve unless testing shows a problem.
- Infinite but small/compositor-only: usually preserve it.
- Infinite and paint-heavy: pause offscreen or reduce its affected area.
- A true render loop: adapt frame rate, pause when idle/offscreen, and reuse resources.

Do not use a blanket mobile rule that disables unrelated motion across the entire application.

### 4. Improve typography locally

- Preserve large, confident headings.
- Increase explanatory and supporting copy before increasing metadata.
- Keep card titles prominent.
- Use page-specific classes when a global typography change would harm other screens.
- Check wrapping with real long names, resume titles, skills, and error messages.

### 5. Verify behavior

Test or inspect:

- Initial load.
- Scrolling.
- Opening and closing menus or dialogs.
- Selecting cards and changing steps.
- Loading, empty, success, and error states.
- Keyboard focus and touch targets.
- Reduced-motion behavior.
- Tab visibility and offscreen behavior for animated media.

## Validation Commands

Run these after a meaningful page pass:

```bash
pnpm lint
pnpm exec tsc --noEmit
git diff --check
pnpm build
```

Run focused tests for any logic that changed. Run the broader Vitest/Jest suites when shared runtime, onboarding flow, rendering, or persistence logic changes.

The Next.js production build may rewrite `next-env.d.ts` from:

```ts
import "./.next/dev/types/routes.d.ts";
```

to:

```ts
import "./.next/types/routes.d.ts";
```

Restore the development import after the build unless the user intentionally changed it. Use `apply_patch`; do not discard unrelated worktree changes.

## Worktree Safety

The current worktree contains intentional uncommitted changes from this mobile pass.

- Always inspect `git status --short` and the relevant `git diff` before editing.
- Treat every unrelated modification as user-owned.
- Do not run `git reset --hard`, `git checkout --`, or other destructive cleanup commands.
- Make focused patches and avoid broad formatting rewrites.
- Do not overwrite existing typography or performance work without explaining the tradeoff.

## Definition of Done for a Page

A page is ready to hand off when:

- It has no horizontal overflow at common phone widths.
- Important supporting copy is at least 16px and comfortably spaced.
- Primary actions have a 44–48px touch target.
- Existing visual character and useful motion remain.
- Heavy media pauses or reduces work when idle, hidden, or offscreen where applicable.
- No continuous React state update occurs merely to drive a visual that CSS can handle.
- Loading, empty, success, and error states remain readable.
- Lint, TypeScript, diff checks, and a production build pass.
- Any limitation in real-device or browser verification is stated honestly.
