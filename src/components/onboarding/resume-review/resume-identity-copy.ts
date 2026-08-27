const MAX_IDENTITY_HEADING_WORDS = 15;

export const RESUME_IDENTITY_SUMMARY_FALLBACK =
  "Your experience, projects, and skills will shape interview questions grounded in your real work.";

export function formatResumeIdentitySummary(context: string) {
  const normalized = context.replace(/\s+/g, " ").trim();

  if (!normalized) return RESUME_IDENTITY_SUMMARY_FALLBACK;
  const words = normalized.split(" ");
  if (words.length <= MAX_IDENTITY_HEADING_WORDS) return normalized;

  return `${words.slice(0, MAX_IDENTITY_HEADING_WORDS).join(" ").replace(/[.,;:!?]+$/, "")}…`;
}
