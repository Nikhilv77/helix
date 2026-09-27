/**
 * James's fixed Resume Roast lines. The static voice generator reads this
 * list, so the pre-recorded audio always matches the words on screen; any
 * edit here falls back to live speech until `pnpm voice:lines` is re-run.
 */
export const RESUME_ROAST_INTRO =
  "Okay, I’ve got your resume. Three quick questions, then we’ll get into it.";
export const RESUME_ROAST_ROLE_QUESTION = "Which position are you targeting?";
export const RESUME_ROAST_OPENING_VOICE_LINE = `${RESUME_ROAST_INTRO} ${RESUME_ROAST_ROLE_QUESTION}`;
export const RESUME_ROAST_COMPANY_QUESTION = "What kind of company are we trying to impress?";
export const RESUME_ROAST_LEVEL_QUESTION = "What level are you applying for?";
export const RESUME_ROAST_READING_LINE =
  "Perfect. I’ll start analysing it now. Give me a second—I’m checking what the confidence forgot to prove.";

/** Lines James speaks on their own, in the order a visit reaches them. */
export const RESUME_ROAST_FIXED_VOICE_LINES = [
  RESUME_ROAST_OPENING_VOICE_LINE,
  RESUME_ROAST_COMPANY_QUESTION,
  RESUME_ROAST_LEVEL_QUESTION,
  RESUME_ROAST_READING_LINE
] as const;

export const RESUME_ROAST_VOICE_PERSONA = "james";
