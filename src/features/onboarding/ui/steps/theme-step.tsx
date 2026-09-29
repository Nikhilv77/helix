"use client";

import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { useTheme, type ResolvedTheme } from "@/lib/theme/theme-context";
import { PRIMARY_BUTTON } from "../flow/onboarding-data";

const headingWords = ["Light", "or", "dark?"];

// Each preview paints the theme it names, so these surfaces are fixed on
// purpose rather than following the page.
const options: Array<{
  value: ResolvedTheme;
  label: string;
  line: string;
  surface: string;
  panel: string;
  ink: string;
}> = [
  {
    value: "light",
    label: "Light",
    line: "Bright and calm for daytime practice.",
    surface: "#ffffff",
    panel: "#f3f3f5",
    ink: "rgba(17, 24, 39, 0.16)"
  },
  {
    value: "dark",
    label: "Dark",
    line: "Easy on the eyes for late sessions.",
    surface: "#141517",
    panel: "#1d1e22",
    ink: "rgba(241, 234, 216, 0.16)"
  }
];

function ThemePreview({ option }: { option: (typeof options)[number] }) {
  return (
    <span
      aria-hidden="true"
      className="block aspect-[4/3] w-full overflow-hidden rounded-[1.1rem] p-3.5 sm:p-5"
      style={{ background: option.surface }}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: option.ink }} />
        <span className="h-2 w-10 rounded-full sm:w-16" style={{ background: option.ink }} />
      </span>
      <span
        className="mt-3 block rounded-xl p-3 sm:mt-5 sm:p-4"
        style={{ background: option.panel }}
      >
        <span className="block h-2.5 w-3/4 rounded-full" style={{ background: option.ink }} />
        <span className="mt-2 block h-2 w-1/2 rounded-full" style={{ background: option.ink }} />
        <span className="onboarding-accent-fill mt-3 block h-4 w-14 rounded-full sm:mt-4 sm:h-5 sm:w-20" />
      </span>
    </span>
  );
}

/**
 * The visitor's app theme. The marketing pages are always light, so this is
 * the first place it is chosen; picking one applies it at once, so the rest
 * of onboarding already shows it.
 */
export function ThemeStep({ onContinue }: { onContinue: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();

  function choose(next: ResolvedTheme) {
    if (next === resolvedTheme) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Cross-fade the whole screen where the browser supports it.
    if (!reduceMotion && typeof document.startViewTransition === "function") {
      document.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <>
      <div className="text-center">
        <h1
          className="display-heading mx-auto flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-1 text-cream sm:gap-x-4"
          style={{ fontSize: "clamp(2.15rem, 4.8vw, 3.8rem)" }}
          aria-label="Light or dark?"
        >
          {headingWords.map((word, index) => (
            <span
              key={word}
              aria-hidden="true"
              className="onboarding-word"
              style={{ "--word-delay": `${index * 85}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>
        <p
          className="onboarding-word mx-auto mt-4 max-w-md text-base leading-7 text-cream/62"
          style={{ "--word-delay": "300ms" } as CSSProperties}
        >
          Pick how Trailgrad looks. You can switch any time from the top bar.
        </p>
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-2 gap-3 sm:gap-6">
        {options.map((option, index) => {
          const active = resolvedTheme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(option.value)}
              className="onboarding-word group rounded-[1.45rem] p-1.5 text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-[#F26E01]/45 lg:hover:-translate-y-1"
              style={{ "--word-delay": `${380 + index * 120}ms` } as CSSProperties}
            >
              <span
                className={[
                  "block rounded-[1.2rem] ring-2 transition duration-300",
                  active ? "ring-[#F26E01]/70" : "ring-transparent"
                ].join(" ")}
              >
                <ThemePreview option={option} />
              </span>
              <span className="mt-4 flex items-center justify-between gap-3 px-1.5">
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-cream sm:text-xl">
                    {option.label}
                  </span>
                  <span className="mt-1 hidden text-sm leading-6 text-cream/58 sm:block">
                    {option.line}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={[
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition",
                    active
                      ? "onboarding-accent-fill border-transparent text-[#17181b]"
                      : "border-cream/25"
                  ].join(" ")}
                >
                  {active ? <Check size={15} strokeWidth={3} /> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <button type="button" className={`${PRIMARY_BUTTON} font-medium`} onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}
