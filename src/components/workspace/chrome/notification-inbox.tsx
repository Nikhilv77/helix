"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  ChevronRight,
  HandHelping,
  MessageCircleHeart,
  Route,
  TimerOff,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { InterviewerPersona } from "@/lib/avatars/personas";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { ProfileAvatar } from "@/components/workspace/profile/profile-avatar";
import {
  useWorkspaceNotifications,
  type NotificationSender
} from "./workspace-notification-polling";

interface NotificationPresentation {
  label: string;
  icon: LucideIcon;
  teacher: boolean;
}

function notificationPresentation(kind: string, teacherName: string): NotificationPresentation {
  switch (kind) {
    case "TEACHER_WELCOME":
      return {
        label: `Welcome from ${teacherName}`,
        icon: Route,
        teacher: true
      };
    case "TEACHER_RECOMMENDATION":
      return {
        label: `Practice from ${teacherName}`,
        icon: Route,
        teacher: true
      };
    case "TEACHER_ENCOURAGEMENT":
      return {
        label: `A note from ${teacherName}`,
        icon: Route,
        teacher: true
      };
    case "TEACHER_REMINDER":
      return {
        label: `Reminder from ${teacherName}`,
        icon: Route,
        teacher: true
      };
    case "HELP_REQUEST_OPENED":
      return {
        label: "Trailmate request",
        icon: HandHelping,
        teacher: false
      };
    case "HELP_REQUEST_CLAIMED":
      return {
        label: "Trailmate joined",
        icon: UsersRound,
        teacher: false
      };
    case "HELP_REQUEST_RESOLVED":
      return {
        label: "Session completed",
        icon: BadgeCheck,
        teacher: false
      };
    case "HELP_REQUEST_EXPIRED":
      return {
        label: "Trailmate request closed",
        icon: TimerOff,
        teacher: false
      };
    case "HELP_FEEDBACK_RECEIVED":
      return {
        label: "Mate thank-you",
        icon: MessageCircleHeart,
        teacher: false
      };
    default:
      return {
        label: "Trailgrad update",
        icon: Route,
        teacher: false
      };
  }
}

function NotificationSource({
  presentation,
  teacher,
  sender
}: {
  presentation: NotificationPresentation;
  teacher: InterviewerPersona;
  sender: NotificationSender | null;
}) {
  if (presentation.teacher) {
    return (
      <div
        aria-label={`${teacher.name}, your teacher`}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#202126] ring-1 ring-inset ring-white/[0.09]"
      >
        <Image src={teacher.portrait} alt="" fill sizes="44px" className="object-cover" />
      </div>
    );
  }

  if (sender) {
    return (
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#202126] ring-1 ring-inset ring-white/[0.09]">
        {sender.profileImage ? (
          <Image
            src={sender.profileImage}
            alt={`${sender.label} profile`}
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : (
          <ProfileAvatar name={sender.label} className="h-full w-full object-cover" />
        )}
      </div>
    );
  }

  const Icon = presentation.icon;
  return (
    <span
      aria-hidden="true"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-cream/[0.055] text-cream/64 ring-1 ring-inset ring-white/[0.075]"
    >
      <Icon size={18} strokeWidth={1.65} />
    </span>
  );
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
 * Both responsive placements share one visibility-aware polling provider, so
 * the hidden copy never doubles the background requests.
 */
export function NotificationInbox({ onOpen }: { onOpen?: () => void } = {}) {
  const teacher = useWorkspaceTeacher();
  const { items, unread, refresh, markRead, markAllRead } = useWorkspaceNotifications();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  // Opening the panel acknowledges only the rows actually rendered. This is
  // deliberately id-based: a new row arriving during the request, or an older
  // unread row beyond this page, has not been seen and must retain its badge.
  useEffect(() => {
    const visibleUnreadIds = items.filter((item) => !item.read).map((item) => item.id);
    if (!open || visibleUnreadIds.length === 0) return;

    void markRead(visibleUnreadIds);
  }, [items, markRead, open]);

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

  const toggleOpen = () => {
    if (!open) {
      onOpen?.();
      void refresh();
    }
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

                <div className="thin-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 pb-2.5 pt-4 [scrollbar-gutter:stable] sm:px-4 sm:pb-4 sm:pt-5">
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
                      <div className="flex items-center justify-between px-2 pb-3 sm:px-2 sm:pb-3.5">
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
                            <div className="relative flex min-w-0 items-start gap-3.5 px-4 py-4 sm:gap-4 sm:px-5 sm:py-[1.125rem]">
                              {!item.read ? (
                                <span className="absolute bottom-4 left-0 top-4 w-0.5 rounded-full bg-[var(--workspace-accent)]" />
                              ) : null}
                              <NotificationSource
                                presentation={presentation}
                                teacher={teacher}
                                sender={item.sender}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3 pt-0.5">
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
