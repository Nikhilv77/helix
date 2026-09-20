"use client";

import Image from "next/image";
import { ArrowRight, Check, Loader2, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useTheme } from "@/lib/theme/theme-context";
import { DARK_PORTRAIT_PLACEHOLDER } from "@/lib/avatars/portrait-placeholder";
import { openCoreTechnicalAssessmentRoom } from "@/features/interviews/ui/shared/interview-room-navigation";
import type { StoryPracticeBlockView } from "@/features/practice/shared/ui/view-contracts";
import { AssessmentResultsScorecard } from "@/features/practice/shared/ui/assessment-results-scorecard";

const METRICS = [
  ["technical-accuracy", "Technical accuracy"],
  ["mechanism-reasoning", "Mechanism reasoning"],
  ["diagnosis-evidence", "Diagnosis evidence"],
  ["debugging-implementation", "Debugging & repair"],
  ["communication-production", "Production verification"]
] as const;

export function CoreTechnicalBlockAssessmentPreview({
  block,
  terminalCount,
  allowEarlyStart = false
}: {
  block: StoryPracticeBlockView;
  terminalCount: number;
  allowEarlyStart?: boolean;
}) {
  const teacher = useWorkspaceTeacher();
  const { resolvedTheme } = useTheme();
  const assessmentPortrait =
    resolvedTheme === "light"
      ? `/images/teacher-portraits/assessment-headsets/light/${teacher.id}.jpg`
      : `/images/teacher-portraits/assessment-headsets/${teacher.id}.jpg`;

  const remainingQuestions = Math.max(block.questions.length - terminalCount, 0);
  const status = block.assessment?.status ?? "LOCKED";
  const isAssessed = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";
  const isReady =
    status === "READY" || (allowEarlyStart && block.isCurrent && !isAssessed && !isInProgress);
  const isPractising = !isAssessed && !isInProgress && !isReady;

  const [noticeVisible, setNoticeVisible] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startPending = useRef(false);

  useEffect(() => {
    if (!noticeVisible) return;
    const timer = window.setTimeout(() => setNoticeVisible(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [noticeVisible]);

  useEffect(() => {
    if (!nudging) return;
    const timer = window.setTimeout(() => setNudging(false), 460);
    return () => window.clearTimeout(timer);
  }, [nudging]);

  const showLockedNotice = () => {
    if (!isPractising) return;
    setNoticeVisible(true);
    setNudging(true);
  };

  const startAssessment = async () => {
    if (!block.assessment?.id || startPending.current) return;
    startPending.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch("/api/practice/core-technical/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: block.assessment.id,
          requestId: crypto.randomUUID()
        })
      });
      const payload: unknown = await response.json().catch(() => null);
      const sessionId = readSessionId(payload);
      if (!response.ok || !sessionId) throw new Error(readStartError(payload, response.status));
      openCoreTechnicalAssessmentRoom(sessionId);
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : "The assessment could not be started. Try again."
      );
      startPending.current = false;
      setStarting(false);
    }
  };

  return (
    <>
      <aside
        aria-label="Core Technical assessment"
        className={`dsa-assessment-card ${nudging ? "assessment-card-nudge" : ""} relative overflow-hidden rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]`}
      >
        <div
          className={
            isAssessed
              ? "min-w-0"
              : "grid min-w-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] lg:grid-cols-[11.5rem_minmax(0,1fr)]"
          }
        >
          {!isAssessed ? (
            <button
              type="button"
              onClick={showLockedNotice}
              disabled={!isPractising}
              className="dsa-assessment-portrait relative h-36 overflow-hidden bg-[#08090a] text-left disabled:cursor-default sm:h-auto sm:min-h-[12.5rem]"
              aria-label={
                isPractising
                  ? `Block assessment, ${remainingQuestions} ${remainingQuestions === 1 ? "question" : "questions"} left`
                  : `${teacher.name}, your assessment coach`
              }
            >
              <Image
                src={assessmentPortrait}
                alt={`${teacher.name}, your teacher`}
                fill
                sizes="(min-width: 1024px) 184px, (min-width: 640px) 152px, 100vw"
                quality={85}
                placeholder="blur"
                blurDataURL={DARK_PORTRAIT_PLACEHOLDER}
                className="dsa-assessment-portrait-image bg-[#08090a] object-cover object-[center_25%] opacity-95 sm:origin-top sm:scale-[1.65] sm:object-top"
              />
              <div className="dsa-assessment-portrait-vignette absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_32%,rgba(4,5,6,0.18)_64%,rgba(4,5,6,0.72)_100%)]" />
              <div className="dsa-assessment-portrait-fade absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(8,9,10,0.72)_100%)] sm:bg-[linear-gradient(90deg,transparent_58%,rgba(14,16,17,0.9)_100%),linear-gradient(180deg,transparent_62%,rgba(8,9,10,0.68)_100%)]" />
              <div className="absolute inset-y-[12%] right-0 w-px bg-[linear-gradient(180deg,transparent,var(--workspace-accent),transparent)] opacity-55" />
              <span className="absolute left-3 top-3 h-5 w-5 border-l border-t border-[color:var(--workspace-accent-border)]" />
              <span className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-white/20" />
              <div className="dsa-assessment-portrait-label absolute bottom-3 left-3 rounded-full border border-white/10 bg-[#090a0b]/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-cream/78">
                {teacher.name} · 1:1 coach
              </div>
            </button>
          ) : null}

          <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
            {isPractising ? (
              <LockedAssessment
                remainingQuestions={remainingQuestions}
                completionPercent={
                  block.questions.length > 0
                    ? Math.round((terminalCount / block.questions.length) * 100)
                    : 0
                }
                teacherName={teacher.name}
                allowEarlyStart={allowEarlyStart}
                starting={starting}
                error={startError}
                onStart={() => void startAssessment()}
                onShowNotice={showLockedNotice}
              />
            ) : isReady ? (
              <ReadyAssessment
                teacherName={teacher.name}
                starting={starting}
                error={startError}
                onStart={() => void startAssessment()}
              />
            ) : isInProgress ? (
              <InProgressAssessment onStart={() => void startAssessment()} />
            ) : (
              <CompletedAssessment
                block={block}
                teacherName={teacher.name}
                teacherPortrait={assessmentPortrait}
              />
            )}
          </div>
        </div>
      </aside>

      {noticeVisible ? (
        <AssessmentNotice
          remainingQuestions={remainingQuestions}
          teacherPortrait={assessmentPortrait}
          onClose={() => setNoticeVisible(false)}
        />
      ) : null}
    </>
  );
}

function LockedAssessment({
  remainingQuestions,
  completionPercent,
  teacherName,
  allowEarlyStart,
  starting,
  error,
  onStart,
  onShowNotice
}: {
  remainingQuestions: number;
  completionPercent: number;
  teacherName: string;
  allowEarlyStart: boolean;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onShowNotice: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-cream">
            {remainingQuestions} {remainingQuestions === 1 ? "question" : "questions"} until your
            1:1
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-cream/48">
            Solve your path questions to unlock this assessment with {teacherName}.
          </p>
        </div>

        {allowEarlyStart ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/70"
          >
            {starting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {starting ? "Starting assessment…" : "Start assessment"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onShowNotice}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:bg-white"
          >
            Check progress
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[12px] leading-5 text-[#efb38f]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onShowNotice}
        className="group/progress mt-3 flex w-full items-center gap-3 py-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold text-cream/70">
              {remainingQuestions} {remainingQuestions === 1 ? "question" : "questions"} left
            </span>
            <span className="text-[10px] text-cream/36 transition group-hover/progress:text-cream/52">
              Unlock assessment
            </span>
          </span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <span
              className="block h-full rounded-full bg-[var(--workspace-accent)]"
              style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
            />
          </span>
        </span>
      </button>
      <MetricPreview />
    </div>
  );
}

function ReadyAssessment({
  teacherName,
  starting,
  error,
  onStart
}: {
  teacherName: string;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Assessment ready
      </p>
      <h3 className="mt-2 font-display text-[1.5rem] font-semibold text-cream">
        Your 1:1 with {teacherName} is ready
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-cream/58">
        Four evidence-based mechanism and diagnosis checks, then one live transfer repair in a
        focused 25-minute checkpoint.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:translate-y-0 disabled:opacity-65"
      >
        {starting ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={15} aria-hidden="true" />
        )}
        {starting ? "Starting assessment…" : "Start assessment"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm leading-5 text-[#efb38f]">
          {error}
        </p>
      ) : null}
      <MetricPreview />
    </div>
  );
}

function InProgressAssessment({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Assessment in progress
      </p>
      <h3 className="mt-2 font-display text-[1.5rem] font-semibold text-cream">
        Continue where you left off
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-cream/58">
        Your frozen questions and existing checkpoint session are ready to resume.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:-translate-y-0.5 hover:bg-white"
      >
        Resume assessment <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function CompletedAssessment({
  block,
  teacherName,
  teacherPortrait
}: {
  block: StoryPracticeBlockView;
  teacherName: string;
  teacherPortrait: string;
}) {
  const report = block.assessment?.report;

  if (!report) {
    return (
      <div role="alert">
        <h3 className="font-display text-[1.4rem] font-semibold text-cream">Results unavailable</h3>
        <p className="mt-2 text-sm leading-6 text-cream/55">
          This block assessment has no saved report.
        </p>
      </div>
    );
  }

  const scores = report.scores;
  const promptById = new Map(
    block.assessment?.assessment?.prompts.map((prompt) => [prompt.id, prompt.prompt]) ?? []
  );
  const metrics = METRICS.map(([key, label]) => ({
    label,
    value:
      key === "technical-accuracy"
        ? scores.technicalAccuracy
        : key === "mechanism-reasoning"
          ? scores.mechanismReasoning
          : key === "diagnosis-evidence"
            ? scores.diagnosisEvidence
            : key === "debugging-implementation"
              ? scores.debuggingImplementation
              : scores.communicationProduction
  }));

  return (
    <AssessmentResultsScorecard
      teacherName={teacherName}
      teacherPortrait={teacherPortrait}
      title={`Block ${block.ordinal} results`}
      overallScore={report.overallScore}
      summary={report.teacherSummary}
      metrics={metrics}
      evidenceLines={[
        `${report.solvedVsLearned.completedCount} completed · ${report.solvedVsLearned.learnedCount} learned`,
        report.solvedVsLearned.masteryCreditNote,
        `${report.deterministicEvidence.acceptedCodeQuestionCount}/${report.deterministicEvidence.totalCodeQuestionCount} implementation tasks verified by the runner${report.deterministicEvidence.implementationScoreCapped ? " · implementation score capped" : ""}`
      ]}
      strengths={report.strengths}
      improvementAreas={report.improvementAreas}
      questionFeedback={report.promptFeedback.map((feedback) => ({
        title: promptById.get(feedback.promptId) ?? "Assessment question",
        score: feedback.score,
        feedback: feedback.feedback
      }))}
    />
  );
}

function MetricPreview() {
  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cream/36">
        Evaluated Dimensions
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {METRICS.map(([key, label]) => (
          <span
            key={key}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[11px] font-medium text-cream/65"
          >
            <Check size={11} className="text-[var(--workspace-accent)]" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AssessmentNotice({
  remainingQuestions,
  teacherPortrait,
  onClose
}: {
  remainingQuestions: number;
  teacherPortrait: string;
  onClose: () => void;
}) {
  return createPortal(
    <aside
      role="status"
      aria-live="polite"
      aria-label="Assessment notification"
      className="dsa-assessment-notice practice-mobile-glass fixed bottom-8 left-1/2 z-[100] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[1.4rem] bg-[#18191c]/[0.99] shadow-[0_28px_90px_-26px_rgba(0,0,0,0.98)] backdrop-blur-xl"
    >
      <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <Image
          src={teacherPortrait}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            Checkpoint Locked
          </p>
          <h4 className="mt-1 font-display text-lg font-semibold text-cream">
            Finish your {remainingQuestions} remaining question{remainingQuestions === 1 ? "" : "s"}
          </h4>
          <p className="mt-1.5 text-xs leading-5 text-cream/60">
            Every question in your path builds evidence and invariants tested in this 1:1
            checkpoint. Finish or Learn each question to unlock.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-cream/40 transition hover:text-cream"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </aside>,
    document.body
  );
}

function readSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const direct =
    "sessionId" in payload && typeof payload.sessionId === "string" ? payload.sessionId : null;
  if (direct) return direct;
  if (
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "sessionId" in payload.data
  ) {
    return typeof payload.data.sessionId === "string" ? payload.data.sessionId : null;
  }
  return null;
}

function readStartError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: { message?: string } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return `The assessment could not be started (HTTP ${status}).`;
}
