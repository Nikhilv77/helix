"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { DARK_PORTRAIT_PLACEHOLDER } from "@/lib/avatars/portrait-placeholder";
import { humanizeCoreTechnicalKey } from "@/lib/practice/core-technical/ui-state";
import type { CoreTechnicalPublicBlock } from "@/server/core-technical/practice.service";

export type PublicAssessment = NonNullable<CoreTechnicalPublicBlock["assessment"]>;
type AssessmentSnapshot = NonNullable<PublicAssessment["assessment"]>;
type SavedSubmission = NonNullable<AssessmentSnapshot["submission"]>;
type AssessmentResponse = AssessmentSnapshot["prompts"][number] extends { id: string }
  ? { promptId: string; answer: string }
  : never;
type PendingAction = "start" | "finalize" | "continue" | null;

export type StoryPracticeAssessmentExperience = {
  slug: string;
  label: string;
  apiBase: string;
  routeBase: string;
  subjectNoun: string;
  measures: readonly string[];
  scoreRows: (report: PublicAssessment["report"]) => ReadonlyArray<readonly [string, number]>;
  adaptAssessment: (assessment: unknown) => PublicAssessment;
};

export const CORE_TECHNICAL_ASSESSMENT_EXPERIENCE: StoryPracticeAssessmentExperience = {
  slug: "core-technical",
  label: "Core Technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "story",
  measures: [
    "Technical accuracy",
    "Mechanism reasoning",
    "Diagnosis evidence",
    "Debugging & implementation",
    "Communication & production"
  ],
  scoreRows: (report) =>
    report
      ? [
          ["Technical accuracy", report.scores.technicalAccuracy],
          ["Mechanism reasoning", report.scores.mechanismReasoning],
          ["Diagnosis evidence", report.scores.diagnosisEvidence],
          ["Debugging & implementation", report.scores.debuggingImplementation],
          ["Communication & production", report.scores.communicationProduction]
        ]
      : [],
  adaptAssessment: (assessment) => assessment as PublicAssessment
};

export function CoreTechnicalAssessment({
  block,
  terminalCount,
  allowEarlyStart = false,
  experience = CORE_TECHNICAL_ASSESSMENT_EXPERIENCE
}: {
  block: CoreTechnicalPublicBlock;
  terminalCount: number;
  allowEarlyStart?: boolean;
  experience?: StoryPracticeAssessmentExperience;
}) {
  const router = useRouter();
  const teacher = useWorkspaceTeacher();
  const teacherPortrait = `/images/teacher-portraits/assessment-headsets/${teacher.id}.jpg`;
  const [assessment, setAssessment] = useState(block.assessment);
  const serverSubmission = assessment?.assessment?.submission ?? null;
  const [recoverySubmission, setRecoverySubmission] = useState<SavedSubmission | null>(null);
  const effectiveSubmission = serverSubmission ?? recoverySubmission;
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    answersFrom(serverSubmission?.responses ?? [])
  );
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(serverSubmission !== null);
  const pendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const status = assessment?.status ?? "LOCKED";
  const snapshot = assessment?.assessment ?? null;
  const report = assessment?.report ?? null;
  const retryingFinalization = status === "FINALIZING" || recoverySubmission !== null;
  const draftKey = assessment ? `${experience.slug}-assessment-draft:${assessment.id}` : null;

  useEffect(() => {
    setAssessment(block.assessment);
    const restored = block.assessment?.assessment?.submission?.responses;
    if (restored) {
      setRecoverySubmission(null);
      setAnswers(answersFrom(restored));
    } else if (block.assessment?.status === "COMPLETED") {
      setRecoverySubmission(null);
    }
  }, [block.assessment]);

  useEffect(() => {
    if (!draftKey || effectiveSubmission) {
      setDraftReady(true);
      return;
    }
    const saved = readAnswerDraft(draftKey);
    if (saved) setAnswers(saved);
    setDraftReady(true);
  }, [draftKey, effectiveSubmission]);

  useEffect(() => {
    if (!draftReady || !draftKey || effectiveSubmission || status !== "IN_PROGRESS") return;
    window.sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, answers }));
  }, [answers, draftKey, draftReady, effectiveSubmission, status]);

  useEffect(() => {
    if (status === "IN_PROGRESS" || status === "FINALIZING" || status === "COMPLETED") {
      headingRef.current?.focus();
    }
  }, [recoverySubmission, status]);

  if (!assessment || status === "LOCKED") {
    if (assessment && allowEarlyStart && block.isCurrent) {
      return (
        <AssessmentPreviewFrame
          id="assessment"
          label={`${experience.label} assessment`}
          teacherName={teacher.name}
          teacherPortrait={teacherPortrait}
        >
          <ReadyAssessment
            teacherName={teacher.name}
            starting={pending === "start"}
            error={error}
            early
            measures={experience.measures}
            onStart={() => void startAssessment()}
          />
        </AssessmentPreviewFrame>
      );
    }
    return (
      <AssessmentPreviewFrame
        id="assessment"
        label={`${experience.label} assessment`}
        teacherName={teacher.name}
        teacherPortrait={teacherPortrait}
      >
        <AssessmentHeader
          eyebrow="Block assessment"
          title={`${Math.max(0, 8 - terminalCount)} question${8 - terminalCount === 1 ? "" : "s"} left to unlock`}
          description={`Finish or Learn every question to unlock your ${experience.subjectNoun} review with ${teacher.name}.`}
          badge="Locked"
          icon={<LockKeyhole size={13} aria-hidden="true" />}
        />
        <AssessmentMeasures measures={experience.measures} />
      </AssessmentPreviewFrame>
    );
  }

  if (status === "READY") {
    return (
      <AssessmentPreviewFrame
        id="assessment"
        label={`${experience.label} assessment`}
        teacherName={teacher.name}
        teacherPortrait={teacherPortrait}
      >
        <ReadyAssessment
          teacherName={teacher.name}
          starting={pending === "start"}
          error={error}
          measures={experience.measures}
          onStart={() => void startAssessment()}
        />
      </AssessmentPreviewFrame>
    );
  }

  if (status === "COMPLETED" && report) {
    return (
      <AssessmentFrame id="report" label={`${experience.label} report`}>
        <Report
          block={block}
          assessment={assessment}
          headingRef={headingRef}
          pending={pending === "continue"}
          error={error}
          onContinue={() => void continueStory()}
          experience={experience}
        />
      </AssessmentFrame>
    );
  }

  return (
    <AssessmentFrame id="assessment" label={`${experience.label} assessment`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            Block assessment
          </p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 font-display text-[1.4rem] font-semibold text-cream outline-none"
          >
            {retryingFinalization ? "Complete your saved report" : "Five-prompt evidence defence"}
          </h3>
          <p className="mt-2 max-w-[39rem] text-[13px] leading-5 text-cream/52">
            {status === "FINALIZING"
              ? "Your five answers are checkpointed by the server. Retry the exact saved submission to finish the report."
              : recoverySubmission
                ? "The submission outcome is unknown, so your five answers and request ID are frozen for one exact retry."
                : "Answer every prompt. Drafts remain in this browser until the server checkpoints the complete submission."}
          </p>
        </div>
        <StateBadge
          label={
            status === "FINALIZING"
              ? "Finalizing"
              : recoverySubmission
                ? "Submission interrupted"
                : "In progress"
          }
          loading={pending === "finalize"}
        />
      </div>

      {snapshot ? (
        <ol className="mt-6 space-y-5">
          {snapshot.prompts.map((prompt) => {
            const inputId = `assessment-prompt-${prompt.order}`;
            return (
              <li key={prompt.id} className="rounded-xl bg-[#141619] px-4 py-5 sm:px-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-cream/36">
                  Prompt {prompt.order} · {humanizeCoreTechnicalKey(prompt.kind)}
                </p>
                <label
                  htmlFor={inputId}
                  className="mt-2 block text-[14px] font-semibold leading-6 text-cream/82"
                >
                  {prompt.prompt}
                </label>
                {prompt.context ? (
                  <p className="mt-2 border-l-2 border-[var(--workspace-accent-border)] pl-3 text-[12.5px] leading-5 text-cream/48">
                    {prompt.context}
                  </p>
                ) : null}
                <textarea
                  id={inputId}
                  value={answers[prompt.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [prompt.id]: event.target.value }))
                  }
                  readOnly={retryingFinalization || pending === "finalize" || !block.isCurrent}
                  maxLength={4_000}
                  rows={5}
                  aria-describedby={`${inputId}-count`}
                  className="mt-4 min-h-32 w-full resize-y rounded-lg border border-white/[0.08] bg-[#111214] px-3.5 py-3 text-[13px] leading-6 text-cream outline-none placeholder:text-cream/28 focus:border-[var(--workspace-accent-border)] focus:ring-2 focus:ring-[var(--workspace-accent-soft)] read-only:cursor-default read-only:text-cream/56"
                  placeholder="Explain the mechanism, evidence, and production consequence."
                />
                <p
                  id={`${inputId}-count`}
                  className="mt-1.5 text-right text-[10px] tabular-nums text-cream/54"
                >
                  {(answers[prompt.id] ?? "").length}/4000
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p role="status" className="mt-5 text-[13px] text-cream/52">
          The frozen prompts are unavailable. Refresh this {experience.subjectNoun} before continuing.
        </p>
      )}

      {error ? <ActionError message={error} /> : null}
      {block.isCurrent && snapshot ? (
        <button
          type="button"
          onClick={() => void finalizeAssessment()}
          disabled={pending !== null}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-2.5 text-[14px] font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-55 sm:w-auto"
        >
          {pending === "finalize" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : retryingFinalization ? (
            <RotateCcw size={14} aria-hidden="true" />
          ) : null}
          {pending === "finalize"
            ? "Building report…"
            : retryingFinalization
              ? "Retry report"
              : "Submit all answers"}
        </button>
      ) : null}
    </AssessmentFrame>
  );

  async function startAssessment() {
    if (!assessment || pendingRef.current || !block.isCurrent) return;
    pendingRef.current = true;
    setPending("start");
    setError(null);
    const key = `${experience.slug}-assessment-start:${assessment.id}`;
    const requestId = replaySafeRequestId(key, assessment.id);
    try {
      const data = await post<{ assessment: PublicAssessment }>(
        `${experience.apiBase}/assessment/start`,
        { assessmentId: assessment.id, requestId }
      );
      window.sessionStorage.removeItem(key);
      setAssessment(experience.adaptAssessment(data.assessment));
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause, "The assessment could not start. Try again."));
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  async function finalizeAssessment() {
    if (!assessment || !snapshot || pendingRef.current || !block.isCurrent) return;
    const responses: AssessmentResponse[] = effectiveSubmission
      ? [...effectiveSubmission.responses]
      : snapshot.prompts.map((prompt) => ({
          promptId: prompt.id,
          answer: (answers[prompt.id] ?? "").trim()
        }));
    const invalid = responses.find((response) => response.answer.length < 4);
    if (invalid) {
      setError("Answer every prompt with at least 4 characters before submitting.");
      document
        .getElementById(
          `assessment-prompt-${snapshot.prompts.find((prompt) => prompt.id === invalid.promptId)?.order}`
        )
        ?.focus();
      return;
    }
    pendingRef.current = true;
    setPending("finalize");
    setError(null);
    const key = `${experience.slug}-assessment-finalize:${assessment.id}`;
    const signature = JSON.stringify(responses);
    const requestId = effectiveSubmission?.requestId ?? replaySafeRequestId(key, signature);
    try {
      const data = await post<{ assessment: PublicAssessment }>(
        `${experience.apiBase}/assessment/finalize`,
        { assessmentId: assessment.id, requestId, responses }
      );
      window.sessionStorage.removeItem(key);
      if (draftKey) window.sessionStorage.removeItem(draftKey);
      setRecoverySubmission(null);
      setAssessment(experience.adaptAssessment(data.assessment));
      router.refresh();
    } catch (cause) {
      setRecoverySubmission({ requestId, responses, submittedAt: new Date().toISOString() });
      setError(
        messageFrom(
          cause,
          "Your answers are safe, but the report could not be completed. Try again."
        )
      );
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  async function continueStory() {
    if (pendingRef.current || !block.isCurrent || !report) return;
    pendingRef.current = true;
    setPending("continue");
    setError(null);
    const key = `${experience.slug}-continue:${block.id}`;
    const requestId = replaySafeRequestId(key, block.id);
    try {
      const data = await post<{ replayed: boolean; block: CoreTechnicalPublicBlock | null }>(
        `${experience.apiBase}/continue`,
        { blockId: block.id, requestId }
      );
      if (!data.block) throw new Error(`The next ${experience.subjectNoun} was prepared but could not be loaded.`);
      window.sessionStorage.removeItem(key);
      router.replace(`${experience.routeBase}?block=${encodeURIComponent(data.block.id)}`);
      router.refresh();
    } catch (cause) {
      setError(
        messageFrom(cause, `The next ${experience.subjectNoun} could not be prepared. This report is still safe.`)
      );
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }
}

function ReadyAssessment({
  teacherName,
  starting,
  error,
  early = false,
  measures,
  onStart
}: {
  teacherName: string;
  starting: boolean;
  error: string | null;
  early?: boolean;
  measures: readonly string[];
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
        Defend the mechanisms, evidence, repair, and production consequences in five focused
        prompts.
      </p>
      {early ? (
        <p className="mt-1 text-[11px] leading-5 text-cream/36">
          Development preview: unfinished questions will be recorded as Learned with zero mastery.
        </p>
      ) : null}
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
      <AssessmentMeasures measures={measures} />
    </div>
  );
}

function AssessmentMeasures({ measures }: { measures: readonly string[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.055] pt-3">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/35">
        Measures
      </p>
      <div className="flex flex-wrap gap-1.5">
        {measures.map((label) => (
          <div
            key={label}
            className="flex min-h-7 items-center gap-1.5 rounded-lg border border-white/[0.055] bg-white/[0.025] px-2.5 py-1"
          >
            <Check size={10} className="text-[var(--workspace-accent)]" aria-hidden="true" />
            <p className="text-[10px] font-medium leading-4 text-cream/48">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentPreviewFrame({
  id,
  label,
  teacherName,
  teacherPortrait,
  children
}: {
  id: string;
  label: string;
  teacherName: string;
  teacherPortrait: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      id={id}
      aria-label={label}
      className="relative overflow-hidden rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
    >
      <div className="grid min-w-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] lg:grid-cols-[11.5rem_minmax(0,1fr)]">
        <div className="relative h-36 overflow-hidden bg-[#08090a] sm:h-auto sm:min-h-[12.5rem]">
          <Image
            src={teacherPortrait}
            alt={`${teacherName}, your teacher`}
            fill
            sizes="(min-width: 1024px) 184px, (min-width: 640px) 152px, 100vw"
            priority
            placeholder="blur"
            blurDataURL={DARK_PORTRAIT_PLACEHOLDER}
            className="bg-[#08090a] object-cover object-[center_25%] opacity-95 sm:origin-top sm:scale-[1.65] sm:object-top"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_32%,rgba(4,5,6,0.18)_64%,rgba(4,5,6,0.72)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(8,9,10,0.72)_100%)] sm:bg-[linear-gradient(90deg,transparent_58%,rgba(14,16,17,0.9)_100%),linear-gradient(180deg,transparent_62%,rgba(8,9,10,0.68)_100%)]" />
          <div className="absolute inset-y-[12%] right-0 w-px bg-[linear-gradient(180deg,transparent,var(--workspace-accent),transparent)] opacity-55" />
          <span className="absolute left-3 top-3 h-5 w-5 border-l border-t border-[color:var(--workspace-accent-border)]" />
          <span className="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-white/20" />
          <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-[#090a0b]/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-cream/78">
            {teacherName} · story coach
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </div>
    </aside>
  );
}

function AssessmentFrame({
  id,
  label,
  children
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      id={id}
      aria-label={label}
      className="relative overflow-hidden rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:px-6"
    >
      {children}
    </aside>
  );
}

function AssessmentHeader({
  eyebrow,
  title,
  description,
  badge,
  icon
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
          {eyebrow}
        </p>
        <h3 className="mt-2 font-display text-[1.25rem] font-semibold text-cream">{title}</h3>
        <p className="mt-2 max-w-[36rem] text-[13px] leading-5 text-cream/52">{description}</p>
      </div>
      <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/55">
        {icon}
        {badge}
      </span>
    </div>
  );
}

function StateBadge({ label, loading }: { label: string; loading: boolean }) {
  return (
    <span
      role="status"
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/55"
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : (
        <Clock3 size={13} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function Report({
  block,
  assessment,
  headingRef,
  pending,
  error,
  onContinue,
  experience
}: {
  block: CoreTechnicalPublicBlock;
  assessment: PublicAssessment;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  pending: boolean;
  error: string | null;
  onContinue: () => void;
  experience: StoryPracticeAssessmentExperience;
}) {
  const report = assessment.report!;
  const transcript = assessment.transcript;
  const promptById = new Map(
    assessment.assessment?.prompts.map((prompt) => [prompt.id, prompt]) ?? []
  );
  const scores = experience.scoreRows(report);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            {capitalize(experience.subjectNoun)} report
          </p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 font-display text-[1.55rem] font-semibold text-cream outline-none"
          >
            {report.overallScore}/100 overall
          </h3>
          <p className="mt-2 max-w-[39rem] text-[13px] leading-6 text-cream/58">
            {report.teacherSummary}
          </p>
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-[var(--workspace-accent-soft)] px-3 text-xs font-semibold text-[var(--workspace-accent)]">
          <CheckCircle2 size={13} aria-hidden="true" /> Completed
        </span>
      </div>

      <dl className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {scores.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#141619] px-3.5 py-3">
            <dt className="text-[9px] font-semibold uppercase leading-4 tracking-[0.1em] text-cream/34">
              {label}
            </dt>
            <dd className="mt-1.5 text-lg font-semibold tabular-nums text-cream">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ReportList title="Strengths" items={report.strengths} />
        <ReportList title="Improve next" items={report.improvementAreas} />
      </div>

      <section className="mt-5" aria-labelledby="prompt-feedback-heading">
        <h4 id="prompt-feedback-heading" className="text-[13px] font-semibold text-cream/78">
          Prompt feedback
        </h4>
        <ol className="mt-3 space-y-2">
          {report.promptFeedback.map((feedback, index) => (
            <li key={feedback.promptId} className="rounded-xl bg-[#141619] px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[12.5px] font-semibold leading-5 text-cream/72">
                  {index + 1}. {promptById.get(feedback.promptId)?.prompt ?? "Assessment prompt"}
                </p>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--workspace-accent)]">
                  {feedback.score}/100
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-5 text-cream/50">{feedback.feedback}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="mt-5 rounded-xl border border-white/[0.07] px-4 py-4"
        aria-labelledby="mastery-evidence-heading"
      >
        <h4 id="mastery-evidence-heading" className="text-[13px] font-semibold text-cream/76">
          Practice evidence
        </h4>
        <p className="mt-2 text-[12.5px] leading-5 text-cream/52">
          {report.solvedVsLearned.completedCount} solved · {report.solvedVsLearned.learnedCount}{" "}
          learned · {report.deterministicEvidence.acceptedCodeQuestionCount}/
          {report.deterministicEvidence.totalCodeQuestionCount} code questions accepted
        </p>
        <p className="mt-2 text-[12px] leading-5 text-cream/42">
          {report.solvedVsLearned.masteryCreditNote}
        </p>
        {report.deterministicEvidence.implementationScoreCapped ? (
          <p className="mt-2 text-[12px] leading-5 text-[#e7bd83]">
            The implementation score cap was preserved because accepted runner evidence was
            incomplete.
          </p>
        ) : null}
      </section>

      {transcript ? (
        <details className="mt-5 rounded-xl border border-white/[0.07] px-4 py-4">
          <summary className="min-h-11 cursor-pointer text-[13px] font-semibold leading-[2.75rem] text-cream/68 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]">
            Review your safe transcript
          </summary>
          <ol className="mt-3 space-y-4">
            {transcript.entries.map((entry) => (
              <li key={entry.promptId}>
                <p className="text-[12px] font-semibold leading-5 text-cream/66">
                  {entry.order}. {entry.prompt}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-5 text-cream/48">
                  {entry.answer}
                </p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <section
        className="mt-6 rounded-xl bg-[#141619] px-4 py-5 sm:px-5"
        aria-labelledby={`next-${experience.slug}-heading`}
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--workspace-accent)]">
          Recommended next {experience.subjectNoun}
        </p>
        <h4
          id={`next-${experience.slug}-heading`}
          className="mt-2 font-display text-[1.25rem] font-semibold text-cream"
        >
          {report.nextStory.selectedStory.title}
        </h4>
        <p className="mt-2 text-[12.5px] leading-5 text-cream/52">{report.nextStory.reason}</p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-cream/36">
          {humanizeCoreTechnicalKey(report.nextStory.selectedStory.difficulty)} ·{" "}
          {report.nextStory.selectedStory.emphasizedConceptKeys
            .map(humanizeCoreTechnicalKey)
            .join(" · ")}
        </p>
      </section>

      {error ? <ActionError message={error} /> : null}
      {block.isCurrent ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="group mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-2.5 text-[14px] font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-55 sm:w-auto"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight size={15} aria-hidden="true" />
          )}
          {pending
            ? `Preparing next ${experience.subjectNoun}…`
            : error
              ? `Retry next ${experience.subjectNoun}`
              : `Continue to next ${experience.subjectNoun}`}
        </button>
      ) : (
        <p role="status" className="mt-5 text-[12px] text-cream/42">
          Historical reports are read-only.
        </p>
      )}
    </>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl bg-[#141619] px-4 py-4" aria-label={title}>
      <h4 className="text-[12px] font-semibold text-cream/72">{title}</h4>
      <ul className="mt-2 space-y-2 text-[12.5px] leading-5 text-cream/50">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}

function ActionError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-5 rounded-lg border border-[#e3a15b]/20 bg-[#e3a15b]/10 px-4 py-3 text-[13px] leading-5 text-[#e7bd83]"
    >
      {message}
    </p>
  );
}

function answersFrom(responses: ReadonlyArray<{ promptId: string; answer: string }>) {
  return Object.fromEntries(responses.map((response) => [response.promptId, response.answer]));
}

function readAnswerDraft(key: string): Record<string, string> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; answers?: unknown };
    if (parsed.version !== 1 || !isRecord(parsed.answers)) return null;
    return Object.fromEntries(
      Object.entries(parsed.answers).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return null;
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(
      payload?.error?.message ?? "This Core Technical action could not be completed."
    );
  }
  return payload.data;
}

function replaySafeRequestId(key: string, signature: string): string {
  const raw = window.sessionStorage.getItem(key);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as { signature?: unknown; requestId?: unknown };
      if (saved.signature === signature && typeof saved.requestId === "string")
        return saved.requestId;
    } catch {
      // Replace malformed browser state with a fresh, server-valid request ID.
    }
  }
  const requestId = crypto.randomUUID();
  window.sessionStorage.setItem(key, JSON.stringify({ signature, requestId }));
  return requestId;
}

function messageFrom(cause: unknown, fallback: string): string {
  if (cause instanceof TypeError && /fetch|network/i.test(cause.message)) return fallback;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
