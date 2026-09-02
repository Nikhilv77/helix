"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

const POLL_MS = 15_000;

export interface NotificationSender {
  label: string;
  profileImage: string | null;
}

export interface WorkspaceNotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: number;
  sender: NotificationSender | null;
}

interface WorkspaceNotificationValue {
  items: WorkspaceNotificationItem[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const WorkspaceNotificationContext = createContext<WorkspaceNotificationValue | null>(null);

export function WorkspaceNotificationPollingProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WorkspaceNotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const mountedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const refreshRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const markingIdsRef = useRef(new Set<string>());

  const runRefresh = useCallback(async () => {
    do {
      refreshQueuedRef.current = false;
      if (!mountedRef.current || document.visibilityState !== "visible") return;

      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const response = await fetch("/api/notifications", { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!controller.signal.aborted && mountedRef.current && response.ok && payload?.success) {
          setItems(payload.data?.items ?? []);
          setUnread(payload.data?.unread ?? 0);
        }
      } catch {
        // Notifications stay unobtrusive when the connection is unavailable.
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    } while (refreshQueuedRef.current && document.visibilityState === "visible");
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (!mountedRef.current || document.visibilityState !== "visible") {
      return Promise.resolve();
    }
    if (refreshRef.current) {
      refreshQueuedRef.current = true;
      return refreshRef.current;
    }

    const request = runRefresh().finally(() => {
      if (refreshRef.current === request) refreshRef.current = null;
    });
    refreshRef.current = request;
    return request;
  }, [runRefresh]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
      else controllerRef.current?.abort();
    };
    const timer = window.setInterval(refreshVisible, POLL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      controllerRef.current?.abort();
      controllerRef.current = null;
      refreshQueuedRef.current = false;
    };
  }, [refresh]);

  const markRead = useCallback(async (ids: string[]) => {
    const pendingIds = ids.filter((id) => !markingIdsRef.current.has(id));
    if (pendingIds.length === 0) return;
    pendingIds.forEach((id) => markingIdsRef.current.add(id));

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: pendingIds })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !mountedRef.current) return;

      const visible = new Set(pendingIds);
      setUnread((current) => Math.max(0, current - (payload.data?.marked ?? 0)));
      setItems((current) =>
        current.map((item) => (visible.has(item.id) ? { ...item, read: true } : item))
      );
    } catch {
      // Keep server state authoritative until a successful write.
    } finally {
      pendingIds.forEach((id) => markingIdsRef.current.delete(id));
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !mountedRef.current) return;
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch {
      // Keep server state authoritative until a successful write.
    }
  }, []);

  const value = useMemo<WorkspaceNotificationValue>(
    () => ({ items, unread, refresh, markRead, markAllRead }),
    [items, markAllRead, markRead, refresh, unread]
  );

  return (
    <WorkspaceNotificationContext.Provider value={value}>
      {children}
    </WorkspaceNotificationContext.Provider>
  );
}

export function useWorkspaceNotifications(): WorkspaceNotificationValue {
  const value = useContext(WorkspaceNotificationContext);
  if (!value) {
    throw new Error(
      "useWorkspaceNotifications must be used inside WorkspaceNotificationPollingProvider"
    );
  }
  return value;
}
