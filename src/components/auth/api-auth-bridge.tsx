"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { setAuthTokenProvider } from "@/lib/api-client";

export function ApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setAuthTokenProvider(null);
      return;
    }

    setAuthTokenProvider(() => getToken());

    return () => setAuthTokenProvider(null);
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
