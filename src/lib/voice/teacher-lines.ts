import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";

/**
 * Everything a teacher says that does not depend on the learner's own data.
 * Each moment has a few phrasings; one is picked when the teacher starts
 * speaking, so it sounds fresh while every phrasing is pre-generated audio
 * (`pnpm voice:lines`). Names, scores, and skills stay on screen instead.
 *
 * Edit freely: a changed or new line plays through live speech until the
 * generator records it.
 */
export const TEACHER_LINES = {
  interviewLaunch: {
    resume: [
      "James is ready for your resume interview. Give clear examples of what you owned, the decisions you made, and the results. He will take over now.",
      "Your resume interview is ready. James will ask about your recent work, so lead with specific examples and what changed because of you. Here he is."
    ],
    fundamentals: [
      "Three parts today. Quick checks across the core areas, then the mechanism behind a few of them, and we finish by diagnosing something real.",
      "Let's go under the framework. I'll start with quick checks, ask you to explain a few mechanisms, then we'll diagnose a real problem together."
    ],
    technicalProjects: [
      "Claire will lead your Core Technical and Projects interview. She'll start with three short technical decisions, then go deep into one project you built.",
      "Your technical and projects round is ready. Claire will warm up with a few technical decisions, then dig into how one of your projects really worked."
    ],
    dsa: [
      "Claire will take your DSA interview. You'll solve two coding problems and explain your approach, complexity, and edge cases. She'll give you quiet space while you code.",
      "Your coding interview is ready. Claire has two problems for you. Think out loud when it helps, and she'll give you room to write the code."
    ],
    systemDesign: [
      "Claire will give you an intentionally incomplete system-design prompt. Ask questions first, then draw and defend the architecture like a real interview.",
      "Your system design round is ready. Start by asking Claire questions about the requirements, then sketch the architecture and defend your trade-offs."
    ],
    hiringManager: [
      "James is ready for your final conversation. Use real examples of how you work with people, handle difficult situations, and make decisions. He will take over now.",
      "Your hiring manager round is ready. James wants honest stories about teamwork, pressure, and judgement. Take a breath, and he'll begin."
    ]
  },
  interviewDebrief: [
    "Your interviewer has reported back to me. Let's walk through what worked and what to improve next. Finishing the interview is progress by itself.",
    "That round is done, and your interviewer has shared their notes with me. I'll show you what landed and where to focus next. Well done for finishing.",
    "I've got the feedback from your interview. Let's look at your strengths first, then the one or two things worth practising next."
  ],
  reportSummary: {
    strong: [
      "Welcome back. You performed really well in your last interview. Keep that same clarity in your next round.",
      "That was a great performance. Your strongest skills came through clearly. Let's keep this momentum going.",
      "Strong work in that interview. You're building a real signal, so hold on to what worked."
    ],
    steady: [
      "Welcome back. Your last interview showed real progress, and your strengths are starting to show. Let's sharpen one area next.",
      "Good effort in that round. The foundation is there. A little focused practice will make the next one stronger.",
      "You're making steady progress. I've noted what worked and one thing to tighten before your next interview."
    ],
    starting: [
      "Welcome back. This interview gives us a useful starting point. Don't be discouraged; this is exactly what practice is for.",
      "Thanks for taking that round. We now know where to begin, and one focused area will make the biggest difference.",
      "Every strong candidate starts somewhere. This report shows exactly what to practise first, so let's take it one step at a time."
    ]
  },
  reportBriefing: {
    prepared: [
      "Check this out. I created a report for you that shows what is working, what needs attention, and what to practise next.",
      "Your report is ready. Read it carefully, then work on the weakness that keeps showing up.",
      "I've put your interview results together. Let's see what's working and what to practise next."
    ],
    strong: [
      "Great job. So far, so good. Your recent rounds show real readiness. Keep your strongest habits, and polish the gap that still repeats.",
      "You're in good shape. Your recent interviews are consistently strong. One recurring gap is all that stands between you and a great round."
    ],
    steady: [
      "Nice progress. Your recent rounds are moving in the right direction. Focus your next practice on the gap that keeps repeating.",
      "You're getting there. Your strengths are showing, and one repeat gap is worth a focused block before your next interview."
    ],
    starting: [
      "This is a good starting point. Your reports now show where to begin. Pick the recurring gap and practise it first.",
      "We've got a clear baseline now. Start with the gap that keeps showing up, and your next round will feel different."
    ],
    empty: ["Take your first interview to unlock your reports."],
    exhausted: ["Your daily interview limit is reached. Come back tomorrow for your report."]
  },
  progress: {
    notStarted: [
      "You haven't solved a practice question yet. Complete one question to start tracking your progress.",
      "Your progress history starts with your first solved question. Pick any suggested question below."
    ],
    notStartedAfterInterview: [
      "Your interview gave us a starting signal. One completed practice question will begin your progress history.",
      "You've already taken an interview. Solve one practice question and I'll start tracking your pace."
    ],
    quiet: [
      "There were no completed blocks this week. Your next session is a clean restart, not a catch-up task.",
      "It's been a quiet week. Start small with one focused completion, then build the routine back up."
    ],
    streak: [
      "Your streak is building nicely. Protect the routine, and keep the next session the same size.",
      "You've been showing up consistently. That return pattern matters more than any single long session."
    ],
    building: [
      "You're on a streak. Come back for one focused block while it's active.",
      "Good momentum. Another short session tomorrow will turn this into a habit."
    ],
    restart: [
      "You've been active this week, but there's no streak yet. Restart with one focused completion, then plan your next return.",
      "Some practice this week, which is good. Pick a regular time and let the streak start again."
    ]
  },
  coaching: {
    "interview-in-progress": [
      "You have an interview in progress. Finish it while the context is still fresh.",
      "Your interview is still open. Finish it before starting anything new."
    ],
    "interview-with-practice": [
      "Nice going. Maintain your practice pace, and aim the next block at the gap from your latest interview.",
      "Good momentum. Keep practising, and point the next block at your weakest interview skill."
    ],
    "interview-needs-practice": [
      "Your latest interview shows one skill that needs attention. Start with one focused practice block.",
      "Before another interview, spend one practice block on the gap your last round revealed."
    ],
    "practice-returning": [
      "Welcome back. Your progress is still here, so restart with one question. No need to catch up all at once.",
      "Good to see you again. Pick up where you left off with one small step."
    ],
    "practice-momentum": [
      "You're building real momentum. Keep the same pace this week.",
      "Nice consistency. Keep going with the next question on your path."
    ],
    "practice-started": [
      "You've started your practice path. Finish the next question to keep your progress moving.",
      "Good start. One more completed question will make your plan sharper."
    ],
    "evidence-unavailable": [
      "I could not load your latest coaching signal. Your saved work is safe."
    ],
    "baseline-priority": [
      "Your baseline shows where to start. Begin with the focus area I've highlighted.",
      "I've picked your first focus from your baseline. One completed block will tell me more."
    ],
    "resume-priority": [
      "Looking at your resume, I've chosen a place to start. One completed block will give me stronger evidence.",
      "Your resume points to a good first focus. Complete one block and I'll refine the plan."
    ]
  },
  practiceIntro: {
    focus: [
      "Your recent work points to the next best focus. Start there, and name the pattern before you code.",
      "I've picked your next focus from your results. Work through it one question at a time."
    ],
    empty: [
      "Focus on recognising the pattern before you write code.",
      "Start by naming the pattern each problem needs, then write the code."
    ],
    first: [
      "Start with the first pattern. Name the pattern before you code, then explain why it fits.",
      "Let's begin with the first pattern. Say which idea the problem needs before you start writing."
    ],
    complete: [
      "You finished the DSA path. Revisit anything you skipped, then carry these patterns into your next interview.",
      "Path complete. Well done. Review any skipped questions, and use these patterns in your next interview."
    ],
    ongoing: [
      "You're making progress through this pattern. Keep the approach clear before you optimise it.",
      "Good progress. Get the approach right first, then make it faster."
    ]
  },
  assessmentRun: {
    passed: [
      "I can see your run. All the tests passed. Add your reasoning and submit when you are ready.",
      "Every test passed. Explain your approach, then submit when you're happy with it."
    ],
    failed: [
      "I can see the output. Some tests are still failing. Review the failing case and try again.",
      "Not all tests passed yet. Look at the failing case closely, then run it again."
    ]
  },
  chapter: {
    opening: [
      "Let's take this chapter. I'll set up the pattern, then you solve.",
      "Here's a new chapter. I'll walk you through the key ideas first, then it's your turn."
    ],
    ideas: [
      "The ideas that keep coming back. These are the concepts your questions in this chapter actually test. If you can name which one a problem needs, you have already done most of the thinking."
    ],
    approaches: [
      "Reach for these, in this order. Say the brute force out loud first, then improve it. Interviewers want to watch you move between approaches, not jump straight to the optimal one."
    ],
    traps: [
      "The traps I want you to avoid. These are the mistakes recorded against the questions in this chapter. Read them once now — they are much cheaper to avoid than to debug."
    ],
    signals: [
      "What a strong answer looks like. This is what an interviewer is listening for while you work. Narrate these as you go, even when you are still writing."
    ],
    solve: [
      "Now you solve. I'll stay beside each question with hints if you get stuck. Take them one at a time, and mark each one done so I can keep your path current.",
      "Your turn. Hints are there if you get stuck. Work through the questions one at a time and mark each one done."
    ]
  }
} as const;

/** One phrasing, chosen when speech starts so each visit can sound different. */
export function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? "";
}

function collect(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collect);
  if (value && typeof value === "object") return Object.values(value).flatMap(collect);
  return [];
}

/** Every fixed line the generator should record for each selectable teacher. */
export const ALL_TEACHER_LINES: readonly string[] = [
  ...new Set([...Object.values(TEACHER_VOICE_LINES), ...collect(TEACHER_LINES)])
];
