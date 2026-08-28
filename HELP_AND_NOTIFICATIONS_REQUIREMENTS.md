# Trailgrad Notifications and Help Hub

## Purpose of this document

This is the implementation handoff for two connected Trailgrad features:

1. The teacher-led notification system that is already implemented.
2. The next Help experience: a dedicated page for help received, help given,
   top helpers, badges, and safe question-based conversations.

Another agent should be able to use this document without reconstructing the
product discussion. Read `trailgrad-contextual-peer-help.md` as well before
changing the existing Ask Someone lifecycle; it contains the detailed Parts
1–9 implementation and its safety decisions.

## Product context

Trailgrad is an interview-preparation product with:

- Resume-based onboarding and a selected AI teacher/persona
- Personalized Practice roadmaps
- DSA and non-DSA question workspaces
- AI hints, evaluations, drafts, progress, interviews, and readiness signals
- A contextual peer-help system for candidates who remain stuck
- A shared workspace notification inbox

The teacher is supposed to feel like an active coach rather than a decorative
avatar. Notifications should therefore be useful, specific, and based on the
candidate's saved work. Peer help should feel like a focused learning tool,
not like a social network.

The product promise tying these systems together is:

> AI when you need an answer. A human when you need an explanation.

## Status legend

- **Shipped** means code and migrations exist in the repository.
- **Configuration required** means the code exists but an external service or
  environment value must be configured.
- **Implemented, verification pending** means the code exists and automated
  gates pass, but production-like account/browser checks are still outstanding.
- **Planned** means this document specifies the next implementation; it is not
  evidence that the feature exists.

---

# Part A — Teacher and system notifications

## User-facing behavior

### First onboarding notification — shipped

After onboarding completes, the candidate receives one notification from the
teacher they selected during onboarding.

The notification:

- Is created after the onboarding response so Clerk or email latency cannot
  block successful onboarding
- Uses the selected teacher's name and the candidate's first focus area
- Links to `/practice`
- Is idempotent through the stable subject id `onboarding-v1`
- Falls back to Maya if a legacy or unknown teacher id cannot be resolved
- Also requests a welcome email when email delivery is enabled

The current welcome email introduces the teacher as being from Trailgrad,
mentions that the resume and projects were reviewed, explains that a focused
practice path is ready, and directs the candidate to begin one question.
It is delivered as a responsive, single-column HTML template with a plain-text
fallback, an inline Trailgrad logo, and a dark Practice call-to-action. The
visible sender is the selected teacher (for example, `Ethan from Trailgrad`),
while the verified Resend mailbox configured in `NOTIFICATION_FROM_EMAIL`
remains the actual sender address.

Primary implementation:

- `src/app/api/onboarding/complete/route.ts`
- `src/server/notifications/teacher-notification.service.ts`
- `src/server/notifications/email-template.ts`

### Daily teacher coaching — shipped

An authenticated cron route creates one or two in-app coaching notifications
per candidate per day. The primary message alternates between focused practice
and warmth so the teacher does not feel like a question-delivery bot:

- A recommendation for an active, incomplete roadmap question on practice days
- An occasional short encouragement or motivational thought from the selected
  teacher, deterministically scheduled about once every three days
- An optional reminder when the candidate has an unfinished draft or attempt

The copy is deterministic and uses saved roadmap/question evidence. It does
not make an LLM call, so retries produce the same recommendation and do not
create different advice.

Supported candidate states include:

- Active question but no unfinished work: recommend the next question
- Active question plus unfinished work: recommend one question and remind the
  candidate about the saved unfinished question
- No eligible question: give one small, general Practice action
- Encouragement day: replace the primary Practice action with a warm note; an
  evidence-backed unfinished-work reminder may still appear separately

Notifications link directly to the relevant DSA or non-DSA workspace whenever
possible. Stable per-day subject ids prevent duplicate rows if cron is retried.

Current schedule:

- `vercel.json` calls `/api/cron/teacher-notifications` at `0 4 * * *`
- The route requires `Authorization: Bearer <CRON_SECRET>`
- The implementation processes a bounded batch of 250 candidates
- A malformed profile/roadmap does not stop later candidates in the batch

Primary implementation:

- `src/app/api/cron/teacher-notifications/route.ts`
- `src/server/notifications/teacher-notification.service.ts`
- `vercel.json`

### Notification inbox — shipped

The workspace notification control supports:

- A recent-notification list
- An unread count
- Marking selected notifications or all notifications as read
- Links into the relevant product context
- Help-notification and teacher-notification preferences
- Quiet polling so a temporary connection issue delays rather than loses an
  in-app notification

Primary implementation:

- `src/components/workspace/chrome/notification-inbox.tsx`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/preferences/route.ts`
- `src/server/notifications/notification.service.ts`

## Notification kinds — shipped

The Prisma `NotificationKind` enum currently contains:

- `TEACHER_WELCOME`
- `TEACHER_RECOMMENDATION`
- `TEACHER_ENCOURAGEMENT`
- `TEACHER_REMINDER`
- `HELP_REQUEST_OPENED`
- `HELP_REQUEST_CLAIMED`
- `HELP_REQUEST_RESOLVED`
- `HELP_REQUEST_EXPIRED`

The notification table is generic and is the durable source of truth. A
failure in email delivery must never remove or roll back the in-app item.

The uniqueness contract is `(ownerId, kind, subjectId)`. Any new notification
producer must provide a stable `subjectId` when replay or retry is possible.

## Preferences — shipped

Candidates can independently disable:

- Teacher recommendations/reminders through `teacherNotificationsEnabled`
- Requests to help others through `helpNotificationsEnabled`

Transactional results of the candidate's own actions remain enabled. For
example, muting requests to help other people must not hide the result of the
candidate's own active help request.

Any future Help Hub preference must extend this distinction instead of adding
one master switch that accidentally hides important lifecycle updates.

## Email through Resend — shipped, configuration required

The application sends email through Resend's REST API. Email delivery includes:

- Clerk email lookup at send time; the app does not copy identity email into
  `CandidateProfile`
- A stable Resend idempotency key based on the notification id
- A durable lease so multiple app instances cannot send the same row together
- Bounded retry attempts and backoff
- Persisted subject/body so a retry sends identical content
- Persisted HTML and visible sender label so styled retries are also identical
- Inline CID logo delivery, avoiding dependence on a publicly reachable image
  URL during local testing
- A settings link for optional notification categories
- Graceful degradation when Resend is not configured

Email is intentionally limited to events worth interrupting the candidate for:

- Teacher welcome after onboarding
- A qualified peer receiving a new help request
- A learner being told that a helper accepted

Daily teacher recommendations and reminders are currently in-app only. Do not
turn every coaching notification into email without a separate product
decision; that would quickly become noisy.

Primary implementation:

- `src/server/notifications/email-channel.ts`
- `src/server/notifications/notification-dispatcher.ts`
- `src/server/notifications/clerk-address-book.ts`
- `prisma/migrations/20260826050000_notification_email_delivery/`
- `prisma/migrations/20260828020000_notification_email_template/`
- `prisma/migrations/20260828010000_teacher_coaching_notifications/`

Required production environment variables:

```env
NOTIFICATION_EMAIL_ENABLED=true
RESEND_API_KEY=re_your_key
NOTIFICATION_FROM_EMAIL="Trailgrad <teacher@updates.yourdomain.com>"
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CRON_SECRET=use-a-long-random-value
```

Never commit real secrets to `.env.example` or any Markdown file.

### BigRock/Hostinger/Gmail clarification

Resend is the sender service. BigRock can remain the domain registrar and DNS
host, and Hostinger or Gmail can remain the provider for human mailboxes.

Add the exact SPF, DKIM, and MX/return-path records shown by Resend at the DNS
provider that owns the domain's authoritative nameservers. If the nameservers
point somewhere other than BigRock, the records must be added there instead.

Prefer a sending subdomain such as `updates.yourdomain.com`. Do not delete the
existing root-domain MX records used for incoming mail, and do not create two
independent SPF TXT records at the same hostname.

## Notification work still worth considering

These items are not required for the current notification feature to work:

- Candidate-timezone delivery rather than one global UTC time
- Cursor-based cron batching beyond the current 250-profile limit
- A dedicated scheduled retry job for email instead of opportunistic retries
  when the inbox API is read
- Delivery/bounce webhooks and an internal delivery-status screen
- Per-category quiet hours
- Push notifications

Do not describe these as shipped.

---

# Part B — Existing contextual peer help

## Simplified interaction revision — active

The primary peer-help experience is intentionally small:

1. A learner with a non-empty attempt chooses **Ask someone**.
   The learner sees a non-blocking fifteen-second delivery countdown and can
   continue editing while the request reaches available helpers.
2. Qualified helpers receive the durable in-app notification plus a compact,
   non-modal toast in the workspace. The visible workspace checks every fifteen
   seconds and immediately on focus, so no page refresh is required.
3. The toast offers exactly **Accept & join** and **Decline**.
4. Accepting performs the guarded claim and opens the dedicated private help
   room. The learner receives a centered, portal-rendered **Helper joined**
   toast with an explicit **Join help room** action. Declining hides the request
   for that helper without affecting others.
5. When the voice conversation ends, the learner sees one small **Did that
   help?** dialog. **Yes** is the primary/default action; **No** is the only
   alternative. These remain stored as compatible positive/negative rating
   values for existing history and helper evidence.
6. Helpful conversations increase the helper's count and simple milestone
   badge. The Help page remains a lightweight record of Help received, Help
   given, the current milestone, and an accepted live conversation.

An unanswered request and its helper notifications last ten minutes. When that
window closes, the request becomes expired, its helper alerts are removed, and
the learner may send one new request. The waiting UI checks this automatically;
no manual Withdraw or page reload is required.

The eligibility re-check, atomic claim, private room authorization, source-code
privacy, block/report controls, call limit, and idempotent notification storage
remain in place. They are security and lifecycle boundaries rather than extra
steps shown to the user.

Inbox polling also reconciles abandoned conversations before matching. A claim
that never begins joining is returned to the open pool after a short grace
period, while a room past the normal call limit is closed and its two accounts
are made available again. This prevents an old `CLAIMED` row from silently
suppressing every later helper notification.

## Current behavior — shipped

The existing system begins inside a DSA question. A learner with a non-empty
attempt can choose **Ask someone**. Trailgrad stores a bounded snapshot of the
code, language, test state, time spent, and hints used; prepares a non-solution
stuck summary; and notifies qualified helpers.

The lifecycle is:

`OPEN -> CLAIMED -> RESOLVED`

An open request can also become `EXPIRED` or `CANCELLED`.

The current implementation includes:

- Server-side ownership validation and rate limits
- Evidence-based helper eligibility and ranking
- Concurrency-safe claiming so only one helper wins
- Persistent decline and pre-session release
- A private, temporary two-seat LiveKit voice room
- Read-only shared learner workspace context
- Leave, block, report, timeout, and operator-review controls
- Optional post-session learner rating
- In-app and selected email notifications

## Dedicated live help room — implemented

Accepted conversations open at `/help/room/<request-id>`. The route is private
to the request's learner and assigned helper and keeps the existing two-seat,
audio-only LiveKit room. It does not publish screen video.

The room contains:

- Voice connection state, mute, leave, and the existing call timer
- A large learner editor: editable for the learner and read-only for the helper
- Live code, selected range, language, test output, and failing-test updates
- An explicit learner-side **Send latest state** action
- Shared typed notes plus a shared drawing canvas on the left
- Existing block and report controls
- The learner's **Did that help?** toast after a real two-person conversation

Shared notes and completed drawing strokes use a local Yjs document. Yjs
updates travel through LiveKit's reliable data channel and are periodically
stored as a bounded binary state in `HelpSession` for reconnects. This requires
no additional hosted collaboration product or subscription: the only variable
usage remains the existing LiveKit traffic and ordinary database storage.

If a helper connected but the learner never joined, ending the abandoned room
after the two-minute minimum wait records one capped availability credit. A
server-enforced timeout preserves the same credit. A no-show cannot be rated as
a completed helpful conversation and therefore cannot manufacture positive
ratings.

The detailed contracts and security decisions live in
`trailgrad-contextual-peer-help.md`.

## Current Help destination — implemented, verification pending

`/help` is now an authenticated, lightweight Help destination inside the
workspace shell. It shows Help received/Help given history, helper milestones,
and an accepted live conversation. Open requests are handled by the compact
workspace toast instead of requiring the helper to monitor this page:

- `src/app/help/page.tsx`
- `src/components/workspace/help/help-hub.tsx`
- `src/app/api/help/history/route.ts`
- `src/app/api/help/overview/route.ts`
- `src/server/help/help-history.service.ts`
- `src/components/workspace/profile/profile-help-card.tsx`
- `src/components/workspace/help/help-inbox.tsx`

New helper-request notifications link to `/help?request=<uuid>`. Existing
`/profile?help=1&request=<uuid>` links remain valid because the Profile modal
has intentionally not been removed.

The Profile entry point can become a compact shortcut to `/help` in a later UI
cleanup, after legacy links have had enough time to age out.

---

# Part C — Dedicated Help Hub requirement

## Product goal — foundation implemented, reputation and conversations planned

Create a separate Help page where a candidate can understand both sides of
their peer-help activity, discover trustworthy helpers, recognise useful
contributors, and ask a focused question.

This page must not become a social feed, follower network, generic messaging
product, or popularity contest. Every interaction should begin with a concrete
learning question and have a clear end.

Recommended route:

```text
/help
```

## Desktop information architecture — planned

The page should contain four primary areas:

### 1. Help overview — implemented, verification pending

The current compact summary cards show:

- Help received
- People helped
- A simple milestone badge based on conversations explicitly marked helpful

Advanced, durably awarded badges and comparative helper reputation remain
planned. The current milestone is deliberately lightweight.

### 2. My help — implemented for current DSA requests, verification pending

The page provides two clear tabs:

- **Help received** — requests the candidate created
- **Help given** — requests the candidate claimed or resolved as helper

Each history item should show:

- Question title, topic/pattern, and language
- Other participant's safe public profile summary
- Current or terminal status
- Asked, claimed, and resolved timestamps where applicable
- Session duration if a session occurred
- Learner rating on help-given rows when disclosure is appropriate
- A direct link back to the relevant question
- Report/block controls where still applicable

Each item keeps its status label, while the simplified page avoids a separate
filter toolbar. History uses stable server-side cursor pagination and a bounded
page size. Declined requests remain excluded because declining does not make
the candidate a participant; released history needs an additive audit record
before it can be represented honestly.

Participant disclosure is intentionally limited to a generic role label,
profile avatar, and headline. No raw participant identifier is returned.

The phrase **help taken** should be rendered as **Help received** in product
copy. It is clearer and sounds more natural.

### 3. Open opportunities — simplified and shipped

New requests appear as a compact workspace toast with **Accept & join** and
**Decline**. The Profile helper inbox remains as a fallback during the
transition, while `/help` displays only a request the helper already accepted.

Raw learner code and test output remain hidden until the authenticated helper
has successfully claimed the request.

### 4. Top helpers — planned

Show a small, high-quality set of profiles rather than an endless leaderboard.
Allow filters such as:

- Overall
- DSA pattern/topic
- Programming language
- System design, frontend, behavioural, or other Practice competency once the
  peer-help request model supports non-DSA questions
- Recent period versus all time

Each profile card may show:

- Trailgrad avatar, safe display name, and headline
- Relevant expertise tags
- People helped
- Accepted/resolved help count
- Helpful rating after the minimum sample threshold
- Earned badges
- Availability or whether new requests are accepted
- **Ask a question** action

Never expose email address, Clerk id, internal `ownerId`, resume text, private
activity, or contact information.

## Ranking contract — planned

Do not rank by raw message count, requests claimed, or time spent in calls.
Those metrics are easy to game and can reward unhelpful behavior.

Use a versioned, server-side score based on trustworthy outcomes, for example:

```text
helperScore =
  accepted/resolved sessions with both participants joined
  + unique learners helped
  + Bayesian-adjusted helpfulness rating
  + recent reliability
  + topic/language evidence relevance
  - upheld report or abuse penalties
```

Required ranking rules:

- Count only valid sessions where both participants actually joined, or an
  accepted async answer was explicitly marked helpful
- Reduce repeat-pair influence so two friends cannot farm the leaderboard
- Apply a minimum activity threshold before a profile enters Top Helpers
- Use Bayesian/Wilson-style adjustment rather than sorting raw averages
- Version the scoring algorithm so historical results can be reproduced
- Calculate ranking on the server; never trust a client-supplied score
- Exclude blocked pairings and sanctioned accounts
- Allow a candidate to opt out of public leaderboard visibility while retaining
  private badge/history records

Topic-specific ranking should favor relevant help, not merely the globally
highest score.

## Badge system — planned

Badges should recognise sustained, helpful behavior rather than activity spam.

Suggested first badge set:

| Badge               | Initial rule                                               |
| ------------------- | ---------------------------------------------------------- |
| First Assist        | First valid, positively completed help interaction         |
| Reliable Helper     | 10 valid resolved interactions with acceptable reliability |
| Practice Mentor     | Helped 25 unique candidates                                |
| Clear Explainer     | Strong adjusted helpfulness after a meaningful sample size |
| DSA Guide           | Strong valid help evidence across DSA questions/patterns   |
| System Design Guide | Strong valid help evidence in system-design questions      |
| Community Pillar    | Sustained high-quality help across multiple periods        |

Badge thresholds are product configuration, not UI constants.

Recommended storage approach:

- Keep badge definitions/versioned thresholds in server-side code or a badge
  definition table
- Persist each award with `ownerId`, badge key, rule version, evidence snapshot,
  source (`AUTOMATIC` or `ADMIN`), and award timestamp
- Enforce uniqueness for one badge tier/rule version per candidate
- Recompute idempotently after a qualifying help interaction is completed
- Do not silently remove an earned badge merely because ranking later changes;
  revoke only through an explicit moderation/admin action with an audit reason

The system should award normal badges automatically. An internal administrator
may grant an exceptional badge, but candidates must not be able to give badges
to friends. Candidate feedback remains a helpfulness rating, not a badge grant.

## Asking a top helper — planned

Top profile cards should support **Ask a question**, but not an unrestricted
**Message** button.

Recommended flow:

1. The learner selects a Practice question or topic.
2. Trailgrad attaches the relevant saved attempt context when available.
3. The learner writes one focused question with a bounded character limit.
4. The chosen helper receives a targeted request and can accept or decline.
5. Acceptance opens a temporary request-bound conversation.
6. The conversation closes when resolved, declined, expired, blocked, or
   reported.

The helper must be able to turn targeted requests off. Rate limits should apply
per learner, per helper, and per time window so popular helpers are not flooded.

For an unavailable or declined preferred helper, offer the learner an explicit
choice to send the request to eligible community helpers. Do not silently
broadcast a request the learner believed was private to one person.

## Chat decision — planned recommendation

Do not build permanent direct messages.

If text conversation is added, it should be a small async thread attached to a
claimed `HelpRequest`:

- Only the learner and assigned helper may read or write
- No thread exists before the helper accepts
- Messages are bounded, rate-limited, timestamped, and server-authorized
- Blocking/reporting immediately prevents new messages
- The thread becomes read-only when the request reaches a terminal state
- Links and personal contact details should be treated carefully
- A retention policy must be decided before launch

The existing LiveKit voice room can remain the richer synchronous option. A
text thread should complement it for short explanations, not become general
chat.

## Data-model direction — planned, not a final migration

Reuse `HelpRequest`, `HelpSession`, `HelpBlock`, `HelpReport`, `Notification`,
and their existing lifecycle wherever possible.

Likely additive fields/tables include:

- A nullable preferred/target helper on `HelpRequest`, plus the learner's
  explicit fallback-to-community choice
- `HelpMessage` for request-bound async messages
- `HelperBadgeAward` for durable automatic/admin badge awards
- A leaderboard visibility and targeted-request preference on
  `CandidateProfile`
- A versioned helper-score aggregate or materialized snapshot once query volume
  justifies it

Do not migrate blindly from this list. First confirm how non-DSA questions will
reference `HelpRequest`, because the current required `questionSlug` relation is
DSA-specific. A generic source type plus nullable DSA/prep references may be
needed before Help can cover every Practice format.

All schema changes must be additive and preserve current requests, sessions,
declines, ratings, reports, and notification links.

## New notification events — planned

The Help Hub will likely require notification kinds for:

- A specifically requested helper receiving a targeted question
- A targeted request being declined
- A new message in an accepted help thread
- A badge being earned
- A preferred helper timing out and community fallback becoming available

Each event needs:

- A stable idempotency subject
- Clear transactional-versus-optional classification
- A deep link into the exact request/thread/badge
- A rate/noise decision before adding it to email

Badge and chat notifications should begin as in-app only. Do not email every
message.

## Privacy, abuse, and moderation requirements — planned and existing

The new page must preserve the existing safety model:

- Server-derived ownership for every history row, thread, report, and block
- Symmetric enforcement of blocks in matching, discovery, targeted asks, and
  conversation access
- No unsolicited conversation before acceptance
- Instant leave, block, and report
- No client-supplied arbitrary user id for safety actions
- Human review for reports; report count alone must not auto-ban a candidate
- Request, message, profile-ask, rating, and badge-trigger rate limits
- Idempotent claim, resolve, rating, message retry, and badge-award operations
- Minimal profile disclosure before acceptance
- No public display of negative reports or private ratings

Top Helpers creates an additional harassment surface. A blocked user must not
be able to discover or target the blocker through the leaderboard.

## Mobile behavior — planned

On small screens:

- Use a compact Help summary followed by tabs
- Keep **Help received**, **Help given**, and **Open opportunities** reachable
  without a wide desktop table
- Render history as stacked cards
- Keep Top Helpers horizontally scrollable only if cards remain fully readable;
  otherwise use a single-column list
- Open request/thread details as a full-height sheet or page
- Keep block/report/leave controls visible during active help

Do not reproduce the entire desktop dashboard grid inside a narrow viewport.

---

# Recommended implementation sequence

## Phase 1 — Help Hub foundation — implemented, verification pending

- Replaced the `/help` redirect with an authenticated dedicated page
- Added Help received and Help given paginated history APIs
- Reused the current helper inbox on the page
- Preserved old Profile-modal and notification deep links
- Added summary counts derived from authorized server queries

## Phase 2 — Reputation and badges

- Define valid-help evidence and score version 1
- Add leaderboard visibility preference
- Add badge award persistence and idempotent evaluator
- Build overall and topic-filtered Top Helpers
- Add badge/profile presentation and empty states

## Phase 3 — Ask a top helper

- Add targeted request preference and request model support
- Add focused-question form with attached Practice context
- Add accept, decline, expiry, and explicit community fallback
- Add targeted lifecycle notifications

## Phase 4 — Request-bound async text

- Add authorized messages only after acceptance
- Add unread state and in-app-only message notifications
- Apply block/report/rate/retention rules
- Make terminal threads read-only

## Phase 5 — Broaden beyond DSA

- Generalize the question reference without breaking existing DSA requests
- Add format-aware context summaries for written, spoken, MCQ, diagram, system
  design, frontend, and behavioural Practice questions
- Add competency-specific helper eligibility and rankings

---

# Acceptance criteria

## Notifications

- Completing onboarding creates exactly one teacher welcome notification even
  when the completion request or background dispatch is retried
- With email disabled, onboarding and help actions still create in-app items and
  never fail because email is unavailable
- With Resend configured, welcome email uses the selected teacher and contains
  an absolute Practice link
- Daily cron creates no duplicate recommendation/reminder for the same
  candidate and date
- Disabling teacher coaching stops future optional teacher recommendations and
  reminders
- Disabling help requests stops future optional invitations to help but does
  not hide lifecycle updates for the candidate's own request
- User A cannot read or mark User B's notification

## Help Hub

- `/help` renders a dedicated authenticated page rather than redirecting to the
  Profile modal
- Help received contains only requests created by the authenticated candidate
- Help given contains only requests claimed by the authenticated candidate
- History is paginated, filterable, and stable across refresh/device changes
- Existing active requests can still be claimed, joined, resolved, blocked,
  reported, and rated using the current safety contracts
- Old notification URLs still land on the correct request
- Top Helpers contains only eligible, visible candidates with sufficient valid
  evidence
- Ranking is calculated server-side and repeated pairings cannot dominate it
- Badges are awarded idempotently from valid evidence and display their reason
- Asking a top helper creates a focused request, not an unsolicited DM
- A helper can decline or disable targeted asks
- Community fallback occurs only after explicit learner consent
- Only accepted participants can access a request-bound thread
- Blocking immediately removes discovery, matching, targeted-ask, and messaging
  access in both directions
- No API response leaks email, Clerk id, raw `ownerId`, resume content, or
  pre-claim learner source code

# Verification gate for implementation agents

Before calling any Help Hub phase complete:

1. Apply the additive Prisma migration to a disposable database and confirm no
   existing help/notification rows are lost.
2. Run Prisma generation and schema validation.
3. Run focused service/API/component tests for every changed lifecycle.
4. Run the full repository test suite and lint/type/build gates used by this
   project.
5. Test two distinct authenticated candidates plus a blocked pairing.
6. Test duplicate submissions, competing claims, refreshes, and two browser
   tabs.
7. Test mobile layout and keyboard navigation.
8. Confirm email-disabled behavior and, separately, Resend sandbox/verified
   domain delivery.
9. Update this document's **Shipped** versus **Planned** labels and record any
   intentionally deferred scope.

## Phase 1 verification record — 2026-08-28

- No Prisma migration was required; Phase 1 reads existing additive help data.
- `prisma validate` and Prisma client generation passed.
- Focused history/API/privacy tests passed.
- Full lint passed.
- Full test suite passed: 141 Vitest tests and 477 Jest tests, with the existing
  10 Jest tests skipped by their configured environment gates.
- Production build passed with `/help`, `/api/help/history`, and
  `/api/help/overview` emitted as dynamic routes.
- Automated tests cover owner scoping, malformed filters/cursors, internal-id
  non-disclosure, and the minimum rating sample.
- A two-candidate production-like browser exercise, blocked-pair UI exercise,
  and Resend sandbox/domain delivery still require configured external accounts
  and should be completed before production rollout.

# Non-goals

Do not add these as part of the Help Hub unless the product direction changes:

- Public social posts or feeds
- Followers/following
- Open-ended or permanent direct messages
- Public contact information
- Random chat or random pair programming
- Helper access to edit learner code
- Full desktop screen sharing
- A leaderboard based only on volume
- Candidate-to-candidate badge granting
- Automatic bans based only on report count
