"use client";

import { Loader2, Play } from "lucide-react";
import type {
  CandidateResume,
  InterviewQuestion,
  InterviewSetup,
  Turn
} from "@/lib/shared/types";
import { DsaCodeEditor, type DsaEditorLanguage } from "@/components/interview/dsa/dsa-code-editor";
import { MayaAside } from "./maya-aside";
import { INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./panel-surface";
import { ResumeDocumentPreview } from "./resume-document-preview";
import {
  InterviewQuestionPanel,
  RESUME_STAGES,
  type InterviewGrade,
  type StageCounts
} from "./interview-question-panel";

/**
 * The resume round's three-column room.
 *
 * Left is the candidate's own resume, which is the subject of the whole round.
 * Middle is the question and the way to answer it. Right is Maya, the running
 * transcript, and the candidate's own camera, matching the DSA room so the two
 * interview surfaces feel like one product.
 *
 * During the coding stage the resume steps aside and the editor takes its
 * column, which keeps the task text and the code side by side.
 */
export function ResumeLiveWorkspace({
  resume,
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
  language,
  sending,
  error,
  draft,
  notes,
  selectedOption,
  running,
  onDraftChange,
  onNotesChange,
  onSelectOption,
  onSubmit,
  onRun,
  onRequestMic,
  candidateCameraStream,
  onDisableCamera
}: {
  resume: CandidateResume | null;
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
  /** Maya's rendered presence, built by the room so avatar setup stays in one place. */
  agentSlot: React.ReactNode;
  micOn: boolean;
  language: DsaEditorLanguage;
  sending: boolean;
  error: string | null;
  draft: string;
  notes: string;
  selectedOption: string | null;
  running: boolean;
  onDraftChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSelectOption: (option: string) => void;
  onSubmit: () => void;
  onRun: () => void;
  onRequestMic: () => void;
  candidateCameraStream: MediaStream | null;
  onDisableCamera: () => void;
}) {
  const codingStage = question?.stage === "code";

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0">
      {codingStage ? (
        <section
          className={`${INTERVIEW_PANEL_SHELL} flex min-h-[26rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
        >
          <header className={`flex shrink-0 items-center justify-between gap-3 border-b ${INTERVIEW_PANEL_RULE} px-4 py-2.5`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]"
              />
              <p className="truncate text-sm font-medium text-cream/72">Your editor</p>
              <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-cream/48">
                {language}
              </span>
            </div>
            <button
              type="button"
              onClick={onRun}
              disabled={running || !draft.trim()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-sm font-semibold text-cream/78 transition hover:bg-white/[0.1] hover:text-cream disabled:pointer-events-none disabled:opacity-35"
            >
              {running ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={12} fill="currentColor" aria-hidden="true" />
              )}
              Run
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <DsaCodeEditor
              value={draft}
              language={language}
              onChange={onDraftChange}
              onRun={onRun}
            />
          </div>
        </section>
      ) : resume ? (
        <ResumeDocumentPreview resume={resume} highlightSkill={question?.skill} />
      ) : (
        <section
          className={`${INTERVIEW_PANEL_SHELL} flex min-h-[16rem] items-center justify-center p-6 text-center text-sm leading-6 text-cream/44 xl:min-h-0`}
        >
          Your resume is not available in this session.
        </section>
      )}

      <InterviewQuestionPanel
        question={question}
        questionIndex={questionIndex}
        questionCount={questionCount}
        stages={RESUME_STAGES}
        anchorLabel="From your resume"
        counts={counts}
        grade={grade}
        liveTranscript={liveUserText}
        micOn={micOn}
        thinking={thinking}
        sending={sending}
        error={error}
        draft={draft}
        notes={notes}
        selectedOption={selectedOption}
        onDraftChange={onDraftChange}
        onNotesChange={onNotesChange}
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

const EDITOR_LANGUAGES: Record<string, DsaEditorLanguage> = {
  javascript: "javascript",
  typescript: "javascript",
  jsx: "javascript",
  tsx: "javascript",
  python: "python",
  java: "java",
  cpp: "cpp",
  csharp: "cpp",
  go: "javascript"
};

/**
 * The editor supports four languages; the kit may name others. Anything
 * unmapped falls back to JavaScript rather than failing to render.
 */
export function resumeEditorLanguage(language: string | null): DsaEditorLanguage {
  return EDITOR_LANGUAGES[(language ?? "").trim().toLowerCase()] ?? "javascript";
}
