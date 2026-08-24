"use client";

import Link from "next/link";
import { ArrowRight, Download, Signal, Target, TriangleAlert, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ReportMayaAvatar } from "./report-maya-avatar";
import {
  disciplineLabel,
  formatDuration,
  formatShortDate,
  roundShortLabel
} from "@/lib/shared/labels";
import { createThemedReportPdf, type ReportPdfBriefing } from "@/lib/reports/report-pdf";
import type { ReportsOverview } from "@/lib/reports/reports";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

const openingPhaseTimers = [1900, 3900];

export type ReportCandidate = {
  /** Full name from the parsed resume; blank until one is uploaded. */
  name: string;
  /** Target role written as a discipline, e.g. "Full Stack Engineering". */
  discipline: string;
};

type ReportBriefingCopy = ReportPdfBriefing & {
  voiceLine: string;
  preparedVoiceLine: string;
};

function buildBriefingCopy(
  overview: ReportsOverview,
  candidate: ReportCandidate
): ReportBriefingCopy {
  const score = overview.readinessScore ?? overview.latestScore;
  const verdict =
    score == null
      ? "Your interview signal is forming."
      : score >= 78
        ? "Your interview signal is getting strong."
        : score >= 55
          ? "Your interview signal is developing."
          : "Your interview signal is still early.";

  const delta = overview.scoreDelta;
  const trend =
    delta == null
      ? "The pattern is still forming because Maya needs a little more round history."
      : delta > 4
        ? `You are improving: your signal is up ${delta} points from your first scored round.`
        : delta < -4
          ? `You are slipping a bit: your signal is down ${Math.abs(delta)} points from your first scored round.`
          : "Your signal is steady right now, which means the next few rounds matter.";

  const strongest = overview.best?.strongest ?? overview.competencies[0]?.label ?? "Ownership";
  const strongestText =
    overview.competencies[0]?.nextStep ??
    overview.best?.nextStep ??
    "You sound strongest when you make your role, decision, and impact easy to see.";
  const gap = overview.recurringGaps[0];
  const gapLabel = gap?.label ?? overview.latest?.recommendedFocus ?? "Answer endings";
  const gapText =
    gap?.nextStep ??
    overview.latest?.nextStep ??
    "Close more answers with the result, metric, tradeoff, or learning so the story lands.";
  const perRound = overview.pressure.perRound;
  const pressureText =
    perRound >= 3
      ? `Maya had to probe a lot: about ${perRound.toFixed(1)} follow-ups per scored round.`
      : perRound >= 1
        ? `Maya had to probe a little: about ${perRound.toFixed(1)} follow-ups per scored round.`
        : "Maya did not need many follow-ups yet, so the next report will be clearer after more rounds.";
  const latestText = overview.latest
    ? `${roundShortLabel(overview.latest.roundType)} round, ${overview.latest.evidenceScore ?? score ?? 0}/100, ${formatDuration(overview.latest.durationMs)}, ${formatShortDate(overview.latest.startedAt)}.`
    : null;
  const history = overview.rounds.slice(0, 4).map((round, index) => {
    const roundScore = round.evidenceScore == null ? "not scored" : `${round.evidenceScore}/100`;
    return `${index + 1}. ${roundShortLabel(round.roundType)} · ${roundScore} · ${formatShortDate(round.startedAt)}`;
  });
  const nextAction =
    gap?.nextStep ??
    overview.latest?.nextStep ??
    "Run one focused round and make every answer end with a concrete outcome.";
  const summaryText = `Maya would put it simply: ${trend} Your strongest signal is ${strongest}. The repeat gap is ${gapLabel}.`;
  const competencyBars = overview.competencies
    .filter((item) => item.answered > 0)
    .slice()
    .sort((left, right) => right.averageScore - left.averageScore)
    .slice(0, 4)
    .map((item) => ({
      label: item.label,
      score: Math.round(item.averageScore),
      level: item.level
    }));

  return {
    verdict,
    trend,
    summaryText,
    strongestLabel: strongest,
    strongestText,
    gapLabel,
    gapText,
    pressureText,
    nextAction,
    latestText,
    history,
    readinessScore: score,
    competencyBars,
    candidateName: candidate.name,
    candidateDiscipline:
      candidate.discipline || (overview.latest ? disciplineLabel(overview.latest.role) : ""),
    voiceLine: `Great job. So far, so good. ${verdict} Your strongest signal is ${strongest}. Your repeat gap is ${gapLabel}. Next, ${nextAction}`,
    preparedVoiceLine: `Check this out. I created a report for you that will help you understand what is working, what needs attention, and what to practice next. Read it carefully, then work on the weakness that keeps showing up.`
  };
}

function useWordReveal(text: string, active: boolean, delay = 0, stagger = 62) {
  const words = useMemo(() => text.split(" "), [text]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;

    let interval = 0;
    const timer = window.setTimeout(() => {
      let index = 0;
      interval = window.setInterval(() => {
        index += 1;
        setVisibleCount(Math.min(index, words.length));
        if (index >= words.length) window.clearInterval(interval);
      }, stagger);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [active, delay, stagger, words.length]);

  return { words, visibleCount };
}

function WordReveal({
  text,
  active,
  delay = 0,
  stagger,
  className = "",
  wordClassName = ""
}: {
  text: string;
  active: boolean;
  delay?: number;
  stagger?: number;
  className?: string;
  wordClassName?: string;
}) {
  const { words, visibleCount } = useWordReveal(text, active, delay, stagger);

  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={[
            "trail-word mr-[0.24em] last:mr-0",
            index < visibleCount ? "trail-word-visible" : "",
            wordClassName
          ].join(" ")}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function ReportBriefingStage({
  overview,
  candidate
}: {
  overview: ReportsOverview;
  candidate: ReportCandidate;
}) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [spokenPhase, setSpokenPhase] = useState<2 | 3 | null>(null);
  const [reportVoiceStarted, setReportVoiceStarted] = useState(false);
  const [reportVoiceFinished, setReportVoiceFinished] = useState(false);
  const unlockInFlight = useRef(false);
  const { state, speak, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";
  const briefing = useMemo(() => buildBriefingCopy(overview, candidate), [candidate, overview]);

  const startSpokenPhase = useCallback(
    (targetPhase: 2 | 3) => {
      if (spokenPhase === targetPhase) return;
      void speak(targetPhase === 2 ? briefing.voiceLine : briefing.preparedVoiceLine).then(
        (result) => {
          if (result === "started") {
            setSpokenPhase(targetPhase);
            if (targetPhase === 2) {
              setReportVoiceStarted(true);
              setReportVoiceFinished(false);
            }
            return;
          }
          if (result === "unavailable" && targetPhase === 2) {
            setSpokenPhase(targetPhase);
            setReportVoiceFinished(true);
            return;
          }
          if (result === "blocked" && targetPhase === 2) {
            setReportVoiceFinished(true);
          }
        }
      );
    },
    [briefing.preparedVoiceLine, briefing.voiceLine, speak, spokenPhase]
  );

  useEffect(() => {
    const first = window.setTimeout(() => setPhase(1), openingPhaseTimers[0]);
    const second = window.setTimeout(() => setPhase(2), openingPhaseTimers[1]);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  useEffect(() => {
    if ((phase !== 2 && phase !== 3) || awaitingGesture || spokenPhase === phase) return;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        if (!cancelled) startSpokenPhase(phase);
      },
      phase === 2 ? 360 : 280
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [awaitingGesture, phase, spokenPhase, startSpokenPhase]);

  useEffect(() => {
    if (phase !== 2 || !reportVoiceStarted || state !== "idle") return;
    setReportVoiceFinished(true);
  }, [phase, reportVoiceStarted, state]);

  useEffect(() => {
    if (!reportVoiceFinished || phase !== 2) return;
    const timer = window.setTimeout(() => setPhase(3), 520);
    return () => window.clearTimeout(timer);
  }, [phase, reportVoiceFinished]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => {
      if (unlockInFlight.current) return;
      unlockInFlight.current = true;
      setAwaitingGesture(false);
      if ((phase === 2 || phase === 3) && spokenPhase !== phase) {
        startSpokenPhase(phase);
      }
      window.setTimeout(() => {
        unlockInFlight.current = false;
      }, 250);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, phase, setAwaitingGesture, spokenPhase, startSpokenPhase]);

  return (
    <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-3 text-center sm:gap-5 lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1fr)] lg:gap-8 lg:text-left">
      <div className="mx-auto w-full max-w-[34rem] lg:mx-0">
        <ReportMayaAvatar delay={120} speaking={speaking} />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center lg:mx-0">
        {phase < 3 ? (
          <div className="min-h-[5.5rem] w-full">
            {phase === 0 ? (
              <section key="reviewing" className="identity-stage-in w-full">
                <p className="blueprint-label text-cream/36">Reports with Maya</p>
                <div className="mt-4 flex h-9 items-center justify-start gap-1.5">
                  <InlineWaveLoader />
                </div>
                <p className="thinking-shimmer blueprint-label mt-3 text-left text-cream/45">
                  Reviewing your recent rounds...
                </p>
              </section>
            ) : null}

            {phase === 1 ? (
              <section key="signal" className="identity-stage-in w-full">
                <p className="thinking-shimmer blueprint-label text-cream/45">
                  Finding your strongest signal...
                </p>
                <div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-3 text-center lg:mx-0">
                  {["Ownership", "Evidence", "Ending"].map((item, index) => (
                    <span
                      key={item}
                      className="onboarding-card-reveal rounded-full border border-cream/20 bg-cream/[0.035] px-3 py-2 text-sm font-medium text-cream/70"
                      style={
                        {
                          "--card-delay": `${120 + index * 120}ms`,
                          "--card-tilt": "0deg"
                        } as CSSProperties
                      }
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {phase === 2 ? (
              <section key="ready" className="identity-stage-in w-full">
                <div className="mx-auto mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-cream/16 lg:mx-0">
                  <span className="identity-progress-line block h-full rounded-full bg-cream/78" />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {phase === 2 ? (
          <section key="report-readout" className="identity-stage-in mt-5 w-full">
            {awaitingGesture ? <VoiceUnlockNudge /> : null}
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-cream/64 sm:text-lg sm:leading-8 lg:mx-0">
              <WordReveal
                text={briefing.summaryText}
                active
                delay={220}
                stagger={68}
                wordClassName="report-copy-word"
              />
            </p>

            <div
              className="report-action-panel mx-auto mt-7 max-w-3xl text-left lg:mx-0"
              style={{ "--report-delay": "1200ms" } as CSSProperties}
            >
              <p className="text-[1.6rem] font-semibold leading-tight text-cream sm:text-[2rem]">
                {briefing.verdict}
              </p>
              <p className="mt-3 text-base leading-7 text-cream/56">{briefing.trend}</p>
            </div>

            <div className="mx-auto mt-8 max-w-3xl text-left lg:mx-0">
              <div className="relative space-y-5 pl-8 before:absolute before:left-[0.44rem] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-cream/18">
                <ReportFinding
                  icon={Signal}
                  label="Strongest signal"
                  text={`${briefing.strongestLabel}: ${briefing.strongestText}`}
                  delay={1700}
                />
                <ReportFinding
                  icon={TriangleAlert}
                  label="Repeat gap"
                  text={`${briefing.gapLabel}: ${briefing.gapText}`}
                  delay={1950}
                />
                <ReportFinding
                  icon={Target}
                  label="Pressure"
                  text={briefing.pressureText}
                  delay={2200}
                />
              </div>
            </div>

            {briefing.latestText || briefing.history.length ? (
              <div
                className="report-action-panel mx-auto mt-7 max-w-3xl text-left lg:mx-0"
                style={{ "--report-delay": "2480ms" } as CSSProperties}
              >
                {briefing.latestText ? (
                  <p className="rounded-full border border-cream/20 bg-cream/[0.035] px-4 py-2 text-sm font-medium text-cream/62">
                    Latest: {briefing.latestText}
                  </p>
                ) : null}
                {briefing.history.length ? (
                  <div className="mt-4 grid gap-2 text-sm text-cream/46 sm:grid-cols-2">
                    {briefing.history.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {phase === 3 ? (
          <section key="report-download" className="identity-stage-in mt-1 w-full sm:mt-3 lg:mt-5">
            {awaitingGesture ? <VoiceUnlockNudge /> : null}
            <p className="mx-auto max-w-3xl text-[clamp(1.85rem,3.8vw,3.45rem)] font-semibold leading-[1.05] tracking-tight text-cream lg:mx-0">
              <WordReveal
                text="Maya has prepared a report for you."
                active
                delay={140}
                stagger={120}
              />
            </p>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-cream/64 sm:text-lg sm:leading-8 lg:mx-0">
              <WordReveal
                text="Read it slowly, keep the strong signal, and use the weakness section as your next practice target. This is meant to help you understand what is working, what needs attention, and where your next round should get sharper."
                active
                delay={820}
                stagger={62}
                wordClassName="report-copy-word"
              />
            </p>

            <div
              className="report-action-panel mx-auto mt-8 flex max-w-xl flex-col items-center gap-3 text-center lg:mx-0 lg:items-start lg:text-left"
              style={{ "--report-delay": "2600ms" } as CSSProperties}
            >
              <DownloadReportButton briefing={briefing} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function ReportEmptyStage({
  firstName,
  exhausted
}: {
  firstName: string;
  exhausted: boolean;
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-[calc(100svh-11rem)] w-full max-w-3xl flex-col items-center justify-center py-8 text-center">
      <div className="relative mx-auto w-full max-w-[26rem]">
        <span
          aria-hidden
          className="report-maya-glow-a pointer-events-none absolute left-1/2 top-[46%] z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[72px]"
        />
        <span
          aria-hidden
          className="report-maya-glow-b pointer-events-none absolute bottom-4 left-1/2 z-0 h-28 w-60 -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-30 blur-[64px]"
        />
        <div className="relative z-10">
          <ReportMayaAvatar delay={120} size="compact" transparent />
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-8 flex w-full max-w-2xl flex-col items-center sm:-mt-10">
        <section className="identity-stage-in w-full">
          <div className="report-glass-card relative mx-auto max-w-xl rounded-2xl px-5 py-4 text-left sm:px-6">
            <span
              aria-hidden
              className="report-glass-tail absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45"
            />
            <p className="relative text-base font-medium leading-7 text-cream sm:text-lg sm:leading-8">
              <WordReveal
                text={
                  firstName
                    ? `Maya is ready when you are, ${firstName}.`
                    : "Maya is ready when you are."
                }
                active
                delay={120}
                stagger={58}
              />
            </p>
            <p className="relative mt-3 text-sm leading-6 text-cream/60 sm:text-base sm:leading-7">
              <WordReveal
                text="One conversation gives you a clear read on what sounds strong, what needs evidence, and where to practise next."
                active
                delay={520}
                stagger={36}
                wordClassName="report-copy-word"
              />
            </p>
          </div>

          <div
            className="report-action-panel mx-auto mt-6"
            style={{ "--report-delay": "2100ms" } as CSSProperties}
          >
            <Link
              href="/interview?resume=1"
              aria-disabled={exhausted}
              className={[
                "report-primary-action inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream px-6 text-[0.95rem] font-semibold text-[#18130d] transition hover:-translate-y-0.5 hover:bg-white",
                exhausted ? "pointer-events-none opacity-45" : ""
              ].join(" ")}
            >
              {exhausted ? "Daily limit reached" : "Start your first interview"}
              <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function VoiceUnlockNudge() {
  return (
    <button
      type="button"
      className="report-action-panel mb-5 inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/[0.055] px-4 py-2 text-sm font-medium text-cream/72 transition hover:border-cream/30 hover:bg-cream/[0.08] hover:text-cream"
      aria-label="Tap to hear Maya"
    >
      <Volume2 size={15} strokeWidth={1.8} aria-hidden="true" />
      Tap to hear Maya
    </button>
  );
}

function DownloadReportButton({ briefing }: { briefing: ReportBriefingCopy }) {
  const [isPreparing, setIsPreparing] = useState(false);

  const handleDownload = async () => {
    setIsPreparing(true);
    try {
      await downloadReportPdf(briefing);
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isPreparing}
      className="report-primary-action inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-cream px-5 text-[0.95rem] font-semibold text-[#18130d] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-70"
    >
      {isPreparing ? "Preparing report…" : "Download report"}
      <Download size={16} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}

function InlineWaveLoader() {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1.5" aria-hidden="true">
      {[34, 58, 82, 48, 92, 56, 78].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="wave-bar w-1 rounded-full bg-cream/70"
          style={{ height: `${height}%`, animationDelay: `${index * 68}ms` }}
        />
      ))}
    </div>
  );
}

async function downloadReportPdf(briefing: ReportBriefingCopy) {
  const pdf = await createThemedReportPdf(briefing);
  const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "trailgrad-report.pdf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function ReportFinding({
  icon: Icon,
  label,
  text,
  delay
}: {
  icon: typeof Signal;
  label: string;
  text: string;
  delay: number;
}) {
  return (
    <div
      className="report-action-panel relative"
      style={{ "--report-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="absolute -left-8 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#151619] ring-4 ring-[#151619]">
        <Icon size={16} strokeWidth={1.75} className="text-cream/78" aria-hidden="true" />
      </span>
      <p className="blueprint-label text-cream/35">{label}</p>
      <p className="mt-2 text-[1.08rem] font-medium leading-7 text-cream/88 sm:text-[1.18rem]">
        {text}
      </p>
    </div>
  );
}
