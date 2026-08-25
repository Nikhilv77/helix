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

-   Hint
-   Explain
-   **Ask someone**

Human help should remain part of Practice rather than becoming a
separate community product.

### 2. Candidate requests help

When **Ask someone** is clicked:

> **Need a hand with LRU Cache?**\
> We'll notify someone who's already solved this problem.

Trailgrad already has useful context:

-   Problem
-   Programming language
-   Current code
-   Test results/errors
-   Time spent
-   Previous hints
-   Relevant learning context

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

-   Already solved the same problem
-   Performed well on it
-   Know the relevant language/topic
-   Are available/recently active
-   Eventually have a good helper reputation

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

-   Question
-   Current code
-   Programming language
-   Test output
-   Errors
-   Learner's stated issue
-   AI-generated stuck summary

Initially, the helper should **not directly edit the learner's code**.

Later versions can add:

-   Collaborative cursor
-   Line highlighting
-   Annotations
-   Suggested snippets
-   Temporary shared editing

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

-   Trailgrad XP
-   Helpfulness rating
-   Mentor levels
-   Interview credits

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

-   Instant leave
-   Block
-   Report
-   Session time limits
-   Reputation
-   Request rate limits
-   No unsolicited DMs
-   No personal contact information exposed by default
-   Post-session helpfulness rating

Communication should remain contextual to the requested problem.

## What Not to Build

Do not turn this into:

-   Community feed
-   Followers/following
-   Public posting platform
-   Discord-style channels
-   Random chat
-   Generic networking
-   Random pair programming
-   Permanent DMs

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
