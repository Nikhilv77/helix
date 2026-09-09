"use client";

import { ArrowLeft } from "lucide-react";
import { InterviewSignal } from "@/components/brand/blueprint-art";

export function BlueprintBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <InterviewSignal className="absolute left-1/2 top-8 hidden h-[32rem] w-[42rem] -translate-x-1/2 text-[#F26E01] opacity-[0.07] sm:block" />
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
