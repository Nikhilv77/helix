export const WORKSPACE_ACCENTS = ["ember", "azure", "violet", "emerald", "rose", "mono"] as const;

export type WorkspaceAccent = (typeof WORKSPACE_ACCENTS)[number];

export const DEFAULT_WORKSPACE_ACCENT: WorkspaceAccent = "ember";
export const WORKSPACE_ACCENT_CHANGE_EVENT = "trailgrad:workspace-accent";

export function isWorkspaceAccent(value: unknown): value is WorkspaceAccent {
  return typeof value === "string" && WORKSPACE_ACCENTS.includes(value as WorkspaceAccent);
}
