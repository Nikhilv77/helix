"use client";

import dynamic from "next/dynamic";
import { Blocks, Braces, Code2 } from "lucide-react";
import type {
  BaselineQuestion,
  BaselineSection,
  PreparationOnboardingStage
} from "../domain/preparation-onboarding";
import { BASELINE_DURATION_LABEL, includesDsaPulse } from "../domain/preparation-onboarding-flow";
import type { Role } from "@/lib/shared/types";
import { useWordReveal, WordRevealLine, WELCOME_BODY_STAGGER_MS } from "./welcome-presentation";

const PracticeCodeViewer = dynamic(
  () =>
    import("@/features/practice/shared/ui/practice-code-viewer").then(
      (module) => module.PracticeCodeViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-36 animate-pulse rounded-xl border border-white/[0.08] bg-black/25" />
    )
  }
);

export type BaselineFlowStage = "intro" | BaselineSection | "completed" | null;

export function BaselineIntro({ role }: { role: Role }) {
  const checks = [
    ...(includesDsaPulse(role)
      ? [
          {
            icon: Braces,
            title: "DSA pulse",
            detail: "Six lightweight checks across patterns and code reading."
          }
        ]
      : []),
    {
      icon: Code2,
      title: "Technical pulse",
      detail: "Three quick decisions shaped by your target role."
    },
    {
      icon: Blocks,
      title: "Engineering pulse",
      detail: "One production scenario and the trade-offs you notice."
    },
    {
      icon: Blocks,
      title: "Architecture pulse",
      detail: "One system-design decision about the boundary that matters."
    }
  ];
  return (
    <div className="mt-7 max-w-3xl">
      <p className="text-base font-semibold text-cream">{BASELINE_DURATION_LABEL}</p>
      <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {checks.map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="min-w-0 rounded-xl border border-cream/[0.13] bg-white/[0.02] p-4 sm:p-5"
          >
            <Icon className="size-6 text-[var(--workspace-accent)]" aria-hidden="true" />
            <p className="mt-3 text-[17px] font-semibold leading-6 text-cream">{title}</p>
            <p className="mt-1.5 text-[15px] leading-6 text-cream/60">{detail}</p>
          </div>
        ))}
      </div>
      <p className="mt-7 text-[15px] leading-6 text-cream/60">
        This is a first read, not a final verdict. Trailgrad will keep uncertainty visible until you
        give it more evidence.
      </p>
    </div>
  );
}

export function BaselineQuestionCard({
  question,
  choiceId,
  onChoice
}: {
  question: BaselineQuestion;
  choiceId: string;
  onChoice: (choiceId: string) => void;
}) {
  const promptReveal = useWordReveal(question.prompt, true, 180, WELCOME_BODY_STAGGER_MS);
  return (
    <div className="mt-7 max-w-2xl">
      <p className="text-[17px] font-semibold leading-7 text-cream sm:text-lg">
        <WordRevealLine
          words={promptReveal.words}
          visibleCount={promptReveal.visibleCount}
          wordClassName="maya-welcome-copy-word"
        />
      </p>
      {question.code ? (
        <div className="mt-5">
          <PracticeCodeViewer
            code={question.code.value}
            language={question.code.language}
            maxLines={10}
          />
        </div>
      ) : null}
      <div className="mt-5 grid gap-2.5">
        {question.options.map((option) => {
          const selected = option.id === choiceId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoice(option.id)}
              className={[
                "rounded-xl border px-4 py-4 text-left text-[16px] font-medium leading-6 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)]",
                selected
                  ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]/30 text-cream"
                  : "border-cream/[0.13] bg-white/[0.02] text-cream/78 hover:border-cream/30 hover:text-cream"
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function baselineStageFor(stage: PreparationOnboardingStage): BaselineFlowStage {
  if (stage === "baseline_intro") return "intro";
  const sections: Record<
    Exclude<BaselineFlowStage, "intro" | "completed" | null>,
    PreparationOnboardingStage
  > = {
    "dsa-familiarity": "baseline_dsa_familiarity",
    "dsa-lookup": "baseline_dsa_lookup",
    "dsa-binary-search": "baseline_dsa_binary_search",
    "dsa-tree-bfs": "baseline_dsa_tree_bfs",
    "dsa-adaptive": "baseline_dsa_adaptive",
    "dsa-code-lookup": "baseline_dsa_code_lookup",
    "dsa-code-binary-search": "baseline_dsa_code_binary_search",
    "technical-1": "baseline_technical_1",
    "technical-2": "baseline_technical_2",
    "technical-3": "baseline_technical_3",
    engineering: "baseline_engineering",
    architecture: "baseline_architecture"
  };
  const matchingSection = (
    Object.entries(sections) as Array<[BaselineSection, PreparationOnboardingStage]>
  ).find(([, value]) => value === stage)?.[0];
  if (matchingSection) return matchingSection;
  if (stage === "completed") return "completed";
  return null;
}

export function welcomeProgressIndex(
  step: number,
  targetStage: number,
  baselineStage: BaselineFlowStage
): number {
  if (baselineStage === "intro") return 6;
  if (baselineStage?.startsWith("dsa-")) return 7;
  if (baselineStage?.startsWith("technical-")) return 8;
  if (
    baselineStage === "engineering" ||
    baselineStage === "architecture" ||
    baselineStage === "completed"
  )
    return 9;
  return step === 0 ? 0 : targetStage + 1;
}
