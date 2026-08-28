"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { GoSidebarCollapse } from "react-icons/go";
import { NotificationInbox } from "./notification-inbox";
import {
  Braces,
  BookOpen,
  ChartNoAxesCombined,
  ClipboardList,
  FileQuestion,
  House,
  HandHelping,
  Loader2,
  LogOut,
  Menu,
  Mic,
  Search,
  Settings,
  StickyNote,
  UserRound,
  X
} from "lucide-react";
import { ProfileAvatar } from "@/components/workspace/profile/profile-avatar";
import { HelpRequestToast } from "@/components/workspace/help/help-request-toast";
import { ActivePeerHelpToast } from "@/components/workspace/help/active-peer-help-toast";
import { CurrentPeerHelpPrompt } from "@/components/workspace/help/current-peer-help-prompt";
import { getWorkspaceAccent, searchWorkspace } from "@/lib/api/api-client";
import {
  WORKSPACE_SEARCH_GROUPS,
  type WorkspaceSearchKind,
  type WorkspaceSearchResult
} from "@/lib/search/workspace-search";
import {
  DEFAULT_WORKSPACE_ACCENT,
  type WorkspaceAccent,
  WORKSPACE_ACCENT_CHANGE_EVENT
} from "@/lib/workspace/accent";
import { isWorkspaceChromeRoute } from "@/lib/workspace/workspace-routes";
import { useWorkspaceProfileImage } from "@/lib/workspace/profile-image";

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
    label: "Community",
    items: [{ label: "Peer help", href: "/help", icon: HandHelping }]
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

function WorkspaceSearch({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const resultsId = mobile ? "workspace-search-results-mobile" : "workspace-search-results-desktop";

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, [pathname]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const mobileViewport = window.matchMedia("(max-width: 767px)").matches;
      if (mobileViewport !== mobile) return;
      event.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [mobile]);

  useEffect(() => {
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const timer = window.setTimeout(() => {
      void searchWorkspace(normalizedQuery, controller.signal)
        .then((response) => {
          setResults(response.results);
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !searchRef.current?.contains(target)) setOpen(false);
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

  const chooseResult = (result: WorkspaceSearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      chooseResult(results[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      ref={searchRef}
      className={mobile ? "relative w-[min(14rem,calc(100vw-4.75rem))]" : "relative w-60"}
    >
      <label className="relative block">
        <span className="sr-only">Search workspace</span>
        <Search
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream/42"
        />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onSearchKeyDown}
          placeholder="Search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && Boolean(normalizedQuery)}
          aria-controls={resultsId}
          aria-activedescendant={
            results[activeIndex] ? `${resultsId}-${results[activeIndex].id}` : undefined
          }
          className={[
            "w-full border border-white/[0.12] bg-[#17181b] pl-9 pr-3 text-cream outline-none placeholder:text-cream/38 transition hover:border-white/[0.18] hover:bg-[#1b1c20] focus:border-white/[0.12] focus:bg-[#17181b] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
            mobile ? "h-9 rounded-lg text-[0.8rem]" : "h-10 rounded-xl text-[0.84rem]"
          ].join(" ")}
        />
      </label>

      {open && normalizedQuery ? (
        <div
          id={resultsId}
          role="listbox"
          aria-label="Workspace search results"
          className={[
            "thin-scroll absolute top-[calc(100%+0.55rem)] z-50 max-h-[min(31rem,calc(100vh-5rem))] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#17181b] p-2 shadow-[0_28px_72px_-34px_rgba(0,0,0,0.98)]",
            mobile ? "left-0 w-[min(22rem,calc(100vw-4.5rem))]" : "left-0 w-[26rem]"
          ].join(" ")}
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-5 text-[0.8rem] text-cream/42">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Searching your workspace…
            </div>
          ) : failed ? (
            <p className="px-3 py-5 text-[0.8rem] text-cream/42">
              Search is unavailable right now.
            </p>
          ) : results.length ? (
            WORKSPACE_SEARCH_GROUPS.map((group) => {
              const groupResults = results.filter((result) => result.group === group);
              if (!groupResults.length) return null;

              return (
                <section key={group} aria-label={group} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-cream/30">
                    {group}
                  </p>
                  {groupResults.map((result) => {
                    const index = results.findIndex((item) => item.id === result.id);
                    const Icon = searchResultIcon(result.kind);
                    const active = index === activeIndex;
                    return (
                      <Link
                        id={`${resultsId}-${result.id}`}
                        role="option"
                        aria-selected={active}
                        key={result.id}
                        href={result.href}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={(event) => {
                          event.preventDefault();
                          chooseResult(result);
                        }}
                        className={[
                          "group flex items-start gap-3 rounded-xl px-3 py-2.5 outline-none transition",
                          active ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
                        ].join(" ")}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.045] text-cream/52 transition group-hover:text-cream/75">
                          <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-[0.84rem] font-semibold text-cream/82">
                              {result.title}
                            </span>
                            {result.badge ? (
                              <span className="shrink-0 text-[9.5px] text-cream/30">
                                {result.badge}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[0.72rem] leading-5 text-cream/38">
                            {result.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </section>
              );
            })
          ) : (
            <p className="px-3 py-5 text-[0.8rem] text-cream/42">
              No questions, notes, interviews, or pages found.
            </p>
          )}
          {loading && results.length > 0 ? (
            <Loader2
              size={13}
              className="absolute right-3 top-3 animate-spin text-cream/30"
              aria-label="Updating search results"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function searchResultIcon(kind: WorkspaceSearchKind) {
  if (kind === "question") return FileQuestion;
  if (kind === "practice") return BookOpen;
  if (kind === "interview") return Mic;
  if (kind === "note") return StickyNote;
  return Search;
}

// Deliberately still "helix:" after the Trailgrad rename. This key is already
// written in real browsers; renaming it would silently collapse every existing
// user's sidebar back to the default. Nobody sees the string.
const SIDEBAR_STORAGE_KEY = "helix:sidebar-collapsed";

/** Signed-in workspace chrome, mounted persistently but shown only on app routes. */
export function WorkspaceShell({
  children,
  initialAccent = DEFAULT_WORKSPACE_ACCENT,
  initialProfileImage = null
}: {
  children: ReactNode;
  initialAccent?: WorkspaceAccent;
  initialProfileImage?: string | null;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const showChrome = pathname ? isWorkspaceChromeRoute(pathname) : false;
  const userName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceAccent, setWorkspaceAccent] = useState<WorkspaceAccent>(initialAccent);
  const [accentShimmerKey, setAccentShimmerKey] = useState(0);
  const profileImage = useWorkspaceProfileImage(initialProfileImage);
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
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/practice") {
      return Boolean(pathname?.startsWith("/practice") || pathname?.startsWith("/dsa-questions"));
    }
    return Boolean(pathname?.startsWith(href));
  };

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

      <HelpRequestToast />
      <ActivePeerHelpToast />
      <CurrentPeerHelpPrompt />

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
            collapsed ? "md:w-20 md:gap-2 md:rounded-2xl md:py-4" : ""
          ].join(" ")}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "mb-2 hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-cream/62 outline-none transition-colors duration-300 ease-out hover:bg-white/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] md:grid",
              collapsed ? "md:h-12 md:w-12 md:rounded-xl" : ""
            ].join(" ")}
          >
            <GoSidebarCollapse
              size={collapsed ? 23 : 21}
              className={collapsed ? "rotate-180" : ""}
              aria-hidden="true"
            />
          </button>

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

          <Link
            href="/manage"
            aria-label="Settings"
            title="Settings"
            onClick={(event) => rememberManageOrigin(event.currentTarget)}
            className={[
              "mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-cream/58 outline-none transition-colors hover:bg-white/[0.06] hover:text-cream focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] md:grid",
              collapsed ? "md:h-12 md:w-12 md:rounded-xl" : ""
            ].join(" ")}
          >
            <Settings size={collapsed ? 22 : 20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        {/* Labelled panel — this is what collapses away. */}
        <div
          className={[
            "flex min-w-0 flex-1 flex-col overflow-x-hidden rounded-r-2xl bg-[#151619] px-3.5 pb-20 pt-3.5 md:py-3.5",
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

          <nav
            aria-label="Trail navigation"
            className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden md:mt-4"
          >
            {navGroups.map((group) => {
              return (
                <div key={group.label}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/42">
                    {group.label}
                  </p>

                  <div className="mt-1 space-y-0.5">
                    {group.items.map((item) => {
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

          <div className="mt-3 hidden shrink-0 items-center rounded-xl bg-black/15 px-3 py-2.5 md:flex">
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="group min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
            >
              <span className="block truncate text-[0.88rem] font-medium text-cream/88 transition-colors group-hover:text-cream">
                {userName || "Your account"}
              </span>
              <span className="block truncate text-[0.78rem] text-cream/42 transition-colors group-hover:text-cream/60">
                Profile
              </span>
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex h-16 items-center gap-2 border-t border-white/[0.07] bg-[#151619] px-3 md:hidden">
          <AvatarMenu
            profileImage={profileImage}
            name={userName}
            size="small"
            placement="sidebar"
          />
          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="min-w-0 flex-1 rounded-md outline-none"
          >
            <span className="block truncate text-[0.84rem] font-medium text-cream/88">
              {userName || "Your account"}
            </span>
            <span className="block text-[0.72rem] text-cream/42">Profile</span>
          </Link>
          <NotificationInbox onOpen={() => setMenuOpen(false)} />
        </div>
      </aside>

      <span
        aria-hidden="true"
        className={[
          "workspace-accent-rail pointer-events-none fixed top-[5%] z-40 hidden h-[90vh] w-[2px] rounded-full transition-[left,opacity] duration-300 md:block",
          collapsed ? "left-[5.5rem] opacity-90" : "left-[15.75rem] opacity-100"
        ].join(" ")}
      />

      <div
        className={[
          "fixed right-0 top-0 z-30 hidden h-[4.25rem] items-start justify-between bg-black px-5 pt-3 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex lg:px-7",
          collapsed ? "left-[7rem]" : "left-[17rem]"
        ].join(" ")}
      >
        <WorkspaceSearch />
        <div className="flex items-center gap-1.5">
          <NotificationInbox />
          <AvatarMenu profileImage={profileImage} name={userName} size="small" />
        </div>
      </div>

      {/* Stays put while the page scrolls, so the drawer is always one tap away. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#101113]/92 px-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl md:hidden">
        <WorkspaceSearch mobile />
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cream/80 outline-none transition-colors hover:bg-white/[0.06] hover:text-cream focus-visible:ring-2 focus-visible:ring-[#F26E01]/45"
        >
          <Menu size={25} strokeWidth={1.7} aria-hidden="true" />
        </button>
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
        <div aria-hidden="true" className="hidden h-[4.25rem] md:block" />
        {children}
      </main>
    </div>
  );
}

function AvatarMenu({
  profileImage,
  name,
  size,
  placement = "toolbar"
}: {
  profileImage?: string | null;
  name: string;
  size: "small" | "large";
  placement?: "toolbar" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        className="relative z-[60] rounded-full outline-none transition hover:scale-[1.03] focus-visible:opacity-75"
      >
        <PlainAvatar profileImage={profileImage} name={name} size={size} />
      </button>

      {open ? (
        <div
          className={[
            "account-menu-pop absolute z-[60] w-44 overflow-hidden rounded-lg border border-white/[0.14] bg-[#1b1d20] p-1.5 text-cream shadow-[0_24px_58px_-30px_rgba(0,0,0,0.96)]",
            placement === "sidebar"
              ? "bottom-[calc(100%+0.6rem)] left-0"
              : "right-0 top-[calc(100%+0.6rem)]"
          ].join(" ")}
        >
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.9rem] font-medium text-cream/86 outline-none transition-[background,color,transform] duration-200 ease-out hover:translate-x-0.5 hover:bg-cream/[0.09] hover:text-cream focus-visible:bg-cream/[0.09]"
          >
            <UserRound size={16} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
            Profile
          </Link>
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
  profileImage,
  name,
  size
}: {
  profileImage?: string | null;
  name: string;
  size: "small" | "large";
}) {
  const dimension = size === "large" ? "h-11 w-11" : "h-10 w-10";

  if (profileImage) {
    return (
      <img
        src={profileImage}
        alt={name ? `${name} avatar` : "Account avatar"}
        className={`${dimension} rounded-full object-cover`}
      />
    );
  }

  return (
    <ProfileAvatar name={name || "Trailgrad learner"} className={`${dimension} rounded-full`} />
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
