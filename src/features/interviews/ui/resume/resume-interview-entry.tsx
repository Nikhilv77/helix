"use client";

import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function ResumeInterviewEntry({
  hasResume,
  sessionsRemaining,
  firstName,
  skills,
  workspaceAccent
}: {
  hasResume: boolean;
  /** Null when the quota could not be read; the server still enforces it. */
  sessionsRemaining: number | null;
  firstName: string;
  skills: string[];
  workspaceAccent: WorkspaceAccent;
}) {
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const outOfSessions = sessionsRemaining === 0;
  const ready = hasResume && !outOfSessions;
  const named = skills.slice(0, 3).join(", ");

  const copy = !hasResume
    ? {
        eyebrow: "Resume interview",
        headline: `${greeting} I need your resume first.`,
        body: "Upload your resume in onboarding and I'll build this round from what's actually on it — the skills you claim, a small coding task in your own stack, and the work you've shipped."
      }
    : outOfSessions
      ? {
          eyebrow: "Resume interview",
          headline: `${greeting} that's it for today.`,
          body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
        }
      : {
          eyebrow: "Resume interview",
          headline: `${greeting} James is ready for your interview.`,
          body: named
            ? `James will lead your resume and behavioural interview. He will start with your background and recent work, then go deeper into your experience, projects, and the skills you listed, including ${named}. Your progress is strongest when you give specific examples: what you owned, the decision you made, and what changed. Take a moment to get ready, then answer clearly and honestly.`
            : "James will lead your resume and behavioural interview. He will start with your background and recent work, then go deeper into your experience, projects, and technical judgement. Your progress is strongest when you give specific examples: what you owned, the decision you made, and what changed. Take a moment to get ready, then answer clearly and honestly.",
          spokenVariants: TEACHER_LINES.interviewLaunch.resume
        };

  return (
    <InterviewLaunchStage
      ready={ready}
      startPath="/api/interview/resume/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="James is getting ready…"
      waitForVoiceBeforeNavigate
    />
  );
}
