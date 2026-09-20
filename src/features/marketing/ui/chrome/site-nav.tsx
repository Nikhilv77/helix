"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PrimaryAction } from "@/features/marketing/ui/home/primary-action";

// Every href below resolves to a section that exists on this page, in the
// order those sections appear — the previous set listed Interview before
// Practice while the page rendered them the other way round.
const navLinks: Array<{ label: string; href: string }> = [
  { label: "Learn", href: "#learn" },
  { label: "Interview", href: "#interview" },
  { label: "Practice", href: "#practice" },
  { label: "Help", href: "#help" }
];

/**
 * Highlights whichever section is crossing the middle of the viewport.
 *
 * The rootMargin collapses the observer's window to a band across the centre
 * of the screen, so exactly one section is "current" at a time — measuring
 * intersection ratios instead would flip between two whenever a short section
 * sat fully on screen next to a tall one.
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const navSectionIds = navLinks.map((link) => link.href.slice(1));

function sectionHref(href: string, prefix: string): string {
  return href.startsWith("#") ? `${prefix}${href}` : href;
}

const desktopActionClass =
  "site-nav-action hidden sm:block [&>*]:inline-flex [&>*]:h-11 [&>*]:items-center [&>*]:rounded-xl [&>*]:px-5 [&>*]:text-sm [&>*]:font-semibold [&>*]:tracking-tight [&>*]:outline-none";
const mobileActionClass =
  "site-nav-action px-5 pb-5 pt-3 [&>*]:inline-flex [&>*]:h-11 [&>*]:w-full [&>*]:items-center [&>*]:justify-center [&>*]:rounded-xl [&>*]:text-sm [&>*]:font-semibold [&>*]:outline-none";

/**
 * A rule and some type.
 *
 * The bar carries no surface of its own until you scroll — over the hero's
 * ember a floating slab reads as a lid on the light, so at rest there is
 * nothing here but the mark, four words and the action. Past the fold it
 * earns a blur and a single hairline, which is all the separation it needs
 * against the flat sections below.
 */
export function SiteNav({
  action = (
    <PrimaryAction ariaLabel="Start free" className="outline-none">
      Start free
    </PrimaryAction>
  ),
  sectionHrefPrefix = ""
}: {
  action?: ReactNode;
  sectionHrefPrefix?: string;
} = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(navSectionIds);

  useEffect(() => {
    // Coalesced into rAF: touch scrolling fires this far faster than the
    // compositor paints, and every raw event was reading scrollY — a forced
    // layout flush — before React could bail out on the unchanged value.
    let frame = 0;
    let wasScrolled: boolean | null = null;

    function read() {
      frame = 0;
      const next = window.scrollY > 24;
      if (next === wasScrolled) return;
      wasScrolled = next;
      setScrolled(next);
    }

    function onScroll() {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    }

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        scrolled || menuOpen
          ? "site-nav-surface border-white/[0.07]"
          : "border-transparent bg-transparent"
      ].join(" ")}
    >
      {/* Three tracks rather than justify-between: the mark and the action are
            different widths, so a flex row centres the links on the gap between
            them instead of on the page. */}
      <div className="mx-auto grid h-16 w-full max-w-[72rem] grid-cols-[1fr_auto_1fr] items-center gap-6 px-5 sm:h-[4.5rem] sm:px-8">
        <Link
          href="/"
          aria-label="Trailgrad home"
          className="shrink-0 rounded-lg text-cream outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-cream/40"
        >
          <TrailgradMark className="marketing-brand-mark h-8 w-8" />
        </Link>

        <nav aria-label="Sections" className="hidden items-center justify-center gap-9 sm:flex">
          {navLinks.map((link) => {
            const active = activeSection === link.href.slice(1);
            return (
              <a
                key={link.label}
                href={sectionHref(link.href, sectionHrefPrefix)}
                aria-current={active ? "true" : undefined}
                className={[
                  "relative text-[0.9rem] font-medium tracking-tight outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-cream/40",
                  active ? "text-cream" : "text-cream/55 hover:text-cream/90"
                ].join(" ")}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={["site-nav-rule", active ? "is-active" : ""].join(" ")}
                />
              </a>
            );
          })}
        </nav>

        <div className="col-start-3 flex shrink-0 items-center justify-self-end gap-3">
          <ThemeToggle />
          <div className={desktopActionClass}>{action}</div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-cream/75 outline-none transition hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40 sm:hidden"
          >
            {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        aria-hidden={!menuOpen}
        inert={menuOpen ? undefined : true}
        className={[
          "overflow-hidden transition-[max-height,opacity] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] sm:hidden",
          menuOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
        ].join(" ")}
      >
        <div className="border-t border-white/[0.06] px-5 pt-2">
          {navLinks.map((link, index) => {
            const active = activeSection === link.href.slice(1);
            return (
              <a
                key={link.label}
                href={sectionHref(link.href, sectionHrefPrefix)}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "true" : undefined}
                className={[
                  "flex min-h-12 items-center text-base font-medium tracking-tight transition-[color,opacity,transform] duration-300",
                  menuOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                  active ? "text-cream" : "text-cream/60"
                ].join(" ")}
                style={{ transitionDelay: menuOpen ? `${60 + index * 34}ms` : "0ms" }}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-cream/50">
            Theme
          </span>
          <ThemeToggle />
        </div>

        <div className={mobileActionClass}>{action}</div>
      </div>
    </header>
  );
}
