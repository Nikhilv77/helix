"use client";

import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function HiringManagerInterviewEntry({
  sessionsRemaining,
  firstName,
  workspaceAccent
}: {
  sessionsRemaining: number | null;
  firstName: string;
  workspaceAccent: WorkspaceAccent;
}) {
  const outOfSessions = sessionsRemaining === 0;
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const copy = outOfSessions
    ? {
        eyebrow: "Hiring manager interview",
        headline: `${greeting} that's it for today.`,
        body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
      }
    : {
        eyebrow: "Hiring manager interview",
        headline: `${greeting} James is ready for your final conversation.`,
        body: "James will focus on how you work with people, handle unclear situations, respond to feedback, and choose the right role. Give honest examples and explain what you did and what happened.",
        spokenVariants: TEACHER_LINES.interviewLaunch.hiringManager
      };

  return (
    <InterviewLaunchStage
      ready={!outOfSessions}
      startPath="/api/interview/hiring-manager/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="James is getting ready…"
      waitForVoiceBeforeNavigate
    />
  );
}
