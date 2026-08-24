/**
 * The one recipe every live interview panel is built from.
 *
 * The DSA room and the resume room drifted apart once already, each carrying
 * its own border strength, shadow spread, and blur. Keeping the shell in a
 * single constant means a change to the room's look lands in both.
 */
export const INTERVIEW_PANEL_SHELL =
  "workspace-accent-card-glow rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_24%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl";

/**
 * There is deliberately no background utility above. Inside `.workspace-black`,
 * `.workspace-accent-card-glow` sets the `background` shorthand, which both
 * paints the accent gradient and resets `background-color` — and it does so at
 * a higher specificity than any Tailwind `bg-*` class. A background here would
 * be silently dropped, so the panel's surface belongs in globals.css with the
 * glow rule itself.
 */

/** Hairline rule between a panel's header, body, and footer. */
export const INTERVIEW_PANEL_RULE = "border-white/[0.055]";

/** Raised surface for cards sitting inside a panel. */
export const INTERVIEW_PANEL_CARD = "rounded-xl bg-white/[0.03]";
