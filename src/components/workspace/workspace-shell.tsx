"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useLinkStatus } from "next/link";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import {
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  PanelLeft,
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

/**
 * Rendered inside a nav <Link>: `useLinkStatus` reports that link's own
 * navigation, so the row you tapped is the one that shows activity.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="absolute inset-x-2 bottom-1 h-px overflow-hidden rounded-full lg:inset-x-3"
    >
      <span className="route-progress block h-full w-full bg-gradient-to-r from-transparent via-cream to-transparent" />
    </span>
  );
}

const SIDEBAR_STORAGE_KEY = "helix:sidebar-collapsed";

/** Signed-in workspace chrome. Interview and onboarding routes stay distraction-free. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const userName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "";
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
        "blueprint relative min-h-screen overflow-x-clip bg-[#0b1740] transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:p-3",
        collapsed ? "lg:pl-[6.75rem]" : "lg:pl-[18.5rem]"
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
          // Same light-blue glass as the resume hero: translucent, softly lit,
          // and separated by depth instead of a hard outline.
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col overflow-hidden bg-[radial-gradient(20rem_18rem_at_30%_0%,rgba(154,184,255,0.26),transparent_70%),linear-gradient(180deg,rgba(75,104,184,0.94),rgba(44,74,154,0.92)_54%,rgba(31,59,132,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_80px_-34px_rgba(5,14,45,0.88)] backdrop-blur-2xl transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:inset-y-3 lg:left-3 lg:rounded-[1.65rem]",
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[5.25rem]" : "lg:w-[17rem]"
        ].join(" ")}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 top-24 h-56 w-56 rounded-full bg-[#9be8c1]/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(220,230,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(220,230,255,0.55) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(100% 100% at 100% 100%, #000 20%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(100% 100% at 100% 100%, #000 20%, transparent 72%)"
          }}
        />
        {/* Glass edge: catches the light along the top and right of the panel. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cream/34 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-10 right-0 w-px bg-gradient-to-b from-cream/18 via-cream/7 to-transparent"
        />
        <div
          className={[
            // A soft hairline, not a stroke: the brand still separates from the
            // nav without a bright line across the panel.
            "flex h-[4.75rem] shrink-0 items-center shadow-[0_1px_0_rgba(255,255,255,0.05)]",
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
            <span
              className={[
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.82),rgba(239,232,214,0.56)_38%,rgba(255,255,255,0.12)_100%)] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-18px_30px_rgba(35,69,158,0.16),0_18px_34px_-26px_rgba(239,232,214,0.8)]",
                collapsed ? "lg:hidden" : ""
              ].join(" ")}
            >
              <span
                aria-hidden
                className="absolute inset-1.5 rounded-xl bg-[#274ca9]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              />
              <HelixMark className="relative h-5 w-5 drop-shadow-[0_2px_8px_rgba(20,42,109,0.28)]" />
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
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-cream/60 transition hover:bg-cream/10 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/50 lg:hidden"
          >
            <X size={17} aria-hidden="true" />
          </button>

          {/* Sits top-right beside the wordmark, and centres itself in the
              collapsed rail so it never floats over the page edge. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-cream/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-white/[0.1] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40 lg:flex",
              collapsed ? "lg:mx-auto" : "ml-auto"
            ].join(" ")}
          >
            {/* One calm glyph for both states, the way editors do it — the
                arrow-in-panel variants turn to mush at this size. */}
            <PanelLeft size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-5">
          <Link
            href="/interview"
            title={collapsed ? "Start an interview" : undefined}
            onClick={() => setMenuOpen(false)}
            className={[
              "mb-6 flex h-12 shrink-0 items-center gap-3 rounded-2xl bg-cream px-3 font-semibold text-[#23459e] shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70",
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
                    "mb-2.5 px-3.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/28",
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
                          "group relative flex h-12 items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none transition",
                          collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
                          active
                            ? "bg-cream/[0.16] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_14px_34px_-26px_rgba(5,14,45,0.75)]"
                            : "text-cream/62 hover:bg-white/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40"
                        ].join(" ")}
                      >
                        {active ? (
                          <span className="absolute inset-y-3 left-1 w-[3px] rounded-full bg-cream" />
                        ) : null}
                        <NavPending />
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

        {/* Account card: the avatar opens Clerk's menu, the name goes to the
            profile, so both actions are reachable without a hidden hover. */}
        <div
          className={[
            "relative shrink-0 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
            collapsed ? "lg:px-0 lg:py-4 lg:shadow-none" : ""
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center gap-3 rounded-3xl bg-white/[0.06] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_16px_34px_-28px_rgba(5,14,45,0.85)]",
              collapsed
                ? "lg:mx-auto lg:h-14 lg:w-14 lg:justify-center lg:rounded-full lg:bg-white/[0.07] lg:p-0 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_42px_-30px_rgba(5,14,45,0.9)]"
                : ""
            ].join(" ")}
          >
            <UserButton
              userProfileProps={{ appearance: userProfileAppearance }}
              appearance={{
                elements: {
                  // Clerk's root box is 100% wide by default. Unpinned it ate
                  // the whole row once a session existed, collapsing the name
                  // beside it to zero width.
                  rootBox: "!h-9 !w-9 !shrink-0 !grow-0",
                  userButtonBox: "!h-9 !w-9",
                  userButtonTrigger:
                    "!rounded-full focus:!shadow-none focus-visible:!ring-2 focus-visible:!ring-cream/40",
                  avatarBox: "!h-9 !w-9 !shadow-[inset_0_0_0_1px_rgba(239,232,214,0.18)]"
                }
              }}
            />
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className={[
                "min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-cream/40",
                collapsed ? "lg:hidden" : ""
              ].join(" ")}
            >
              <span className="block truncate text-sm font-semibold text-cream">
                {userName || "Your account"}
              </span>
              <span className="block truncate text-[11px] text-cream/45">View profile</span>
            </Link>
            <ChevronRight
              size={15}
              aria-hidden="true"
              className={["shrink-0 text-cream/30", collapsed ? "lg:hidden" : ""].join(" ")}
            />
          </div>
          <SignOutButton redirectUrl="/">
            <button
              type="button"
              title={collapsed ? "Log out" : undefined}
              className={[
                "mt-2 flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-cream/58 outline-none transition hover:bg-white/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40",
                collapsed ? "lg:mx-auto lg:h-11 lg:w-11 lg:justify-center lg:gap-0 lg:px-0" : ""
              ].join(" ")}
            >
              <LogOut size={17} aria-hidden="true" />
              <span className={collapsed ? "lg:hidden" : ""}>Log out</span>
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Stays put while the page scrolls, so the drawer is always one tap away. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#4968b8]/88 px-3 shadow-[inset_0_-1px_0_rgba(239,232,214,0.08)] backdrop-blur-xl lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream/[0.08] text-cream shadow-[inset_0_1px_0_rgba(239,232,214,0.12)] transition hover:bg-cream/12 focus-visible:ring-2 focus-visible:ring-cream/50"
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
                avatarBox: "!h-9 !w-9 !shadow-[inset_0_0_0_1px_rgba(239,232,214,0.18)]"
              }
            }}
          />
        </div>
      </header>

      {/* The workspace surface: a panel floating on the darker page, matching
          the sidebar's inset so the two read as one piece of chrome. */}
      <main
        key={pathname}
        className="route-enter relative z-10 min-h-[calc(100vh-1.5rem)] overflow-hidden bg-gradient-to-b from-[#1c3a8e] via-[#1a3583] to-[#162e73] shadow-[0_2px_10px_rgba(4,11,38,0.3)] lg:rounded-2xl"
      >
        {children}
      </main>
    </div>
  );
}
