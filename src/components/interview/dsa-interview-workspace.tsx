"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Code2,
  ExternalLink,
  Lightbulb,
  Loader2,
  Mic2,
  Send,
  Volume2,
  VolumeX
} from "lucide-react";
import { MayaStage } from "@/components/workspace/maya-stage";
import type { DsaQuestion } from "@/lib/dsa";
import { useMayaVoice } from "@/lib/use-maya-voice";

type Evaluation = {
  verdict: "strong" | "developing" | "needs-work";
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  followUp: string;
};

export function DsaInterviewWorkspace({ question }: { question: DsaQuestion }) {
  const [approach, setApproach] = useState("");
  const [code, setCode] = useState(starterCode(question));
  const [timeComplexity, setTimeComplexity] = useState("");
  const [spaceComplexity, setSpaceComplexity] = useState("");
  const [revealedHints, setRevealedHints] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();

  const opening = useMemo(
    () =>
      `${question.title}. I want you to treat this like a real coding interview. Start by clarifying the problem and talking through a brute-force approach. Then improve it before you code. I’ll stay quiet unless you ask for a hint or submit your solution.`,
    [question.title]
  );

  const say = useCallback(
    (line: string) => {
      if (!muted) void speak(line);
    },
    [muted, speak]
  );

  useEffect(() => {
    if (muted || awaitingGesture) return;
    const timer = window.setTimeout(() => void speak(opening), 100);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, muted, opening, speak]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture]);

  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  function revealHint() {
    const hint = question.hints?.[revealedHints];
    if (!hint) return;
    setRevealedHints((count) => count + 1);
    say(hint);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setEvaluation(null);

    try {
      const response = await fetch("/api/dsa/interview/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: question.slug,
          approach,
          code,
          timeComplexity,
          spaceComplexity,
          hintsUsed: revealedHints
        })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: Evaluation;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Maya could not review the solution.");
      }

      setEvaluation(payload.data);
      say(`${payload.data.summary} ${payload.data.followUp}`);
      void recordSubmission(question.slug, code, payload.data.score / 100);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Review failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    approach.trim().length >= 10 &&
    code.trim().length >= 10 &&
    timeComplexity.trim().length > 0 &&
    spaceComplexity.trim().length > 0;

  return (
    <main className="min-h-screen bg-[#365abc] text-cream">
      <header className="flex h-14 items-center justify-between border-b border-cream/[0.1] px-4 sm:px-6">
        <Link
          href={`/dsa-questions/${question.slug}`}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-cream/55 transition hover:text-cream"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Exit interview
        </Link>
        <div className="flex items-center gap-4 text-[12px] font-medium text-cream/50">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} aria-hidden="true" /> {question.expectedTimeMinutes} min
          </span>
          <span className="capitalize">{question.difficulty}</span>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.45fr)_18rem]">
        <section className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-cream/[0.1] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
              Problem
            </p>
            <a
              href={question.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cream/45 transition hover:text-cream"
            >
              {question.source}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
          <h1 className="mt-3 font-display text-[2rem] font-semibold leading-tight tracking-tight">
            {question.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-medium text-cream/50">
            <span className="capitalize">{question.difficulty}</span>
            <span aria-hidden="true">·</span>
            <span>{question.primaryPattern.replace(/-/g, " ")}</span>
            <span aria-hidden="true">·</span>
            <span>{question.expectedTimeMinutes} min</span>
          </div>

          <div className="mt-7 space-y-8">
            <ProblemSection title="Description">
              <p className="text-[15px] leading-7 text-cream/78">
                {question.problemStatement ?? question.promptSummary}
              </p>
            </ProblemSection>

            {question.examples?.length ? (
              <ProblemSection title="Examples">
                <div className="space-y-6">
                  {question.examples.map((example, index) => (
                    <div key={`${example.input}-${example.output}`}>
                      <p className="mb-2 text-[13px] font-semibold text-cream/78">
                        Example {index + 1}
                      </p>
                      <div className="border-l-2 border-cream/[0.18] pl-4 font-mono text-[12.5px] leading-6 text-cream/75">
                        <p>
                          <span className="text-cream/45">Input:</span> {example.input}
                        </p>
                        <p>
                          <span className="text-cream/45">Output:</span> {example.output}
                        </p>
                      </div>
                      {example.explanation ? (
                        <p className="mt-2 text-[13px] leading-6 text-cream/52">
                          <span className="font-semibold text-cream/65">Explanation:</span>{" "}
                          {example.explanation}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ProblemSection>
            ) : null}

            {question.constraints?.length ? (
              <ProblemSection title="Constraints">
                <ul className="space-y-2 font-mono text-[12.5px] leading-6 text-cream/70">
                  {question.constraints.map((constraint) => (
                    <li key={constraint} className="flex gap-3">
                      <span className="text-cream/35">•</span>
                      <span>{constraint}</span>
                    </li>
                  ))}
                </ul>
              </ProblemSection>
            ) : null}

            {question.followUpPrompts?.length ? (
              <ProblemSection title="Follow-up">
                <ul className="space-y-2 text-[13.5px] leading-6 text-cream/68">
                  {question.followUpPrompts.map((followUp) => (
                    <li key={followUp} className="flex gap-3">
                      <span className="text-cream/35">•</span>
                      <span>{followUp}</span>
                    </li>
                  ))}
                </ul>
              </ProblemSection>
            ) : null}
          </div>

          <div className="mt-6">
            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/42">
              Talk through your approach
            </label>
            <textarea
              value={approach}
              onChange={(event) => setApproach(event.target.value)}
              placeholder="Clarify assumptions, state brute force, then explain the invariant and optimized approach."
              className="mt-2 min-h-40 w-full resize-y bg-[#294aa2] p-4 text-[14px] leading-6 text-cream outline-none placeholder:text-cream/28 focus:ring-1 focus:ring-inset focus:ring-cream/30"
            />
          </div>
        </section>

        <section className="flex min-w-0 flex-col border-b border-cream/[0.1] lg:border-b-0 lg:border-r">
          <div className="flex h-12 items-center gap-2 border-b border-cream/[0.1] px-4">
            <Code2 size={15} aria-hidden="true" className="text-cream/45" />
            <span className="text-[13px] font-semibold">TypeScript</span>
          </div>
          <textarea
            aria-label="Code editor"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="min-h-[30rem] flex-1 resize-none bg-[#203d8d] p-5 font-mono text-[13px] leading-6 text-[#f2ecdd] outline-none focus:bg-[#213f92]"
          />
          <div className="grid gap-3 border-t border-cream/[0.1] p-4 sm:grid-cols-2">
            <input
              value={timeComplexity}
              onChange={(event) => setTimeComplexity(event.target.value)}
              placeholder="Time complexity, e.g. O(n)"
              className="h-11 bg-[#294aa2] px-3 text-[13px] outline-none placeholder:text-cream/28 focus:ring-1 focus:ring-inset focus:ring-cream/30"
            />
            <input
              value={spaceComplexity}
              onChange={(event) => setSpaceComplexity(event.target.value)}
              placeholder="Space complexity, e.g. O(n)"
              className="h-11 bg-[#294aa2] px-3 text-[13px] outline-none placeholder:text-cream/28 focus:ring-1 focus:ring-inset focus:ring-cream/30"
            />
          </div>
        </section>

        <aside className="flex min-h-[34rem] flex-col bg-[#294aa2]">
          <div className="relative h-60 overflow-hidden border-b border-cream/[0.1]">
            <div className="absolute inset-x-[-18%] bottom-0 top-10">
              <MayaStage speaking={state === "speaking"} />
            </div>
            <div className="relative z-10 flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Mic2 size={15} aria-hidden="true" />
                <span className="text-[13px] font-semibold">Maya</span>
              </div>
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute Maya" : "Mute Maya"}
                className="grid h-8 w-8 place-items-center text-cream/55 hover:bg-cream/[0.08] hover:text-cream"
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <p className="text-[12px] leading-5 text-cream/58">
              Explain first, code second. Maya reviews the reasoning and implementation together.
            </p>

            {question.hints?.length ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={revealHint}
                  disabled={revealedHints >= question.hints.length}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 bg-cream/[0.08] px-3 text-[13px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] disabled:opacity-40"
                >
                  <Lightbulb size={14} aria-hidden="true" />
                  {revealedHints >= question.hints.length
                    ? "All hints used"
                    : `Ask for hint ${revealedHints + 1}`}
                </button>
                {question.hints.slice(0, revealedHints).map((hint, index) => (
                  <p
                    key={hint}
                    className="mt-3 border-l-2 border-[#f4d58b]/50 pl-3 text-[12.5px] leading-5 text-cream/68"
                  >
                    {index + 1}. {hint}
                  </p>
                ))}
              </div>
            ) : null}

            {evaluation ? (
              <div className="mt-5 border-t border-cream/[0.1] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold capitalize">
                    <CheckCircle2 size={15} aria-hidden="true" /> {evaluation.verdict}
                  </span>
                  <span className="font-mono text-[13px] text-cream/60">
                    {evaluation.score}/100
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-cream/78">{evaluation.summary}</p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/40">
                  Maya's follow-up
                </p>
                <p className="mt-1.5 text-[14px] leading-6 text-cream">{evaluation.followUp}</p>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-[12.5px] text-[#f0a3a3]">{error}</p> : null}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 bg-cream px-4 text-[14px] font-semibold text-[#1d3a86] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Submit to Maya
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ProblemSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold text-cream">{title}</h2>
      {children}
    </section>
  );
}

function starterCode(question: DsaQuestion): string {
  const functionName = question.slug.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
  return `function ${functionName}(input: unknown): unknown {\n  // Explain your invariant before implementing.\n  \n}\n`;
}

async function recordSubmission(slug: string, answer: string, score: number): Promise<void> {
  await fetch("/api/roadmap/question-attempt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit",
      dsaQuestionSlug: slug,
      answer,
      score
    })
  }).catch(() => undefined);
}
