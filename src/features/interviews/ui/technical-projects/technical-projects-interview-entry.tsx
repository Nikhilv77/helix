"use client";

import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

export function TechnicalProjectsInterviewEntry({
  readyContent,
  sessionsRemaining,
  firstName,
  projectName,
  workspaceAccent
}: {
  readyContent: boolean;
  sessionsRemaining: number | null;
  firstName: string;
  projectName: string | null;
  workspaceAccent: WorkspaceAccent;
}) {
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const outOfSessions = sessionsRemaining === 0;
  const ready = readyContent && !outOfSessions;
  const copy = !readyContent
    ? {
        eyebrow: "Core Technical & Projects",
        headline: `${greeting} your technical path is still being prepared.`,
        body: "Finish onboarding and generate your personalized interview path before starting this round."
      }
    : outOfSessions
      ? {
          eyebrow: "Core Technical & Projects",
          headline: `${greeting} that's it for today.`,
          body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
        }
      : {
          eyebrow: "Core Technical & Projects",
          headline: `${greeting} Claire is ready for your technical interview.`,
          body: projectName
            ? `Claire will begin with three short technical decisions, then go deeply into ${projectName}: what you built, how it worked, what failed, and the trade-offs you owned.`
            : "Claire will begin with three short technical decisions, then deeply examine one grounded project or production scenario: how it worked, what failed, and the trade-offs involved.",
          spokenVariants: TEACHER_LINES.interviewLaunch.technicalProjects
        };

  return (
    <InterviewLaunchStage
      ready={ready}
      startPath="/api/interview/technical-projects/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="Claire is preparing your technical round…"
      waitForVoiceBeforeNavigate
    />
  );
}
