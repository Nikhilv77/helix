"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Blocks,
  Building2,
  Braces,
  Check,
  CircleAlert,
  CircleDashed,
  Code2,
  Cpu,
  Loader2,
  Target,
  Volume2,
  VolumeX,
  type LucideIcon
} from "lucide-react";
import {
  advancePreparationTarget,
  ApiClientError,
  startPreparationBaseline,
  submitPreparationBaseline
} from "@/lib/api/api-client";
import { useMayaVoice, voiceUrl, type VoiceState } from "@/lib/voice/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import {
  PREPARATION_AREAS,
  type PreparationAreaId
} from "@/lib/preparation/preparation-areas";
import {
  type BaselineSection,
  type BaselineQuestion,
  type CandidateSkillSignal,
  type PreparationOnboardingStage,
  type PreparationOnboardingState
} from "@/lib/preparation/preparation-onboarding";
import {
  BASELINE_DURATION_LABEL,
  baselineQuestionTeacherCue,
  firstBaselineSection,
  includesDsaPulse,
  nextBaselineSection
} from "@/lib/preparation/preparation-onboarding-flow";
import { suggestedPreparationRole } from "@/lib/preparation/preparation-target";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { PracticeRoadmapSession } from "@/lib/practice/practice-roadmap";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { CandidateProfile, Level, Role } from "@/lib/shared/types";
import {
  welcomePerformanceProfile,
  type WelcomePerformanceProfile
} from "./welcome-performance";

const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false }
);

const PracticeCodeViewer = dynamic(
  () => import("@/components/workspace/practice/practice-code-viewer").then((module) => module.PracticeCodeViewer),
  {
    ssr: false,
    loading: () => <div className="h-36 animate-pulse rounded-xl border border-white/[0.08] bg-black/25" />
  }
);

const WELCOME_TITLE_STAGGER_MS = 92;
const WELCOME_BODY_STAGGER_MS = 26;
const FALLBACK_WELCOME_SLIDE = {
  eyebrow: "Roadmap ready",
  title: "Your roadmap is ready.",
  body: "I prepared your interview roadmap and I am ready to walk you through the first step.",
  icon: Check
};

const TARGET_ROLE_OPTIONS: Array<{ value: Role; label: string; detail: string }> = [
  { value: "frontend", label: "Frontend Engineer", detail: "Interfaces, web performance, and product UI." },
  { value: "backend", label: "Backend Engineer", detail: "APIs, data, and production systems." },
  { value: "fullstack", label: "Full Stack Engineer", detail: "Product work across the stack." },
  { value: "data", label: "Data Engineer", detail: "Pipelines, analytics, and data platforms." },
  { value: "ai-ml", label: "AI / ML Engineer", detail: "Models, applied AI, and evaluation." }
];

type TargetLevel = "entry" | "mid" | "senior";

const TARGET_LEVEL_OPTIONS: Array<{ value: TargetLevel; label: string; detail: string }> = [
  { value: "entry", label: "Entry / SDE-1", detail: "Strong fundamentals and clear problem solving." },
  { value: "mid", label: "Mid-level / SDE-2", detail: "Ownership, depth, and dependable delivery." },
  { value: "senior", label: "Senior / SDE-3+", detail: "Technical leadership and system judgment." }
];

type TargetTimeline = "two-weeks" | "two-to-four-weeks" | "one-to-three-months" | "three-to-six-months" | "none";
type BaselineFlowStage = "intro" | BaselineSection | "completed" | null;

const TARGET_TIMELINE_OPTIONS: Array<{ value: TargetTimeline; label: string; detail: string }> = [
  { value: "two-weeks", label: "Less than 2 weeks", detail: "A focused sprint." },
  { value: "two-to-four-weeks", label: "2–4 weeks", detail: "A short, structured push." },
  { value: "one-to-three-months", label: "1–3 months", detail: "Time to build real momentum." },
  { value: "three-to-six-months", label: "3–6 months", detail: "A steady, lower-pressure runway." },
  { value: "none", label: "No deadline yet", detail: "We’ll work from evidence, not a countdown." }
];

const PREPARATION_AREA_ICONS: Record<PreparationAreaId, LucideIcon> = {
  dsa: Braces,
  "core-technical": Code2,
  "applied-engineering": Cpu,
  "architecture-design": Blocks
};

const TARGET_SETUP_COPY = [
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
function useWordReveal(
  text: string,
  active: boolean,
  delay = 0,
  stagger = WELCOME_TITLE_STAGGER_MS
) {
  const words = text.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;

    let interval = 0;
    const timer = window.setTimeout(() => {
      if (stagger <= 0) {
        setVisibleCount(words.length);
        return;
      }
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
  }, [active, delay, stagger, text, words.length]);

  return { words, visibleCount };
}

function readWelcomePerformanceProfile(): WelcomePerformanceProfile {
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  return welcomePerformanceProfile({
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    deviceMemory: device.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    saveData: device.connection?.saveData
  });
}

function WordRevealLine({
  words,
  visibleCount,
  className,
  wordClassName = ""
}: {
  words: string[];
  visibleCount: number;
  className?: string;
  wordClassName?: string;
}) {
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

function TechInterviewMotifs({ side }: { side: "maya" | "copy" }) {
  return (
    <>
      {side === "maya" ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -left-24 top-16 z-0 h-72 w-72 rounded-full border border-cream/[0.09]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-8 top-14 z-0 h-24 w-56 rounded-full bg-cream/[0.025] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-6 top-14 z-0 h-16 w-40 rounded-xl border border-cream/[0.13] bg-cream/[0.018]"
          >
            <span className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-cream/[0.16]" />
            <span className="absolute left-9 top-4 h-px w-20 bg-cream/[0.14]" />
            <span className="absolute left-9 top-8 h-px w-24 bg-cream/[0.1]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-5 top-24 z-0 h-20 w-36 rounded-xl border border-cream/[0.1] bg-cream/[0.014]"
          >
            <span className="absolute left-4 top-5 h-px w-24 bg-cream/[0.12]" />
            <span className="absolute left-4 top-9 h-px w-16 bg-cream/[0.09]" />
            <span className="absolute bottom-4 left-4 h-2 w-2 rounded-full bg-cream/[0.13]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-10 top-[45%] z-0 h-px w-48 bg-[linear-gradient(90deg,rgba(241,234,216,0.08)_0_35%,transparent_35%_52%,rgba(241,234,216,0.08)_52%_72%,transparent_72%_100%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-24 left-7 z-0 flex h-14 items-end gap-1.5 text-cream/[0.16]"
          >
            {[28, 54, 38, 72, 46, 60, 34].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="w-1 rounded-full bg-current"
                style={{ height: `${height}%` }}
              />
            ))}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-20 right-10 z-0 grid grid-cols-[auto_1.75rem_auto_1.75rem_auto] items-center text-cream/[0.11]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
          </span>
          <span aria-hidden className="pointer-events-none absolute bottom-44 left-9 z-0 h-20 w-28">
            <span className="absolute left-0 top-0 h-6 w-6 border-l border-t border-cream/[0.1]" />
            <span className="absolute right-0 top-0 h-6 w-6 border-r border-t border-cream/[0.08]" />
            <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-cream/[0.08]" />
            <span className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-cream/[0.1]" />
          </span>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-28 bottom-12 z-0 h-72 w-72 rounded-full border border-cream/[0.08]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-8 top-20 z-0 h-20 w-40 rounded-xl border border-cream/[0.1] bg-cream/[0.012]"
          >
            <span className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-cream/[0.13]" />
            <span className="absolute left-9 top-4 h-px w-20 bg-cream/[0.11]" />
            <span className="absolute left-4 top-9 h-px w-28 bg-cream/[0.08]" />
            <span className="absolute left-4 top-13 h-px w-16 bg-cream/[0.07]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute right-8 top-[30%] z-0 h-28 w-28 rounded-full border border-cream/[0.12]"
          >
            <span className="absolute inset-5 flex items-center justify-center gap-1 text-cream/[0.14]">
              {[38, 64, 50, 82, 45, 72, 56].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-1 rounded-full bg-current"
                  style={{ height: `${height}%` }}
                />
              ))}
            </span>
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-28 right-12 z-0 h-px w-56 bg-gradient-to-r from-transparent via-cream/[0.12] to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-36 left-8 z-0 flex gap-4 text-cream/[0.12]"
          >
            <span className="h-12 w-24 rounded-lg border border-current bg-cream/[0.01]" />
            <span className="h-12 w-16 rounded-lg border border-current bg-cream/[0.01]" />
            <span className="h-12 w-20 rounded-lg border border-current bg-cream/[0.01]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-20 left-[44%] z-0 grid grid-cols-[auto_2rem_auto_2rem_auto] items-center text-cream/[0.1]"
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2 w-2 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2 w-2 rounded-full bg-current" />
          </span>
          <span aria-hidden className="pointer-events-none absolute right-28 top-20 z-0 h-16 w-36">
            <span className="absolute left-0 top-0 h-5 w-5 border-l border-t border-cream/[0.09]" />
            <span className="absolute right-0 top-0 h-5 w-5 border-r border-t border-cream/[0.09]" />
            <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-cream/[0.07]" />
            <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-cream/[0.07]" />
          </span>
        </>
      )}
    </>
  );
}

function TargetChoiceGrid<T extends string>({
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
    <div className={columns === "three" ? "grid gap-2.5 sm:grid-cols-3" : "grid gap-2.5 sm:grid-cols-2"}>
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
            <span className="block pr-6 text-[15px] font-semibold text-cream sm:text-base">{option.label}</span>
            <span className="mt-1.5 block text-[13px] leading-5 text-cream/55">{option.detail}</span>
          </button>
        );
      })}
    </div>
  );
}

function preparationAreasForRole(role: Role) {
  return includesDsaPulse(role) ? PREPARATION_AREAS : PREPARATION_AREAS.filter((area) => area.id !== "dsa");
}

function PreparationAreaGrid({ role }: { role: Role }) {
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
              <Icon size={21} strokeWidth={1.6} className="text-[var(--workspace-accent)]" aria-hidden="true" />
              <p className="mt-3 text-[17px] font-semibold text-cream sm:text-lg">{area.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-cream/55">{area.description}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-cream/60">
        These are not fixed sessions or a mandatory course sequence. They are dimensions Trailgrad may evaluate and train.
      </p>
    </div>
  );
}

function BaselineIntro({ role }: { role: Role }) {
  const includesDsa = includesDsaPulse(role);
  const checks = [
    ...(includesDsa ? [{ icon: Braces, title: "DSA pulse", detail: "Six lightweight checks across patterns and code reading." }] : []),
    { icon: Code2, title: "Technical pulse", detail: "Three quick decisions shaped by your target role." },
    { icon: Blocks, title: "Engineering pulse", detail: "One production scenario and the trade-offs you notice." },
    { icon: Blocks, title: "Architecture pulse", detail: "One system-design decision about the boundary that matters." }
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
        This is a first read, not a final verdict. Trailgrad will keep uncertainty visible until you give it more evidence.
      </p>
    </div>
  );
}

function BaselineQuestionCard({
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
          <PracticeCodeViewer code={question.code.value} language={question.code.language} maxLines={10} />
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

function InitialSkillProfile({ state, role }: { state: PreparationOnboardingState; role: Role }) {
  const signals = state.skillProfile?.signals ?? [];
  return (
    <div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-2">
      {preparationAreasForRole(role).map((area) => {
        const signal = signals.find((item) => item.areaId === area.id);
        const dsaState = signal?.startingState;
        const evidence = signal?.evidence === "baseline";
        const Icon = PREPARATION_AREA_ICONS[area.id];
        return (
          <div key={area.id} className="rounded-xl border border-cream/[0.13] bg-black/15 p-4">
            <div className="flex items-center gap-3">
              <Icon className="size-5 shrink-0 text-[var(--workspace-accent)]" aria-hidden="true" />
              <p className="text-[18px] font-semibold leading-6 text-cream">{area.title}</p>
            </div>
            <p className="mt-3 text-[16px] font-medium leading-5 text-cream/88">
              {area.id === "dsa" && dsaState ? dsaStartingStateLabel(dsaState) : baselineAreaSummary(signal)}
            </p>
            {signal?.topics?.length ? (
              <div className="mt-2.5 space-y-1.5">
                {signal.topics.map((topic) => <TopicFamiliarityLine key={topic.label} {...topic} />)}
              </div>
            ) : (
              <p className="mt-3 text-[15px] leading-6 text-cream/52">
                {evidence ? "Directional only—not a readiness score." : "Trailgrad will wait for real practice evidence before scoring this."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TopicFamiliarityLine({ label, familiarity }: { label: string; familiarity: "familiar" | "needs-refresh" | "unknown" }) {
  const presentation = TOPIC_STATUS_PRESENTATION[familiarity];
  const StatusIcon = presentation.icon;
  return (
    <div className="flex min-h-5 min-w-0 items-center justify-between gap-3 text-[13px] leading-4">
      <span className="min-w-0 text-cream/76 sm:whitespace-nowrap">{label}</span>
      <span className={["inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium", presentation.className].join(" ")}>
        <StatusIcon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        {presentation.label}
      </span>
    </div>
  );
}

const TOPIC_STATUS_PRESENTATION: Record<"familiar" | "needs-refresh" | "unknown", { label: string; icon: LucideIcon; className: string }> = {
  familiar: {
    label: "Answered correctly",
    icon: Check,
    className: "text-emerald-300"
  },
  "needs-refresh": {
    label: "Needs practice",
    icon: CircleAlert,
    className: "text-orange-300"
  },
  unknown: {
    label: "Not assessed",
    icon: CircleDashed,
    className: "text-cream/42"
  }
};

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

interface MayaWelcomeProps {
  profile: CandidateProfile;
  /** Mandatory onboarding has no dismiss affordance or escape hatch. */
  blocking?: boolean;
  practiceHref: string;
  frontendRoadmap?: FrontendRoadmapHome | null;
  frontendPlan?: FrontendDsaPlan | null;
  /**
   * The candidate's generated Practice sessions. Falls back to PREP_SESSIONS
   * only when the roadmap could not be built — otherwise this screen promised
   * everyone the same static titles while Practice showed personalised ones.
   */
  practiceSessions?: PracticeRoadmapSession[] | null;
}

export function MayaWelcome({
  profile,
  blocking = true
}: MayaWelcomeProps) {
  const teacher = useWorkspaceTeacher();
  // Maya introduces herself out loud by default; muting her turns this off for
  // the rest of the walkthrough.
  const voiceEnabled = useRef(true);
  const voicePreloads = useRef(new Map<string, HTMLAudioElement>());
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const userControlledScroll = useRef(false);
  const [step, setStep] = useState(0);
  const [onboarding, setOnboarding] = useState(profile.preparationOnboarding);
  const [targetStage, setTargetStage] = useState(() => targetStageFor(profile.preparationOnboarding.stage));
  const [resumeSuggestedRole] = useState<Role>(() => suggestedPreparationRole({
    stage: profile.preparationOnboarding.stage,
    savedRole: profile.targetRole,
    resume: profile.resume
  }));
  const [targetRole, setTargetRole] = useState<Role>(resumeSuggestedRole);
  const [targetLevel, setTargetLevel] = useState<TargetLevel>(() => levelTarget(profile.level));
  const [targetTimeline, setTargetTimeline] = useState<TargetTimeline>(() => timelineTarget(profile.targetDate));
  const [targetCompany, setTargetCompany] = useState(profile.targetCompany);
  const [baselineStage, setBaselineStage] = useState(() => baselineStageFor(profile.preparationOnboarding.stage));
  const [baselineChoice, setBaselineChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [touchPresentation, setTouchPresentation] = useState(false);
  const [lightweightAvatar, setLightweightAvatar] = useState(false);
  const visible = mounted;
  const {
    state: voiceState,
    speak: speakLine,
    stop: stopVoice,
    awaitingGesture,
    setAwaitingGesture
  } = useMayaVoice();
  const speaking = voiceState === "speaking";
  const warmVoice = useCallback((line: string) => {
    if (!line.trim()) return;
    const url = voiceUrl(line, teacher.id);
    if (voicePreloads.current.has(url)) return;

    const warm = new Audio(url);
    warm.preload = "auto";
    voicePreloads.current.set(url, warm);
    warm.load();

    // Keep the immediate upcoming lines alive long enough to finish loading,
    // without retaining every audio element from a long onboarding session.
    if (voicePreloads.current.size > 3) {
      const oldestUrl = voicePreloads.current.keys().next().value;
      if (oldestUrl) {
        const oldest = voicePreloads.current.get(oldestUrl);
        oldest?.pause();
        oldest?.removeAttribute("src");
        voicePreloads.current.delete(oldestUrl);
      }
    }
  }, [teacher.id]);
  const resume = profile.resume;
  const firstName = resume?.fullName.trim().split(/\s+/)[0] || "there";
  const topEvidence = resume?.experience[0]
    ? `${resume.experience[0].role || "your work"} at ${resume.experience[0].organization}`
    : resume?.projects[0]?.name || profile.headline || "your resume evidence";

  const slides = useMemo(() => {
    const baseTargetCopy = TARGET_SETUP_COPY[targetStage] ?? TARGET_SETUP_COPY[0];
    const targetCopy = targetStage === 0
      ? {
          ...baseTargetCopy,
          body: profile.preparationOnboarding.stage === "target_role"
            ? `${targetRoleLabel(resumeSuggestedRole)} is our best guess from your resume. You can change it before the assessment.`
            : `${targetRoleLabel(targetRole)} is your saved preparation track. You can change it before the assessment.`
        }
      : baseTargetCopy;
    return [
      {
        eyebrow: "Background understood",
        title: `Hi ${firstName}, I’m ${teacher.name}.`,
        body: `I’ve looked through your background, including ${topEvidence} and ${resume?.skills.length ?? 0} supported skills. Now let’s make sure I’m preparing you for the right job.`,
        icon: Check
      },
      { ...targetCopy, icon: Target }
    ];
  }, [firstName, profile.preparationOnboarding.stage, resume?.skills.length, resumeSuggestedRole, targetRole, targetStage, teacher.name, topEvidence]);

  const activeBaselineSection = baselineStage && baselineStage !== "intro" && baselineStage !== "completed"
    ? baselineStage
    : null;
  const activeBaselineQuestion = useMemo(
    () => activeBaselineSection
      ? onboarding.questions[activeBaselineSection] ?? null
      : null,
    [activeBaselineSection, onboarding.questions]
  );
  const baselineSlide = useMemo(() => {
    if (baselineStage === "intro") {
      return {
        eyebrow: `Short baseline · ${BASELINE_DURATION_LABEL}`,
        title: "Let’s find your starting point.",
        body: targetRole === "ai-ml"
          ? "This is not about measuring everything today. A stack-aware technical pulse, an engineering scenario, and one architecture decision are enough for a useful starting picture."
          : "This is not about measuring everything today. A short DSA pulse, a stack-aware technical pulse, an engineering scenario, and one architecture decision are enough for a useful starting picture.",
        icon: Target
      };
    }
    if (baselineStage === "completed") {
      return {
        eyebrow: "First Skill Profile",
        title: "We have your first evidence.",
        body: "This is a starting picture, not a readiness verdict. Trailgrad will earn real scores from your future practice and interviews—not invent them today.",
        icon: Check
      };
    }
    if (activeBaselineQuestion) {
      return {
        eyebrow: "",
        title: activeBaselineQuestion.title,
        body: "",
        voiceText: `${baselineQuestionTeacherCue(activeBaselineQuestion.section, onboarding.questionIds[activeBaselineQuestion.section])} ${activeBaselineQuestion.prompt}`,
        icon: activeBaselineQuestion.section.startsWith("dsa-") ? Braces : activeBaselineQuestion.section.startsWith("technical-") ? Code2 : activeBaselineQuestion.section === "architecture" ? Blocks : Cpu
      };
    }
    return null;
  }, [activeBaselineQuestion, baselineStage, onboarding.questionIds, targetRole]);
  const current = baselineSlide ?? slides[step] ?? slides[0] ?? FALLBACK_WELCOME_SLIDE;
  const titleReveal = useWordReveal(current.title, visible, 160);
  const bodyReveal = useWordReveal(
    current.body,
    visible,
    640,
    touchPresentation ? 0 : WELCOME_BODY_STAGGER_MS
  );

  useEffect(() => () => {
    for (const element of voicePreloads.current.values()) {
      element.pause();
      element.removeAttribute("src");
    }
    voicePreloads.current.clear();
  }, []);

  const dismiss = useCallback(
    (destination = "/") => {
      if (blocking) return;
      stopVoice();
      window.location.replace(destination);
    },
    [blocking, stopVoice]
  );

  useEffect(() => {
    if (!activeBaselineSection) return;
    const answer = onboarding.answers[activeBaselineSection];
    setBaselineChoice(answer?.choiceId ?? "");
  }, [activeBaselineSection, onboarding.answers]);

  useEffect(() => {
    const profile = readWelcomePerformanceProfile();
    setTouchPresentation(profile.touchPresentation);
    setLightweightAvatar(profile.lightweightAvatar);
    setMounted(true);
  }, []);

  useEffect(() => {
    // The workspace scrolls the document, and locking <body> alone left the
    // page drifting behind the dialog, taking the app header with it.
    const root = document.documentElement;
    const previous = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blocking) dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previous.root;
      document.body.style.overflow = previous.body;
      stopVoice();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, stopVoice]);

  // Narrates the opening slide on arrival, then every slide the candidate
  // advances to, until they mute her.
  useEffect(() => {
    if (!visible || !voiceEnabled.current || awaitingGesture || !current) return;

    // Unlocking and advancing arrive as two separate events (pointerdown then
    // click), so settle for a beat and speak only the slide that survives.
    const start = window.setTimeout(() => {
      void speakLine(slideVoiceText(current));
    }, 60);
    return () => window.clearTimeout(start);
  }, [awaitingGesture, current, speakLine, visible]);

  // Warm the next slide's audio while this one plays: by the time Continue is
  // pressed the file is already in the browser cache.
  useEffect(() => {
    if (!visible || touchPresentation) return;
    const next = slides[step + 1];
    if (!next) return;
    warmVoice(slideVoiceText(next));
  }, [slides, step, touchPresentation, visible, warmVoice]);

  // Target setup changes the copy within the same slide, so the generic
  // slide preloader above cannot see its next prompt. Start fetching the next
  // prompt as soon as the current choice screen opens; the candidate normally
  // spends a few seconds deciding, which hides the voice generation time.
  useEffect(() => {
    if (!visible || touchPresentation || step !== 1) return;
    const nextTarget = TARGET_SETUP_COPY[targetStage + 1];
    if (!nextTarget) return;

    warmVoice(`${nextTarget.title} ${nextTarget.body}`);
  }, [step, targetStage, touchPresentation, visible, warmVoice]);

  // Baseline questions are selected before the assessment begins, so their
  // exact scripts are known. Preload the first one on the intro and each next
  // one while the candidate reads the current question.
  useEffect(() => {
    if (!visible || touchPresentation) return;
    const nextSection = baselineStage === "intro"
      ? firstBaselineSection(targetRole)
      : activeBaselineSection
        ? nextBaselineSection(activeBaselineSection)
        : null;
    if (!nextSection) return;

    const nextQuestion = onboarding.questions[nextSection];
    if (!nextQuestion) return;
    warmVoice(`${baselineQuestionTeacherCue(nextSection, onboarding.questionIds[nextSection])} ${nextQuestion.prompt}`);
  }, [activeBaselineSection, baselineStage, onboarding.questionIds, onboarding.questions, targetRole, touchPresentation, visible, warmVoice]);

  // Releasing the lock is all this does: the effect above then speaks whichever
  // slide is current, so a gesture that also advances the slide narrates the
  // new one rather than both.
  useEffect(() => {
    if (!awaitingGesture) return;

    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture]);

  useEffect(() => {
    const node = contentScrollRef.current;
    if (!node) return;

    userControlledScroll.current = false;
    node.scrollTo({ top: 0 });

    const timer = window.setTimeout(() => {
      if (userControlledScroll.current) return;
      const hiddenContent = node.scrollHeight - node.clientHeight;
      if (hiddenContent <= 24) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollTo({
        top: hiddenContent,
        behavior: reducedMotion ? "auto" : "smooth"
      });
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [baselineStage, step, targetStage, visible]);

  function toggleVoice() {
    if (!current) return;
    if (voiceState === "speaking" || voiceState === "loading") {
      voiceEnabled.current = false;
      setAwaitingGesture(false);
      stopVoice();
      return;
    }
    voiceEnabled.current = true;
    void speakLine(slideVoiceText(current));
  }

  async function advanceTargetSetup() {
    const nextStage = nextTargetStage(targetStage);
    if (!nextStage) return;

    setSaving(true);
    setTargetError(null);
    try {
      const result = await advancePreparationTarget({
        targetRole,
        level: storedLevel(targetLevel, profile.level),
        targetCompany: targetCompany.trim(),
        targetDate: dateForTimeline(targetTimeline),
        nextStage
      });
      setOnboarding(result.state);
      if (nextStage === "baseline_intro") {
        setBaselineStage("intro");
      } else {
        setTargetStage(targetStageFor(result.state.stage));
      }
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "Your target could not be saved. Nothing else changed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function beginBaseline() {
    setSaving(true);
    setTargetError(null);
    try {
      const result = await startPreparationBaseline();
      setOnboarding(result.state);
      setBaselineStage(baselineStageFor(result.state.stage));
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "The baseline could not start. Your target setup is still saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveBaselineAnswer() {
    if (!activeBaselineSection || !baselineChoice) return;

    setSaving(true);
    setTargetError(null);
    try {
      const result = await submitPreparationBaseline({
        section: activeBaselineSection,
        choiceId: baselineChoice
      });
      setOnboarding(result.state);
      setBaselineStage(baselineStageFor(result.state.stage));
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "That answer could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function finishPreparationOnboarding() {
    stopVoice();
    window.location.replace("/");
  }

  if (!visible || !mounted || !current) return null;
  const Icon = current.icon;
  const baselineResponseReady = Boolean(baselineChoice);

  // Rendered into <body>: the workspace wraps pages in `relative z-10`, which
  // traps any z-index inside it underneath the app header.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maya-welcome-title"
      data-workspace-accent={profile.workspaceAccent}
      className="maya-welcome-backdrop workspace-black fixed inset-0 z-[90] grid place-items-center overflow-x-clip bg-black p-3 sm:p-6"
    >
      <span
        aria-hidden
        className="maya-welcome-ambient pointer-events-none absolute left-[18%] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-15 blur-[140px]"
      />
      <span
        aria-hidden
        className="maya-welcome-ambient pointer-events-none absolute right-[15%] top-[38%] h-[22rem] w-[22rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-15 blur-[150px]"
      />
      {/* Rows on small screens: the avatar takes a capped share and the copy
          scrolls, so a short phone never clips the slide or its buttons. */}
      <section className="maya-welcome-panel route-enter relative grid min-w-0 h-[min(46rem,calc(100svh-1.5rem))] w-[min(100%,72rem)] max-w-full grid-rows-[minmax(12rem,30svh)_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[rgba(27,28,32,0.62)] shadow-[0_32px_90px_-54px_rgba(0,0,0,0.92)] backdrop-blur-2xl sm:grid-rows-[minmax(16rem,34svh)_minmax(0,1fr)] md:h-[min(43rem,calc(100svh-2rem))] md:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] md:grid-rows-1">
        {!blocking ? (
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={`Close ${teacher.name} introduction`}
            className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center text-cream/55 transition hover:text-cream sm:right-5 sm:top-5"
          >
            ×
          </button>
        ) : null}

        <div className="relative z-10 min-h-0 overflow-hidden bg-white/[0.012]">
          <div className="hidden">
            <TechInterviewMotifs side="maya" />
          </div>
          {lightweightAvatar ? (
            <Image
              src={teacher.portrait}
              alt={`${teacher.name}, your Trailgrad teacher`}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 36rem"
              className="object-cover object-top"
            />
          ) : (
            <AvatarStage
              agentTrack={null}
              state={speaking ? "speaking" : "listening"}
              url={teacher.model}
              rig={teacher.rig}
              performanceProfile="welcome"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(17,18,20,0.7)] to-transparent" />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceLabel(voiceState, teacher.name)}
            aria-pressed={speaking}
            title={voiceLabel(voiceState, teacher.name)}
            className={[
              "absolute bottom-3 left-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_12px_32px_rgba(0,0,0,0.34)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)] sm:bottom-5 sm:left-5",
              awaitingGesture
                ? "animate-pulse border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-white"
                : "border-white/15 bg-black/65 text-cream/78 hover:bg-black/80 hover:text-cream"
            ].join(" ")}
          >
            {voiceState === "loading" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : speaking ? (
              <VolumeX size={17} />
            ) : (
              <Volume2 size={17} />
            )}
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-transparent px-5 pb-5 pt-5 sm:px-10 sm:pb-8 sm:pt-8 lg:px-14 lg:pb-9 lg:pt-10">
          <div className="hidden">
            <TechInterviewMotifs side="copy" />
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2.5 pr-12">
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  index === welcomeProgressIndex(step, targetStage, baselineStage)
                    ? "workspace-accent-dot w-12"
                    : "w-6 bg-cream/25"
                ].join(" ")}
              />
            ))}
          </div>

          <div
            ref={contentScrollRef}
            onTouchStart={() => {
              userControlledScroll.current = true;
            }}
            onWheel={() => {
              userControlledScroll.current = true;
            }}
            className="no-scrollbar relative z-10 -mx-1 min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto px-1"
          >
            <div
              key={`${step}-${targetStage}`}
              className="step-in flex min-h-full min-w-0 max-w-full flex-col justify-center py-4 sm:py-8 lg:py-12"
            >
              <Icon
                size={64}
                strokeWidth={1.25}
                className="hidden text-[var(--workspace-accent)] min-[360px]:block sm:size-16"
                aria-hidden="true"
              />
              {current.eyebrow ? (
                <p className="blueprint-label text-cream/45 min-[360px]:mt-4 sm:mt-5 lg:mt-7">
                  {current.eyebrow}
                </p>
              ) : null}
              <h1
                id="maya-welcome-title"
                className={`display-heading ${current.eyebrow ? "mt-3 sm:mt-4" : "mt-5 sm:mt-6"} max-w-2xl text-[2.15rem] leading-[1.03] text-cream sm:text-[3rem]`}
              >
                <WordRevealLine words={titleReveal.words} visibleCount={titleReveal.visibleCount} />
              </h1>
              {current.body ? (
                <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-cream/78 sm:text-lg sm:leading-8">
                  <WordRevealLine
                    words={bodyReveal.words}
                    visibleCount={bodyReveal.visibleCount}
                    wordClassName="maya-welcome-copy-word"
                  />
                </p>
              ) : null}
              {step === 1 && baselineStage === null ? (
                <div className="mt-7 max-w-2xl">
                  {targetStage === 0 ? (
                    <TargetChoiceGrid
                      options={TARGET_ROLE_OPTIONS}
                      value={targetRole}
                      onChange={setTargetRole}
                    />
                  ) : null}
                  {targetStage === 1 ? (
                    <TargetChoiceGrid
                      options={TARGET_LEVEL_OPTIONS}
                      value={targetLevel}
                      onChange={setTargetLevel}
                      columns="three"
                    />
                  ) : null}
                  {targetStage === 2 ? (
                    <TargetChoiceGrid
                      options={TARGET_TIMELINE_OPTIONS}
                      value={targetTimeline}
                      onChange={setTargetTimeline}
                    />
                  ) : null}
                  {targetStage === 3 ? (
                    <PreparationAreaGrid role={targetRole} />
                  ) : null}
                  {targetStage === 4 ? (
                    <div>
                      <label htmlFor="target-company" className="flex items-center gap-2 text-base font-semibold text-cream">
                        <Building2 size={17} className="text-[var(--workspace-accent)]" aria-hidden="true" />
                        Company name <span className="font-normal text-cream/45">Optional</span>
                      </label>
                      <input
                        id="target-company"
                        value={targetCompany}
                        onChange={(event) => setTargetCompany(event.target.value)}
                        maxLength={100}
                        placeholder="e.g. Stripe, Google, or your dream team"
                        className="mt-4 h-12 w-full rounded-lg border border-cream/15 bg-black/25 px-3.5 text-base text-cream outline-none transition placeholder:text-cream/35 focus:border-[var(--workspace-accent)] focus:ring-2 focus:ring-[var(--workspace-accent-soft)]"
                      />
                      <p className="mt-3 text-sm leading-6 text-cream/55">
                        No company in mind is completely fine. Your preparation will still be tailored to your role and level.
                      </p>
                    </div>
                  ) : null}
                  {targetError ? (
                    <p role="alert" className="mt-4 text-sm font-medium text-[#ffb8c3]">
                      {targetError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {baselineStage === "intro" ? <BaselineIntro role={targetRole} /> : null}
              {activeBaselineQuestion ? (
                <BaselineQuestionCard
                  question={activeBaselineQuestion}
                  choiceId={baselineChoice}
                  onChoice={setBaselineChoice}
                />
              ) : null}
              {baselineStage === "completed" ? <InitialSkillProfile state={onboarding} role={targetRole} /> : null}
              {baselineStage !== null && targetError ? (
                <p role="alert" className="mt-4 text-sm font-medium text-[#ffb8c3]">
                  {targetError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 border-t border-cream/[0.1] pt-4 sm:items-center sm:pt-5">
            <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
              {step === 1 && baselineStage === null ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setTargetError(null);
                    if (targetStage === 0) setStep(0);
                    else setTargetStage((stage) => stage - 1);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/80 transition hover:border-cream/35 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || Boolean(activeBaselineQuestion && !baselineResponseReady)}
                onClick={() => {
                  if (step === 0) {
                    setStep(1);
                    return;
                  }
                  if (baselineStage === "intro") {
                    void beginBaseline();
                    return;
                  }
                  if (activeBaselineQuestion) {
                    void saveBaselineAnswer();
                    return;
                  }
                  if (baselineStage === "completed") {
                    finishPreparationOnboarding();
                    return;
                  }
                  void advanceTargetSetup();
                }}
                className="browse-nudge inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#f5f3ef] px-5 text-sm font-semibold text-[#17181b] shadow-[0_18px_44px_-26px_rgba(245,243,239,0.22)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
              >
                {saving ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving your progress</>
                ) : step === 0 ? (
                  <>Set my target <ArrowRight size={15} /></>
                ) : baselineStage === "intro" ? (
                  <>Start baseline <ArrowRight size={15} /></>
                ) : activeBaselineQuestion ? (
                  <>Save and continue <ArrowRight size={15} /></>
                ) : baselineStage === "completed" ? (
                  <>Build my preparation <ArrowRight size={15} /></>
                ) : targetStage === TARGET_SETUP_COPY.length - 1 ? (
                  <>Continue to baseline <ArrowRight size={15} /></>
                ) : (
                  <>Continue <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function voiceLabel(state: VoiceState, teacherName: string): string {
  return {
    idle: `Hear ${teacherName}`,
    loading: "Loading voice",
    speaking: "Stop voice",
    // A failed line is usually a blip, so the control stays live to retry.
    unavailable: "Retry voice"
  }[state];
}

function slideVoiceText(slide: { title: string; body: string; voiceText?: string }): string {
  return slide.voiceText ?? `${slide.title} ${slide.body}`;
}

function targetStageFor(stage: PreparationOnboardingStage): number {
  if (stage === "target_level") return 1;
  if (stage === "target_timeline") return 2;
  if (stage === "preparation_areas") return 3;
  if (stage === "target_company") return 4;
  return 0;
}

function nextTargetStage(stage: number): PreparationOnboardingStage | null {
  const next = [
    "target_level",
    "target_timeline",
    "preparation_areas",
    "target_company",
    "baseline_intro"
  ] as const;
  return next[stage] ?? null;
}

function baselineStageFor(stage: PreparationOnboardingStage): BaselineFlowStage {
  if (stage === "baseline_intro") return "intro";
  const sections: Record<Exclude<BaselineFlowStage, "intro" | "completed" | null>, PreparationOnboardingStage> = {
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
  const matchingSection = (Object.entries(sections) as Array<[BaselineSection, PreparationOnboardingStage]>).find(([, value]) => value === stage)?.[0];
  if (matchingSection) return matchingSection;
  if (stage === "completed") return "completed";
  return null;
}

function welcomeProgressIndex(step: number, targetStage: number, baselineStage: BaselineFlowStage): number {
  if (baselineStage === "intro") return 6;
  if (baselineStage?.startsWith("dsa-")) return 7;
  if (baselineStage?.startsWith("technical-")) return 8;
  if (baselineStage === "engineering" || baselineStage === "architecture" || baselineStage === "completed") return 9;
  return step === 0 ? 0 : targetStage + 1;
}

function dsaStartingStateLabel(state: NonNullable<PreparationOnboardingState["skillProfile"]>["signals"][number]["startingState"]): string {
  return {
    "experienced-active": "Experienced / Active",
    "experienced-rusty": "Experienced / Rusty",
    "some-familiarity": "Some familiarity",
    "needs-foundations": "Needs foundations",
    unknown: "Still getting a read"
  }[state ?? "unknown"];
}

function targetRoleLabel(role: Role): string {
  return {
    frontend: "Frontend",
    backend: "Backend",
    fullstack: "Full Stack",
    data: "Data Engineering",
    "ai-ml": "AI / ML Engineering",
    pm: "Full Stack"
  }[role];
}

function levelTarget(level: Level | null): TargetLevel {
  if (level === "3-5") return "mid";
  if (level === "5-plus") return "senior";
  return "entry";
}

function storedLevel(value: TargetLevel, prior: Level | null): Level {
  if (value === "entry") return prior === "fresher" ? "fresher" : "0-2";
  return value === "mid" ? "3-5" : "5-plus";
}

function timelineTarget(dateValue: string | null): TargetTimeline {
  if (!dateValue) return "none";

  const date = new Date(`${dateValue}T12:00:00`);
  const days = Math.max(0, Math.round((date.getTime() - Date.now()) / 86_400_000));
  if (days < 14) return "two-weeks";
  if (days <= 28) return "two-to-four-weeks";
  if (days <= 92) return "one-to-three-months";
  return "three-to-six-months";
}

function dateForTimeline(value: TargetTimeline): string | null {
  const days = {
    "two-weeks": 14,
    "two-to-four-weeks": 28,
    "one-to-three-months": 90,
    "three-to-six-months": 180,
    none: 0
  }[value];
  if (!days) return null;

  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
