# Trailgrad --- Contextual Peer Help

## Core Idea

Add a lightweight human-help layer directly inside Trailgrad's Practice
experience.

When a candidate is stuck and AI hints or explanations are not enough,
they can request help from another Trailgrad user who has already solved
that problem.

This is **not a generic community, social feed, or random
pair-programming feature**.

> **You're never completely stuck.**

AI remains the instant/default helper. A real person becomes an optional
escalation when the candidate wants a human explanation.

## Core Flow

### 1. Candidate gets stuck

Inside a practice problem:

- Hint
- Explain
- **Ask someone**

Human help should remain part of Practice rather than becoming a
separate community product.

### 2. Candidate requests help

When **Ask someone** is clicked:

> **Need a hand with LRU Cache?**\
> We'll notify someone who's already solved this problem.

Trailgrad already has useful context:

- Problem
- Programming language
- Current code
- Test results/errors
- Time spent
- Previous hints
- Relevant learning context

The learner should not need to explain everything manually.

### 3. AI prepares the request

Maya can summarize where the learner appears to be stuck before
notifying helpers.

Example:

> **LRU Cache · Java**\
> They understand HashMap + doubly linked list but aren't sure how
> `get()` should move a node to the MRU position without breaking
> links.\
> **Current attempt:** 18 min\
> **Estimated help:** \~5 min

### 4. Notify qualified users

Do not notify random users. Prefer people who:

- Already solved the same problem
- Performed well on it
- Know the relevant language/topic
- Are available/recently active
- Eventually have a good helper reputation

Example notification:

> **Someone needs help**\
> LRU Cache · Medium · Java\
> Stuck on maintaining O(1) eviction.\
> You solved this previously ✓
>
> **Help them** · **Not now**

Helping is always optional.

### 5. Helper accepts

The learner receives:

> **Daniel is ready to help**\
> Solved LRU Cache ✓\
> **Join voice**

The learner should be able to continue working while waiting rather than
sitting on a blocking matchmaking screen.

### 6. Live contextual help

Keep both users inside the existing Practice interface.

The helper joins through voice while viewing a synchronized, preferably
read-only, version of the learner's practice state.

The helper can see:

- Question
- Current code
- Programming language
- Test output
- Errors
- Learner's stated issue
- AI-generated stuck summary

Initially, the helper should **not directly edit the learner's code**.

Later versions can add:

- Collaborative cursor
- Line highlighting
- Annotations
- Suggested snippets
- Temporary shared editing

## Avoid Full Screen Sharing Initially

Trailgrad already owns the editor and problem UI, so traditional desktop
screen sharing is unnecessary for the MVP.

A synchronized editor is safer and cleaner because it avoids exposing
browser tabs, desktop notifications, files, personal information, and
unrelated pages.

Full screen sharing can be considered later if users genuinely need it.

## Cold-Start Strategy

The biggest risk is insufficient concurrent users.

Do not promise:

> Connect with someone instantly.

Instead:

> **Ask the community**\
> We'll notify people who've solved this problem.

The learner can continue solving or leave the page.

If someone accepts later:

> **Someone is ready to help with LRU Cache**

If nobody is available:

> **No one is available yet --- continue with Maya**

AI remains the guaranteed fallback.

## Helper Incentives

Helpers need a reason to participate.

Possible rewards:

- Trailgrad XP
- Helpfulness rating
- Mentor levels
- Interview credits

Example:

> **Helped 14 candidates**\
> ⭐ 4.8 helpfulness\
> **Mentor Level II**

A strong incentive could be:

> **Help someone for 5--10 minutes → earn interview credits**

This creates the loop:

**Practice → Learn → Become capable → Help others → Earn credits →
Practice more**

Strong candidates therefore become contributors instead of simply
leaving after improving.

## Trust & Safety

Live voice between strangers creates moderation responsibilities.
Eventually include:

- Instant leave
- Block
- Report
- Session time limits
- Reputation
- Request rate limits
- No unsolicited DMs
- No personal contact information exposed by default
- Post-session helpfulness rating

Communication should remain contextual to the requested problem.

## What Not to Build

Do not turn this into:

- Community feed
- Followers/following
- Public posting platform
- Discord-style channels
- Random chat
- Generic networking
- Random pair programming
- Permanent DMs

The interaction exists because:

> **Candidate A is stuck on something Candidate B already understands.**

Once the problem is resolved, the interaction can end.

## Recommended Rollout

### Phase 1 --- Async Help Requests

Build the Ask Someone button, AI-generated stuck summary, qualified
helper matching, notifications, accept/decline, and AI fallback.

This validates whether candidates actually request and provide help.

### Phase 2 --- Live Voice

Add temporary voice sessions, leave controls, session status, and
post-session ratings once enough requests are being accepted.

### Phase 3 --- Shared Practice Context

Add live code synchronization, helper cursor, line highlighting, and
annotations. Keep direct helper editing disabled initially.

### Phase 4 --- Reputation & Rewards

Add helper XP, ratings, mentor levels, interview credits, and
reliability signals.

### Phase 5 --- Smarter Matching

Match using problem solved, language, topic strength, skill level,
availability, reputation, previous helpfulness, and estimated wait time.

Only consider full screen sharing or richer collaboration after these
stages prove useful.

## Product Positioning

Do not market this primarily as:

> Join the Trailgrad community.

Better:

> **Stuck? Ask someone who's solved it.**

or:

> **AI when you need an answer. A human when you need an explanation.**

The larger product promise becomes:

> **You're never completely stuck.**

This keeps AI interviewing and practice as Trailgrad's core while
allowing a useful human network to emerge naturally around moments where
human explanation adds value.

---

## Implemented Ask Someone Feature --- Parts 1--9

This section describes the feature as it is implemented now. The nine parts
form one lifecycle: capture a learner's situation, find a qualified person,
let exactly one helper accept, open a short private conversation, share only
the relevant workspace context, and end safely with optional feedback.

### Part 1 --- Request data model and lifecycle

This part gives every request a durable identity and a safe state machine.

A `HelpRequest` records:

- The learner and DSA question
- Programming language
- A snapshot of the workspace at the time of asking
- Maya's stuck summary
- The helper who claims it
- Claim, resolution, expiry, and closing timestamps

The lifecycle is:

`OPEN -> CLAIMED -> RESOLVED`

An `OPEN` request can also become `EXPIRED` after 10 minutes or `CANCELLED` when
the learner withdraws it. A helper can return a `CLAIMED` request to `OPEN`
only before a help room has started.

Claims are concurrency-safe. If two helpers click **Help them** together, the
database updates the row only while it is still `OPEN`. One helper wins and
the other receives **Someone else got there first**. The same database layer
also prevents duplicate live requests for the same learner and question.

A `HelpSession` is separate from the request. It is created only when one of
the two participants joins the conversation, so merely claiming a request does
not start an empty room or its timer.

### Part 2 --- Context capture and AI stuck summary

When the learner presses **Ask someone**, Trailgrad captures the information a
helper would otherwise spend the first few minutes asking for:

- Current code and selected language
- Latest test output and number of failing tests
- Time spent on the problem
- Number of Maya hints already used
- The question and its expected problem-solving pattern

The request opens before the AI call. Maya then prepares a short briefing in
the background containing:

- A one-line headline
- What the learner already understands
- The specific symptom blocking them
- An estimated help duration
- A useful opening question for the helper

The prompt is intentionally written to describe the blockage without revealing
the solution. If Gemini is unavailable or produces invalid output, a factual
fallback summary is created from the captured context. An AI failure therefore
does not lose the human-help request.

### Part 3 --- Learner-facing Ask Someone experience

The **Ask someone** action lives inside the DSA workspace beside the normal
practice controls. It is an escalation after hints and explanations, not a new
community area.

The learner can:

- See how many qualified helpers are currently eligible
- Open a request without leaving or locking the editor
- Continue coding while the request remains open
- Withdraw an unclaimed request
- Resume the request state after refreshing or returning to the question
- See when somebody has claimed it and join the conversation

The button requires a non-empty attempt. Opening is rate-limited, and the
server independently validates the question, language, code size, test data,
and ownership. At the current limit, one learner may open three requests in a
30-minute window.

An optional concierge notification can also alert the product operator during
the early-liquidity stage. This does not replace the real matching flow.

### Part 4 --- Helper eligibility and matching

Trailgrad does not send a request to random users, but solving the exact
question inside Trailgrad is not mandatory. A helper qualifies through at least
one evidence path:

- Completed the exact question with a test-backed score of at least 80%
- Strong results on multiple questions using the same DSA pattern
- Demonstrated DSA-pattern or general problem-solving performance in Trailgrad
  interviews
- A verified, credible profile showing external DSA-platform experience, or
  substantial experience in the learner's programming language

Every helper must still have help notifications enabled, be currently
available, and have no block relationship with the learner in either direction.

Eligible helpers are ranked using the strength of their qualification evidence,
how recently that evidence was demonstrated, performance in the learner's
language, experience with the same DSA pattern, and overall problem-solving
breadth. An exact Trailgrad solve normally ranks highest, but it is an advantage
rather than a hard gate. Matching language also improves rank without excluding
cross-language helpers.

The top three candidates receive the first notification. Eligibility is checked
again inside the claim operation, so an old inbox page cannot bypass a new
block, expiry, competing claim, or changed qualification.

### Part 5 --- Notification infrastructure

The workspace header now has an in-app notification inbox with:

- An unread badge
- Recent notifications and links to the relevant screen
- Read acknowledgement when visible items are opened
- Duplicate suppression for retried deliveries
- A **Help requests on/off** preference for helpers

Notifications cover these events:

- A qualified helper is asked to help
- A helper claims the learner's request
- A conversation is resolved
- An unanswered request expires

The in-app inbox is the active delivery mechanism. It polls quietly so a
temporary connection failure becomes a delayed notification rather than a lost
one.

Resend email support is implemented as dormant infrastructure for later use. It
includes recipient opt-out checks, idempotency, leased delivery attempts,
bounded retries, and backoff, but it sends nothing when `RESEND_API_KEY` and the
sender address are not configured. This preserves the future email path without
requiring email now.

### Part 6 --- Profile helper activity, inbox modal, decline, and safe claim

The Profile page includes a compact helper activity card such as **Helped 2
people**. It also shows when matching requests are available or already
accepted. Clicking the card opens the full helper inbox in a modal, so helping
does not need a separate destination in the workspace navigation. The modal
shows requests supported by the helper's exact-question, same-pattern,
interview-performance, or verified-profile evidence, and refreshes on focus and
every 30 seconds. Old `/help` links redirect to this Profile modal so existing
notifications and bookmarks still work.

Before claiming, a helper sees enough to decide responsibly:

- Question, difficulty, and language
- AI headline and description of the blockage
- Time already spent, hints used, and failing-test count
- Estimated time required

The learner's raw code and test output are deliberately hidden at this stage.

The helper can choose:

- **Help them** --- atomically claim the request
- **Not this one** --- persistently decline it so it does not reappear
- **Hand back** --- release a claim before a session starts
- **Mark as helped** --- resolve the request

After claiming, the helper receives the complete saved workspace context and
Maya's suggested opening question. The learner is notified that someone is
ready.

### Part 7 --- Private LiveKit help room

A claimed request can open a temporary LiveKit voice room. It reuses the app's
existing LiveKit project but does not dispatch Maya or any interview agent.

The room is restricted to:

- Exactly two seats: the learner and the assigned helper
- Microphone audio only
- Only the claimed participants
- One identity per seat, preventing extra tabs from becoming extra people
- A 30-minute maximum session duration
- Short empty-room and departure timeouts

Tokens expire with the remaining session time. Either participant can leave,
which ends the conversation for both and resolves the request. The client also
checks server time periodically so background-tab timer throttling cannot make
an expired call appear active.

### Part 8 --- Shared read-only workspace context

Once the request is claimed, the helper sees:

- The question statement
- Maya's stuck summary
- The code captured when the learner first asked
- The captured test output and failing-test count
- The learner's current code and test state after they join

Current workspace revisions travel over the existing LiveKit data connection,
not through a new polling endpoint. The learner sends an initial snapshot and
then sends changes approximately every 900 milliseconds. A full snapshot is
resent when the helper joins or the room reconnects.

Large or Unicode source files are split into bounded packets and reassembled
atomically. The helper never sees half of a revision. Packets carry a dedicated
topic, are addressed only to the helper seat, validate the sender identity and
payload, and use local receipt time for the live/stale indicator.

This is intentionally read-only. The helper sees a code viewer rather than an
editor, the helper's room token cannot publish workspace data, and there is no
CRDT, helper editing, screen sharing, or cursor control in this version.

### Part 9 --- Trust, safety, limits, and rating

Both participants have safety controls directly beside the live interaction:

- **Leave** ends the room immediately
- **Block** ends the interaction and prevents all future matching in both
  directions
- **Report** records a reason and optional detail, blocks the other person, and
  ends the interaction
- The 30-minute cap prevents an open-ended obligation
- Independent request, room-token, and safety-action rate limits reduce abuse

The server derives the other participant from the shared request. A client
cannot supply an arbitrary user id to report. Repeated reports are idempotent,
and reports enter an operator-only review queue rather than automatically
banning somebody based only on report count.

After a normal conversation in which both seats actually connected, the
learner can answer **Was that useful?** with one to five stars or skip it. The
rating and skip state are persisted, so the prompt does not reappear forever.
Only the learner rates the help experience; the learner is not graded for
having asked.

## End-to-End Example

1. A learner works on **LRU Cache**, runs tests, uses Maya hints, and remains
   stuck.
2. They press **Ask someone**. Trailgrad validates the action, stores a bounded
   snapshot of the context, and creates an `OPEN` request without interrupting
   the editor.
3. In parallel, Maya writes a non-solution briefing and the matching service
   ranks people with exact-question, same-pattern, demonstrated-performance, or
   credible profile evidence.
4. Up to three top helpers receive an in-app notification. The learner keeps
   coding while waiting.
5. A helper clicks their **Helped N people** card on Profile, reads the request
   preview in the modal, and presses **Help them**. The atomic claim makes them
   the only assigned helper.
6. The learner receives **Someone is ready to help**. Both participants may now
   join the private two-person voice room.
7. The helper initially sees the saved code from when the request was created.
   Once the learner connects, it changes to a live, read-only view of their
   current code and latest test result.
8. They discuss the problem. The helper explains and asks questions but cannot
   edit the learner's code.
9. Either person leaves, or the 30-minute cap ends the room. The request becomes
   `RESOLVED`, and the learner can optionally rate whether the help was useful.
10. If nobody claims the request within 10 minutes, it becomes `EXPIRED`, the
    learner is notified, and Maya remains available as the guaranteed fallback.

## Intentionally Deferred

The current implementation does not include credits, XP, mentor reputation,
helper payouts, collaborative editing, full screen sharing, permanent direct
messages, or an asynchronous explanation corpus. Email delivery is retained but
unconfigured for now. These additions should follow measured demand and helper
liquidity rather than being required for the first complete Ask Someone loop.
