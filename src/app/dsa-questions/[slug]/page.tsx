import type { Metadata } from "next";
import type { ReactNode } from "react";
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
import type { DsaApproach, DsaDifficulty, DsaExample, DsaQuestion } from "@/lib/dsa/dsa";
import { findQuestion } from "@/lib/dsa/dsa";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

/**
 * A question the user is here to solve.
 *
 * The page is split deliberately: everything above "Work it out" is safe to
 * read before attempting, and everything that gives the answer away sits below
 * inside collapsed panels. Maya's rail carries the progressive hints.
 */

const DIFFICULTY_STYLE: Record<DsaDifficulty, string> = {
  easy: "bg-[#8be6bd]/14 text-[#8be6bd]",
  medium: "bg-[#f4d58b]/14 text-[#f4d58b]",
  hard: "bg-[#f0a3a3]/14 text-[#f0a3a3]"
};

/**
 * Dynamic because the mark-done state is this user's own. The question content
 * itself is static, so only the small progress read costs anything per request.
 */
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

  const { question, phase, previous, next, relatedQuestions } = found;
  const approachNames = (question.approaches ?? []).map((approach) => approach.name);

  // Signed-out or not-in-roadmap both render the page read-only rather than
  // failing — the teaching content does not depend on progress.
  const { userId } = await auth();
  const progress = userId
    ? await getAppContainer()
        .frontendRoadmapService.questionState(authenticatedOwnerId(userId), slug)
        .catch(() => null)
    : null;

  return (
    <div className="mx-auto w-full max-w-[110rem] px-3 pb-16 sm:px-5 lg:px-6">
      <nav className="flex flex-wrap items-center gap-2 border-b border-cream/15 py-5 text-[13px] font-medium text-cream/45">
        <Link href="/" className="transition hover:text-cream">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/practice" className="transition hover:text-cream">
          Practice
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-cream/75">{phase}</span>
      </nav>

      {/* Header and the solving surface share one raised shell, the way Home's
          hero groups its columns. */}
      <section className="mt-6 overflow-hidden rounded-[1.25rem] border border-cream/20 bg-cream/[0.035] p-5 sm:p-7">
        <div className="p-1 sm:p-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize ${DIFFICULTY_STYLE[question.difficulty]}`}
            >
              {question.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-cream/[0.07] px-2.5 py-1 text-[11.5px] font-medium text-cream/60">
              <Clock size={11} aria-hidden="true" />
              {question.expectedTimeMinutes} min
            </span>
            <span className="rounded-md bg-cream/[0.07] px-2.5 py-1 text-[11.5px] font-medium text-cream/60">
              {question.primaryPattern.replace(/-/g, " ")}
            </span>
            <a
              href={question.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-cream/55 transition hover:bg-cream/[0.08] hover:text-cream"
            >
              {question.source}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>

          <h1 className="mt-4 max-w-4xl font-display text-[2rem] font-semibold leading-10 tracking-tight text-cream sm:text-[2.4rem] sm:leading-[3rem]">
            {question.title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15.5px] leading-7 text-cream/70">
            {question.promptSummary}
          </p>

          {/* Keyed by slug so moving to another question resets the mark-done
              state and re-fires the open attempt, instead of React reusing the
              previous question's instance. */}
          <DsaQuestionActions
            key={question.slug}
            slug={question.slug}
            nextHref={next ? `/dsa-questions/${next.slug}` : null}
            initialStatus={progress?.status ?? null}
          />
        </div>

        <div className="mt-8 grid gap-6 border-t border-cream/15 pt-6 lg:grid-cols-[minmax(22rem,0.88fr)_minmax(34rem,1.12fr)] lg:items-start xl:grid-cols-[minmax(25rem,0.82fr)_minmax(42rem,1.18fr)]">
          <div className="min-w-0 space-y-7 lg:border-r lg:border-cream/15 lg:pr-6">
            {question.problemStatement ? (
              <Panel label="The problem">
                <p className="text-[15px] leading-7 text-cream/78">{question.problemStatement}</p>
              </Panel>
            ) : null}

            {question.constraints?.length ? (
              <Panel label="Constraints">
                <Bullets items={question.constraints} mono />
              </Panel>
            ) : null}

            {question.examples?.length ? (
              <Panel label="Examples">
                <Examples examples={question.examples} />
              </Panel>
            ) : null}

            {question.edgeCases?.length ? (
              <Panel label="Edge cases to handle">
                <Bullets items={question.edgeCases} />
              </Panel>
            ) : null}

            <QuestionCoach
              key={question.slug}
              title={question.title}
              pattern={question.primaryPattern}
              promptSummary={question.promptSummary}
              concepts={question.conceptsTested}
              hints={question.hints ?? []}
              keyInsight={question.keyInsight ?? null}
              approachNames={approachNames}
            />
          </div>

          <div className="min-w-0 lg:sticky lg:top-4">
            <DsaQuestionWorkspace question={question} />
          </div>
        </div>
      </section>

      {/* Everything past this line can spoil the problem, so it is collapsed.
          Kept inside the same raised shell as the problem above: floating these
          on the bare page background read as a different screen. */}
      <section className="mt-8 overflow-hidden border-t border-cream/15 pt-6">
        <div className="px-1 pb-1 pt-2 sm:px-2">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[1.35rem] font-semibold tracking-tight text-cream">
              After you have tried it
            </h2>
            <span className="h-px min-w-0 flex-1 bg-cream/[0.14]" />
          </div>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-cream/50">
            Solutions and interviewer notes. Open these once you have written something of your own
            — reading them first is what makes practice stop working.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {question.approaches?.length ? (
            <Reveal label="Approaches" hint={`${question.approaches.length} ways in`}>
              <Approaches approaches={question.approaches} />
            </Reveal>
          ) : null}

          <Reveal label="High level approach" hint="the intended path">
            <p className="text-[15px] leading-7 text-cream/78">{question.highLevelApproach}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Metric label="Time" value={question.complexity.time} />
              <Metric label="Space" value={question.complexity.space} />
            </div>
          </Reveal>

          {question.commonMistakes.length ? (
            <Reveal label="Common mistakes" hint="what trips people up" tone="warn">
              <Bullets items={question.commonMistakes} />
            </Reveal>
          ) : null}

          {question.interviewSignals.length ? (
            <Reveal label="Interview signals" hint="what they are scoring" tone="good">
              <Bullets items={question.interviewSignals} />
            </Reveal>
          ) : null}

          {question.followUpPrompts.length ? (
            <Reveal label="Follow-up questions" hint="expect these next">
              <Bullets items={question.followUpPrompts} />
            </Reveal>
          ) : null}

          {question.conceptsTested.length ? (
            <Reveal label="Concepts tested" hint="what this question is really about">
              <div className="flex flex-wrap gap-2">
                {question.conceptsTested.map((concept) => (
                  <span
                    key={concept}
                    className="rounded-md bg-cream/[0.07] px-2.5 py-1 text-[13px] font-medium text-cream/65"
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
        <section className="mt-8">
          <h2 className="font-display text-[1.35rem] font-semibold tracking-tight text-cream">
            Practice this next
          </h2>
          <div className="mt-4 divide-y divide-cream/10 border-y border-cream/10">
            {relatedQuestions.map((related) => (
              <Link
                key={related.slug}
                href={`/dsa-questions/${related.slug}`}
                className="group flex items-center justify-between gap-4 py-4 transition hover:bg-cream/[0.035]"
              >
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${DIFFICULTY_STYLE[related.difficulty]}`}
                >
                  {related.difficulty}
                </span>
                <p className="mt-2.5 text-[14.5px] font-semibold leading-6 text-cream/85 group-hover:text-cream">
                  {related.title}
                </p>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-cream/35 transition group-hover:translate-x-0.5 group-hover:text-cream"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <nav className="mt-10 grid gap-3 border-t border-cream/[0.1] pt-6 sm:grid-cols-2">
        <NeighbourLink question={previous} direction="previous" />
        <NeighbourLink question={next} direction="next" />
      </nav>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-b border-cream/10 pb-7 last:border-b-0">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** Native details/summary: collapsed spoilers with no client JS. */
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
      <AlertTriangle size={14} aria-hidden="true" />
    ) : tone === "good" ? (
      <Radar size={14} aria-hidden="true" />
    ) : (
      <Sparkles size={14} aria-hidden="true" />
    );
  const accent =
    tone === "warn"
      ? "bg-[#f4d58b]/14 text-[#f4d58b]"
      : tone === "good"
        ? "bg-[#8be6bd]/14 text-[#8be6bd]"
        : "bg-cream/[0.08] text-cream/50";

  return (
    <details className="group overflow-hidden border-b border-cream/10">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-5 transition hover:bg-cream/[0.035] [&::-webkit-details-marker]:hidden">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-cream">{label}</span>
          <span className="mt-0.5 block text-[12.5px] font-medium text-cream/45">{hint}</span>
        </span>
        <span className="shrink-0 text-[12.5px] font-semibold text-cream/45 group-open:hidden">
          Reveal
        </span>
        <ArrowRight
          size={15}
          aria-hidden="true"
          className="shrink-0 rotate-90 text-cream/35 transition-transform group-open:-rotate-90"
        />
      </summary>
      <div className="border-t border-cream/[0.08] py-5 sm:py-6">{children}</div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-lg border border-cream/15 bg-cream/[0.035] px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cream/40">
        {label}
      </span>
      <span className="font-mono text-[13px] text-cream/80">{value}</span>
    </span>
  );
}

function Bullets({ items, mono = false }: { items: string[]; mono?: boolean }) {
  if (items.length === 0) return <p className="text-[13px] text-cream/35">none recorded</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cream/25" />
          <span
            className={`min-w-0 leading-6 text-cream/72 ${mono ? "font-mono text-[13px]" : "text-[14.5px]"}`}
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
    <div className="space-y-3">
      {examples.map((example, index) => (
        <div key={`${index}-${example.input}`} className="border-l-2 border-cream/[0.18] pl-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/40">
            Example {index + 1}
          </p>
          <div className="overflow-x-auto">
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-cream/80">
              {`Input:  ${example.input}\nOutput: ${example.output}`}
            </pre>
          </div>
          {example.explanation ? (
            <p className="mt-2.5 border-t border-cream/[0.08] pt-2.5 text-[13.5px] leading-6 text-cream/50">
              {example.explanation}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Approaches({ approaches }: { approaches: DsaApproach[] }) {
  return (
    <div className="space-y-4">
      {approaches.map((approach, index) => (
      <article key={approach.name} className="border-l-2 border-cream/[0.18] pl-4 sm:pl-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-cream">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-cream/[0.1] text-[11px] text-cream/60">
                {index + 1}
              </span>
              {approach.name}
            </h3>
            <span className="font-mono text-[12px] text-cream/45">
              {approach.complexity.time} · {approach.complexity.space}
            </span>
          </div>
          <p className="mt-3 text-[14.5px] leading-7 text-cream/72">{approach.idea}</p>
          <ol className="mt-3.5 space-y-2">
            {approach.steps.map((step, stepIndex) => (
              <li
                key={`${stepIndex}-${step}`}
                className="flex gap-3 text-[13.5px] leading-6 text-cream/60"
              >
                <span className="font-mono text-cream/30">{stepIndex + 1}.</span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 border-t border-cream/[0.08] pt-3.5 text-[13.5px] leading-6 text-cream/48">
            {approach.tradeoff}
          </p>
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
  const isNext = direction === "next";
  if (!question) return <span className="hidden sm:block" />;

  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className={`group flex items-center gap-3 border-t border-cream/10 py-4 transition hover:bg-cream/[0.035] ${isNext ? "sm:flex-row-reverse sm:text-right" : ""}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream/[0.08] text-cream/50 transition group-hover:text-cream">
        {isNext ? (
          <ArrowRight size={16} aria-hidden="true" />
        ) : (
          <ArrowLeft size={16} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/40">
          {isNext ? "Next" : "Previous"}
        </span>
        <span className="mt-0.5 block truncate text-[14.5px] font-semibold text-cream/85 group-hover:text-cream">
          {question.title}
        </span>
      </span>
    </Link>
  );
}
