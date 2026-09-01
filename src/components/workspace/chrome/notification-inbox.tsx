"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

interface InboxItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: number;
}

/** Quiet enough not to nag, frequent enough that a waiting learner is not stale. */
const POLL_MS = 15_000;

interface NotificationPresentation {
  label: string;
}

function notificationPresentation(kind: string, teacherName: string): NotificationPresentation {
  switch (kind) {
    case "TEACHER_WELCOME":
      return {
        label: `Welcome from ${teacherName}`
      };
    case "TEACHER_RECOMMENDATION":
      return {
        label: `Practice from ${teacherName}`
      };
    case "TEACHER_ENCOURAGEMENT":
      return {
        label: `A note from ${teacherName}`
      };
    case "TEACHER_REMINDER":
      return {
        label: `Reminder from ${teacherName}`
      };
    case "HELP_REQUEST_OPENED":
      return {
        label: "Trailmate request"
      };
    case "HELP_REQUEST_CLAIMED":
      return {
        label: "Trailmate joined"
      };
    case "HELP_REQUEST_RESOLVED":
      return {
        label: "Session completed"
      };
    case "HELP_REQUEST_EXPIRED":
      return {
        label: "Trailmate request closed"
      };
    case "HELP_FEEDBACK_RECEIVED":
      return {
        label: "Mate thank-you"
      };
    default:
      return {
        label: "Trailgrad update"
      };
  }
}

function relativeTime(createdAt: number): string {
  const minutes = Math.max(1, Math.floor((Date.now() - createdAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * The inbox, in the workspace header.
 *
 * Polls while the workspace is visible rather than holding a socket open, and
 * refreshes immediately when the window regains focus. Delivery therefore
 * degrades to "slightly late" instead of "silently disconnected".
 */
export function NotificationInbox({ onOpen }: { onOpen?: () => void } = {}) {
  const teacher = useWorkspaceTeacher();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.success || !payload.data) return;

      setItems(payload.data.items ?? []);
      setUnread(payload.data.unread ?? 0);
    } catch {
      // An inbox that cannot load is not worth an error surface of its own.
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refreshVisible, POLL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load]);

  // Opening the panel acknowledges only the rows actually rendered. This is
  // deliberately id-based: a new row arriving during the request, or an older
  // unread row beyond this page, has not been seen and must retain its badge.
  useEffect(() => {
    const visibleUnreadIds = items.filter((item) => !item.read).map((item) => item.id);
    if (!open || visibleUnreadIds.length === 0) return;

    void fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: visibleUnreadIds })
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json().catch(() => null);
        return payload?.success ? payload : null;
      })
      .then((payload) => {
        if (!payload) return;
        const visible = new Set(visibleUnreadIds);
        setUnread((current) => Math.max(0, current - (payload.data?.marked ?? 0)));
        setItems((current) =>
          current.map((item) => (visible.has(item.id) ? { ...item, read: true } : item))
        );
      })
      .catch(() => undefined);
  }, [items, open]);

  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !dialog.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 767px)").matches) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return;
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch {
      // Keep the local unread state authoritative until a successful write.
    }
  }, [unread]);

  const toggleOpen = () => {
    if (!open) onOpen?.();
    setOpen((current) => !current);
  };

  return (
    <div ref={trigger} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-cream/58 transition hover:bg-cream/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <Bell size={22} strokeWidth={1.8} aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-[#17181b]"
            style={{ background: "var(--workspace-accent)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-[3px] md:pointer-events-none md:bg-transparent md:backdrop-blur-none">
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                className="pointer-events-auto fixed inset-2 flex flex-col overflow-hidden rounded-[1.5rem] bg-[#151619]/[0.99] shadow-[0_36px_110px_-32px_rgba(0,0,0,0.98),0_12px_38px_-24px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.075] backdrop-blur-2xl md:inset-auto md:right-6 md:top-[4.75rem] md:h-[min(42rem,calc(100vh-6rem))] md:w-[32rem] md:rounded-[1.75rem] lg:w-[36rem]"
              >
                <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.065] px-4 pb-4 pt-4 sm:gap-5 sm:px-6 sm:pb-5 sm:pt-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h2 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-cream sm:text-[17px]">
                        Notifications
                      </h2>
                      {unread > 0 ? (
                        <span className="rounded-full bg-cream/[0.065] px-2 py-0.5 text-[10px] font-semibold text-cream/60">
                          {unread} new
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-[11.5px] text-cream/42 sm:text-[12px]">
                      Coaching, reminders, and help activity
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        aria-label="Mark all notifications as read"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cream/[0.045] px-2.5 text-[11.5px] font-medium text-cream/58 transition hover:bg-cream/[0.075] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/25 sm:px-3"
                      >
                        <CheckCheck size={14} aria-hidden="true" />
                        <span className="hidden sm:inline">Mark all read</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close notifications"
                      className="grid h-9 w-9 place-items-center rounded-xl text-cream/42 transition hover:bg-cream/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/25"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                </header>

                <div className="thin-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 pb-2.5 [scrollbar-gutter:stable] sm:px-4 sm:pb-4">
                  {items.length === 0 ? (
                    <div className="grid min-h-64 place-items-center rounded-[1.4rem] bg-cream/[0.022] px-6 py-12 text-center">
                      <div>
                        <span aria-hidden="true" className="mx-auto block h-px w-10 bg-cream/20" />
                        <p className="mt-5 text-[14px] font-semibold text-cream/70">
                          You’re all caught up
                        </p>
                        <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-5 text-cream/38">
                          New coaching notes and help activity will appear here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-2 pb-2 pt-1 sm:px-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/32">
                          Recent
                        </p>
                        <p className="text-[10.5px] text-cream/28">
                          {items.length} {items.length === 1 ? "update" : "updates"}
                        </p>
                      </div>

                      <div className="overflow-hidden rounded-xl bg-cream/[0.018] ring-1 ring-inset ring-white/[0.05]">
                        {items.map((item, index) => {
                          const presentation = notificationPresentation(item.kind, teacher.name);
                          const content = (
                            <div className="relative min-w-0 px-4 py-4 sm:px-5 sm:py-[1.125rem]">
                              {!item.read ? (
                                <span className="absolute bottom-4 left-0 top-4 w-0.5 rounded-full bg-[var(--workspace-accent)]" />
                              ) : null}
                              <div className="flex items-center justify-between gap-3">
                                <p
                                  className={`truncate text-[9.5px] font-semibold uppercase tracking-[0.145em] ${item.read ? "text-cream/34" : "text-cream/62"}`}
                                >
                                  {presentation.label}
                                </p>
                                <time
                                  dateTime={new Date(item.createdAt).toISOString()}
                                  className="shrink-0 text-[10.5px] tabular-nums text-cream/30"
                                >
                                  {relativeTime(item.createdAt)}
                                </time>
                              </div>
                              <div className="mt-1.5 flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[14px] font-semibold leading-5.5 tracking-[-0.01em] text-cream/92">
                                    {item.title}
                                  </p>
                                  <p className="mt-1.5 text-[12.75px] leading-[1.6] text-cream/52">
                                    {item.body}
                                  </p>
                                </div>
                                {item.href ? (
                                  <ChevronRight
                                    size={16}
                                    className="mt-0.5 shrink-0 text-cream/20 transition duration-200 group-hover:translate-x-0.5 group-hover:text-cream/55"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </div>
                            </div>
                          );

                          return item.href ? (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={`group block outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream/30 ${index > 0 ? "border-t border-white/[0.055]" : ""} ${
                                item.read
                                  ? "hover:bg-cream/[0.035]"
                                  : "bg-cream/[0.04] hover:bg-cream/[0.06]"
                              }`}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div
                              key={item.id}
                              className={`${index > 0 ? "border-t border-white/[0.055]" : ""} ${
                                item.read ? "" : "bg-cream/[0.04]"
                              }`}
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>,
            trigger.current?.closest(".workspace-black") ?? document.body
          )
        : null}
    </div>
  );
}
