"use client";

import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  ListChecks,
  MessageSquareText,
  UserRoundCheck,
  Volume2,
  VolumeX
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReportPdfBriefing } from "@/features/reports/application/report-pdf";
import type { ReportFamilySummary, ReportsOverview } from "@/features/reports/contracts/reports";
import { formatShortDate, roundShortLabel } from "@/lib/shared/labels";
import type { InterviewReport } from "@/lib/shared/types";
import { evaluationProfileForSetup } from "@/features/interviews/domain/evaluation-profile";
import {
  parameterScoresForReport,
  roundParameterScore
} from "@/features/reports/application/reports-overview";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { ReportEmptyStage } from "./report-briefing-stage";
import { ReportMayaAvatar } from "./report-maya-avatar";

type Candidate = {
  name: string;
  discipline: string;
};

type Signal = {
  id: string;
  label: string;
  score: number;
  icon: LucideIcon;
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

  return <InterviewReportContent report={report} overview={overview} candidate={candidate} />;
}

function InterviewReportContent({
  report,
  overview,
  candidate
}: {
  report: InterviewReport;
  overview: ReportsOverview;
  candidate: Candidate;
}) {
  const teacher = useWorkspaceTeacher();

  const signals = buildSignals(report);
  const feedback = groupSignals(signals);
  const evaluationProfile = evaluationProfileForSetup(report.setup);
  const rankedSignals = [...signals].sort((left, right) => right.score - left.score);
  const strongestSignal = rankedSignals[0];
  const gapSignal = rankedSignals.at(-1);
  const strongest = strongestSignal?.label ?? "Your interview signal";
  const gap = gapSignal?.label ?? "Answer endings";
  const briefing = buildPdfBriefing(report, overview, candidate);
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
          <div className="report-maya-speech-card report-glass-card relative rounded-2xl px-5 py-4 text-left sm:px-6">
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
            <Meta
              icon={ArrowUpRight}
              label="Difficulty"
              value={capitalize(report.setup.intensity)}
            />
          </div>
        </div>
      </header>

      <FamilyPerformance families={overview.families} latestFamily={evaluationProfile.family} />

      <article
        className="report-latest-strip mx-auto w-full max-w-4xl"
        style={{ "--report-delay": "420ms" } as CSSProperties}
      >
        <ReportQuickRead
          report={report}
          profileLabel={evaluationProfile.label}
          strongest={strongest}
          strongestScore={strongestSignal?.score ?? 0}
          gap={gap}
        />
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

      <div className="mt-10 flex justify-center pb-2">
        <DownloadInterviewReportButton briefing={briefing} variant="primary" />
      </div>
    </section>
  );
}

function FamilyPerformance({
  families,
  latestFamily
}: {
  families: ReportFamilySummary[];
  latestFamily: ReportFamilySummary["family"];
}) {
  if (!families.length) return null;

  return (
    <section className="mb-10" aria-labelledby="interview-family-performance">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p
            id="interview-family-performance"
            className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]"
          >
            Overall performance
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {families.map((family) => {
          const isLatest = family.family === latestFamily;
          const displayedScore = family.averageScore;
          return (
            <article
              key={family.family}
              className={`report-glass-card rounded-2xl p-6 ${
                isLatest ? "ring-1 ring-[var(--workspace-accent)]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold leading-5 text-cream">{family.label}</p>
                  <p className="mt-1 text-sm text-cream/42">
                    {family.rounds
                      ? `${family.rounds} ${family.rounds === 1 ? "interview" : "interviews"} aggregated`
                      : "No scored interview yet"}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`${displayedScore === null ? "text-sm" : "text-4xl"} font-semibold tabular-nums text-cream`}
                  >
                    {displayedScore ?? "Not yet"}
                  </span>
                  {displayedScore !== null ? (
                    <span className="ml-1 text-sm text-cream/42">/100</span>
                  ) : null}
                  {isLatest ? (
                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                      Current report family
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {family.parameters.map((parameter) => (
                  <div key={parameter.key}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-cream/58">{parameter.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-cream/76">
                        {parameter.averageScore ?? "Not yet"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <span
                        className="block h-full rounded-full bg-[var(--workspace-accent)]"
                        style={{ width: `${parameter.averageScore ?? 0}%` }}
                        role="img"
                        aria-label={`${parameter.label}: ${parameter.averageScore ?? "not scored"}${
                          parameter.averageScore === null ? "" : " out of 100"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReportQuickRead({
  report,
  profileLabel,
  strongest,
  strongestScore,
  gap
}: {
  report: InterviewReport;
  profileLabel: string;
  strongest: string;
  strongestScore: number;
  gap: string;
}) {
  const overallScore = roundParameterScore(report);

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="report-glass-card rounded-2xl px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">
          {profileLabel} score
        </p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-5xl font-semibold leading-none tracking-tight text-cream">
            {overallScore}
          </span>
          <span className="pb-0.5 text-sm text-cream/58">/100</span>
        </div>
        <p className="mt-2 text-sm font-medium text-cream/72">
          {signalStatus(overallScore)}
        </p>
      </div>

      <div className="report-glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-cream/42">
          {strongestScore >= 70 ? "Strongest signal" : "Highest current signal"}
        </p>
        <p className="mt-3 text-lg font-semibold leading-6 text-cream">{strongest}</p>
        <p className="mt-2 text-sm leading-6 text-cream/58">
          {strongestScore >= 70
            ? "Keep using this as the anchor for your answers."
            : "This was your clearest area, but it still needs stronger evidence."}
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
  if (!signals.length) return null;

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
  const copy =
    mode === "next-step"
      ? signal.nextMove
      : mode === "needs-work"
        ? `${signal.evidence} Next: ${signal.nextMove}`
        : signal.evidence;
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

function Meta({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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
  const icons: LucideIcon[] = [
    ListChecks,
    MessageSquareText,
    CheckCircle2,
    ListChecks,
    UserRoundCheck,
    MessageSquareText
  ];

  return parameterScoresForReport(report).map((parameter, index) => {
    const evaluated = report.competencies
      .filter((competency) => competency.answered)
      .flatMap((competency) =>
        (competency.technicalEvaluation?.rubricScores ?? [])
          .filter((score) => score.rubricKey === parameter.key)
          .map((score) => ({ competency, score }))
      );
    const representative = [...evaluated].sort((left, right) => {
      const leftHasQuote = Boolean(left.score.evidenceQuotes?.length);
      const rightHasQuote = Boolean(right.score.evidenceQuotes?.length);
      if (leftHasQuote !== rightHasQuote) return leftHasQuote ? -1 : 1;
      return (
        Math.abs(left.score.score - parameter.score) -
        Math.abs(right.score.score - parameter.score)
      );
    })[0];
    const quote = representative?.score.evidenceQuotes?.[0];
    const questionIndex = representative?.competency.questionIndex;
    const evidenceTurn =
      typeof questionIndex === "number"
        ? report.transcript.find(
            (turn) =>
              turn.speaker === "user" &&
              !turn.assessmentExcluded &&
              turn.questionIndex === questionIndex &&
              (!quote || normalizedEvidence(turn.text).includes(normalizedEvidence(quote)))
          )
        : undefined;
    const rationale = representative?.score.rationale;
    const evidence = quote
      ? `${evidenceTurn ? `At ${formatEvidenceTime(evidenceTurn.startMs)}, ` : ""}you said “${quote}”.${rationale ? ` ${rationale}` : ""}`
      : rationale;
    const observation =
      parameter.score >= 75
        ? `Your ${parameter.label.toLowerCase()} came through clearly.`
        : parameter.score >= 45
          ? `Your ${parameter.label.toLowerCase()} is taking shape.`
          : `Your ${parameter.label.toLowerCase()} needs a clearer signal.`;

    return {
      id: parameter.key,
      label: parameter.label,
      score: parameter.score,
      icon: icons[index] ?? MessageSquareText,
      observation,
      evidence: evidence ?? parameter.description,
      nextMove: parameter.nextStep
    };
  });
}

function formatEvidenceTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function normalizedEvidence(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function groupSignals(signals: Signal[]) {
  const sorted = [...signals].sort((left, right) => left.score - right.score);
  const needsWork = signals.filter((signal) => signal.score < 70);
  const working = signals.filter((signal) => signal.score >= 70);

  return {
    needsWork,
    working,
    nextSteps: sorted.slice(0, Math.min(2, sorted.length))
  };
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
  const profile = evaluationProfileForSetup(report.setup);
  const overallScore = roundParameterScore(report);

  if (overallScore >= 75) {
    return `James reported back to me, ${firstName}. In your ${profile.label} interview, your ${strongest.toLowerCase()} really came through. You are building a strong signal—keep that same clarity in your next round.`;
  }

  if (overallScore >= 45) {
    return `James reported back to me, ${firstName}. I reviewed your ${profile.label} parameters, and your ${strongest.toLowerCase()} is starting to show. Next time, ${lowercaseFirst(nextStep)} Keep going—you are making real progress.`;
  }

  return `James reported back to me, ${firstName}. This ${profile.label} attempt gives us a useful starting point. Begin with ${gap.toLowerCase()}. ${uppercaseFirst(nextStep)} Do not be discouraged—this is exactly what practice is for.`;
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
  const signals = buildSignals(report);
  const rankedSignals = [...signals].sort((left, right) => right.score - left.score);
  const strongestSignal = rankedSignals[0];
  const gapSignal = rankedSignals.at(-1);
  const strongest = strongestSignal?.label ?? "Your interview signal";
  const gap = gapSignal?.label ?? "Answer endings";
  const roundScore = roundParameterScore(report);
  return {
    overallFamilies: overview.families.map((family) => ({
      label: family.label,
      aggregateScore: family.averageScore,
      rounds: family.rounds
    })),
    roundScore,
    scoreExplanation:
      "This is the saved overall judgement for the latest interview. The six parameters below provide the supporting evidence.",
    verdict:
      roundScore >= 75
        ? "Your interview signal is getting strong."
        : "Your interview signal is developing.",
    trend:
      overview.scoreDelta && overview.scoreDelta > 0
        ? `Your score is up ${overview.scoreDelta} points from your first round.`
        : "Keep building on the evidence from this round.",
    summaryText: summaryFor(report, strongest, gap),
    strongestLabel: strongest,
    strongestText:
      strongestSignal?.evidence ??
      "You gave evidence that made your contribution easier to follow.",
    gapLabel: gap,
    gapText: gapSignal?.nextMove ?? report.summary.nextStep,
    pressureText: pressureMessage(report),
    nextAction: gapSignal?.nextMove ?? report.summary.nextStep,
    latestText: `${roundShortLabel(report.setup.roundType)} · ${roundScore}/100 · ${formatShortDate(report.startedAt)}`,
    history: overview.rounds
      .slice(0, 4)
      .map(
        (round) =>
          `${roundShortLabel(round.roundType)} · ${round.evidenceScore ?? 0}/100 · ${formatShortDate(round.startedAt)}`
      ),
    readinessScore: overview.readinessScore,
    competencyBars: signals.slice(0, 6).map((signal) => ({
      label: signal.label,
      score: signal.score,
      level: signal.score >= 75 ? "strong" : signal.score >= 45 ? "developing" : "missing",
      evidence: signal.evidence,
      nextAction: signal.nextMove
    })),
    candidateName: candidate.name,
    candidateDiscipline: candidate.discipline
  };
}

async function downloadReport(briefing: ReportPdfBriefing) {
  const { createThemedReportPdf } = await import("@/features/reports/application/report-pdf");
  const pdf = await createThemedReportPdf(briefing);
  const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "trailgrad-interview-report.pdf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function DownloadInterviewReportButton({
  briefing,
  variant = "compact"
}: {
  briefing: ReportPdfBriefing;
  variant?: "compact" | "primary";
}) {
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
      className={
        variant === "primary"
          ? "progress-cta-shimmer relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-cream px-6 py-3 text-base font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-wait disabled:opacity-65"
          : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.11] px-3.5 text-sm font-semibold text-cream/74 transition hover:bg-white/[0.06] hover:text-cream disabled:cursor-wait disabled:opacity-65"
      }
    >
      <Download
        size={variant === "primary" ? 17 : 16}
        strokeWidth={1.9}
        aria-hidden="true"
        className={variant === "primary" ? "relative z-10" : undefined}
      />
      <span className={variant === "primary" ? "relative z-10" : undefined}>
        {isPreparing ? "Preparing…" : "Download report"}
      </span>
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
