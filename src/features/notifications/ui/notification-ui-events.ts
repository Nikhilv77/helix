export const WORKSPACE_NOTIFICATIONS_CHANGED_EVENT =
  "trailgrad:workspace-notifications-changed";

export function notifyWorkspaceNotificationsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WORKSPACE_NOTIFICATIONS_CHANGED_EVENT));
  }
}
