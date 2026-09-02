"use client";

import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InterviewSignal } from "@/components/brand/blueprint-art";
import { CARD, CARD_INNER, INK, PRIMARY_BUTTON } from "../flow/onboarding-data";

export function BlueprintBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <InterviewSignal className="absolute left-1/2 top-8 hidden h-[32rem] w-[42rem] -translate-x-1/2 text-[#F26E01] opacity-[0.07] sm:block" />
    </div>
  );
}

export function StepHeader({
  icon,
  eyebrow,
  title,
  children
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon && eyebrow ? <Eyebrow icon={icon}>{eyebrow}</Eyebrow> : null}
      <h1
        className={[
          "onboarding-page-title display-heading max-w-4xl text-cream",
          icon && eyebrow ? "mt-6" : ""
        ].join(" ")}
      >
        {title}
      </h1>
      {children ? <p className="onboarding-lede mt-5 max-w-2xl text-cream/76">{children}</p> : null}
    </div>
  );
}

export function ContinueBar({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  return (
    <div className="mt-9 flex min-h-12 items-center justify-center">
      {visible ? (
        <button type="button" onClick={onContinue} className={`step-in ${PRIMARY_BUTTON}`}>
          Continue
          <ArrowRight
            size={15}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </button>
      ) : null}
    </div>
  );
}

export function AnalysisMetric({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className={["flex min-w-0 items-center gap-3.5 p-4", CARD].join(" ")}>
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: "rgba(242,110,1,0.08)", color: "#F26E01" }}
      >
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase text-cream/55">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold" style={{ color: INK }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Section shell for the evidence step: header glyph, title, and a count. */
export function EvidencePanel({
  icon: Icon,
  title,
  caption,
  count,
  children
}: {
  icon: LucideIcon;
  title: string;
  caption?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={["overflow-hidden", CARD].join(" ")}>
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: "rgba(242,110,1,0.08)", color: "#F26E01" }}
        >
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold tracking-tight" style={{ color: INK }}>
            {title}
          </p>
          {caption ? <p className="mt-0.5 text-[12.5px] text-cream/50">{caption}</p> : null}
        </div>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ backgroundColor: "rgba(242,110,1,0.08)", color: "#F26E01" }}
        >
          {count}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Shared empty state, so a thin resume still looks deliberate. */
export function EvidenceEmpty({
  icon: Icon,
  title,
  body
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className={["grid place-items-center px-6 py-10 text-center", CARD_INNER].join(" ")}>
      <div className="max-w-sm">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{ backgroundColor: "rgba(242,110,1,0.08)", color: "#F26E01" }}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-bold tracking-tight" style={{ color: INK }}>
          {title}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-cream/60">{body}</p>
      </div>
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mb-4 flex min-h-11 w-fit items-center gap-2 rounded-lg px-3 text-base font-medium text-cream/70 outline-none transition hover:bg-cream/10 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/60"
    >
      <ArrowLeft size={15} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-[#F26E01]/22 bg-[#F26E01]/[0.045] px-3.5 py-1.5 backdrop-blur-sm">
      <Icon size={14} className="text-[#F26E01]" aria-hidden="true" />
      <span className="blueprint-label whitespace-nowrap text-cream/80">{children}</span>
    </span>
  );
}
