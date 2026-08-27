import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock,
  ExternalLink,
  Radar,
  Sparkles
} from "lucide-react";
import { DsaQuestionActions } from "@/components/workspace/dsa/dsa-question-actions";
import { DsaQuestionWorkspace } from "@/components/workspace/dsa/dsa-question-workspace";
import { QuestionCoach } from "@/components/workspace/dsa/question-coach";
import type { DsaApproach, DsaExample, DsaQuestion } from "@/lib/dsa/dsa";
import { findQuestion } from "@/lib/dsa/dsa";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = findQuestion(slug);
  if (!found) return privatePageMetadata("Question not found", "Unknown DSA question.");
  return privatePageMetadata(found.question.title, found.question.promptSummary);
}

export default async function DsaQuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = findQuestion(slug);
  if (!found) notFound();

  const { question, phase, phaseSlug, previous, next, relatedQuestions } = found;
  const approachNames = (question.approaches ?? []).map((approach) => approach.name);
  const { userId } = await auth();
  const progress = userId
    ? await getAppContainer()
        .frontendRoadmapService.questionState(authenticatedOwnerId(userId), slug)
        .catch(() => null)
    : null;

  return (
    <main className="relative isolate overflow-hidden pb-20">
      <div className="practice-accent-glow pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[34rem] w-[58rem] -translate-x-1/2 opacity-45" />

      <div className="mx-auto w-full max-w-[94rem] px-4 sm:px-6 lg:px-8">
        <nav className="practice-reveal flex items-center justify-between gap-4 py-7">
          <Link
            href={`/practice#${phaseSlug}`}
            className="group inline-flex items-center gap-2 text-[14px] font-medium text-cream/54 transition hover:text-cream"
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            />
            Back to {phase}
          </Link>
          <p className="hidden text-[12px] font-semibold uppercase tracking-[0.16em] text-cream/35 sm:block">
            Practice workspace
          </p>
        </nav>

        <section className="practice-glass practice-reveal relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="practice-accent-glow absolute -right-40 -top-48 h-[28rem] w-[34rem] opacity-40" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-cream/55">
                <span className="capitalize">{question.difficulty}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} aria-hidden="true" />
                  {question.expectedTimeMinutes} min
                </span>
                <span className="capitalize">{question.primaryPattern.replace(/-/g, " ")}</span>
              </div>

              <h1 className="mt-5 max-w-5xl font-display text-[clamp(2.35rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-cream">
                {question.title}
              </h1>
              <p className="mt-5 max-w-3xl text-[16px] leading-7 text-cream/64 sm:text-[17px] sm:leading-8">
                {question.promptSummary}
              </p>
            </div>

            <a
              href={question.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-cream/[0.055] px-4 py-2.5 text-[13px] font-semibold text-cream/62 transition hover:bg-cream/[0.1] hover:text-cream"
            >
              Open on {question.source}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>

          <div className="relative z-10 mt-8">
            <DsaQuestionActions
              key={question.slug}
              slug={question.slug}
              nextHref={next ? `/dsa-questions/${next.slug}` : null}
              initialStatus={progress?.status ?? null}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(38rem,0.98fr)] xl:items-start">
          <div className="min-w-0 space-y-6">
            <section
              className="practice-glass practice-reveal overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
              style={{ "--practice-delay": "80ms" } as CSSProperties}
            >
              <SectionHeading eyebrow="Question" title="Understand the problem" />
              <div className="mt-6 space-y-4">
                {question.problemStatement ? (
                  <ProblemPanel label="Problem statement">
                    <p className="text-[15px] leading-7 text-cream/72 sm:text-[16px] sm:leading-8">
                      {question.problemStatement}
                    </p>
                  </ProblemPanel>
                ) : null}

                {question.examples?.length ? (
                  <ProblemPanel label="Examples">
                    <Examples examples={question.examples} />
                  </ProblemPanel>
                ) : null}

                {question.constraints?.length ? (
                  <ProblemPanel label="Constraints">
                    <Bullets items={question.constraints} mono />
                  </ProblemPanel>
                ) : null}

                {question.edgeCases?.length ? (
                  <ProblemPanel label="Edge cases">
                    <Bullets items={question.edgeCases} />
                  </ProblemPanel>
                ) : null}
              </div>
            </section>

            <div
              className="practice-reveal"
              style={{ "--practice-delay": "140ms" } as CSSProperties}
            >
              <QuestionCoach
                key={question.slug}
                slug={question.slug}
                title={question.title}
                pattern={question.primaryPattern}
                promptSummary={question.promptSummary}
                concepts={question.conceptsTested}
                hints={question.hints ?? []}
                keyInsight={question.keyInsight ?? null}
                approachNames={approachNames}
              />
            </div>
          </div>

          <div
            className="practice-reveal min-w-0 xl:sticky xl:top-4"
            style={{ "--practice-delay": "110ms" } as CSSProperties}
          >
            <DsaQuestionWorkspace question={question} />
          </div>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Review"
            title="Open these after your first attempt"
            description="The explanation stays tucked away until you need it, so the page still feels like practice."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {question.approaches?.length ? (
              <Reveal label="Approaches" hint={`${question.approaches.length} possible routes`}>
                <Approaches approaches={question.approaches} />
              </Reveal>
            ) : null}

            <Reveal label="High-level approach" hint="The intended path">
              <p className="text-[15px] leading-7 text-cream/72">{question.highLevelApproach}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Metric label="Time" value={question.complexity.time} />
                <Metric label="Space" value={question.complexity.space} />
              </div>
            </Reveal>

            {question.commonMistakes.length ? (
              <Reveal label="Common mistakes" hint="What usually goes wrong" tone="warn">
                <Bullets items={question.commonMistakes} />
              </Reveal>
            ) : null}

            {question.interviewSignals.length ? (
              <Reveal
                label="Interview signals"
                hint="What a strong answer demonstrates"
                tone="good"
              >
                <Bullets items={question.interviewSignals} />
              </Reveal>
            ) : null}

            {question.followUpPrompts.length ? (
              <Reveal label="Follow-up questions" hint="What could come next">
                <Bullets items={question.followUpPrompts} />
              </Reveal>
            ) : null}

            {question.conceptsTested.length ? (
              <Reveal label="Concepts tested" hint="The skills underneath the prompt">
                <div className="flex flex-wrap gap-2">
                  {question.conceptsTested.map((concept) => (
                    <span
                      key={concept}
                      className="rounded-full bg-cream/[0.055] px-3 py-1.5 text-[13px] font-medium text-cream/62"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </Reveal>
            ) : null}
          </div>
        </section>

        {relatedQuestions.length ? (
          <section className="mt-14">
            <SectionHeading eyebrow="Keep going" title="Practice this pattern next" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {relatedQuestions.map((related) => (
                <Link
                  key={related.slug}
                  href={`/dsa-questions/${related.slug}`}
                  className="practice-glass group flex min-h-44 flex-col rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--workspace-accent-border)]"
                >
                  <div className="flex items-center justify-between text-[12px] font-semibold capitalize text-cream/42">
                    <span>{related.difficulty}</span>
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </div>
                  <h3 className="mt-auto pt-8 text-[18px] font-semibold leading-6 text-cream">
                    {related.title}
                  </h3>
                  <p className="mt-2 text-[13px] capitalize text-cream/48">
                    {related.primaryPattern.replace(/-/g, " ")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <nav className="mt-12 grid gap-4 sm:grid-cols-2">
          <NeighbourLink question={previous} direction="previous" />
          <NeighbourLink question={next} direction="next" />
        </nav>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-cream/38">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-[1.65rem] font-semibold tracking-tight text-cream sm:text-[2rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-cream/50">{description}</p>
      ) : null}
    </div>
  );
}

function ProblemPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="practice-glass-soft rounded-[1.35rem] p-4 sm:p-5">
      <h3 className="mb-3 text-[13px] font-semibold text-cream/78">{label}</h3>
      {children}
    </section>
  );
}

function Reveal({
  label,
  hint,
  tone = "neutral",
  children
}: {
  label: string;
  hint: string;
  tone?: "neutral" | "warn" | "good";
  children: ReactNode;
}) {
  const icon =
    tone === "warn" ? (
      <AlertTriangle size={17} aria-hidden="true" />
    ) : tone === "good" ? (
      <Radar size={17} aria-hidden="true" />
    ) : (
      <Sparkles size={17} aria-hidden="true" />
    );

  return (
    <details className="practice-glass group overflow-hidden rounded-[1.45rem]">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 transition hover:bg-cream/[0.025] [&::-webkit-details-marker]:hidden">
        <span style={{ color: "var(--workspace-accent)" }}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-cream">{label}</span>
          <span className="mt-1 block text-[13px] text-cream/44">{hint}</span>
        </span>
        <span className="text-[13px] font-semibold text-cream/42 group-open:hidden">Open</span>
        <ArrowRight
          size={15}
          aria-hidden="true"
          className="rotate-90 text-cream/40 transition-transform group-open:-rotate-90"
        />
      </summary>
      <div className="border-t border-cream/[0.055] px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="practice-glass-soft inline-flex items-baseline gap-2 rounded-xl px-3 py-2">
      <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-cream/40">
        {label}
      </span>
      <span className="font-mono text-[13px] text-cream/78">{value}</span>
    </span>
  );
}

function Bullets({ items, mono = false }: { items: string[]; mono?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_10px_var(--workspace-accent)]"
            style={{ background: "var(--workspace-accent)" }}
          />
          <span
            className={`min-w-0 leading-6 text-cream/68 ${mono ? "font-mono text-[13px]" : "text-[14px]"}`}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Examples({ examples }: { examples: DsaExample[] }) {
  return (
    <div className="grid gap-3">
      {examples.map((example, index) => (
        <article key={`${index}-${example.input}`} className="rounded-2xl bg-black/20 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-cream/42">
            Example {index + 1}
          </p>
          <dl className="mt-3 grid gap-2.5 text-[13px] sm:grid-cols-[4.5rem_1fr]">
            <dt className="font-medium text-cream/42">Input</dt>
            <dd className="overflow-x-auto font-mono leading-6 text-cream/80">{example.input}</dd>
            <dt className="font-medium text-cream/42">Output</dt>
            <dd className="font-mono leading-6 text-cream/80">{example.output}</dd>
          </dl>
          {example.explanation ? (
            <p className="mt-3 text-[13.5px] leading-6 text-cream/52">{example.explanation}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Approaches({ approaches }: { approaches: DsaApproach[] }) {
  return (
    <div className="space-y-5">
      {approaches.map((approach, index) => (
        <article key={approach.name}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-cream">
              {index + 1}. {approach.name}
            </h3>
            <span className="font-mono text-[12px] text-cream/44">
              {approach.complexity.time} · {approach.complexity.space}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-6 text-cream/68">{approach.idea}</p>
          <ol className="mt-3 space-y-2">
            {approach.steps.map((step, stepIndex) => (
              <li
                key={`${stepIndex}-${step}`}
                className="flex gap-3 text-[13px] leading-6 text-cream/56"
              >
                <span className="font-mono text-cream/30">{stepIndex + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] leading-6 text-cream/46">{approach.tradeoff}</p>
        </article>
      ))}
    </div>
  );
}

function NeighbourLink({
  question,
  direction
}: {
  question: DsaQuestion | null;
  direction: "previous" | "next";
}) {
  if (!question) return <span className="hidden sm:block" />;
  const isNext = direction === "next";

  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className={`practice-glass group flex min-w-0 items-center gap-4 rounded-[1.35rem] p-4 transition hover:border-[var(--workspace-accent-border)] ${isNext ? "sm:flex-row-reverse sm:text-right" : ""}`}
    >
      {isNext ? (
        <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-cream/52" />
      ) : (
        <ArrowLeft size={18} aria-hidden="true" className="shrink-0 text-cream/52" />
      )}
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.13em] text-cream/38">
          {isNext ? "Next question" : "Previous question"}
        </span>
        <span className="mt-1 block truncate text-[14px] font-semibold text-cream/78 group-hover:text-cream">
          {question.title}
        </span>
      </span>
    </Link>
  );
}
