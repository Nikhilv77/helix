"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  Flame,
  FileCheck2,
  HandHelping,
  MessageCircleHeart,
  Route,
  TimerOff,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { personaById, type InterviewerPersona } from "@/lib/avatars/personas";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useTheme } from "@/lib/theme/theme-context";
import { ProfileAvatar } from "@/features/profile/ui/profile-avatar";
import {
  useWorkspaceNotifications,
  type NotificationSender
} from "./workspace-notification-polling";

interface NotificationPresentation {
  label: string;
  icon: LucideIcon;
  teacher: boolean;
  personaId?: string;
  personaRole?: string;
}

function interviewReportPersonaId(title: string): "claire" | "james" | undefined {
  const normalizedTitle = title.trim().toLowerCase();

  if (/^(?:dsa|system design|core technical|dsa & design)\b/.test(normalizedTitle)) {
    return "claire";
  }
  if (/^(?:resume|hr)\b/.test(normalizedTitle)) {
    return "james";
  }

  return undefined;
}

function notificationPresentation(
  kind: string,
  teacherName: string,
  title: string
): NotificationPresentation {
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
    case "RESUME_ROAST_COMPLETED":
      return {
        label: "Resume Roast",
        icon: Flame,
        teacher: false,
        personaId: "james"
      };
    case "INTERVIEW_REPORT_READY":
      return {
        label: "Interview report",
        icon: FileCheck2,
        teacher: false,
        personaId: interviewReportPersonaId(title),
        personaRole: "interviewer"
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
  const { resolvedTheme } = useTheme();
  const persona = presentation.personaId
    ? personaById(presentation.personaId)
    : presentation.teacher
      ? teacher
      : null;
  // The standard portraits are shot on black; light mode uses the paper-
  // background set so the avatar does not sit on a dark square.
  const portrait =
    persona && resolvedTheme === "light"
      ? `/images/teacher-portraits/assessment-headsets/light/${persona.id}.jpg`
      : persona?.portrait;

  if (persona) {
    return (
      <div
        aria-label={
          presentation.teacher
            ? `${persona.name}, your teacher`
            : `${persona.name}, ${presentation.personaRole ?? "Resume Roast"}`
        }
        className="notification-source relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#202126]"
      >
        <Image
          src={portrait ?? persona.portrait}
          alt=""
          fill
          sizes="36px"
          className="object-cover object-[center_22%]"
        />
      </div>
    );
  }

  if (sender) {
    return (
      <div className="notification-source relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#202126]">
        {sender.profileImage ? (
          <Image
            src={sender.profileImage}
            alt={`${sender.label} profile`}
            fill
            sizes="36px"
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
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/[0.06] text-cream/60"
    >
      <Icon size={16} strokeWidth={1.6} />
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
        className="workspace-notification-trigger relative grid h-11 w-11 place-items-center rounded-xl text-cream/58 transition hover:bg-cream/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <Bell size={22} strokeWidth={1.8} aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            key={unread}
            className="workspace-notification-badge absolute right-1.5 top-1.5 grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full px-1 text-[0.62rem] font-semibold leading-none text-white tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="workspace-notification-backdrop fixed inset-0 z-[80] bg-black/65 backdrop-blur-[3px] md:pointer-events-none md:bg-transparent md:backdrop-blur-none">
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                className="workspace-notification-popover notification-pop pointer-events-auto fixed inset-2 flex flex-col overflow-hidden rounded-[1.5rem] bg-[#151619] shadow-[0_28px_80px_-36px_rgba(0,0,0,0.95)] md:inset-auto md:right-6 md:top-[4.75rem] md:max-h-[min(36rem,calc(100vh-6rem))] md:w-[25rem]"
              >
                <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-cream">
                      Notifications
                    </h2>
                    {unread > 0 ? (
                      <span className="workspace-notification-count rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums">
                        {unread} new
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        aria-label="Mark all notifications as read"
                        title="Mark all as read"
                        className="grid h-8 w-8 place-items-center rounded-lg text-cream/45 transition hover:bg-cream/[0.06] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/25"
                      >
                        <CheckCheck size={16} strokeWidth={1.6} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close notifications"
                      className="grid h-8 w-8 place-items-center rounded-lg text-cream/45 transition hover:bg-cream/[0.06] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/25"
                    >
                      <X size={16} strokeWidth={1.6} aria-hidden="true" />
                    </button>
                  </div>
                </header>

                <div className="thin-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-2">
                  {items.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <p className="text-[14px] font-semibold text-cream/75">
                        You’re all caught up
                      </p>
                      <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-5 text-cream/40">
                        New coaching notes and help activity will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const presentation = notificationPresentation(
                          item.kind,
                          teacher.name,
                          item.title
                        );
                        const content = (
                          <div className="flex min-w-0 items-start gap-3 px-3 py-3">
                            <NotificationSource
                              presentation={presentation}
                              teacher={teacher}
                              sender={item.sender}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-[11.5px] font-medium text-cream/45">
                                  {presentation.label}
                                </p>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  <time
                                    dateTime={new Date(item.createdAt).toISOString()}
                                    className="text-[11px] tabular-nums text-cream/35"
                                  >
                                    {relativeTime(item.createdAt)}
                                  </time>
                                  {!item.read ? (
                                    <span
                                      aria-label="Unread"
                                      className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)]"
                                    />
                                  ) : null}
                                </span>
                              </div>
                              <p
                                className={`mt-0.5 text-[13.5px] font-semibold leading-5 tracking-[-0.01em] ${item.read ? "text-cream/75" : "text-cream"}`}
                              >
                                {item.title}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.55] text-cream/48">
                                {item.body}
                              </p>
                            </div>
                          </div>
                        );

                        return item.href ? (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="workspace-notification-item group block rounded-xl outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream/30"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div key={item.id} className="rounded-xl">
                            {content}
                          </div>
                        );
                      })}
                    </div>
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
