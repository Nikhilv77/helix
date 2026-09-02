import { cache } from "react";

import { getAppContainer } from "@/server/app-container";

/** Reuse the full profile row across server components in one render request. */
export const getProfileForRequest = cache(async (ownerId: string) =>
  getAppContainer().profileService.get(ownerId)
);
