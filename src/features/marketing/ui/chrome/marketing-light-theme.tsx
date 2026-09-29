"use client";

import { useLayoutEffect } from "react";
import { THEME_LOCK_ATTRIBUTE, useTheme } from "@/lib/theme/theme-context";

// Runs while the server HTML is parsed, so a visitor whose saved theme is dark
// never sees a dark frame before hydration. Inserted as markup rather than a
// React <script>, which React would warn about (and skip) on client navigation;
// the layout effect covers that case.
const LOCK_SCRIPT = `<script>(function(){var d=document.documentElement;d.setAttribute("${THEME_LOCK_ATTRIBUTE}","light");d.classList.remove("dark");d.classList.add("light");d.setAttribute("data-theme","light");})();</script>`;

/**
 * The marketing pages are always light, so the white product film blends into
 * the page. Visitors pick their app theme during onboarding; leaving these
 * pages hands <html> back to that saved choice.
 */
export function MarketingLightTheme() {
  const { lockTheme } = useTheme();

  useLayoutEffect(() => {
    lockTheme("light");
    return () => lockTheme(null);
  }, [lockTheme]);

  return <div hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LOCK_SCRIPT }} />;
}
