import { Blocks, Braces, Check, Code2, Cpu, type LucideIcon } from "lucide-react";
import { PREPARATION_AREAS, type PreparationAreaId } from "../domain/preparation-areas";
import { includesDsaPulse } from "../domain/preparation-onboarding-flow";
import type { PreparationOnboardingStage } from "../domain/preparation-onboarding";
import type { Level, Role } from "@/lib/shared/types";

export type TargetLevel = "entry" | "mid" | "senior";
export type TargetTimeline =
  "two-weeks" | "two-to-four-weeks" | "one-to-three-months" | "three-to-six-months" | "none";

export const TARGET_ROLE_OPTIONS: Array<{ value: Role; label: string; detail: string }> = [
  {
    value: "frontend",
    label: "Frontend Engineer",
    detail: "Interfaces, web performance, and product UI."
  },
  { value: "backend", label: "Backend Engineer", detail: "APIs, data, and production systems." },
  { value: "fullstack", label: "Full Stack Engineer", detail: "Product work across the stack." },
  { value: "data", label: "Data Engineer", detail: "Pipelines, analytics, and data platforms." },
  { value: "ai-ml", label: "AI / ML Engineer", detail: "Models, applied AI, and evaluation." }
];

export const TARGET_LEVEL_OPTIONS: Array<{ value: TargetLevel; label: string; detail: string }> = [
  {
    value: "entry",
    label: "Entry / SDE-1",
    detail: "Strong fundamentals and clear problem solving."
  },
  {
    value: "mid",
    label: "Mid-level / SDE-2",
    detail: "Ownership, depth, and dependable delivery."
  },
  { value: "senior", label: "Senior / SDE-3+", detail: "Technical leadership and system judgment." }
];

export const TARGET_TIMELINE_OPTIONS: Array<{
  value: TargetTimeline;
  label: string;
  detail: string;
}> = [
  { value: "two-weeks", label: "Less than 2 weeks", detail: "A focused sprint." },
  { value: "two-to-four-weeks", label: "2–4 weeks", detail: "A short, structured push." },
  { value: "one-to-three-months", label: "1–3 months", detail: "Time to build real momentum." },
  { value: "three-to-six-months", label: "3–6 months", detail: "A steady, lower-pressure runway." },
  { value: "none", label: "No deadline yet", detail: "We’ll work from evidence, not a countdown." }
];

export const TARGET_SETUP_COPY = [
  {
    eyebrow: "Target setup · 1 of 4",
    title: "What role are you aiming for?",
    body: "We used your resume to suggest a coding track. You have the final say."
  },
  {
    eyebrow: "Target setup · 2 of 4",
    title: "What level should we prepare for?",
    body: "This sets the bar for future feedback. It does not change what you have already done."
  },
  {
    eyebrow: "Target setup · 3 of 4",
    title: "When do you want to be interview-ready?",
    body: "A lightweight window is enough. You can replace it with a real interview date later."
  },
  {
    eyebrow: "Your preparation areas",
    title: "Let’s find your starting point.",
    body: "Your resume tells me what you’ve worked with. It doesn’t tell me where you’re interview-ready yet."
  },
  {
    eyebrow: "Target setup · 4 of 4",
    title: "Is there a company in mind?",
    body: "Optional. Trailgrad works just as well when you are preparing more broadly."
  }
] as const;

const PREPARATION_AREA_ICONS: Record<PreparationAreaId, LucideIcon> = {
  dsa: Braces,
  "core-technical": Code2,
  "applied-engineering": Cpu,
  "architecture-design": Blocks
};

export function TargetChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = "two"
}: {
  options: Array<{ value: T; label: string; detail: string }>;
  value: T;
  onChange: (value: T) => void;
  columns?: "two" | "three";
}) {
  return (
    <div
      className={
        columns === "three" ? "grid gap-2.5 sm:grid-cols-3" : "grid gap-2.5 sm:grid-cols-2"
      }
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={[
              "group relative min-h-24 rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)]",
              selected
                ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]/30 shadow-[0_16px_32px_-24px_var(--workspace-accent)]"
                : "border-cream/[0.13] bg-black/15 hover:border-cream/30 hover:bg-white/[0.035]"
            ].join(" ")}
          >
            {selected ? (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--workspace-accent)] text-white">
                <Check size={13} strokeWidth={2.6} aria-hidden="true" />
              </span>
            ) : null}
            <span className="block pr-6 text-[15px] font-semibold text-cream sm:text-base">
              {option.label}
            </span>
            <span className="mt-1.5 block text-[13px] leading-5 text-cream/55">
              {option.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function preparationAreasForRole(role: Role) {
  return includesDsaPulse(role)
    ? PREPARATION_AREAS
    : PREPARATION_AREAS.filter((area) => area.id !== "dsa");
}

export function PreparationAreaGrid({ role }: { role: Role }) {
  return (
    <div className="mt-7 max-w-2xl">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {preparationAreasForRole(role).map((area) => {
          const Icon = PREPARATION_AREA_ICONS[area.id];
          return (
            <div
              key={area.id}
              className="min-h-28 rounded-xl border border-cream/[0.13] bg-black/15 p-4 sm:p-[1.125rem]"
            >
              <Icon
                size={21}
                strokeWidth={1.6}
                className="text-[var(--workspace-accent)]"
                aria-hidden="true"
              />
              <p className="mt-3 text-[17px] font-semibold text-cream sm:text-lg">{area.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-cream/55">{area.description}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-cream/60">
        These are not fixed sessions or a mandatory course sequence. They are dimensions Trailgrad
        may evaluate and train.
      </p>
    </div>
  );
}

export function targetStageFor(stage: PreparationOnboardingStage): number {
  if (stage === "target_role") return 0;
  if (stage === "target_level") return 1;
  if (stage === "target_timeline") return 2;
  if (stage === "preparation_areas") return 3;
  return 4;
}

export function nextTargetStage(stage: number): PreparationOnboardingStage | null {
  return (
    (
      [
        "target_level",
        "target_timeline",
        "preparation_areas",
        "target_company",
        "baseline_intro"
      ] as const
    )[stage] ?? null
  );
}

export function targetRoleLabel(role: Role): string {
  return {
    frontend: "Frontend",
    backend: "Backend",
    fullstack: "Full Stack",
    data: "Data Engineering",
    "ai-ml": "AI / ML Engineering",
    pm: "Full Stack"
  }[role];
}

export function levelTarget(level: Level | null): TargetLevel {
  if (level === "3-5") return "mid";
  if (level === "5-plus") return "senior";
  return "entry";
}

export function storedLevel(value: TargetLevel, prior: Level | null): Level {
  if (value === "senior") return "5-plus";
  if (value === "mid") return "3-5";
  return prior === "fresher" ? "fresher" : "0-2";
}

export function timelineTarget(dateValue: string | null): TargetTimeline {
  if (!dateValue) return "none";
  const date = new Date(`${dateValue}T12:00:00`);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 14) return "two-weeks";
  if (days <= 28) return "two-to-four-weeks";
  if (days <= 90) return "one-to-three-months";
  return "three-to-six-months";
}

export function dateForTimeline(value: TargetTimeline): string | null {
  const days = {
    "two-weeks": 14,
    "two-to-four-weeks": 28,
    "one-to-three-months": 90,
    "three-to-six-months": 180,
    none: 0
  }[value];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
