import type { WorkspaceSearchResponse } from "@/features/search/contracts/workspace-search";
import { apiRequest } from "@/lib/api/api-client";

export function searchWorkspace(
  query: string,
  signal?: AbortSignal
): Promise<WorkspaceSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return apiRequest<WorkspaceSearchResponse>(`/api/search?${params.toString()}`, { signal });
}
