"use client";

import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function SystemDesignInterviewEntry({
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

  return (
    <InterviewLaunchStage
      ready={!outOfSessions}
      startPath="/api/interview/design/start"
      copy={
        outOfSessions
          ? {
              eyebrow: "System Design interview",
              headline: `${greeting} that's it for today.`,
              body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
            }
          : {
              eyebrow: "System Design interview",
              headline: `${greeting} Claire has an open-ended design problem for you.`,
              body: "You’ll discover requirements, estimate scale, build the architecture on a canvas, deep-dive one boundary, and adapt the design under changing constraints.",
              script: `Hi ${firstName || "there"}. Claire will give you an intentionally incomplete system-design prompt. Ask questions first, then draw and defend the architecture like you would in a real interview.`
            }
      }
      workspaceAccent={workspaceAccent}
      startingLabel="Claire is selecting your design scenario…"
      waitForVoiceBeforeNavigate
    />
  );
}
