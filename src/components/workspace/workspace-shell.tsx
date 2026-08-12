"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useLinkStatus } from "next/link";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import {
  Braces,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  CircleUser,
  House,
  LogOut,
  Menu,
  Mic,
  PanelLeft,
  Search,
  X
} from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { userProfileAppearance } from "@/lib/clerk-theme";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Home", href: "/", icon: House },
      { label: "Practice", href: "/practice", icon: Braces },
      { label: "Interviews", href: "/interviews", icon: Mic },
      { label: "Progress", href: "/progress", icon: ChartNoAxesCombined },
      { label: "Reports", href: "/reports", icon: ClipboardList }
    ]
  },
  {
    label: "Account",
    items: [{ label: "My profile", href: "/profile", icon: CircleUser }]
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

// Deliberately still "helix:" after the Trailgrad rename. This key is already
// written in real browsers; renaming it would silently collapse every existing
// user's sidebar back to the default. Nobody sees the string.
const SIDEBAR_STORAGE_KEY = "helix:sidebar-collapsed";

/** Signed-in workspace chrome. Interview and onboarding routes stay distraction-free. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const userName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  // Chrome-free routes: the live interview room and onboarding.
  //
  // This was a `startsWith("/interview")` prefix test, which is also true for
  // "/interviews" — so the interviews *list* was rendered bare and lost its
  // sidebar, while every other page kept one. Match the room exactly, or a
  // path below it, and never the sibling route that merely shares a prefix.
  const isBareRoute = (path: string) =>
    path === "/interview" ||
    path.startsWith("/interview/") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/auth/continue");
  const bare = pathname ? isBareRoute(pathname) : false;

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    setMenuOpen(false);
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

  // Progress and Reports used to be hash links into other pages, matched here
  // against a `hash` state that no longer has anything to match — every row is
  // its own route now, so a plain path comparison is the whole rule.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

  if (bare) return <>{children}</>;

  return (
    <div
      className={[
        // overflow-x-clip, not overflow-hidden: `hidden` makes this a scroll
        // container, which silently kills the sticky mobile header inside it.
        //
        // No bg override: `.blueprint` already defines the workspace blue
        // (#22409b). Painting #0b1740 over it left a near-black base that only
        // looked blue where the glow gradient happened to be strong, so the
        // edges of every page read as black.
        "blueprint relative min-h-screen overflow-x-clip transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "md:pl-[5.5rem]" : "md:pl-[17rem]"
      ].join(" ")}
    >
      <div className="blueprint-glow" />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-blueprint-dark/70 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        className={[
          // Rail + panel, the way dense product consoles are built: a narrow
          // always-visible icon column, and a wider labelled panel that is what
          // actually collapses.
          "fixed inset-y-0 left-0 z-50 flex w-[min(16rem,calc(100vw-1rem))] overflow-hidden bg-[#2a4aa0] shadow-[0_24px_70px_-40px_rgba(4,12,45,0.9)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:inset-y-2 md:left-2 md:rounded-2xl",
          menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-[4.5rem]" : "md:w-[16rem]"
        ].join(" ")}
      >
        {/* Icon rail */}
        <div
          className={[
            // Expanded, the rail is the darker of two columns. Collapsed, it is
            // the whole sidebar, so it takes the lighter panel blue instead of
            // leaving a dark sliver against the page.
            "flex w-[3.5rem] shrink-0 flex-col items-center gap-1 py-3 transition-colors duration-300",
            collapsed ? "md:w-[4.5rem] md:gap-1.5 md:py-4" : "",
            collapsed ? "md:bg-[#3557b4]" : "",
            "bg-[#254294]"
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label="Trailgrad home"
            className={[
              "mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-[0.5rem] bg-[#1E3A8F] transition hover:bg-[#254294]",
              collapsed ? "md:h-11 md:w-11" : ""
            ].join(" ")}
          >
            <TrailgradMark
              className={collapsed ? "h-[1.4rem] w-[1.4rem]" : "h-[1.15rem] w-[1.15rem]"}
            />
          </Link>

          {navGroups
            .flatMap((group) => group.items)
            .map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={`rail-${item.href}`}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-cream/50",
                    collapsed ? "md:h-11 md:w-11" : "",
                    active
                      ? "bg-cream/[0.18] text-cream"
                      : "text-cream/50 hover:bg-cream/[0.09] hover:text-cream"
                  ].join(" ")}
                >
                  <Icon
                    size={collapsed ? 20 : 17}
                    strokeWidth={active ? 2.1 : 1.7}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}

          <span className="flex-1" />

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-cream/45 outline-none transition hover:bg-cream/[0.09] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40 md:grid",
              collapsed ? "md:h-11 md:w-11" : ""
            ].join(" ")}
          >
            <PanelLeft size={collapsed ? 18 : 16} aria-hidden="true" />
          </button>

          <SignOutButton redirectUrl="/">
            <button
              type="button"
              title="Log out"
              aria-label="Log out"
              className={[
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-cream/45 outline-none transition hover:bg-cream/[0.09] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40",
                collapsed ? "md:h-11 md:w-11" : ""
              ].join(" ")}
            >
              <LogOut size={collapsed ? 18 : 16} aria-hidden="true" />
            </button>
          </SignOutButton>

          <div
            className={[
              "mt-1 grid h-9 w-9 shrink-0 place-items-center",
              collapsed ? "md:h-11 md:w-11" : ""
            ].join(" ")}
          >
            <UserButton
              userProfileProps={{ appearance: userProfileAppearance }}
              appearance={{
                elements: {
                  // Clerk sizes its avatar in fixed classes, so it has to be
                  // told about the collapsed rail too or it stays small beside
                  // the larger icons.
                  rootBox: collapsed
                    ? "!h-9 !w-9 !shrink-0 !grow-0"
                    : "!h-8 !w-8 !shrink-0 !grow-0",
                  userButtonBox: collapsed ? "!h-9 !w-9" : "!h-8 !w-8",
                  userButtonTrigger:
                    "!rounded-full focus:!shadow-none focus-visible:!ring-2 focus-visible:!ring-cream/40",
                  avatarBox: collapsed
                    ? "!h-9 !w-9 !shadow-[inset_0_0_0_1px_rgba(239,232,214,0.2)]"
                    : "!h-8 !w-8 !shadow-[inset_0_0_0_1px_rgba(239,232,214,0.2)]"
                }
              }}
            />
          </div>
        </div>

        {/* Labelled panel — this is what collapses away. */}
        <div
          className={[
            "flex min-w-0 flex-1 flex-col bg-[#3557b4] px-3 py-3.5",
            collapsed ? "md:hidden" : ""
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-cream">
              Workspace
            </p>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-cream/55 transition hover:bg-cream/[0.09] hover:text-cream md:hidden"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <label className="relative mt-3 block">
            <span className="sr-only">Filter navigation</span>
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-cream/45"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-8 w-full rounded-lg bg-[#2a4aa0]/70 pl-8 pr-2.5 text-[13px] text-cream placeholder:text-cream/40 outline-none transition focus:bg-[#2a4aa0] focus-visible:ring-2 focus-visible:ring-cream/30"
            />
          </label>

          <Link
            href="/interview"
            onClick={() => setMenuOpen(false)}
            className="mt-3 flex h-9 shrink-0 items-center gap-2.5 rounded-lg bg-cream px-3 text-[13px] font-semibold text-[#254294] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Mic size={15} aria-hidden="true" />
            Start interview
          </Link>

          <nav
            aria-label="Workspace navigation"
            className="thin-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
          >
            {navGroups.map((group) => {
              const items = group.items.filter((item) =>
                item.label.toLowerCase().includes(query.trim().toLowerCase())
              );
              if (!items.length) return null;

              return (
                <div key={group.label}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-cream/45">
                    {group.label}
                  </p>

                  <div className="mt-1 space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          // Hash links keep the same pathname, so the route
                          // effect never fires and the drawer would stay open.
                          onClick={() => setMenuOpen(false)}
                          className={[
                            "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium outline-none transition",
                            active
                              ? "bg-cream/[0.18] text-cream"
                              : "text-cream/62 hover:bg-cream/[0.09] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40"
                          ].join(" ")}
                        >
                          <NavPending />
                          <Icon
                            size={16}
                            strokeWidth={active ? 2.1 : 1.7}
                            className="shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="mt-3 flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-[13px] outline-none transition hover:bg-cream/[0.07] focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-cream/90">
                {userName || "Your account"}
              </span>
              <span className="block truncate text-[11px] text-cream/45">View profile</span>
            </span>
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-cream/30" />
          </Link>
        </div>
      </aside>

      {/* Stays put while the page scrolls, so the drawer is always one tap away. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#4968b8]/88 px-3 shadow-[inset_0_-1px_0_rgba(239,232,214,0.08)] backdrop-blur-xl md:hidden">
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
                avatarBox: "!h-7 !w-7 !shadow-[inset_0_0_0_1px_rgba(239,232,214,0.16)]"
              }
            }}
          />
        </div>
      </header>

      {/* The workspace surface: a panel floating on the darker page, matching
          the sidebar's inset so the two read as one piece of chrome. */}
      <main
        key={pathname}
        // No background of its own: the .blueprint surface behind the whole
        // shell — grid, glow and all — carries through here, so the content
        // area and the area around the sidebar are literally the same surface
        // rather than two blues that nearly match.
        className="route-enter relative z-10 min-h-screen overflow-hidden"
      >
        {children}
      </main>
    </div>
  );
}
