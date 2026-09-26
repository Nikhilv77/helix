/** Lines of the learner's code that the teacher debrief praises (1-based, inclusive). */
export type DsaFeedbackHighlight = { startLine: number; endLine: number };

/** The debrief modal shows at most this many lines of the highlighted code. */
export const DSA_FEEDBACK_HIGHLIGHT_MAX_LINES = 6;
