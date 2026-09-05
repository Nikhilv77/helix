/**
 * The stable dimensions Trailgrad uses to collect and interpret interview
 * evidence. They are deliberately not curriculum sessions or a required order.
 * Baseline, Practice, Interviews, Progress, and reports can all share these
 * ids without duplicating product language in their UI components.
 */
export const PREPARATION_AREAS = [
  {
    id: "dsa",
    title: "DSA",
    description: "Problem solving, correctness, complexity, and pattern recognition."
  },
  {
    id: "core-technical",
    title: "Core Technical",
    description: "How your stack behaves beneath the surface."
  },
  {
    id: "applied-engineering",
    title: "Applied Engineering",
    description: "Production decisions, debugging, and practical trade-offs."
  },
  {
    id: "architecture-design",
    title: "Architecture & Design",
    description: "System boundaries, reliability, scale, and design judgement."
  }
] as const;

export type PreparationArea = (typeof PREPARATION_AREAS)[number];
export type PreparationAreaId = PreparationArea["id"];
