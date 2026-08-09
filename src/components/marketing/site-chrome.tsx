"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChartNoAxesCombined,
  GraduationCap,
  Mic,
  Menu,
  Sparkles,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TrailgradMark } from "./blueprint-art";

// Every href below resolves to a section that exists on this page. A dead
// anchor ("#product") and a column of links that all pointed at the same
// section used to sit here.
const navLinks: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Learn", href: "#learn", icon: GraduationCap },
  { label: "Interview", href: "#interview", icon: Mic },
  { label: "Reports", href: "#report", icon: ChartNoAxesCombined },
  { label: "Start", href: "#flow", icon: Sparkles }
];

const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Learn", href: "#learn" },
      { label: "Interview", href: "#interview" },
      { label: "Reports", href: "#report" },
      { label: "Start", href: "#flow" }
    ]
  },
  {
    heading: "Practice",
    links: [
      { label: "Learning trail", href: "#learn" },
      { label: "Voice rounds", href: "#interview" },
      { label: "Progress reports", href: "#report" }
    ]
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" }
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

function sectionHref(href: string, prefix: string): string {
  return href.startsWith("#") ? `${prefix}${href}` : href;
}

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
      ? "hidden sm:flex [&>*]:inline-flex [&>*]:h-11 [&>*]:min-w-24 [&>*]:items-center [&>*]:justify-center [&>*]:rounded-lg [&>*]:bg-cream [&>*]:px-6 [&>*]:text-sm [&>*]:font-bold [&>*]:tracking-wide [&>*]:text-[#13234f] [&>*]:shadow-[0_16px_34px_-20px_rgba(3,10,31,0.72),inset_0_-1px_0_rgba(19,35,79,0.12)] [&>*]:outline-none [&>*]:transition [&>*]:duration-200 [&>*]:hover:-translate-y-0.5 [&>*]:hover:bg-cream-soft [&>*]:hover:text-[#0d1b44] [&>*]:hover:shadow-[0_18px_40px_-18px_rgba(3,10,31,0.78),inset_0_-1px_0_rgba(19,35,79,0.14)] [&>*]:active:translate-y-0 [&>*]:active:scale-[0.98] [&>*]:focus-visible:ring-2 [&>*]:focus-visible:ring-cream/45"
      : "hidden sm:block [&>*]:grid [&>*]:h-11 [&>*]:w-12 [&>*]:place-items-center [&>*]:rounded-xl [&>*]:p-0 [&>*]:text-cream [&>*]:hover:bg-cream/[0.08]";
  const mobileActionClass =
    actionKind === "button"
      ? "mt-2 border-t border-cream/[0.12] pt-2 [&>*]:inline-flex [&>*]:h-12 [&>*]:w-full [&>*]:items-center [&>*]:justify-center [&>*]:rounded-lg [&>*]:bg-cream [&>*]:px-4 [&>*]:text-sm [&>*]:font-bold [&>*]:tracking-wide [&>*]:text-[#13234f] [&>*]:shadow-[0_14px_30px_-20px_rgba(3,10,31,0.72),inset_0_-1px_0_rgba(19,35,79,0.12)] [&>*]:outline-none [&>*]:transition [&>*]:duration-200 [&>*]:hover:bg-cream-soft [&>*]:hover:text-[#0d1b44] [&>*]:active:scale-[0.98] [&>*]:focus-visible:ring-2 [&>*]:focus-visible:ring-cream/45"
      : "mt-2 border-t border-cream/[0.12] pt-2 [&>*]:grid [&>*]:h-11 [&>*]:w-full [&>*]:place-items-center [&>*]:rounded-xl [&>*]:p-0 [&>*]:text-cream [&>*]:hover:bg-cream/[0.08]";
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:top-5">
      <div className="pointer-events-auto relative w-full max-w-[58rem]">
        <nav
          className={[
            "grid grid-cols-[auto_1fr_auto] items-center overflow-hidden rounded-lg bg-[#2b499f] px-2 py-2 shadow-[0_18px_44px_-30px_rgba(3,10,31,0.42)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            scrolled ? "shadow-[0_22px_56px_-32px_rgba(3,10,31,0.52)]" : ""
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label="Trailgrad home"
            title="Home"
            className="grid h-11 w-12 shrink-0 place-items-center justify-self-start rounded-xl bg-transparent text-cream outline-none"
          >
            <TrailgradMark className="h-[2rem] w-[2rem]" />
          </Link>

          <div className="hidden min-w-0 items-center justify-center gap-1 px-2 sm:flex">
            {navLinks.map((link) => {
              const id = link.href.slice(1);
              const active = activeSection === id;
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={sectionHref(link.href, sectionHrefPrefix)}
                  aria-label={link.label}
                  aria-current={active ? "true" : undefined}
                  title={link.label}
                  className={[
                    "group relative flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/35 md:px-5",
                    active ? "text-cream" : "text-cream/[0.68] hover:text-cream"
                  ].join(" ")}
                >
                  <Icon
                    size={21}
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:scale-105"
                  />
                  <span className="whitespace-nowrap leading-none">{link.label}</span>
                </a>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 justify-self-end">
            <div className={desktopActionClass}>{action}</div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="grid h-11 w-11 place-items-center rounded-xl text-cream outline-none transition hover:bg-cream/[0.08] focus-visible:ring-2 focus-visible:ring-cream/35 sm:hidden"
            >
              {menuOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        <div
          aria-hidden={!menuOpen}
          inert={menuOpen ? undefined : true}
          className={[
            "overflow-hidden rounded-2xl bg-[#2b499f] text-cream shadow-[0_18px_44px_-28px_rgba(3,10,31,0.42)] transition-[max-height,opacity,transform,filter,margin-top,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[max-height,opacity,transform] sm:hidden",
            menuOpen
              ? "mt-2 max-h-[26rem] translate-y-0 p-2 opacity-100 blur-0"
              : "mt-0 max-h-0 -translate-y-2 p-0 opacity-0 blur-sm"
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/[0.46]">
              Menu
            </p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="grid h-8 w-8 place-items-center rounded-lg text-cream/[0.7] transition hover:bg-cream/[0.08] hover:text-cream"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            {navLinks.map((link, index) => {
              const active = activeSection === link.href.slice(1);
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={sectionHref(link.href, sectionHrefPrefix)}
                  onClick={() => setMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={active ? "true" : undefined}
                  title={link.label}
                  className={[
                    "relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,opacity,transform] duration-300",
                    menuOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                    active
                      ? "text-cream"
                      : "text-cream/[0.68] hover:bg-cream/[0.08] hover:text-cream"
                  ].join(" ")}
                  style={{ transitionDelay: menuOpen ? `${70 + index * 38}ms` : "0ms" }}
                >
                  <Icon size={19} strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          <div className={mobileActionClass}>{action}</div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  action,
  sectionHrefPrefix = ""
}: {
  action?: ReactNode;
  sectionHrefPrefix?: string;
}) {
  return (
    <footer className="relative z-10 rounded-t-[2.5rem] bg-[#2b499f] px-6 py-10 text-cream sm:rounded-t-[3.5rem] sm:px-10">
      <div className="mx-auto w-full max-w-[78rem]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link
              href="/"
              aria-label="Trailgrad home"
              className="inline-flex items-center gap-1.5 rounded-xl text-cream outline-none focus-visible:ring-2 focus-visible:ring-cream/35"
            >
              <TrailgradMark className="h-10 w-10" />
              <span className="text-3xl font-semibold tracking-tight text-cream">Trailgrad</span>
            </Link>
            <p className="mt-4 text-base leading-7 text-cream/62">
              AI interview practice for learning, mock rounds, and reports that help you improve.
            </p>
            <div className="mt-5 [&>*]:inline-flex [&>*]:items-center [&>*]:gap-2 [&>*]:rounded-lg [&>*]:bg-cream [&>*]:px-5 [&>*]:py-2.5 [&>*]:text-base [&>*]:font-bold [&>*]:text-[#13234f] [&>*]:shadow-[0_16px_34px_-22px_rgba(3,10,31,0.72)] [&>*]:transition [&>*]:hover:-translate-y-0.5 [&>*]:hover:bg-cream-soft [&>*]:hover:text-[#0d1b44]">
              {action}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 lg:min-w-[34rem]">
            {footerColumns.map((column) => (
              <div key={column.heading}>
                <p className="blueprint-label text-sm text-cream/45">{column.heading}</p>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={sectionHref(link.href, sectionHrefPrefix)}
                        className="text-base font-semibold text-cream/68 transition hover:text-cream"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-cream/14 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="blueprint-label text-sm text-cream/42">
            © {new Date().getFullYear()} Trailgrad · AI interview practice
          </p>
          <div className="flex gap-4">
            <Link
              href="/terms"
              className="blueprint-label text-sm text-cream/58 transition hover:text-cream"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="blueprint-label text-sm text-cream/58 transition hover:text-cream"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
