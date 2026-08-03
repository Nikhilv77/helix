"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { HelixMark } from "./blueprint-art";

const navLinks = [
  { label: "How it works", href: "#interview" },
  { label: "The product", href: "#product" },
  { label: "Follow-ups", href: "#features" },
  { label: "Scoring", href: "#report" },
  { label: "Session", href: "#flow" }
];

const footerColumns = [
  {
    heading: "Navigate",
    links: [
      { label: "How it works", href: "#interview" },
      { label: "The follow-up", href: "#features" },
      { label: "Scoring", href: "#report" },
      { label: "Session flow", href: "#flow" }
    ]
  },
  {
    heading: "Rounds",
    links: [
      { label: "Behavioral", href: "#interview" },
      { label: "Technical deep-dive", href: "#interview" },
      { label: "Hiring manager", href: "#interview" },
      { label: "History", href: "/" }
    ]
  }
];

export function SiteNav({ action }: { action: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[64rem]">
        <nav
          className={[
            "flex items-center gap-2 rounded-full border px-2 py-2 transition-all duration-300",
            scrolled
              ? "border-cream/25 bg-blueprint-dark/85 shadow-[0_18px_50px_rgba(9,21,60,0.45)] backdrop-blur-xl"
              : "border-cream/15 bg-blueprint-deep/45 backdrop-blur-md"
          ].join(" ")}
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-full px-3 py-1.5 text-cream transition hover:bg-cream/8"
          >
            <HelixMark className="h-7 w-7" />
            <span className="text-base font-semibold tracking-tight">Helix</span>
          </Link>

          <div className="mx-auto hidden items-center lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-cream/80 transition hover:bg-cream/10 hover:text-cream"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <div className="hidden sm:block">{action}</div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-cream transition hover:bg-cream/10 lg:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="mt-2 rounded-3xl border border-cream/20 bg-blueprint-dark/95 p-3 backdrop-blur-xl lg:hidden">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-cream/85 transition hover:bg-cream/10 hover:text-cream"
              >
                {link.label}
              </a>
            ))}
            <div className="p-2 sm:hidden">{action}</div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 rounded-t-[2.5rem] bg-cream-soft px-6 pb-10 pt-16 text-blueprint sm:px-10 sm:rounded-t-[3.5rem]">
      <div className="mx-auto w-full max-w-[78rem]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <p className="blueprint-label text-blueprint/55">{column.heading}</p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium tracking-wide text-blueprint/85 transition hover:text-blueprint"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="blueprint-label text-blueprint/55">Contact</p>
            <a
              href="mailto:hello@helix.build"
              className="mt-5 inline-flex items-center gap-3 text-sm font-medium text-blueprint/85 transition hover:text-blueprint"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-blueprint/25">
                <HelixMark className="h-5 w-5 text-blueprint" />
              </span>
              hello@helix.build
            </a>
          </div>

          <div>
            <p className="blueprint-label text-blueprint/55">Privacy</p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-blueprint/75">
              Practice without an account. Sign in only when you want transcripts and reports kept
              across sessions.
            </p>
          </div>
        </div>

        <div
          className="mt-14 select-none text-blueprint"
          style={{ fontSize: "clamp(5rem, 29vw, 26rem)" }}
        >
          <span
            className="wordmark block leading-[0.78]"
            style={{ textShadow: "none", letterSpacing: "-0.055em" }}
          >
            Helix
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-blueprint/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="blueprint-label text-blueprint/70">
            © {new Date().getFullYear()} Helix — AI product builder
          </p>
          <p className="blueprint-label text-blueprint/70">From idea to architecture</p>
        </div>
      </div>
    </footer>
  );
}
