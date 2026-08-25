"use client";

import { useEffect, useRef } from "react";
import type { InterviewQuestion, InterviewSetup, Turn } from "@/lib/shared/types";
import { ConversationTranscript } from "./conversation-transcript";
import { CandidateCameraPreview } from "./candidate-camera-preview";
import { INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./panel-surface";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

/**
 * The right-hand column shared by every live interview room: Maya at the top,
 * the running transcript beneath her, and the candidate's own camera at the
 * bottom. Both the DSA room and the resume room render this, so the two
 * surfaces stay the same product rather than two copies drifting apart.
 */
export function MayaAside({
  agentSlot,
  turns,
  spokenAgentTurnKeys,
  liveUserText,
  startedAt,
  setup,
  question,
  thinking,
  bottomRef,
  candidateCameraStream,
  onDisableCamera
}: {
  /** Maya's rendered presence, built by the room so avatar setup stays in one place. */
  agentSlot: React.ReactNode;
  turns: Turn[];
  spokenAgentTurnKeys: ReadonlySet<string>;
  liveUserText: string;
  startedAt: number | null;
  setup: InterviewSetup | null;
  question: InterviewQuestion | null;
  thinking: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  candidateCameraStream: MediaStream | null;
  onDisableCamera: () => void;
}) {
  const teacher = useWorkspaceTeacher();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);

  useEffect(() => {
    const transcript = scrollRef.current;
    if (!transcript || !autoFollowRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [liveUserText, thinking, turns]);

  return (
    <aside
      className={`${INTERVIEW_PANEL_SHELL} flex min-h-[24rem] shrink-0 flex-col overflow-hidden sm:min-h-[28rem] xl:min-h-0 xl:shrink`}
    >
      <div
        className={`relative h-40 shrink-0 overflow-hidden border-b ${INTERVIEW_PANEL_RULE} bg-black/20`}
      >
        <div className="absolute inset-x-[-24%] bottom-[-12%] top-0">{agentSlot}</div>
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/45 px-2.5 py-1.5 text-[11px] font-medium text-cream/72 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_9px_var(--workspace-accent)]" />
          {teacher.name}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const transcript = event.currentTarget;
          const distanceFromBottom =
            transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
          autoFollowRef.current = distanceFromBottom < 48;
        }}
        onWheelCapture={(event) => {
          if (event.deltaY < 0) autoFollowRef.current = false;
        }}
        className="thin-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto p-3.5"
      >
        <ConversationTranscript
          turns={turns}
          spokenAgentTurnKeys={spokenAgentTurnKeys}
          liveUserText={liveUserText}
          startedAt={startedAt}
          setup={setup}
          question={question}
          thinking={thinking}
          bottomRef={bottomRef}
          compact
          hideHeader
        />
      </div>
      {candidateCameraStream ? (
        <CandidateCameraPreview stream={candidateCameraStream} onDisable={onDisableCamera} />
      ) : null}
    </aside>
  );
}
