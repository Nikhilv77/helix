"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * A new screen should open at the top rather than wherever the last one was
 * left. The exception is an anchored link (`/#progress`): forcing the top there
 * would land the reader above the section they asked for, so the target wins
 * when it exists.
 */
export function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;

    let retry = 0;

    const settle = () => {
      if (hash.length <= 1) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }

      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
      // The section may still be mounting; retry briefly, then give up rather
      // than yanking a reader who has already started scrolling.
      if (retry < 3) {
        retry += 1;
        window.setTimeout(settle, 80);
      }
    };

    const frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
