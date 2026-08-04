"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bug,
  Clock3,
  Compass,
  Flame,
  Gauge,
  Handshake,
  Layers,
  LineChart,
  Sparkles,
  Target,
  UserRoundCheck,
  Users
} from "lucide-react";
import {
  INTERVIEW_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type InterviewTemplate,
  type TemplateCategory
} from "@/lib/interview-templates";
import type { Level, Role } from "@/lib/types";

const templateIcons: Record<string, typeof Target> = {
  "defend-projects": Layers,
  "explain-your-role": UserRoundCheck,
  "system-design": Compass,
  "own-a-failure": Flame,
  "prove-your-impact": LineChart,
  "debug-under-pressure": Bug,
  "hiring-manager": Users,
  "disagree-and-commit": Handshake,
  "lead-without-authority": Sparkles,
  "code-fundamentals": Gauge,
  "product-sense": Target,
  "warm-up": Clock3
};

const categoryTone: Record<TemplateCategory, { chip: string; icon: string }> = {
  behavioral: {
    chip: "bg-cream/[0.12] text-cream/75",
    icon: "bg-cream/[0.14] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
  },
  technical: {
    chip: "bg-[#7ea0ff]/18 text-[#c3d3ff]",
    icon: "bg-[#7ea0ff]/22 text-[#cfdcff] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
  },
  leadership: {
    chip: "bg-[#71d6a5]/16 text-[#b5efd2]",
    icon: "bg-[#71d6a5]/22 text-[#a9f0cd] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
  }
};

interface TemplateGridProps {
  role: Role | null;
  level: Level | null;
  /** Disables launching when the daily quota is spent. */
  locked?: boolean;
}

export function InterviewTemplateGrid({ role, level, locked = false }: TemplateGridProps) {
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const templates = useMemo(() => {
    const relevant = INTERVIEW_TEMPLATES.filter(
      (template) => !template.roles || !role || template.roles.includes(role)
    );
    return category === "all"
      ? relevant
      : relevant.filter((template) => template.category === category);
  }, [category, role]);

  return (
    <section id="templates" className="mt-10 scroll-mt-20 lg:scroll-mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="blueprint-label text-cream/35">Choose a round</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
            What should Maya press on?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/45">
            Each round has a fixed agenda. Pick one and the whole interview stays on it.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter rounds"
          className="thin-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </FilterChip>
          {TEMPLATE_CATEGORIES.map((item) => (
            <FilterChip
              key={item.id}
              active={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            role={role}
            level={level}
            locked={locked}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  template,
  role,
  level,
  locked
}: {
  template: InterviewTemplate;
  role: Role | null;
  level: Level | null;
  locked: boolean;
}) {
  const Icon = templateIcons[template.id] ?? Target;
  const tone = categoryTone[template.category];
  const params = new URLSearchParams({ template: template.id });
  if (role) params.set("role", role);
  if (level) params.set("level", level);

  return (
    <Link
      href={locked ? "#" : `/interview?${params.toString()}`}
      aria-disabled={locked}
      className={[
        "surface group relative flex flex-col overflow-hidden p-5 outline-none",
        locked
          ? "pointer-events-none opacity-40"
          : "surface-interactive focus-visible:ring-2 focus-visible:ring-cream/60"
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
          <Icon size={18} />
        </span>
        <span className="pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-cream/50">
          <Clock3 size={11} /> {template.minutes} min
        </span>
      </div>

      <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-cream">{template.title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-cream/45">{template.blurb}</p>

      <ul className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-4">
        {template.agenda.slice(0, 2).map((item) => (
          <li key={item} className="flex gap-2.5 text-[11px] leading-5 text-cream/42">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cream/35" />
            <span className="line-clamp-2">{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${tone.chip}`}
        >
          {template.category}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cream/55 transition group-hover:text-cream">
          Start
          <ArrowUpRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-3.5 py-2 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cream/50",
        active
          ? "bg-cream text-blueprint"
          : "pill text-cream/60 hover:bg-white/[0.12] hover:text-cream"
      ].join(" ")}
    >
      {children}
    </button>
  );
}
