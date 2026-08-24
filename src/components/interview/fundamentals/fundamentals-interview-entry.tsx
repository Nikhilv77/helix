"use client";

import { InterviewLaunchStage } from "@/components/interview/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function FundamentalsInterviewEntry({
  sessionsRemaining,
  firstName,
  areas,
  workspaceAccent
}: {
  /** Null when the quota could not be read; the server still enforces it. */
  sessionsRemaining: number | null;
  firstName: string;
  areas: string[];
  workspaceAccent: WorkspaceAccent;
}) {
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const outOfSessions = sessionsRemaining === 0;
  const named = areas.slice(0, 3).join(", ");

  const copy = outOfSessions
    ? {
        eyebrow: "Computer fundamentals",
        headline: `${greeting} that's it for today.`,
        body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
      }
    : {
        eyebrow: "Computer fundamentals",
        headline: `${greeting} let's go under the framework.`,
        body: `Three parts. Quick checks across ${named || "the core areas"}, then I'll ask you to explain the mechanism behind a few of them, and we'll finish by diagnosing something real. After each answer I'll show you the model I was listening for.`
      };

  return (
    <InterviewLaunchStage
      ready={!outOfSessions}
      startPath="/api/interview/fundamentals/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="Maya is picking your questions…"
    />
  );
}
