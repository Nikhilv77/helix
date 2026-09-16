"use client";

import { InterviewLaunchStage } from "@/features/interviews/ui/shared/interview-launch-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

const MIN_SOLVED = 10;

/**
 * The everyday workspace teacher gives the short handoff; Claire owns the
 * live technical room. Keeping this on InterviewLaunchStage prevents the DSA
 * entry page from drifting away from Resume and Hiring Manager launch/retry
 * behavior.
 */
export function DsaInterviewEntry({
  completedCount,
  sessionsRemaining,
  firstName,
  workspaceAccent,
  designSupported
}: {
  completedCount: number;
  /** Null when the quota could not be read; the server still enforces it. */
  sessionsRemaining: number | null;
  firstName: string;
  workspaceAccent: WorkspaceAccent;
  designSupported: boolean;
}) {
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const outOfSessions = sessionsRemaining === 0;
  const ready = completedCount >= MIN_SOLVED && !outOfSessions;
  const roundLabel = designSupported ? "DSA & Design interview" : "DSA interview";
  const copy =
    completedCount < MIN_SOLVED
      ? {
          eyebrow: roundLabel,
          headline: `${greeting} let's get you ready first.`,
          body: `You've solved ${completedCount} practice question${completedCount === 1 ? "" : "s"} so far. Solve at least ${MIN_SOLVED} executable DSA questions first, then Claire can interview you on problems you've actually practised.`
        }
      : outOfSessions
        ? {
            eyebrow: roundLabel,
            headline: `${greeting} that's it for today.`,
            body: "You've used all your interview sessions for today. Your next round unlocks tomorrow."
          }
        : {
            eyebrow: roundLabel,
            headline: `${greeting} Claire is ready for your technical interview.`,
            body: designSupported
              ? "Claire will lead two coding problems first, then take you through one system-design scenario covering requirements, architecture, trade-offs, and reliability. Think out loud when it helps; she will give you quiet space while you code."
              : "Claire will lead a focused coding interview using important problems you have already practised. Think out loud when it helps; she will give you quiet space while you code.",
            script: designSupported
              ? `Hi ${firstName || "there"}. Claire will take your DSA and design interview. You’ll solve two coding problems first, then defend one system design through requirements, architecture, trade-offs, and reliability. Think out loud when it helps, but Claire will give you quiet space while you code.`
              : `Hi ${firstName || "there"}. Claire will take your DSA interview. You’ll solve coding problems you have practised and explain your approach, correctness, complexity, and edge cases. Think out loud when it helps, but Claire will give you quiet space while you code.`
          };

  return (
    <InterviewLaunchStage
      ready={ready}
      startPath="/api/interview/dsa/start"
      copy={copy}
      workspaceAccent={workspaceAccent}
      startingLabel="Claire is preparing your round…"
      waitForVoiceBeforeNavigate
    />
  );
}
