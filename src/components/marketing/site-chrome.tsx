"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Gauge, GraduationCap, Mic, Menu, Route, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TrailgradMark } from "./blueprint-art";

// Every href below resolves to a section that exists on this page. A dead
// anchor ("#product") and a column of links that all pointed at the same
// section used to sit here.
const navLinks: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Learn", href: "#learn", icon: GraduationCap },
  { label: "Interview", href: "#interview", icon: Mic },
  { label: "Reports", href: "#report", icon: Gauge },
  { label: "How it works", href: "#flow", icon: Route }
];

const footerColumns = [
  {
    heading: "Navigate",
    links: [
      { label: "The learning path", href: "#learn" },
      { label: "The interview", href: "#interview" },
      { label: "Reports & progress", href: "#report" },
      { label: "How it works", href: "#flow" }
    ]
  }
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

export function SiteNav({ action }: { action: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(navSectionIds);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the sheet, matching the workspace drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <div className="pointer-events-auto relative w-full max-w-[58rem]">
        {/*
         * A rounded rectangle, not a capsule: at this height a fully-rounded
         * bar turns the ends into semicircles and eats the padding around the
         * logo and the CTA. The radius is roughly a third of the height, which
         * is the proportion the reference uses.
         */}
        <nav
          className={[
            "grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[1.5rem] bg-[#0d1424] px-3 py-2.5 transition-shadow duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:rounded-[1.75rem] lg:px-5 lg:py-3",
            scrolled
              ? "shadow-[inset_0_0_0_1px_rgba(239,232,214,0.1),0_20px_50px_-20px_rgba(4,10,32,0.9)]"
              : "shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07),0_12px_34px_-20px_rgba(4,10,32,0.7)]"
          ].join(" ")}
        >
          {/*
           * Mark only, no wordmark. The accessible name lives on the link, so
           * dropping the visible text costs nothing to a screen reader — and
           * the name is still in the tab title, the hero and the footer.
           *
           * The mark is white artwork, so on a cream bar it needs the blue
           * tile the workspace sidebar already gives it. Tile and CTA share a
           * height and a radius, which is what makes the two ends of the bar
           * read as a matched pair.
           */}
          <Link
            href="/"
            aria-label="Trailgrad home"
            className="grid h-12 w-12 shrink-0 place-items-center justify-self-start rounded-2xl bg-[#1e3a8f] outline-none transition hover:bg-[#254294] focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            <TrailgradMark className="h-[1.6rem] w-[1.6rem]" />
          </Link>

          <div className="hidden items-stretch gap-1 lg:flex">
            {navLinks.map((link) => {
              const id = link.href.slice(1);
              const active = activeSection === id;
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  aria-current={active ? "true" : undefined}
                  className={[
                    // Fixed width so the four items sit on an even rhythm.
                    "group flex w-[6.25rem] flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cream/40",
                    active
                      ? "bg-white/[0.08] text-cream"
                      : "text-cream/45 hover:bg-white/[0.04] hover:text-cream"
                  ].join(" ")}
                >
                  <Icon
                    size={21}
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:-translate-y-px"
                  />
                  <span
                    className={[
                      "text-[11.5px] leading-none tracking-tight",
                      active ? "font-semibold" : "font-medium"
                    ].join(" ")}
                  >
                    {link.label}
                  </span>
                </a>
              );
            })}
          </div>

          <div className="col-start-3 flex shrink-0 items-center gap-2 justify-self-end">
            <div className="hidden sm:block">{action}</div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-cream outline-none transition hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-cream/40 lg:hidden"
            >
              {menuOpen ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Menu size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-[1.5rem] bg-[#0d1424] p-2.5 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.1),0_24px_60px_-24px_rgba(4,10,32,0.9)] lg:hidden">
            {navLinks.map((link) => {
              const active = activeSection === link.href.slice(1);
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "true" : undefined}
                  className={[
                    "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 transition",
                    active
                      ? "bg-white/[0.08] text-cream"
                      : "text-cream/55 hover:bg-white/[0.04] hover:text-cream"
                  ].join(" ")}
                >
                  <Icon size={20} strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
                  <span
                    className={[
                      "text-[12px] leading-none",
                      active ? "font-semibold" : "font-medium"
                    ].join(" ")}
                  >
                    {link.label}
                  </span>
                </a>
              );
            })}
            {/* Full width in the sheet: an inline-flex button in a
                two-column cell just hugged the left edge. */}
            <div className="col-span-2 pt-1 [&>*]:w-full [&>*]:justify-center sm:hidden">
              {action}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter({ action }: { action?: ReactNode }) {
  return (
    <footer className="relative z-10 rounded-t-[2.5rem] bg-[#0d1424] px-6 pb-10 pt-16 text-cream shadow-[inset_0_1px_0_rgba(239,232,214,0.08)] sm:rounded-t-[3.5rem] sm:px-10">
      <div className="mx-auto w-full max-w-[78rem]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <p className="blueprint-label text-cream/40">{column.heading}</p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium tracking-wide text-cream/70 transition hover:text-cream"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="blueprint-label text-cream/40">Practice</p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-cream/50">
              An ordered path through 123 questions and 12 patterns, then voice rounds that press on
              the evidence in your own resume.
            </p>
            <div className="mt-4">{action}</div>
          </div>

          <div>
            <p className="blueprint-label text-cream/40">Privacy</p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-cream/50">
              Your interview transcripts and reports stay inside your private account workspace.
              Resume files are read in memory and never stored.
            </p>
          </div>
        </div>

        <div
          className="mt-14 select-none text-cream/[0.08]"
          style={{ fontSize: "clamp(2.25rem, 15vw, 15rem)" }}
        >
          <span
            className="wordmark block leading-[0.78]"
            style={{ textShadow: "none", letterSpacing: "-0.055em" }}
          >
            Trailgrad
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-cream/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="blueprint-label text-cream/40">
            © {new Date().getFullYear()} Trailgrad — AI interview practice
          </p>
          <p className="blueprint-label text-cream/40">Learn it, then defend it</p>
        </div>
      </div>
    </footer>
  );
}
