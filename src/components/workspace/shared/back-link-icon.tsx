"use client";

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

/**
 * The arrow inside a navigation `<Link>`. While that link's navigation is
 * pending it becomes a small spinner (shown after 120 ms, so fast navigations
 * do not flicker), so a slow page never makes the click look ignored. Must
 * render inside the `<Link>` it reports on.
 */
export function LinkPendingIcon({
  direction,
  size = 14,
  icon,
  className
}: {
  direction: "back" | "forward";
  size?: number;
  /**
   * Idle icon when the link's design uses a chevron rather than an arrow. A
   * name, not a component, so Server Components can pass it.
   */
  icon?: "arrow" | "chevron";
  /** Extra classes for the idle icon, such as a hover nudge. */
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 size={size} aria-hidden="true" className="back-link-spinner" />;
  }
  const Icon =
    icon === "chevron"
      ? direction === "back"
        ? ChevronLeft
        : ChevronRight
      : direction === "back"
        ? ArrowLeft
        : ArrowRight;
  return <Icon size={size} aria-hidden="true" className={className} />;
}

export function BackLinkIcon({ size = 14 }: { size?: number }) {
  return <LinkPendingIcon direction="back" size={size} />;
}
