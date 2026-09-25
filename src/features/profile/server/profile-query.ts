import { cache } from "react";

import { getAppContainer } from "@/server/app-container";

/** Reuse the full profile row across server components in one render request. */
export const getProfileForRequest = cache(async (ownerId: string) =>
  getAppContainer().profileService.get(ownerId)
);

/** Share the small shell/onboarding projection with pages in the same request. */
export const getWorkspaceShellStateForRequest = cache(async (ownerId: string) =>
  getAppContainer().profileService.workspaceShellState(ownerId)
);

/** Manage can share its compact settings projection with the workspace shell. */
export const getManageAccountStateForRequest = cache(async (ownerId: string) =>
  getAppContainer().profileService.manageAccountState(ownerId)
);
