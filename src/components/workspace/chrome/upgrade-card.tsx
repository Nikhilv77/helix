"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";

/**
 * The one promotional surface in the workspace: the mentor tier, Trailguide.
 * It sits below navigation rather than inside it, because it is an offer and
 * not a destination the user is already trying to reach.
 *
 * Expanded, it is a single underlined line that says what you get; the page it
 * opens introduces the name. Collapsed, it is a compass icon in the rail.
 * Colour comes from `.upgrade-*` in globals.css, which reads the accent the
 * user chose in Manage.
 */

const HREF = "/trailguide";

// Three of the mentors from the Trailguide page, so the offer reads as people.
const FACES = [
  "/images/trailguide/meera-iyer.webp",
  "/images/trailguide/dev-malhotra.webp",
  "/images/trailguide/anika-rao.webp"
];

export function UpgradeCard({ onNavigate }: { onNavigate?: () => void }) {
  // Faces, then one underlined line that says what you get; the page it opens
  // introduces the Trailguide name. The arrow rides at the end of the text so
  // it wraps with it instead of floating at the edge.
  return (
    <Link
      href={HREF}
      onClick={onNavigate}
      className="upgrade-cta group mt-4 block shrink-0 rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
    >
      <span className="upgrade-cta-faces flex" aria-hidden="true">
        {FACES.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={48}
            height={48}
            sizes="24px"
            className="upgrade-cta-face h-6 w-6 rounded-full object-cover"
            style={{ zIndex: FACES.length - index }}
          />
        ))}
      </span>
      <span className="upgrade-cta-text mt-3 block text-pretty text-[0.9rem] font-medium leading-[1.6] text-cream/80">
        Practise 1:1 with a senior&nbsp;engineer
        <ArrowUpRight
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
          className="upgrade-cta-arrow ml-1 inline-block align-[-0.1em]"
        />
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
      className="upgrade-rail group relative mt-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
    >
      <Compass size={19} strokeWidth={1.5} aria-hidden="true" />
    </Link>
  );
}
