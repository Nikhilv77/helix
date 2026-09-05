"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Loader2, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import type { DsaBlockHistoryItem } from "@/server/dsa/dsa-block-history.service";

const METRICS = [
  ["pattern-recognition", "Pattern recognition"],
  ["correctness-edge-cases", "Correctness & edge cases"],
  ["efficiency", "Time & space efficiency"],
  ["code-quality", "Code quality"],
  ["communication", "Communication"]
] as const;

export function BlockAssessmentPreview({
  block,
  nextBlockId,
  allowEarlyStart = false
}: {
  block: DsaBlockHistoryItem;
  nextBlockId: string | null;
  allowEarlyStart?: boolean;
}) {
  const teacher = useWorkspaceTeacher();
  const router = useRouter();
  const assessmentPortrait = `/images/teacher-portraits/assessment-headsets/${teacher.id}.jpg`;
  const remainingQuestions = Math.max(block.totalQuestions - block.completedQuestions, 0);
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
    if (!block.flags.practising) return;
    setNoticeVisible(true);
    setNudging(true);
  };

  const startAssessment = async () => {
    if (startPending.current) return;
    startPending.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch("/api/interview/dsa/block-assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blockId: block.id })
      });
      const payload: unknown = await response.json().catch(() => null);
      const sessionId = readSessionId(payload);
      if (!response.ok || !sessionId) throw new Error(readStartError(payload, response.status));
      router.push(`/interview/voice?session=${encodeURIComponent(sessionId)}`);
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
        aria-label="Block assessment"
        className={`${nudging ? "assessment-card-nudge" : ""} relative overflow-hidden rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]`}
      >
        <div
          className={
            block.flags.assessed
              ? "min-w-0"
              : "grid min-w-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] lg:grid-cols-[11.5rem_minmax(0,1fr)]"
          }
        >
          {!block.flags.assessed ? (
            <button
              type="button"
              onClick={showLockedNotice}
              disabled={!block.flags.practising}
              className="relative h-36 overflow-hidden bg-[#08090a] text-left disabled:cursor-default sm:h-auto sm:min-h-[12.5rem]"
              aria-label={
                block.flags.practising
                  ? `Block assessment, ${remainingQuestions} ${remainingQuestions === 1 ? "problem" : "problems"} left`
                  : `${teacher.name}, your assessment teacher`
              }
            >
              <Image
                src={assessmentPortrait}
                alt={`${teacher.name}, your teacher`}
                fill
                sizes="(min-width: 1024px) 184px, (min-width: 640px) 152px, 100vw"
                quality={95}
                className="object-cover object-[center_25%] opacity-95 sm:origin-top sm:scale-[1.65] sm:object-top"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_32%,rgba(4,5,6,0.18)_64%,rgba(4,5,6,0.72)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(8,9,10,0.72)_100%)] sm:bg-[linear-gradient(90deg,transparent_58%,rgba(14,16,17,0.9)_100%),linear-gradient(180deg,transparent_62%,rgba(8,9,10,0.68)_100%)]" />
              <div className="absolute inset-y-[12%] right-0 w-px bg-[linear-gradient(180deg,transparent,var(--workspace-accent),transparent)] opacity-55" />
              <span className="absolute left-3 top-3 h-5 w-5 border-l border-t border-[color:var(--workspace-accent-border)]" />
              <span className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-white/20" />
              <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-[#090a0b]/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-cream/78">
                {teacher.name} · 1:1 coach
              </div>
            </button>
          ) : null}

          <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
            {block.flags.practising ? (
              <LockedAssessment
                remainingQuestions={remainingQuestions}
                completionPercent={
                  block.totalQuestions > 0
                    ? Math.round((block.completedQuestions / block.totalQuestions) * 100)
                    : 0
                }
                teacherName={teacher.name}
                allowEarlyStart={allowEarlyStart}
                starting={starting}
                error={startError}
                onStart={() => void startAssessment()}
                onShowNotice={showLockedNotice}
              />
            ) : block.flags.assessmentReady ? (
              <ReadyAssessment
                teacherName={teacher.name}
                starting={starting}
                error={startError}
                onStart={() => void startAssessment()}
              />
            ) : block.flags.assessmentInProgress ? (
              <InProgressAssessment sessionId={block.assessment?.sessionId ?? null} />
            ) : (
              <CompletedAssessment
                block={block}
                nextBlockId={nextBlockId}
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
            {remainingQuestions} {remainingQuestions === 1 ? "problem" : "problems"} until your 1:1
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-cream/48">
            Solve your block questions to unlock this assessment with {teacherName}.
          </p>
        </div>

        {allowEarlyStart ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1011]"
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
              {remainingQuestions} {remainingQuestions === 1 ? "problem" : "problems"} left
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
        Review your submitted code, then solve two unseen transfer problems in a 40-minute session.
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

function InProgressAssessment({ sessionId }: { sessionId: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Assessment in progress
      </p>
      <h3 className="mt-2 font-display text-[1.5rem] font-semibold text-cream">
        Continue where you left off
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-cream/58">
        Your frozen questions and existing interview session are ready to resume.
      </p>
      {sessionId ? (
        <Link
          href={`/interview/voice?session=${encodeURIComponent(sessionId)}`}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-cream px-4 text-[12px] font-semibold text-[#090a0b] transition hover:-translate-y-0.5 hover:bg-white"
        >
          Resume assessment <ArrowRight size={15} aria-hidden="true" />
        </Link>
      ) : (
        <p role="alert" className="mt-4 text-sm text-[#efb38f]">
          This session is temporarily unavailable. Refresh to recover it.
        </p>
      )}
    </div>
  );
}

function CompletedAssessment({
  block,
  nextBlockId,
  teacherName,
  teacherPortrait
}: {
  block: DsaBlockHistoryItem;
  nextBlockId: string | null;
  teacherName: string;
  teacherPortrait: string;
}) {
  const report = block.assessment?.report;
  const [questionsVisible, setQuestionsVisible] = useState(false);
  if (!report) {
    return (
      <div role="alert">
        <h3 className="font-display text-[1.4rem] font-semibold text-cream">Results unavailable</h3>
        <p className="mt-2 text-sm leading-6 text-cream/55">
          This legacy block has no saved assessment report. Its practice cohort remains available.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.09] bg-[#08090a]">
            <Image
              src={teacherPortrait}
              alt={`${teacherName}, your assessment teacher`}
              fill
              sizes="56px"
              quality={90}
              className="scale-125 object-cover object-[center_22%]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(8,9,10,0.58)_100%)]" />
            <div className="absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,var(--workspace-accent),transparent)] opacity-60" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
              Assessment complete
            </p>
            <h3 className="mt-1 font-display text-[1.65rem] font-semibold text-cream">
              Block {block.ordinal} results
            </h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <div className="relative min-w-[5.5rem] overflow-hidden rounded-2xl border border-[color:var(--workspace-accent-border)] bg-white/[0.025] px-4 py-0.5">
            <span className="absolute inset-y-3 left-0 w-px bg-[var(--workspace-accent)]" />
            <p className="mt-0.5 flex items-end gap-1 leading-none">
              <span className="font-display text-5xl font-semibold tabular-nums text-cream">
                {report.overall}
              </span>
              <span className="pb-1 text-base font-medium text-cream/46">/100</span>
            </p>
          </div>
          {!block.current && nextBlockId ? (
            <Link
              href={`/practice/dsa?block=${encodeURIComponent(nextBlockId)}&panel=overview`}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cream px-4 text-sm font-semibold text-[#101113]"
            >
              Continue to your next block <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map(([key, label]) => (
          <div
            key={key}
            className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-2.5"
          >
            <dt className="text-sm leading-5 text-cream/52">{label}</dt>
            <dd className="mt-1 text-xl font-semibold leading-none tabular-nums text-cream">
              {report.metrics[key]}/100
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 lg:grid-cols-[1.2fr_0.8fr_1.4fr]">
        <div>
          <p className="text-base font-semibold leading-6 text-cream/78">{report.teacherSummary}</p>
          <p className="mt-1.5 text-sm leading-5 text-cream/52">
            {report.completion.answered}/{report.completion.total} answered
            {report.completion.skipped ? ` · ${report.completion.skipped} skipped` : ""}
            {report.completion.partial ? " · Partial completion" : " · Completed normally"}
            {` · ${formatDuration(report.durationMs)}`}
          </p>
          <p className="mt-0.5 text-sm text-cream/42">
            Assessed {formatDate(block.dates.assessedAt ?? report.completedAt)}
          </p>
        </div>
        <ReportList title="Strengths" items={report.strengths} />
        <ReportList title="Improvement areas" items={report.gaps} />
      </div>

      {block.assessment?.prompts.length ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-cream/52">
              {block.assessment.prompts.length} assessment questions
            </p>
            <button
              type="button"
              aria-expanded={questionsVisible}
              aria-controls={`assessment-questions-${block.id}`}
              onClick={() => setQuestionsVisible((visible) => !visible)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-sm font-semibold text-cream/72 transition hover:bg-white/[0.04] hover:text-cream"
            >
              {questionsVisible ? "Show less" : "View more"}
              <ChevronDown
                size={15}
                className={`transition-transform ${questionsVisible ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
          {questionsVisible ? (
            <ol id={`assessment-questions-${block.id}`} className="mt-3 grid gap-2 sm:grid-cols-2">
              {block.assessment.prompts.map((prompt, index) => (
                <li
                  key={`${prompt.kind}-${index}`}
                  className="rounded-xl border border-white/[0.055] bg-black/20 px-3.5 py-3 text-sm leading-6 text-cream/62"
                >
                  <span className="mr-1.5 text-cream/32">{index + 1}.</span> {prompt.title}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetricPreview() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.055] pt-3">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/35">
        Measures
      </p>
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map(([, label]) => (
          <div
            key={label}
            className="flex min-h-7 items-center gap-1.5 rounded-lg border border-white/[0.055] bg-white/[0.025] px-2.5 py-1"
          >
            <span className="text-[var(--workspace-accent)]" aria-hidden="true">
              <Check size={10} />
            </span>
            <p className="text-[10px] font-medium leading-4 text-cream/48">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.1em] text-cream/46">{title}</p>
      {items.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              title={item}
              className="rounded-lg border border-white/[0.055] bg-white/[0.025] px-2.5 py-1.5 text-sm font-medium leading-5 text-cream/62"
            >
              {conciseReportItem(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-cream/42">No saved notes.</p>
      )}
    </div>
  );
}

function conciseReportItem(item: string): string {
  const metric = METRICS.find(([key]) => item.startsWith(`${key} `));
  return metric?.[1] ?? item;
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
      className="fixed bottom-8 left-1/2 z-[100] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[1.4rem] bg-[#18191c]/[0.99] shadow-[0_28px_90px_-26px_rgba(0,0,0,0.98)] backdrop-blur-xl"
    >
      <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <Image
          src={teacherPortrait}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-cream">
            Solve all recommended problems to unlock
          </p>
          <p className="mt-1 text-[13px] leading-5 text-cream/45">
            {remainingQuestions} {remainingQuestions === 1 ? "problem" : "problems"} left in this
            block.
          </p>
          <p className="mt-2 text-[12px] leading-5 text-cream/38">
            Complete the full block so your teacher can assess how well these patterns transfer into
            a fresh coding conversation.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-cream/35 hover:bg-white/[0.05]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>,
    document.body
  );
}

function readSessionId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = "data" in value ? value.data : null;
  return data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "sessionId" in data &&
    typeof data.sessionId === "string"
    ? data.sessionId
    : null;
}

function readStartError(value: unknown, status: number): string {
  if (value && typeof value === "object" && !Array.isArray(value) && "error" in value) {
    const error = value.error;
    if (
      error &&
      typeof error === "object" &&
      !Array.isArray(error) &&
      "message" in error &&
      typeof error.message === "string"
    )
      return error.message;
  }
  if (status === 404) return "This assessment block could not be found.";
  if (status === 409) return "This assessment is not ready to start.";
  if (status === 422) return "The saved assessment could not be prepared safely.";
  return "The assessment could not be started. Try again.";
}

function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
