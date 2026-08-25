import {
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trophy,
  type LucideIcon
} from "lucide-react";
import type { Level, Role } from "@/lib/shared/types";

/**
 * Onboarding shares the product's graphite canvas and restrained orange accent.
 */
export const ACCENT = "#F26E01";
export const INK = "#f3f1ec";

/** Neutral enterprise surface used for onboarding panels. */
export const CARD = "rounded-lg border border-white/[0.1] bg-[#191a1e]";
/** A quiet graphite inset surface for rows and tiles. */
export const CARD_INNER = "rounded-lg border border-white/[0.07] bg-[#121316]";

/** Marketing's primary: compact cream action with a soft blueprint glow. */
export const PRIMARY_BUTTON =
  "group inline-flex min-h-11 items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-[#f3f1ec] px-6 text-sm font-bold tracking-wide text-[#17181b] shadow-[0_18px_48px_-36px_rgba(0,0,0,0.9)] transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white";

/** Quiet companion to the primary: hairline, fills with cream on hover. */
export const SECONDARY_BUTTON =
  "ghost-button inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-semibold text-cream/70 hover:border-[#F26E01]/35 hover:text-cream";

export const roles: Array<{
  value: Role;
  label: string;
  detail: string;
  image: string;
}> = [
  {
    value: "frontend",
    label: "Frontend",
    detail: "Interfaces that stay fast, accessible and predictable under load.",
    image: "/images/domain-images/frontend-domain.png"
  },
  {
    value: "backend",
    label: "Backend",
    detail: "APIs and data layers that hold up when traffic gets serious.",
    image: "/images/domain-images/backend-domain.png"
  },
  {
    value: "fullstack",
    label: "Full-stack",
    detail: "The whole product, from interface state down to the database.",
    image: "/images/domain-images/fullstack-domain.png"
  },
  {
    value: "data",
    label: "Data",
    detail: "Pipelines that turn messy, untrusted data into decisions.",
    image: "/images/domain-images/data-domain.png"
  },
  {
    value: "ai-ml",
    label: "AI / ML",
    detail: "Models that survive production, not just the evaluation set.",
    image: "/images/domain-images/ai-ml-domain.png"
  },
  {
    value: "pm",
    label: "Product",
    detail: "Strategy and discovery turned into outcomes that actually shipped.",
    image: "/images/domain-images/pm-domain.png"
  }
];

export const levels: Array<{
  value: Level;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    value: "fresher",
    label: "Starting out",
    detail: "Student, intern, or first full-time role",
    icon: GraduationCap
  },
  {
    value: "0-2",
    label: "Early career",
    detail: "Up to 2 years of professional experience",
    icon: Sprout
  },
  {
    value: "3-5",
    label: "Mid-level",
    detail: "3–5 years with meaningful ownership",
    icon: BriefcaseBusiness
  },
  {
    value: "5-plus",
    label: "Senior+",
    detail: "5+ years leading systems or outcomes",
    icon: Trophy
  }
];

export const analysisStages = [
  { label: "Checking document integrity...", icon: ShieldCheck },
  { label: "Verifying identity and chronology...", icon: ScanSearch },
  { label: "Reading resume details...", icon: FileText },
  { label: "Finalizing verification...", icon: Sparkles }
];

export type Step = "teacher" | "level" | "resume" | "identity" | "evidence" | "readiness";

export const onboardingSteps: Array<{ value: Step; label: string }> = [
  { value: "teacher", label: "Teacher" },
  { value: "level", label: "Experience" },
  { value: "resume", label: "Resume" },
  { value: "identity", label: "Verification" },
  { value: "evidence", label: "Details" },
  { value: "readiness", label: "Ready" }
];

export const stepTitles: Record<Step, string> = {
  teacher: "Choose Your Teacher",
  level: "Experience Level",
  resume: "Upload Resume",
  identity: "Resume Ready",
  evidence: "Resume Details",
  readiness: "Profile Ready"
};

/** The server budget is 60s; give the network a little room beyond it. */
export const UPLOAD_TIMEOUT_MS = 75_000;
export const MIN_FILE_BYTES = 1_000;
export const MAX_FILE_BYTES = 6 * 1024 * 1024;

export function stepIndex(step: Step): number {
  return { teacher: 0, level: 1, resume: 2, identity: 3, evidence: 4, readiness: 5 }[step];
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
