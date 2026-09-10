# Core Technical Personalized Practice Path Requirements

Status: Active product and engineering requirement  
Scope: `/practice/core-technical` only  
Audience: Product, design, frontend, backend, AI generation, and QA

## 1. Authority and intent

This document defines the required experience for the new Core Technical practice path. It is a focused addendum to `STORY_DRIVEN_CORE_TECHNICAL.md` and overrides that document wherever the two conflict on entry flow, content framing, generation, or presentation.

The candidate-facing product must use the term **practice path**, not **story**. “Story” may remain as an internal or legacy data-model term, but it must not produce fictional company narratives or vague scenarios in the UI.

The goal is to help a candidate learn and explain the practical technical topics most commonly discussed in real interviews. The experience should feel like a thoughtful human teacher prepared a focused session from the candidate's background—not like a random quiz generator.

## 2. Product outcome

A candidate entering Core Technical practice should be able to:

1. Choose a relevant technology, with useful options derived from their resume.
2. Receive a natural acknowledgement from the teacher while their path is prepared.
3. Work through exactly eight practical, interview-relevant questions in a coherent order.
4. Learn from a detailed explanation, example, and diagram for every question.
5. Complete a separate teacher-led block assessment based on what they just practised.

The experience must prioritise technical correctness, practical relevance, clarity of explanation, and believable interviewer dialogue.

## 3. Scope boundaries

This flow belongs only to `/practice/core-technical`.

It must not:

- replace or take over the general `/practice` landing page;
- route a Core Technical block assessment to the generic `/interview` setup or interview flow;
- silently generate content for unsupported ecosystems;
- globally publish candidate-specific generated content;
- redesign the dashboard shell, sidebar, or navigation;
- expose reference answers, hidden tests, rubrics, or private generation data before the allowed learning state.

## 4. Supported technology scope

The currently supported, truthful technology vertical is the Node.js ecosystem:

- Node.js
- JavaScript
- TypeScript
- NestJS
- Express
- Fastify
- Koa
- Next.js

Resume-derived suggestions must be limited to technologies for which the product has a valid source-reviewed domain and executable environment. A user's explicit selection must override inferred role, language, or framework preferences.

Python, databases, cloud platforms, or other technologies must not be offered merely because they appear on a resume. They can be added only after their question contracts, review rules, examples, and execution environments are supported.

## 5. Entry experience

The Core Technical entry screen must render inside the normal authenticated dashboard shell, including the existing sidebar and navigation.

The visual presentation should resemble the clarity of the post-onboarding welcome experience, with these constraints:

- no outer welcome-card container;
- no decorative accent blur inside option cards;
- no small eyebrow copy such as “Your practice workspace”;
- no explanatory subheading below the primary heading;
- no visible “Suggested from your resume” label;
- larger, easily readable technology titles and descriptions;
- the teacher avatar remains visible on mobile;
- the avatar image uses a soft alpha feather on the bottom, left, and right edges so it blends into the page instead of looking rectangular or cut out;
- glow or drop shadow must not be used as a substitute for edge feathering.

The primary prompt should remain short and direct, such as:

> What do you want to get better at?

Resume information may determine which options are presented and prioritised without adding extra visual labels.

## 6. Teacher behaviour and dialogue

The teacher should make the session feel guided, calm, and human. Dialogue must be concise and context-aware rather than repetitive or theatrical.

### Initial greeting

The teacher welcomes the candidate to Core Technical practice and asks which technology they want to work on. The wording may vary naturally between sessions. It should not repeat the full heading or read UI labels aloud verbatim.

### After technology selection

The teacher immediately acknowledges the selected technology with a short transition, for example:

> Great—let me pull together a focused Node.js practice path for you.

The exact sentence should vary, but it must accurately name or reflect the selected technology. It must not claim that live personalised content was created if a reviewed fallback is ultimately used.

### During questions

Teacher interventions should behave like a real interviewer or mentor:

- introduce a task without restating every visible word;
- ask one focused follow-up at a time;
- react to the substance of the candidate's answer;
- request clarification when reasoning is incomplete;
- provide a progressive hint only when needed;
- connect the mechanism to a realistic production or interview situation;
- avoid generic praise, excessive narration, canned encouragement, and role-play filler.

## 7. Practice-path generation

Selecting a technology starts a live, per-candidate preparation request. Generation occurs at request time; it does not require a separate publishing workflow.

The required flow is:

```text
Resume context + explicit technology selection
                    |
                    v
        Resolve supported technology focus
                    |
                    v
     Select source-reviewed patterns and ordering
                    |
                    v
    Generate and independently review 8 questions
                    |
                    v
       Validate contracts and executable tasks
                    |
                    v
      Persist one immutable candidate snapshot
                    |
                    v
          Open the current practice workspace
```

The source-reviewed patterns and their intended progression remain authoritative. Personalisation may adapt the title, concrete context, examples, and explanation level, but it must not weaken the technical mechanism or introduce an unrelated ecosystem.

Preparation must be replay-safe. Repeating the same confirmed request must not create competing partial paths. Nothing may be persisted until the complete eight-question path has passed validation.

## 8. Eight-question contract

Every generated path must contain exactly eight ordered questions designed for approximately 40–50 minutes of focused practice.

Across the eight questions, the path must:

- cover eight distinct patterns or mechanisms;
- progress coherently from observation and explanation to diagnosis, repair, implementation, and production reasoning;
- favour frequently asked interview concepts and practical engineering decisions;
- use concrete symptoms, inputs, code, logs, or constraints;
- be easy for a candidate to explain aloud;
- avoid obscure trivia unless it is necessary for the selected role and explicitly supported by the source blueprint;
- avoid fake company names, unexplained fictional incidents, and vague “something failed” stories;
- avoid duplicated questions disguised with different wording.

Suitable framings include:

- “Why does this request handler return before the work finishes?”
- “Predict the output order and explain what the event loop is doing.”
- “Fix this stream so a slow consumer does not exhaust memory.”
- “How would you preserve the original error across this async boundary?”
- “What makes this test flaky, and how would you make it deterministic?”

Each prompt should normally be 24–90 words, use direct second-person language, and provide enough evidence to reason without invented background knowledge.

The path must use a deliberate mix of formats, including:

1. Multiple choice with explanation
2. Predict and explain
3. Written mechanism explanation
4. Spoken or written explanation
5. Artifact diagnosis
6. Debug and repair
7. Micro implementation
8. Production decision or trade-off explanation

Every question must include:

- the candidate-visible prompt and artifacts;
- one to four relevant interviewer follow-ups;
- three progressive hints;
- a ten-point scoring rubric;
- realistic common mistakes;
- a clear interview connection;
- a validated reference answer;
- a detailed learning guide.

## 9. Executable-question requirements

Executable questions must be deterministic under the supported Node.js 22 runtime.

They must not depend on:

- network access;
- filesystem access;
- external packages;
- random values;
- wall-clock timing;
- services or state outside the question snapshot.

An executable question must store and validate its starter code, reference solution, public tests, hidden tests, mutation cases, and runner contract before the path becomes available.

## 10. Detailed learning-answer contract

Every question must generate and store a `learningGuide`. The guide is part of the immutable question snapshot so the candidate can return to the same explanation later.

The Markdown answer must contain these sections:

```markdown
## What is happening
## How to reason through it
## A strong interview answer
## What to avoid
```

The guide must:

- explain the underlying mechanism in plain language;
- walk through the evidence or code step by step;
- include a useful example where appropriate;
- show what a concise, strong spoken interview answer sounds like;
- identify common wrong assumptions and why they fail;
- remain specific to the actual question rather than providing generic textbook material.

Each guide must also include an ordered diagram containing two to six labelled steps. It should render horizontally on suitable desktop widths and vertically on mobile. The same order and labels must remain understandable to screen readers and when styling is unavailable.

Older stored blocks that do not contain a learning guide may receive a bounded compatibility guide at read time. New blocks must always persist the complete generated guide.

## 11. Review and quality gates

A path cannot be persisted until it passes all of the following gates:

- schema and field validation;
- exactly eight questions and valid ordering;
- prompt-length and format checks;
- required learning-guide sections;
- technical-correctness review;
- common interview relevance;
- coherent learning progression;
- answer and explanation quality;
- appropriate difficulty for the candidate context;
- executable sandbox audit where applicable;
- public/private snapshot boundary checks.

An independent critic should review generated content rather than relying only on the generator's self-assessment.

## 12. Provider failure and reviewed fallback

The system should first attempt live personalised generation using the configured primary provider, then the configured provider fallback.

If all live providers fail with a retryable provider error, the request may use a matching, approved fallback artifact only when all of these are true:

- the artifact matches the confirmed supported technology domain;
- it contains exactly eight reviewed questions;
- its learning guides and executable contracts are valid;
- it does not introduce an unrelated language or framework;
- it can be stored safely as the candidate's immutable practice snapshot.

A reviewed fallback is **not newly generated or live-personalised content**. This distinction must be recorded as provenance, for example:

```text
live-personalized
reviewed-fallback
```

Logs and internal diagnostics must make the provenance clear. Candidate-facing status text must remain truthful and neutral. The product must never label a reviewed fallback as a newly personalised generation.

If no exact approved fallback exists, preparation must fail safely with a recoverable error. It must not store a partial path or substitute an unrelated ecosystem.

The current reviewed Node.js fallback sets—including titles such as “Trace identity, copying, and nested mutation” and “Predict event-loop ordering”—are fallback artifacts. Seeing those exact questions does not prove that the new live-generation logic succeeded.

## 13. Persistence and privacy

The completed path must be stored as a candidate-owned immutable snapshot. A generation request does not globally publish the content.

Before an attempt, candidate-facing APIs must not return:

- reference answers;
- hidden tests;
- mutation cases;
- scoring rubrics not intended for the candidate;
- critic output;
- provider prompts or raw provider responses.

Authorised learning and review states may reveal the stored learning guide and permitted feedback after the candidate has attempted or explicitly chosen to learn the question.

Provider logs may include safe operation names, attempt counts, duration, status, and sanitised failure reasons. They must not include secrets, full prompts, private resume text, or answer material.

## 14. Block assessment hand-off

After completing the eight-question practice path, the candidate can start a teacher-led block assessment tied to that path.

The assessment must:

- open the dedicated assessment room rather than the generic interview setup;
- use the mechanisms and evidence from the completed eight-question path;
- begin with a short, natural greeting;
- ask focused questions and contextual follow-ups;
- behave as a separate evaluative conversation, not a replay of the practice cards;
- preserve the existing assessment/report lifecycle and use the result to inform the next practice path.

## 15. UI and performance requirements

The existing structural design must remain intact. UI changes should improve hierarchy, legibility, state communication, and responsive behaviour without adding decorative noise.

Required behaviour:

- avatars and essential text remain visible on mobile;
- reduced-motion preferences are respected;
- expensive filters and large blurred layers are avoided on constrained devices;
- avatar feathering uses bounded masks or gradients and does not cause full-page repaint pressure;
- loading states are minimal and do not place the loader inside a decorative container;
- the transition from selection to the workspace clearly communicates preparation without excessive text;
- question cards, learning guides, diagrams, and assessment controls remain usable at phone widths.

## 16. Acceptance criteria

This requirement is satisfied when:

1. `/practice/core-technical` opens within the normal dashboard shell and shows the technology-selection welcome state.
2. Resume-derived choices include only supported technologies, and explicit selection controls the generated domain.
3. Selecting a technology produces a short teacher acknowledgement and a replay-safe preparation request.
4. A successful live request stores exactly eight reviewed, practical, ordered questions with complete learning guides.
5. Every new learning guide contains all four required Markdown sections and an accessible two-to-six-step diagram.
6. Executable tasks pass deterministic Node.js 22 validation before persistence.
7. Provider exhaustion uses only an exact reviewed fallback and records truthful provenance; otherwise it returns a recoverable error without a partial save.
8. The UI never describes reviewed fallback questions as newly generated.
9. The avatar blends on its bottom, left, and right edges and remains visible on mobile.
10. Starting the block assessment opens the dedicated teacher-led assessment experience, not generic `/interview`.
11. No private answer material is exposed before the authorised learning state.
12. No generated candidate path is globally published as part of this flow.

## 17. Implementation map

The primary implementation areas are:

- `src/features/practice/core-technical/domain/technology-focus.ts`
- `src/features/practice/core-technical/domain/question-contracts.ts`
- `src/features/practice/core-technical/server/story-generator.ts`
- `src/features/practice/core-technical/server/question-generator.ts`
- `src/features/practice/core-technical/server/generation-pipeline.ts`
- `src/features/practice/core-technical/server/preparation.service.ts`
- `src/features/practice/core-technical/server/persistence.service.ts`
- `src/features/practice/core-technical/ui/core-technical-technology-welcome.tsx`
- `src/features/practice/core-technical/ui/core-technical-question-workspace.tsx`
- `src/features/practice/core-technical/ui/core-technical-learning-guide.tsx`

