"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import {
  Braces,
  ChartNoAxesCombined,
  ClipboardList,
  ChevronsRightLeft,
  House,
  LogOut,
  MessageCircle,
  Menu,
  Mic,
  Search,
  Settings,
  UserRound,
  X
} from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { getWorkspaceAccent } from "@/lib/api/api-client";
import {
  DEFAULT_WORKSPACE_ACCENT,
  type WorkspaceAccent,
  WORKSPACE_ACCENT_CHANGE_EVENT
} from "@/lib/workspace/accent";
import { isWorkspaceChromeRoute } from "@/lib/workspace/workspace-routes";

const navGroups = [
  {
    label: "Practice",
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

// Deliberately still "helix:" after the Trailgrad rename. This key is already
// written in real browsers; renaming it would silently collapse every existing
// user's sidebar back to the default. Nobody sees the string.
const SIDEBAR_STORAGE_KEY = "helix:sidebar-collapsed";

/** Signed-in workspace chrome, mounted persistently but shown only on app routes. */
export function WorkspaceShell({
  children,
  initialAccent = DEFAULT_WORKSPACE_ACCENT
}: {
  children: ReactNode;
  initialAccent?: WorkspaceAccent;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const showChrome = pathname ? isWorkspaceChromeRoute(pathname) : false;
  const userName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const userImage = user?.imageUrl;
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [workspaceAccent, setWorkspaceAccent] = useState<WorkspaceAccent>(initialAccent);
  const [accentShimmerKey, setAccentShimmerKey] = useState(0);
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!showChrome) return;

    let disposed = false;
    void getWorkspaceAccent()
      .then(({ accent }) => {
        if (!disposed) setWorkspaceAccent(accent);
      })
      .catch(() => {
        if (!disposed) setWorkspaceAccent(DEFAULT_WORKSPACE_ACCENT);
      });

    const onAccentChange = (event: Event) => {
      const accent = (event as CustomEvent<WorkspaceAccent>).detail;
      if (!accent) return;

      setWorkspaceAccent(accent);
      setAccentShimmerKey((current) => current + 1);
    };

    window.addEventListener(WORKSPACE_ACCENT_CHANGE_EVENT, onAccentChange);
    return () => {
      disposed = true;
      window.removeEventListener(WORKSPACE_ACCENT_CHANGE_EVENT, onAccentChange);
    };
  }, [showChrome]);

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

  if (!showChrome) return <>{children}</>;

  return (
    <div
      data-workspace-accent={workspaceAccent}
      className={[
        // overflow-x-clip, not overflow-hidden: `hidden` makes this a scroll
        // container, which silently kills the sticky mobile header inside it.
        //
        // No bg override: `.blueprint` owns the shared product canvas. The
        // grid and rails below keep the signed-in shell visually connected.
        "blueprint workspace-black relative min-h-screen overflow-x-clip transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "md:pl-[6rem]" : "md:pl-[16rem]"
      ].join(" ")}
    >
      {accentShimmerKey ? (
        <span
          key={accentShimmerKey}
          aria-hidden
          className="workspace-accent-change-shimmer pointer-events-none fixed z-[60]"
        />
      ) : null}

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        className={[
          // Rail + panel, the way dense product consoles are built: a narrow
          // always-visible icon column, and a wider labelled panel that is what
          // actually collapses.
          "fixed inset-y-0 left-0 z-50 flex w-[min(15rem,calc(100vw-1rem))] border-r border-white/[0.07] bg-[#111214] shadow-[18px_0_50px_-38px_rgba(0,0,0,0.9)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:inset-y-3 md:left-3 md:rounded-2xl md:border",
          menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-[5rem]" : "md:w-[15rem]"
        ].join(" ")}
      >
        {/* Icon rail */}
        <div
          className={[
            // Expanded, the rail is the darker of two columns. Collapsed, it is
            // the whole sidebar, so it uses the panel surface consistently.
            "flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-l-2xl bg-[#0d0e10] py-3 text-cream shadow-[inset_-1px_0_0_rgba(241,234,216,0.07)] backdrop-blur-xl transition-colors duration-300",
            collapsed ? "md:w-20 md:gap-2 md:py-4" : ""
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label="Trailgrad home"
            className={[
              "mb-2 grid h-10 w-10 shrink-0 place-items-center rounded-[0.5rem] text-cream transition-colors duration-300 ease-out hover:bg-white/[0.07]",
              collapsed ? "md:h-12 md:w-12" : ""
            ].join(" ")}
          >
            <TrailgradMark
              className={collapsed ? "h-[1.75rem] w-[1.75rem]" : "h-[1.45rem] w-[1.45rem]"}
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
                    "group relative grid h-10 w-10 shrink-0 place-items-center rounded-lg outline-none transition-[background,color,transform] duration-200 ease-out hover:translate-x-0.5 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-[#F26E01]/45",
                    collapsed ? "md:h-12 md:w-12" : "",
                    active ? "bg-[#F26E01]/[0.1] text-cream" : "text-cream/58 hover:text-cream"
                  ].join(" ")}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="workspace-accent-dot absolute right-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                    />
                  ) : null}
                  <Icon
                    size={collapsed ? 23 : 20}
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
              "hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-cream/62 outline-none transition-colors duration-300 ease-out hover:bg-white/[0.06] hover:text-cream focus-visible:ring-2 focus-visible:ring-[#F26E01]/40 md:grid",
              collapsed ? "md:h-12 md:w-12" : ""
            ].join(" ")}
          >
            <ChevronsRightLeft size={collapsed ? 24 : 21} aria-hidden="true" />
          </button>

          <div
            className={[
              "relative mt-1 grid h-10 w-10 shrink-0 place-items-center",
              collapsed ? "md:h-12 md:w-12" : ""
            ].join(" ")}
          >
            <AvatarMenu
              imageUrl={userImage}
              name={userName}
              size={collapsed ? "large" : "small"}
              placement="rail"
            />
          </div>
        </div>

        {/* Labelled panel — this is what collapses away. */}
        <div
          className={[
            "flex min-w-0 flex-1 flex-col overflow-x-hidden rounded-r-2xl bg-[#151619] px-3.5 py-3.5",
            collapsed ? "md:hidden" : ""
          ].join(" ")}
        >
          <div className="flex justify-end md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-cream/55 transition hover:bg-white/[0.07] hover:text-cream"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <label className="relative block md:mt-0">
            <span className="sr-only">Filter navigation</span>
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-cream/45"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-lg border border-white/[0.07] bg-white/[0.035] pl-8 pr-2.5 text-[0.88rem] text-cream placeholder:text-cream/42 outline-none transition focus:border-white/[0.14] focus:bg-white/[0.055] focus-visible:ring-2 focus-visible:ring-white/[0.08]"
            />
          </label>

          <Link
            href="/interview?resume=1"
            onClick={() => setMenuOpen(false)}
            className="group mt-3 flex h-11 shrink-0 items-center gap-2.5 rounded-lg bg-cream px-3.5 text-[0.86rem] font-medium text-[#171a16] outline-none transition-colors duration-200 ease-out hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <MessageCircle
              size={18}
              strokeWidth={1.8}
              className="shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              aria-hidden="true"
            />
            Interview
          </Link>

          <nav
            aria-label="Trail navigation"
            className="thin-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden"
          >
            {navGroups.map((group) => {
              const items = group.items.filter((item) =>
                item.label.toLowerCase().includes(query.trim().toLowerCase())
              );
              if (!items.length) return null;

              return (
                <div key={group.label}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/42">
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
                            "group relative flex h-10 items-center gap-2.5 rounded-lg px-3 text-[0.9rem] font-medium outline-none transition-colors duration-200 ease-out hover:bg-white/[0.07]",
                            active
                              ? "bg-[#F26E01]/[0.1] text-cream"
                              : "text-cream/62 hover:text-cream focus-visible:ring-2 focus-visible:ring-[#F26E01]/40"
                          ].join(" ")}
                        >
                          {active ? (
                            <span
                              aria-hidden="true"
                              className="workspace-accent-indicator absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
                            />
                          ) : null}
                          <NavPending />
                          <Icon
                            size={17}
                            strokeWidth={active ? 2.1 : 1.7}
                            className="shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
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
            className="group mt-3 flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-black/15 px-3 py-3 text-[0.9rem] outline-none transition-[background,border-color] duration-200 ease-out hover:border-white/[0.14] hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-cream/88 transition-colors group-hover:text-cream">
                {userName || "Your account"}
              </span>
              <span className="block truncate text-[0.8rem] text-cream/45 transition-colors group-hover:text-cream/62">
                Profile
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <span
        aria-hidden="true"
        className={[
          "workspace-accent-rail pointer-events-none fixed top-[5%] z-40 hidden h-[90vh] w-[2px] rounded-full transition-[left,opacity] duration-300 md:block",
          collapsed ? "left-[5.5rem] opacity-90" : "left-[15.75rem] opacity-100"
        ].join(" ")}
      />

      {/* Stays put while the page scrolls, so the drawer is always one tap away. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-[#101113]/92 px-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cream/80 outline-none transition-colors hover:bg-white/[0.06] hover:text-cream focus-visible:ring-2 focus-visible:ring-[#F26E01]/45"
        >
          <Menu size={25} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <span className="flex-1" />
        {/*
         * Clerk's root box fills its flex parent by default. Left alone it took
         * the whole row the moment it hydrated, squeezing the title to nothing
         * and packing the controls to one side. The wrapper reserves exactly the
         * avatar's footprint, so nothing shifts when it loads.
         */}
        <div className="relative h-9 w-9 shrink-0">
          <AvatarMenu imageUrl={userImage} name={userName} size="small" placement="mobile" />
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

function AvatarMenu({
  imageUrl,
  name,
  size,
  placement
}: {
  imageUrl?: string;
  name: string;
  size: "small" | "large";
  placement: "rail" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPosition =
    placement === "rail" ? "bottom-0 left-[calc(100%+0.6rem)]" : "right-0 top-[calc(100%+0.6rem)]";

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!menuRef.current?.contains(target)) setOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative z-[60] rounded-full outline-none transition hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[#F26E01]/45"
      >
        <PlainAvatar imageUrl={imageUrl} name={name} size={size} />
      </button>

      {open ? (
        <div
          className={[
            "account-menu-pop absolute z-[60] w-44 overflow-hidden rounded-lg border border-white/[0.14] bg-[#1b1d20] p-1.5 text-cream shadow-[0_24px_58px_-30px_rgba(0,0,0,0.96)]",
            menuPosition
          ].join(" ")}
        >
          <Link
            href="/manage"
            onClick={(event) => {
              rememberManageOrigin(event.currentTarget);
              setOpen(false);
            }}
            className="group flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.9rem] font-medium text-cream/86 outline-none transition-[background,color,transform] duration-200 ease-out hover:translate-x-0.5 hover:bg-cream/[0.09] hover:text-cream focus-visible:bg-cream/[0.09]"
          >
            <Settings
              size={16}
              strokeWidth={1.8}
              className="shrink-0 transition-transform duration-200 ease-out group-hover:rotate-[-8deg]"
              aria-hidden="true"
            />
            Manage
          </Link>
          <SignOutButton redirectUrl="/">
            <button
              type="button"
              className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[0.9rem] font-medium text-cream/86 outline-none transition-[background,color,transform] duration-200 ease-out hover:translate-x-0.5 hover:bg-cream/[0.09] hover:text-cream focus-visible:bg-cream/[0.09]"
            >
              <LogOut
                size={16}
                strokeWidth={1.8}
                className="shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                aria-hidden="true"
              />
              Logout
            </button>
          </SignOutButton>
        </div>
      ) : null}
    </div>
  );
}

function PlainAvatar({
  imageUrl,
  name,
  size
}: {
  imageUrl?: string;
  name: string;
  size: "small" | "large";
}) {
  const dimension = size === "large" ? "h-11 w-11" : "h-9 w-9";
  const initials = initialsOf(name);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ? `${name} avatar` : "Account avatar"}
        className={`${dimension} rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-label={name ? `${name} avatar` : "Account avatar"}
      className={`${dimension} grid place-items-center rounded-full bg-cream/[0.12] text-sm font-semibold text-cream`}
    >
      {initials}
    </span>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "TG"
  );
}

function rememberManageOrigin(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const origin = {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2)
  };

  window.sessionStorage.setItem("trailgrad:manage-origin", JSON.stringify(origin));
}
