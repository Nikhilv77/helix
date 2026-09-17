import type { Participant, Room, TranscriptionSegment } from "livekit-client";
import type { InterviewQuestion, InterviewSetup } from "@/lib/shared/types";
import type { AgentState, DsaRunResult, VoiceStatus } from "../types";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatTypedAnswer(
  question: InterviewQuestion | null,
  draft: string,
  notes: string
): string {
  const answer = draft.trim();
  if (!answer) return "";
  if (question?.kind !== "code") return answer;

  const language = question.language ?? "code";
  const reasoning = notes.trim();
  return [`\`\`\`${language}\n${answer}\n\`\`\``, reasoning ? `Reasoning: ${reasoning}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

export function codeRunAcknowledgement(result: DsaRunResult): string {
  if (result.tests.length > 0) {
    const passed = result.tests.filter((test) => test.passed).length;
    if (passed === result.tests.length) {
      return `I can see the code and output. All ${result.tests.length} supplied tests passed—check your complexity and submit when you're ready.`;
    }
    return `I can see the code and output. ${passed} of ${result.tests.length} supplied tests passed, so use the failing result to guide your next change.`;
  }
  if (result.compileOutput.trim()) {
    return "I can see the run output. It did not compile yet—check the compiler message and keep working through it.";
  }
  if (result.stderr.trim() || !result.accepted) {
    return "I can see the run output. There is still an execution issue, so inspect the error and try the next fix.";
  }
  return "I can see the code and output. It ran successfully—review the behavior, then submit when you're ready.";
}

export function roleLabel(role: InterviewSetup["role"]): string {
  const labels: Record<InterviewSetup["role"], string> = {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full-stack",
    data: "Data",
    "ai-ml": "AI / ML",
    pm: "Product"
  };
  return labels[role];
}

export function roundLabel(round: InterviewSetup["roundType"]): string {
  const labels: Record<InterviewSetup["roundType"], string> = {
    behavioral: "Behavioral",
    technical: "Technical deep-dive",
    "hiring-manager": "Hiring manager"
  };
  return labels[round];
}

export function isAgentState(value: string): value is AgentState {
  return ["initializing", "idle", "listening", "thinking", "speaking"].includes(value);
}

export function updateLiveTranscript(
  segments: TranscriptionSegment[],
  participant: Participant | undefined,
  room: Room,
  agentIdentity: string | null,
  accumulatedSegments: Map<string, TranscriptionSegment>,
  update: (text: string) => void,
  onFinal?: (text: string) => void
) {
  if (!participant || participant.identity === agentIdentity) return;
  if (participant.identity !== room.localParticipant.identity) return;

  for (const segment of segments) accumulatedSegments.set(segment.id, segment);

  const text = [...accumulatedSegments.values()]
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) return;
  update(text);
  if (segments.some((segment) => segment.final)) onFinal?.(text);
}

export function describeVoiceState(
  status: VoiceStatus,
  agentState: AgentState | null,
  micOn: boolean,
  activeSpeakerFallback: boolean,
  micSignal: boolean,
  micSilent: boolean,
  interviewerName = "James"
): string {
  if (status === "ended") return "Interview complete";
  if (status === "error") return "Connection needs attention";
  if (status === "reconnecting") return "Restoring the call";
  if (status === "connecting") return "Connecting securely";
  if (status === "waiting") return "Interviewer is joining";
  if (agentState === "initializing") return "Interviewer is getting ready";
  if (agentState === "thinking") return `${interviewerName} is thinking`;
  if (agentState === "speaking" || activeSpeakerFallback) return `${interviewerName} is speaking`;
  if (!micOn) return "Microphone muted";
  if (micSignal) return "Hearing you";
  if (micSilent) return "No microphone signal";
  return "Listening. Speak now";
}
