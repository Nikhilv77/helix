"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_EVERY_MS = 4_000;
/** About two minutes: long enough for end-of-round grading, short enough to stop on a stuck job. */
const MAX_REFRESHES = 30;

/**
 * Live rounds are graded just after they end, so the newest report can open
 * before every answer has a score. Re-read the page until the scores are in.
 */
export function ReportsAutoRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    let refreshes = 0;
    const timer = window.setInterval(() => {
      refreshes += 1;
      if (refreshes > MAX_REFRESHES || document.visibilityState !== "visible") {
        if (refreshes > MAX_REFRESHES) window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [pending, router]);

  return pending ? (
    <p className="mb-4 text-center text-sm text-cream/58" role="status">
      A few answers are still being scored. This page updates by itself.
    </p>
  ) : null;
}
