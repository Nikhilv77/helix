export const WORKSPACE_ACCENTS = ["ember", "azure", "violet", "emerald", "rose", "mono"] as const;

export type WorkspaceAccent = (typeof WORKSPACE_ACCENTS)[number];

export const DEFAULT_WORKSPACE_ACCENT: WorkspaceAccent = "ember";
export const WORKSPACE_ACCENT_CHANGE_EVENT = "trailgrad:workspace-accent";

type WorkspaceAccentCssVariables = {
  "--workspace-accent": string;
  "--workspace-accent-soft": string;
  "--workspace-accent-border": string;
};

const WORKSPACE_ACCENT_CSS_VARIABLES: Record<WorkspaceAccent, WorkspaceAccentCssVariables> = {
  ember: {
    "--workspace-accent": "#f26e01",
    "--workspace-accent-soft": "rgba(242, 110, 1, 0.13)",
    "--workspace-accent-border": "rgba(242, 110, 1, 0.34)"
  },
  azure: {
    "--workspace-accent": "#4f8cff",
    "--workspace-accent-soft": "rgba(79, 140, 255, 0.13)",
    "--workspace-accent-border": "rgba(79, 140, 255, 0.36)"
  },
  violet: {
    "--workspace-accent": "#9b6dff",
    "--workspace-accent-soft": "rgba(155, 109, 255, 0.13)",
    "--workspace-accent-border": "rgba(155, 109, 255, 0.36)"
  },
  emerald: {
    "--workspace-accent": "#39d9a1",
    "--workspace-accent-soft": "rgba(57, 217, 161, 0.13)",
    "--workspace-accent-border": "rgba(57, 217, 161, 0.36)"
  },
  rose: {
    "--workspace-accent": "#f0528a",
    "--workspace-accent-soft": "rgba(240, 82, 138, 0.13)",
    "--workspace-accent-border": "rgba(240, 82, 138, 0.36)"
  },
  mono: {
    "--workspace-accent": "#d3d0c7",
    "--workspace-accent-soft": "rgba(211, 208, 199, 0.13)",
    "--workspace-accent-border": "rgba(211, 208, 199, 0.32)"
  }
};

export function isWorkspaceAccent(value: unknown): value is WorkspaceAccent {
  return typeof value === "string" && WORKSPACE_ACCENTS.includes(value as WorkspaceAccent);
}

/**
 * Supplies the saved accent in the server-rendered markup. This prevents
 * standalone interview screens from briefly inheriting the Ember fallback
 * while their route is streaming in.
 */
export function workspaceAccentCssVariables(accent: WorkspaceAccent): WorkspaceAccentCssVariables {
  return WORKSPACE_ACCENT_CSS_VARIABLES[accent];
}
