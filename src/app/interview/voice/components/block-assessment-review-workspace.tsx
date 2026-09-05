"use client";

import type { InterviewQuestion, InterviewSetup, Turn } from "@/lib/shared/types";
import { MayaAside } from "./maya-aside";
import {
  InterviewQuestionPanel,
  type InterviewGrade,
  type StageCounts
} from "./interview-question-panel";

const REVIEW_STAGES = [
  { id: "rapid" as const, label: "Code review", caption: "Your verified submissions" },
  { id: "code" as const, label: "Transfer coding", caption: "Two new problems" }
];

/** Neutral assessment surface; it deliberately contains no fundamentals content. */
export function BlockAssessmentReviewWorkspace({
  question,
  questionIndex,
  questionCount,
  counts,
  grade,
  turns,
  spokenAgentTurnKeys,
  liveUserText,
  startedAt,
  setup,
  thinking,
  bottomRef,
  agentSlot,
  micOn,
  sending,
  error,
  draft,
  selectedOption,
  onDraftChange,
  onSelectOption,
  onSubmit,
  onRequestMic,
  candidateCameraStream,
  onDisableCamera
}: {
  question: InterviewQuestion | null;
  questionIndex: number;
  questionCount: number;
  counts: StageCounts;
  grade: InterviewGrade | null;
  turns: Turn[];
  spokenAgentTurnKeys: ReadonlySet<string>;
  liveUserText: string;
  startedAt: number | null;
  setup: InterviewSetup | null;
  thinking: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  agentSlot: React.ReactNode;
  micOn: boolean;
  sending: boolean;
  error: string | null;
  draft: string;
  selectedOption: string | null;
  onDraftChange: (value: string) => void;
  onSelectOption: (option: string) => void;
  onSubmit: () => void;
  onRequestMic: () => void;
  candidateCameraStream: MediaStream | null;
  onDisableCamera: () => void;
}) {
  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0">
      <InterviewQuestionPanel
        question={question}
        questionIndex={questionIndex}
        questionCount={questionCount}
        stages={REVIEW_STAGES}
        anchorLabel="Verified submission"
        counts={counts}
        grade={grade}
        liveTranscript={liveUserText}
        micOn={micOn}
        thinking={thinking}
        sending={sending}
        error={error}
        draft={draft}
        notes=""
        selectedOption={selectedOption}
        onDraftChange={onDraftChange}
        onNotesChange={() => undefined}
        onSelectOption={onSelectOption}
        onSubmit={onSubmit}
        onRequestMic={onRequestMic}
      />
      <MayaAside
        agentSlot={agentSlot}
        turns={turns}
        spokenAgentTurnKeys={spokenAgentTurnKeys}
        liveUserText={liveUserText}
        startedAt={startedAt}
        setup={setup}
        question={question}
        thinking={thinking}
        bottomRef={bottomRef}
        candidateCameraStream={candidateCameraStream}
        onDisableCamera={onDisableCamera}
      />
    </div>
  );
}
