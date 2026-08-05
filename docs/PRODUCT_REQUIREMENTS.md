# Helix Product Requirements

This is the living requirements document for Helix. Keep adding decisions here so future agents understand the product direction before editing code.

## Product Goal

Helix helps candidates turn their real resume evidence into stronger interview answers.

The product should not feel like a generic mock interview generator. It should feel like Maya read the user's resume, noticed what could be questioned, and is training the user to defend those claims clearly.

## Current Product Promise

Helix turns a resume into focused interview practice that exposes weak, vague, or unsupported answers before a real interviewer does.

## Scope Principle

Improve the existing product surfaces before adding new feature areas.

Current surfaces:

- Home
- Onboarding
- Profile
- Profile edit
- Resume evidence
- Practice
- Progress
- Reports
- Interview session

Avoid building large new systems unless they directly improve one of these surfaces.

## Primary User Loop

1. User signs in or starts onboarding.
2. User selects target role and experience level.
3. User uploads resume.
4. Helix extracts identity, timeline, projects, education, skills, and evidence.
5. Helix creates a focused practice plan from the user's actual evidence.
6. User practices with Maya.
7. Maya probes vague answers and challenges unsupported claims.
8. User receives a clear report with what to fix.
9. Home, Progress, and Reports reflect what the user should practice next.

## Product Value Rules

Every generated item should answer one of these:

- What real resume evidence is this based on?
- What interview risk does this expose?
- What should the user practice next?
- How did the user's answers improve or fail?

Avoid filler content such as generic motivational cards, generic session names, or broad interview advice that is not tied to the user's profile.

## Existing Screens

### Home

Purpose: show the user's next best action.

Home should make the user immediately understand:

- Maya is ready to practice.
- What the current focus area is.
- Which session should be opened next.
- Why that session matters.
- What evidence or weakness it is based on.

Preferred content:

- Main CTA: start the recommended interview.
- Secondary CTA: view plan or profile evidence.
- A short session plan generated from the resume.
- Small readiness/progress stats.
- Recent or current weak area.

Do not make Home a marketing page after login. It is a working dashboard.

### Onboarding

Purpose: collect the minimum information needed to make practice evidence-grounded.

Required steps:

- Target role
- Experience level
- Resume upload
- Resume verification
- Evidence preview
- Welcome from Maya

Tone should be confident and short. Mobile copy must stay compact.

Validation should accept early-career resumes that have education, projects, certifications, and skills even if they do not have formal work experience.

### Profile

Purpose: show what Helix knows about the user.

Profile should feel like an interview training profile, not a plain settings page.

It should show:

- User identity
- Target role
- Experience level
- Resume grounded confidence
- Key evidence Maya can ask about
- Known focus areas

### Profile Edit

Purpose: let the user update interview calibration.

Editable items:

- Target role
- Experience level
- Headline
- Experience context
- Story bank

The page should stay clean and not become a form wall. Use compact controls, grouped sections, icons, and clear hierarchy.

### Resume Evidence

Purpose: show read-only proof extracted from the uploaded resume.

It should show:

- Candidate identity
- Document metadata
- Experience timeline or project-led profile
- Education
- Skills
- Named projects
- Gaps or risks Maya may challenge

Keep copy concise. Evidence is useful when it is scannable.

### Practice

Purpose: let the user start or continue interview practice.

Existing practice should be made more valuable before adding many modes.

Practice should show:

- Recommended session
- Why this session exists
- What Maya will probe
- Expected duration
- Start action

Future modes may exist, but do not add them until the default practice loop is valuable.

### Progress

Purpose: show whether the user is getting better.

Useful signals:

- Clarity
- Specificity
- Ownership
- Technical depth
- Evidence strength
- Conciseness

Progress should avoid vanity stats. Prefer statements like:

- "Your answers are clearer, but still light on measurable outcomes."
- "Ownership improved in the last session."
- "Maya challenged the same claim twice."

### Reports

Purpose: give actionable feedback after practice.

Reports should include:

- Overall performance summary
- Strongest answer
- Weakest answer
- Main issue to fix
- Resume claim that was not defended well
- Suggested improved answer
- Next recommended practice focus

Avoid long generic feedback. Every report should contain something the user can change in the next session.

### Interview Session

Purpose: run a realistic interview with Maya.

Maya should:

- Ask from the user's evidence.
- Interrupt overly vague or long answers when appropriate.
- Ask follow-ups based on what the user actually said.
- Challenge unsupported claims.
- Move on when the answer meets the bar or the follow-up limit is reached.

## Resume Parsing Requirements

The parser must support:

- Formal work experience
- Project-led profiles
- Education-led early-career resumes
- Certifications and awards
- Skills and tool lists
- Missing or partial dates

A resume should not be rejected only because it lacks formal job experience. If the document has identity plus education, projects, skills, or credible career evidence, Helix should accept it and mark it as project-led or early-career.

## Content Quality Bar

Generated sessions, questions, feedback, and reports should be:

- Resume-grounded
- Specific
- Short enough for mobile
- Actionable
- Honest about weak evidence

Bad:

- "Practice system design fundamentals."
- "Improve communication."
- "Tell me about yourself."

Better:

- "Defend Talk2Campus AI: what did you personally build?"
- "Explain how you evaluated multilingual voice quality."
- "Add a metric to your SmartCollect impact story."

## UI Direction

The current visual direction is blue glass, soft light-blue panels, large readable type, icons, clean cards, and restrained motion.

Use:

- Larger headings
- Shorter copy
- Icons for quick scanning
- Avatars or visual anchors where they add warmth
- Smooth, subtle transitions
- Light blue glass panels

Avoid:

- Too many nested containers
- White hard borders
- Long paragraphs on mobile
- Decorative animations that do not add meaning
- Multiple heavy Three.js avatars on one page

## Mobile Requirements

Mobile is a first-class experience.

Every screen should:

- Keep copy short
- Avoid cluttered cards
- Use clear vertical spacing
- Keep primary actions visible
- Avoid tiny labels as important content
- Avoid unnecessary heavy animation

Maya should be visible where she is the main emotional or product anchor, but not repeated in ways that hurt performance.

## Agent Instructions

Before making product changes, future agents should read this file and follow the scope principle.

When adding requirements:

- Add them to the relevant screen section.
- Add open questions if a decision is not final.
- Prefer improving existing flows over adding new feature categories.
- Keep language clear enough for implementation agents.

## Open Questions

- What should the default Home recommendation logic be after a user completes one session?
- What are the exact scoring rubrics for clarity, specificity, ownership, technical depth, and evidence strength?
- How many sessions should the initial plan contain?
- What should Reports look like before any completed interview exists?
- Should Progress be hidden, empty-state only, or partially populated before the first session?

## Decision Log

- 2026-08-05: Focus product direction on improving existing surfaces rather than adding many new feature modes.
- 2026-08-05: Marketing page should use only one Maya avatar to reduce mobile performance cost.
- 2026-08-05: Resume validation should accept project-led and early-career resumes without formal work experience.
