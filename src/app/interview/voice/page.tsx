"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteTrack } from "livekit-client";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { PathRail } from "@/components/interview/path-rail";
import { MicMeter } from "@/components/interview/mic-meter";
import { InterviewerPresence } from "@/components/interview/interviewer-presence";
import { AvatarStage } from "@/components/interview/avatar-stage";
import type { PresenceState } from "@/components/interview/interviewer-presence";
import { endInterview, getSession } from "@/lib/api-client";
import type { Phase, Turn } from "@/lib/types";

const HARD_CAP_MS = 15 * 60 * 1000;
const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const POLL_MS = 1500;

type Status = "connecting" | "live" | "ended" | "error";

export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <VoiceInterview />
    </Suspense>
  );
}

function VoiceInterview() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("session") ?? null;

  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("questioning");
  const [progress, setProgress] = useState({ index: 0, count: 4, followUps: 0 });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [agentTrack, setAgentTrack] = useState<MediaStreamTrack | null>(null);
  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null);

  const roomRef = useRef<Room | null>(null);
  const micRetryRef = useRef<(() => void) | null>(null);
  const teardownRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Join the room. The token carries the agent dispatch, so connecting is what
  // summons the interviewer.
  useEffect(() => {
    if (!sessionId) {
      router.replace("/interview");
      return;
    }

    // React Strict Mode mounts, unmounts, then remounts effects in dev. A
    // naive disconnect in cleanup tears down the WebRTC session mid-negotiation,
    // which surfaces as "DataChannel User-Initiated Abort". Teardown is deferred
    // so a synthetic remount can cancel it.
    if (teardownRef.current !== null) {
      window.clearTimeout(teardownRef.current);
      teardownRef.current = null;
    }
    if (roomRef.current) {
      const existing = roomRef.current;
      if (existing.state === "connected") {
        setStatus("live");
        const mic = existing.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (mic?.track) {
          setLocalTrack(mic.track.mediaStreamTrack);
          setMicOn(!mic.isMuted);
        }
      }
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
        void audioRef.current.play().catch(() => null);
        // The same track feeds the analyser that sculpts the figure.
        setAgentTrack(track.mediaStreamTrack);
      }
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.kind === Track.Kind.Audio && publication.track) {
        setLocalTrack(publication.track.mediaStreamTrack);
      }
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setAgentSpeaking(speakers.some((speaker) => speaker.identity !== room.localParticipant.identity));
    });

    room.on(RoomEvent.Disconnected, () => setStatus((s) => (s === "ended" ? s : "error")));

    async function connect() {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.error?.message ?? "Could not join the room");
        }

        await room.connect(payload.data.url, payload.data.token);
        setStatus("live");

        await enableMic(room);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not connect");
        setStatus("error");
      }
    }

    async function enableMic(target: Room) {
      try {
        await target.localParticipant.setMicrophoneEnabled(true);
        const mic = target.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (mic?.track) {
          setLocalTrack(mic.track.mediaStreamTrack);
          setMicError(null);
          setMicOn(true);
        } else {
          setMicError("The microphone did not publish. Try the retry button below.");
        }
      } catch (caught) {
        const name = caught instanceof Error ? caught.name : "";
        setMicOn(false);
        setMicError(
          name === "NotAllowedError"
            ? "Microphone blocked. Click the icon at the left of the address bar, set Microphone to Allow, then press retry."
            : name === "NotFoundError"
              ? "No microphone found. Check your input device and press retry."
              : "The microphone could not start. Press retry."
        );
      }
    }

    micRetryRef.current = () => void enableMic(room);

    void connect();

    return () => {
      teardownRef.current = window.setTimeout(() => {
        void room.disconnect();
        roomRef.current = null;
        teardownRef.current = null;
      }, 400);
    };
  }, [router, sessionId]);

  // The transcript comes from the brain, not from LiveKit — the server already
  // records every turn with millisecond timings.
  const poll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const session = await getSession(sessionId);
      setTurns(session.turns);
      setPhase(session.phase);
      setStartedAt(session.startedAt);
      setProgress({
        index: session.questionIndex,
        count: session.questionCount,
        followUps: session.followUpCount
      });
      if (session.phase === "done") setStatus("ended");
    } catch {
      /* transient — the next tick retries */
    }
  }, [sessionId]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    if (startedAt === null || status === "ended") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [startedAt, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;

    if (!micOn) {
      micRetryRef.current?.();
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
  }

  async function stop() {
    if (!sessionId) return;
    setStatus("ended");
    await endInterview(sessionId).catch(() => null);
    await roomRef.current?.disconnect();
  }

  const overCap = elapsed >= HARD_CAP_MS;
  // Only the live exchange belongs on screen; the full record is the report's job.
  const recent = turns.slice(-3);

  const presence: PresenceState =
    status === "ended"
      ? "ended"
      : status !== "live"
        ? "connecting"
        : agentSpeaking
          ? "speaking"
          : "listening";

  return (
    <Shell>
      <audio ref={audioRef} autoPlay />

      <header className="relative flex flex-wrap items-center gap-4 pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <HelixMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-tight">Helix</span>
        </Link>

        <span className="blueprint-label hidden items-center gap-2 rounded-full border border-cream/20 px-3 py-1 text-cream/60 sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-[#4bab7c]" : "bg-cream/30"}`}
          />
          Voice
        </span>

        <div className="hidden lg:block">
          <PathRail
            phase={phase}
            questionIndex={progress.index}
            questionCount={progress.count}
            followUpCount={progress.followUps}
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span
            className={`font-mono text-xs tabular-nums ${overCap ? "text-[#ff9a9a]" : "text-cream/60"}`}
          >
            {formatClock(elapsed)}
            <span className="text-cream/25"> / 15:00</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={status === "ended"}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/20 px-3 text-xs font-semibold text-cream/60 transition hover:border-[#dd5f5f]/60 hover:text-cream disabled:opacity-30"
          >
            <Square size={11} aria-hidden="true" />
            End
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-cream/12">
          <div
            className={`h-full transition-all duration-500 ${overCap ? "bg-[#dd5f5f]" : "bg-cream/70"}`}
            style={{ width: `${Math.min(100, (elapsed / HARD_CAP_MS) * 100)}%` }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none flex min-h-[30vh] flex-1 items-center justify-center sm:min-h-[34vh]">
          <div className="h-full max-h-[31rem] w-full max-w-[31rem]">
            {AVATAR_URL ? (
              <AvatarStage agentTrack={agentTrack} state={presence} url={AVATAR_URL} />
            ) : (
              <InterviewerPresence
                agentTrack={agentTrack}
                localTrack={localTrack}
                state={presence}
              />
            )}
          </div>
        </div>

        <div className="thin-scroll fade-top max-h-[36vh] w-full shrink-0 space-y-4 overflow-y-auto pb-1 pr-1">
          {status === "connecting" ? (
            <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-cream/40">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Connecting to the room
            </p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-[#dd5f5f]/45 bg-[#dd5f5f]/10 px-4 py-3">
              <p className="text-sm text-cream">{error}</p>
              <Link href="/interview" className="mt-2 inline-block text-xs text-cream/60 underline">
                Start over
              </Link>
            </div>
          ) : null}

          {micError ? (
            <div className="rounded-xl border border-[#e0a13c]/50 bg-[#e0a13c]/10 px-4 py-3">
              <p className="text-sm leading-6 text-cream">{micError}</p>
              <button
                type="button"
                onClick={() => micRetryRef.current?.()}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-cream/40 px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
              >
                Retry microphone
              </button>
            </div>
          ) : null}

          {recent.map((turn, index) => (
            <TurnLine
              key={`${turn.startMs}-${index}`}
              turn={turn}
              latest={index === recent.length - 1 && turn.speaker === "agent"}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-cream/15 py-4 sm:gap-4 sm:py-6">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={status !== "live"}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-30 ${
            micOn ? "border-cream bg-cream text-blueprint" : "border-cream/30 text-cream/60"
          }`}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
        </button>

        <div className="flex-1">
          <p className="text-sm font-medium text-cream">
            {status === "ended"
              ? "Interview complete"
              : agentSpeaking
                ? "Helix is speaking"
                : micOn
                  ? "Listening — just talk"
                  : "Microphone muted"}
          </p>
          <div className="mt-1.5">
            <MicMeter track={localTrack} muted={!micOn || status !== "live"} />
          </div>
        </div>

        <Link
          href={`/interview/text?session=${sessionId ?? ""}`}
          className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/35 transition hover:text-cream/70 sm:block"
        >
          Text mode
        </Link>
      </div>
    </Shell>
  );
}

/**
 * One line of the spoken exchange. Only the newest agent line is emphasised —
 * this is a conversation you are listening to, not a chat log to read back.
 */
function TurnLine({ turn, latest }: { turn: Turn; latest: boolean }) {
  const label = turn.speaker === "user" ? "You" : "Helix";

  return (
    <div className="msg-in">
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
          turn.speaker === "user" ? "text-cream/30" : "text-cream/45"
        }`}
      >
        {label}
      </p>
      <p
        className={
          turn.speaker === "user"
            ? "mt-1.5 text-[15px] leading-8 text-cream/50"
            : latest
              ? "mt-1.5 text-xl font-medium leading-9 text-cream"
              : "mt-1.5 text-[15px] leading-8 text-cream/60"
        }
      >
        {turn.text}
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint relative h-[100svh] overflow-hidden px-4 sm:px-8">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl flex-col pt-6">
        {children}
      </div>
    </main>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
