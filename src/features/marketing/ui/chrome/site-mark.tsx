import Link from "next/link";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { MarketingLightTheme } from "./marketing-light-theme";

/**
 * The home page's only chrome: the mark in the top-left, no bar and no links.
 * It sits in the page flow's top corner and scrolls away with the hero.
 */
export function SiteMark() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <MarketingLightTheme />
      <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center px-5 sm:h-[3.75rem] sm:px-8">
        <Link
          href="/"
          aria-label="Trailgrad home"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-cream outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-cream/40"
        >
          <TrailgradMark className="marketing-brand-mark h-7 w-7" />
        </Link>
      </div>
    </header>
  );
}
