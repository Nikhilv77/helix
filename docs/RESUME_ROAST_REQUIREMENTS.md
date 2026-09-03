# Resume Roast Product Requirements

## Product Idea

Resume Roast is a funny but useful review hosted by James, the Trailgrad teacher. James uses the resume already stored in the user's profile, roasts how it presents their experience, explains why the weak parts matter and ends with a short improvement plan.

The humour is the hook. Honest, target-aware resume guidance is the product value.

## Product Promise

> Choose the job you want and let James roast your resume. Every joke points to a real problem, every problem includes an explanation, and the session ends with clear improvements you can make.

Resume Roast must never invent weaknesses simply to be funny.

## Entry and Onboarding

- Resume Roast is a separate product tab.
- Nothing about roasting is added to the main onboarding flow.
- The user does not upload another resume in this tab.
- The feature reads the latest resume data already stored in the user's profile.
- If no resume is available, James sends the user to Profile to add one instead of showing an uploader in the Roast tab.
- If the profile already contains a target role, James confirms it and lets the user change it.

## First-Visit Experience

James opens with:

> Before I destroy this resume with love, what job are we trying to convince people you can do?

The user answers three short questions.

### Role

- Software Engineer
- Frontend Engineer
- Backend Engineer
- Full-stack Engineer
- Mobile Engineer
- Data or ML Engineer
- DevOps, Cloud or SRE
- Engineering Manager
- Internship or New Grad
- Not sure yet

### Company environment

- Early-stage startup
- Growing startup
- Product company
- Big Tech
- Consulting or service company
- Remote or international role
- Anywhere that will hire me

### Level

- Internship or New Grad
- Junior
- Mid-level
- Senior
- Staff or Principal
- Manager

The answers create a target such as `Senior Backend Engineer at a product company`.

## The James Experience

James should feel quick, sarcastic and observant rather than cruel. After target selection, he immediately responds with a locally stored target-specific line while the personalized analysis begins in the background.

Example:

> Senior engineer at Big Tech? Excellent. Let's see whether this resume says “technical leader” or “attended many meetings professionally.”

James then reveals and optionally reads the personalized roast as it arrives.

## Roast Structure

Every completed roast contains:

1. A short opening roast.
2. The strongest part of the resume.
3. Up to three important problems, each containing:
   - A sarcastic observation
   - The real issue
   - Why a recruiter or interviewer would care
   - A specific improvement
4. At least one before-and-after bullet rewrite when suitable.
5. A truthful overall verdict.
6. No more than three prioritized actions to take next.

The UI can give these sections playful names, but the meaning must remain obvious.

## Humour and Honesty

Sarcasm should target the resume's writing and evidence, never the user as a person.

Good targets include:

- Vague responsibility statements
- Missing outcomes or measurements
- Repeated verbs and buzzwords
- Unclear ownership
- Unsupported seniority
- Very long bullets
- An excessive skills list
- Experience unrelated to the selected target

James must not joke about protected traits, personal identity, appearance, names, disability, age or sensitive life circumstances.

### Strong resumes

Good resumes must still receive an entertaining experience, but James must acknowledge their quality and avoid fake criticism.

Example:

> This is deeply inconvenient. You included impact, numbers and actual ownership. Were you trying to make my job difficult?

The verdict should use understandable evidence-based bands rather than a fake ATS score:

- Needs serious work
- Has potential
- Solid
- Strong
- Difficult to roast

Do not show an offer probability or unsupported numerical score.

## Fast Generation

The feature should feel immediate without using a real-time voice model.

When the page opens, the server loads the stored resume and calculates inexpensive signals such as bullet count, missing metrics, repeated verbs, sentence length and skill-list size.

After the user confirms a target:

1. Show a prewritten target reaction immediately.
2. Send compact resume data, target information and deterministic signals in one model request.
3. Stream complete sections to the interface as they become available.
4. Save the validated final result for future visits.

The streaming response should expose semantic events such as:

```text
opening_roast
strength
problem
rewrite
verdict
action_plan
```

The interface must show useful progress rather than a generic loading spinner.

## Voice

- The complete transcript is always visible.
- Browser text-to-speech is the initial voice implementation and starts after one or two complete sentences are buffered.
- Users can pause, resume, replay or mute James.
- Speech-to-text is not required because the first release does not need spoken user replies.
- Paid generated voices and real-time voice conversations are outside the initial release.

## Cost Controls

- Parse each resume once and reuse the stored structured data.
- Use one fast text-model request per complete roast.
- Do not make separate model requests for individual roast sections.
- Do not resend the original resume file when extracted data is available.
- Cache by resume version, target role, company environment, level and prompt version.
- Reload cached roasts instantly on return visits.
- Regenerate only when the resume, target or roast prompt changes.
- Generate individual bullet rewrites on demand instead of regenerating the entire roast.

## Data and Privacy

- Use only the signed-in user's latest stored resume.
- Never expose private resume details in shareable content.
- A shared roast card must remove names, contact details, company-confidential information and other identifying content.
- Users must be able to delete a saved roast.
- A changed resume creates a new version without silently rewriting historical results.

## Connection to Trailgrad

Resume Roast should not end as entertainment. Its action plan should connect to the user's target and existing preparation journey.

Possible next actions include:

- Rewrite the weakest bullet
- Add evidence of measurable impact
- Clarify ownership or leadership
- Improve the professional summary
- Update the profile resume
- Practise explaining a highlighted project

Only real resume evidence should influence the resume and behavioural readiness lanes.

## Initial Release Scope

1. Resume Roast tab hosted by James.
2. Stored-profile resume retrieval and missing-resume state.
3. First-visit target selection and later target confirmation.
4. Immediate scripted reaction followed by one streamed personalized roast.
5. Honest adaptive roasting for weak, average and strong resumes.
6. Transcript with optional browser text-to-speech controls.
7. Cached results with resume and target versioning.
8. A final three-action improvement plan.

Exclude live voice conversations, resume uploading inside the Roast tab, offer predictions, fake ATS scores and public sharing from the first release.

## Success Measures

- Percentage of visitors who complete target selection
- Percentage who reach the final verdict
- Time until the first visible reaction and first personalized section
- Percentage who complete at least one recommended resume improvement
- Return rate after updating the resume
- Resume Roast to Practice or Interview conversion
- User rating of both usefulness and humour

## Completion Criteria

The feature is ready when a signed-in user with a stored resume can choose or confirm a target, receive an immediate response from James, watch a personalized and truthful roast arrive progressively, hear it using optional browser speech, understand every criticism and leave with no more than three clear improvements. Returning users should see the cached result immediately unless their resume or target has changed.



codex replies - 

I’m starting with the Sol-owned architecture audit: I’ll read the complete requirements and repository instructions, map the existing system, then publish the contracts before any edits. After that I’ll delegate only narrow, non-overlapping milestones to Terra and review each actual diff plus test evidence before proceeding.




Ran pwd && rg --files -g 'AGENTS.md' -g 'docs/RESUME_ROAST_REQUIREMENTS.md' -g '!node_modules' -g '!dist' -g '!build' | sort && git status --short && wc -l docs/RESUME_ROAST_REQUIREMENTS.md && sed -n '1,240p' docs/RESUME_ROAST_REQUIREMENTS.md && sed -n '241,520p' docs/RESUME_ROAST_REQUIREMENTS.md




The full requirements are now read. There is no repository AGENTS.md in scope, and the requirements file itself is an existing untracked user file, so I’ll preserve it untouched. I’m now mapping the actual data, auth, AI, streaming, shell, speech, and test paths before fixing any contracts.




Ran rg --files -g '!node_modules' -g '!.next' -g '!dist' -g '!coverage' | sed -n '1,260p'
find . -maxdepth 2 -type f \( -name 'package.json' -o -name 'prisma.schema' -o -name 'schema.prisma' -o -name 'drizzle.config.*' -o -name 'vite.config.*' -o -name 'next.config.*' -o -name 'tsconfig.json' -o -name 'vitest.config.*' -o -name 'jest.config.*' -o -name 'playwright.config.*' \) -print
sed -n '1,240p' package.json 2>/dev/null || true
rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' "resume|Resume|James|teacher|Teacher|stream|ReadableStream|EventSource|anthropic|openai|generateObject|streamObject|zod|speechSynthesis|profile|auth\(|currentUser|getServerSession|useSession" . | sed -n '1,420p'




This is a Next.js App Router codebase, so I’m using the vercel:nextjs skill to align the route/server-component/client boundaries with the project’s framework conventions. It will guide the audit and implementation contracts; later, if multiple TSX files change, I’ll also run the repository’s React quality review skill before final validation.




Loaded a tool, ran a command


Audit resume profileAudit ai streamingAudit ui testsstarted working

Read files, ran a command


Audit ui testsAudit resume profileAudit ai streamingfinished

The audit found one compatible path rather than a parallel subsystem: the existing structured resume is the content source, the existing immutable interview-profile revision is the resume version, the existing strict Zod-backed fast Gemini request is the single AI call, and the workspace shell/canonical James persona are reused.
The implementation contracts are now fixed:
- A dedicated one-row-per-user Roast target stores the requirements’ exact role, company-environment, and level choices; existing coarse profile fields only prefill suggestions.
- Saved roasts are owner-scoped and keyed by immutable resume-profile version + all three target values + prompt version. Historical rows remain; changed inputs naturally miss the cache.
- Generation rows use a tokenized lease (GENERATING/READY/FAILED) so concurrent or superseded requests cannot overwrite each other.
- Model output is one strict object: opening, evidence-backed strength, 0–3 evidence-backed problems, optional grounded rewrite, verdict band, and 1–3 prioritized actions. A deterministic boundary rejects unknown anchors, fabricated-score/probability language, and invalid priorities before streaming or persistence.
- The POST route streams only fully validated semantic SSE events; cached results use the same event contract. Disconnects abort work where supported and prevent stale persistence.
- Missing resume renders a Profile handoff. Client retries preserve the target; regeneration is explicit; deleting a saved roast retains the target.
- James is the canonical existing persona. Speech uses client-only speechSynthesis with pause/resume/replay/mute and a permanently visible transcript.
I’m beginning the persistence gate with one Terra writer and non-overlapping ownership.




Persistence versioningstarted working

Read files, ran commands


The persistence writer is still within the first gate. In parallel, I verified the installed Gemini SDK accepts an abort signal in GenerateContentConfig, so the later cancellation contract can be implemented cleanly through the existing provider instead of merely suppressing the response after disconnect. I’m holding dependent edits until the persistence diff is ready for inspection.




The first gate is taking longer because the writer is covering the concurrency cases in the persistence tests, not just adding tables. No dependent files are being touched. Once it finishes, I’ll inspect the migration, every owner-scoped query, lease transitions, and generated Prisma surface directly before accepting it.




Persistence versioningfinished

Milestone 1 has returned green, but it is not accepted yet. I’m now performing the Sol review gate on the actual schema, migration, contracts, and store implementation—especially the composite ownership FK, unique cache key, token-guarded lease transitions, JSON validation, and whether any migration behavior could lose data.




Ran git status --short
git diff --stat
git diff -- prisma/schema.prisma prisma/migrations/20260903130000_resume_roast/migration.sql src/lib/resume-roast/contracts.ts src/server/resume-roast/resume-roast.store.ts src/server/resume-roast/resume-roast.store.spec.ts
echo '--- migration ---'
cat prisma/migrations/20260903130000_resume_roast/migration.sql
echo '--- contracts ---'
nl -ba src/lib/resume-roast/contracts.ts
echo '--- store ---'
nl -ba src/server/resume-roast/resume-roast.store.ts
echo '--- tests ---'
nl -ba src/server/resume-roast/resume-roast.store.spec.ts




Sol review found two contract-level issues before I can accept the gate:
- Moderate — [contracts.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/lib/resume-roast/contracts.ts): generated and persisted strings are unbounded, which leaves the route/UI exposed to oversized model output even though shape validation passes.
- Moderate — [contracts.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/lib/resume-roast/contracts.ts): the session event does not identify cache hits, so the client cannot represent the required cached-result state from the validated stream contract.
- Low — [resume-roast.store.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-roast.store.ts): cache-key UUID/prompt-version and custom lease duration are only checked for truthiness, not bounded format/range.
I’m sending these concrete fixes back to the same Terra owner and will rerun the gate afterward. The composite owner/version FK and token-guarded write transitions are otherwise sound.




Persistence versioningfinished

Ran nl -ba src/lib/resume-roast/contracts.ts | sed -n '60,230p'
nl -ba src/server/resume-roast/resume-roast.store.ts | sed -n '80,320p'
pnpm exec prisma validate
pnpm exec vitest run src/server/resume-roast/resume-roast.store.spec.ts
pnpm exec eslint src/lib/resume-roast/contracts.ts src/server/resume-roast/resume-roast.store.ts src/server/resume-roast/resume-roast.store.spec.ts
git diff --check




Persistence gate accepted after fixes. I independently reran schema validation, the focused store suite (9/9), owned-file lint, and diff checks; the migration is additive, the cache key is complete, and database-level ownership prevents a roast from referencing another user’s resume revision.
Next is the isolated deterministic domain milestone: it will build compact, explainable evidence/signals from the already stored structured resume only—no upload, reparse, or AI call.




Resume signalsstarted working

The signal contract is now concrete: a null-safe builder produces only {evidence, warnings, topSkills, signals} with deterministic evidence IDs. Identity, filename, contact data, raw document text, and any second parsing path are excluded by design. The writer is finishing fixture coverage for weak through difficult-to-roast resumes before I review the actual heuristics.




Resume signalsfinished

The deterministic milestone is back with 10 focused tests. I’m reviewing the implementation now for false metric claims, unsafe truncation, unstable anchors, accidental identity leakage, and whether “strong” resumes can genuinely produce low-criticism signals rather than being forced into a weakness template.




Ran nl -ba src/server/resume-roast/resume-signals.ts
nl -ba src/server/resume-roast/resume-signals.spec.ts
pnpm exec vitest run src/server/resume-roast/resume-signals.spec.ts
pnpm exec eslint src/server/resume-roast/resume-signals.ts src/server/resume-roast/resume-signals.spec.ts
git diff --check -- src/server/resume-roast/resume-signals.ts src/server/resume-roast/resume-signals.spec.ts




The signal gate has one correctness finding:
- Moderate — [resume-signals.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-signals.ts): every repeated first word is treated as a repeated “verb.” Two bullets beginning with “The,” “A,” or a project noun would become a fabricated criticism signal, which conflicts with the feature’s honesty requirement.
I’m having the same owner restrict normalization to an explicit conservative action-verb vocabulary and add a negative fixture. All other reviewed properties—null missing-resume behavior, deterministic anchors, bounded evidence, metric/date distinction, and identity/file exclusion—are acceptable.




Resume signalsfinished

Ran commands


A second gate review uncovered an early-career edge case before generation:
- High — [resume-signals.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-signals.ts): education is omitted from the grounded evidence catalog. A valid internship/new-grad resume containing education and skills but no experience/project bullets would have no legal evidence anchor, forcing either a fabricated strength or a generation failure.
I’m keeping the gate open and adding education as grounded context evidence while explicitly excluding it from bullet/metric/long-bullet statistics. This preserves honest feedback for the requirements’ “Internship or New Grad” target without pretending education needs quantified impact.




Resume signalsfinished

Ran nl -ba src/server/resume-roast/resume-signals.ts | sed -n '8,190p'
rg -n "education-only|education" src/server/resume-roast/resume-signals.spec.ts | tail -20
pnpm exec vitest run src/server/resume-roast/resume-signals.spec.ts




The resume-signal gate is accepted after the early-career fix; 12 focused tests pass under Sol rerun. Education now supplies legal grounding without contaminating bullet metrics.
I’m moving to the single-request generation boundary. This milestone will add the versioned server prompt, strict post-validation against evidence/signal anchors, invented-number and fake-score rejection, person/protected-trait safety checks, and caller cancellation propagated through both existing AI providers.




Roast generationstarted working

The generation writer is working across the service and shared provider cancellation path. The important guardrail here is that no semantic event or cache write will ever see raw model fragments: the full object must first pass Zod, evidence-anchor checks, rewrite-number checks, and humour/safety checks. A caller abort is being distinguished from a timeout so it is never retried as transient work.




Roast generationupdated

The implementation is unblocked and has reached verification. The shared provider change now aborts the underlying Gemini/Groq request, classifies user disconnects as non-retryable cancellation, and preserves timeout retries. I’m waiting for the focused suites, then I’ll inspect those control paths and the grounding regexes directly rather than relying on the summary.




Roast generationupdated

Milestone 3 reports 22 focused tests passing and is now at the Sol gate. I’m reviewing the concrete provider abort logic, ensuring a cancellation cannot trigger another attempt, checking that timeout cleanup cannot leak listeners, and adversarially reading the output validator for fabricated scores, invented rewrite metrics, unsafe humour, and signal-anchor spoofing.




Roast generationfinished

Read files, ran commands


Sol’s generation gate found three issues that must be resolved:
- High — [resume-roast.generator.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-roast.generator.ts): the generator does not set maxAttempts: 1, so the provider’s default retry budget can issue multiple paid model requests for one roast, violating the explicit one-request cost contract.
- High — [resume-roast.generator.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-roast.generator.ts): an empty evidence catalog still calls the model even though no output can satisfy the grounding contract; that wastes inference and invites fabricated feedback.
- Moderate — [resume-roast.generator.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/resume-roast/resume-roast.generator.ts): fake-score detection misses common forms such as 7/10, 85 out of 100, and 90% match.
- Moderate — [groq.provider.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/server/ai/providers/groq.provider.ts): cancellation/timeout behavior changed in a shared live-interview provider but has no direct regression tests.
I’m returning these to the same owner. The abort cleanup, safe error propagation, evidence/rewrite validation, and untrusted prompt boundary otherwise pass review and Sol’s 26-test rerun.




Roast generationfinished

Ran nl -ba src/server/resume-roast/resume-roast.generator.ts | sed -n '20,210p'
nl -ba src/server/ai/providers/groq.provider.spec.ts
rg -n "maxAttempts|empty evidence|7/10|out of 100|business metrics|curly" src/server/resume-roast/resume-roast.generator.spec.ts
pnpm exec vitest run src/server/resume-roast/resume-roast.prompt.spec.ts src/server/resume-roast/resume-roast.generator.spec.ts src/server/ai/providers/gemini.provider.spec.ts src/server/ai/providers/groq.provider.spec.ts src/server/ai/strict-json-schema.spec.ts
pnpm exec tsc --noEmit
git diff --check




The generation gate is accepted after fixes. Sol reran 31 focused tests: one paid request is now enforced, empty evidence fails before inference, score/probability variants are rejected while real business metrics remain valid, and both Gemini and Groq cancellation paths are covered.
The next writer owns the authenticated orchestration and SSE boundary: current resume revision lookup, target persistence, lease/cache decisions, safe generation completion/failure, event validation, disconnect propagation, delete, and route-level auth/rate limiting.




Roast apistarted working

The API milestone is in progress with one writer. The route contract deliberately separates prepare from finish: authentication, target validation, cache hit, and live-lease conflict happen before response headers; only a claimed generation runs inside the stream. This keeps normal errors as normal HTTP responses while still letting body cancellation abort the model and token-scope the failure cleanup.




Roast apiupdated

The API implementation is built and the writer is now adding the service/route tests. An owner-propagation mistake was caught during its own pass and corrected before the suite. I’ll still verify every database call is keyed from server-derived auth, that the client cannot choose a resume version or prompt version, and that cache hits cannot cross target or user boundaries.




Roast apifinished

Milestone 4 reports 44 focused tests passing and is at the Sol gate. I’m inspecting the full service and stream code now, including the race where regeneration supersedes an older token, cancellation before and after headers, cached-result serialization, safe terminal errors, and whether rate limiting accidentally leaves a generation lease stranded.




Read files, ran a command


Context automatically compacted



Milestones 1–3 have passed Sol review. I’m now inspecting the authenticated streaming and cache integration itself—especially cancellation races, ownership boundaries, event validation, and whether partial failures can leave poisoned cache state—before I allow the UI milestone to begin.




Read files, ran commands


Sol review gate 4 found one correctness issue:
- High — [route.ts](/Users/nikhilverma/Desktop/prod/AI system design/src/app/api/resume-roast/route.ts):91 registers an abort listener without first checking requestSignal.aborted. A disconnect in the narrow window between claim acquisition and stream construction can be missed, allowing an unnecessary private model request to continue and hold its lease.
Ownership, cache partitioning, validated event/persistence boundaries, safe logging, and stale-generation token checks otherwise look sound so far. I’m sending this concrete race back to the API owner with a regression-test requirement; UI work remains gated.




Roast apiupdated

Ran commands


Roast apifinished

Read files


Gate 4 is accepted: the high cancellation race is fixed and the focused service/stream/route suite passes 19/19 under Sol’s rerun. I’m starting the interface milestone with frozen server and event contracts; its writer owns only the route, Resume Roast components, navigation registration, and their UI tests.
