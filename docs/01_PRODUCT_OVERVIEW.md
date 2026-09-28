# 1. Product overview

## What Trailgrad is

Trailgrad helps software engineers prepare for technical interviews. It is built around three
ideas:

1. **Preparation starts from the learner's own resume.** The interviews and practice plan are
   based on what the person has actually built, and on the role and level they are aiming for.
2. **A teacher, not a chatbot.** Each learner picks one of ten AI teachers with its own name,
   face, voice, and manner. The teacher introduces sessions, asks the interview questions, and
   reads out results.
3. **You're never completely stuck.** When hints are not enough, another learner who has solved
   the same question can join a live call and help (Trailmate).

Put together, Trailgrad is an **escalation ladder**: solo practice, then AI interviews, then peer
help, then expert mentors. Each step is there for when the one before it is not enough.

Scores are there to guide practice. They are not hiring decisions and the product says so.

## Who it is for

- Students and early-career engineers preparing for their first software roles.
- Working engineers moving to a new company or level who want structured, honest practice.
- The first users are expected in India, but nothing in the product is India-specific.

## The learner's journey

```text
Sign up (Clerk)
  → Onboarding: pick a teacher → pick a level → upload resume → review what was found
  → Welcome on the home page (teacher greeting, Overview tour)
  → Practice tracks (DSA, Core Technical, Applied Engineering, Architecture & Design,
    AI/ML, Frontend, Data) with checkpoint assessments
  → Personalised mock interviews (DSA, three technical rounds, Resume & Behavioral, Final Mock)
  → Reports per round, overall Progress, Resume Roast
  → Stuck? Ask a Trailmate for live help
```

## Teachers

Ten personas live in `src/lib/avatars/personas.ts`: Maya, Claire, Daniel, Olivia, James, Pooja,
Alex, Sophia, Ryan and Ethan. Each has a tagline ("Formal, structured, no surprises"), an avatar,
and a voice. Maya is the default and also the in-product guide who writes stuck summaries. Fixed
lines (greetings, intros, hand-offs) are pre-recorded MP3s; anything that depends on the learner
is spoken live. See [AI, voice and scoring](04_AI_VOICE_AND_SCORING.md#voice).

## Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Home / Overview | Today's plan, streak, next session, welcome tour after onboarding |
| `/onboarding` | Onboarding | Teacher, level, resume upload and review |
| `/practice` and `/practice/<track>` | Practice | Guided tracks with lessons, questions and checkpoint assessments |
| `/dsa-questions` | DSA question bank | Browse and solve DSA problems in the code workspace |
| `/interviews` | Interviews | The six personalised rounds and their status |
| `/interview/<kind>` | Live interview | Voice or text interview room (DSA, design, fundamentals, hiring manager, resume, technical projects) |
| `/reports` | Reports | List of finished rounds; each opens a detailed report with a PDF export |
| `/progress` | Progress | Readiness, streaks, activity, strengths and gaps across everything |
| `/resume-roast` | Resume Roast | A recruiter-style score out of 10 and a blunt, specific roast with rewrites |
| `/trailmate` | Trailmate | Help given and received, top Trailmates, leaderboard, live help rooms |
| `/trailguide`, `/mentors` | Trailguide | Human mentorship landing page; booking is "Coming soon" (contact by email) |
| `/profile` | Profile | Resume-derived profile, cover and avatar |
| `/manage` | Manage account | Notifications, Trailmate availability, data and account deletion |
| `/operations/interviews` | Operations | Operator-only interview health view |
| `/blog`, `/privacy`, `/terms` | Marketing and legal | Public pages |

## What makes it different

- **Grounded questions.** Interview blueprints come from the resume and target role, and follow-ups
  stay inside the chosen blueprint.
- **Scores computed in code.** The model reports what it saw against a rubric; weighting,
  caps, and the final number are deterministic. The same answer gets the same score. See
  [scoring](04_AI_VOICE_AND_SCORING.md#scoring).
- **Human language.** Reports, roasts, and feedback are written the way a senior engineer or
  recruiter would say them, without AI filler. Gaps are phrased as the next thing to practise
  ("Next time, explain why you chose this approach over an alternative.").
- **Peer help tied to the exact question.** Trailmate only invites people who have solved that
  question, and prefers people who are online now.

## Business status

- Hosted on Vercel Hobby with Neon Postgres. There is no production user data yet beyond testing.
- Free today. Pricing is undecided and is on the roadmap
  ([Future scope](09_FUTURE_SCOPE.md#monetisation)). The principles already agreed: practice and
  peer help stay free, voice interviews are the thing to meter, and mentor sessions are paid per
  use.
- Trailguide (paid human mentors) is a landing page only.
- Built and run by a solo founder.
