import {
  BarChart3,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  Code2,
  Database,
  MessageCircle,
  PackageCheck,
  Quote,
  Target
} from "lucide-react";
import type { Level, Role } from "@/lib/shared/types";

export const roleOptions: Array<{ value: Role; label: string; detail: string; icon: typeof Code2 }> = [
  { value: "backend", label: "Backend", detail: "APIs, data, reliability", icon: Database },
  { value: "frontend", label: "Frontend", detail: "UI systems, state, performance", icon: Code2 },
  { value: "fullstack", label: "Full-stack", detail: "Product systems end to end", icon: Blocks },
  { value: "data", label: "Data", detail: "Pipelines, analytics, platforms", icon: BarChart3 },
  {
    value: "ai-ml",
    label: "AI / ML",
    detail: "Models, evaluation, production",
    icon: BrainCircuit
  },
  { value: "pm", label: "Product", detail: "Strategy, discovery, execution", icon: PackageCheck }
];

export const levelOptions: Array<{ value: Level; label: string; detail: string }> = [
  { value: "fresher", label: "Fresher", detail: "Student or first role" },
  { value: "0-2", label: "0–2 years", detail: "Early career" },
  { value: "3-5", label: "3–5 years", detail: "Owns meaningful scope" },
  { value: "5-plus", label: "5+ years", detail: "Leads systems or teams" }
];

export const focusOptions = [
  "Technical depth",
  "System design",
  "Coding",
  "Communication",
  "Ownership",
  "Impact",
  "Leadership",
  "Behavioral stories"
];

export const focusAreaDetails: Record<string, string> = {
  "Technical depth": "Explain tradeoffs, internals, and why your approach works.",
  "System design": "Turn vague requirements into practical architecture decisions.",
  Coding: "Solve cleanly, reason out loud, and keep edge cases visible.",
  Communication: "Make your thinking easy to follow under interview pressure.",
  Ownership: "Show scope, accountability, and how you moved work forward.",
  Impact: "Connect your work to outcomes, metrics, and product value.",
  Leadership: "Show judgment, leverage, and how you raised the team bar.",
  "Behavioral stories": "Defend real examples with situation, action, and result."
};

export const focusAreaIcons: Record<string, typeof Code2> = {
  "Technical depth": BrainCircuit,
  "System design": Blocks,
  Coding: Code2,
  Communication: MessageCircle,
  Ownership: BriefcaseBusiness,
  Impact: BarChart3,
  Leadership: Target,
  "Behavioral stories": Quote
};

/** One input treatment for the page, so nothing drifts field to field. */
export const fieldClass =
  "w-full rounded-xl bg-[#1a1b1f] text-cream outline-none ring-1 ring-inset ring-white/[0.08] transition placeholder:text-cream/35 hover:bg-[#202126] focus:bg-[#202126] focus:ring-2 focus:ring-[#F26E01]/30";

export const profileAvatars = [
  {
    src: "/images/profile/avatars/avatar-01.jpg",
    displaySrc: "/images/profile/avatars/avatar-01.jpg?v=7bc1f6d0",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-02.jpg",
    displaySrc: "/images/profile/avatars/avatar-02.jpg?v=8f147db2",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-03.jpg",
    displaySrc: "/images/profile/avatars/avatar-03.jpg?v=54f51d79",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-04.jpg",
    displaySrc: "/images/profile/avatars/avatar-04.jpg?v=62bce4f4",
    width: 1024,
    height: 1024
  },
  {
    src: "/images/profile/avatars/avatar-05.jpg",
    displaySrc: "/images/profile/avatars/avatar-05.jpg?v=bf8776bd",
    width: 1024,
    height: 1024
  }
] as const;

export const profileCovers = [
  {
    src: "/images/profile/covers/cover-1.png",
    displaySrc: "/images/profile/covers/cover-1.png?v=2441142822",
    width: 1809,
    height: 293
  },
  {
    src: "/images/profile/covers/cover-2.png",
    displaySrc: "/images/profile/covers/cover-2.png?v=1093722193",
    width: 1809,
    height: 256
  },
  {
    src: "/images/profile/covers/cover-3.png",
    displaySrc: "/images/profile/covers/cover-3.png?v=778074622",
    width: 1808,
    height: 264
  },
  {
    src: "/images/profile/covers/cover-4.png",
    displaySrc: "/images/profile/covers/cover-4.png?v=2319454375",
    width: 1809,
    height: 292
  },
  {
    src: "/images/profile/covers/cover-5.png",
    displaySrc: "/images/profile/covers/cover-5.png?v=3937398326",
    width: 1806,
    height: 266
  },
  {
    src: "/images/profile/covers/cover-6.png",
    displaySrc: "/images/profile/covers/cover-6.png?v=3544170912",
    width: 1803,
    height: 293
  },
  {
    src: "/images/profile/covers/cover-7.png",
    displaySrc: "/images/profile/covers/cover-7.png?v=1044505713",
    width: 1805,
    height: 273
  },
  {
    src: "/images/profile/covers/cover-8.png",
    displaySrc: "/images/profile/covers/cover-8.png?v=1232424449",
    width: 1806,
    height: 268
  }
] as const;

export function hashProfileSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}


export const statTones = {
  mint: "bg-[#71d6a5]/16 text-[#a9f0cd] ring-1 ring-inset ring-[#71d6a5]/28",
  sky: "bg-[#F26E01]/12 text-[#ffbd8f] ring-1 ring-inset ring-[#F26E01]/25",
  amber: "bg-[#efcf84]/16 text-[#f7e3ae] ring-1 ring-inset ring-[#efcf84]/30",
  cream: "bg-cream/[0.14] text-cream ring-1 ring-inset ring-cream/25"
} as const;
