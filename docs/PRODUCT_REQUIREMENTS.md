# Trailgrad Product Requirements

## Product Vision

Trailgrad helps a candidate become ready for a specific interview outcome. It should feel like a focused coach for cracking a target role, not a library of unrelated questions and mock interviews.

The product must always answer three questions:

1. What role am I preparing for?
2. What is currently stopping me from being ready?
3. What should I do today?

## Core Product Promise

> Tell Trailgrad the company, role, level, and interview date. Trailgrad diagnoses the candidate, creates a focused preparation sprint, and continuously updates it using verified Practice and Interview evidence.

Trailgrad should report evidence-based **readiness**, not claim an offer probability until enough reliable outcome data exists.

## Candidate Journey

```text
Target outcome
    → baseline diagnostic
    → personalized sprint
    → daily mission
    → milestone interview
    → updated gaps and plan
    → final readiness check
```

### 1. Set the target

Onboarding must capture:

- Target company or general big-tech track
- Target role and level
- Interview date, when known
- Weekly preparation time
- Resume and existing experience

The candidate can change their target later, which regenerates future recommendations without deleting historical evidence.

### 2. Establish a baseline

Trailgrad should use resume evidence, a short diagnostic, previous Practice attempts, and previous Interviews to determine the candidate's starting readiness.

Readiness should be shown across five lanes:

- Algorithms and problem solving
- Coding and engineering quality
- Architecture and system design
- Resume and behavioral evidence
- Communication under interview pressure

Every readiness judgment must be explainable through recent evidence. Avoid unsupported precision.

### 3. Generate a preparation sprint

The sprint is a time-bounded plan leading to the target interview. It combines shared big-tech fundamentals with a smaller company-specific overlay.

The common core should cover transferable competencies. The company overlay may change interview format, calibration, priority topics, and practice framing. Company-frequency claims must only be displayed when supported by trustworthy, recent data.

### 4. Give one daily mission

The primary Practice experience should show no more than three recommended actions at a time:

- One task addressing the most important weakness
- One interview-format or pressure exercise
- One review or reinforcement task

Each action must explain why it was selected, which readiness lane it affects, its estimated duration, and what completing it unlocks.

The complete question bank remains available as a secondary Practice Library. It must not compete with the recommended daily path.

### 5. Use interviews as milestones

Interviews are diagnostic checkpoints, not another large content catalogue. Trailgrad should recommend only the next useful interview:

1. Baseline diagnostic
2. Progress checkpoint
3. Pressure simulation
4. Final readiness mock

The next interview may be deferred until the candidate completes prerequisite Practice. Interview history remains available for review without overwhelming the primary screen.

### 6. Close the feedback loop

Every verified Practice attempt and completed Interview must update the evidence model. New weaknesses should reprioritize future tasks; demonstrated strengths should reduce unnecessary repetition.

After an activity, Trailgrad should explain the consequence plainly, for example:

> Your API design was strong, but failure handling was incomplete. Retries and idempotency have been added to this week's plan.

## Primary Product Surfaces

### Home

Home is the candidate's command center. It should show:

- Target company, role, level, and time remaining
- Current readiness and the most important gap
- Today's mission with one primary CTA
- Next milestone interview
- Recent evidence of improvement

### Practice

Practice opens on the daily mission. The Practice Library and full roadmap are secondary views. Candidates should never need to decide among dozens of equally weighted tasks.

### Interviews

Interviews opens on the single recommended milestone, its purpose, and readiness requirements. Past interviews and alternative modes are secondary.

### Progress and Reports

Progress explains readiness movement over time. Reports contain detailed attempt and interview evidence. Both must connect findings back to the next recommended action.

## Recommendation Principles

- Direction is more valuable than content volume.
- A recommendation must be traceable to candidate evidence.
- Verified performance outweighs self-reported confidence.
- Weaknesses are prioritized by impact on the target interview.
- The plan adapts without erasing completed work or history.
- Motivation comes from visible gap closure, not artificial streak pressure.
- There should be one obvious next action on every primary screen.

## Initial Release Scope

The first release of this direction requires:

1. A persistent target company, role, level, date, and weekly availability.
2. An explainable five-lane readiness model using existing evidence.
3. A deterministic daily queue containing at most three actions.
4. Automatic reprioritization after Practice and Interviews.
5. One recommended next milestone interview.
6. Home, Practice, Interviews, Progress, and Reports aligned to the same target and plan.

Do not begin by creating large company-specific question banks, more interview modes, or a statistically unsupported offer score. Reorganize and connect the existing capabilities first.

## Success Measures

- Percentage of onboarded candidates who set a target and begin their first mission
- Daily mission start and completion rates
- Reduction in time spent choosing what to practise
- Percentage of interview findings converted into completed Practice
- Improvement between baseline and final milestone interviews
- Sprint completion and paid conversion rates

## Completion Criteria

This product direction is complete when a candidate can set a target, receive a concise evidence-based plan, know exactly what to do today, complete Practice and milestone Interviews, and see those results change their readiness and next actions across the product.
