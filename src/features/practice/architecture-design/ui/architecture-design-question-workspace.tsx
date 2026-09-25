"use client";

import { workspaceMutationFetch } from "@/lib/workspace/summary-cache-invalidation";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { SystemDesignCanvas } from "@/features/interviews/ui/voice/components/system-design-canvas";
import { StoryPracticeQuestionWorkspace } from "@/features/practice/shared/ui/story-practice-question-workspace";
import type {
  ArchitectureDesignPublicQuestion
} from "@/features/practice/architecture-design/server/practice.service";
import type { StoryPracticeQuestionBlockView } from "@/features/practice/shared/ui/view-contracts";
import { architectureDesignQuestionView } from "./architecture-design-adapter";
import { ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE } from "./architecture-design-experience";

export function ArchitectureDesignQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle
}: {
  block: StoryPracticeQuestionBlockView;
  initialQuestion: ArchitectureDesignPublicQuestion;
  stageTitle: string;
}) {
  const canvasRequired = initialQuestion.order >= 2;
  return (
    <StoryPracticeQuestionWorkspace
      block={block}
      initialQuestion={architectureDesignQuestionView(initialQuestion)}
      stageTitle={stageTitle}
      experience={ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE}
      responseTool={
        <div className="mb-8 space-y-8">
          <ArchitectureKnowledgeCheck
            questionId={initialQuestion.id}
            check={initialQuestion.question.knowledgeCheck}
          />
          {canvasRequired ? (
            <ArchitectureCanvasSection blockId={block.id} order={initialQuestion.order} />
          ) : null}
        </div>
      }
      structuredAnswerPrompts={
        initialQuestion.order === 1 ? REQUIREMENTS_ANSWER_PROMPTS : ARCHITECTURE_ANSWER_PROMPTS
      }
    />
  );
}

const ARCHITECTURE_ANSWER_PROMPTS = [
  {
    label: "Outcome",
    suggestion: "State the behavior, SLO, or invariant your design must guarantee."
  },
  {
    label: "Why it happens",
    suggestion: "Trace the request, data, and failure path that creates the observed behavior."
  },
  {
    label: "Production consequence",
    suggestion: "Quantify the user impact, blast radius, correctness risk, or operating cost."
  },
  {
    label: "How to fix",
    suggestion:
      "Propose the boundary or mechanism change, then name its trade-off and rollout guardrail."
  }
] as const;

const REQUIREMENTS_ANSWER_PROMPTS = [
  {
    label: "Scope",
    suggestion: "Name the actors, first-release capabilities, and the correctness boundary."
  },
  {
    label: "Assumptions",
    suggestion: "State the workload and product assumptions you need before estimating."
  },
  {
    label: "Estimates and SLOs",
    suggestion:
      "Show the key arithmetic, then define measurable latency, availability, or durability targets."
  },
  {
    label: "Non-goals",
    suggestion:
      "Explicitly defer work that would blur ownership or make the first release impossible to defend."
  }
] as const;

type KnowledgeCheck = ArchitectureDesignPublicQuestion["question"]["knowledgeCheck"];

function ArchitectureCanvasSection({ blockId, order }: { blockId: string; order: number }) {
  return (
    <section
      aria-labelledby="canvas-task-heading"
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/15"
    >
      <div className="px-5 pb-4 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--workspace-accent)]">
          Canvas task
        </p>
        <h3 id="canvas-task-heading" className="mt-2 text-base font-semibold text-cream/82">
          Map the design before you defend it
        </h3>
        <p className="mt-2 max-w-[52rem] text-sm leading-6 text-cream/55">{canvasTask(order)}</p>
      </div>
      <div className="border-t border-white/[0.07] px-4 pb-4">
        <SystemDesignCanvas practiceBlockId={blockId} embedded />
      </div>
    </section>
  );
}

function ArchitectureKnowledgeCheck({
  questionId,
  check
}: {
  questionId: string;
  check: KnowledgeCheck;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    correctChoiceIndex: number;
    rationale: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkAnswer() {
    if (selected === null || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await workspaceMutationFetch("/api/practice/architecture-design/knowledge-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, selectedChoiceIndex: selected })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { result?: typeof result };
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data?.result) {
        throw new Error(payload.error?.message ?? "The knowledge check could not be evaluated.");
      }
      setResult(payload.data.result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The knowledge check could not be evaluated."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-black/15 px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Quick check
      </p>
      <h3 className="mt-2 text-base font-semibold leading-7 text-cream/82">{check.prompt}</h3>
      <div className="mt-4 space-y-2 border-y border-white/[0.07] py-2">
        {check.choices.map((choice, index) => {
          const chosen = selected === index;
          const correct = result?.correctChoiceIndex === index;
          return (
            <button
              key={`${index}:${choice}`}
              type="button"
              aria-pressed={chosen}
              onClick={() => {
                if (result) return;
                setSelected(index);
              }}
              disabled={Boolean(result)}
              className={`grid w-full grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 rounded-xl px-3 py-4 text-left text-sm leading-6 transition ${
                correct
                  ? "bg-emerald-400/[0.08] text-cream/82 ring-1 ring-inset ring-emerald-300/15"
                  : chosen
                    ? "bg-[var(--workspace-accent-soft)] text-cream/78 ring-1 ring-inset ring-[var(--workspace-accent-border)]"
                    : "text-cream/52 hover:bg-white/[0.035]"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition ${
                  correct
                    ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200"
                    : chosen
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-[#111318]"
                      : "border-white/[0.12] bg-white/[0.025] text-cream/48"
                }`}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="pt-1">{choice}</span>
            </button>
          );
        })}
      </div>
      {result ? (
        <div className="mt-4 border-l-2 border-white/[0.12] pl-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-cream/78">
            {result.correct ? (
              <CheckCircle2 size={14} className="text-emerald-300" aria-hidden="true" />
            ) : (
              <XCircle size={14} className="text-amber-300" aria-hidden="true" />
            )}
            {result.correct ? "Correct" : "Review the stronger answer"}
          </p>
          <p className="mt-2 text-sm leading-6 text-cream/52">{result.rationale}</p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-[12px] text-amber-300/80">{error}</p> : null}
      <div className="mt-4 flex justify-end">
        {!result ? (
          <button
            type="button"
            onClick={() => void checkAnswer()}
            disabled={selected === null || pending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/[0.07] px-4 text-sm font-semibold text-cream/72 disabled:opacity-40"
          >
            {pending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
            Check answer
          </button>
        ) : null}
      </div>
    </section>
  );
}

function canvasTask(order: number): string {
  if (order === 2)
    return "Draw the API boundary, ownership of the core records, storage choices, and every synchronous or asynchronous edge. Label the consistency boundary and stable identities.";
  if (order === 3)
    return "Draw the end-to-end request and data flow. Mark queues, caches, partition keys, backpressure, retries, and the boundary that prevents one failure from spreading.";
  return "Annotate the production design with SLO observation points, security boundaries, recovery authority, and the reversible migration or rollback path.";
}
