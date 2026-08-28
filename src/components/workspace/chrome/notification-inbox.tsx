"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { FaStar } from "react-icons/fa6";
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  HandHelping,
  Heart,
  Inbox,
  Target,
  TimerOff,
  UserCheck,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
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
  icon: ElementType;
  label: string;
  iconClass: string;
}

function notificationPresentation(kind: string, teacherName: string): NotificationPresentation {
  switch (kind) {
    case "TEACHER_WELCOME":
      return {
        icon: FaStar,
        label: `Welcome from ${teacherName}`,
        iconClass: "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
      };
    case "TEACHER_RECOMMENDATION":
      return {
        icon: Target,
        label: `Practice from ${teacherName}`,
        iconClass: "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
      };
    case "TEACHER_ENCOURAGEMENT":
      return {
        icon: Heart,
        label: `A note from ${teacherName}`,
        iconClass: "bg-[#f6b98a]/10 text-[#f6c9a6]"
      };
    case "TEACHER_REMINDER":
      return {
        icon: Clock3,
        label: `Reminder from ${teacherName}`,
        iconClass: "bg-[#efcf84]/10 text-[#efdba8]"
      };
    case "HELP_REQUEST_OPENED":
      return {
        icon: HandHelping,
        label: "Trailmate request",
        iconClass: "bg-[#71d6a5]/10 text-[#9be8c1]"
      };
    case "HELP_REQUEST_CLAIMED":
      return {
        icon: UserCheck,
        label: "Trailmate joined",
        iconClass: "bg-[#8fd6ff]/10 text-[#a8e1ff]"
      };
    case "HELP_REQUEST_RESOLVED":
      return {
        icon: CircleCheckBig,
        label: "Session completed",
        iconClass: "bg-[#71d6a5]/10 text-[#9be8c1]"
      };
    case "HELP_REQUEST_EXPIRED":
      return {
        icon: TimerOff,
        label: "Trailmate request closed",
        iconClass: "bg-cream/[0.055] text-cream/48"
      };
    case "HELP_FEEDBACK_RECEIVED":
      return {
        icon: Heart,
        label: "Mate thank-you",
        iconClass: "bg-[#f6b98a]/10 text-[#f6c9a6]"
      };
    default:
      return {
        icon: BellRing,
        label: "Trailgrad update",
        iconClass: "bg-cream/[0.055] text-cream/58"
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
                <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[var(--workspace-accent)] opacity-[0.14] blur-[90px]" />

                <header className="relative flex shrink-0 items-center justify-between gap-3 px-4 pb-4 pt-4 sm:gap-5 sm:px-6 sm:pb-5 sm:pt-6">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)] shadow-soft-inset sm:h-11 sm:w-11">
                      <BellRing size={19} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-cream sm:text-[17px]">
                        Notifications
                      </h2>
                      <p className="mt-0.5 truncate text-[11.5px] text-cream/42 sm:text-[12px]">
                        Coaching, reminders, and help activity
                      </p>
                    </div>
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
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cream/[0.05] text-cream/38">
                          <Inbox size={21} strokeWidth={1.6} aria-hidden="true" />
                        </span>
                        <p className="mt-4 text-[14px] font-semibold text-cream/70">
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

                      <div className="grid gap-2">
                        {items.map((item) => {
                          const presentation = notificationPresentation(item.kind, teacher.name);
                          const NotificationIcon = presentation.icon;
                          const content = (
                            <div className="relative flex min-w-0 gap-3 p-3.5 sm:gap-4 sm:p-[1.125rem]">
                              {!item.read ? (
                                <span className="absolute left-1 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-[var(--workspace-accent)]" />
                              ) : null}
                              <span
                                className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-soft-inset sm:h-11 sm:w-11 ${presentation.iconClass}`}
                              >
                                <NotificationIcon size={18} strokeWidth={1.7} aria-hidden="true" />
                                {!item.read ? (
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_0_3px_#18191c]" />
                                ) : null}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.145em] text-[var(--workspace-accent)]">
                                    {presentation.label}
                                  </p>
                                  <time
                                    dateTime={new Date(item.createdAt).toISOString()}
                                    className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-cream/30"
                                  >
                                    <Clock3 size={11} strokeWidth={1.6} aria-hidden="true" />
                                    {relativeTime(item.createdAt)}
                                  </time>
                                </div>
                                <div className="mt-1 flex items-start gap-3">
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
                            </div>
                          );

                          return item.href ? (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={`group block overflow-hidden rounded-2xl outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] ${
                                item.read
                                  ? "bg-cream/[0.024] hover:bg-cream/[0.045]"
                                  : "bg-[var(--workspace-accent-soft)] hover:brightness-110"
                              }`}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div
                              key={item.id}
                              className={`overflow-hidden rounded-2xl ${
                                item.read ? "bg-cream/[0.024]" : "bg-[var(--workspace-accent-soft)]"
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
