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

import type { CurrentPeerHelpEngagement } from "@/lib/help/help-history";
import type { HelpInboxData } from "@/lib/help/help-inbox";

const POLL_MS = 15_000;

interface WorkspaceHelpSnapshot {
  inbox: HelpInboxData | null;
  activeEngagement: CurrentPeerHelpEngagement | null;
  inboxLoaded: boolean;
  activeLoaded: boolean;
  inboxError: string | null;
}

interface WorkspaceHelpPollingValue extends WorkspaceHelpSnapshot {
  refresh: () => Promise<WorkspaceHelpSnapshot>;
  clearActiveEngagement: (requestId: string) => void;
}

const INITIAL_SNAPSHOT: WorkspaceHelpSnapshot = {
  inbox: null,
  activeEngagement: null,
  inboxLoaded: false,
  activeLoaded: false,
  inboxError: null
};

const WorkspaceHelpPollingContext = createContext<WorkspaceHelpPollingValue | null>(null);

async function readApiData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`Could not load ${url}.`);
  return payload.data as T;
}

export function WorkspaceHelpPollingProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const snapshotRef = useRef(snapshot);
  const mountedRef = useRef(false);
  const inFlightRef = useRef<Promise<WorkspaceHelpSnapshot> | null>(null);
  const queuedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const commit = useCallback((next: WorkspaceHelpSnapshot) => {
    snapshotRef.current = next;
    if (mountedRef.current) setSnapshot(next);
    return next;
  }, []);

  const runRefresh = useCallback(async () => {
    let latest = snapshotRef.current;

    do {
      queuedRef.current = false;
      if (document.visibilityState !== "visible" || !mountedRef.current) break;

      const controller = new AbortController();
      controllerRef.current = controller;
      const [inboxResult, activeResult] = await Promise.allSettled([
        readApiData<HelpInboxData>("/api/help/inbox", controller.signal),
        readApiData<CurrentPeerHelpEngagement | null>("/api/help/active", controller.signal)
      ]);
      if (controllerRef.current === controller) controllerRef.current = null;
      if (controller.signal.aborted || !mountedRef.current) {
        if (!mountedRef.current) break;
        continue;
      }

      latest = commit({
        inbox: inboxResult.status === "fulfilled" ? inboxResult.value : latest.inbox,
        activeEngagement:
          activeResult.status === "fulfilled" ? activeResult.value : latest.activeEngagement,
        inboxLoaded: true,
        activeLoaded: true,
        inboxError: inboxResult.status === "rejected" ? "Could not load the Trailmate inbox." : null
      });
    } while (queuedRef.current && document.visibilityState === "visible");

    return latest;
  }, [commit]);

  const refresh = useCallback((): Promise<WorkspaceHelpSnapshot> => {
    if (!mountedRef.current || document.visibilityState !== "visible") {
      return Promise.resolve(snapshotRef.current);
    }
    if (inFlightRef.current) {
      queuedRef.current = true;
      return inFlightRef.current;
    }

    const request = runRefresh().finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });
    inFlightRef.current = request;
    return request;
  }, [runRefresh]);

  const clearActiveEngagement = useCallback(
    (requestId: string) => {
      const current = snapshotRef.current;
      if (current.activeEngagement?.requestId !== requestId) return;
      commit({ ...current, activeEngagement: null });
    },
    [commit]
  );

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
      queuedRef.current = false;
    };
  }, [refresh]);

  const value = useMemo<WorkspaceHelpPollingValue>(
    () => ({ ...snapshot, refresh, clearActiveEngagement }),
    [clearActiveEngagement, refresh, snapshot]
  );

  return (
    <WorkspaceHelpPollingContext.Provider value={value}>
      {children}
    </WorkspaceHelpPollingContext.Provider>
  );
}

export function useWorkspaceHelpPolling(): WorkspaceHelpPollingValue {
  const value = useContext(WorkspaceHelpPollingContext);
  if (!value) {
    throw new Error("useWorkspaceHelpPolling must be used inside WorkspaceHelpPollingProvider");
  }
  return value;
}
