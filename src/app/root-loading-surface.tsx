"use client";

import { useSearchParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardSkeleton } from "@/features/dashboard/ui/overview/dashboard-skeleton";
import { PreparationWelcomeLoading } from "@/features/preparation-onboarding/ui/preparation-welcome-loading";

/**
 * Picks the loader from the browser's destination URL rather than request
 * headers, which can still describe the previous route during navigation.
 * Finishing onboarding goes to `/?welcome=<teacher>`, whose page is the dark
 * teacher introduction; its own blank loader avoids flashing a dashboard
 * skeleton that the learner never actually sees. Plain "/" is the Overview.
 */
export function RootLoadingSurface({ fallback }: { fallback: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/" && searchParams.has("welcome")) return <PreparationWelcomeLoading />;
  // Signed in, "/" is the Overview, so show its own four-row skeleton. For the
  // public home page the theme script's lock hides it (see globals.css).
  if (pathname === "/") return <DashboardSkeleton />;
  return fallback;
}
