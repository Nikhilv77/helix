const TARGET_JOB_MAX = 60;

/**
 * The job title inside a free-text target, for use mid-sentence. Onboarding
 * often stores a whole description ("Backend Engineer with 3.5 years of
 * experience building…"); only the title reads well in a selection reason.
 */
export function targetJobTitle(targetJob: string): string {
  const text = targetJob.replace(/\s+/g, " ").trim();
  const title = text.split(/\s+(?:with|using|at|for|who|building)\s+|[,.;:(]/i)[0]!.trim();
  const phrase = title.length >= 2 ? title : text;
  if (phrase.length <= TARGET_JOB_MAX) return phrase;
  const cut = phrase.slice(0, TARGET_JOB_MAX);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), TARGET_JOB_MAX - 15)).trimEnd();
}

/** Keeps a generated reason inside its schema limit, ending on a whole word. */
export function boundedReason(reason: string, limit: number): string {
  if (reason.length <= limit) return reason;
  const cut = reason.slice(0, limit - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), limit - 20)).trimEnd()}…`;
}
