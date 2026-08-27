export const WORKSPACE_SEARCH_GROUPS = [
  "Questions",
  "Practice",
  "Interviews",
  "Your work",
  "Pages"
] as const;

export type WorkspaceSearchGroup = (typeof WORKSPACE_SEARCH_GROUPS)[number];
export type WorkspaceSearchKind = "question" | "practice" | "interview" | "note" | "page";

export interface WorkspaceSearchResult {
  id: string;
  kind: WorkspaceSearchKind;
  group: WorkspaceSearchGroup;
  title: string;
  description: string;
  href: string;
  badge: string | null;
  score: number;
}

export interface WorkspaceSearchResponse {
  query: string;
  results: WorkspaceSearchResult[];
}
