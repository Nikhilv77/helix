import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  Circle,
  Clock3,
  Code2,
  MessageSquareQuote,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";
import {
  formatClock,
  formatDate,
  formatDuration,
  levelLabel,
  roleLabel,
  roundLabel
} from "@/lib/labels";
import type { InterviewReport as InterviewReportData } from "@/lib/types";

export function InterviewReport({ report }: { report: InterviewReportData }) {
  const completedCompetencies = report.competencies.filter((item) => item.answered).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 lg:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-cream/50 transition hover:text-cream"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to workspace
      </Link>

      <header className="mt-8 flex flex-col gap-6 border-b border-cream/12 pb-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="blueprint-label text-cream/40">Interview report</p>
            <span className="rounded-full border border-[#71d6a5]/30 bg-[#71d6a5]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9be8c1]">
              {report.status === "completed"
                ? "Completed"
                : report.status === "expired"
                  ? "Ended"
                  : "In progress"}
            </span>
          </div>
          <h1
            className="display-heading mt-4 text-cream"
            style={{ fontSize: "clamp(2.1rem, 5vw, 3.7rem)" }}
          >
            {roleLabel(report.setup.role)} · {roundLabel(report.setup.roundType)}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cream/55">{report.setup.context}</p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/50">
          <span className="rounded-full border border-cream/15 px-3 py-2">
            {levelLabel(report.setup.level)}
          </span>
          <span className="rounded-full border border-cream/15 px-3 py-2">
            {report.setup.intensity}
          </span>
          <span className="rounded-full border border-cream/15 px-3 py-2">
            {formatDate(report.startedAt)}
          </span>
        </div>
      </header>

      <section
        aria-label="Report summary"
        className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-cream/14 bg-cream/14 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          label="Evidence strength"
          value={`${report.summary.evidenceScore}`}
          icon={TrendingUp}
        />
        <Metric label="Time in room" value={formatDuration(report.durationMs)} icon={Clock3} />
        <Metric
          label="Questions covered"
          value={`${report.questionsCovered}/${report.questionCount}`}
          icon={MessageSquareQuote}
        />
        <Metric
          label="Competencies evidenced"
          value={`${completedCompetencies}/${report.competencies.length}`}
          icon={ShieldCheck}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <section className="rounded-2xl border border-cream/14 bg-white/[0.035] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cream/18 text-cream">
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <div>
              <p className="blueprint-label text-cream/35">Coverage map</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-cream">
                What the round explored
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {report.competencies.map((item, index) => (
              <article
                key={`${item.label}-${index}`}
                className="grid gap-3 rounded-xl border border-cream/12 bg-blueprint-deep/55 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border",
                    item.answered
                      ? "border-[#71d6a5]/35 bg-[#71d6a5]/10 text-[#9be8c1]"
                      : "border-cream/15 text-cream/30"
                  ].join(" ")}
                >
                  {item.answered ? <Check size={13} /> : <Circle size={9} />}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-cream">{item.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-cream/45">{item.question}</p>
                  {item.evidenceAnchor ? (
                    <p className="mt-3 text-xs leading-5 text-cream/42">
                      <span className="font-semibold text-cream/65">Resume signal:</span>{" "}
                      {item.evidenceAnchor}
                    </p>
                  ) : null}
                  {item.signals.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-[#71d6a5]/22 bg-[#71d6a5]/[0.07] px-2 py-1 text-[10px] text-[#a7e8c7]"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.evidenceBreakdown ? (
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      <EvidenceBar label="Ownership" value={item.evidenceBreakdown.ownership} />
                      <EvidenceBar label="Decision" value={item.evidenceBreakdown.decision} />
                      <EvidenceBar label="Specificity" value={item.evidenceBreakdown.specificity} />
                      <EvidenceBar label="Outcome" value={item.evidenceBreakdown.outcome} />
                    </div>
                  ) : null}
                  {item.answerPreview ? (
                    <p className="mt-3 border-l border-cream/18 pl-3 text-xs leading-5 text-cream/36">
                      {item.answerPreview}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-cream/48">
                    <span className="font-semibold text-cream/72">Next:</span> {item.nextStep}
                  </p>
                </div>
                <div className="flex items-start gap-2 sm:flex-col sm:items-end">
                  <span className="font-mono text-lg text-cream">{item.evidenceScore}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-cream/32">
                    {item.evidenceLevel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-cream/18 bg-cream/[0.07] p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cream/20 text-cream">
              <Target size={17} aria-hidden="true" />
            </span>
            <p className="blueprint-label mt-5 text-cream/35">Next practice</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-cream">
              {report.summary.recommendedFocus ?? "Complete this round"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-cream/48">{report.summary.nextStep}</p>
            <Link
              href={retryHref(report)}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cream bg-cream text-sm font-semibold text-blueprint"
            >
              Practice this gap
              <ArrowRight size={15} />
            </Link>
          </section>

          <section className="rounded-2xl border border-cream/14 bg-white/[0.035] p-5">
            <p className="blueprint-label text-cream/35">Interviewer behavior</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Behavior label="Probes" value={report.interaction.probes} />
              <Behavior label="Challenges" value={report.interaction.challenges} />
              <Behavior label="Clarifications" value={report.interaction.clarifications} />
              <Behavior label="Interruptions" value={report.interaction.interruptions} />
            </div>
          </section>

          {report.codeExercise ? (
            <section className="rounded-2xl border border-cream/14 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cream/18 text-cream">
                  <Code2 size={17} aria-hidden="true" />
                </span>
                <span className="rounded-full border border-cream/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cream/45">
                  {report.codeExercise.language}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-cream">Coding exercise</h2>
              <p className="mt-2 text-sm leading-6 text-cream/48">{report.codeExercise.task}</p>
              <p className="mt-4 flex items-center gap-2 text-xs text-cream/45">
                {report.codeExercise.submitted ? <Check size={13} /> : <Circle size={9} />}
                {report.codeExercise.submitted ? "Answer submitted" : "No answer submitted"}
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <details className="group mt-6 rounded-2xl border border-cream/14 bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-5 text-cream sm:p-6">
          <Braces size={17} aria-hidden="true" />
          <span className="font-semibold">Full transcript</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-cream/35">
            {report.transcript.length} turns
          </span>
        </summary>
        <div className="space-y-3 border-t border-cream/12 p-5 sm:p-6">
          {report.transcript.map((turn, index) => (
            <article
              key={`${turn.speaker}-${turn.startMs}-${index}`}
              className={`max-w-[50rem] rounded-xl border p-4 ${
                turn.speaker === "user"
                  ? "ml-auto border-cream/18 bg-cream/[0.07]"
                  : "border-cream/10 bg-blueprint-deep/60"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="blueprint-label text-cream/35">
                  {turn.speaker === "user" ? "You" : "Maya"}
                </p>
                <time className="font-mono text-[10px] text-cream/25">
                  {formatClock(turn.startMs)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cream/68">
                {turn.text}
              </p>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
}) {
  return (
    <div className="bg-blueprint-deep/85 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="blueprint-label text-cream/35">{label}</p>
        <Icon size={15} className="text-cream/35" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-cream">{value}</p>
    </div>
  );
}

function Behavior({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-cream/12 bg-blueprint-deep/50 p-3.5">
      <p className="text-2xl font-semibold text-cream">{value}</p>
      <p className="mt-1 text-xs text-cream/38">{label}</p>
    </div>
  );
}

function EvidenceBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-cream/35">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-cream/10">
        <div
          className="h-full rounded-full bg-[#71d6a5]/75"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function retryHref(report: InterviewReportData): string {
  const params = new URLSearchParams({
    role: report.setup.role,
    level: report.setup.level
  });
  if (report.summary.recommendedFocus) params.set("focus", report.summary.recommendedFocus);
  return `/interview?${params.toString()}`;
}
