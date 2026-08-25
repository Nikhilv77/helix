"use client";

import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  ListChecks,
  MessageSquareText,
  Timer,
  UserRoundCheck,
  Volume2,
  VolumeX
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createThemedReportPdf, type ReportPdfBriefing } from "@/lib/reports/report-pdf";
import type { ReportsOverview } from "@/lib/reports/reports";
import { formatDuration, formatShortDate, roundShortLabel } from "@/lib/shared/labels";
import type { InterviewReport } from "@/lib/shared/types";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { ReportEmptyStage } from "./report-briefing-stage";
import { ReportMayaAvatar } from "./report-maya-avatar";

type Candidate = {
  name: string;
  discipline: string;
};

type Signal = {
  id: "clarity" | "structure" | "ownership" | "impact";
  label: string;
  score: number;
  icon: typeof MessageSquareText;
  observation: string;
  evidence: string;
  nextMove: string;
};

type FeedbackMode = "needs-work" | "working" | "next-step";

export function InterviewReportDashboard({
  report,
  overview,
  candidate,
  quota
}: {
  report: InterviewReport | null;
  overview: ReportsOverview;
  candidate: Candidate;
  quota: { used: number; limit: number };
}) {
  const teacher = useWorkspaceTeacher();
  const router = useRouter();
  const ownerReconciled = useRef(false);

  useEffect(() => {
    if (report || ownerReconciled.current) return;
    ownerReconciled.current = true;

    void fetch("/api/interview/reconcile-owner", { method: "POST" })
      .then((response) => response.json())
      .then((payload: { success?: boolean; data?: { moved?: number } }) => {
        if (payload.success && payload.data?.moved) router.refresh();
      })
      .catch(() => null);
  }, [report, router]);

  if (!report) {
    return (
      <ReportEmptyStage
        firstName={candidate.name.split(/\s+/)[0] ?? ""}
        exhausted={quota.used >= quota.limit}
      />
    );
  }

  const briefing = buildPdfBriefing(report, overview, candidate);
  const signals = buildSignals(report);
  const feedback = groupSignals(signals);
  const strongest = report.summary.strongest ?? "Your interview signal";
  const gap = report.summary.recommendedFocus ?? "Answer endings";
  const mayaMessage = mayaSummary(report, candidate.name, strongest, gap);
  const { state: voiceState, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const spokenMessage = useRef<string | null>(null);
  const speaking = voiceState === "speaking";
  const speakSummary = useCallback(() => {
    void speak(mayaMessage).then((result) => {
      if (result !== "blocked") spokenMessage.current = mayaMessage;
    });
  }, [mayaMessage, speak]);

  useEffect(() => {
    if (awaitingGesture || spokenMessage.current === mayaMessage) return;
    const timer = window.setTimeout(speakSummary, 420);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, mayaMessage, speakSummary]);

  useEffect(() => {
    if (!awaitingGesture) return;

    const unlock = () => {
      setAwaitingGesture(false);
      speakSummary();
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture, speakSummary]);

  return (
    <section className="mx-auto w-full max-w-6xl text-cream">
      <div className="flex justify-end">
        <DownloadInterviewReportButton briefing={briefing} />
      </div>

      <header className="relative mx-auto flex max-w-2xl flex-col items-center pb-12 pt-2 text-center sm:pb-14">
        <div className="relative w-full max-w-[22rem]">
          <span
            aria-hidden
            className="report-maya-glow-a pointer-events-none absolute left-1/2 top-[46%] z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[72px]"
          />
          <span
            aria-hidden
            className="report-maya-glow-b pointer-events-none absolute bottom-3 left-1/2 z-0 h-24 w-56 -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-30 blur-[64px]"
          />
          <div className="relative z-10">
            <ReportMayaAvatar delay={0} size="compact" transparent speaking={speaking} />
          </div>
        </div>

        <div className="identity-stage-in relative z-10 -mt-7 flex max-w-xl flex-col items-center sm:-mt-9">
          <div className="report-glass-card relative rounded-2xl px-5 py-4 text-left sm:px-6">
            <span
              aria-hidden
              className="report-glass-tail absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45"
            />
            <p className="relative text-base font-medium leading-7 text-cream sm:text-lg sm:leading-8">
              <StaggeredWords text={mayaMessage} delay={120} />
            </p>
            <button
              type="button"
              onClick={() => (speaking || voiceState === "loading" ? stop() : speakSummary())}
              className={`relative mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181b] ${
                speaking || voiceState === "loading"
                  ? "text-cream hover:text-cream/70"
                  : "text-[var(--workspace-accent)] hover:brightness-110"
              }`}
            >
              {speaking || voiceState === "loading" ? (
                <VolumeX size={15} aria-hidden="true" />
              ) : (
                <Volume2 size={15} aria-hidden="true" />
              )}
              {voiceState === "loading"
                ? `Starting ${teacher.name}`
                : speaking
                  ? `Stop ${teacher.name}`
                  : `Hear ${teacher.name}`}
            </button>
          </div>
          {awaitingGesture ? (
            <p className="mt-3 text-xs font-medium text-[var(--workspace-accent)]">
              Tap to hear {teacher.name}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-cream/54">
            {candidate.discipline || report.setup.role} · {report.setup.level}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-cream/58">
            <Meta
              icon={MessageSquareText}
              label="Round"
              value={roundShortLabel(report.setup.roundType)}
            />
            <Meta icon={CalendarDays} label="Date" value={formatShortDate(report.startedAt)} />
            <Meta icon={Timer} label="Duration" value={formatDuration(report.durationMs)} />
            <Meta
              icon={ArrowUpRight}
              label="Difficulty"
              value={capitalize(report.setup.intensity)}
            />
          </div>
        </div>
      </header>

      <article
        className="report-latest-strip mx-auto w-full max-w-4xl"
        style={{ "--report-delay": "420ms" } as CSSProperties}
      >
        <ReportQuickRead report={report} strongest={strongest} gap={gap} />
        <FeedbackSection
          title="What needs work"
          description="These are the parts of your answer that need a little more evidence."
          signals={feedback.needsWork}
          mode="needs-work"
          delay={540}
        />
        <FeedbackSection
          title="What went well"
          description="Keep bringing these strengths into your next conversation."
          signals={feedback.working}
          mode="working"
          delay={780}
        />
        <FeedbackSection
          title="How to make the next one better"
          description="Start here next time — small changes make your answers land harder."
          signals={feedback.nextSteps}
          mode="next-step"
          delay={1020}
        />
      </article>
    </section>
  );
}

function ReportQuickRead({
  report,
  strongest,
  gap
}: {
  report: InterviewReport;
  strongest: string;
  gap: string;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="report-glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">Round score</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-semibold leading-none tracking-tight text-cream">
            {report.summary.evidenceScore}
          </span>
          <span className="pb-0.5 text-sm text-cream/58">/100</span>
        </div>
        <p className="mt-2 text-sm font-medium text-cream/72">
          {signalStatus(report.summary.evidenceScore)}
        </p>
      </div>

      <div className="report-glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">
          Strongest signal
        </p>
        <p className="mt-3 text-lg font-semibold leading-6 text-cream">{strongest}</p>
        <p className="mt-2 text-sm leading-6 text-cream/58">
          Keep using this as the anchor for your answers.
        </p>
      </div>

      <div className="report-glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">Build next</p>
        <p className="mt-3 text-lg font-semibold leading-6 text-cream">{gap}</p>
        <p className="mt-2 text-sm leading-6 text-cream/58">{report.summary.nextStep}</p>
      </div>
    </section>
  );
}

function StaggeredWords({ text, delay }: { text: string; delay: number }) {
  return (
    <span aria-label={text}>
      {text.split(/\s+/).map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="report-word-rise"
          style={{ "--word-delay": `${delay + index * 42}ms` } as CSSProperties}
        >
          {word}
          {index < text.split(/\s+/).length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </span>
  );
}

function FeedbackSection({
  title,
  description,
  signals,
  mode,
  delay
}: {
  title: string;
  description: string;
  signals: Signal[];
  mode: FeedbackMode;
  delay: number;
}) {
  return (
    <section className="border-t border-white/[0.07] py-7 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 className="text-xl font-semibold tracking-tight text-cream">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-cream/48 sm:text-right">{description}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {signals.map((signal, index) => (
          <SignalNote
            key={`${mode}-${signal.id}`}
            signal={signal}
            mode={mode}
            delay={delay + index * 90}
          />
        ))}
      </div>
    </section>
  );
}

function SignalNote({
  signal,
  mode,
  delay
}: {
  signal: Signal;
  mode: FeedbackMode;
  delay: number;
}) {
  const Icon = signal.icon;
  const status = signalStatus(signal.score);
  const title =
    mode === "next-step" ? `Start with ${signal.label.toLowerCase()}.` : signal.observation;
  const copy = mode === "working" ? signal.evidence : signal.nextMove;
  return (
    <article
      className="report-glass-card report-latest-strip rounded-2xl p-5"
      style={{ "--report-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Icon
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
            className="shrink-0 text-[var(--workspace-accent)]"
          />
          <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">
            {signal.label}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-semibold leading-none tabular-nums text-cream">
            {signal.score}
          </span>
          <p className="mt-1 text-xs font-medium text-[var(--workspace-accent)]">{status}</p>
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-cream">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-cream/58">{copy}</p>
    </article>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
      <span>
        <span className="text-cream/42">{label}: </span>
        {value}
      </span>
    </span>
  );
}

function buildSignals(report: InterviewReport): Signal[] {
  const answered = report.competencies.filter((item) => item.answered);
  const average = (pick: (item: (typeof answered)[number]) => number) =>
    answered.length
      ? Math.round(answered.reduce((total, item) => total + pick(item), 0) / answered.length)
      : 0;
  const specificity = average((item) => item.evidenceBreakdown?.specificity ?? item.evidenceScore);
  const clarity = Math.max(0, specificity - report.interaction.clarifications * 4);

  return [
    signal("clarity", "Clarity", clarity, MessageSquareText, report),
    signal(
      "structure",
      "Structure",
      average((item) => item.evidenceBreakdown?.decision ?? item.evidenceScore),
      ListChecks,
      report
    ),
    signal(
      "ownership",
      "Ownership",
      average((item) => item.evidenceBreakdown?.ownership ?? item.evidenceScore),
      UserRoundCheck,
      report
    ),
    signal(
      "impact",
      "Impact",
      average((item) => item.evidenceBreakdown?.outcome ?? item.evidenceScore),
      CheckCircle2,
      report
    )
  ];
}

function signal(
  id: Signal["id"],
  label: Signal["label"],
  score: number,
  icon: Signal["icon"],
  report: InterviewReport
): Signal {
  const competency = findSignalCompetency(report, id);
  const observation =
    score >= 75
      ? `Your ${label.toLowerCase()} came through clearly.`
      : score >= 45
        ? `Your ${label.toLowerCase()} is taking shape.`
        : `Your ${label.toLowerCase()} needs a clearer signal.`;

  return {
    id,
    label,
    score,
    icon,
    observation,
    evidence: competency?.signals[0] ?? positiveSignalDetail(id),
    nextMove: competency?.nextStep ?? signalNextMove(id)
  };
}

function groupSignals(signals: Signal[]) {
  const sorted = [...signals].sort((left, right) => left.score - right.score);
  const needsWork = signals.filter((signal) => signal.score < 55);
  const working = signals.filter((signal) => signal.score >= 55);

  return {
    needsWork: needsWork.length ? needsWork : sorted.slice(0, 1),
    working: working.length ? working : sorted.slice(-1),
    nextSteps: sorted.slice(0, Math.min(2, sorted.length))
  };
}

function findSignalCompetency(report: InterviewReport, signalId: Signal["id"]) {
  const keywords: Record<Signal["id"], string[]> = {
    clarity: ["clarity", "communication", "explain"],
    structure: ["structure", "decision", "approach"],
    ownership: ["ownership", "leadership", "responsibility"],
    impact: ["impact", "outcome", "result"]
  };

  return report.competencies.find((competency) =>
    keywords[signalId].some((keyword) => competency.label.toLowerCase().includes(keyword))
  );
}

function signalNextMove(signalId: Signal["id"]) {
  const nextMoves: Record<Signal["id"], string> = {
    clarity:
      "Lead with the point, then support it with one concrete detail so your interviewer never has to ask what you mean.",
    structure:
      "Use a simple context → decision → result flow to make the path through your answer easy to follow.",
    ownership:
      "Name the part you personally owned, the choice you made, and why that choice mattered.",
    impact:
      "Close each answer with the outcome, a metric, or the learning that changed what happened next."
  };
  return nextMoves[signalId];
}

function positiveSignalDetail(signalId: Signal["id"]) {
  const details: Record<Signal["id"], string> = {
    clarity: "Your main point was easy to follow without extra explanation.",
    structure: "The path from context to decision was clear enough to stay with.",
    ownership: "You made your contribution and decision-making easy to understand.",
    impact: "You connected your work to a clear outcome."
  };
  return details[signalId];
}

function summaryFor(report: InterviewReport, strongest: string, gap: string) {
  return `Your strongest signal was ${strongest}. For the next round, focus on ${gap.toLowerCase()} and make every answer land with a concrete result.`;
}

function mayaSummary(
  report: InterviewReport,
  candidateName: string,
  strongest: string,
  gap: string
) {
  const firstName = candidateName.split(/\s+/)[0] || "there";
  const nextStep = report.summary.nextStep || `focus on ${gap.toLowerCase()}`;

  if (report.summary.evidenceScore >= 75) {
    return `Well done, ${firstName}. Your ${strongest.toLowerCase()} really came through. Keep that same clarity in your next round.`;
  }

  if (report.summary.evidenceScore >= 45) {
    return `Nice work, ${firstName}. Your ${strongest.toLowerCase()} is starting to show. Next time, ${lowercaseFirst(nextStep)}`;
  }

  return `Next time, ${firstName}, start with ${gap.toLowerCase()}. ${uppercaseFirst(nextStep)} You are building the right foundation.`;
}

function strongestMessage(report: InterviewReport) {
  const competency = report.competencies.find((item) => item.label === report.summary.strongest);
  return competency?.signals[0] ?? "You gave evidence that made your contribution easy to follow.";
}

function pressureMessage(report: InterviewReport) {
  const clarifications = report.interaction.clarifications;
  if (clarifications > 0)
    return `A few answers needed a little more context. Leading with your main point will make them easier to follow.`;
  return "Your interviewer could follow your answers without needing extra clarification.";
}

function buildPdfBriefing(
  report: InterviewReport,
  overview: ReportsOverview,
  candidate: Candidate
): ReportPdfBriefing {
  const gap = report.summary.recommendedFocus ?? "Answer endings";
  const strongest = report.summary.strongest ?? "Your interview signal";
  return {
    verdict:
      report.summary.evidenceScore >= 75
        ? "Your interview signal is getting strong."
        : "Your interview signal is developing.",
    trend:
      overview.scoreDelta && overview.scoreDelta > 0
        ? `Your score is up ${overview.scoreDelta} points from your first round.`
        : "Keep building on the evidence from this round.",
    summaryText: summaryFor(report, strongest, gap),
    strongestLabel: strongest,
    strongestText: strongestMessage(report),
    gapLabel: gap,
    gapText: report.summary.nextStep,
    pressureText: pressureMessage(report),
    nextAction: report.summary.nextStep,
    latestText: `${roundShortLabel(report.setup.roundType)} · ${report.summary.evidenceScore}/100 · ${formatShortDate(report.startedAt)}`,
    history: overview.rounds
      .slice(0, 4)
      .map(
        (round) =>
          `${roundShortLabel(round.roundType)} · ${round.evidenceScore ?? 0}/100 · ${formatShortDate(round.startedAt)}`
      ),
    readinessScore: overview.readinessScore,
    competencyBars: overview.competencies
      .slice(0, 4)
      .map((item) => ({ label: item.label, score: item.averageScore, level: item.level })),
    candidateName: candidate.name,
    candidateDiscipline: candidate.discipline
  };
}

async function downloadReport(briefing: ReportPdfBriefing) {
  const pdf = await createThemedReportPdf(briefing);
  const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "trailgrad-interview-report.pdf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function DownloadInterviewReportButton({ briefing }: { briefing: ReportPdfBriefing }) {
  const [isPreparing, setIsPreparing] = useState(false);

  const handleDownload = async () => {
    setIsPreparing(true);
    try {
      await downloadReport(briefing);
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isPreparing}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.11] px-3.5 text-sm font-semibold text-cream/74 transition hover:bg-white/[0.06] hover:text-cream disabled:cursor-wait disabled:opacity-65"
    >
      <Download size={16} strokeWidth={1.9} aria-hidden="true" />
      {isPreparing ? "Preparing…" : "Download report"}
    </button>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function lowercaseFirst(value: string) {
  return value.slice(0, 1).toLowerCase() + value.slice(1);
}

function uppercaseFirst(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function signalStatus(score: number) {
  if (score >= 75) return "Looking strong";
  if (score >= 45) return "Coming along";
  return "One to build";
}
