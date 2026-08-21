"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { ApiClientError, getProfile } from "@/lib/api/api-client";

export function ContinueClient() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function continueAfterAuth() {
      if (!isSignedIn) {
        window.location.replace("/");
        return;
      }

      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const profile = await getProfile();
          if (cancelled) return;
          window.location.replace(profile.onboardingCompletedAt ? "/" : "/onboarding");
          return;
        } catch (error) {
          if (cancelled) return;

          const canRetry = error instanceof ApiClientError && error.status === 401 && attempt < 7;

          if (!canRetry) {
            const destination =
              error instanceof ApiClientError && error.status === 401 ? "/" : "/onboarding";
            window.location.replace(destination);
            return;
          }

          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      }
    }

    void continueAfterAuth();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  return <main aria-label="Continuing to Trailgrad" className="onboarding-theme min-h-[100svh]" />;
}
