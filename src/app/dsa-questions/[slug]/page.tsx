import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, ChevronRight, Clock, ExternalLink } from "lucide-react";
import { DsaProblemPanel } from "@/components/workspace/dsa/dsa-problem-panel";
import { DsaQuestionActions } from "@/components/workspace/dsa/dsa-question-actions";
import { DsaQuestionWorkspace } from "@/components/workspace/dsa/dsa-question-workspace";
import type { DsaQuestion } from "@/lib/dsa/dsa";
import { dsaPhases, findQuestion } from "@/lib/dsa/dsa";
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

/** A compact, viewport-sized practice workspace inspired by coding platforms. */
export default async function DsaQuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = findQuestion(slug);
  if (!found) notFound();

  const { question, phase, phaseSlug } = found;
  const phaseQuestions = dsaPhases().find((item) => item.phase === phase)?.questions ?? [question];
  const patternQuestions = phaseQuestions.filter(
    (item) => item.primaryPattern === question.primaryPattern
  );
  const currentIndex = Math.max(
    0,
    patternQuestions.findIndex((item) => item.slug === question.slug)
  );
  const next = patternQuestions[currentIndex + 1] ?? found.next;
  const { userId } = await auth();
  const [progress, initialLanguage] = userId
    ? await Promise.all([
        getAppContainer()
          .frontendRoadmapService.questionState(authenticatedOwnerId(userId), slug)
          .catch(() => null),
        getAppContainer()
          .profileService.dsaEditorLanguage(authenticatedOwnerId(userId))
          .catch(() => "javascript" as const)
      ])
    : [null, "javascript" as const];

  return (
    <main className="w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-[112rem] flex-col gap-2 xl:h-full">
        <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2.5 sm:px-4">
          <Link
            href={`/practice/dsa#${phaseSlug}`}
            aria-label={`Back to ${phase}`}
            title={`Back to ${phase}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-cream/48 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-cream sm:text-[17px]">
                {question.title}
              </h1>
              <QuestionMeta question={question} />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <a
              href={question.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.055] hover:text-cream"
            >
              <ExternalLink size={14} aria-hidden="true" />
              Open in LeetCode
            </a>
          </div>

          <div className="w-full border-t border-white/[0.06] pt-2.5 xl:ml-1 xl:w-auto xl:border-0 xl:pt-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DsaQuestionActions
                key={question.slug}
                slug={question.slug}
                nextHref={next ? `/dsa-questions/${next.slug}` : null}
                initialStatus={progress?.status ?? null}
              />
              {next ? (
                <Link
                  href={`/dsa-questions/${next.slug}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.055] px-3 text-[12.5px] font-semibold text-cream/72 transition hover:bg-white/[0.09] hover:text-cream"
                >
                  Next question <ChevronRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
          <DsaProblemPanel question={question} />
          <DsaQuestionWorkspace
            key={question.slug}
            question={question}
            initialStatus={progress?.status ?? null}
            initialLanguage={initialLanguage}
          />
        </div>
      </div>
    </main>
  );
}

function QuestionMeta({ question }: { question: DsaQuestion }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-cream/44">
      <span className="rounded-md bg-white/[0.045] px-2 py-1 capitalize">
        {question.difficulty}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.045] px-2 py-1">
        <Clock size={11} aria-hidden="true" /> {question.expectedTimeMinutes} min
      </span>
      <span className="hidden rounded-md bg-white/[0.045] px-2 py-1 capitalize sm:inline-flex">
        {question.primaryPattern.replace(/-/g, " ")}
      </span>
    </div>
  );
}
