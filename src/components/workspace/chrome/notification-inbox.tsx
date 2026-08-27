"use client";

import Link from "next/link";
import { Bell, CheckCheck, Sparkles } from "lucide-react";
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
const POLL_MS = 60_000;

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
 * Polls rather than holding a socket open. At the volume notifications actually
 * arrive, a request a minute costs less than the connection it would replace,
 * and it degrades to "slightly late" instead of "silently disconnected".
 */
export function NotificationInbox() {
  const teacher = useWorkspaceTeacher();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

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
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
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
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-cream/58 transition hover:bg-cream/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <Bell size={19} strokeWidth={1.75} aria-hidden="true" />
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

      {open ? (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-cream/12 bg-[#16171a] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.95)] md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-[21rem]">
          <div className="flex items-center justify-between gap-3 border-b border-cream/8 px-4 py-3">
            <span className="text-[13.5px] font-semibold text-cream">Notifications</span>
            {unread ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-cream/48 transition hover:text-cream/82"
              >
                <CheckCheck size={13} aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-7 text-center text-[13px] text-cream/40">Nothing yet.</p>
            ) : (
              items.map((item) => {
                const teacherAuthored = item.kind.startsWith("TEACHER_");
                const content = (
                  <div className="flex gap-2.5">
                    {teacherAuthored ? (
                      <span className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
                        <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
                        {!item.read ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--workspace-accent)]" />
                        ) : null}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.read ? "bg-transparent" : "bg-[var(--workspace-accent)]"
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {teacherAuthored ? (
                        <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
                          From {teacher.name}
                        </p>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px] font-semibold leading-5 text-cream">
                          {item.title}
                        </p>
                        <time
                          dateTime={new Date(item.createdAt).toISOString()}
                          className="shrink-0 text-[10.5px] text-cream/35"
                        >
                          {relativeTime(item.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-5 text-cream/60">{item.body}</p>
                    </div>
                  </div>
                );

                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-cream/[0.05] px-4 py-3 transition hover:bg-cream/[0.04] ${
                      item.read ? "" : "bg-cream/[0.025]"
                    }`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.id}
                    className={`border-b border-cream/[0.05] px-4 py-3 ${
                      item.read ? "" : "bg-cream/[0.025]"
                    }`}
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/manage#notifications"
            onClick={() => setOpen(false)}
            className="flex h-10 items-center justify-center border-t border-cream/[0.07] text-[11.5px] font-medium text-cream/42 transition hover:bg-cream/[0.035] hover:text-cream/72"
          >
            Notification settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
