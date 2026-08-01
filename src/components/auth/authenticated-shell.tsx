"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, UserButton, useUser } from "@clerk/nextjs";
import {
  Activity,
  Bell,
  Check,
  ChevronRight,
  Command,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { listProjects, setAuthTokenProvider } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

interface AuthenticatedShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
  type: "link" | "templates" | "settings";
  href?: string;
}

const navItems: NavItem[] = [
  {
    label: "Portfolio",
    href: "/",
    icon: LayoutDashboard,
    description: "Projects and systems",
    type: "link"
  },
  {
    label: "New project",
    href: "/projects/new",
    icon: Plus,
    description: "Start a design space",
    type: "link"
  },
  {
    label: "Templates",
    icon: Layers,
    description: "Start from proven patterns",
    type: "templates"
  },
  {
    label: "Workspace settings",
    icon: Settings,
    description: "Theme and behavior",
    type: "settings"
  }
];

const projectTemplates = [
  {
    id: "notification-platform",
    name: "Notification platform",
    description: "Fanout, queues, delivery tracking, retries, and rate limits."
  },
  {
    id: "monitoring-system",
    name: "Monitoring system",
    description: "Metrics ingestion, time-series storage, alerting, and dashboards."
  },
  {
    id: "url-shortener",
    name: "URL shortener",
    description: "Short link creation, redirects, analytics, abuse controls, and cache."
  },
  {
    id: "chat-messaging",
    name: "Chat and messaging",
    description: "Realtime delivery, conversations, presence, notifications, and history."
  },
  {
    id: "payments",
    name: "Payment system",
    description: "Checkout, ledgers, idempotency, provider failures, and reconciliation."
  },
  {
    id: "feed-ranking",
    name: "Feed and ranking",
    description: "Content ingestion, ranking, fanout, personalization, and freshness."
  }
];

const initialNotifications = [
  {
    id: "clarifications",
    title: "Clarifications ready",
    description: "Answer the remaining architecture choices before capacity planning.",
    time: "Now"
  },
  {
    id: "capacity",
    title: "Capacity model updated",
    description: "Fresh estimates are available after the latest requirement pass.",
    time: "8m"
  },
  {
    id: "review",
    title: "Validation queue clear",
    description: "No blocked design reviews in your personal workspace.",
    time: "24m"
  }
];

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const { getToken, isLoaded: authLoaded, isSignedIn: authSignedIn } = useAuth();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authProviderReady, setAuthProviderReady] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentProjectsLoading, setRecentProjectsLoading] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [denseMode, setDenseMode] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const workspaceSearchRef = useRef<HTMLInputElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = initialNotifications.filter(
    (notification) => !readNotificationIds.has(notification.id)
  ).length;
  const displayName = user?.firstName ?? user?.username ?? "Nikhil";

  const activeLabel = useMemo(() => {
    if (pathname?.startsWith("/projects/new")) return "New project";
    if (pathname?.startsWith("/projects/")) return "Portfolio";
    if (pathname?.startsWith("/design-sessions/")) return "Product build";
    return "Portfolio";
  }, [pathname]);

  useEffect(() => {
    if (!authLoaded || !authSignedIn) {
      setAuthTokenProvider(null);
      setAuthProviderReady(false);
      return;
    }

    setAuthTokenProvider(() => getToken());
    setAuthProviderReady(true);

    return () => {
      setAuthTokenProvider(null);
    };
  }, [authLoaded, authSignedIn, getToken]);

  useEffect(() => {
    setDenseMode(localStorage.getItem("helix:denseMode") === "true");
    setFocusMode(localStorage.getItem("helix:focusMode") !== "false");
    setReducedMotion(localStorage.getItem("helix:reducedMotion") === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("helix:denseMode", String(denseMode));
    localStorage.setItem("helix:focusMode", String(focusMode));
    localStorage.setItem("helix:reducedMotion", String(reducedMotion));
  }, [denseMode, focusMode, reducedMotion]);

  useEffect(() => {
    function focusWorkspaceSearch(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTypingTarget) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        workspaceSearchRef.current?.focus();
      }
    }

    document.addEventListener("keydown", focusWorkspaceSearch);
    return () => document.removeEventListener("keydown", focusWorkspaceSearch);
  }, []);

  const filteredRecentProjects = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return recentProjects;

    return recentProjects.filter((project) =>
      `${project.name} ${project.description ?? ""}`.toLowerCase().includes(query)
    );
  }, [recentProjects, workspaceSearch]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        notificationButtonRef.current?.contains(target) ||
        notificationPanelRef.current?.contains(target)
      ) {
        return;
      }

      setNotificationsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!settingsOpen && !templatesOpen) return;

    function closeDrawerOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setTemplatesOpen(false);
      }
    }

    document.addEventListener("keydown", closeDrawerOnEscape);
    return () => document.removeEventListener("keydown", closeDrawerOnEscape);
  }, [settingsOpen, templatesOpen]);

  useEffect(() => {
    if (!authProviderReady) {
      setRecentProjects([]);
      return;
    }

    let cancelled = false;

    async function loadRecentProjects() {
      setRecentProjectsLoading(true);

      try {
        const response = await listProjects({
          page: 1,
          limit: 5,
          sortBy: "updatedAt",
          sortOrder: "desc"
        });

        if (!cancelled) {
          setRecentProjects(response.projects);
        }
      } catch {
        if (!cancelled) {
          setRecentProjects([]);
        }
      } finally {
        if (!cancelled) {
          setRecentProjectsLoading(false);
        }
      }
    }

    void loadRecentProjects();

    return () => {
      cancelled = true;
    };
  }, [authProviderReady, pathname]);

  if (!authLoaded) {
    return <AuthenticatedShellLoading />;
  }

  if (!authSignedIn) {
    return <main>{children}</main>;
  }

  if (!authProviderReady) {
    return <AuthenticatedShellLoading />;
  }

  function markAllRead() {
    setReadNotificationIds(new Set(initialNotifications.map((notification) => notification.id)));
  }

  function toggleNotification(id: string) {
    setReadNotificationIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openTemplates() {
    setTemplatesOpen(true);
    setSettingsOpen(false);
    setSidebarOpen(false);
  }

  function openSettings() {
    setSettingsOpen(true);
    setTemplatesOpen(false);
    setSidebarOpen(false);
  }

  return (
    <div
      className={[
        "min-h-screen lg:pl-72",
        denseMode ? "text-[95%]" : "",
        focusMode ? "selection:bg-white/20" : "",
        reducedMotion ? "[&_*]:!transition-none" : ""
      ].join(" ")}
    >
      <button
        type="button"
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-[#0c0f15]/90 text-ink shadow-soft backdrop-blur lg:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-[#080a0f]/92 shadow-[28px_0_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        ].join(" ")}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-5">
          <Link href="/" className="group flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.045] transition group-hover:scale-105">
              <Image
                src="/brand/helix-icon.svg"
                alt=""
                width={28}
                height={28}
                priority
                unoptimized
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">Helix</span>
              <span className="block truncate text-xs text-muted">Personal architecture</span>
            </span>
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white/5 text-muted transition hover:border-white/20 hover:text-ink lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]">
          <label className="field flex min-h-10 items-center gap-3 rounded-md px-3">
            <Search size={16} className="text-muted" aria-hidden="true" />
            <input
              ref={workspaceSearchRef}
              value={workspaceSearch}
              onChange={(event) => setWorkspaceSearch(event.target.value)}
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
              placeholder="Search projects"
            />
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted">
              K
            </span>
          </label>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const portfolioActive =
                pathname === "/" ||
                Boolean(
                  pathname?.startsWith("/projects/") && !pathname.startsWith("/projects/new")
                ) ||
                Boolean(pathname?.startsWith("/design-sessions/"));
              const active =
                item.type === "templates"
                  ? templatesOpen
                  : item.type === "settings"
                    ? settingsOpen
                    : item.href === "/"
                      ? portfolioActive
                      : Boolean(item.href && pathname?.startsWith(item.href));
              const className = [
                "group flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5",
                active
                  ? "border-white/18 bg-white/[0.09] text-ink shadow-[0_16px_46px_rgba(255,255,255,0.045)]"
                  : "border-transparent text-muted hover:border-white/10 hover:bg-white/[0.055] hover:text-ink"
              ].join(" ");
              const content = (
                <>
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition",
                      active
                        ? "border-white/18 bg-white/[0.1] text-ink"
                        : "border-white/8 bg-white/[0.035] text-muted group-hover:text-ink"
                    ].join(" ")}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted/80">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-80"
                    aria-hidden="true"
                  />
                </>
              );

              if (item.type === "templates") {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={openTemplates}
                    className={className}
                  >
                    {content}
                  </button>
                );
              }

              if (item.type === "settings") {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={openSettings}
                    className={className}
                  >
                    {content}
                  </button>
                );
              }

              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={className}
                >
                  {content}
                </Link>
              ) : null;
            })}
          </nav>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Recent</p>
              <Link href="/" className="text-xs font-medium text-muted transition hover:text-ink">
                View all
              </Link>
            </div>
            <div className="space-y-1.5">
              {recentProjectsLoading ? (
                <div className="space-y-2 py-2">
                  <span className="block h-10 rounded-md bg-white/[0.055]" />
                  <span className="block h-10 rounded-md bg-white/[0.035]" />
                </div>
              ) : filteredRecentProjects.length > 0 ? (
                filteredRecentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 rounded-md border border-transparent px-2.5 py-2 transition hover:border-white/10 hover:bg-white/[0.055]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-xs font-semibold text-ink">
                      {project.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {project.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {formatDate(project.updatedAt)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-3">
                  <p className="text-sm font-medium text-ink">No recent projects</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Create or open a project and it will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Workflow
              </p>
              <Sparkles size={15} className="text-ink" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {["Requirements", "Capacity", "Architecture"].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/25 text-[11px] text-ink">
                    {index + 1}
                  </span>
                  <span className="text-sm text-muted">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#080a0f]/86 p-3">
          <div className="rounded-lg border border-white/10 bg-black/22 p-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <Activity size={16} aria-hidden="true" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.75)]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">Systems healthy</span>
                <span className="block truncate text-xs text-muted">
                  Local backend and workspace online
                </span>
              </span>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080a0f]/72 backdrop-blur-2xl">
        <div className="flex min-h-[70px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="ml-12 min-w-0 lg:ml-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Workspace</p>
            <h1 className="truncate text-base font-semibold text-ink">{activeLabel}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-muted md:inline-flex">
              <Command size={14} className="text-ink" aria-hidden="true" />
              {displayName}&apos;s workspace
            </span>
            <div className="relative">
              <button
                ref={notificationButtonRef}
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/5 text-muted transition hover:border-white/20 hover:bg-white/[0.08] hover:text-ink"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={16} aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#080a0f] bg-white px-1 text-[10px] font-semibold text-slate-950">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div
                  ref={notificationPanelRef}
                  className="fixed right-4 top-[82px] z-[90] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/14 bg-[#080a0f] shadow-[0_34px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/8"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.035] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Notifications</p>
                      <p className="text-xs text-muted">{unreadCount} unread updates</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/[0.055] px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-white/20 hover:text-ink"
                        onClick={markAllRead}
                      >
                        Mark all read
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.045] text-muted transition hover:border-white/20 hover:text-ink"
                        onClick={() => setNotificationsOpen(false)}
                        aria-label="Close notifications"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {initialNotifications.map((notification) => {
                      const read = readNotificationIds.has(notification.id);

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          className="group flex w-full gap-3 rounded-md border border-transparent px-3 py-3 text-left transition hover:border-white/8 hover:bg-white/[0.055]"
                          onClick={() => toggleNotification(notification.id)}
                        >
                          <span
                            className={[
                              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
                              read
                                ? "border-white/10 bg-white/[0.035] text-muted"
                                : "border-white/20 bg-white text-slate-950"
                            ].join(" ")}
                          >
                            {read ? <Check size={14} aria-hidden="true" /> : <Bell size={14} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-ink">
                                {notification.title}
                              </span>
                              <span className="text-xs text-muted">{notification.time}</span>
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-muted">
                              {notification.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10"
                }
              }}
            />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-70px)]">{children}</main>

      {templatesOpen || settingsOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setTemplatesOpen(false);
            setSettingsOpen(false);
          }}
          aria-label="Close workspace drawer"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 right-0 z-[90] w-[min(28rem,100vw)] border-l border-white/12 bg-[#080a0f] shadow-[0_0_120px_rgba(0,0,0,0.58)] transition-transform duration-300 ease-out",
          templatesOpen ? "translate-x-0" : "translate-x-full"
        ].join(" ")}
        aria-hidden={!templatesOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Templates</p>
            <h2 className="text-lg font-semibold text-ink">Start from a pattern</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white/5 text-muted transition hover:border-white/20 hover:text-ink"
            onClick={() => setTemplatesOpen(false)}
            aria-label="Close templates"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          {projectTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-white/10 bg-white/[0.045] p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-ink">
                  <FileText size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">{template.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{template.description}</p>
                  <Link
                    href={`/projects/new?template=${template.id}`}
                    onClick={() => setTemplatesOpen(false)}
                    className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-white bg-white px-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                  >
                    Use template
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <aside
        className={[
          "fixed inset-y-0 right-0 z-[90] w-[min(28rem,100vw)] border-l border-white/12 bg-[#080a0f] shadow-[0_0_120px_rgba(0,0,0,0.58)] transition-transform duration-300 ease-out",
          settingsOpen ? "translate-x-0" : "translate-x-full"
        ].join(" ")}
        aria-hidden={!settingsOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Settings</p>
            <h2 className="text-lg font-semibold text-ink">Workspace controls</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white/5 text-muted transition hover:border-white/20 hover:text-ink"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {[
            {
              label: "Dense project rows",
              description: "Use tighter spacing for project-heavy work.",
              value: denseMode,
              onChange: setDenseMode
            },
            {
              label: "Focus mode",
              description: "Keep the interface calm and reduce decorative contrast.",
              value: focusMode,
              onChange: setFocusMode
            },
            {
              label: "Reduced motion",
              description: "Limit hover lift and animated drawer movement.",
              value: reducedMotion,
              onChange: setReducedMotion
            }
          ].map((setting) => (
            <div
              key={setting.label}
              className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-4"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{setting.label}</p>
                <p className="mt-1 text-sm leading-5 text-muted">{setting.description}</p>
              </div>
              <button
                type="button"
                className={[
                  "relative h-7 w-12 shrink-0 rounded-full border transition",
                  setting.value
                    ? "border-white bg-white"
                    : "border-white/14 bg-white/[0.08] hover:border-white/24"
                ].join(" ")}
                onClick={() => setting.onChange(!setting.value)}
                aria-pressed={setting.value}
              >
                <span
                  className={[
                    "absolute top-1 h-5 w-5 rounded-full transition",
                    setting.value ? "left-6 bg-slate-950" : "left-1 bg-white/65"
                  ].join(" ")}
                />
              </button>
            </div>
          ))}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <SlidersHorizontal size={17} className="text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Local preferences</p>
                <p className="mt-1 text-sm leading-5 text-muted">
                  These controls update the current workspace shell immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AuthenticatedShellLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-card page-enter w-full max-w-md rounded-lg p-6">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.045]">
            <span className="absolute h-9 w-9 animate-spin rounded-full border border-transparent border-t-white/70" />
            <Image src="/brand/helix-icon.svg" alt="" width={28} height={28} priority unoptimized />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Opening Helix</p>
            <p className="mt-1 text-sm text-muted">Preparing your workspace session.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          <div className="shimmer h-2 rounded-full bg-white/8" />
          <div className="shimmer h-2 w-2/3 rounded-full bg-white/8" />
        </div>
      </div>
    </main>
  );
}
