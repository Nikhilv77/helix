/**
 * The one recipe every live interview panel is built from.
 *
 * The DSA room and the resume room drifted apart once already, each carrying
 * its own border strength, shadow spread, and blur. Keeping the shell in a
 * single constant means a change to the room's look lands in both.
 */
export const INTERVIEW_PANEL_SHELL =
  "rounded-2xl border border-white/[0.075] bg-[#111215] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

/**
 * Keep this surface opaque and neutral. Accent is reserved for small state and
 * progress cues, avoiding large blurred colour fields behind interview content.
 */

/** Hairline rule between a panel's header, body, and footer. */
export const INTERVIEW_PANEL_RULE = "border-white/[0.055]";

/** Raised surface for cards sitting inside a panel. */
export const INTERVIEW_PANEL_CARD = "rounded-xl bg-white/[0.03]";
