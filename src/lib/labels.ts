import type { Level, Role, RoundType } from "@/lib/types";

/**
 * Display names for interview setup values, and the clock formats that go with
 * them. These were copied into every surface that renders a round; one home
 * keeps a role reading the same on the report, the history row and the index.
 */

export function roleLabel(role: Role): string {
  return {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full-stack",
    data: "Data",
    "ai-ml": "AI / ML",
    pm: "Product"
  }[role];
}

/** The role written out as a discipline, for covers and formal headings. */
export function disciplineLabel(role: Role): string {
  return {
    backend: "Backend Engineering",
    frontend: "Frontend Engineering",
    fullstack: "Full Stack Engineering",
    data: "Data Engineering",
    "ai-ml": "AI / ML Engineering",
    pm: "Product Management"
  }[role];
}

export function roleInitials(role: Role): string {
  return { backend: "BE", frontend: "FE", fullstack: "FS", data: "DA", "ai-ml": "AI", pm: "PM" }[
    role
  ];
}

export function roundLabel(round: RoundType): string {
  return round === "technical"
    ? "Technical deep-dive"
    : round === "hiring-manager"
      ? "Hiring manager"
      : "Behavioral";
}

/** The same round, short enough for a chart axis or a chip. */
export function roundShortLabel(round: RoundType): string {
  return round === "technical"
    ? "Technical"
    : round === "hiring-manager"
      ? "Manager"
      : "Behavioral";
}

export function levelLabel(level: Level): string {
  return { fresher: "Fresher", "0-2": "0–2 years", "3-5": "3–5 years", "5-plus": "5+ years" }[
    level
  ];
}

export function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    value
  );
}

/** `Mar 4` — for axes and dense rows where the year is noise. */
export function formatShortDate(value: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

/** Elapsed time as `m:ss`. */
export function formatDuration(value: number): string {
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Transcript timestamps as `mm:ss`. */
export function formatClock(value: number): string {
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
