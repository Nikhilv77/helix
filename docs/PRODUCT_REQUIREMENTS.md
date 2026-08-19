# Trailgrad Product Requirements

## Project Context

Trailgrad is an AI-powered frontend interview-preparation product. Users onboard with their target role, experience level, resume, and goals. Maya, the AI interviewer and coach, guides them through a personalized preparation roadmap, practice questions, coding exercises, and realistic interviews.

The current product focus is only the frontend interview-preparation experience. Do not expand this requirement into backend, full-stack, data, AI/ML, or product-management roadmaps until the frontend flow works end to end.

## Important Routes

- `/`: Personalized home dashboard with the user's roadmap, progress, next action, and Maya insights.
- `/onboarding`: Resume, target role, experience, and focus-area onboarding.
- `/?welcome=maya`: Maya's post-onboarding welcome and roadmap introduction.
- `/interviews`: Interview-mode selection for the five interview rounds.
- `/interview/dsa`: DSA interview entry screen and readiness check.
- `/interview/voice?session=:id`: Live Maya interview room for conversational and mixed rounds.
- `/practice`: Frontend practice overview based on persisted roadmap progress.
- `/practice/:chapter`: Chapter briefing and guided practice flow.
- `/dsa-questions/:slug`: Individual DSA question, explanation, hints, notes, editor, and execution results.
- `/interview/dsa/:slug`: DSA interview workspace for a selected problem.
- `/reports`: Interview history, evaluations, score breakdowns, and recommendations.
- `/progress`: Roadmap, practice, pattern, and interview progress trends.

Routes should use persisted user state where applicable. Do not replace database-backed state with static arrays or placeholder progress.

## Product Goal

When a user onboards with `targetRole = frontend`, Trailgrad creates and renders a personalized frontend preparation roadmap for that user.

The roadmap must use:

- Target role
- Experience level
- Resume evidence
- Current progress
- Question attempts and performance signals

Maya should explain the plan after onboarding, and Home should show the user's current plan and progress.

## Frontend Roadmap

The base roadmap contains six sessions:

1. Frontend DSA
2. JavaScript and React Core
3. Build Real UI Features
4. Production UI Quality
5. Resume and Behavioral Defense
6. Final Frontend Mock

These are reusable templates. Each user receives a persisted roadmap instance generated from them.

Sessions 2–6 must eventually contain their own chapters, questions, practice flows, and progress tracking. Frontend DSA is the first fully implemented session.

## Personalization

### Experience Level

- Fresher and early-career users receive more fundamentals, guided explanations, warmups, and confidence-building practice.
- Mid-level users receive more production tradeoffs, architecture, debugging, and feature-ownership questions.
- Senior users receive more ambiguity, system design, migrations, quality strategy, technical leadership, and cross-team tradeoffs.

The selected content, order, explanations, and Maya prompts must change based on experience level.

### Resume Evidence

If the resume contains React, dashboards, forms, design systems, accessibility, performance, or frontend-heavy projects, Maya should use that evidence in the roadmap and interview prompts.

If frontend evidence is weak, the roadmap should emphasize evidence-building practice and resume-defense gaps.

For specific projects, Maya should prepare questions about:

- State model
- UX states
- Tradeoffs
- Performance
- Accessibility
- Testing
- Shipped outcomes

Resume evidence must affect roadmap content or Maya insights, not only be stored as unused metadata.

## Dynamic Progress

Home must render from the user's current persisted progress.

Track:

- Active session
- Active chapter
- Next question
- Completed questions
- Attempted questions
- Correctness and score
- Difficulty progress
- Estimated remaining work
- Overall roadmap progress
- Session progress
- Chapter progress
- Practice streak and continuity

Examples:

- Completing Arrays & Hashing advances the next priority to the next unfinished chapter.
- Repeated misses in Sliding Window produce a weakness-aware Maya insight.
- Completing Frontend DSA activates JavaScript and React Core.
- Progress survives refresh, logout, and login.

## Maya Welcome

After frontend onboarding, `/?welcome=maya` must show Maya's welcome screen.

Maya should:

- Welcome the user by name when available.
- Explain that she prepared the six-session frontend roadmap.
- Briefly explain why the sessions are ordered that way.
- Mention the first active session.
- Return the user to Home when dismissed or when the start CTA is clicked.

The content must be role-aware. Frontend users receive frontend-specific messaging; other roles may keep the general welcome until their roadmap systems exist.

## Maya Insights

Home must show dynamic, user-specific Maya insights derived from progress and attempts. Insights should be persisted or cached for fast loading.

Required insight types:

- Next priority
- Common trap
- Strong answer signal
- Streak or continuity state
- Recommended next action

Insights must change as the user practices. They must not be permanently hardcoded.

## DSA Practice and Interviews

Frontend DSA practice must provide:

- LeetCode-style problem descriptions
- Examples and constraints
- Hints and progressive explanations
- Notes saved per question
- Code editor support for Python, JavaScript, Java, and C++
- One Judge0 execution request containing all test cases
- Per-test expected and actual output
- Compile and runtime error display
- Accepted or failed submission state

The DSA interview must:

- Require at least 10 completed practice questions before starting.
- Prefer important questions the user has already practiced.
- Exclude class-based questions from the interview pool until Java and C++ class runners are supported.
- Use important function-based fallback questions when the solved eligible pool is too small.
- Ask one problem at a time.
- Evaluate problem understanding, approach, correctness, complexity, communication, and edge cases.
- Ask natural follow-up questions based on the user's answer instead of repeating generic acknowledgements.
- Avoid repeating recently asked questions when interview history is available.

## Interview Product

Trailgrad should provide five interview rounds. They share Maya's conversation, transcript, follow-up, evaluation, and reporting infrastructure, but each round uses its own question bank and rubric:

1. **DSA Interview** — coding problem, editor, test execution, complexity, and algorithm evaluation.
2. **Resume Round** — resume evidence, project ownership, decisions, tradeoffs, and behavioral follow-ups.
3. **Technical Depth and Fundamentals** — JavaScript, React, web, backend, databases, APIs, and core engineering questions with contextual counter-questions.
4. **Full-Stack System Design** — structured architecture discussion covering requirements, APIs, services, data, scaling, reliability, security, and tradeoffs.
5. **Final Mock** — a realistic mixed round combining resume, technical, DSA, and system-design segments.

Only DSA requires code execution. Resume, Technical Depth, and most System Design interviews are conversational. The Final Mock composes the existing round types instead of duplicating their implementations.

### Full-Stack System Design

The system-design round should:

- Present an ambiguous full-stack problem and let the candidate clarify requirements.
- Move through requirements, high-level architecture, API design, data modeling, scaling, caching, queues, security, reliability, and tradeoffs.
- Introduce changing constraints and ask the candidate to adapt the design.
- Provide an optional free diagram editor with predefined nodes such as client, API, service, database, cache, queue, worker, storage, and external service.
- Save the diagram as interview-session data for Maya's evaluation and the Reports page.
- Use an open-source client-side canvas library and the existing database; no paid diagram service is required for the initial version.
- Score requirement clarification, architecture, APIs, data design, scalability, reliability, security, tradeoffs, and communication.

## Database Requirements

Persist the following:

- Global roadmap, session, chapter, and question templates
- User roadmap instances
- User session progress
- User chapter progress
- User question progress
- Question attempts and scores
- Interview history
- Maya insights
- Question notes

The database is the source of truth for user-specific roadmap state. Static JSON may remain the source for global DSA content, but it must not be used as fake user progress.

## Required Backend Flow

1. User completes frontend onboarding.
2. Backend creates or updates the user's frontend roadmap instance.
3. Backend personalizes the roadmap using level, resume, role, and available templates.
4. Home loads the persisted roadmap and insights.
5. User opens, attempts, skips, completes, or submits questions.
6. Backend records the event and performance signals.
7. Backend recalculates question, chapter, session, roadmap, and insight state.
8. Home and practice routes render the updated state.
9. Interview routes use the user's eligible progress and interview history.

## UI Requirements

Home must render:

- Maya hero and welcome state
- Active frontend session
- All six session cards
- Current chapter or pattern position
- Progress values from the database
- Maya insights from persisted state
- Correct next CTA

Practice and interview surfaces must remain consistent with the existing Trailgrad visual system. Prefer clean, unframed layouts over unnecessary nested cards. Loading states must belong to the route being loaded and must not reuse unrelated dashboard skeletons.

## Performance and Reliability

- Question attempt writes must not deadlock or silently drop events.
- Progress updates should be optimistic in the UI with rollback on failure.
- Recalculating roadmap state should avoid unnecessary full-roadmap work where possible.
- Interview startup should fail with a useful error rather than leaving the user in an infinite loading state.
- Code execution must keep API keys server-side and preserve execution limits.

## Future Product Requirements

These are planned improvements after the current frontend roadmap flow is stable. They should be implemented incrementally and should reuse the existing interview, progress, reports, and question-attempt data models where possible.

### DSA Interview Selection

Relevant routes: `/interviews`, `/interview/dsa`, and `/interview/voice?session=:id`.

- Balance selected questions across easy, medium, and hard difficulty.
- Avoid questions asked recently in the user's interview history.
- Prefer patterns and concepts related to the user's solved, attempted, or weak areas.
- Select function-based questions that are supported by the current execution system.
- Choose related follow-up questions that deepen the same problem or pattern instead of switching randomly.
- Keep the interview selection deterministic enough to explain why a question was chosen while still allowing useful variety.

### Maya DSA Evaluation

Relevant route: `/interview/dsa` and the active interview session route.

- Evaluate the user's understanding of the problem before evaluating the code.
- Evaluate the proposed approach, including brute force versus optimal alternatives.
- Check correctness, time complexity, space complexity, and edge-case handling.
- Use code execution results as evidence, not as the only evaluation signal.
- Ask intelligent follow-ups based on the user's approach, mistakes, failed cases, or missed tradeoffs.
- Adapt the conversation naturally: Maya should not repeat generic acknowledgements or ask a follow-up after every answer.
- Finish with actionable feedback covering what was strong, what was missing, and what to practise next.

### DSA Test Results

Relevant route: `/interview/dsa` and the DSA question/editor surface.

- Show passed and failed test cases clearly.
- Display expected output and actual output for failed cases.
- Separate compile errors, runtime errors, timeouts, and wrong answers.
- Preserve the existing execution limits and server-side Judge0 integration.
- Show a clear accepted state when all test cases pass.
- Enable a `Submit to Maya` state after accepted code so the user can discuss the solution and receive interview evaluation.
- Keep execution efficient by sending all test cases for a question in one Judge0 submission where the runner contract supports it, then mapping the returned results back to the UI.

### Interview Score Breakdown

Relevant routes: `/interview/dsa`, `/interview/voice?session=:id`, and `/reports`.

Every completed interview should store and display a score breakdown for:

- Problem understanding
- Algorithm choice
- Correctness
- Time and space complexity
- Communication
- Edge-case handling

Scores should include short evidence-based explanations and should distinguish code-execution results from Maya's conversation-based assessment.

### Interview History

Relevant routes: `/interviews`, `/interview/dsa`, `/interview/voice?session=:id`, and `/reports`.

- Store each interview attempt, selected question keys, difficulty mix, completion state, duration, transcript or answer summary, and scores.
- Track recently asked questions so Maya does not repeatedly select the same problems.
- Track interview-level improvement over time, not only individual question completion.
- Feed interview history into future question selection, follow-ups, score explanations, and Maya insights.
- Let users review the result of a completed interview without changing the original result.

### Reports Page

Route: `/reports`.

The Reports page should become the user's detailed interview review space and should load persisted user data rather than placeholder values. It should include:

- Interview history with date, type, duration, completion state, and overall score.
- Score breakdown for problem understanding, algorithm choice, correctness, complexity, communication, and edge cases.
- Question-level results with selected question, outcome, test-case status, and Maya's evaluation.
- Strengths, recurring weaknesses, common mistakes, and recommended practice areas.
- Transcript or answer review for conversational interviews where available.
- DSA-specific evidence such as brute-force attempts, optimality, failed cases, and complexity reasoning.
- Trend views showing improvement across multiple interviews.
- A clear next action that links back to the relevant practice chapter or interview mode.

### Progress Page

Route: `/progress`.

The Progress page should provide a complete view of preparation progress from persisted roadmap and attempt data. It should include:

- Overall roadmap, session, and chapter completion.
- Attempted versus completed questions.
- Accuracy, score, and completion trends over time.
- Difficulty distribution and pattern coverage.
- Strong and weak concepts based on actual attempts and interview evaluations.
- Practice streak, recent activity, and continuity state.
- Interview count, average score, and improvement trend.
- Recommended next action based on the active roadmap priority and recent weaknesses.

### Lower-Priority Language Runners

Relevant route: `/interview/dsa`.

Implement Java and C++ class-based runners later, behind explicit language and question contracts. Class-based questions remain excluded from DSA interviews until their entry-point handling, test harnesses, and result mapping are implemented. This includes structures such as:

- Browser History
- LRU Cache
- Min Stack
- Queue or stack design
- Circular Queue
- Stock Span
- Time Map
- Median Finder
- Trie
- Word Dictionary

## Out Of Scope Until Frontend Is Complete

- Backend roadmap specialization
- Full-stack roadmap specialization
- Data roadmap specialization
- AI/ML roadmap specialization
- Product-management roadmap specialization
- New unrelated dashboards
- New unrelated interview modes
- Broad content expansion unrelated to the current frontend flow

## Completion Criteria

This requirement is complete when:

- A frontend user receives a personalized persisted roadmap after onboarding.
- Home renders roadmap state from the database.
- Maya explains the six-session plan after onboarding.
- Experience level and resume evidence affect the roadmap or insights.
- Maya insights change from real attempts and progress.
- Question attempts update progress reliably.
- Completing questions advances chapters and sessions.
- Progress survives refresh, logout, and login.
- Frontend DSA practice supports all four languages and test-case execution.
- DSA interviews use eligible function-based questions and provide meaningful evaluation.
- All six frontend sessions remain the primary Home experience.
