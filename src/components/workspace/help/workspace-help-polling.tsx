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
import { announceWorkspaceHelpChanged } from "@/lib/help/help-ui-events";

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
  const statusControllerRef = useRef<AbortController | null>(null);

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
    let statusVersion: string | null = null;
    let statusInFlight = false;
    let statusQueued = false;
    let forceRefreshQueued = false;

    const checkStatus = async (forceFullRefresh = false): Promise<void> => {
      if (!mountedRef.current || document.visibilityState !== "visible") return;
      if (statusInFlight) {
        if (forceFullRefresh) {
          statusQueued = true;
          forceRefreshQueued = true;
        }
        return;
      }

      statusInFlight = true;
      let shouldRefresh = forceFullRefresh;
      const controller = new AbortController();
      statusControllerRef.current = controller;
      try {
        const status = await readApiData<{ version: string }>(
          "/api/help/status",
          controller.signal
        );
        if (controller.signal.aborted || !mountedRef.current) return;

        const changed = statusVersion !== null && status.version !== statusVersion;
        shouldRefresh ||= changed;
        statusVersion = status.version;
        if (shouldRefresh) await refresh();
        if (changed) announceWorkspaceHelpChanged();
      } catch {
        // A missed status tick is harmless; the next tick or focus retries it.
        if (forceFullRefresh) await refresh();
      } finally {
        if (statusControllerRef.current === controller) statusControllerRef.current = null;
        statusInFlight = false;
        if (statusQueued && mountedRef.current) {
          const queuedForce = forceRefreshQueued;
          statusQueued = false;
          forceRefreshQueued = false;
          void checkStatus(queuedForce);
        }
      }
    };

    // Establish the cheap version token before the initial full snapshot. An
    // event racing these calls is included by the full snapshot and cannot be
    // skipped by the next status comparison.
    void checkStatus(true);

    const refreshVisible = () => {
      if (document.visibilityState === "visible") void checkStatus(true);
      else {
        controllerRef.current?.abort();
        statusControllerRef.current?.abort();
      }
    };
    const timer = window.setInterval(() => void checkStatus(), POLL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      controllerRef.current?.abort();
      statusControllerRef.current?.abort();
      controllerRef.current = null;
      statusControllerRef.current = null;
      queuedRef.current = false;
      statusQueued = false;
      forceRefreshQueued = false;
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
