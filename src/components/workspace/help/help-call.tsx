"use client";

import { Check, Loader2, Mic, MicOff, PhoneOff, Send, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import {
  SNAPSHOT_TOPIC,
  SnapshotAssembler,
  encodeSnapshotPackets,
  hasChanged,
  isNewer,
  type HelpSnapshot,
  type WorkspaceState
} from "@/lib/help/snapshot";

type CallState = "idle" | "connecting" | "live" | "ended" | "failed";

export interface HelpDataChannel {
  publish(payload: Uint8Array, topic: string): Promise<void>;
}

interface Connection {
  token: string;
  url: string;
  roomName: string;
  seat: "learner" | "helper";
  remainingMs: number;
}

interface SessionStatus {
  active: boolean;
  ended: boolean;
  remainingMs: number | null;
  canRate: boolean;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** How often the learner's workspace is pushed while they are typing. */
const SNAPSHOT_INTERVAL_MS = 900;

/**
 * The peer call, and the learner's workspace alongside it.
 *
 * Audio only, and imported lazily: livekit-client is a large dependency that
 * most visitors to a question page never need, so it is fetched at the moment
 * somebody actually joins rather than shipped with the workspace.
 */
export function HelpCall({
  requestId,
  onEnded,
  snapshot,
  onSnapshot,
  autoJoin = false,
  onDataChannel,
  onDataMessage,
  peerName = "your peer"
}: {
  requestId: string;
  onEnded?: (result: { canRate: boolean }) => void;
  /**
   * Learner seat only: read the current workspace. Called on a timer, so it
   * must be cheap and must not allocate anything it does not have to.
   */
  snapshot?: () => WorkspaceState;
  /** Helper seat only: a newer view of the learner's workspace arrived. */
  onSnapshot?: (incoming: HelpSnapshot) => void;
  /** Used after the helper explicitly chose “Accept & join” in the toast. */
  autoJoin?: boolean;
  /** Shared notes/canvas transport. Null is emitted whenever the room disconnects. */
  onDataChannel?: (channel: HelpDataChannel | null) => void;
  onDataMessage?: (payload: Uint8Array, topic: string) => void;
  peerName?: string;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [peerPresent, setPeerPresent] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [snapshotSent, setSnapshotSent] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const connected = useRef(false);
  const leaving = useRef(false);
  // Held in refs so the publish timer never re-subscribes when the workspace
  // changes — it reads the latest getter on each tick instead.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const onDataChannelRef = useRef(onDataChannel);
  onDataChannelRef.current = onDataChannel;
  const onDataMessageRef = useRef(onDataMessage);
  onDataMessageRef.current = onDataMessage;
  const lastSent = useRef<WorkspaceState | null>(null);
  const lastSeen = useRef<HelpSnapshot | null>(null);
  const assembler = useRef(new SnapshotAssembler());
  const streamId = useRef("");
  const sequence = useRef(0);
  const publishing = useRef(false);
  const forcePublishPending = useRef(false);
  const autoJoinAttempted = useRef(false);
  const snapshotSentTimer = useRef<number | null>(null);

  const disconnectRoom = useCallback(async () => {
    // Clear the flag before disconnecting so RoomEvent.Disconnected does not
    // mistake an intentional cleanup for a network failure and POST twice.
    connected.current = false;
    const active = room.current;
    room.current = null;
    onDataChannelRef.current?.(null);
    await active?.disconnect().catch(() => undefined);
    audio.current?.remove();
    audio.current = null;
  }, []);

  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;

    await disconnectRoom();
    setPeerPresent(false);
    setAudioBlocked(false);

    const closeResult = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "leave" })
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json().catch(() => null);
        return payload?.success === true ? { canRate: payload.data?.canRate === true } : null;
      })
      .catch(() => null);

    if (!closeResult) {
      leaving.current = false;
      setState("failed");
      setError("You left the room, but we could not close the conversation. Try again.");
      return;
    }

    setState("ended");
    onEnded?.(closeResult);
  }, [disconnectRoom, onEnded, requestId]);

  // Disconnecting on unmount matters more here than usual: a room left open
  // keeps publishing the microphone of somebody who thinks they hung up.
  useEffect(() => {
    return () => {
      // Page navigation is not the same as pressing Leave: the user may come
      // straight back and rejoin the still-live session.
      connected.current = false;
      onDataChannelRef.current?.(null);
      void room.current?.disconnect().catch(() => undefined);
      audio.current?.remove();
      if (snapshotSentTimer.current !== null) window.clearTimeout(snapshotSentTimer.current);
    };
  }, []);

  const publishWorkspace = useCallback(
    async (force = false) => {
      if (force) forcePublishPending.current = true;
      if (publishing.current) return;
      publishing.current = true;

      try {
        do {
          const forced = forcePublishPending.current;
          forcePublishPending.current = false;
          const active = room.current;
          const read = snapshotRef.current;
          if (!active || !read || !streamId.current) return;

          const current = read();
          if (!forced && !hasChanged(current, lastSent.current)) return;

          const packets = encodeSnapshotPackets({
            ...current,
            streamId: streamId.current,
            seq: ++sequence.current,
            at: Date.now()
          });
          for (const packet of packets) {
            await active.localParticipant.publishData(packet, {
              reliable: true,
              topic: SNAPSHOT_TOPIC,
              destinationIdentities: [`helper-${requestId}`]
            });
          }
          lastSent.current = current;
        } while (forcePublishPending.current);
      } catch {
        // A failed revision remains dirty because lastSent was not advanced;
        // the next interval or reconnect retries the full atomic snapshot.
      } finally {
        publishing.current = false;
      }
    },
    [requestId]
  );

  const sendLatestState = useCallback(async () => {
    await publishWorkspace(true);
    setSnapshotSent(true);
    if (snapshotSentTimer.current !== null) window.clearTimeout(snapshotSentTimer.current);
    snapshotSentTimer.current = window.setTimeout(() => setSnapshotSent(false), 2_000);
  }, [publishWorkspace]);

  /*
   * Publish immediately, then only when something visible changes. A forced
   * resend on participant join/reconnect covers LiveKit's non-buffered packets.
   */
  useEffect(() => {
    if (state !== "live" || !snapshotRef.current) return;

    void publishWorkspace(true);
    const timer = window.setInterval(() => void publishWorkspace(), SNAPSHOT_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [publishWorkspace, state]);

  useEffect(() => {
    if (state !== "live") return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        const next = current - 1_000;
        if (next <= 0) void leave();
        return Math.max(0, next);
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [leave, state]);

  // Browser timers are heavily throttled in background tabs. Reconcile with
  // the server so the displayed clock and remote hang-ups remain truthful.
  useEffect(() => {
    if (state !== "live") return;
    let cancelled = false;
    let reconciling = false;

    const reconcile = async () => {
      if (reconciling || leaving.current) return;
      reconciling = true;
      try {
        const response = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data || cancelled) return;

        const status = payload.data as SessionStatus;
        if (status.ended) {
          await disconnectRoom();
          if (cancelled) return;
          setPeerPresent(false);
          setAudioBlocked(false);
          setRemaining(0);
          setState("ended");
          onEnded?.({ canRate: status.canRate });
          return;
        }

        if (status.active && typeof status.remainingMs === "number") {
          setRemaining(status.remainingMs);
        }
      } catch {
        // A transient status failure must not tear down healthy LiveKit audio;
        // the local clock continues and the next poll retries.
      } finally {
        reconciling = false;
      }
    };

    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [disconnectRoom, onEnded, requestId, state]);

  const join = useCallback(async () => {
    leaving.current = false;
    setState("connecting");
    setError(null);

    try {
      const response = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join" })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message ?? "Could not join the conversation.");
      }

      const connection = payload.data as Connection;
      setRemaining(connection.remainingMs);
      streamId.current = crypto.randomUUID();
      sequence.current = 0;
      lastSent.current = null;
      lastSeen.current = null;
      assembler.current.reset();

      const { Room: LiveKitRoom, RoomEvent } = await import("livekit-client");
      const active = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
      room.current = active;

      active.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== "audio") return;
        const element = track.attach() as HTMLAudioElement;
        element.autoplay = true;
        document.body.appendChild(element);
        audio.current = element;
        setPeerPresent(true);
      });
      active.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind !== "audio") return;
        track.detach();
        audio.current?.remove();
        audio.current = null;
        setPeerPresent(false);
      });
      active.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        const expectedPeer =
          connection.seat === "learner" ? `helper-${requestId}` : `learner-${requestId}`;
        if (participant?.identity !== expectedPeer) return;

        if (topic === SNAPSHOT_TOPIC) {
          const receive = onSnapshotRef.current;
          if (connection.seat !== "helper" || !receive) return;

          // Everything off the wire is untrusted: a bad packet reads as nothing.
          const incoming = assembler.current.accept(payload);
          if (!incoming || !isNewer(incoming, lastSeen.current)) return;

          lastSeen.current = incoming;
          receive(incoming);
          return;
        }

        if (topic?.startsWith("help.collaboration.")) {
          onDataMessageRef.current?.(payload, topic);
        }
      });
      active.on(RoomEvent.ParticipantConnected, () => {
        setPeerPresent(true);
        if (connection.seat === "learner") void publishWorkspace(true);
      });
      active.on(RoomEvent.ParticipantDisconnected, () => setPeerPresent(false));
      active.on(RoomEvent.Reconnected, () => {
        if (connection.seat === "learner") void publishWorkspace(true);
      });
      active.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!active.canPlaybackAudio);
      });
      // If LiveKit drops an established connection, close the server lifecycle
      // too; otherwise the UI says ended while the request remains CLAIMED.
      active.on(RoomEvent.Disconnected, () => {
        if (connected.current) void leave();
      });

      await active.connect(connection.url, connection.token);
      const peerIdentity =
        connection.seat === "learner" ? `helper-${requestId}` : `learner-${requestId}`;
      onDataChannelRef.current?.({
        publish: (payload, topic) => {
          const packet = new Uint8Array(new ArrayBuffer(payload.byteLength));
          packet.set(payload);
          return active.localParticipant.publishData(packet, {
            reliable: true,
            topic,
            destinationIdentities: [peerIdentity]
          });
        }
      });
      await active.localParticipant.setMicrophoneEnabled(true);
      await active.startAudio().catch(() => undefined);

      const presenceResponse = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "connected" })
      });
      const presence = await presenceResponse.json().catch(() => null);
      if (!presenceResponse.ok || !presence?.success || presence.data?.connected !== true) {
        throw new Error("Could not confirm the conversation connection.");
      }

      connected.current = true;
      setAudioBlocked(!active.canPlaybackAudio);

      setPeerPresent(active.remoteParticipants.size > 0);
      setState("live");
    } catch (caught) {
      await disconnectRoom();
      leaving.current = false;
      setState("failed");
      setError(caught instanceof Error ? caught.message : "Could not join the conversation.");
    }
  }, [disconnectRoom, leave, publishWorkspace, requestId]);

  useEffect(() => {
    if (!autoJoin || autoJoinAttempted.current) return;
    autoJoinAttempted.current = true;
    void join();
  }, [autoJoin, join]);

  const toggleMute = useCallback(async () => {
    const active = room.current;
    if (!active) return;
    const next = !muted;
    setMuted(next);
    await active.localParticipant.setMicrophoneEnabled(!next).catch(() => setMuted(!next));
  }, [muted]);

  const enableAudio = useCallback(async () => {
    const active = room.current;
    if (!active) return;
    await active.startAudio().catch(() => undefined);
    setAudioBlocked(!active.canPlaybackAudio);
  }, []);

  if (state === "ended") {
    return <p className="text-[13px] text-cream/45">Conversation ended.</p>;
  }

  if (state === "live") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-cream">
          <span
            aria-hidden="true"
            className={[
              "inline-block h-2 w-2 rounded-full",
              peerPresent ? "bg-[#8be6bd]" : "animate-pulse bg-[#f4d58b]"
            ].join(" ")}
          />
          {peerPresent ? `Connected with ${peerName}` : `Waiting for ${peerName} to join`}
        </span>

        <span className="text-[12.5px] tabular-nums text-cream/45">{clock(remaining)} left</span>

        <span className="flex-1" />

        {audioBlocked ? (
          <button
            type="button"
            onClick={() => void enableAudio()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#f4d58b]/10 px-3 text-[12.5px] font-semibold text-[#f4d58b] transition hover:bg-[#f4d58b]/15"
          >
            <Volume2 size={13} aria-hidden="true" />
            Enable audio
          </button>
        ) : null}

        {snapshot ? (
          <button
            type="button"
            onClick={() => void sendLatestState()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.055] px-3 text-[12.5px] font-semibold text-cream/68 transition hover:bg-white/[0.09] hover:text-cream"
          >
            {snapshotSent ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Send size={13} aria-hidden="true" />
            )}
            {snapshotSent ? "State sent" : "Send latest state"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void toggleMute()}
          aria-label={muted ? "Unmute" : "Mute"}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.055] text-cream/65 transition hover:bg-white/[0.09] hover:text-cream"
        >
          {muted ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        <button
          type="button"
          onClick={() => void leave()}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#f0a3a3]/15 px-3.5 text-[13px] font-semibold text-[#ffb4b4] transition hover:bg-[#f0a3a3]/25"
        >
          <PhoneOff size={13} aria-hidden="true" />
          Leave
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => void join()}
        disabled={state === "connecting"}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-cream px-3.5 text-[13px] font-semibold text-[#171a16] transition hover:bg-white disabled:pointer-events-none disabled:opacity-45"
      >
        {state === "connecting" ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Mic size={12} aria-hidden="true" />
        )}
        {state === "connecting" ? "Connecting" : "Join voice"}
      </button>
      {error ? <span className="text-[12.5px] text-[#ffb4b4]">{error}</span> : null}
    </div>
  );
}
