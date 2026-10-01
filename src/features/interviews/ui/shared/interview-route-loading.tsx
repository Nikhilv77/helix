"use client";

import { usePathname } from "next/navigation";
import { PreparingInterviewScreen } from "@/features/interviews/ui/voice/components/preparing-interview-screen";

/**
 * Loading state for everything under /interview. Moving from a launch page to
 * the voice room swaps a child of /interview, so this boundary (not the voice
 * route's own) is what shows. The room gets the "Preparing your interview"
 * screen it is about to render; launch pages keep their layout skeleton.
 */
export function InterviewRouteLoading() {
  const pathname = usePathname();
  if (pathname?.startsWith("/interview/voice")) return <PreparingInterviewScreen />;

  // Mirrors InterviewLaunchStage: the teacher's space on the left, the
  // briefing on the right, so the page settles in place instead of swapping
  // layouts.
  return (
    <main
      className="interview-setup-skeleton min-h-[100svh] bg-[#f8f7f5] px-6 py-10 dark:bg-black sm:px-10 lg:px-16"
      aria-busy="true"
      aria-label="Preparing your interview"
    >
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        {/* The teacher's space stays empty until the portrait loads. */}
        <div aria-hidden="true" className="min-h-[25rem] lg:min-h-[34rem]" />

        <div className="py-8 motion-safe:animate-pulse lg:py-12" aria-hidden="true">
          <span className="block h-3 w-28 rounded-full bg-white/[0.07]" />
          <span className="mt-5 block h-7 w-4/5 max-w-xl rounded-lg bg-white/[0.07]" />
          <div className="mt-7 max-w-2xl space-y-3">
            <span className="block h-4 w-full rounded-full bg-white/[0.05]" />
            <span className="block h-4 w-11/12 rounded-full bg-white/[0.05]" />
            <span className="block h-4 w-full rounded-full bg-white/[0.05]" />
            <span className="block h-4 w-2/3 rounded-full bg-white/[0.05]" />
          </div>
          <div className="mt-10 flex items-center gap-6">
            <span className="block h-10 w-44 rounded-full bg-white/[0.07]" />
            <span className="block h-4 w-24 rounded-full bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </main>
  );
}
