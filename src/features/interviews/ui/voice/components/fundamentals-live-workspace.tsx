"use client";

import type {
  InterviewConcept,
  InterviewQuestion,
  InterviewSetup,
  InterviewStage,
  Turn
} from "@/lib/shared/types";
import { FUNDAMENTALS_AREAS } from "@/lib/fundamentals/areas";
import { ConceptPanel } from "./concept-panel";
import { MayaAside } from "./maya-aside";
import {
  FUNDAMENTALS_STAGES,
  InterviewQuestionPanel,
  type InterviewGrade,
  type StageCounts
} from "./interview-question-panel";

/**
 * The computer fundamentals room.
 *
 * Same three-column shell as the resume room, with the left column given over
 * to the concept card rather than a document: the round's whole point is that
 * you leave understanding the mechanism, not just scored on it. There is no
 * editor — a fundamentals round has nothing to write.
 */
export function FundamentalsLiveWorkspace({
  question,
  questionIndex,
  questionCount,
  counts,
  grade,
  concept,
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
  /** Teaching card for the question just answered, from the session payload. */
  concept: InterviewConcept | null;
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
    <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0">
      <ConceptPanel
        concept={concept}
        correct={grade ? grade.correct : null}
        areas={FUNDAMENTALS_AREAS}
      />

      <InterviewQuestionPanel
        question={question}
        questionIndex={questionIndex}
        questionCount={questionCount}
        stages={FUNDAMENTALS_STAGES}
        anchorLabel="Area"
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

/** The stage a fundamentals question belongs to, for the rail. */
export const FUNDAMENTALS_STAGE_ORDER: InterviewStage[] = ["rapid", "explain", "scenario"];
