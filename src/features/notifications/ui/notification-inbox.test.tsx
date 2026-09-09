import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";

const inbox = vi.hoisted(() => ({
  refresh: vi.fn().mockResolvedValue(undefined),
  markRead: vi.fn().mockResolvedValue(undefined),
  markAllRead: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("next/image", () => ({
  default: ({
    fill,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img {...props} data-fill={String(Boolean(fill))} />
  )
}));

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({
    id: "claire",
    name: "Claire",
    portrait: "/images/teacher-portraits/claire.jpg"
  })
}));

vi.mock("./workspace-notification-polling", () => ({
  useWorkspaceNotifications: () => ({
    items: [
      {
        id: "notification-1",
        kind: "RESUME_ROAST_COMPLETED",
        title: "James has analysed your resume",
        body: "Your target-fit score is 65/100.",
        href: "/resume-roast",
        read: false,
        createdAt: Date.now(),
        sender: null
      }
    ],
    unread: 1,
    refresh: inbox.refresh,
    markRead: inbox.markRead,
    markAllRead: inbox.markAllRead
  })
}));

describe("NotificationInbox", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows James's portrait for Resume Roast notifications", () => {
    render(<NotificationInbox />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    const source = screen.getByLabelText("James, Resume Roast");
    expect(source.querySelector("img")).toHaveAttribute(
      "src",
      "/images/teacher-portraits/james.jpg"
    );
    expect(source).not.toHaveAccessibleName("Claire, your teacher");
  });
});
