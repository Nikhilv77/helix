"use client";

import { InterviewLaunchStage } from "@/components/interview/shared/interview-launch-stage";
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
          headline: `${greeting} let's go through your resume.`,
          body: named
            ? `We'll do this in three parts. First I'll test the skills you've listed, ${named} among them. Then a small coding task in your own stack. Then the work itself — what you owned, what you decided, and what changed.`
            : "We'll do this in three parts. First the skills you've listed, then a small coding task in your own stack, then the work itself — what you owned, what you decided, and what changed."
        };

  return (
    <InterviewLaunchStage
      ready={ready}
      startPath="/api/interview/resume/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="Maya is reading your resume…"
    />
  );
}
