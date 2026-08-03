"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  FileText,
  LayoutDashboard,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  UserRound,
  X
} from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { userProfileAppearance } from "@/lib/clerk-theme";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Home", href: "/", icon: LayoutDashboard },
      { label: "Practice", href: "/interview", icon: Mic },
      { label: "Progress", href: "/#progress", icon: TrendingUp, hash: "#progress" },
      { label: "Reports", href: "/#sessions", icon: FileText, hash: "#sessions" }
    ]
  },
  {
    label: "Account",
    items: [{ label: "My profile", href: "/profile", icon: UserRound }]
  }
];

const SIDEBAR_STORAGE_KEY = "helix:sidebar-collapsed";

/** Signed-in workspace chrome. Interview and onboarding routes stay distraction-free. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hash, setHash] = useState("");
  const bare = pathname?.startsWith("/interview") || pathname?.startsWith("/onboarding") || false;

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  const isActive = (href: string, itemHash?: string) => {
    if (itemHash) return pathname === "/" && hash === itemHash;
    if (href === "/") return pathname === "/" && !hash;
    return Boolean(pathname?.startsWith(href));
  };

  if (bare) return <>{children}</>;

  return (
    <div
      className={[
        // overflow-x-clip, not overflow-hidden: `hidden` makes this a scroll
        // container, which silently kills the sticky mobile header inside it.
        "blueprint relative min-h-screen overflow-x-clip transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "lg:pl-[5.25rem]" : "lg:pl-[17rem]"
      ].join(" ")}
    >
      <div className="blueprint-glow" />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-blueprint-dark/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col border-r border-cream/15 bg-[#172f78]/95 shadow-[20px_0_60px_rgba(7,18,58,0.18)] backdrop-blur-xl transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[5.25rem]" : "lg:w-[17rem]"
        ].join(" ")}
      >
        <div
          className={[
            "flex h-[4.75rem] shrink-0 items-center border-b border-cream/12",
            collapsed ? "lg:justify-center lg:px-3" : "px-4"
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label="Helix home"
            className={[
              "flex min-w-0 items-center gap-3 text-cream outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-cream/50",
              collapsed ? "lg:justify-center lg:gap-0" : ""
            ].join(" ")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cream/18 bg-cream/[0.06]">
              <HelixMark className="h-6 w-6" />
            </span>
            <span className={collapsed ? "lg:hidden" : ""}>
              <span className="block truncate text-base font-semibold text-cream">Helix</span>
              <span className="block truncate text-[11px] text-cream/45">Interview workspace</span>
            </span>
          </Link>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cream/15 text-cream/60 transition hover:bg-cream/10 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/50 lg:hidden"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-5">
          <Link
            href="/interview"
            title={collapsed ? "Start an interview" : undefined}
            onClick={() => setMenuOpen(false)}
            className={[
              "mb-6 flex h-11 shrink-0 items-center gap-3 rounded-lg bg-cream px-3 font-semibold text-[#173178] shadow-[0_10px_24px_rgba(7,18,58,0.16)] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70",
              collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""
            ].join(" ")}
          >
            <Mic size={17} aria-hidden="true" />
            <span className={collapsed ? "lg:hidden" : ""}>Start interview</span>
          </Link>

          <nav aria-label="Workspace navigation" className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p
                  className={[
                    "mb-2 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cream/35",
                    collapsed ? "lg:sr-only" : ""
                  ].join(" ")}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.hash);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        // Hash links keep the same pathname, so the route effect
                        // never fires and the drawer would stay open over the page.
                        onClick={() => setMenuOpen(false)}
                        className={[
                          "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition",
                          collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
                          active
                            ? "bg-cream/12 text-cream shadow-[inset_0_0_0_1px_rgba(239,232,214,0.12)]"
                            : "text-cream/58 hover:bg-cream/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40"
                        ].join(" ")}
                      >
                        {active ? (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-cream" />
                        ) : null}
                        <Icon
                          size={18}
                          strokeWidth={active ? 2.25 : 1.8}
                          className="shrink-0 transition-transform duration-200 group-hover:scale-105"
                          aria-hidden="true"
                        />
                        <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t border-cream/12 p-3">
          <div className={collapsed ? "flex justify-center" : ""}>
            <UserButton
              showName
              userProfileProps={{ appearance: userProfileAppearance }}
              appearance={{
                elements: {
                  rootBox: collapsed ? "!w-full lg:!w-10" : "!w-full",
                  userButtonTrigger:
                    "!w-full !rounded-lg !p-2 !text-cream transition hover:!bg-cream/[0.08] focus:!shadow-none focus-visible:!ring-2 focus-visible:!ring-cream/40",
                  userButtonBox: "!w-full !flex-row",
                  avatarBox: "!h-9 !w-9 !border !border-cream/25",
                  userButtonOuterIdentifier: `!ml-3 !min-w-0 !flex-1 !truncate !text-left !text-sm !font-semibold !text-cream ${collapsed ? "lg:!hidden" : ""}`
                }
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[5.75rem] hidden h-7 w-7 items-center justify-center rounded-full border border-cream/25 bg-[#173178] text-cream/70 shadow-lg transition hover:scale-105 hover:bg-[#1c3b91] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/50 lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen size={14} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={14} aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* Stays put while the page scrolls, so the drawer is always one tap away. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-cream/12 bg-[#1d3a8c]/85 px-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cream/20 text-cream transition hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-cream/50"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <span className="flex-1" />
        {/*
         * Clerk's root box fills its flex parent by default. Left alone it took
         * the whole row the moment it hydrated, squeezing the title to nothing
         * and packing the controls to one side. The wrapper reserves exactly the
         * avatar's footprint, so nothing shifts when it loads.
         */}
        <div className="h-9 w-9 shrink-0">
          <UserButton
            userProfileProps={{ appearance: userProfileAppearance }}
            appearance={{
              elements: {
                rootBox: "!h-9 !w-9 !shrink-0",
                userButtonTrigger: "!h-9 !w-9",
                avatarBox: "!h-9 !w-9 !border !border-cream/25"
              }
            }}
          />
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
