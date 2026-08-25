"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { reconcileInterviewOwner } from "@/lib/api/api-client";

/**
 * Repairs a layout that rendered without the workspace chrome.
 *
 * The root layout decides on the server whether to render the sidebar, and
 * Next reuses layouts across client-side navigation. If that one render
 * happened before the session resolved, every later page kept the shell-less
 * layout — the sidebar simply never came back until a hard reload.
 *
 * Mounted only on the signed-out branch: if Clerk reports a signed-in user
 * there, the server and client disagree, so refetch the layout once.
 */
export function AuthSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const repaired = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || repaired.current) return;
    // Once only — a refresh that does not resolve it must not become a loop.
    repaired.current = true;
    void reconcileInterviewOwner()
      .catch(() => undefined)
      .finally(() => router.refresh());
  }, [isLoaded, isSignedIn, router]);

  return null;
}
