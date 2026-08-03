"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Menu, Mic, X } from "lucide-react";
import { HelixMark } from "@/components/helix-mark";

const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Start interview", href: "/interview", icon: Mic, exact: false }
];

/**
 * Workspace chrome for signed-in users.
 *
 * The live interview renders bare — a persistent nav rail undercuts a screen
 * whose whole point is that someone is about to interrupt you.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const bare = pathname?.startsWith("/interview") ?? false;

  useEffect(() => setMenuOpen(false), [pathname]);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <div className="blueprint relative min-h-screen overflow-hidden lg:pl-64">
      <div className="blueprint-glow" />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-blueprint-dark/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-cream/15 bg-blueprint-deep/80 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 px-5 py-6">
          <Link href="/" className="flex items-center gap-2.5 text-cream">
            <HelixMark className="h-7 w-7" />
            <span className="text-base font-semibold tracking-tight">Helix</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-cream/20 text-cream/60 lg:hidden"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : Boolean(pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-cream/12 text-cream"
                    : "text-cream/55 hover:bg-cream/[0.06] hover:text-cream"
                ].join(" ")}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3">
          <p className="blueprint-label px-3 pb-2 text-cream/30">Coming next</p>
          <p className="rounded-xl border border-cream/10 bg-white/[0.03] px-3.5 py-3 text-xs leading-5 text-cream/40">
            Saved transcripts, scores, and past sessions land once reports and persistence ship.
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-cream/12 px-5 py-4">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          <span className="text-xs text-cream/45">Your account</span>
        </div>
      </aside>

      <header className="relative z-20 flex items-center gap-3 px-5 py-4 lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cream/20 text-cream"
        >
          <Menu size={17} aria-hidden="true" />
        </button>
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <HelixMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Helix</span>
        </Link>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
