"use client";

import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function SystemDesignInterviewEntry({
  sessionsRemaining,
  firstName,
  workspaceAccent,
  contentReady = true
}: {
  sessionsRemaining: number | null;
  firstName: string;
  workspaceAccent: WorkspaceAccent;
  contentReady?: boolean;
}) {
  const outOfSessions = sessionsRemaining === 0;
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";

  return (
    <InterviewLaunchStage
      ready={!outOfSessions && contentReady}
      startPath="/api/interview/design/start"
      copy={
        outOfSessions
          ? {
              eyebrow: "System Design interview",
              headline: `${greeting} that's it for today.`,
              body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
            }
          : !contentReady
            ? {
                eyebrow: "AI/ML System Design",
                headline: `${greeting} this design round is not available here yet.`,
                body: "The AI/ML-specific scenarios have not been published in this environment. Your other interview rounds and saved progress are available now."
              }
            : {
                eyebrow: "System Design interview",
                headline: `${greeting} Claire has an open-ended design problem for you.`,
                body: "You’ll discover requirements, estimate scale, build the architecture on a canvas, deep-dive one boundary, and adapt the design under changing constraints.",
                spokenVariants: TEACHER_LINES.interviewLaunch.systemDesign
              }
      }
      workspaceAccent={workspaceAccent}
      startingLabel="Claire is selecting your design scenario…"
      waitForVoiceBeforeNavigate
      returnHref="/interviews"
    />
  );
}
