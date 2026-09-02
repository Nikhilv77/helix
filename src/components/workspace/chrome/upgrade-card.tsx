"use client";

import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";

/**
 * The one promotional surface in the workspace. It sits below navigation
 * rather than inside it, because it is an offer and not a destination the
 * user is already trying to reach.
 *
 * Trailguide is the mentor tier, named to pair with Trailmate: a mate walks
 * beside you, a guide goes ahead. The name is not self-explanatory on its own,
 * so the second line has to carry the meaning — it says what you get rather
 * than restating the brand.
 *
 * The text is block-level, not a flex child. The panel is 15rem wide, so the
 * card has roughly 190px of inner width — an icon tile, an arrow and two gaps
 * consume a third of that before any text is measured, which is what truncated
 * an earlier version to "Human…". The arrow is positioned out of the flow
 * instead, and the title reserves room for it with `pr-5`.
 *
 * The description wraps rather than truncating across the available width; a
 * clipped sentence tells the reader less than no sentence at all. Only the
 * title truncates, and "Trailguide" never reaches that limit.
 *
 * The mark is inline with the title rather than a tile beside the whole card,
 * so it costs width on that one line instead of on every line of description.
 * Compass over a person icon: the rail sits directly under My profile, and two
 * near-identical user silhouettes read as the same destination.
 *
 * Colour comes from `.upgrade-*` in globals.css, which reads the accent the
 * user chose in Manage. Nothing here is hard-coded to Ember.
 */

const HREF = "/trailguide";

export function UpgradeCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href={HREF}
      onClick={onNavigate}
      className="upgrade-card group mt-3 block shrink-0 rounded-xl px-3 py-3 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
    >
      <ArrowUpRight
        size={14}
        aria-hidden="true"
        className="absolute right-2.5 top-2.5 text-cream/30 transition-[transform,color] duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cream/70"
      />

      <span className="relative flex items-center gap-1.5 pr-5">
        <Compass
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="upgrade-card-mark shrink-0"
        />
        <span className="truncate text-[0.92rem] font-semibold leading-tight text-cream">
          Trailguide
        </span>
      </span>

      <span className="relative mt-2 block text-pretty text-[0.82rem] leading-[1.55] text-cream/72">
        1:1 sessions with senior engineers who have run real interview loops
      </span>
    </Link>
  );
}

/** Collapsed-rail form: icon only, same accent treatment as the card. */
export function UpgradeRailButton({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href={HREF}
      onClick={onNavigate}
      title="Trailguide — 1:1 with senior engineers"
      aria-label="Trailguide"
      className="upgrade-rail group relative mt-auto grid h-12 w-12 shrink-0 place-items-center rounded-xl outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
    >
      <Compass size={20} strokeWidth={1.9} aria-hidden="true" />
    </Link>
  );
}
