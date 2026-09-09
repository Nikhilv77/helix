import {
  Blocks,
  Braces,
  Check,
  CircleAlert,
  CircleDashed,
  Code2,
  Cpu,
  type LucideIcon
} from "lucide-react";
import type {
  CandidateSkillSignal,
  PreparationOnboardingState
} from "../domain/preparation-onboarding";
import type { PreparationAreaId } from "../domain/preparation-areas";
import type { Role } from "@/lib/shared/types";
import { preparationAreasForRole } from "./target-setup";

const AREA_ICONS: Record<PreparationAreaId, LucideIcon> = {
  dsa: Braces,
  "core-technical": Code2,
  "applied-engineering": Cpu,
  "architecture-design": Blocks
};
const TOPIC_STATUS: Record<
  "familiar" | "needs-refresh" | "unknown",
  { label: string; icon: LucideIcon; className: string }
> = {
  familiar: { label: "Answered correctly", icon: Check, className: "text-emerald-300" },
  "needs-refresh": { label: "Needs practice", icon: CircleAlert, className: "text-orange-300" },
  unknown: { label: "Not assessed", icon: CircleDashed, className: "text-cream/42" }
};

export function InitialSkillProfile({
  state,
  role
}: {
  state: PreparationOnboardingState;
  role: Role;
}) {
  const signals = state.skillProfile?.signals ?? [];
  return (
    <div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-2">
      {preparationAreasForRole(role).map((area) => {
        const signal = signals.find((item) => item.areaId === area.id);
        const dsaState = signal?.startingState;
        const evidence = signal?.evidence === "baseline";
        const Icon = AREA_ICONS[area.id];
        return (
          <div key={area.id} className="rounded-xl border border-cream/[0.13] bg-black/15 p-4">
            <div className="flex items-center gap-3">
              <Icon className="size-5 shrink-0 text-[var(--workspace-accent)]" aria-hidden="true" />
              <p className="text-[18px] font-semibold leading-6 text-cream">{area.title}</p>
            </div>
            <p className="mt-3 text-[16px] font-medium leading-5 text-cream/88">
              {area.id === "dsa" && dsaState
                ? dsaStartingStateLabel(dsaState)
                : baselineAreaSummary(signal)}
            </p>
            {signal?.topics?.length ? (
              <div className="mt-2.5 space-y-1.5">
                {signal.topics.map((topic) => (
                  <TopicFamiliarityLine key={topic.label} {...topic} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[15px] leading-6 text-cream/52">
                {evidence
                  ? "Directional only—not a readiness score."
                  : "Trailgrad will wait for real practice evidence before scoring this."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TopicFamiliarityLine({
  label,
  familiarity
}: {
  label: string;
  familiarity: "familiar" | "needs-refresh" | "unknown";
}) {
  const presentation = TOPIC_STATUS[familiarity];
  const StatusIcon = presentation.icon;
  return (
    <div className="grid min-h-5 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 text-[13px] leading-5">
      <span className="min-w-0 break-words text-cream/76">{label}</span>
      <span
        className={[
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium",
          presentation.className
        ].join(" ")}
      >
        <StatusIcon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        {presentation.label}
      </span>
    </div>
  );
}

function baselineAreaSummary(signal: CandidateSkillSignal | undefined): string {
  if (signal?.evidence !== "baseline") return "Not enough evidence yet";
  const topics = signal.topics ?? [];
  if (!topics.length) return "Early baseline captured";
  const familiarCount = topics.filter((topic) => topic.familiarity === "familiar").length;
  const needsPracticeCount = topics.filter((topic) => topic.familiarity === "needs-refresh").length;
  if (needsPracticeCount === topics.length) return "Needs practice based on this baseline";
  if (familiarCount === topics.length) return "Positive early signal";
  if (needsPracticeCount > 0 && familiarCount > 0) return "Mixed early signals";
  if (needsPracticeCount > 0) return "Needs practice based on this baseline";
  return "Not assessed yet";
}

function dsaStartingStateLabel(
  state: NonNullable<PreparationOnboardingState["skillProfile"]>["signals"][number]["startingState"]
): string {
  return {
    "experienced-active": "Experienced / Active",
    "experienced-rusty": "Experienced / Rusty",
    "some-familiarity": "Some familiarity",
    "needs-foundations": "Needs foundations",
    unknown: "Still getting a read"
  }[state ?? "unknown"];
}
