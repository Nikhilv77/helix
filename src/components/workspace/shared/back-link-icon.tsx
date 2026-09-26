"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

/**
 * The arrow inside a back `<Link>`. While that link's navigation is pending it
 * becomes a small spinner, so a slow page never makes the click look ignored.
 * Must render inside the `<Link>` it reports on.
 */
export function BackLinkIcon({ size = 14 }: { size?: number }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 size={size} aria-hidden="true" className="back-link-spinner" />
  ) : (
    <ArrowLeft size={size} aria-hidden="true" />
  );
}
