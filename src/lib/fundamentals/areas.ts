/**
 * The fundamentals areas, safe to render in the browser.
 *
 * This is deliberately separate from `fundamentals.ts`, which imports the
 * question bank — and therefore its answer keys. Anything a client component
 * needs lives here so the bank never reaches the browser bundle.
 */
export interface FundamentalsAreaSummary {
  id: string;
  title: string;
  why: string;
}

export const FUNDAMENTALS_AREAS: FundamentalsAreaSummary[] = [
  {
    id: "networking",
    title: "Networking",
    why: "Every request a frontend makes crosses this layer. Most 'slow page' answers live here."
  },
  {
    id: "browser-os",
    title: "Browser & OS",
    why: "The machinery under the framework: what the process, the thread and the event loop are actually doing while your code runs."
  },
  {
    id: "databases",
    title: "Databases",
    why: "Enough to reason about why a screen is slow and what your API is really costing the server."
  },
  {
    id: "systems",
    title: "Systems Basics",
    why: "The intuitions that make a design answer credible: what is expensive, what races, and what is safe to retry."
  }
];
