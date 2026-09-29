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

  return (
    <main
      className="interview-setup-skeleton min-h-[100svh] bg-[#f8f7f5] px-6 py-10 dark:bg-black sm:px-10 lg:px-16"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-3xl animate-pulse">
        <div className="mx-auto h-14 w-56 rounded-2xl bg-white/[0.06]" />
        <div className="mt-24">
          <span className="block h-3 w-16 rounded-full bg-white/[0.06]" />
          <span className="mt-5 block h-11 w-3/4 max-w-xl rounded-xl bg-white/[0.06]" />
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="h-24 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
