"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { TrailgradMark } from "@/components/brand/blueprint-art";

// Every href below resolves to a section that exists on this page, in the
// order those sections appear — the previous set listed Interview before
// Practice while the page rendered them the other way round.
const navLinks: Array<{ label: string; href: string }> = [
  { label: "Learn", href: "#learn" },
  { label: "Interview", href: "#interview" },
  { label: "Practice", href: "#practice" },
  { label: "Help", href: "#help" }
];

const footerLinks: Array<{ label: string; href: string }> = [
  { label: "Interview", href: "#interview" },
  { label: "Practice", href: "#practice" },
  { label: "Help", href: "#help" },
  { label: "Blog", href: "/blog" }
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
  action,
  actionKind = "icon",
  sectionHrefPrefix = ""
}: {
  action: ReactNode;
  actionKind?: "icon" | "button";
  sectionHrefPrefix?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(navSectionIds);

  const desktopActionClass =
    actionKind === "button"
      ? "site-nav-action hidden sm:block [&>*]:inline-flex [&>*]:h-11 [&>*]:items-center [&>*]:rounded-xl [&>*]:px-5 [&>*]:text-sm [&>*]:font-semibold [&>*]:tracking-tight [&>*]:outline-none"
      : "hidden sm:block [&>*]:grid [&>*]:h-10 [&>*]:w-10 [&>*]:place-items-center [&>*]:rounded-full [&>*]:p-0 [&>*]:text-cream/70 [&>*]:transition [&>*]:hover:text-cream";
  const mobileActionClass =
    actionKind === "button"
      ? "site-nav-action px-5 pb-5 pt-3 [&>*]:inline-flex [&>*]:h-11 [&>*]:w-full [&>*]:items-center [&>*]:justify-center [&>*]:rounded-xl [&>*]:text-sm [&>*]:font-semibold [&>*]:outline-none"
      : "px-5 pb-5 pt-3 [&>*]:grid [&>*]:h-11 [&>*]:w-full [&>*]:place-items-center [&>*]:rounded-full [&>*]:p-0 [&>*]:text-cream";

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
          <TrailgradMark className="h-8 w-8" />
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

        <div className="col-start-3 flex shrink-0 items-center justify-self-end">
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
          menuOpen ? "max-h-[24rem] opacity-100" : "max-h-0 opacity-0"
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

        <div className={mobileActionClass}>{action}</div>
      </div>
    </header>
  );
}

/**
 * Same language as the bar at the top: a hairline, plain type, nothing
 * enclosed. The cream CTA that used to sit here is gone — the closing section
 * directly above it already makes that ask, and two in a row read as nagging.
 */
export function SiteFooter({ sectionHrefPrefix = "" }: { sectionHrefPrefix?: string }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            aria-label="Trailgrad home"
            className="inline-flex items-center gap-2.5 rounded-lg text-cream outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            <TrailgradMark className="h-5 w-5" />
            <span className="text-[0.95rem] font-medium tracking-tight">Trailgrad</span>
          </Link>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={sectionHref(link.href, sectionHrefPrefix)}
                className="text-sm text-cream/50 outline-none transition-colors duration-300 hover:text-cream/90 focus-visible:ring-2 focus-visible:ring-cream/40"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.05] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-cream/34">
            © {new Date().getFullYear()} Trailgrad · AI interview practice
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-[0.8125rem] text-cream/42 transition-colors duration-300 hover:text-cream/80"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[0.8125rem] text-cream/42 transition-colors duration-300 hover:text-cream/80"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
